import type { PagesFunction } from '../_shared/types';
import type { Env } from '../_shared/types';
import { auth } from '../_shared/guard';
import { ok, fail, readJson } from '../_shared/response';
import { getRange, appendRange, updateRange } from '../_shared/google';
import { DEFAULT_CONTENT } from '../_shared/content-default';
import { auditLog } from '../_shared/data';
import { requestMeta, nowIso } from '../_shared/request';
import { userPermissionState } from '../_shared/permissions';

async function rows(env: Env) {
  const result = await getRange(env, 'Content!A2:H3000');
  return result
    .filter((row) => row[0])
    .map((row, index) => ({
      row: index + 2,
      pageKey: row[0],
      sectionKey: row[1],
      sortOrder: Number(row[2] || 0),
      title: row[3],
      bodyMarkdown: row[4] || '',
      metaJson: row[5] || '',
      updatedAt: row[6] || '',
      updatedBy: row[7] || '',
    }));
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await auth(context);
  if (access.error) return access.error;

  const session = access.session!;
  const items = await rows(context.env);
  const source = items.length ? items : DEFAULT_CONTENT;

  if (session.role === 'admin') return ok({ items: source });

  const permissions = await userPermissionState(
    context.env,
    session.sub,
    session.role,
  );

  if (!permissions.can('menu', 'plans')) {
    return fail(403, '사업계획서 열람 권한이 없습니다.');
  }

  const visible = source.filter(
    (item) =>
      permissions.can('plan', item.pageKey) &&
      permissions.can('content', `${item.pageKey}/${item.sectionKey}`),
  );

  return ok({ items: visible });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const access = await auth(context, true, true);
  if (access.error) return access.error;

  try {
    const body = await readJson<any>(context.request);
    if (!body.pageKey || !body.sectionKey || !body.title) {
      return fail(400, '필수 항목이 없습니다.');
    }

    const list = await rows(context.env);
    const found = list.find(
      (item) => item.pageKey === body.pageKey && item.sectionKey === body.sectionKey,
    );
    const now = nowIso();
    const values = [[
      body.pageKey,
      body.sectionKey,
      Number(body.sortOrder || 0),
      body.title,
      body.bodyMarkdown || '',
      '',
      now,
      access.session!.sub,
    ]];

    if (found) {
      await updateRange(context.env, `Content!A${found.row}:H${found.row}`, values);
    } else {
      await appendRange(context.env, 'Content!A:H', values);
    }

    const meta = requestMeta(context.request);
    await auditLog(context.env, [
      now,
      access.session!.sub,
      'CONTENT_UPDATE',
      `${body.pageKey}/${body.sectionKey}`,
      found ? JSON.stringify({ title: found.title, bodyMarkdown: found.bodyMarkdown }) : '',
      JSON.stringify({ title: body.title, bodyMarkdown: body.bodyMarkdown }),
      meta.ip,
      meta.country,
    ]);

    return ok();
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : '저장 실패');
  }
};

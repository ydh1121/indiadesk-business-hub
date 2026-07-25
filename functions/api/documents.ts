import type { PagesFunction } from '../_shared/types';
import type { Env } from '../_shared/types';
import { auth } from '../_shared/guard';
import { ok, fail, readJson } from '../_shared/response';
import { getRange, updateRange } from '../_shared/google';
import { auditLog } from '../_shared/data';
import { requestMeta, nowIso } from '../_shared/request';
import { userPermissionState } from '../_shared/permissions';

async function rows(env: Env) {
  const result = await getRange(env, 'Documents!A2:K2000');
  return result
    .filter((row) => row[0])
    .map((row, index) => ({
      row: index + 2,
      id: row[0],
      title: row[1],
      category: row[2],
      purpose: row[3],
      description: row[4],
      status: row[5],
      fileUrl: row[6] || '',
      version: row[7] || '',
      access: row[8] || 'all',
      updatedAt: row[9] || '',
      updatedBy: row[10] || '',
    }));
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await auth(context);
  if (access.error) return access.error;

  const session = access.session!;
  const items = await rows(context.env);

  if (session.role === 'admin') return ok({ items });

  const permissions = await userPermissionState(
    context.env,
    session.sub,
    session.role,
  );

  if (!permissions.can('menu', 'documents')) {
    return fail(403, '문서 다운로드 열람 권한이 없습니다.');
  }

  const visible = items.filter(
    (item) =>
      item.access === 'all' &&
      permissions.can('document', item.id),
  );

  return ok({ items: visible });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const access = await auth(context, true, true);
  if (access.error) return access.error;

  try {
    const body = await readJson<any>(context.request);
    const list = await rows(context.env);
    const document = list.find((item) => item.id === body.id);
    if (!document) return fail(404, '문서를 찾을 수 없습니다.');

    const now = nowIso();
    await updateRange(
      context.env,
      `Documents!A${document.row}:K${document.row}`,
      [[
        document.id,
        body.title || document.title,
        body.category || document.category,
        body.purpose || document.purpose,
        body.description || document.description,
        body.status || document.status,
        body.fileUrl ?? document.fileUrl,
        body.version || document.version,
        body.access || document.access,
        now,
        access.session!.sub,
      ]],
    );

    const meta = requestMeta(context.request);
    await auditLog(context.env, [
      now,
      access.session!.sub,
      'DOCUMENT_UPDATE',
      document.id,
      JSON.stringify(document),
      JSON.stringify(body),
      meta.ip,
      meta.country,
    ]);

    return ok();
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : '저장 실패');
  }
};

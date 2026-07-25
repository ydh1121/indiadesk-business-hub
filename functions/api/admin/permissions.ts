import type { Env, PagesFunction } from '../../_shared/types';
import { auth } from '../../_shared/guard';
import { fail, ok, readJson } from '../../_shared/response';
import { getRange, updateRange } from '../../_shared/google';
import { findAccount, auditLog } from '../../_shared/data';
import { nowIso, requestMeta } from '../../_shared/request';
import {
  permissionCatalog,
  permissionId,
  userPermissionState,
} from '../../_shared/permissions';

const GROUP_ORDER = [
  '상위 메뉴',
  '사업계획서 버전',
  '사업계획서 세부 내용',
  '통합 아키텍처 단계',
  '문서 다운로드 항목',
];

async function targetAccount(env: Env, username: string) {
  if (!username) return { error: fail(400, '계정을 선택해야 합니다.') };
  const account = await findAccount(env, username);
  if (!account) return { error: fail(404, '계정을 찾을 수 없습니다.') };
  if (account.role === 'admin') {
    return { error: fail(400, 'Admin 계정에는 공개 범위 제한을 적용하지 않습니다.') };
  }
  return { account };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await auth(context, true);
  if (access.error) return access.error;

  const url = new URL(context.request.url);
  const username = (url.searchParams.get('username') || '').trim();
  const target = await targetAccount(context.env, username);
  if (target.error) return target.error;

  const [catalog, state] = await Promise.all([
    permissionCatalog(context.env),
    userPermissionState(context.env, username, 'guest'),
  ]);

  const allowed = catalog
    .filter((item) => state.can(item.type, item.key))
    .map((item) => item.id);

  const groups = GROUP_ORDER.map((label) => ({
    key: label,
    label,
    items: catalog.filter((item) => item.group === label),
  })).filter((group) => group.items.length > 0);

  return ok({
    username,
    displayName: target.account!.displayName,
    initialized: state.initialized,
    allowed,
    groups,
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const access = await auth(context, true, true);
  if (access.error) return access.error;

  try {
    const body = await readJson<{ username?: string; allowed?: unknown }>(context.request);
    const username = String(body.username || '').trim();
    const target = await targetAccount(context.env, username);
    if (target.error) return target.error;

    if (!Array.isArray(body.allowed)) {
      return fail(400, '허용 항목 목록이 올바르지 않습니다.');
    }

    const catalog = await permissionCatalog(context.env);
    const catalogMap = new Map(catalog.map((item) => [item.id, item]));
    const requested = new Set(
      body.allowed
        .map((value) => String(value))
        .filter((value) => catalogMap.has(value)),
    );

    const now = nowIso();
    const actor = access.session!.sub;
    const existing = await getRange(context.env, 'Permissions!A2:F20000');

    // 선택 계정의 과거 설정은 제거하고 현재 카탈로그 기준으로 한 번에 다시 기록한다.
    const preserved = existing
      .filter((row) => row[0] && row[0] !== username)
      .map((row) => [
        row[0] || '',
        row[1] || '',
        row[2] || '',
        row[3] || '',
        row[4] || '',
        row[5] || '',
      ]);

    const userRows = catalog.map((item) => [
      username,
      item.type,
      item.key,
      requested.has(item.id) ? 'TRUE' : 'FALSE',
      now,
      actor,
    ]);

    userRows.push([
      username,
      'system',
      'initialized',
      'TRUE',
      now,
      actor,
    ]);

    const merged = [...preserved, ...userRows];
    const writeRowCount = Math.max(existing.length, merged.length, 1);
    const values = [
      ...merged,
      ...Array.from({ length: writeRowCount - merged.length }, () => ['', '', '', '', '', '']),
    ];

    await updateRange(
      context.env,
      `Permissions!A2:F${writeRowCount + 1}`,
      values,
    );

    const meta = requestMeta(context.request);
    await auditLog(context.env, [
      now,
      actor,
      'PERMISSIONS_UPDATE',
      username,
      '',
      JSON.stringify({
        initialized: true,
        allowed: [...requested],
        deniedCount: catalog.length - requested.size,
      }),
      meta.ip,
      meta.country,
    ]);

    return ok({
      username,
      initialized: true,
      allowed: [...requested],
      total: catalog.length,
    });
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : '공개 범위를 저장하지 못했습니다.');
  }
};

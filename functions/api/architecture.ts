import type { Env, PagesFunction } from '../_shared/types';
import { auth } from '../_shared/guard';
import { fail, ok } from '../_shared/response';
import { architectureItems, userPermissionState } from '../_shared/permissions';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await auth(context);
  if (access.error) return access.error;

  const session = access.session!;
  const [permissions, source] = await Promise.all([
    userPermissionState(context.env, session.sub, session.role),
    architectureItems(context.env),
  ]);

  if (!permissions.can('menu', 'architecture')) {
    return fail(403, '통합 아키텍처 열람 권한이 없습니다.');
  }

  const items = source.filter((item) =>
    permissions.can('architecture', item.key),
  );

  return ok({ items });
};

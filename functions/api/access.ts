import type { Env, PagesFunction } from '../_shared/types';
import { auth } from '../_shared/guard';
import { ok } from '../_shared/response';
import { permissionCatalog, userPermissionState } from '../_shared/permissions';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await auth(context);
  if (access.error) return access.error;

  const session = access.session!;
  const [catalog, permissionState] = await Promise.all([
    permissionCatalog(context.env),
    userPermissionState(context.env, session.sub, session.role),
  ]);

  const allowed = catalog
    .filter((item) => permissionState.can(item.type, item.key))
    .map((item) => item.id);

  return ok({
    username: session.sub,
    role: session.role,
    initialized: permissionState.initialized,
    allowed,
  });
};

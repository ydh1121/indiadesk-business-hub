import type { Env } from './types';
import { verifySession, requireCsrf } from './session';
import { fail } from './response';
export async function auth(context:{request:Request;env:Env},admin=false,mutation=false){ const session=await verifySession(context.env,context.request); if(!session)return {error:fail(401,'로그인이 필요합니다.')}; if(admin&&session.role!=='admin')return {error:fail(403,'Admin 권한이 필요합니다.')}; if(mutation&&!requireCsrf(context.request,session))return {error:fail(403,'CSRF 검증에 실패했습니다.')}; return {session}; }

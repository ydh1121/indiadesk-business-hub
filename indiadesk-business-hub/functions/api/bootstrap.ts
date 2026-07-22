import type { PagesFunction } from '../_shared/types';
import type { Env } from '../_shared/types';
import { readJson, ok, fail } from '../_shared/response';
import { findAccount, saveAccount } from '../_shared/data';
import { hashPassword, constantEqual } from '../_shared/crypto';
export const onRequestPost: PagesFunction<Env> = async ({request,env})=>{ try{ const body=await readJson<{bootstrapSecret:string,password:string}>(request); if(!(await constantEqual(body.bootstrapSecret||'',env.BOOTSTRAP_SECRET||'')))return fail(403,'Bootstrap Secret이 올바르지 않습니다.'); if(!body.password||body.password.length<12)return fail(400,'Admin 비밀번호는 12자 이상이어야 합니다.'); const a=await findAccount(env,'admin'); if(!a)return fail(404,'admin 계정이 없습니다.'); if(a.status==='active'&&a.hash)return fail(409,'Admin 계정은 이미 설정되었습니다.'); const h=await hashPassword(body.password); a.salt=h.salt;a.hash=h.hash;a.iterations=h.iterations;a.status='active';a.devicePolicy='ALLOW';a.pcLimit=0;a.mobileLimit=0;await saveAccount(env,a);return ok(); }catch(e){return fail(400,e instanceof Error?e.message:'설정 실패');} };

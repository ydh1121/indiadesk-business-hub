import type { PagesFunction } from '../../_shared/types';
import type { Env } from '../../_shared/types';
import { auth } from '../../_shared/guard';
import { ok,fail,readJson } from '../../_shared/response';
import { accounts,findAccount,saveAccount,addAccount,auditLog } from '../../_shared/data';
import { hashPassword, PASSWORD_ITERATIONS } from '../../_shared/crypto';
import { appendRange } from '../../_shared/google';
import { requestMeta,nowIso } from '../../_shared/request';

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const ACCOUNT_STATUSES = ['active','pending','disabled'];
const DEVICE_POLICIES = ['BLOCK','REPLACE','ALLOW'];

const clampLimit = (value: unknown, fallback=1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(10, Math.trunc(number)));
};

export const onRequestGet: PagesFunction<Env>=async(c)=>{
  const a=await auth(c,true);
  if(a.error)return a.error;
  return ok({items:(await accounts(c.env)).map(x=>({username:x.username,role:x.role,displayName:x.displayName,status:x.status,devicePolicy:x.devicePolicy,pcLimit:x.pcLimit,mobileLimit:x.mobileLimit,updatedAt:x.updatedAt}))});
};

export const onRequestPost: PagesFunction<Env>=async(c)=>{
  const a=await auth(c,true,true);
  if(a.error)return a.error;
  try{
    const b=await readJson<any>(c.request);
    const username=String(b.username||'').trim().toLowerCase();
    const displayName=String(b.displayName||'').trim();
    const password=String(b.password||'');
    const status=ACCOUNT_STATUSES.includes(b.status)?b.status:'active';
    const devicePolicy=DEVICE_POLICIES.includes(b.devicePolicy)?b.devicePolicy:'BLOCK';
    const pcLimit=clampLimit(b.pcLimit,1);
    const mobileLimit=clampLimit(b.mobileLimit,1);

    if(!USERNAME_PATTERN.test(username))return fail(400,'계정명은 영문 소문자 또는 숫자로 시작하고, 영문 소문자·숫자·점·밑줄·하이픈만 사용해 3~32자로 입력해야 합니다.');
    if(!displayName)return fail(400,'표시명을 입력해야 합니다.');
    if(password.length<10)return fail(400,'초기 비밀번호는 10자 이상이어야 합니다.');
    if(await findAccount(c.env,username))return fail(409,'이미 사용 중인 계정명입니다.');

    const now=nowIso();
    const hashed=await hashPassword(password,undefined,PASSWORD_ITERATIONS);
    await addAccount(c.env,{
      username,
      role:'guest',
      displayName,
      salt:hashed.salt,
      hash:hashed.hash,
      iterations:hashed.iterations,
      status,
      devicePolicy,
      pcLimit,
      mobileLimit,
      createdAt:now,
      updatedAt:now,
    });

    // 신규 계정은 관리자가 공개 범위를 지정하기 전까지 모든 메뉴를 비공개로 둔다.
    await appendRange(c.env,'Permissions!A:F',[[username,'system','initialized','TRUE',now,a.session!.sub]]);

    const m=requestMeta(c.request);
    await auditLog(c.env,[now,a.session!.sub,'ACCOUNT_CREATE',username,'',JSON.stringify({displayName,status,devicePolicy,pcLimit,mobileLimit,role:'guest'}),m.ip,m.country]);
    return ok({item:{username,displayName,role:'guest',status,devicePolicy,pcLimit,mobileLimit}});
  }catch(e){
    return fail(400,e instanceof Error?e.message:'계정을 생성하지 못했습니다.');
  }
};

export const onRequestPut: PagesFunction<Env>=async(c)=>{
  const a=await auth(c,true,true);
  if(a.error)return a.error;
  try{
    const b=await readJson<any>(c.request);
    const username=String(b.username||'').trim().toLowerCase();
    const x=await findAccount(c.env,username);
    if(!x)return fail(404,'계정이 없습니다.');
    const before={displayName:x.displayName,status:x.status,devicePolicy:x.devicePolicy,pcLimit:x.pcLimit,mobileLimit:x.mobileLimit};
    if(typeof b.displayName==='string'&&b.displayName.trim())x.displayName=b.displayName.trim();
    if(ACCOUNT_STATUSES.includes(b.status))x.status=b.status;
    if(DEVICE_POLICIES.includes(b.devicePolicy))x.devicePolicy=b.devicePolicy;
    if(b.pcLimit!==undefined)x.pcLimit=clampLimit(b.pcLimit,x.pcLimit);
    if(b.mobileLimit!==undefined)x.mobileLimit=clampLimit(b.mobileLimit,x.mobileLimit);
    if(b.password){
      if(String(b.password).length<10)return fail(400,'비밀번호는 10자 이상이어야 합니다.');
      const h=await hashPassword(String(b.password),undefined,PASSWORD_ITERATIONS);
      x.salt=h.salt;
      x.hash=h.hash;
      x.iterations=h.iterations;
      x.status=ACCOUNT_STATUSES.includes(b.status)?b.status:'active';
    }
    if(x.role==='admin'){
      x.devicePolicy='ALLOW';
      x.pcLimit=0;
      x.mobileLimit=0;
    }
    await saveAccount(c.env,x);
    const m=requestMeta(c.request);
    await auditLog(c.env,[nowIso(),a.session!.sub,'ACCOUNT_UPDATE',x.username,JSON.stringify(before),JSON.stringify({displayName:x.displayName,status:x.status,devicePolicy:x.devicePolicy,pcLimit:x.pcLimit,mobileLimit:x.mobileLimit,passwordChanged:Boolean(b.password)}),m.ip,m.country]);
    return ok({item:{username:x.username,displayName:x.displayName,status:x.status,devicePolicy:x.devicePolicy,pcLimit:x.pcLimit,mobileLimit:x.mobileLimit}});
  }catch(e){
    return fail(400,e instanceof Error?e.message:'저장 실패');
  }
};

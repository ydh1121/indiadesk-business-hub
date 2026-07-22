import type { Env, SessionPayload } from './types';
import { encodeJson, decodeJson, hmac, constantEqual, randomToken } from './crypto';
const COOKIE='ibp_session';
const DEVICE_COOKIE='ibp_device';
export async function issueSession(env:Env,user:{username:string;role:'admin'|'guest';displayName:string}){ const ttl=Number(env.SESSION_TTL_SECONDS||43200); const payload:SessionPayload={sub:user.username,role:user.role,displayName:user.displayName,exp:Math.floor(Date.now()/1000)+ttl,csrf:randomToken(18)}; const body=encodeJson(payload); const sig=await hmac(body,env.SESSION_SECRET); return {token:`${body}.${sig}`,payload,ttl}; }
export async function verifySession(env:Env,request:Request){ const cookie=request.headers.get('cookie')||''; const value=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1); if(!value)return null; const [body,sig]=value.split('.'); if(!body||!sig)return null; const expected=await hmac(body,env.SESSION_SECRET); if(!(await constantEqual(sig,expected)))return null; const payload=decodeJson<SessionPayload>(body); if(payload.exp<Math.floor(Date.now()/1000))return null; return payload; }
export const sessionCookie=(token:string,ttl:number)=>`${COOKIE}=${token}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Strict`;
export const clearCookie=()=>`${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
export function requireCsrf(request:Request,session:SessionPayload){ return request.headers.get('x-csrf-token')===session.csrf; }


export async function issueDeviceCookie(env:Env,deviceId:string){
  const sig=await hmac(deviceId,env.SESSION_SECRET);
  return `${DEVICE_COOKIE}=${deviceId}.${sig}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`;
}
export async function readDeviceCookie(env:Env,request:Request){
  const cookie=request.headers.get('cookie')||'';
  const value=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${DEVICE_COOKIE}=`))?.slice(DEVICE_COOKIE.length+1);
  if(!value)return null;
  const split=value.lastIndexOf('.');
  if(split<1)return null;
  const id=value.slice(0,split),sig=value.slice(split+1);
  if(!/^[A-Za-z0-9_-]{20,120}$/.test(id))return null;
  const expected=await hmac(id,env.SESSION_SECRET);
  return await constantEqual(sig,expected)?id:null;
}

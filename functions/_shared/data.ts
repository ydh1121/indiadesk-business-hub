import type { Env } from './types';
import { getRange, updateRange, appendRange } from './google';
import { nowIso } from './request';

export const ACCOUNT_HEADERS=['username','role','display_name','password_salt','password_hash','password_iterations','status','device_policy','pc_limit','mobile_limit','created_at','updated_at'];
export type Account={row:number;username:string;role:'admin'|'guest';displayName:string;salt:string;hash:string;iterations:number;status:string;devicePolicy:string;pcLimit:number;mobileLimit:number;createdAt:string;updatedAt:string};
export async function accounts(env:Env){ const rows=await getRange(env,'Accounts!A2:L1000'); return rows.filter(r=>r[0]).map((r,i):Account=>({row:i+2,username:r[0],role:r[1]==='admin'?'admin':'guest',displayName:r[2]||r[0],salt:r[3]||'',hash:r[4]||'',iterations:Number(r[5]||100000),status:r[6]||'pending',devicePolicy:r[7]||'BLOCK',pcLimit:Number(r[8]||1),mobileLimit:Number(r[9]||1),createdAt:r[10]||'',updatedAt:r[11]||''})); }
export async function findAccount(env:Env,username:string){ return (await accounts(env)).find(a=>a.username===username); }
export async function saveAccount(env:Env,a:Account){ await updateRange(env,`Accounts!A${a.row}:L${a.row}`,[[a.username,a.role,a.displayName,a.salt,a.hash,a.iterations,a.status,a.devicePolicy,a.pcLimit,a.mobileLimit,a.createdAt||nowIso(),nowIso()]]); }

export type Device={row:number;deviceId:string;username:string;category:string;fingerprintHash:string;userAgent:string;os:string;browser:string;firstIp:string;lastIp:string;country:string;city:string;firstSeen:string;lastSeen:string;active:boolean;lastLogin:string};
export async function devices(env:Env){ const rows=await getRange(env,'Devices!A2:O5000'); return rows.filter(r=>r[0]).map((r,i):Device=>({row:i+2,deviceId:r[0],username:r[1],category:r[2],fingerprintHash:r[3],userAgent:r[4],os:r[5],browser:r[6],firstIp:r[7],lastIp:r[8],country:r[9],city:r[10],firstSeen:r[11],lastSeen:r[12],active:String(r[13]).toUpperCase()==='TRUE',lastLogin:r[14]})); }
export async function saveDevice(env:Env,d:Device){ await updateRange(env,`Devices!A${d.row}:O${d.row}`,[[d.deviceId,d.username,d.category,d.fingerprintHash,d.userAgent,d.os,d.browser,d.firstIp,d.lastIp,d.country,d.city,d.firstSeen,d.lastSeen,d.active,d.lastLogin]]); }
export async function addDevice(env:Env,d:Omit<Device,'row'>){ await appendRange(env,'Devices!A:O',[[d.deviceId,d.username,d.category,d.fingerprintHash,d.userAgent,d.os,d.browser,d.firstIp,d.lastIp,d.country,d.city,d.firstSeen,d.lastSeen,d.active,d.lastLogin]]); }
export async function accessLog(env:Env,row:unknown[]){ await appendRange(env,'AccessLogs!A:N',[row]); }
export async function auditLog(env:Env,row:unknown[]){ await appendRange(env,'AuditLogs!A:H',[row]); }

import type { CfRequest } from './types';
export function requestMeta(request:Request){ const r=request as CfRequest; return { ip:request.headers.get('cf-connecting-ip')||'unknown', country:r.cf?.country||request.headers.get('cf-ipcountry')||'unknown', city:r.cf?.city||'', colo:r.cf?.colo||'', userAgent:(request.headers.get('user-agent')||'').slice(0,500) }; }
export const nowIso=()=>new Date().toISOString();

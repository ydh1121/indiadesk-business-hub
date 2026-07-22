import type { Env } from './types';
import { encodeJson, signRs256 } from './crypto';
let cached: { token: string; exp: number } | null = null;
async function accessToken(env:Env){
  const now=Math.floor(Date.now()/1000); if(cached && cached.exp>now+60) return cached.token;
  const header=encodeJson({alg:'RS256',typ:'JWT'}); const claims=encodeJson({iss:env.GOOGLE_SERVICE_ACCOUNT_EMAIL,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const signature=await signRs256(`${header}.${claims}`,env.GOOGLE_PRIVATE_KEY); const assertion=`${header}.${claims}.${signature}`;
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  if(!res.ok) throw new Error(`Google 인증 실패: ${res.status}`); const data=await res.json() as {access_token:string;expires_in:number}; cached={token:data.access_token,exp:now+data.expires_in}; return data.access_token;
}
async function sheetsFetch(env:Env,path:string,init:RequestInit={}){ const token=await accessToken(env); const headers=new Headers(init.headers); headers.set('authorization',`Bearer ${token}`); if(init.body) headers.set('content-type','application/json'); const res=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}${path}`,{...init,headers}); if(!res.ok){const text=await res.text(); throw new Error(`Google Sheets 오류 ${res.status}: ${text.slice(0,240)}`);} return await res.json() as any; }
const rangePath=(range:string)=>`/values/${encodeURIComponent(range)}`;
export async function getRange(env:Env,range:string){ const data=await sheetsFetch(env,`${rangePath(range)}?majorDimension=ROWS`); return (data.values||[]) as string[][]; }
export async function updateRange(env:Env,range:string,values:unknown[][]){ return sheetsFetch(env,`${rangePath(range)}?valueInputOption=RAW`,{method:'PUT',body:JSON.stringify({majorDimension:'ROWS',values})}); }
export async function appendRange(env:Env,range:string,values:unknown[][]){ return sheetsFetch(env,`${rangePath(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,{method:'POST',body:JSON.stringify({majorDimension:'ROWS',values})}); }

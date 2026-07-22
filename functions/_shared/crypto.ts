const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export const fromB64url = (value: string) => {
  const base = value.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(value.length/4)*4,'=');
  return Uint8Array.from(atob(base), c => c.charCodeAt(0));
};
export const randomToken = (length=24) => { const bytes=new Uint8Array(length); crypto.getRandomValues(bytes); return b64url(bytes); };
export async function sha256(value: string) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
export async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
export async function constantEqual(a:string,b:string){ const aa=encoder.encode(a),bb=encoder.encode(b); if(aa.length!==bb.length)return false; let diff=0; for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i]; return diff===0; }
export async function hashPassword(password:string, salt?:string, iterations=120000) {
  const saltBytes = salt ? fromB64url(salt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:saltBytes,iterations}, key, 256);
  return { salt: b64url(saltBytes), hash: b64url(new Uint8Array(bits)), iterations };
}
export async function verifyPassword(password:string,salt:string,hash:string,iterations:number){ const result=await hashPassword(password,salt,iterations); return constantEqual(result.hash,hash); }
export function pemToArrayBuffer(pem:string){ const clean=pem.replaceAll('\\n','\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,''); return Uint8Array.from(atob(clean),c=>c.charCodeAt(0)).buffer; }
export async function signRs256(input:string,pem:string){ const key=await crypto.subtle.importKey('pkcs8',pemToArrayBuffer(pem),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']); return b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(input)))); }
export const encodeJson = (value:unknown)=>b64url(encoder.encode(JSON.stringify(value)));
export const decodeJson = <T>(value:string):T=>JSON.parse(decoder.decode(fromB64url(value)));

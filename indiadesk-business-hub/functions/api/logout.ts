import type { PagesFunction } from '../_shared/types'; import type { Env } from '../_shared/types'; import { ok } from '../_shared/response'; import { clearCookie } from '../_shared/session';
export const onRequestPost: PagesFunction<Env>=async()=>{const r=ok();r.headers.append('set-cookie',clearCookie());return r;};

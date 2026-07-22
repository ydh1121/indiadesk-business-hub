export interface AssetFetcher { fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>; }

export interface Env {
  GOOGLE_SHEET_ID: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  SESSION_SECRET: string;
  BOOTSTRAP_SECRET: string;
  SESSION_TTL_SECONDS?: string;
  ASSETS?: AssetFetcher;
}

export interface FunctionContext<EnvType = unknown> {
  request: Request;
  env: EnvType;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
  waitUntil(promise: Promise<unknown>): void;
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
}

export type PagesFunction<EnvType = unknown> = (context: FunctionContext<EnvType>) => Response | Promise<Response>;
export interface SessionPayload { sub: string; role: 'admin'|'guest'; displayName: string; exp: number; csrf: string; }
export interface CfRequest extends Request { cf?: { country?: string; city?: string; colo?: string; region?: string; timezone?: string } }

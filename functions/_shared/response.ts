export const json = (data: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, private');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(data), { ...init, headers });
};
export const ok = (data: Record<string, unknown> = {}) => json({ ok: true, ...data });
export const fail = (status: number, error: string) => json({ ok: false, error }, { status });
export async function readJson<T>(request: Request): Promise<T> {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('JSON 요청만 허용됩니다.');
  return await request.json() as T;
}

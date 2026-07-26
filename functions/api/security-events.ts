import type { PagesFunction, Env } from '../_shared/types';
import { auth } from '../_shared/guard';
import { appendRange } from '../_shared/google';
import { requestMeta, nowIso } from '../_shared/request';
import { readDeviceCookie } from '../_shared/session';
import { ok, fail } from '../_shared/response';

const ALLOWED_EVENTS = new Set([
  'CAPTURE_PRINTSCREEN',
  'CAPTURE_PRINT',
  'CONTENT_COPY_BLOCKED',
  'CONTENT_SAVE_BLOCKED',
]);

function clean(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await auth(context);
  if (authResult.error) return authResult.error;

  let body: Record<string, unknown>;
  try {
    body = await context.request.json() as Record<string, unknown>;
  } catch {
    return fail(400, '보안 이벤트 형식이 올바르지 않습니다.');
  }

  const eventType = clean(body.eventType, 50);
  if (!ALLOWED_EVENTS.has(eventType)) {
    return fail(400, '허용되지 않은 보안 이벤트입니다.');
  }

  const meta = requestMeta(context.request);
  const deviceId = await readDeviceCookie(context.env, context.request) || '';
  const category = clean(body.category, 30);
  const os = clean(body.os, 60);
  const browser = clean(body.browser, 60);

  const contextSummary = [
    clean(body.reason, 300),
    clean(body.view, 80) ? `view=${clean(body.view, 80)}` : '',
    clean(body.architectureKey, 120) ? `node=${clean(body.architectureKey, 120)}` : '',
    clean(body.path, 300) ? `path=${clean(body.path, 300)}` : '',
    clean(body.screen, 40) ? `screen=${clean(body.screen, 40)}` : '',
    '실제 캡처 파일 생성 여부는 브라우저에서 확인할 수 없음',
  ].filter(Boolean).join(' · ');

  await appendRange(context.env, 'AccessLogs!A:N', [[
    nowIso(),
    authResult.session.sub,
    eventType,
    true,
    contextSummary,
    meta.ip,
    meta.country,
    meta.city,
    meta.colo,
    deviceId,
    category,
    os,
    browser,
    meta.userAgent,
  ]]);

  return ok({ logged: true });
};

import type { Env, PagesFunction } from '../_shared/types';
import { auth } from '../_shared/guard';
import { fail } from '../_shared/response';

const safePath = (value: string) => /^[A-Za-z0-9._-]+$/.test(value) && !value.startsWith('.');

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await auth(context);
  if (access.error) return access.error;

  const raw = context.params.path;
  const filename = Array.isArray(raw) ? raw.join('/') : String(raw || '');
  if (!safePath(filename)) return fail(400, '잘못된 파일 경로입니다.');
  if (!context.env.ASSETS) return fail(500, '정적 파일 바인딩이 설정되지 않았습니다.');

  const assetUrl = new URL(`/downloads/${filename}`, context.request.url);
  const asset = await context.env.ASSETS.fetch(new Request(assetUrl, context.request));
  if (!asset.ok) return fail(asset.status === 404 ? 404 : 502, '파일을 불러올 수 없습니다.');

  const headers = new Headers(asset.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(asset.body, { status: asset.status, headers });
};

export const onRequestHead: PagesFunction<Env> = onRequestGet;

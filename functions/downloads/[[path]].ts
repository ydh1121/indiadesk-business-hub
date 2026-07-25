import type { Env, PagesFunction } from '../_shared/types';
import { auth } from '../_shared/guard';
import { fail } from '../_shared/response';
import { getRange } from '../_shared/google';
import { userPermissionState } from '../_shared/permissions';

const safePath = (value: string) =>
  /^[A-Za-z0-9._-]+$/.test(value) && !value.startsWith('.');

function filenameFromDocumentUrl(fileUrl: string, requestUrl: string) {
  if (!fileUrl) return '';
  try {
    const pathname = new URL(fileUrl, requestUrl).pathname;
    if (!pathname.startsWith('/downloads/')) return '';
    return decodeURIComponent(pathname.slice('/downloads/'.length));
  } catch {
    return '';
  }
}

async function findDocument(env: Env, filename: string, requestUrl: string) {
  const rows = await getRange(env, 'Documents!A2:K2000');
  const row = rows.find(
    (item) =>
      item[0] &&
      filenameFromDocumentUrl(item[6] || '', requestUrl) === filename,
  );

  if (!row) return null;
  return {
    id: row[0],
    access: row[8] || 'all',
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await auth(context);
  if (access.error) return access.error;

  const raw = context.params.path;
  const filename = Array.isArray(raw) ? raw.join('/') : String(raw || '');
  if (!safePath(filename)) return fail(400, '잘못된 파일 경로입니다.');

  const session = access.session!;
  if (session.role !== 'admin') {
    const document = await findDocument(context.env, filename, context.request.url);
    if (!document || document.access !== 'all') {
      return fail(403, '이 문서를 다운로드할 권한이 없습니다.');
    }

    const permissions = await userPermissionState(
      context.env,
      session.sub,
      session.role,
    );

    if (
      !permissions.can('menu', 'documents') ||
      !permissions.can('document', document.id)
    ) {
      return fail(403, '이 문서를 다운로드할 권한이 없습니다.');
    }
  }

  if (!context.env.ASSETS) {
    return fail(500, '정적 파일 바인딩이 설정되지 않았습니다.');
  }

  const assetUrl = new URL(`/downloads/${filename}`, context.request.url);
  const asset = await context.env.ASSETS.fetch(new Request(assetUrl, context.request));
  if (!asset.ok) {
    return fail(asset.status === 404 ? 404 : 502, '파일을 불러올 수 없습니다.');
  }

  const headers = new Headers(asset.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(asset.body, { status: asset.status, headers });
};

export const onRequestHead: PagesFunction<Env> = onRequestGet;

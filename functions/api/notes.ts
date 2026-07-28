import type { PagesFunction, Env } from '../_shared/types';
import { auth } from '../_shared/guard';
import { ok, fail, readJson } from '../_shared/response';
import { getRange, appendRange, updateRange } from '../_shared/google';
import { auditLog } from '../_shared/data';
import { requestMeta, nowIso } from '../_shared/request';
import { userPermissionState } from '../_shared/permissions';

type SectionNote = {
  row: number;
  noteId: string;
  username: string;
  pageKey: string;
  sectionKey: string;
  sectionTitle: string;
  noteText: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  adminComment: string;
  reviewedAt: string;
  reviewedBy: string;
};

async function noteRows(env: Env): Promise<SectionNote[]> {
  const rows = await getRange(env, 'SectionNotes!A2:L5000');
  return rows
    .map((row, index) => ({
      row: index + 2,
      noteId: row[0],
      username: row[1],
      pageKey: row[2],
      sectionKey: row[3],
      sectionTitle: row[4] || row[3],
      noteText: row[5] || '',
      status: row[6] || 'open',
      createdAt: row[7] || '',
      updatedAt: row[8] || '',
      adminComment: row[9] || '',
      reviewedAt: row[10] || '',
      reviewedBy: row[11] || '',
    }))
    .filter((note) => note.noteId && note.username && note.pageKey && note.sectionKey);
}

async function contentSection(env: Env, pageKey: string, sectionKey: string) {
  const rows = await getRange(env, 'Content!A2:D3000');
  const found = rows.find(
    (row) => row[0] === pageKey && row[1] === sectionKey,
  );
  if (!found) return null;
  return {
    pageKey: found[0],
    sectionKey: found[1],
    sortOrder: Number(found[2] || 0),
    title: found[3] || found[1],
  };
}

function publicNote(note: SectionNote) {
  return {
    noteId: note.noteId,
    username: note.username,
    pageKey: note.pageKey,
    sectionKey: note.sectionKey,
    sectionTitle: note.sectionTitle,
    noteText: note.noteText,
    status: note.status,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await auth(context);
  if (access.error) return access.error;

  const username = access.session!.sub;
  const items = (await noteRows(context.env))
    .filter((note) => note.username === username)
    .sort((a, b) => a.pageKey.localeCompare(b.pageKey) || a.sectionKey.localeCompare(b.sectionKey))
    .map(publicNote);

  return ok({ items });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const access = await auth(context, false, true);
  if (access.error) return access.error;

  try {
    const body = await readJson<{
      pageKey?: string;
      sectionKey?: string;
      noteText?: string;
    }>(context.request);

    const pageKey = String(body.pageKey || '').trim();
    const sectionKey = String(body.sectionKey || '').trim();
    const noteText = String(body.noteText || '').trim();

    if (!pageKey || !sectionKey) {
      return fail(400, '메모 대상 파트가 없습니다.');
    }
    if (!noteText) {
      return fail(400, '메모 내용을 입력하세요.');
    }
    if (noteText.length > 5000) {
      return fail(400, '메모는 5,000자 이내로 작성하세요.');
    }

    const section = await contentSection(context.env, pageKey, sectionKey);
    if (!section) {
      return fail(404, '사업계획서 파트를 찾을 수 없습니다.');
    }

    const session = access.session!;
    const permissions = await userPermissionState(
      context.env,
      session.sub,
      session.role,
    );

    if (
      !permissions.can('menu', 'plans') ||
      !permissions.can('plan', pageKey) ||
      !permissions.can('content', `${pageKey}/${sectionKey}`)
    ) {
      return fail(403, '이 파트에 메모를 작성할 권한이 없습니다.');
    }

    const existing = (await noteRows(context.env)).find(
      (note) =>
        note.username === session.sub &&
        note.pageKey === pageKey &&
        note.sectionKey === sectionKey,
    );

    const now = nowIso();
    const item: SectionNote = existing
      ? {
          ...existing,
          sectionTitle: section.title,
          noteText,
          status: existing.status === 'reviewed' ? 'open' : existing.status,
          updatedAt: now,
          reviewedAt: '',
          reviewedBy: '',
        }
      : {
          row: 0,
          noteId: crypto.randomUUID(),
          username: session.sub,
          pageKey,
          sectionKey,
          sectionTitle: section.title,
          noteText,
          status: 'open',
          createdAt: now,
          updatedAt: now,
          adminComment: '',
          reviewedAt: '',
          reviewedBy: '',
        };

    const values = [[
      item.noteId,
      item.username,
      item.pageKey,
      item.sectionKey,
      item.sectionTitle,
      item.noteText,
      item.status,
      item.createdAt,
      item.updatedAt,
      item.adminComment,
      item.reviewedAt,
      item.reviewedBy,
    ]];

    if (existing) {
      await updateRange(
        context.env,
        `SectionNotes!A${existing.row}:L${existing.row}`,
        values,
      );
    } else {
      await appendRange(context.env, 'SectionNotes!A:L', values);
    }

    const meta = requestMeta(context.request);
    await auditLog(context.env, [
      now,
      session.sub,
      'SECTION_NOTE_UPDATE',
      `${pageKey}/${sectionKey}`,
      existing ? existing.noteText : '',
      noteText,
      meta.ip,
      meta.country,
    ]);

    return ok({ item: publicNote(item) });
  } catch (error) {
    return fail(
      400,
      error instanceof Error ? error.message : '메모 저장에 실패했습니다.',
    );
  }
};

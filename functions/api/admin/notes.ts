import type { PagesFunction, Env } from '../../_shared/types';
import { auth } from '../../_shared/guard';
import { ok } from '../../_shared/response';
import { getRange } from '../../_shared/google';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await auth(context, true);
  if (access.error) return access.error;

  const rows = await getRange(context.env, 'SectionNotes!A2:L5000');
  const items = rows
    .filter((row) => row[0] && row[1] && row[2] && row[3])
    .map((row) => ({
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
    }));

  return ok({ items });
};

import type { PagesFunction } from '../_shared/types';
import type { Env } from '../_shared/types';
import { auth } from '../_shared/guard';
import { getRange } from '../_shared/google';
import { ok } from '../_shared/response';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await auth(context);
  if (session.error) return session.error;

  const rows = await getRange(context.env, 'Settings!A2:E1000');
  const items = rows
    .filter((row) => row[0])
    .map((row) => ({
      key: row[0],
      value: row[1] || '',
      description: row[2] || '',
      updatedAt: row[3] || '',
      updatedBy: row[4] || '',
    }));

  const settings = Object.fromEntries(items.map((item) => [item.key, item.value]));
  return ok({ items, settings });
};

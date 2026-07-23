import type { PagesFunction } from '../../_shared/types';
import type { Env } from '../../_shared/types';
import { auth } from '../../_shared/guard';
import { ok } from '../../_shared/response';
import { getRange, appendRange } from '../../_shared/google';
import { DEFAULT_CONTENT } from '../../_shared/content-default';
import { nowIso } from '../../_shared/request';

export const onRequestPost: PagesFunction<Env> = async (c) => {
  const a = await auth(c, true, true);
  if (a.error) return a.error;

  const rows = await getRange(c.env, 'Content!A2:H3000');
  const existingRows = rows.filter((row) => row[0]);

  // 운영 중인 본문이 있으면 과거의 축약형 기본 데이터를 추가하지 않는다.
  if (existingRows.length > 0) {
    return ok({ inserted: 0, preserved: existingRows.length });
  }

  const missing = DEFAULT_CONTENT;
  if (missing.length) {
    await appendRange(
      c.env,
      'Content!A:H',
      missing.map((x) => [
        x.pageKey,
        x.sectionKey,
        x.sortOrder,
        x.title,
        x.bodyMarkdown,
        '',
        nowIso(),
        a.session!.sub,
      ]),
    );
  }

  return ok({ inserted: missing.length });
};

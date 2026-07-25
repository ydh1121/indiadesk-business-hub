export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeMarkdownEscapes(value = '') {
  return String(value).replace(/\\([\\`*_[\]{}()#+\-.!~>])/g, '$1');
}

function inline(text) {
  let value = escapeHtml(normalizeMarkdownEscapes(text));
  value = value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/`(.+?)`/g, '<code>$1</code>');
  return value;
}

function mergeWrappedTableRows(sourceLines = []) {
  const mergedLines = [];

  for (let index = 0; index < sourceLines.length; index += 1) {
    const raw = sourceLines[index];
    const trimmed = raw.trim();

    if (!trimmed.startsWith('|') || trimmed.endsWith('|')) {
      mergedLines.push(raw);
      continue;
    }

    let merged = trimmed;
    let cursor = index + 1;

    while (cursor < sourceLines.length && !merged.trimEnd().endsWith('|')) {
      const continuation = sourceLines[cursor].trim();

      if (!continuation) break;

      merged += ` ${continuation}`;
      cursor += 1;
    }

    mergedLines.push(merged);
    index = cursor - 1;
  }

  return mergedLines;
}

function isTableRow(line = '') {
  const value = normalizeMarkdownEscapes(String(line).trim());
  return value.startsWith('|') && value.endsWith('|');
}

function splitTableCells(line = '') {
  return normalizeMarkdownEscapes(String(line).trim())
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isDividerRow(line = '') {
  if (!isTableRow(line)) return false;
  const cells = splitTableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderTableBlock(blockLines = []) {
  const compact = blockLines.filter((line) => line.trim());
  if (!compact.length) return '';

  const header = splitTableCells(compact[0]);
  let bodyLines = compact.slice(1);

  if (bodyLines.length && isDividerRow(bodyLines[0])) {
    bodyLines = bodyLines.slice(1);
  }

  const thead = `<thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>`;
  const tbodyRows = bodyLines.map((line) => {
    const cells = splitTableCells(line);

    while (cells.length < header.length) cells.push('');
    if (cells.length > header.length) {
      cells.splice(header.length - 1, cells.length - header.length + 1, cells.slice(header.length - 1).join(' | '));
    }

    return `<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`;
  }).join('');

  return `<div class="md-table-wrap"><table class="md-table">${thead}<tbody>${tbodyRows}</tbody></table></div>`;
}

export function renderMarkdownSafe(markdown = '') {
  const sourceLines = String(markdown).replaceAll('\r\n', '\n').split('\n');
  const lines = mergeWrappedTableRows(sourceLines);
  const html = [];
  let list = null;

  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = normalizeMarkdownEscapes(raw.trim());

    if (!line) {
      const nextLine = normalizeMarkdownEscapes(
        lines
          .slice(index + 1)
          .find((item) => item.trim())
          ?.trim() || ''
      );

      const continuesOrderedList =
        list === 'ol' && /^\d+\.\s+/.test(nextLine);

      const continuesUnorderedList =
        list === 'ul' && /^-\s+/.test(nextLine);

      if (!continuesOrderedList && !continuesUnorderedList) {
        closeList();

        // 연속 빈 줄은 하나의 시각적 간격으로 축약한다.
        if (html.at(-1) !== '<div class="md-spacer" aria-hidden="true">&nbsp;</div>') {
          html.push('<div class="md-spacer" aria-hidden="true">&nbsp;</div>');
        }
      }

      continue;
    }

    // Google Docs 내보내기에서 생성되는 내용 없는 제목 행은 표시하지 않는다.
    if (/^#{1,6}$/.test(line)) {
      closeList();
      continue;
    }

    if (isTableRow(line)) {
      closeList();

      const block = [line];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = normalizeMarkdownEscapes(lines[cursor].trim());

        if (isTableRow(nextLine)) {
          block.push(nextLine);
          cursor += 1;
          continue;
        }

        if (!nextLine) {
          let probe = cursor;

          while (probe < lines.length && !lines[probe].trim()) {
            probe += 1;
          }

          const probedLine = normalizeMarkdownEscapes(lines[probe]?.trim() || '');

          if (probe < lines.length && isTableRow(probedLine)) {
            block.push(probedLine);
            cursor = probe + 1;
            continue;
          }
        }

        break;
      }

      html.push(renderTableBlock(block));
      index = cursor - 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = Math.min(6, headingMatch[1].length + 1);
      html.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^-\s+/.test(line)) {
      if (list !== 'ul') {
        closeList();
        list = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${inline(line.replace(/^-\s+/, ''))}</li>`);
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const itemNumber = Number(orderedMatch[1]);
      const itemText = orderedMatch[2];

      if (list !== 'ol') {
        closeList();
        list = 'ol';
        html.push(`<ol start="${itemNumber}">`);
      }

      html.push(`<li value="${itemNumber}">${inline(itemText)}</li>`);
      continue;
    }

    if (line.startsWith('> ')) {
      closeList();
      html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return html.join('');
}

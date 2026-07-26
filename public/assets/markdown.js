export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeGoogleDocsEscapes(value = '') {
  return String(value)
    .replace(/\\([\\`*_[\]{}()#+.!~>|-])/g, '$1')
    .replace(/\u00a0/g, ' ');
}

function inline(text) {
  let value = escapeHtml(normalizeGoogleDocsEscapes(text));
  value = value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/`(.+?)`/g, '<code>$1</code>');
  return value;
}

function isTableRowStart(line = '') {
  return normalizeGoogleDocsEscapes(String(line)).trim().startsWith('|');
}

function isCompleteTableRow(line = '') {
  const value = normalizeGoogleDocsEscapes(String(line)).trim();
  return value.startsWith('|') && value.endsWith('|');
}

function splitTableCells(line = '') {
  return normalizeGoogleDocsEscapes(String(line))
    .trim()
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isDividerRow(line = '') {
  if (!isCompleteTableRow(line)) return false;
  const cells = splitTableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function normalizeTableCellCount(cells, columnCount) {
  if (cells.length === columnCount) return cells;
  if (cells.length < columnCount) {
    return [...cells, ...Array(columnCount - cells.length).fill('')];
  }
  return [
    ...cells.slice(0, Math.max(0, columnCount - 1)),
    cells.slice(Math.max(0, columnCount - 1)).join(' | '),
  ];
}

function readLogicalTableRow(lines, startIndex) {
  const first = normalizeGoogleDocsEscapes(lines[startIndex] || '').trim();
  if (!first.startsWith('|')) return null;

  let row = first;
  let cursor = startIndex + 1;

  while (!row.endsWith('|') && cursor < lines.length) {
    const part = normalizeGoogleDocsEscapes(lines[cursor] || '').trim();
    if (part) row += ` ${part}`;
    cursor += 1;
  }

  if (!row.endsWith('|')) return null;
  return { row, cursor };
}

function collectTableBlock(lines, startIndex) {
  const rows = [];
  let cursor = startIndex;

  while (cursor < lines.length) {
    const current = normalizeGoogleDocsEscapes(lines[cursor] || '').trim();

    if (!current) {
      let probe = cursor + 1;
      while (probe < lines.length && !normalizeGoogleDocsEscapes(lines[probe] || '').trim()) {
        probe += 1;
      }

      if (probe < lines.length && isTableRowStart(lines[probe])) {
        cursor = probe;
        continue;
      }
      break;
    }

    if (!isTableRowStart(current)) break;

    const logical = readLogicalTableRow(lines, cursor);
    if (!logical) break;

    rows.push(logical.row);
    cursor = logical.cursor;
  }

  return { rows, cursor };
}

function renderTableBlock(blockLines = []) {
  const compact = blockLines.filter((line) => isCompleteTableRow(line));
  if (!compact.length) return '';

  const header = splitTableCells(compact[0]);
  const columnCount = Math.max(1, header.length);
  let bodyLines = compact.slice(1);

  if (bodyLines.length && isDividerRow(bodyLines[0])) {
    bodyLines = bodyLines.slice(1);
  }

  const thead = `<thead><tr>${normalizeTableCellCount(header, columnCount)
    .map((cell) => `<th>${inline(cell)}</th>`)
    .join('')}</tr></thead>`;

  const tbodyRows = bodyLines
    .filter((line) => !isDividerRow(line))
    .map((line) => {
      const cells = normalizeTableCellCount(splitTableCells(line), columnCount);
      return `<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`;
    })
    .join('');

  return `<div class="md-table-wrap"><table class="md-table">${thead}<tbody>${tbodyRows}</tbody></table></div>`;
}

function orderedItem(line = '') {
  const match = normalizeGoogleDocsEscapes(line).match(/^(\d+)\.\s+(.+)$/);
  if (!match) return null;
  return { number: Number(match[1]), text: match[2] };
}

function nextNonEmptyLine(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = normalizeGoogleDocsEscapes(lines[index] || '').trim();
    if (line) return line;
  }
  return '';
}

export function renderMarkdownSafe(markdown = '') {
  const lines = String(markdown).replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const html = [];
  let list = null;

  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeGoogleDocsEscapes(lines[index] || '').trim();

    if (!line) {
      const nextLine = nextNonEmptyLine(lines, index + 1);
      const continuesOrderedList = list === 'ol' && Boolean(orderedItem(nextLine));
      const continuesUnorderedList = list === 'ul' && /^-\s+/.test(nextLine);

      if (!continuesOrderedList && !continuesUnorderedList) {
        closeList();
        html.push('<div class="md-spacer" aria-hidden="true">&nbsp;</div>');
      }
      continue;
    }

    if (isTableRowStart(line)) {
      closeList();
      const block = collectTableBlock(lines, index);
      if (block.rows.length) {
        html.push(renderTableBlock(block.rows));
        index = block.cursor - 1;
        continue;
      }
    }

    if (/^#{1,6}\s*$/.test(line)) continue;

    if (line.startsWith('### ')) {
      closeList();
      html.push(`<h4>${inline(line.slice(4))}</h4>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeList();
      html.push(`<h3>${inline(line.slice(3))}</h3>`);
      continue;
    }
    if (line.startsWith('# ')) {
      closeList();
      html.push(`<h2>${inline(line.slice(2))}</h2>`);
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

    const ordered = orderedItem(line);
    if (ordered) {
      if (list !== 'ol') {
        closeList();
        list = 'ol';
        html.push(`<ol start="${ordered.number}">`);
      }
      html.push(`<li value="${ordered.number}">${inline(ordered.text)}</li>`);
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

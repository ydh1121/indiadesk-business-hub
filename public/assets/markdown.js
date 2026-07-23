export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inline(text) {
  let value = escapeHtml(text);
  value = value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/`(.+?)`/g, '<code>$1</code>');
  return value;
}

function isTableRow(line = '') {
  const v = String(line).trim();
  return v.startsWith('|') && v.endsWith('|');
}

function splitTableCells(line = '') {
  return String(line)
    .trim()
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
    return `<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`;
  }).join('');

  return `<div class="md-table-wrap"><table class="md-table">${thead}<tbody>${tbodyRows}</tbody></table></div>`;
}

export function renderMarkdownSafe(markdown = '') {
  const lines = String(markdown).replaceAll('\r\n', '\n').split('\n');
  const html = [];
  let list = null;

  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();

    if (!line) {
      closeList();
      continue;
    }

    if (isTableRow(line)) {
      closeList();

      const block = [line];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextRaw = lines[cursor];
        const nextLine = nextRaw.trim();

        if (!nextLine) {
          cursor += 1;
          continue;
        }

        if (!isTableRow(nextLine)) break;

        block.push(nextLine);
        cursor += 1;
      }

      html.push(renderTableBlock(block));
      index = cursor - 1;
      continue;
    }

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
    if (/^- /.test(line)) {
      if (list !== 'ul') {
        closeList();
        list = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      if (list !== 'ol') {
        closeList();
        list = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${inline(line.replace(/^\d+\. /, ''))}</li>`);
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

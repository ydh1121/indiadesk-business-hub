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

export function renderMarkdownSafe(markdown = '') {
  const lines = String(markdown).replaceAll('\r\n', '\n').split('\n');
  const html = [];
  let list = null;
  let table = null;

  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };
  const closeTable = () => {
    if (table) html.push('</tbody></table></div>');
    table = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) {
      closeList(); closeTable();
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      closeList();
      const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
      const next = lines[index + 1]?.trim() || '';
      if (!table) {
        html.push('<div class="md-table-wrap"><table class="md-table"><thead><tr>');
        html.push(cells.map((cell) => `<th>${inline(cell)}</th>`).join(''));
        html.push('</tr></thead><tbody>');
        table = true;
        if (/^\|?\s*:?-{3,}/.test(next)) index += 1;
      } else {
        html.push(`<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`);
      }
      continue;
    }
    closeTable();

    if (line.startsWith('### ')) {
      closeList(); html.push(`<h4>${inline(line.slice(4))}</h4>`); continue;
    }
    if (line.startsWith('## ')) {
      closeList(); html.push(`<h3>${inline(line.slice(3))}</h3>`); continue;
    }
    if (line.startsWith('# ')) {
      closeList(); html.push(`<h2>${inline(line.slice(2))}</h2>`); continue;
    }
    if (/^- /.test(line)) {
      if (list !== 'ul') { closeList(); list = 'ul'; html.push('<ul>'); }
      html.push(`<li>${inline(line.slice(2))}</li>`); continue;
    }
    if (/^\d+\. /.test(line)) {
      if (list !== 'ol') { closeList(); list = 'ol'; html.push('<ol>'); }
      html.push(`<li>${inline(line.replace(/^\d+\. /, ''))}</li>`); continue;
    }
    if (line.startsWith('> ')) {
      closeList(); html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); continue;
    }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList(); closeTable();
  return html.join('');
}

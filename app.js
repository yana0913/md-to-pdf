const sampleMarkdown = `# 一份排版良好的文档

## 引言

这是一个可直接编辑的 Markdown 示例。你可以把自己的 **.md 文件** 拖到左侧，也可以在这里粘贴或修改内容，右侧会自动生成双栏 A4 预览。

页面已经设置为 A4 纸张、四边 3cm、宋体正文，并在每页底部显示页码。导出时请在打印窗口中选择“另存为 PDF”。

## Markdown 排版示例

### 正文与强调

排版的目标不是堆叠装饰，而是让信息获得清晰、稳定的阅读节奏。这里支持 **粗体**、*斜体*、\`行内代码\` 和 [链接](https://example.com)。

> 好的版面让读者把注意力留给内容本身。

### 列表

- 双栏正文自动连续排列
- 标题会尽量避免落在栏底
- 表格、引用与代码块都有独立样式
- 内容只在本地浏览器中处理

### 有序步骤

1. 上传或粘贴 Markdown 文档
2. 在右侧确认分页效果
3. 点击“导出 PDF”
4. 选择 A4、100% 缩放并保存

## 表格示例

| 项目 | 规格 | 状态 |
| --- | --- | --- |
| 纸张 | A4 纵向 | 已设置 |
| 版式 | 双栏 | 已设置 |
| 页边距 | 上下左右 3cm | 已设置 |
| 字体 | 宋体 | 已设置 |

## 结语

当正文变长时，内容会自动流入下一栏与下一页。页码会随页数更新，适合论文初稿、内部刊物、会议材料和长篇说明文档。`;

const els = {
  fileInput: document.querySelector('#fileInput'),
  chooseFile: document.querySelector('#chooseFile'),
  dropZone: document.querySelector('#dropZone'),
  fileName: document.querySelector('#fileName'),
  markdown: document.querySelector('#markdownInput'),
  pages: document.querySelector('#pages'),
  measure: document.querySelector('#flowMeasure'),
  pageStatus: document.querySelector('#pageStatus'),
  wordCount: document.querySelector('#wordCount'),
  exportPdf: document.querySelector('#exportPdf'),
  zoomOut: document.querySelector('#zoomOut'),
  zoomIn: document.querySelector('#zoomIn'),
  zoomValue: document.querySelector('#zoomValue'),
  toast: document.querySelector('#toast'),
};

let zoom = 0.75;
let renderTimer;
let toastTimer;

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

function inlineMarkdown(value) {
  let text = escapeHtml(value);
  text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return text;
}

function parseTable(lines, start) {
  if (start + 1 >= lines.length || !/^\s*\|?.*\|.*\|?\s*$/.test(lines[start])) return null;
  if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[start + 1])) return null;
  const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => inlineMarkdown(cell.trim()));
  const headers = cells(lines[start]);
  const rows = [];
  let index = start + 2;
  while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
    rows.push(cells(lines[index]));
    index += 1;
  }
  const html = `<table><thead><tr>${headers.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return { html, next: index };
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (/^```/.test(line.trim())) {
      const language = line.trim().slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      output.push(`<pre${language ? ` data-language="${escapeHtml(language)}"` : ''}><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const table = parseTable(lines, index);
    if (table) { output.push(table.html); index = table.next; continue; }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) {
      output.push('<hr>'); index += 1; continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ''));
      output.push(`<blockquote><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const tag = unordered ? 'ul' : 'ol';
      const items = [];
      const pattern = unordered ? /^\s*[-+*]\s+(.+)$/ : /^\s*\d+[.)]\s+(.+)$/;
      while (index < lines.length) {
        const match = lines[index].match(pattern);
        if (!match) break;
        items.push(`<li>${inlineMarkdown(match[1])}</li>`);
        index += 1;
      }
      output.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const next = lines[index];
      if (/^(#{1,4})\s+/.test(next) || /^```/.test(next.trim()) || /^>\s?/.test(next) || /^\s*[-+*]\s+/.test(next) || /^\s*\d+[.)]\s+/.test(next) || parseTable(lines, index)) break;
      paragraph.push(next.trim());
      index += 1;
    }
    output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
  }
  return output.join('');
}

function countCharacters(text) {
  return text.replace(/\s/g, '').length;
}

function renderDocument() {
  const markdown = els.markdown.value;
  const html = markdownToHtml(markdown) || '<p>请在左侧输入或上传 Markdown 内容。</p>';
  els.measure.innerHTML = html;
  els.wordCount.textContent = `${countCharacters(markdown).toLocaleString('zh-CN')} 字`;

  requestAnimationFrame(() => {
    const columnPitch = mmToPx(79);
    const totalColumns = Math.max(1, Math.ceil((els.measure.scrollWidth + 1) / columnPitch));
    const pageCount = Math.max(1, Math.ceil(totalColumns / 2));
    els.pages.replaceChildren();

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const wrap = document.createElement('div');
      wrap.className = 'page-wrap';
      const page = document.createElement('article');
      page.className = 'page';
      page.setAttribute('aria-label', `第 ${pageIndex + 1} 页`);
      const content = document.createElement('div');
      content.className = 'page-content';
      const viewport = document.createElement('div');
      viewport.className = 'flow-viewport';
      const flow = document.createElement('div');
      flow.className = 'flow';
      flow.innerHTML = html;
      flow.style.transform = `translateX(-${pageIndex * 158}mm)`;
      viewport.appendChild(flow);
      content.appendChild(viewport);
      const number = document.createElement('div');
      number.className = 'page-number';
      number.textContent = `${pageIndex + 1} / ${pageCount}`;
      page.append(content, number);
      wrap.appendChild(page);
      els.pages.appendChild(wrap);
    }

    els.pageStatus.textContent = `${pageCount} 页 · A4 双栏`;
  });
}

function mmToPx(mm) {
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;width:${mm}mm`;
  document.body.appendChild(probe);
  const pixels = probe.getBoundingClientRect().width;
  probe.remove();
  return pixels;
}

function scheduleRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(renderDocument, 180);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 2400);
}

function openFile(file) {
  if (!file) return;
  if (!/\.(md|markdown|txt)$/i.test(file.name) && !/^(text\/markdown|text\/plain)$/.test(file.type)) {
    showToast('请选择 Markdown 文件');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    els.markdown.value = String(reader.result || '');
    els.fileName.textContent = file.name;
    renderDocument();
    showToast('文档已载入');
  };
  reader.onerror = () => showToast('文件读取失败，请重试');
  reader.readAsText(file, 'UTF-8');
}

function setZoom(nextZoom) {
  zoom = Math.min(1, Math.max(0.45, nextZoom));
  document.documentElement.style.setProperty('--page-scale', zoom);
  els.zoomValue.textContent = `${Math.round(zoom * 100)}%`;
}

els.chooseFile.addEventListener('click', () => els.fileInput.click());
els.dropZone.addEventListener('click', (event) => {
  if (!event.target.closest('button')) els.fileInput.click();
});
els.fileInput.addEventListener('change', () => openFile(els.fileInput.files[0]));
els.markdown.addEventListener('input', scheduleRender);
els.zoomOut.addEventListener('click', () => setZoom(zoom - 0.1));
els.zoomIn.addEventListener('click', () => setZoom(zoom + 0.1));
els.exportPdf.addEventListener('click', () => {
  renderDocument();
  window.setTimeout(() => window.print(), 100);
});

for (const eventName of ['dragenter', 'dragover']) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove('dragging');
  });
}
els.dropZone.addEventListener('drop', (event) => openFile(event.dataTransfer.files[0]));

els.markdown.value = sampleMarkdown;
setZoom(zoom);
renderDocument();

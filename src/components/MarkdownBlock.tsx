'use client';

type MarkdownBlockProps = {
  markdown: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineMarkdown(value: string) {
  return renderColorSpans(value)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/_(?!\s)([^_]+?)_/g, '<em>$1</em>')
    .replace(/\+\+(.*?)\+\+/g, '<u>$1</u>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderColorSpans(value: string) {
  const parts: string[] = [];
  const colorPattern = /\[color=(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\]([\s\S]*?)\[\/color\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = colorPattern.exec(value))) {
    parts.push(escapeHtml(value.slice(lastIndex, match.index)));
    parts.push(`<span class="markdown-color-text" style="color: ${match[1]}">${escapeHtml(match[2])}</span>`);
    lastIndex = match.index + match[0].length;
  }

  parts.push(escapeHtml(value.slice(lastIndex)));
  return parts.join('');
}

export function renderMarkdown(markdown: string) {
  const lines = markdown.split('\n');
  const html: string[] = [];
  let inList = false;
  let inOrderedList = false;

  function closeLists() {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    if (inOrderedList) {
      html.push('</ol>');
      inOrderedList = false;
    }
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      closeLists();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith('## ')) {
      closeLists();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith('# ')) {
      closeLists();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (numbered) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      if (!inOrderedList) {
        html.push('<ol>');
        inOrderedList = true;
      }
      html.push(`<li>${inlineMarkdown(numbered[1])}</li>`);
      continue;
    }

    const task = line.match(/^- \[( |x|X)\]\s+(.*)$/);
    if (task) {
      if (inOrderedList) {
        html.push('</ol>');
        inOrderedList = false;
      }
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      const checked = task[1].toLowerCase() === 'x' ? ' checked' : '';
      html.push(`<li class="task-list-item"><input type="checkbox" disabled${checked}> ${inlineMarkdown(task[2])}</li>`);
      continue;
    }

    if (line.startsWith('- ')) {
      if (inOrderedList) {
        html.push('</ol>');
        inOrderedList = false;
      }
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    closeLists();

    if (line.trim()) {
      if (line.startsWith('> ')) {
        html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      } else {
        html.push(`<p>${inlineMarkdown(line)}</p>`);
      }
    }
  }

  closeLists();

  return html.join('');
}

export function MarkdownBlock({ markdown }: MarkdownBlockProps) {
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />;
}

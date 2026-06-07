'use client';

import { memo, useMemo } from 'react';

type MarkdownBlockProps = {
  markdown: string;
  onTaskToggle?: (lineIndex: number) => void;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function decodeEscapedMarkdownUrl(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function safeLinkHref(value: string) {
  const href = decodeEscapedMarkdownUrl(value).trim();
  const normalizedHref = href.startsWith('www.') ? `https://${href}` : href;

  if (
    normalizedHref.startsWith('http://') ||
    normalizedHref.startsWith('https://') ||
    normalizedHref.startsWith('mailto:') ||
    normalizedHref.startsWith('/') ||
    normalizedHref.startsWith('#')
  ) {
    return escapeHtml(normalizedHref);
  }

  return '';
}

function anchorHtml(label: string, href: string) {
  const safeHref = safeLinkHref(href);
  if (!safeHref) return label;

  return `<a href="${safeHref}" target="_blank" rel="noreferrer">${label}</a>`;
}

function linkInlineMarkdown(value: string) {
  const anchors: string[] = [];

  const withMarkdownLinks = value.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
    const anchor = anchorHtml(label, href);
    if (anchor === label) return match;

    const token = `\u0000LINK${anchors.length}\u0000`;
    anchors.push(anchor);
    return token;
  });

  const withBareLinks = withMarkdownLinks.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+)/g, (match, prefix: string, url: string) => {
    const trailing = url.match(/[.,;:!?)\]]+$/)?.[0] ?? '';
    const cleanUrl = trailing ? url.slice(0, -trailing.length) : url;
    if (!cleanUrl) return match;

    return `${prefix}${anchorHtml(cleanUrl, cleanUrl)}${trailing}`;
  });

  return withBareLinks.replace(/\u0000LINK(\d+)\u0000/g, (_, index: string) => anchors[Number(index)] ?? '');
}

function inlineMarkdown(value: string) {
  return linkInlineMarkdown(renderColorSpans(value)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/_(?!\s)([^_]+?)_/g, '<em>$1</em>')
    .replace(/\+\+(.*?)\+\+/g, '<u>$1</u>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/`(.*?)`/g, '<code>$1</code>'));
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

export function renderMarkdown(markdown: string, options: { interactiveTasks?: boolean } = {}) {
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

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trimStart();

    if (trimmedLine.startsWith('### ')) {
      closeLists();
      html.push(`<h3>${inlineMarkdown(trimmedLine.slice(4))}</h3>`);
      return;
    }

    if (trimmedLine.startsWith('## ')) {
      closeLists();
      html.push(`<h2>${inlineMarkdown(trimmedLine.slice(3))}</h2>`);
      return;
    }

    if (trimmedLine.startsWith('# ')) {
      closeLists();
      html.push(`<h1>${inlineMarkdown(trimmedLine.slice(2))}</h1>`);
      return;
    }

    const numbered = trimmedLine.match(/^\d+\.\s+(.*)$/);
    if (numbered) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      if (!inOrderedList) {
        html.push('<ol type="1">');
        inOrderedList = true;
      }
      html.push(`<li>${inlineMarkdown(numbered[1])}</li>`);
      return;
    }

    const task = trimmedLine.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/);
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
      const disabled = options.interactiveTasks ? '' : ' disabled';
      const lineAttribute = options.interactiveTasks ? ` data-markdown-task-line="${lineIndex}"` : '';
      html.push(`<li class="task-list-item"><input type="checkbox"${disabled}${checked}${lineAttribute}> ${inlineMarkdown(task[2])}</li>`);
      return;
    }

    const bullet = trimmedLine.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (inOrderedList) {
        html.push('</ol>');
        inOrderedList = false;
      }
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      return;
    }

    closeLists();

    if (trimmedLine.trim()) {
      if (trimmedLine.startsWith('> ')) {
        html.push(`<blockquote>${inlineMarkdown(trimmedLine.slice(2))}</blockquote>`);
      } else {
        html.push(`<p>${inlineMarkdown(trimmedLine)}</p>`);
      }
    }
  });

  closeLists();

  return html.join('');
}

export const MarkdownBlock = memo(function MarkdownBlock({ markdown, onTaskToggle }: MarkdownBlockProps) {
  const html = useMemo(() => renderMarkdown(markdown, { interactiveTasks: Boolean(onTaskToggle) }), [markdown, onTaskToggle]);

  return (
    <div
      className="markdown"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(event) => {
        if (!onTaskToggle) return;
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;

        const lineIndex = target.dataset.markdownTaskLine;
        if (lineIndex === undefined) return;

        event.stopPropagation();
        onTaskToggle(Number(lineIndex));
      }}
    />
  );
});

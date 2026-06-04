'use client';

import { useRef } from 'react';

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
};

type MarkdownAction = 'bold' | 'italic' | 'heading' | 'list' | 'quote' | 'link';

const actions: Array<{ action: MarkdownAction; label: string; title: string }> = [
  { action: 'bold', label: 'B', title: 'Bold' },
  { action: 'italic', label: 'I', title: 'Italic' },
  { action: 'heading', label: 'H2', title: 'Heading' },
  { action: 'list', label: 'List', title: 'Bullet list' },
  { action: 'quote', label: 'Quote', title: 'Quote' },
  { action: 'link', label: 'Link', title: 'Link' },
];

export function MarkdownEditor({
  value,
  onChange,
  className,
  placeholder,
  rows = 7,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyAction(action: MarkdownAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const nextEdit = formatMarkdown(value, textarea.selectionStart, textarea.selectionEnd, action);
    onChange(nextEdit.value);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextEdit.selectionStart, nextEdit.selectionEnd);
    });
  }

  return (
    <div className="markdown-editor">
      <div className="markdown-toolbar" aria-label="Markdown formatting">
        {actions.map((item) => (
          <button
            type="button"
            className="mini-button secondary"
            key={item.action}
            title={item.title}
            onClick={() => applyAction(item.action)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className={className}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}

function formatMarkdown(value: string, selectionStart: number, selectionEnd: number, action: MarkdownAction) {
  const selected = value.slice(selectionStart, selectionEnd);
  if (action === 'bold') return wrapSelection(value, selectionStart, selectionEnd, '**', '**', 'bold text');
  if (action === 'italic') return wrapSelection(value, selectionStart, selectionEnd, '_', '_', 'italic text');
  if (action === 'link') return wrapSelection(value, selectionStart, selectionEnd, '[', '](https://)', 'link text');
  if (action === 'heading') return prefixLines(value, selectionStart, selectionEnd, '## ');
  if (action === 'quote') return prefixLines(value, selectionStart, selectionEnd, '> ');
  if (action === 'list') return prefixLines(value, selectionStart, selectionEnd, '- ');

  return { value, selectionStart, selectionEnd };
}

function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string,
  fallback: string,
) {
  const selected = value.slice(selectionStart, selectionEnd) || fallback;
  const nextValue = `${value.slice(0, selectionStart)}${prefix}${selected}${suffix}${value.slice(selectionEnd)}`;
  return {
    value: nextValue,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionStart + prefix.length + selected.length,
  };
}

function prefixLines(value: string, selectionStart: number, selectionEnd: number, prefix: string) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  const selected = value.slice(lineStart, selectionEnd) || 'Text';
  const prefixed = selected
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
    .join('\n');
  const nextValue = `${value.slice(0, lineStart)}${prefixed}${value.slice(selectionEnd)}`;

  return {
    value: nextValue,
    selectionStart: lineStart,
    selectionEnd: lineStart + prefixed.length,
  };
}

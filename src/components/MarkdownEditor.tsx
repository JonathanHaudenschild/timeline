'use client';

import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { MarkdownBlock } from './MarkdownBlock';

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
};

type MarkdownAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'heading'
  | 'list'
  | 'numbered'
  | 'task'
  | 'quote'
  | 'link';

const textActions: Array<{ action: MarkdownAction; label: string; title: string }> = [
  { action: 'bold', label: 'B', title: 'Bold' },
  { action: 'italic', label: 'I', title: 'Italic' },
  { action: 'underline', label: 'U', title: 'Underline' },
  { action: 'strike', label: 'S', title: 'Strikethrough' },
  { action: 'code', label: '`', title: 'Inline code' },
  { action: 'link', label: 'Link', title: 'Link' },
];

const blockActions: Array<{ action: MarkdownAction; label: string; title: string }> = [
  { action: 'heading', label: 'Title', title: 'Heading' },
  { action: 'list', label: 'Bullets', title: 'Bullet list' },
  { action: 'numbered', label: 'Numbers', title: 'Numbered list' },
  { action: 'task', label: 'Tasks', title: 'Task list' },
  { action: 'quote', label: 'Quote', title: 'Quote' },
];

const colorSwatches = ['#e53935', '#d81b60', '#8e24aa', '#3949ab', '#00897b', '#43a047', '#f9a825', '#fb8c00'];

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

  function applyColor(color: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const nextEdit = wrapSelection(value, textarea.selectionStart, textarea.selectionEnd, `[color=${color}]`, '[/color]', 'colored text');
    onChange(nextEdit.value);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextEdit.selectionStart, nextEdit.selectionEnd);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!event.metaKey && !event.ctrlKey) return;

    const key = event.key.toLowerCase();
    if (key === 'b') {
      event.preventDefault();
      applyAction('bold');
    }
    if (key === 'i') {
      event.preventDefault();
      applyAction('italic');
    }
    if (key === 'u') {
      event.preventDefault();
      applyAction('underline');
    }
    if (key === 'k') {
      event.preventDefault();
      applyAction('link');
    }
  }

  function renderToolbarGroup(items: Array<{ action: MarkdownAction; label: string; title: string }>) {
    return (
      <div className="markdown-toolbar-group">
        {items.map((item) => (
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
    );
  }

  return (
    <div className="markdown-editor">
      <div className="markdown-toolbar" aria-label="Markdown formatting">
        {renderToolbarGroup(textActions)}
        {renderToolbarGroup(blockActions)}
        <div className="markdown-color-tools" aria-label="Text color">
          {colorSwatches.map((color) => (
            <button
              type="button"
              className="markdown-color-swatch"
              key={color}
              style={{ backgroundColor: color }}
              title={`Text color ${color}`}
              onClick={() => applyColor(color)}
            />
          ))}
          <label className="markdown-color-picker" title="Custom text color">
            <span>Color</span>
            <input type="color" onChange={(event) => applyColor(event.target.value)} aria-label="Custom text color" />
          </label>
        </div>
      </div>
      <div className="markdown-live-layout">
        <textarea
          ref={textareaRef}
          className={['markdown-compose-field', className].filter(Boolean).join(' ')}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
        />
        <div className="markdown-editor-preview">
          <MarkdownBlock markdown={value || '_Nothing written yet._'} />
        </div>
      </div>
    </div>
  );
}

function formatMarkdown(value: string, selectionStart: number, selectionEnd: number, action: MarkdownAction) {
  if (action === 'bold') return wrapSelection(value, selectionStart, selectionEnd, '**', '**', 'bold text');
  if (action === 'italic') return wrapSelection(value, selectionStart, selectionEnd, '_', '_', 'italic text');
  if (action === 'underline') return wrapSelection(value, selectionStart, selectionEnd, '++', '++', 'underlined text');
  if (action === 'strike') return wrapSelection(value, selectionStart, selectionEnd, '~~', '~~', 'struck text');
  if (action === 'code') return wrapSelection(value, selectionStart, selectionEnd, '`', '`', 'code');
  if (action === 'link') return wrapSelection(value, selectionStart, selectionEnd, '[', '](https://)', 'link text');
  if (action === 'heading') return prefixLines(value, selectionStart, selectionEnd, '## ');
  if (action === 'quote') return prefixLines(value, selectionStart, selectionEnd, '> ');
  if (action === 'list') return prefixLines(value, selectionStart, selectionEnd, '- ');
  if (action === 'numbered') return numberLines(value, selectionStart, selectionEnd);
  if (action === 'task') return prefixLines(value, selectionStart, selectionEnd, '- [ ] ');

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

function numberLines(value: string, selectionStart: number, selectionEnd: number) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  const selected = value.slice(lineStart, selectionEnd) || 'Text';
  const numbered = selected
    .split('\n')
    .map((line, index) => (/^\d+\.\s/.test(line) ? line : `${index + 1}. ${line}`))
    .join('\n');
  const nextValue = `${value.slice(0, lineStart)}${numbered}${value.slice(selectionEnd)}`;

  return {
    value: nextValue,
    selectionStart: lineStart,
    selectionEnd: lineStart + numbered.length,
  };
}

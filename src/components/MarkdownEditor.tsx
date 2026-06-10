'use client';

import { useDeferredValue, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { MarkdownBlock } from './MarkdownBlock';
import { cn } from '@/lib/cn';

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
  const latestValueRef = useRef(value);
  const [editorState, setEditorState] = useState(() => ({
    localValue: value,
    propValue: value,
  }));
  let localValue = editorState.localValue;
  if (value !== editorState.propValue) {
    const nextState = {
      propValue: value,
      localValue: value === editorState.localValue ? editorState.localValue : value,
    };
    localValue = nextState.localValue;
    setEditorState(nextState);
  }
  const previewValue = useDeferredValue(localValue);

  useEffect(() => {
    latestValueRef.current = editorState.propValue;
  }, [editorState.propValue]);

  useEffect(() => {
    if (localValue === latestValueRef.current) return;

    const timeout = window.setTimeout(() => {
      if (localValue === latestValueRef.current) return;

      latestValueRef.current = localValue;
      onChange(localValue);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [localValue, onChange]);

  function updateValue(nextValue: string, flush = false) {
    setEditorState((current) => ({ ...current, localValue: nextValue }));
    if (!flush) return;

    latestValueRef.current = nextValue;
    onChange(nextValue);
  }

  function flushValue() {
    if (localValue === latestValueRef.current) return;

    latestValueRef.current = localValue;
    onChange(localValue);
  }

  function applyAction(action: MarkdownAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const nextEdit = formatMarkdown(localValue, textarea.selectionStart, textarea.selectionEnd, action);
    updateValue(nextEdit.value, true);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextEdit.selectionStart, nextEdit.selectionEnd);
    });
  }

  function applyColor(color: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const nextEdit = wrapSelection(localValue, textarea.selectionStart, textarea.selectionEnd, `[color=${color}]`, '[/color]', 'colored text');
    updateValue(nextEdit.value, true);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextEdit.selectionStart, nextEdit.selectionEnd);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey && continueNumberedList(event)) {
      return;
    }

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

  function continueNumberedList(event: KeyboardEvent<HTMLTextAreaElement>) {
    const textarea = textareaRef.current;
    if (!textarea || textarea.selectionStart !== textarea.selectionEnd) return false;

    const lineStart = localValue.lastIndexOf('\n', Math.max(0, textarea.selectionStart - 1)) + 1;
    const currentLine = localValue.slice(lineStart, textarea.selectionStart);
    const match = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
    if (!match) return false;

    event.preventDefault();
    const [, indent, number, content] = match;
    const insertion = content.trim()
      ? `\n${indent}${Number(number) + 1}. `
      : '\n';
    const nextValue = `${localValue.slice(0, textarea.selectionStart)}${insertion}${localValue.slice(textarea.selectionEnd)}`;
    const nextPosition = textarea.selectionStart + insertion.length;
    updateValue(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextPosition, nextPosition);
    });
    return true;
  }

  function renderToolbarGroup(items: Array<{ action: MarkdownAction; label: string; title: string }>) {
    return (
      <div className="flex flex-wrap gap-[4px] items-center">
        {items.map((item) => (
          <button
            type="button"
            className="tertiary min-h-[28px] border-[color-mix(in_srgb,var(--line)_20%,transparent)] bg-[var(--input-bg)] shadow-none px-[9px] py-[4px] text-[11px] hover:bg-[var(--primary)]"
            key={item.action}
            title={item.title}
            onMouseDown={(event) => {
              event.preventDefault();
              applyAction(item.action);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid overflow-hidden border border-[color-mix(in_srgb,var(--line)_24%,transparent)] rounded-[3px] bg-[var(--input-bg)] shadow-[0_1px_0_color-mix(in_srgb,var(--line)_12%,transparent)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[rgba(221,248,90,0.55)]">
      <div
        className="flex flex-wrap gap-[6px] items-center border-b border-b-[var(--soft-line)] bg-[var(--surface)] p-[7px]"
        aria-label="Markdown formatting"
        onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
          if (event.target instanceof HTMLInputElement) return;
          event.preventDefault();
        }}
      >
        {renderToolbarGroup(textActions)}
        {renderToolbarGroup(blockActions)}
        <div className="flex flex-wrap gap-[4px] items-center" aria-label="Text color">
          {colorSwatches.map((color) => (
            <button
              type="button"
              className="w-[28px] min-w-[28px] min-h-[28px] border border-[color-mix(in_srgb,var(--line)_32%,transparent)] rounded-[2px] shadow-none p-0 text-transparent overflow-hidden hover:border-[color-mix(in_srgb,var(--line)_50%,transparent)] hover:shadow-[0_2px_6px_color-mix(in_srgb,var(--line)_16%,transparent)]"
              key={color}
              style={{ backgroundColor: color }}
              title={`Text color ${color}`}
              onMouseDown={(event) => {
                event.preventDefault();
                applyColor(color);
              }}
            />
          ))}
          <label className="w-[48px] min-w-[28px] min-h-[36px] inline-grid items-center justify-items-center rounded-[2px] bg-[var(--input-bg)] shadow-none p-[2px] cursor-pointer" title="Custom text color" aria-label="Custom text color">
            <span className="sr-only">Custom color</span>
            <input
              type="color"
              onMouseDown={(event) => event.stopPropagation()}
              onChange={(event) => applyColor(event.target.value)}
              aria-label="Custom text color"
            />
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 min-h-[170px]">
        <textarea
          ref={textareaRef}
          className={cn('min-h-[170px] max-h-none border-0 rounded-none bg-[var(--input-bg)] shadow-none p-[12px] font-[inherit] text-[14px] font-normal leading-[1.55] whitespace-pre-wrap focus:outline-none resize-none', className)}
          value={localValue}
          onChange={(event) => updateValue(event.target.value)}
          onBlur={flushValue}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
        />
        <div className="min-h-[96px] max-h-[300px] overflow-auto border-t border-t-[var(--soft-line)] bg-[var(--surface)] p-[12px]">
          <MarkdownBlock markdown={previewValue || '_Nothing written yet._'} />
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
  const startNumber = previousNumberedListValue(value, lineStart) + 1;
  const numbered = selected
    .split('\n')
    .map((line, index) => (/^\s*\d+\.\s/.test(line) ? line : `${startNumber + index}. ${line}`))
    .join('\n');
  const nextValue = `${value.slice(0, lineStart)}${numbered}${value.slice(selectionEnd)}`;

  return {
    value: nextValue,
    selectionStart: lineStart,
    selectionEnd: lineStart + numbered.length,
  };
}

function previousNumberedListValue(value: string, lineStart: number) {
  const previousLines = value.slice(0, lineStart).split('\n').slice(0, -1);

  for (let index = previousLines.length - 1; index >= 0; index -= 1) {
    const line = previousLines[index];
    if (!line.trim()) continue;

    const match = line.match(/^\s*(\d+)\.\s/);
    return match ? Number(match[1]) : 0;
  }

  return 0;
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { TextField } from './FormControls';

type DialogTone = 'default' | 'danger';

type AlertOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  confirmIcon?: ReactNode;
};

type ConfirmOptions = AlertOptions & {
  cancelLabel?: string;
  cancelIcon?: ReactNode;
  tone?: DialogTone;
};

type PromptOptions = ConfirmOptions & {
  label: string;
  defaultValue?: string;
  placeholder?: string;
};

type DialogState =
  | ({ kind: 'alert' } & AlertOptions)
  | ({ kind: 'confirm' } & ConfirmOptions)
  | ({ kind: 'prompt' } & PromptOptions);

type DialogResult = boolean | string | null;

export function useAppDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const resolverRef = useRef<((result: DialogResult) => void) | null>(null);

  const closeDialog = useCallback((result: DialogResult) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    setInputValue('');
    resolver?.(result);
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const dialogKind = dialog.kind;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDialog(dialogKind === 'alert' ? true : null);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeDialog, dialog]);

  const openDialog = useCallback(<T extends DialogResult>(nextDialog: DialogState) => {
    setInputValue(nextDialog.kind === 'prompt' ? nextDialog.defaultValue ?? '' : '');
    setDialog(nextDialog);

    return new Promise<T>((resolve) => {
      resolverRef.current = resolve as (result: DialogResult) => void;
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return openDialog<boolean>({ kind: 'alert', confirmLabel: 'OK', ...options });
  }, [openDialog]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return openDialog<boolean>({
      kind: 'confirm',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      tone: 'default',
      ...options,
    });
  }, [openDialog]);

  const prompt = useCallback((options: PromptOptions) => {
    return openDialog<string | null>({
      kind: 'prompt',
      confirmLabel: 'Save',
      cancelLabel: 'Cancel',
      tone: 'default',
      ...options,
    });
  }, [openDialog]);

  const isDangerDialog = dialog?.kind !== 'alert' && dialog?.tone === 'danger';
  const dialogElement = dialog ? (
    <div className="modal-backdrop app-dialog-backdrop" role="dialog" aria-modal="true" aria-label={dialog.title}>
      <form
        className={`editor-panel modal-panel app-dialog ${isDangerDialog ? 'danger' : ''}`}
        onSubmit={(event) => {
          event.preventDefault();
          closeDialog(dialog.kind === 'prompt' ? inputValue : true);
        }}
      >
        <header className="app-dialog-header">
          <h2>{dialog.title}</h2>
          {dialog.message ? <p>{dialog.message}</p> : null}
        </header>

        {dialog.kind === 'prompt' ? (
          <TextField
            label={dialog.label}
            value={inputValue}
            placeholder={dialog.placeholder}
            onValueChange={setInputValue}
            autoFocus
            className="app-dialog-field"
          />
        ) : null}

        <div className="action-row app-dialog-actions">
          {dialog.kind !== 'alert' ? (
            <button
              type="button"
              className={dialog.cancelIcon ? 'icon-button tertiary modal-action-icon' : 'tertiary'}
              onClick={() => closeDialog(null)}
              aria-label={dialog.cancelIcon ? dialog.cancelLabel : undefined}
              title={dialog.cancelIcon ? dialog.cancelLabel : undefined}
            >
              {dialog.cancelIcon ?? dialog.cancelLabel}
            </button>
          ) : null}
          <button
            type="submit"
            className={dialog.confirmIcon ? `icon-button modal-action-icon ${isDangerDialog ? 'danger' : ''}` : isDangerDialog ? 'danger' : ''}
            autoFocus={dialog.kind !== 'prompt'}
            aria-label={dialog.confirmIcon ? dialog.confirmLabel : undefined}
            title={dialog.confirmIcon ? dialog.confirmLabel : undefined}
          >
            {dialog.confirmIcon ?? dialog.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  return {
    dialog: dialogElement,
    alert,
    confirm,
    prompt,
  };
}

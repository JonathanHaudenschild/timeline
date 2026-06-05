'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type DialogTone = 'default' | 'danger';

type AlertOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
};

type ConfirmOptions = AlertOptions & {
  cancelLabel?: string;
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
          <label className="app-dialog-field">
            <span>{dialog.label}</span>
            <input
              value={inputValue}
              placeholder={dialog.placeholder}
              onChange={(event) => setInputValue(event.target.value)}
              autoFocus
            />
          </label>
        ) : null}

        <div className="action-row app-dialog-actions">
          {dialog.kind !== 'alert' ? (
            <button type="button" className="secondary" onClick={() => closeDialog(null)}>
              {dialog.cancelLabel}
            </button>
          ) : null}
          <button type="submit" className={isDangerDialog ? 'danger' : ''} autoFocus={dialog.kind !== 'prompt'}>
            {dialog.confirmLabel}
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

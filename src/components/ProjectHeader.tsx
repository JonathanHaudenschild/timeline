'use client';

import { FileUp, History, KeyRound, Pencil, Trash2 } from 'lucide-react';
import type { TimelineMode, TimelineProject } from '@/lib/types';

type ProjectHeaderProps = {
  project: TimelineProject;
  saveState: string;
  syncState: string;
  syncLabel: string;
  onChange: (project: TimelineProject) => void;
  onModeChange: (mode: TimelineMode) => void;
  onProjectPinChange: () => void;
  onProjectPinRemove: () => void;
  onEditPinChange: () => void;
  onRestoreRevision: () => void;
  onImport: (file: File) => void;
};

export function ProjectHeader({
  project,
  saveState,
  syncState,
  syncLabel,
  onChange,
  onModeChange,
  onProjectPinChange,
  onProjectPinRemove,
  onEditPinChange,
  onRestoreRevision,
  onImport,
}: ProjectHeaderProps) {
  return (
    <header className="project-header">
      <div className="project-title">
        <label>
          <span>Project</span>
          <input
            value={project.name}
            disabled={project.settings.mode !== 'edit'}
            onChange={(event) => onChange({ ...project, name: event.target.value })}
            aria-label="Project name"
          />
        </label>
        <div className="hash-line">
          Share hash <code>#{project.hash}</code>
        </div>
      </div>

      <div className="header-controls">
        <div className="project-status-cluster" aria-label="Project save and sync status">
          <span className={`save-state ${saveState}`}>{saveState}</span>
          <span className={`sync-state ${syncState}`}>{syncLabel}</span>
        </div>
        <label className="date-control">
          <span>Start</span>
          <input
            type="date"
            value={project.startDate}
            disabled={project.settings.mode !== 'edit'}
            onChange={(event) => onChange({ ...project, startDate: event.target.value })}
          />
        </label>
        <label className="date-control">
          <span>End</span>
          <input
            type="date"
            value={project.endDate}
            disabled={project.settings.mode !== 'edit'}
            onChange={(event) => onChange({ ...project, endDate: event.target.value })}
          />
        </label>
        <div className="segmented" aria-label="Timeline mode">
          <button
            type="button"
            className={project.settings.mode === 'view' ? 'active' : ''}
            onClick={() => onModeChange('view')}
          >
            View
          </button>
          <button
            type="button"
            className={project.settings.mode === 'edit' ? 'active' : ''}
            onClick={() => onModeChange('edit')}
          >
            Edit
          </button>
        </div>
        <details className="mobile-control-menu">
          <summary>Project tools</summary>
          <div className="mobile-control-panel">
            {project.settings.mode === 'edit' ? (
              <>
                <button type="button" className="secondary" onClick={onProjectPinChange}>
                  <KeyRound size={16} aria-hidden="true" />
                  <span>Project PIN</span>
                </button>
                <button type="button" className="secondary" onClick={onEditPinChange}>
                  <Pencil size={16} aria-hidden="true" />
                  <span>Edit PIN</span>
                </button>
                {project.settings.viewPinHash ? (
                  <button type="button" className="secondary" onClick={onProjectPinRemove}>
                    <Trash2 size={16} aria-hidden="true" />
                    <span>Remove PIN</span>
                  </button>
                ) : null}
              </>
            ) : null}
            <button type="button" className="secondary" onClick={onRestoreRevision}>
              <History size={16} aria-hidden="true" />
              <span>Restore</span>
            </button>
            {project.settings.mode === 'edit' ? <ImportExcelButton onImport={onImport} /> : null}
          </div>
        </details>
        {project.settings.mode === 'edit' ? (
          <div className="desktop-control-group">
            <button
              type="button"
              className="icon-button secondary project-tool-button"
              onClick={onProjectPinChange}
              aria-label={project.settings.viewPinHash ? 'Change project PIN' : 'Add project PIN'}
              title={project.settings.viewPinHash ? 'Change project PIN' : 'Add project PIN'}
            >
              <KeyRound size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button secondary project-tool-button"
              onClick={onEditPinChange}
              aria-label={project.settings.editPinHash ? 'Change edit PIN' : 'Add edit PIN'}
              title={project.settings.editPinHash ? 'Change edit PIN' : 'Add edit PIN'}
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
            {project.settings.viewPinHash ? (
              <button
                type="button"
                className="icon-button secondary project-tool-button"
                onClick={onProjectPinRemove}
                aria-label="Remove project PIN"
                title="Remove project PIN"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="icon-button secondary project-tool-button"
              onClick={onRestoreRevision}
              aria-label="Restore revision"
              title="Restore revision"
            >
              <History size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {project.settings.mode === 'edit' ? <ImportExcelButton onImport={onImport} desktopOnly /> : null}
      </div>
    </header>
  );
}

function ImportExcelButton({ onImport, desktopOnly = false }: { onImport: (file: File) => void; desktopOnly?: boolean }) {
  return (
    <label className={`import-button icon-import-button ${desktopOnly ? 'desktop-only-control' : ''}`} aria-label="Import Excel" title="Import Excel">
      <FileUp size={18} aria-hidden="true" />
      <span>Import Excel</span>
      <input
        type="file"
        accept=".xlsx"
        aria-label="Import Excel"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.target.value = '';
        }}
      />
    </label>
  );
}

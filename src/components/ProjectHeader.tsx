'use client';

import type { TimelineMode, TimelineProject } from '@/lib/types';

type ProjectHeaderProps = {
  project: TimelineProject;
  onChange: (project: TimelineProject) => void;
  onModeChange: (mode: TimelineMode) => void;
  onProjectPinChange: () => void;
  onProjectPinRemove: () => void;
  onEditPinChange: () => void;
  onImport: (file: File) => void;
};

export function ProjectHeader({
  project,
  onChange,
  onModeChange,
  onProjectPinChange,
  onProjectPinRemove,
  onEditPinChange,
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
        <label>
          <span>Start</span>
          <input
            type="date"
            value={project.startDate}
            disabled={project.settings.mode !== 'edit'}
            onChange={(event) => onChange({ ...project, startDate: event.target.value })}
          />
        </label>
        <label>
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
        {project.settings.mode === 'edit' ? (
          <>
            <button type="button" className="secondary" onClick={onProjectPinChange}>
              {project.settings.viewPinHash ? 'Change project PIN' : 'Add project PIN'}
            </button>
            <button type="button" className="secondary" onClick={onEditPinChange}>
              {project.settings.editPinHash ? 'Change edit PIN' : 'Add edit PIN'}
            </button>
            {project.settings.viewPinHash ? (
              <button type="button" className="secondary" onClick={onProjectPinRemove}>
                Remove project PIN
              </button>
            ) : null}
          </>
        ) : null}
        <label className="import-button">
          Import Excel
          <input
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.target.value = '';
            }}
          />
        </label>
      </div>
    </header>
  );
}

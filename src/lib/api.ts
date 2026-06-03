import type { TimelineProject } from './types';

export class LockedProjectError extends Error {
  constructor() {
    super('Project is locked');
    this.name = 'LockedProjectError';
  }
}

function projectPinHeaders(projectPin?: string): Record<string, string> {
  return projectPin
    ? {
        'x-project-pin': projectPin,
      }
    : {};
}

export async function fetchProject(hash: string, projectPin?: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(hash)}`, {
    cache: 'no-store',
    headers: projectPinHeaders(projectPin),
  });

  if (response.status === 423) throw new LockedProjectError();

  if (!response.ok) {
    throw new Error(`Unable to load project (${response.status})`);
  }

  return (await response.json()) as TimelineProject;
}

export async function persistProject(project: TimelineProject, projectPin?: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(project.hash)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...projectPinHeaders(projectPin),
    },
    body: JSON.stringify(project),
  });

  if (response.status === 423) throw new LockedProjectError();

  if (!response.ok) {
    throw new Error(`Unable to save project (${response.status})`);
  }

  return (await response.json()) as TimelineProject;
}

export async function importProjectFile(hash: string, file: File, projectPin?: string) {
  const body = new FormData();
  body.set('file', file);

  const response = await fetch(`/api/projects/${encodeURIComponent(hash)}/import`, {
    method: 'POST',
    headers: projectPinHeaders(projectPin),
    body,
  });

  if (response.status === 423) throw new LockedProjectError();

  if (!response.ok) {
    throw new Error(`Unable to import project (${response.status})`);
  }

  return (await response.json()) as {
    project: TimelineProject;
    importedEvents: number;
    importedLinks: number;
  };
}

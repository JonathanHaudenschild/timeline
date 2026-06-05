import type { TimelineProject } from './types';

export type ProjectRevisionSummary = {
  revision: number;
  createdAt: string;
  name: string;
  startDate: string;
  endDate: string;
  eventCount: number;
  todoCount: number;
  boardCount: number;
  protocolCount: number;
};

export type ProjectMetadata = {
  hash: string;
  revision: number;
  updatedAt: string;
};

export class LockedProjectError extends Error {
  constructor() {
    super('Project is locked');
    this.name = 'LockedProjectError';
  }
}

export class ProjectConflictError extends Error {
  constructor() {
    super('Project changed on the server');
    this.name = 'ProjectConflictError';
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
  if (response.status === 409) throw new ProjectConflictError();

  if (!response.ok) {
    throw new Error(`Unable to load project (${response.status})`);
  }

  return (await response.json()) as TimelineProject;
}

export async function fetchProjectMetadata(hash: string, projectPin?: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(hash)}?meta=1`, {
    cache: 'no-store',
    headers: projectPinHeaders(projectPin),
  });

  if (response.status === 423) throw new LockedProjectError();
  if (response.status === 409) throw new ProjectConflictError();

  if (!response.ok) {
    throw new Error(`Unable to load project metadata (${response.status})`);
  }

  return (await response.json()) as ProjectMetadata;
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
  if (response.status === 409) throw new ProjectConflictError();

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
  if (response.status === 409) throw new ProjectConflictError();

  if (!response.ok) {
    throw new Error(`Unable to import project (${response.status})`);
  }

  return (await response.json()) as {
    project: TimelineProject;
    importedEvents: number;
    importedLinks: number;
  };
}

export async function fetchProjectRevisions(hash: string, projectPin?: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(hash)}/revisions`, {
    cache: 'no-store',
    headers: projectPinHeaders(projectPin),
  });

  if (response.status === 423) throw new LockedProjectError();

  if (!response.ok) {
    throw new Error(`Unable to load revisions (${response.status})`);
  }

  return (await response.json()) as {
    revisions: ProjectRevisionSummary[];
  };
}

export async function restoreProjectRevision(hash: string, revision: number, projectPin?: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(hash)}/revisions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...projectPinHeaders(projectPin),
    },
    body: JSON.stringify({ revision }),
  });

  if (response.status === 423) throw new LockedProjectError();

  if (!response.ok) {
    throw new Error(`Unable to restore revision (${response.status})`);
  }

  return (await response.json()) as TimelineProject;
}

import type { TimelineProject } from './types';

export async function fetchProject(hash: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(hash)}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Unable to load project (${response.status})`);
  }

  return (await response.json()) as TimelineProject;
}

export async function persistProject(project: TimelineProject) {
  const response = await fetch(`/api/projects/${encodeURIComponent(project.hash)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(project),
  });

  if (!response.ok) {
    throw new Error(`Unable to save project (${response.status})`);
  }

  return (await response.json()) as TimelineProject;
}

export async function importProjectFile(hash: string, file: File) {
  const body = new FormData();
  body.set('file', file);

  const response = await fetch(`/api/projects/${encodeURIComponent(hash)}/import`, {
    method: 'POST',
    body,
  });

  if (!response.ok) {
    throw new Error(`Unable to import project (${response.status})`);
  }

  return (await response.json()) as {
    project: TimelineProject;
    importedEvents: number;
    importedLinks: number;
  };
}

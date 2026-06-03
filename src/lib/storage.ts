import { createDefaultProject, normalizeHash, projectStorageKey } from './project';
import type { TimelineProject } from './types';

export function loadProject(hash: string, storage: Storage = window.localStorage) {
  const normalizedHash = normalizeHash(hash);
  const raw = storage.getItem(projectStorageKey(normalizedHash));

  if (!raw) {
    return createDefaultProject(normalizedHash);
  }

  try {
    return { ...createDefaultProject(normalizedHash), ...JSON.parse(raw), hash: normalizedHash } as TimelineProject;
  } catch {
    return createDefaultProject(normalizedHash);
  }
}

export function saveProject(project: TimelineProject, storage: Storage = window.localStorage) {
  storage.setItem(projectStorageKey(project.hash), JSON.stringify(project));
}

export function ensureProjectHash(location: Location) {
  const hash = normalizeHash(location.hash);
  if (location.hash !== `#${hash}`) {
    location.hash = hash;
  }
  return hash;
}

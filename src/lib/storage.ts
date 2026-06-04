import { createDefaultProject, normalizeHash, projectStorageKey } from './project';
import { normalizeMeetingProtocols } from './meetingProtocols';
import type { TimelineProject } from './types';

export function loadProject(hash: string, storage: Storage = window.localStorage) {
  const normalizedHash = normalizeHash(hash);
  const raw = storage.getItem(projectStorageKey(normalizedHash));

  if (!raw) {
    return createDefaultProject(normalizedHash);
  }

  try {
    const project = { ...createDefaultProject(normalizedHash), ...JSON.parse(raw), hash: normalizedHash } as TimelineProject;
    return { ...project, meetingProtocols: normalizeMeetingProtocols(project.meetingProtocols) };
  } catch {
    return createDefaultProject(normalizedHash);
  }
}

export function saveProject(project: TimelineProject, storage: Storage = window.localStorage) {
  storage.setItem(projectStorageKey(project.hash), JSON.stringify(project));
}

export function ensureProjectHash(location: Location) {
  const hash = location.hash ? normalizeHash(location.hash) : 'timeline';
  if (location.hash !== `#${hash}`) {
    location.hash = hash;
  }
  return hash;
}

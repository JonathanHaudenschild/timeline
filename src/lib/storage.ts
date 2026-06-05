import { createDefaultProject, normalizeHash, projectStorageKey } from './project';
import { normalizeMeetingProtocols } from './meetingProtocols';
import type { TimelineProject } from './types';

export type ProjectUrlTarget =
  | { section: 'top' | 'todos' | 'timeline' | 'events' | 'protocol' }
  | { section: 'protocol'; protocolId: string };

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
  const route = parseProjectLocationHash(location.hash);
  const nextHash = buildProjectLocationHash(route.projectHash, route.target);
  if (location.hash !== `#${nextHash}`) {
    location.hash = nextHash;
  }
  return route.projectHash;
}

export function parseProjectLocationHash(hash: string): { projectHash: string; target?: ProjectUrlTarget } {
  const rawHash = hash.replace(/^#/, '').trim();
  const [projectPart = '', targetPart = ''] = rawHash.split('?');
  const projectHash = projectPart ? normalizeHash(projectPart) : 'timeline';

  return {
    projectHash,
    target: parseProjectUrlTarget(targetPart),
  };
}

export function buildProjectLocationHash(projectHash: string, target?: ProjectUrlTarget) {
  const normalizedHash = normalizeHash(projectHash);
  if (!target || target.section === 'top') return normalizedHash;
  if (target.section === 'protocol' && 'protocolId' in target) {
    return `${normalizedHash}?protocol=${encodeURIComponent(target.protocolId)}`;
  }

  return `${normalizedHash}?${target.section}`;
}

function parseProjectUrlTarget(target: string): ProjectUrlTarget | undefined {
  const trimmedTarget = target.trim();
  if (!trimmedTarget) return undefined;

  const params = new URLSearchParams(trimmedTarget);
  const protocolId = params.get('protocol') || params.get('protocolId');
  if (protocolId) return { section: 'protocol', protocolId };
  if (params.has('protocol')) return { section: 'protocol' };

  const section = trimmedTarget.split('&')[0]?.split('=')[0]?.toLowerCase();
  if (section === 'todo') return { section: 'todos' };
  if (section === 'event' || section === 'event-table' || section === 'events-table') return { section: 'events' };
  if (section === 'protocols') return { section: 'protocol' };
  if (section === 'top' || section === 'todos' || section === 'timeline' || section === 'events' || section === 'protocol') {
    return { section };
  }

  return undefined;
}

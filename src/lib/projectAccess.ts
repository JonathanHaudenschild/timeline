import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { TimelineProject } from './types';

export function hashProjectPin(projectHash: string, pin: string) {
  return createHash('sha256').update(`${projectHash}:${pin}`).digest('hex');
}

export function canAccessProject(project: TimelineProject, request: NextRequest) {
  return canAccessProjectPin(project.hash, project.settings.viewPinHash, request);
}

export function canAccessProjectPin(projectHash: string, viewPinHash: string | undefined, request: NextRequest) {
  if (!viewPinHash) return true;

  const pin = request.headers.get('x-project-pin');
  return Boolean(pin && hashProjectPin(projectHash, pin) === viewPinHash);
}

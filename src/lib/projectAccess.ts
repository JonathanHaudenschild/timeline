import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { TimelineProject } from './types';

export function hashProjectPin(projectHash: string, pin: string) {
  return createHash('sha256').update(`${projectHash}:${pin}`).digest('hex');
}

export function canAccessProject(project: TimelineProject, request: NextRequest) {
  const viewPinHash = project.settings.viewPinHash;
  if (!viewPinHash) return true;

  const pin = request.headers.get('x-project-pin');
  return Boolean(pin && hashProjectPin(project.hash, pin) === viewPinHash);
}

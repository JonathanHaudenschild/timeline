import { describe, expect, it } from 'vitest';
import {
  createDefaultProject,
  createHash,
  normalizeHash,
  projectStorageKey,
} from './project';

describe('project helpers', () => {
  it('normalizes hashes from url fragments and plain strings', () => {
    expect(normalizeHash('# Launch Plan ')).toBe('launch-plan');
    expect(normalizeHash('Project_123')).toBe('project-123');
  });

  it('falls back to a generated hash for empty input', () => {
    expect(normalizeHash('')).toMatch(/^tl-[a-z0-9]+$/);
  });

  it('creates stable localStorage keys', () => {
    expect(projectStorageKey('launch-plan')).toBe('timeline:project:launch-plan');
  });

  it('creates a default project for the supplied hash', () => {
    const project = createDefaultProject('launch-plan');

    expect(project.hash).toBe('launch-plan');
    expect(project.name).toBe('Launch Plan');
    expect(project.events.length).toBeGreaterThan(0);
    expect(project.todos.length).toBeGreaterThan(0);
  });

  it('creates short random hashes', () => {
    expect(createHash()).toMatch(/^tl-[a-z0-9]{6}$/);
  });
});

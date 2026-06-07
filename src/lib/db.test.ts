import { describe, expect, it, vi } from 'vitest';
import type { QueryResult } from 'pg';
import { getProject } from './db';

vi.mock('pg', () => {
  const state = {
    rows: [] as Array<{ hash: string; data: unknown; revision: number }>,
  };

  return {
    Pool: vi.fn(() => ({
      connect: vi.fn(async () => ({
        query: vi.fn(async (sql: string, params?: unknown[]): Promise<QueryResult> => {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rowCount: null, rows: [] } as QueryResult;
          }

          if (sql.includes('SELECT data, revision FROM timeline_projects')) {
            const hash = params?.[0];
            const row = state.rows.find((item) => item.hash === hash);
            return {
              rowCount: row ? 1 : 0,
              rows: row ? [{ data: row.data, revision: String(row.revision) }] : [],
            } as QueryResult;
          }

          if (sql.includes('SELECT revision FROM timeline_projects')) {
            const hash = params?.[0];
            const row = state.rows.find((item) => item.hash === hash);
            return {
              rowCount: row ? 1 : 0,
              rows: row ? [{ revision: String(row.revision) }] : [],
            } as QueryResult;
          }

          if (sql.includes('INSERT INTO timeline_projects')) {
            state.rows.push({
              hash: params?.[0] as string,
              data: JSON.parse(params?.[1] as string),
              revision: params?.[2] as number,
            });
            return { rowCount: 1, rows: [] } as QueryResult;
          }

          return { rowCount: 0, rows: [] } as QueryResult;
        }),
        release: vi.fn(),
      })),
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
    })),
  };
});

describe('db project persistence', () => {
  it('returns the saved default project with a revision when creating a missing project', async () => {
    const project = await getProject('new-default');

    expect(project.hash).toBe('new-default');
    expect(project.revision).toBe(1);
  });
});

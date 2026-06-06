import { Pool, type PoolClient } from 'pg';
import { createDefaultProject, normalizeHash } from './project';
import { buildTypeColors } from './colors';
import { defaultProtocolInstructionTemplate, normalizeMeetingProtocols } from './meetingProtocols';
import { activeTodoBoard, normalizeTodoBoards, syncProjectTodoBoard } from './todoBoards';
import { normalizeCompletedTodoStatus, normalizeTodoStatuses } from './todos';
import type { TimelineProject } from './types';

let pool: Pool | undefined;
let initialized = false;
const defaultLocalDatabaseUrl = 'postgres://timeline:timeline@localhost:5433/timeline';

export class ProjectConflictError extends Error {
  constructor() {
    super('Project changed on the server. Reload before saving again.');
    this.name = 'ProjectConflictError';
  }
}

function getPool() {
  if (!pool) {
    pool = new Pool({ ...databaseConfig(), max: 5 });
  }

  return pool;
}

function databaseConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
    };
  }

  if (process.env.POSTGRES_HOST) {
    return {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB ?? 'timeline',
      user: process.env.POSTGRES_USER ?? 'timeline',
      password: process.env.POSTGRES_PASSWORD,
    };
  }

  return {
    connectionString: defaultLocalDatabaseUrl,
  };
}

async function ensureSchema() {
  if (initialized) return;

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS timeline_projects (
      hash TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      revision BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await getPool().query(`
    ALTER TABLE timeline_projects
    ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0
  `);

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS timeline_project_revisions (
      id BIGSERIAL PRIMARY KEY,
      hash TEXT NOT NULL REFERENCES timeline_projects(hash) ON DELETE CASCADE,
      revision BIGINT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (hash, revision)
    )
  `);

  await getPool().query(`
    CREATE INDEX IF NOT EXISTS timeline_project_revisions_hash_created_at_idx
    ON timeline_project_revisions (hash, created_at DESC)
  `);

  await getPool().query(`
    INSERT INTO timeline_project_revisions (hash, revision, data, created_at)
    SELECT hash, revision, data, updated_at
    FROM timeline_projects
    ON CONFLICT (hash, revision) DO NOTHING
  `);

  initialized = true;
}

export async function getProject(hash: string) {
  await ensureSchema();

  const normalizedHash = normalizeHash(hash);
  const result = await getPool().query<{ data: TimelineProject; revision: string }>(
    'SELECT data, revision FROM timeline_projects WHERE hash = $1',
    [normalizedHash],
  );

  if (result.rowCount) {
    return normalizeProject({
      ...createDefaultProject(normalizedHash),
      ...result.rows[0].data,
      hash: normalizedHash,
      revision: Number(result.rows[0].revision),
    });
  }

  const project = createDefaultProject(normalizedHash);
  await saveProjectToDb(project);
  return project;
}

export async function getProjectMetadata(hash: string) {
  await ensureSchema();

  const normalizedHash = normalizeHash(hash);
  const result = await getPool().query<{
    revision: string;
    updated_at: Date;
    view_pin_hash: string | null;
  }>(
    `SELECT
       revision,
       updated_at,
       data #>> '{settings,viewPinHash}' AS view_pin_hash
     FROM timeline_projects
     WHERE hash = $1`,
    [normalizedHash],
  );

  if (result.rowCount) {
    return {
      hash: normalizedHash,
      revision: Number(result.rows[0].revision),
      updatedAt: result.rows[0].updated_at.toISOString(),
      viewPinHash: result.rows[0].view_pin_hash ?? undefined,
    };
  }

  const project = await getProject(normalizedHash);
  return {
    hash: project.hash,
    revision: project.revision ?? 1,
    updatedAt: new Date().toISOString(),
    viewPinHash: project.settings.viewPinHash,
  };
}

export async function saveProjectToDb(project: TimelineProject) {
  await ensureSchema();

  const normalizedHash = normalizeHash(project.hash);
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<{ revision: string }>(
      'SELECT revision FROM timeline_projects WHERE hash = $1 FOR UPDATE',
      [normalizedHash],
    );

    if (existing.rowCount) {
      const currentRevision = Number(existing.rows[0].revision);
      if (project.revision !== currentRevision) {
        throw new ProjectConflictError();
      }

      const nextRevision = currentRevision + 1;
      const normalizedProject = normalizeProject({ ...project, hash: normalizedHash, revision: nextRevision });
      const update = await client.query(
        `UPDATE timeline_projects
         SET data = $2, revision = $3, updated_at = now()
         WHERE hash = $1 AND revision = $4`,
        [normalizedProject.hash, JSON.stringify(normalizedProject), nextRevision, currentRevision],
      );
      if (!update.rowCount) throw new ProjectConflictError();

      await insertProjectRevision(client, normalizedProject);
      await pruneProjectRevisions(client, normalizedProject.hash, normalizedProject.revision);
      await client.query('COMMIT');
      return normalizedProject;
    }

    const normalizedProject = normalizeProject({ ...project, hash: normalizedHash, revision: 1 });
    await client.query(
      `INSERT INTO timeline_projects (hash, data, revision, updated_at)
       VALUES ($1, $2, $3, now())`,
      [normalizedProject.hash, JSON.stringify(normalizedProject), normalizedProject.revision],
    );
    await insertProjectRevision(client, normalizedProject);
    await pruneProjectRevisions(client, normalizedProject.hash, normalizedProject.revision);
    await client.query('COMMIT');

    return normalizedProject;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof ProjectConflictError) throw error;
    if (isUniqueViolation(error)) throw new ProjectConflictError();
    throw error;
  } finally {
    client.release();
  }
}

export async function listProjectRevisions(hash: string) {
  await ensureSchema();

  const normalizedHash = normalizeHash(hash);
  const result = await getPool().query<{
    revision: string;
    created_at: Date;
    data: TimelineProject;
  }>(
    `SELECT
       revision,
       created_at,
       data
     FROM timeline_project_revisions
     WHERE hash = $1
     ORDER BY revision DESC
     LIMIT 30`,
    [normalizedHash],
  );

  return result.rows.map((row) => {
    const project = normalizeProject({
      ...createDefaultProject(normalizedHash),
      ...row.data,
      hash: normalizedHash,
      revision: Number(row.revision),
    });

    return {
      ...revisionSummary(normalizedHash, project),
      revision: Number(row.revision),
      createdAt: row.created_at.toISOString(),
      project,
    };
  });
}

function revisionSummary(hash: string, data: TimelineProject) {
  const project = normalizeProject({
    ...createDefaultProject(hash),
    ...data,
    hash,
  });
  const boards = normalizeTodoBoards(project);

  return {
    name: project.name,
    startDate: project.startDate,
    endDate: project.endDate,
    eventCount: project.events.length,
    todoCount: boards.reduce((count, board) => count + board.todos.length, 0),
    boardCount: boards.length,
    protocolCount: normalizeMeetingProtocols(project.meetingProtocols).length,
  };
}

export async function restoreProjectRevision(hash: string, revision: number) {
  await ensureSchema();

  const normalizedHash = normalizeHash(hash);
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<{ revision: string }>(
      'SELECT revision FROM timeline_projects WHERE hash = $1 FOR UPDATE',
      [normalizedHash],
    );
    if (!existing.rowCount) throw new ProjectConflictError();

    const snapshot = await client.query<{ data: TimelineProject }>(
      'SELECT data FROM timeline_project_revisions WHERE hash = $1 AND revision = $2',
      [normalizedHash, revision],
    );
    if (!snapshot.rowCount) throw new Error('Revision not found');

    const currentRevision = Number(existing.rows[0].revision);
    const nextRevision = currentRevision + 1;
    const restoredProject = normalizeProject({
      ...snapshot.rows[0].data,
      hash: normalizedHash,
      revision: nextRevision,
    });

    const update = await client.query(
      `UPDATE timeline_projects
       SET data = $2, revision = $3, updated_at = now()
       WHERE hash = $1 AND revision = $4`,
      [restoredProject.hash, JSON.stringify(restoredProject), nextRevision, currentRevision],
    );
    if (!update.rowCount) throw new ProjectConflictError();

    await insertProjectRevision(client, restoredProject);
    await pruneProjectRevisions(client, restoredProject.hash, restoredProject.revision);
    await client.query('COMMIT');
    return restoredProject;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertProjectRevision(client: PoolClient, project: TimelineProject) {
  await client.query(
    `INSERT INTO timeline_project_revisions (hash, revision, data)
     VALUES ($1, $2, $3)
     ON CONFLICT (hash, revision) DO NOTHING`,
    [project.hash, project.revision, JSON.stringify(project)],
  );
}

async function pruneProjectRevisions(client: PoolClient, hash: string, latestRevision?: number) {
  await client.query(
    `
      WITH ranked_daily_revisions AS (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY date_trunc('day', created_at)
            ORDER BY created_at DESC, revision DESC
          ) AS daily_rank
        FROM timeline_project_revisions
        WHERE hash = $1
          AND created_at < now() - interval '7 days'
          AND created_at >= now() - interval '30 days'
          AND revision <> $2
      ),
      old_revisions AS (
        SELECT id
        FROM timeline_project_revisions
        WHERE hash = $1
          AND created_at < now() - interval '30 days'
          AND revision <> $2
      ),
      revisions_to_delete AS (
        SELECT id FROM ranked_daily_revisions WHERE daily_rank > 1
        UNION
        SELECT id FROM old_revisions
      )
      DELETE FROM timeline_project_revisions
      WHERE id IN (SELECT id FROM revisions_to_delete)
    `,
    [hash, latestRevision ?? -1],
  );
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function normalizeProject(project: TimelineProject): TimelineProject {
  const boards = normalizeTodoBoards(project);
  const activeBoard = activeTodoBoard({
    ...project,
    todoBoards: boards,
  });
  const syncedProject = syncProjectTodoBoard(project, boards, activeBoard.id);

  return {
    ...syncedProject,
    ...project,
    todos: syncedProject.todos,
    todoBoards: syncedProject.todoBoards,
    protocolInstructionTemplate: project.protocolInstructionTemplate || defaultProtocolInstructionTemplate,
    meetingProtocols: normalizeMeetingProtocols(project.meetingProtocols),
    settings: {
      ...project.settings,
      ...syncedProject.settings,
      typeColors: {
        ...buildTypeColors(project.events.map((event) => event.type), project.settings.typeColors),
        ...project.settings.typeColors,
      },
      todoStatuses: normalizeTodoStatuses(activeBoard.statuses, activeBoard.todos),
      completedTodoStatus: normalizeCompletedTodoStatus(
        activeBoard.statuses,
        activeBoard.completedTodoStatus,
      ),
    },
  };
}

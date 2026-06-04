import { Pool } from 'pg';
import { createDefaultProject, normalizeHash } from './project';
import { buildTypeColors } from './colors';
import { normalizeMeetingProtocols } from './meetingProtocols';
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

export async function saveProjectToDb(project: TimelineProject) {
  await ensureSchema();

  const normalizedHash = normalizeHash(project.hash);
  const existing = await getPool().query<{ revision: string }>(
    'SELECT revision FROM timeline_projects WHERE hash = $1',
    [normalizedHash],
  );

  if (existing.rowCount) {
    const currentRevision = Number(existing.rows[0].revision);
    if (project.revision !== currentRevision) {
      throw new ProjectConflictError();
    }

    const nextRevision = currentRevision + 1;
    const normalizedProject = normalizeProject({ ...project, hash: normalizedHash, revision: nextRevision });
    const update = await getPool().query(
      `UPDATE timeline_projects
       SET data = $2, revision = $3, updated_at = now()
       WHERE hash = $1 AND revision = $4`,
      [normalizedProject.hash, JSON.stringify(normalizedProject), nextRevision, currentRevision],
    );
    if (!update.rowCount) throw new ProjectConflictError();
    return normalizedProject;
  }

  const normalizedProject = normalizeProject({ ...project, hash: normalizedHash, revision: 1 });
  try {
    await getPool().query(
      `INSERT INTO timeline_projects (hash, data, revision, updated_at)
       VALUES ($1, $2, $3, now())`,
      [normalizedProject.hash, JSON.stringify(normalizedProject), normalizedProject.revision],
    );
  } catch {
    throw new ProjectConflictError();
  }

  return normalizedProject;
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

import { Pool } from 'pg';
import { createDefaultProject, normalizeHash } from './project';
import { buildTypeColors } from './colors';
import { normalizeCompletedTodoStatus, normalizeTodoStatuses } from './todos';
import type { TimelineProject } from './types';

let pool: Pool | undefined;
let initialized = false;
const defaultLocalDatabaseUrl = 'postgres://timeline:timeline@localhost:5433/timeline';

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
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  initialized = true;
}

export async function getProject(hash: string) {
  await ensureSchema();

  const normalizedHash = normalizeHash(hash);
  const result = await getPool().query<{ data: TimelineProject }>(
    'SELECT data FROM timeline_projects WHERE hash = $1',
    [normalizedHash],
  );

  if (result.rowCount) {
    return normalizeProject({ ...createDefaultProject(normalizedHash), ...result.rows[0].data, hash: normalizedHash });
  }

  const project = createDefaultProject(normalizedHash);
  await saveProjectToDb(project);
  return project;
}

export async function saveProjectToDb(project: TimelineProject) {
  await ensureSchema();

  const normalizedProject = normalizeProject({ ...project, hash: normalizeHash(project.hash) });
  await getPool().query(
    `INSERT INTO timeline_projects (hash, data, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (hash)
     DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [normalizedProject.hash, JSON.stringify(normalizedProject)],
  );

  return normalizedProject;
}

function normalizeProject(project: TimelineProject): TimelineProject {
  return {
    ...project,
    settings: {
      ...project.settings,
      typeColors: {
        ...buildTypeColors(project.events.map((event) => event.type), project.settings.typeColors),
        ...project.settings.typeColors,
      },
      todoStatuses: normalizeTodoStatuses(project.settings.todoStatuses, project.todos),
      completedTodoStatus: normalizeCompletedTodoStatus(
        project.settings.todoStatuses,
        project.settings.completedTodoStatus,
      ),
    },
  };
}

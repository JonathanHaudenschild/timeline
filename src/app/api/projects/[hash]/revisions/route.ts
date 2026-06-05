import { NextRequest, NextResponse } from 'next/server';
import { getProject, listProjectRevisions, restoreProjectRevision } from '@/lib/db';
import { canAccessProject } from '@/lib/projectAccess';

type RouteContext = {
  params: Promise<{
    hash: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { hash } = await context.params;
    const project = await getProject(hash);
    if (!canAccessProject(project, request)) {
      return NextResponse.json({ locked: true, hash: project.hash }, { status: 423 });
    }

    return NextResponse.json({ revisions: await listProjectRevisions(project.hash) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to list revisions' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { hash } = await context.params;
    const project = await getProject(hash);
    if (!canAccessProject(project, request)) {
      return NextResponse.json({ locked: true, hash: project.hash }, { status: 423 });
    }

    const body = (await request.json()) as { revision?: number };
    if (!Number.isInteger(body.revision) || Number(body.revision) < 1) {
      return NextResponse.json({ error: 'Choose a valid revision.' }, { status: 400 });
    }

    const restoredProject = await restoreProjectRevision(project.hash, Number(body.revision));
    return NextResponse.json(restoredProject);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to restore revision' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProjectToDb } from '@/lib/db';
import { canAccessProject } from '@/lib/projectAccess';
import { normalizeHash } from '@/lib/project';
import type { TimelineProject } from '@/lib/types';

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

    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load project' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { hash } = await context.params;
    const existingProject = await getProject(hash);
    if (!canAccessProject(existingProject, request)) {
      return NextResponse.json({ locked: true, hash: existingProject.hash }, { status: 423 });
    }

    const body = (await request.json()) as TimelineProject;
    const project = await saveProjectToDb({ ...body, hash: normalizeHash(hash) });
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save project' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProjectToDb } from '@/lib/db';
import { normalizeHash } from '@/lib/project';
import type { TimelineProject } from '@/lib/types';

type RouteContext = {
  params: Promise<{
    hash: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { hash } = await context.params;
    const project = await getProject(hash);
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

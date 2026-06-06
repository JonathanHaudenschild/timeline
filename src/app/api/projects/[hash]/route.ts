import { NextRequest, NextResponse } from 'next/server';
import { getProject, getProjectMetadata, ProjectConflictError, saveProjectToDb } from '@/lib/db';
import { canAccessProject, canAccessProjectPin } from '@/lib/projectAccess';
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
    if (request.nextUrl.searchParams.get('meta') === '1') {
      const metadata = await getProjectMetadata(hash);
      if (!canAccessProjectPin(metadata.hash, metadata.viewPinHash, request)) {
        return NextResponse.json({ locked: true, hash: metadata.hash }, { status: 423 });
      }

      return NextResponse.json({
        hash: metadata.hash,
        revision: metadata.revision,
        updatedAt: metadata.updatedAt,
      });
    }

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
  let requestedHash = '';

  try {
    const { hash } = await context.params;
    requestedHash = hash;
    const existingProject = await getProject(hash);
    if (!canAccessProject(existingProject, request)) {
      return NextResponse.json({ locked: true, hash: existingProject.hash }, { status: 423 });
    }

    const body = (await request.json()) as TimelineProject;
    const project = await saveProjectToDb({ ...body, hash: normalizeHash(hash) });
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof ProjectConflictError) {
      try {
        if (!requestedHash) return NextResponse.json({ error: error.message }, { status: 409 });
        const latestProject = await getProject(requestedHash);
        if (!canAccessProject(latestProject, request)) {
          return NextResponse.json({ locked: true, hash: latestProject.hash }, { status: 423 });
        }

        return NextResponse.json({ error: error.message, project: latestProject }, { status: 409 });
      } catch {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save project' },
      { status: 500 },
    );
  }
}

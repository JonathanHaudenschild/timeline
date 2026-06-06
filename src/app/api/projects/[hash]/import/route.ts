import { NextRequest, NextResponse } from 'next/server';
import { getProject, ProjectConflictError, saveProjectToDb } from '@/lib/db';
import { importProjectWorkbook } from '@/lib/importExcel';
import { canAccessProject } from '@/lib/projectAccess';

type RouteContext = {
  params: Promise<{
    hash: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { hash } = await context.params;
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Upload an .xlsx or .json file in the "file" field.' }, { status: 400 });
    }

    const existingProject = await getProject(hash);
    if (!canAccessProject(existingProject, request)) {
      return NextResponse.json({ locked: true, hash: existingProject.hash }, { status: 423 });
    }

    if (isJsonProjectFile(file)) {
      const importedProject = JSON.parse(await file.text()) as typeof existingProject;
      const project = await saveProjectToDb({
        ...importedProject,
        hash: existingProject.hash,
        revision: existingProject.revision,
      });

      return NextResponse.json({
        project,
        importedEvents: project.events.length,
        importedLinks: project.settings.stickyLinks?.length ?? 0,
        importedProject: true,
      });
    }

    const result = await importProjectWorkbook(hash, await file.arrayBuffer(), existingProject);
    const project = await saveProjectToDb(result.project);

    return NextResponse.json({
      project,
      importedEvents: result.importedEvents,
      importedLinks: result.importedLinks,
    });
  } catch (error) {
    if (error instanceof ProjectConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to import workbook' },
      { status: 500 },
    );
  }
}

function isJsonProjectFile(file: File) {
  return file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
}

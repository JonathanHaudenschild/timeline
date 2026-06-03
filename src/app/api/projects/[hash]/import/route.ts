import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProjectToDb } from '@/lib/db';
import { importProjectWorkbook } from '@/lib/importExcel';

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
      return NextResponse.json({ error: 'Upload an .xlsx file in the "file" field.' }, { status: 400 });
    }

    const existingProject = await getProject(hash);
    const result = await importProjectWorkbook(hash, await file.arrayBuffer(), existingProject);
    const project = await saveProjectToDb(result.project);

    return NextResponse.json({
      project,
      importedEvents: result.importedEvents,
      importedLinks: result.importedLinks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to import workbook' },
      { status: 500 },
    );
  }
}

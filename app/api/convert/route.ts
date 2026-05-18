import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { getScan, updateScan } from '@/lib/scans';
import { convertE57toCOPC, checkPdal } from '@/lib/convert';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual re-trigger of conversion for a scan (e.g. after fixing a PDAL install).
// Body: { id: string, inputPath?: string }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: string; inputPath?: string } | null;
  if (!body?.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  const scan = await getScan(body.id);
  if (!scan) return NextResponse.json({ error: 'Scan not found' }, { status: 404 });

  const check = await checkPdal();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 500 });
  }

  const inputPath = body.inputPath ?? path.join(process.cwd(), 'tmp', `${scan.id}.e57`);
  try {
    await fs.access(inputPath);
  } catch {
    return NextResponse.json(
      { error: `Source E57 not found at ${inputPath} — re-upload required` },
      { status: 400 },
    );
  }

  const outputPath = path.join(process.cwd(), 'public', scan.copcFile.replace(/^\//, ''));
  await updateScan(scan.id, { status: 'converting', error: undefined });

  try {
    await convertE57toCOPC(inputPath, outputPath);
    const updated = await updateScan(scan.id, { status: 'ready' });
    await fs.unlink(inputPath).catch(() => undefined);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const updated = await updateScan(scan.id, { status: 'error', error: msg });
    return NextResponse.json(updated, { status: 500 });
  }
}

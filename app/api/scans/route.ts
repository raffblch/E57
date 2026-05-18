import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { readScans, writeScan, updateScan, type Scan } from '@/lib/scans';
import { convertE57toCOPC } from '@/lib/convert';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TMP_DIR = path.join(process.cwd(), 'tmp');
const POINTCLOUD_DIR = path.join(process.cwd(), 'public', 'pointclouds');

async function ensureDirs() {
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.mkdir(POINTCLOUD_DIR, { recursive: true });
}

export async function GET() {
  const scans = await readScans();
  scans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json(scans);
}

export async function POST(req: NextRequest) {
  await ensureDirs();

  const form = await req.formData();
  const file = form.get('file');
  const name = (form.get('name') as string | null)?.trim() || '';
  const date = (form.get('date') as string | null)?.trim() || new Date().toISOString().slice(0, 10);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'Missing name field' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.e57')) {
    return NextResponse.json({ error: 'File must have a .e57 extension' }, { status: 400 });
  }

  const id = randomUUID();
  const inputPath = path.join(TMP_DIR, `${id}.e57`);
  const outputName = `${id}.copc.laz`;
  const outputPath = path.join(POINTCLOUD_DIR, outputName);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(inputPath, buf);

  const scan: Scan = {
    id,
    name,
    originalFile: file.name,
    copcFile: `/pointclouds/${outputName}`,
    date,
    status: 'converting',
    sizeBytes: buf.length,
    createdAt: new Date().toISOString(),
  };
  await writeScan(scan);

  // Fire-and-forget background conversion. Status updates land in scans.json.
  void runConversion(id, inputPath, outputPath);

  return NextResponse.json(scan, { status: 201 });
}

async function runConversion(id: string, inputPath: string, outputPath: string) {
  try {
    await convertE57toCOPC(inputPath, outputPath);
    await updateScan(id, { status: 'ready' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateScan(id, { status: 'error', error: msg });
  } finally {
    try {
      await fs.unlink(inputPath);
    } catch {
      // ignore — temp file may already be gone
    }
  }
}

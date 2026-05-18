import { promises as fs } from 'fs';
import path from 'path';

export type ScanStatus = 'ready' | 'converting' | 'error';

export interface Scan {
  id: string;
  name: string;
  originalFile: string;
  copcFile: string;
  date: string;
  status: ScanStatus;
  sizeBytes: number;
  createdAt: string;
  error?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const SCANS_FILE = path.join(DATA_DIR, 'scans.json');

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SCANS_FILE);
  } catch {
    await fs.writeFile(SCANS_FILE, '[]\n', 'utf8');
  }
}

export async function readScans(): Promise<Scan[]> {
  await ensureFile();
  const raw = await fs.readFile(SCANS_FILE, 'utf8');
  try {
    const arr = JSON.parse(raw) as Scan[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeAll(scans: Scan[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(SCANS_FILE, JSON.stringify(scans, null, 2) + '\n', 'utf8');
}

export async function writeScan(scan: Scan): Promise<Scan> {
  const scans = await readScans();
  scans.push(scan);
  await writeAll(scans);
  return scan;
}

export async function updateScan(id: string, patch: Partial<Scan>): Promise<Scan | null> {
  const scans = await readScans();
  const idx = scans.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  scans[idx] = { ...scans[idx], ...patch };
  await writeAll(scans);
  return scans[idx];
}

export async function getScan(id: string): Promise<Scan | null> {
  const scans = await readScans();
  return scans.find((s) => s.id === id) ?? null;
}

export async function deleteScan(id: string): Promise<boolean> {
  const scans = await readScans();
  const next = scans.filter((s) => s.id !== id);
  if (next.length === scans.length) return false;
  await writeAll(next);
  return true;
}

import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

const PDAL_INSTALL_HINT =
  'PDAL was not found on PATH. Install it with one of:\n' +
  '  - conda: `conda install -c conda-forge pdal python-pdal`\n' +
  '  - macOS Homebrew: `brew install pdal`\n' +
  'Then restart this dev server so the new PATH is picked up.';

export async function checkPdal(): Promise<{ ok: boolean; version?: string; error?: string }> {
  // No caching — PATH or plugin availability can change between requests
  // (e.g. user installs a missing plugin without restarting the dev server).
  try {
    const { stdout } = await execFileAsync('pdal', ['--version']);
    return { ok: true, version: stdout.trim() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `${PDAL_INSTALL_HINT}\n\nUnderlying error: ${msg}` };
  }
}

export async function convertE57toCOPC(inputPath: string, outputPath: string): Promise<void> {
  const check = await checkPdal();
  if (!check.ok) {
    throw new Error(check.error ?? 'PDAL not available');
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // `pdal translate` infers reader/writer from extensions; .copc.laz triggers the COPC writer.
  await execFileAsync('pdal', ['translate', inputPath, outputPath], {
    maxBuffer: 1024 * 1024 * 64,
  });
}

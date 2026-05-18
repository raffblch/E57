#!/usr/bin/env node
/**
 * Downloads Potree and stages the built assets into public/potree/.
 *
 * Strategy:
 *  1. Try the release asset (release attachments live longer than tags).
 *  2. Fall back to the source archive of the pinned tag.
 *  3. Copy `build/` and `libs/` into public/potree/ and write our custom index.html.
 *
 * If the download fails (Potree changes release artifact names occasionally), the script
 * prints exact manual steps so you can drop the files into public/potree/ by hand.
 */

import { createWriteStream, promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { pipeline } from 'node:stream/promises';

const POTREE_VERSION = '1.8.2';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]):/, '$1:'), '..');
const TARGET_DIR = path.join(ROOT, 'public', 'potree');
const TMP_DIR = path.join(os.tmpdir(), `potree-setup-${Date.now()}`);

const CANDIDATE_URLS = [
  `https://github.com/potree/potree/archive/refs/tags/${POTREE_VERSION}.zip`,
  `https://github.com/potree/potree/archive/refs/heads/develop.zip`,
];

async function download(url, dest) {
  console.log(`→ downloading ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  await pipeline(res.body, createWriteStream(dest));
  const stat = await fs.stat(dest);
  if (stat.size < 1024 * 100) {
    throw new Error(`Downloaded file is suspiciously small (${stat.size} bytes)`);
  }
  console.log(`  ${(stat.size / 1024 / 1024).toFixed(1)} MB written`);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`)),
    );
  });
}

async function extract(zipPath, outDir) {
  await fs.mkdir(outDir, { recursive: true });
  if (process.platform === 'win32') {
    await run('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${outDir}' -Force`,
    ]);
  } else {
    try {
      await run('unzip', ['-q', '-o', zipPath, '-d', outDir]);
    } catch {
      await run('tar', ['-xf', zipPath, '-C', outDir]);
    }
  }
}

async function findRepoRoot(extractedDir) {
  const entries = await fs.readdir(extractedDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 1) return path.join(extractedDir, dirs[0].name);
  // Sometimes the zip extracts directly without a wrapper folder
  const hasBuild = entries.find((e) => e.isDirectory() && e.name === 'build');
  if (hasBuild) return extractedDir;
  throw new Error(`Could not find Potree repo root in ${extractedDir}`);
}

async function copyDir(src, dest) {
  await fs.cp(src, dest, { recursive: true, force: true });
}

async function main() {
  await fs.mkdir(TARGET_DIR, { recursive: true });
  await fs.mkdir(TMP_DIR, { recursive: true });

  const zipPath = path.join(TMP_DIR, 'potree.zip');
  let downloaded = false;
  for (const url of CANDIDATE_URLS) {
    try {
      await download(url, zipPath);
      downloaded = true;
      break;
    } catch (e) {
      console.warn(`  failed: ${e.message}`);
    }
  }
  if (!downloaded) throw new Error('All download candidates failed');

  const extractDir = path.join(TMP_DIR, 'extracted');
  await extract(zipPath, extractDir);
  const repoRoot = await findRepoRoot(extractDir);
  console.log(`→ staging from ${repoRoot}`);

  const buildSrc = path.join(repoRoot, 'build');
  const libsSrc = path.join(repoRoot, 'libs');
  for (const p of [buildSrc, libsSrc]) {
    try {
      await fs.access(p);
    } catch {
      throw new Error(`Expected directory missing in download: ${p}`);
    }
  }

  await copyDir(buildSrc, path.join(TARGET_DIR, 'build'));
  await copyDir(libsSrc, path.join(TARGET_DIR, 'libs'));

  // index.html is checked into the repo at scripts/potree-index.html — keep it under source control
  // so re-running setup never clobbers our custom viewer.
  const indexSrc = path.join(ROOT, 'scripts', 'potree-index.html');
  const indexDest = path.join(TARGET_DIR, 'index.html');
  await fs.copyFile(indexSrc, indexDest);

  console.log(`✓ Potree staged into ${TARGET_DIR}`);
  console.log('  Run `npm run dev` and upload an .e57 file to get started.');

  await fs.rm(TMP_DIR, { recursive: true, force: true });
}

main().catch((err) => {
  console.error('\n✗ Potree setup failed:', err.message);
  console.error(`
Manual fallback:
  1. Download Potree ${POTREE_VERSION} source from:
       https://github.com/potree/potree/releases/tag/${POTREE_VERSION}
  2. Unzip it.
  3. Copy these into public/potree/:
       - build/    (the compiled viewer assets)
       - libs/     (three.js and other dependencies)
  4. Copy scripts/potree-index.html into public/potree/index.html
  5. Re-run \`npm run dev\`.
`);
  process.exit(1);
});

# E57 Viewer — Local MVP

A local-only Next.js web app for converting E57 point-cloud scans to COPC
(via PDAL) and viewing them in the browser with Potree. No cloud, no auth,
no Docker, no database — everything lives on disk in the project folder.

This document is the complete handoff. It covers project goal, current
status, environment, file-by-file layout, data flow, every architectural
decision and deviation from the original spec, known issues, and how to
resume work.

---

## Table of contents

1. [Current status](#current-status)
2. [Project goal](#project-goal)
3. [Environment & prerequisites](#environment--prerequisites)
4. [Tech stack and pinned versions](#tech-stack-and-pinned-versions)
5. [Project layout](#project-layout)
6. [End-to-end data flow](#end-to-end-data-flow)
7. [File-by-file reference](#file-by-file-reference)
8. [Setup steps already completed on this machine](#setup-steps-already-completed-on-this-machine)
9. [Remaining setup / current blocker](#remaining-setup--current-blocker)
10. [How to resume work](#how-to-resume-work)
11. [Deviations from the original spec (and why)](#deviations-from-the-original-spec-and-why)
12. [Architectural decisions](#architectural-decisions)
13. [Known limitations](#known-limitations)
14. [Out-of-scope / future work](#out-of-scope--future-work)
15. [Troubleshooting cookbook](#troubleshooting-cookbook)

---

## Current status

- **Project scaffolded.** All source files written, all dependencies
  installed (`node_modules/` present).
- **`npm run build` passes** (Next 16.2.6 / Turbopack production build is clean).
- **`npx tsc --noEmit` is clean** (strict TypeScript, no errors).
- **Dev server boots** — `GET /` returns 200, `GET /api/scans` returns 200
  with `[]`.
- **PDAL is installed locally** (`pdal 2.10.1` via conda-forge).
- **Blocker:** PDAL is missing the E57 reader plugin. Two test uploads
  errored with `PDAL: Couldn't create reader stage of type 'readers.e57'`.
  See [Remaining setup / current blocker](#remaining-setup--current-blocker).

The `data/scans.json` file currently contains two failed-conversion records
from those tests; safe to delete or reset to `[]`.

---

## Project goal

A Next.js web app that lets a single local user:

1. Drop an `.e57` file, convert it to COPC (Cloud Optimized Point Cloud)
   format using PDAL.
2. View the resulting point cloud in the browser via Potree.
3. Use Potree's built-in measurement tools (distance, area, angle).
4. Load two scans and toggle between them for basic 4D compare
   (cross-fade slider).

This is a solo dev proof-of-concept. Intentional non-goals:
no auth, no cloud storage, no Docker, no multi-user, no real DB.

---

## Environment & prerequisites

**Host machine (already set up):**

- **OS:** Windows 11 Pro (10.0.26200)
- **Shell:** PowerShell 5.1 (`conda` initialised — `(base)` shows in prompt
  on a fresh terminal)
- **Project root:** `C:\Appdev\E57`
- **Node.js:** v24.13.1 (npm bundled)
- **Python:** 3.9.12 system + 3.13 inside Miniconda base env
- **Miniconda:** `C:\Users\rapha\miniconda3\` (installed via
  `winget install Anaconda.Miniconda3`, then `conda init powershell`)
- **An older Anaconda install** exists at `C:\Users\rapha\anaconda3\` — leftover
  from previous work, ignored by this project.
- **PDAL:** 2.10.1, installed into Miniconda base env
  (`conda install -c conda-forge pdal python-pdal`)
- **Git:** 2.40.0 (project is **not** a git repo yet — `git init` if desired)

The PowerShell profile at
`C:\Users\rapha\OneDrive\Documents\WindowsPowerShell\profile.ps1` was
modified by `conda init powershell` to auto-activate `(base)` in every
new PowerShell window.

---

## Tech stack and pinned versions

From `package.json`:

| Package | Version | Notes |
| --- | --- | --- |
| `next` | 16.2.6 | Originally specced as 14.2.x; bumped because all 14.x versions remain flagged with the 2025-12-11 security advisory. Brings Turbopack + Promise-typed `params`/`searchParams`. |
| `react` | 19.0.0 | Required by Next 16. |
| `react-dom` | 19.0.0 | |
| `typescript` | 5.5.4 | Strict mode, `moduleResolution: "bundler"`. |
| `tailwindcss` | 3.4.13 | Dark theme. |
| `autoprefixer` | 10.4.20 | |
| `postcss` | 8.4.47 | |

External system tools (not in `package.json`):
- **PDAL** ≥ 2.6 with the E57 reader plugin (provided by `libe57format` on
  conda-forge).
- **Potree** 1.8.2 — downloaded into `public/potree/` by the setup script.
  Requires a Potree build that includes the COPC loader (1.8.2+).

---

## Project layout

```
C:\Appdev\E57\
├── README.md                         # this file
├── package.json
├── package-lock.json
├── tsconfig.json                     # strict TS, paths: { "@/*": ["./*"] }
├── next.config.mjs
├── next-env.d.ts                     # auto-managed by Next
├── tailwind.config.ts
├── postcss.config.mjs
├── .gitignore
│
├── app/
│   ├── layout.tsx                    # root HTML shell + globals.css
│   ├── globals.css                   # tailwind directives + dark bg
│   ├── page.tsx                      # home: upload form + scan list
│   ├── viewer/[id]/page.tsx          # viewer page (server component)
│   └── api/
│       ├── scans/route.ts            # GET (list), POST (upload + queue convert)
│       └── convert/route.ts          # POST { id }: manual re-trigger
│
├── components/
│   ├── ScanList.tsx                  # 'use client', polls /api/scans every 3s
│   ├── UploadForm.tsx                # 'use client', multipart upload
│   └── PotreeViewer.tsx              # 'use client', thin iframe wrapper
│
├── lib/
│   ├── scans.ts                      # flat-file CRUD over data/scans.json
│   └── convert.ts                    # PDAL child_process wrapper + PATH check
│
├── public/
│   ├── pointclouds/                  # converted .copc.laz files land here
│   │   └── .gitkeep
│   └── potree/                       # staged by `npm run setup` (gitignored)
│       ├── build/                    # compiled Potree assets
│       ├── libs/                     # three.js, jquery, jstree, etc.
│       └── index.html                # custom viewer (copied from scripts/)
│
├── data/
│   └── scans.json                    # the entire "database"
│
├── scripts/
│   ├── setup-potree.mjs              # cross-platform Potree downloader (npm run setup)
│   ├── setup-potree.sh               # thin wrapper around the .mjs (Mac/Linux convenience)
│   └── potree-index.html             # custom viewer template, copied into public/potree/
│
├── tmp/                              # uploaded E57s land here; deleted after convert
│
└── node_modules/                     # installed
```

---

## End-to-end data flow

```
User selects .e57 in browser
        ▼
[ UploadForm.tsx ]
   POST /api/scans  (multipart: file, name, date)
        ▼
[ app/api/scans/route.ts :: POST ]
   1. ensureDirs() — mkdir tmp/, public/pointclouds/
   2. Validate file extension (.e57) and required fields
   3. Generate UUID v4 via crypto.randomUUID()
   4. Write upload buffer → tmp/<uuid>.e57
   5. writeScan({ id, name, status: 'converting', ... }) → data/scans.json
   6. void runConversion(...)  ← fire-and-forget, no await
   7. Respond 201 with the scan record
        ▼
[ runConversion() ]   (background, no HTTP response tied to it)
   1. convertE57toCOPC(input, output)
        → checkPdal()  (no caching — fresh check each call)
        → execFile('pdal', ['translate', input, output])
   2. On success: updateScan(id, { status: 'ready' })
   3. On failure: updateScan(id, { status: 'error', error: msg })
   4. finally: unlink tmp/<uuid>.e57
        ▼
[ ScanList.tsx ]   polls GET /api/scans every 3 s
   Badge flips converting → ready / error
        ▼
User clicks "Open viewer →"
        ▼
[ app/viewer/[id]/page.tsx ]   (Next 16 server component, async)
   1. await params, await searchParams (Next 15+ Promise API)
   2. getScan(id); if not ready → friendly message + back link
   3. Otherwise render <PotreeViewer file={copcFile} ... />
        ▼
[ PotreeViewer.tsx ]
   <iframe src="/potree/index.html?file=...&name=...&compareFile=...">
        ▼
[ public/potree/index.html ]   (custom, sourced from scripts/potree-index.html)
   - Reads query params
   - Boots Potree viewer (EDL on, gradient bg, 2 M point budget, full sidebar)
   - Potree.loadPointCloud(fileUrl)  ← native COPC loader (1.8+)
   - If compareFile present: load second cloud + cross-fade slider overlay
```

---

## File-by-file reference

### Configuration

**`package.json`** — Scripts: `setup` (runs `node scripts/setup-potree.mjs`),
`dev`, `build`, `start`, `lint`. Pure runtime: `next`, `react`, `react-dom`.
DevDeps: TypeScript, Tailwind, type packages.

**`tsconfig.json`** — Strict, `target: ES2022`, `module: esnext`,
`moduleResolution: bundler`, `jsx: react-jsx` (Next 16 sets this
automatically; original `preserve` was overwritten on first build),
path alias `@/* → ./*`. Excludes `node_modules` and `scripts/`.

**`next.config.mjs`** — Single tweak: `experimental.serverActions.bodySizeLimit = '10gb'`
so large E57 uploads aren't rejected by Next's default 1 MB cap, plus a
`headers()` rule sending `Accept-Ranges: bytes` for `/pointclouds/*` so
Potree can do partial range fetches against the COPC files.

**`tailwind.config.ts`** — Content globs cover `app/` and `components/`.
No custom theme yet.

**`.gitignore`** — Standard Next ignores plus `data/scans.json`,
`public/pointclouds/*` (kept folder via `.gitkeep`), `public/potree/`, `tmp/`.

### Library code

**`lib/scans.ts`** — Async flat-file CRUD using `fs.promises`. Functions:
`readScans()`, `writeScan(scan)`, `updateScan(id, patch)`, `getScan(id)`,
`deleteScan(id)`. Auto-creates `data/scans.json` with `[]` if missing.
Exports the `Scan` type and `ScanStatus = 'ready' | 'converting' | 'error'`.

**`lib/convert.ts`** — Two exports:
- `checkPdal()` → `{ ok: true, version }` or `{ ok: false, error }`. Runs
  `pdal --version` and parses output. **No caching** (was originally cached;
  removed because a missing-plugin failure could get stuck across an install).
- `convertE57toCOPC(inputPath, outputPath)` → awaits `checkPdal()`, throws
  with a clear install hint if PDAL is missing, otherwise runs
  `pdal translate <input> <output>`. PDAL infers reader/writer from extensions —
  `.e57` triggers `readers.e57`, `.copc.laz` triggers the COPC writer.
  `maxBuffer` bumped to 64 MB for verbose plugin logs.

### API routes

**`app/api/scans/route.ts`** — `runtime: 'nodejs'`, `dynamic: 'force-dynamic'`.
- `GET` returns scans sorted by `createdAt` desc.
- `POST` accepts `multipart/form-data` (file/name/date), writes file to
  `tmp/<uuid>.e57`, persists a scan record with `status: 'converting'`,
  fires `runConversion()` *without* awaiting, returns 201. The background
  function updates the scan status and deletes the temp file.

**`app/api/convert/route.ts`** — Manual re-trigger endpoint
(`POST { id, inputPath? }`). Looks up the scan, verifies PDAL, runs
conversion synchronously, returns the updated record. Useful if PDAL
install was fixed *after* a failed upload — but the temp `.e57` is
deleted in the original `finally` block, so without an explicit
`inputPath` the user usually has to re-upload.

### Pages

**`app/layout.tsx`** — Root layout, applies `bg-gray-900 text-gray-100`.

**`app/page.tsx`** — Server component. Two sections: upload form + scan list,
both rendered as children (the polling/upload logic lives in the client
components).

**`app/viewer/[id]/page.tsx`** — Async server component. **Important Next 16
detail:** `params` and `searchParams` are `Promise<>` and must be awaited.
Handles three states:
- Scan not found → `notFound()`
- Scan not ready → shows status + error message + back link
- Scan ready → header (back link, title, optional compare dropdown) +
  full-bleed `PotreeViewer` iframe

The compare dropdown is a simple GET form (`/viewer/[id]?compare=<other-id>`).

### Components

**`components/UploadForm.tsx`** — `'use client'`. Plain `<form>` submitted
via `fetch('/api/scans', { method: 'POST', body: FormData })`. Shows
inline spinner during upload and `router.refresh()` on success.

**`components/ScanList.tsx`** — `'use client'`. Polls `/api/scans` every
3 seconds via `setInterval` in a `useEffect`. Renders cards with
status badge, error pre-block for failures, and "Open viewer →" link
when `status === 'ready'`.

**`components/PotreeViewer.tsx`** — `'use client'`. Renders nothing but an
`<iframe>` pointing at `/potree/index.html?file=...&name=...&compareFile=...`.
Sized 100%/100% inside its container (parent gives it the height).

### Potree setup

**`scripts/setup-potree.mjs`** — Cross-platform Node script (run via
`npm run setup`). Downloads Potree 1.8.2 source archive from
GitHub Releases, falls back to the `develop` branch zip if the tag URL
fails. Extracts with PowerShell's `Expand-Archive` on Windows,
`unzip`/`tar` on Unix. Copies `build/` and `libs/` into `public/potree/`,
then copies `scripts/potree-index.html` to `public/potree/index.html`.
On failure prints exact manual fallback steps.

**`scripts/setup-potree.sh`** — Thin bash wrapper that just execs the
`.mjs` script. Lets the spec-mandated `bash scripts/setup-potree.sh`
work without duplicating logic.

**`scripts/potree-index.html`** — The custom viewer template. Kept under
source control here (rather than only in `public/potree/`) so re-running
setup never clobbers it. Loads the standard Potree library stack
(jQuery, jQuery UI, tween, d3, proj4, openlayers3, i18next, jstree,
potree.js, laslaz.js), builds a `Potree.Viewer` with:
- `setEDLEnabled(true)`
- `setFOV(60)`
- `setPointBudget(2_000_000)`
- `setBackground('gradient')`
- Full sidebar (`#menu_appearance`, `#menu_tools`, `#menu_scene`,
  `#menu_measurements` shown)
- `Potree.loadPointCloud(url)` — relies on Potree 1.8.2+'s native COPC loader
- Compare overlay (HTML `<input type="range">`) cross-fades two clouds by
  toggling `pointcloud.material.opacity` and `pointcloud.visible`
- Error banner shown on load failure with hint about COPC support

### Data

**`data/scans.json`** — Flat array of scan records. Schema:
```json
{
  "id": "uuid-v4",
  "name": "Tank Inspection 2026-05",
  "originalFile": "tank_01.e57",
  "copcFile": "/pointclouds/<uuid>.copc.laz",
  "date": "2026-05-17",
  "status": "ready" | "converting" | "error",
  "sizeBytes": 6195200,
  "createdAt": "2026-05-17T21:04:01.378Z",
  "error": "..."                       // present only when status === 'error'
}
```

---

## Setup steps already completed on this machine

1. ✅ Node 24.x present.
2. ✅ Miniconda installed via winget; `conda init powershell` run;
   `(base)` prompt active in new shells.
3. ✅ PDAL 2.10.1 + python-pdal installed into Miniconda base env via
   conda-forge.
4. ✅ `npm install` run; `node_modules/` present.
5. ✅ `npm run build` succeeds.

**Not yet done:**
- ❌ `npm run setup` (Potree download) — has not been run. `public/potree/`
  currently only contains nothing committed; the setup script needs to be
  run before the viewer will load.
- ❌ E57 reader plugin for PDAL is not installed (see next section).
- ❌ Project is not a git repository (`git init` skipped).

---

## Remaining setup / current blocker

### Blocker: PDAL E57 reader plugin missing

Two test uploads produced:
```
PDAL: Couldn't create reader stage of type 'readers.e57'.
You probably have a version of PDAL that didn't come with a plugin
you're trying to load. Please see the FAQ at https://pdal.org/faq.html
```

Since PDAL 2.6+, the E57 reader has been packaged as a plugin separate
from the core `pdal` binary. The conda-forge `pdal` 2.10.1 install does
not pull it in by default.

**To verify the plugin status:**

```powershell
pdal --drivers | findstr -i e57
```

If that prints nothing, the plugin is not registered.

**Likely fix (try in this order):**

1. Install the `libe57format` package:
   ```powershell
   conda install -c conda-forge libe57format
   ```
2. If that's not enough, force-reinstall PDAL with the E57 build variant:
   ```powershell
   conda install -c conda-forge "pdal=*=*e57*"
   ```
3. Failing that, try a clean dedicated env:
   ```powershell
   conda create -n e57 -c conda-forge pdal libe57format python-pdal
   conda activate e57
   ```
   (And remember to launch `npm run dev` from that env so the child process
   inherits PATH.)

After install, re-check:
```powershell
pdal --drivers | findstr -i e57
```
You should see both `readers.e57` and `writers.e57` listed.

### Other remaining setup

- Run `npm run setup` once to download and stage Potree into
  `public/potree/`. **The viewer page will 404 inside the iframe until this
  runs.** If the GitHub URL has shifted (Potree changes artifact names
  occasionally), the script prints exact manual fallback steps.

---

## How to resume work

From a fresh PowerShell window:

```powershell
cd C:\Appdev\E57

# Confirm conda env + PDAL
pdal --version                         # should print "pdal 2.10.1 ..."
pdal --drivers | findstr -i e57        # MUST list readers.e57 / writers.e57

# One-time: stage Potree
npm run setup

# Start dev server
npm run dev
```

Open <http://localhost:3000>, upload a small `.e57`, watch the badge flip
to **ready**, click **Open viewer →**.

To clear test data: empty `data/scans.json` back to `[]` and delete
`public/pointclouds/*.copc.laz`.

---

## Deviations from the original spec (and why)

| Spec said | What's actually here | Reason |
| --- | --- | --- |
| `next: 14.2.15` | `next: 16.2.6` | 14.x (including 14.2.33, the highest 14 release) is still flagged by the 2025-12-11 Next.js security advisory. Upgraded to current stable. |
| `react: 18.x` | `react: 19.0.0` | Required peer of Next 16. |
| `next.config.mjs` had a Pages-Router `api: { bodyParser: false }` block | App-router `experimental.serverActions.bodySizeLimit: '10gb'` | The original block applies to Pages Router only and has no effect under App Router (which this project uses). Replaced with the App-Router equivalent. |
| `params: { id: string }` in viewer page | `params: Promise<{ id: string }>` + `await params` | Next 15+ made route params async. Required by Next 16. |
| `export const maxDuration = 60 * 60` on API routes | Removed | Next 16 rejects high values, and the directive only meaningfully affects Vercel deployments. No-op locally. |
| `uuid` package + `@types/uuid` | Removed | Node's built-in `crypto.randomUUID()` is enough. |
| `scripts/setup-potree.sh` (bash only) | `setup-potree.mjs` (cross-platform Node) + thin `.sh` wrapper | Primary target is Windows. Node script handles `Expand-Archive` on Windows and `unzip`/`tar` on Unix. The `.sh` exists for spec compliance and Mac/Linux convenience; both delegate to the `.mjs`. |
| `lib/convert.ts` was a simple wrapper without a PATH check | Added `checkPdal()` (with no caching, after fix) | The spec asked for "test that PDAL is available and show a clear error". Cache was originally added for cheapness; removed when it interacted badly with mid-session plugin installs. |
| Viewer page params interface | Added a third state: status-not-ready message | Without this, navigating to a still-converting scan would crash the iframe. |
| No conversion re-trigger | Added `app/api/convert/route.ts` (POST { id, inputPath? }) | Lets you manually retry a failed conversion without re-uploading — though only if the temp E57 still exists, which by default it doesn't. |

---

## Architectural decisions

- **Flat-file DB.** `data/scans.json` is read/written in full on every
  mutation. Fine for solo / dozens-of-scans use. No concurrent-write
  protection — last-write-wins.
- **Fire-and-forget conversion.** `POST /api/scans` returns immediately
  after persisting `status: converting`. The conversion runs in the same
  Node process as the dev server. Killing `npm run dev` mid-conversion
  leaves the scan stuck in `converting`. Acceptable for an MVP; would
  need a proper job queue (BullMQ + Redis, or even just a SQLite-backed
  queue) for production.
- **Polling, not WebSockets.** `ScanList` polls every 3 s. Simpler,
  zero infra, fine for one user.
- **Iframe around Potree, not a native React component.** Potree depends
  on global jQuery, three.js, etc. Wrapping it in an iframe isolates
  those globals from the host app and lets us treat the viewer as a
  black-box static asset. Communication is via URL query params only.
- **COPC, not Potree's older `cloud.js` format.** PDAL writes COPC
  directly with `pdal translate`. No conversion pipeline scripts needed.
  Potree 1.8+ has a built-in COPC reader so the URL goes in unchanged.
- **Custom viewer HTML lives in `scripts/`, not `public/potree/`.**
  Because `npm run setup` overwrites `public/potree/`, keeping the
  template under `scripts/` (and copying it during setup) ensures
  re-running setup never clobbers our custom viewer.
- **`crypto.randomUUID()` for IDs.** Node 19+ built-in; no dependency.
- **Tailwind, not a UI lib.** Spec asked for "dark theme preferred".
  Tailwind alone is enough for the ~3 screens here.

---

## Known limitations

- **No file-size visibility to user during upload.** Browser shows a
  generic "Uploading…" with no progress bar. `fetch` doesn't expose
  upload progress easily; would need `XMLHttpRequest` or a streaming
  uploader. Acceptable for local use.
- **No delete UI.** Manually edit `data/scans.json` and rm files in
  `public/pointclouds/` to remove a scan.
- **Conversion log not captured.** PDAL stdout/stderr is discarded
  except on failure (where it's stored in the scan's `error` field).
  No live log streaming to the UI.
- **No real "4D" — only visual cross-fade.** No spatial alignment,
  no diff highlighting, no time-aware logic. Just two clouds with
  shared camera and opposing opacities driven by a slider.
- **Single-process bottleneck.** A long-running conversion blocks
  CPU on the same Node process serving the UI. For a >5 GB file you
  may see UI sluggishness during conversion.
- **No COPC streaming over range requests assumed-but-untested.** The
  `Accept-Ranges: bytes` header is set on `/pointclouds/*`, which is
  what Potree's COPC loader needs, but this hasn't yet been verified
  end-to-end (blocker prevented a successful conversion).

---

## Out-of-scope / future work

Ordered roughly by value-to-effort:

1. **Scan delete button + confirm modal** — trivially adds CRUD
   completeness.
2. **Live PDAL log tail in the UI** — SSE from `/api/scans/<id>/log` →
   server-sent events from a captured child_process stream.
3. **Pre-flight plugin check** — `pdal --drivers` filtered for
   `readers.e57` at boot, surfaced as a banner on the home page if missing.
4. **Drag-and-drop upload** zone instead of a file picker.
5. **Sidecar metadata extraction** — `pdal info --metadata <file.e57>`
   on upload to capture point count, bounding box, scanner serial,
   capture date. Display on the scan card and viewer header.
6. **True split-screen compare** with synced cameras (Potree exposes
   `viewer.scene.cameraP/cameraO` — could mirror to a second viewer).
7. **A SQLite layer** with `better-sqlite3` if scans.json starts to
   feel cramped. Schema stays simple; migration is straightforward.
8. **A real queue** (`bullmq` + a local redis-in-process via
   `ioredis-mock`, or just `p-queue` to limit concurrent conversions
   per-process).
9. **PowerShell launcher script** (`./Start.ps1`) that activates the
   conda env and runs `npm run dev`, so you can double-click to launch.

---

## Troubleshooting cookbook

### "spawn pdal ENOENT" in a scan's error field
PDAL is not on `PATH` for the dev-server process.
- Confirm: in the same PowerShell tab running `npm run dev`, run
  `pdal --version` → must succeed.
- Restart `npm run dev` *after* installing PDAL, in a shell where
  `(base)` is in the prompt.
- The Node child_process inherits PATH at launch; you cannot install
  PDAL after starting the dev server and expect it to work.

### "Couldn't create reader stage of type 'readers.e57'"
PDAL is installed but missing the E57 plugin. See the
[blocker section](#remaining-setup--current-blocker).

### Viewer page loads but iframe is blank / 404 inside iframe
`public/potree/` is empty. Run `npm run setup`. If it fails, follow
the manual fallback in the script's error output (download the Potree
1.8.2 source zip, copy `build/` and `libs/` into `public/potree/`,
copy `scripts/potree-index.html` to `public/potree/index.html`).

### "COPC format not recognised" or similar inside the viewer
The staged Potree build pre-dates COPC support. Confirm `public/potree/`
came from Potree 1.8.2+ and not an older zip.

### `conda` not recognised in PowerShell
`conda init powershell` hasn't been run, or the new PowerShell window
wasn't opened fresh after init. If the profile errors with execution
policy: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`,
reopen shell.

### Next.js build error: "Invalid segment configuration export detected"
Something exports an unsupported segment config (Next 16 rejects
high `maxDuration` values and a few others). Already cleaned up in
this codebase; if it returns, check the most recently added
`export const ...` line at the top of an API route.

### Scan stays in "converting" forever
Either the dev server was killed mid-conversion, or PDAL hung. Check
the terminal where `npm run dev` is running for PDAL output. To reset,
edit `data/scans.json` and either delete the record or change `status`
to `error` manually.

### Need to start over from a clean slate
```powershell
Remove-Item -Recurse -Force public\pointclouds\*
Remove-Item -Recurse -Force tmp\*
Set-Content data\scans.json "[]"
```



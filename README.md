# E57 Viewer — Local MVP

A local-only web app for converting E57 point cloud scans to COPC (via PDAL) and
viewing them in a browser with Potree. No cloud, no auth, no Docker — everything
runs on your machine.

## Quick start

```bash
npm install
npm run setup         # downloads Potree into public/potree/
npm run dev           # starts http://localhost:3000
```

Open <http://localhost:3000>, upload an `.e57` file, wait for the status badge to
flip from **converting** to **ready**, then click **Open viewer**.

## Prerequisites

- **Node.js 20+** (tested with 24.x)
- **PDAL** on your PATH. Install with whichever you prefer:
  - conda: `conda install -c conda-forge pdal python-pdal`
  - macOS Homebrew: `brew install pdal`
  - Windows: `conda` route is easiest (OSGeo4W also works)

Verify with `pdal --version` from the same shell you'll run `npm run dev` in. If
it's not on PATH, conversions will fail with a clear error in the scan card.

## How it works

- E57 uploads land in `tmp/<uuid>.e57`.
- A background `pdal translate <input.e57> <output.copc.laz>` runs via `child_process`.
- Converted files are written to `public/pointclouds/<uuid>.copc.laz` and served
  as static files with `Accept-Ranges: bytes` so Potree can do partial loads.
- Scan metadata is stored as plain JSON in `data/scans.json` — no DB.
- The viewer page mounts `public/potree/index.html` in an iframe and passes the
  COPC URL via the `?file=` query parameter.
- 4D compare loads a second scan and exposes an HTML range slider that
  cross-fades the two point clouds.

## Project layout

```
e57-viewer/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # scan list + upload UI
│   ├── viewer/[id]/page.tsx      # viewer page (with compare dropdown)
│   └── api/
│       ├── scans/route.ts        # GET list, POST new scan (kicks off conversion)
│       └── convert/route.ts      # POST { id }: manual re-trigger
├── components/
│   ├── ScanList.tsx              # polls /api/scans every 3s
│   ├── UploadForm.tsx
│   └── PotreeViewer.tsx          # thin iframe wrapper
├── lib/
│   ├── scans.ts                  # flat-file CRUD over data/scans.json
│   └── convert.ts                # PDAL child_process wrapper + PATH check
├── public/
│   ├── potree/                   # populated by `npm run setup` (gitignored)
│   └── pointclouds/              # converted .copc.laz files (gitignored)
├── data/
│   └── scans.json                # the entire "database"
└── scripts/
    ├── setup-potree.mjs          # cross-platform Potree downloader
    ├── setup-potree.sh           # thin shell wrapper around the .mjs script
    └── potree-index.html         # custom viewer HTML, copied into public/potree/
```

## If `npm run setup` fails

Potree's release artifact names change occasionally. Manual fallback:

1. Download Potree 1.8.2 source from
   <https://github.com/potree/potree/releases/tag/1.8.2>
2. Unzip it.
3. Copy these into `public/potree/`:
   - `build/`  — compiled viewer assets
   - `libs/`   — three.js and other deps
4. Copy `scripts/potree-index.html` to `public/potree/index.html`.
5. `npm run dev` again.

## Limitations (MVP — intentional)

- No auth, no multi-user.
- No cloud storage — files stay on this machine.
- Conversion is fire-and-forget inside the Next.js process. For >5 GB files it
  may take several minutes; status flips in `data/scans.json` when it lands.
- COPC support requires a Potree build with COPC loader (1.8.2+).
- The compare slider is a simple opacity cross-fade, not a true split view.

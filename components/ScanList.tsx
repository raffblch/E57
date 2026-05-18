'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Scan } from '@/lib/scans';

function fmtSize(bytes: number): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`;
}

const STATUS_STYLES: Record<Scan['status'], string> = {
  ready: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  converting: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  error: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export default function ScanList() {
  const [scans, setScans] = useState<Scan[] | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchScans = async () => {
      try {
        const res = await fetch('/api/scans', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as Scan[];
        if (alive) setScans(data);
      } catch {
        // ignore transient errors during polling
      }
    };
    fetchScans();
    const id = setInterval(fetchScans, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (scans === null) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }
  if (scans.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-800 p-6 text-sm text-gray-500">
        No scans yet. Upload an E57 file above to get started.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {scans.map((s) => (
        <li
          key={s.id}
          className="rounded-lg border border-gray-800 bg-gray-950/60 p-4 transition hover:border-gray-700"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-base font-medium">{s.name}</div>
              <div className="mt-1 text-xs text-gray-500">
                {s.date} · {fmtSize(s.sizeBytes)} · <span className="font-mono">{s.originalFile}</span>
              </div>
            </div>
            <span
              className={`shrink-0 rounded border px-2 py-0.5 text-[11px] uppercase tracking-wide ${STATUS_STYLES[s.status]}`}
            >
              {s.status}
            </span>
          </div>
          {s.status === 'error' && s.error ? (
            <pre className="mt-3 max-h-32 overflow-auto rounded bg-black/50 p-2 text-[11px] text-red-300">
              {s.error}
            </pre>
          ) : null}
          <div className="mt-4">
            {s.status === 'ready' ? (
              <Link
                href={`/viewer/${s.id}`}
                className="inline-block rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500"
              >
                Open viewer →
              </Link>
            ) : (
              <span className="text-xs text-gray-500">
                {s.status === 'converting' ? 'Converting with PDAL…' : 'Conversion failed'}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

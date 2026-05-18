'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('Please select an .e57 file');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/scans', { method: 'POST', body: data });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm text-gray-300">E57 file</span>
        <input
          type="file"
          name="file"
          accept=".e57"
          required
          className="block w-full text-sm text-gray-200 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-300">Name</span>
        <input
          type="text"
          name="name"
          required
          placeholder="Tank Inspection 2026-05"
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-300">Date</span>
        <input
          type="date"
          name="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
        />
      </label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {submitting ? 'Uploading…' : 'Upload & convert'}
        </button>
        {submitting ? (
          <span className="flex items-center gap-2 text-sm text-gray-400">
            <Spinner /> Sending to server — conversion will run in the background.
          </span>
        ) : null}
        {error ? <span className="text-sm text-red-400">{error}</span> : null}
      </div>
    </form>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-gray-300" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getScan, readScans } from '@/lib/scans';
import PotreeViewer from '@/components/PotreeViewer';

export const dynamic = 'force-dynamic';

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ compare?: string }>;
}) {
  const { id } = await params;
  const { compare } = await searchParams;
  const scan = await getScan(id);
  if (!scan) notFound();
  if (scan.status !== 'ready') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold">{scan.name}</h1>
        <p className="mt-2 text-sm text-amber-300">
          This scan is not ready yet (status: <code>{scan.status}</code>).
          {scan.error ? <span className="mt-2 block text-red-300">Error: {scan.error}</span> : null}
        </p>
      </main>
    );
  }

  const allScans = await readScans();
  const others = allScans.filter((s) => s.id !== scan.id && s.status === 'ready');
  const compareScan = compare ? others.find((s) => s.id === compare) : undefined;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-3">
        <div className="flex items-center gap-4">
          <BackLink />
          <h1 className="text-base font-medium">
            {scan.name}
            {compareScan ? <span className="text-gray-400"> ↔ {compareScan.name}</span> : null}
          </h1>
        </div>
        {others.length > 0 ? (
          <form action={`/viewer/${scan.id}`} method="get" className="flex items-center gap-2">
            <label className="text-xs text-gray-400" htmlFor="compare">
              Compare with
            </label>
            <select
              id="compare"
              name="compare"
              defaultValue={compareScan?.id ?? ''}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm"
            >
              <option value="">— none —</option>
              {others.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1 text-sm font-medium hover:bg-blue-500"
            >
              Load
            </button>
          </form>
        ) : null}
      </header>
      <div className="flex-1">
        <PotreeViewer file={scan.copcFile} name={scan.name} compareFile={compareScan?.copcFile} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="rounded border border-gray-700 px-3 py-1 text-sm text-gray-300 hover:bg-gray-800"
    >
      ← Back
    </Link>
  );
}

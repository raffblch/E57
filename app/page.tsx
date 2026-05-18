import ScanList from '@/components/ScanList';
import UploadForm from '@/components/UploadForm';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">E57 Viewer — Local</h1>
        <p className="mt-2 text-sm text-gray-400">
          Drop an E57 scan, let PDAL convert it to COPC, then open it in Potree. Everything runs on this machine.
        </p>
      </header>

      <section className="mb-12 rounded-lg border border-gray-800 bg-gray-950/60 p-6">
        <h2 className="mb-4 text-lg font-medium">Upload a scan</h2>
        <UploadForm />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">Scans</h2>
        <ScanList />
      </section>
    </main>
  );
}

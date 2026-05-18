'use client';

import { useRef } from 'react';

interface Props {
  file: string;
  name: string;
  compareFile?: string;
}

export default function PotreeViewer({ file, name, compareFile }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const params = new URLSearchParams({ file, name });
  if (compareFile) params.set('compareFile', compareFile);

  return (
    <iframe
      ref={iframeRef}
      src={`/potree/index.html?${params.toString()}`}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      title={name}
    />
  );
}

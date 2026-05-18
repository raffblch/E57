import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'E57 Viewer — Local',
  description: 'Local-only E57 → COPC converter and Potree viewer',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-900 text-gray-100 antialiased">{children}</body>
    </html>
  );
}

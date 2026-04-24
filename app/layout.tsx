import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hebrew PDF Extractor',
  description: 'Extract Hebrew text from PDF files',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}

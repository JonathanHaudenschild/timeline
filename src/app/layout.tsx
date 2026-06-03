import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Timeline',
  description: 'Local-first project timeline',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

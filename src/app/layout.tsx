import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Timeline',
  description: 'Local-first project timeline',
};

// Runs synchronously before React hydration to prevent a flash of wrong theme.
const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('timeline-theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch(e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

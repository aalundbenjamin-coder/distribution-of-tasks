import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { getLocale } from '@/lib/i18n/server';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Distribution of Tasks',
    template: '%s · Distribution of Tasks',
  },
  description:
    'Work goes into a folder and comes out with the right name on it. Tasks are matched against recorded capabilities, so nobody is handed work they are not qualified for.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The document language has to match what is actually written on the page:
  // screen readers pick pronunciation from it, and so does the browser's
  // translate prompt.
  const locale = await getLocale();
  return (
    <html lang={locale} className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}

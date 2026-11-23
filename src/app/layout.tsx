import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'TAG Studio — Task, Activity & Goal',
  description: 'Installable Task, Activity & Goal tracker powered by Next.js and Supabase.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#17211E',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#F6F7F5] text-[#17211E] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Turnistica – Croce Verde',
  description: 'Gestione turni associazione di volontariato',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={inter.className}>
        {/* ── Header desktop ── */}
        <header className="bg-verde-700 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
              <span className="text-2xl">🚑</span>
              <span className="hidden sm:inline">Croce Verde – Turnistica</span>
              <span className="sm:hidden">Turnistica</span>
            </Link>
            {/* Nav visibile solo su desktop */}
            <nav className="hidden md:flex items-center gap-1 ml-auto">
              <Link href="/turni"     className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-verde-600 transition-colors">Turni</Link>
              <Link href="/personale" className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-verde-600 transition-colors">Personale</Link>
              <Link href="/report"    className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-verde-600 transition-colors">Report</Link>
              <Link href="/admin"     className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-verde-600 transition-colors opacity-75 hover:opacity-100">⚙️</Link>
            </nav>
          </div>
        </header>

        {/* ── Contenuto principale ── */}
        {/* pb-20 su mobile per non finire sotto la bottom nav */}
        <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 md:pb-6">
          {children}
        </main>

        {/* ── Bottom nav mobile ── */}
        <MobileNav />
      </body>
    </html>
  );
}

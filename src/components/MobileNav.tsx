'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/turni',    label: 'Turni',     icon: '📅' },
  { href: '/importa',  label: 'Importa',   icon: '📥' },
  { href: '/personale',label: 'Personale', icon: '👥' },
  { href: '/report',   label: 'Report',    icon: '📊' },
  { href: '/admin',    label: 'Admin',     icon: '⚙️' },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex md:hidden safe-area-pb">
      {links.map(({ href, label, icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
              active ? 'text-verde-700' : 'text-gray-500'
            }`}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span>{label}</span>
            {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-verde-600" />}
          </Link>
        );
      })}
    </nav>
  );
}

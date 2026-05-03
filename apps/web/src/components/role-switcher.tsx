'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Surface = { href: string; label: string };

export function RoleSwitcher({ surfaces }: { surfaces: Surface[] }) {
  const pathname = usePathname() ?? '';
  if (surfaces.length < 2) return null;

  return (
    <div className="inline-flex border border-hoe-line rounded-full p-0.5 bg-white">
      {surfaces.map((s) => {
        const active = pathname === s.href || pathname.startsWith(s.href + '/');
        return (
          <Link
            key={s.href}
            href={s.href}
            className={
              'px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs uppercase tracking-wider transition-colors ' +
              (active
                ? 'bg-hoe-fg text-white'
                : 'text-hoe-muted hover:text-hoe-brown')
            }
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}

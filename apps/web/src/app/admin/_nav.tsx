'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Group = { label: string; items: { href: string; label: string; sub?: boolean }[] };

const GROUPS: Group[] = [
  {
    label: 'Catalogus',
    items: [
      { href: '/admin/passes', label: 'Strippenkaarten' },
      { href: '/admin/subscriptions', label: 'Abonnementen' },
      { href: '/admin/activities', label: 'Lestypes' },
    ],
  },
  {
    label: 'Studio',
    items: [
      { href: '/admin/instructors', label: 'Instructeurs' },
      { href: '/admin/rooms', label: 'Ruimtes' },
      { href: '/admin/classes', label: 'Rooster' },
      { href: '/admin/classes/recurring', label: '↳ Bulk plannen', sub: true },
    ],
  },
  {
    label: 'Activiteit',
    items: [
      { href: '/admin/bookings', label: 'Boekingen' },
      { href: '/admin/orders', label: 'Betalingen' },
    ],
  },
  {
    label: 'Beheer',
    items: [
      { href: '/admin/team', label: 'Team' },
      { href: '/admin/studio', label: 'Studio-instellingen' },
    ],
  },
];

function NavList({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname() ?? '';
  return (
    <ul className="space-y-1 text-sm">
      {GROUPS.map((g) => (
        <li key={g.label}>
          <div className="text-xs uppercase text-gray-400 pt-3 first:pt-0">{g.label}</div>
          <ul>
            {g.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href} className={item.sub ? 'pl-3' : ''}>
                  <Link
                    href={item.href}
                    onClick={onClick}
                    className={
                      'block py-1 hover:underline ' +
                      (item.sub ? 'text-gray-600 ' : '') +
                      (active ? 'underline font-medium' : '')
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function AdminSidebar() {
  return (
    <aside className="hidden md:block text-sm">
      <h2 className="font-display text-lg mb-2">Admin</h2>
      <NavList />
    </aside>
  );
}

export function AdminMobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-xl">Admin</h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hoe-btn-sm-ghost"
          aria-label="Open menu"
        >
          ☰ Menu
        </button>
      </div>

      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Sluit menu"
            className="fixed inset-0 bg-black/30 z-40"
          />
          <div className="fixed top-0 right-0 bottom-0 w-72 bg-white z-50 shadow-xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg">Admin</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-2xl leading-none px-2"
                aria-label="Sluit menu"
              >
                ×
              </button>
            </div>
            <NavList onClick={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { getSupabaseServer } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const { data: roleRow } = await supabase
    .from('studio_admins')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'manager'])
    .maybeSingle();
  if (!roleRow) {
    // Staff (instructor-only) and unknown users go to their own surfaces.
    const { count: instr } = await supabase
      .from('instructors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    redirect(instr ? '/instructor' : '/account');
  }

  return (
    <>
      <Nav />
      <div className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-[200px_1fr] gap-8">
        <aside className="text-sm space-y-2">
          <h2 className="font-display text-lg mb-2">Admin</h2>
          <ul className="space-y-1">
            <li className="text-xs uppercase text-gray-400 pt-1">Catalogus</li>
            <li><Link href="/admin/passes" className="hover:underline">Strippenkaarten</Link></li>
            <li><Link href="/admin/subscriptions" className="hover:underline">Abonnementen</Link></li>
            <li><Link href="/admin/activities" className="hover:underline">Lestypes</Link></li>
            <li className="text-xs uppercase text-gray-400 pt-3">Studio</li>
            <li><Link href="/admin/instructors" className="hover:underline">Instructeurs</Link></li>
            <li><Link href="/admin/rooms" className="hover:underline">Ruimtes</Link></li>
            <li><Link href="/admin/classes" className="hover:underline">Rooster</Link></li>
            <li className="pl-3"><Link href="/admin/classes/recurring" className="hover:underline text-gray-600">↳ Bulk plannen</Link></li>
            <li className="text-xs uppercase text-gray-400 pt-3">Activiteit</li>
            <li><Link href="/admin/bookings" className="hover:underline">Boekingen</Link></li>
            <li><Link href="/admin/orders" className="hover:underline">Betalingen</Link></li>
            <li className="text-xs uppercase text-gray-400 pt-3">Beheer</li>
            <li><Link href="/admin/team" className="hover:underline">Team</Link></li>
          </ul>
        </aside>
        <main>{children}</main>
      </div>
    </>
  );
}

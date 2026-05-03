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
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 md:grid md:grid-cols-[200px_1fr] md:gap-8 space-y-6 md:space-y-0">
        <aside className="text-sm">
          <h2 className="font-display text-lg mb-2 hidden md:block">Admin</h2>
          <ul className="flex md:block gap-x-4 gap-y-1 flex-wrap md:space-y-1 -mx-1 md:mx-0">
            <li className="hidden md:block text-xs uppercase text-gray-400 pt-1">Catalogus</li>
            <li><Link href="/admin/passes" className="hover:underline px-1 md:px-0">Strippenkaarten</Link></li>
            <li><Link href="/admin/subscriptions" className="hover:underline px-1 md:px-0">Abonnementen</Link></li>
            <li><Link href="/admin/activities" className="hover:underline px-1 md:px-0">Lestypes</Link></li>
            <li className="hidden md:block text-xs uppercase text-gray-400 pt-3">Studio</li>
            <li><Link href="/admin/instructors" className="hover:underline px-1 md:px-0">Instructeurs</Link></li>
            <li><Link href="/admin/rooms" className="hover:underline px-1 md:px-0">Ruimtes</Link></li>
            <li><Link href="/admin/classes" className="hover:underline px-1 md:px-0">Rooster</Link></li>
            <li className="md:pl-3"><Link href="/admin/classes/recurring" className="hover:underline text-gray-600 px-1 md:px-0">↳ Bulk plannen</Link></li>
            <li className="hidden md:block text-xs uppercase text-gray-400 pt-3">Activiteit</li>
            <li><Link href="/admin/bookings" className="hover:underline px-1 md:px-0">Boekingen</Link></li>
            <li><Link href="/admin/orders" className="hover:underline px-1 md:px-0">Betalingen</Link></li>
            <li className="hidden md:block text-xs uppercase text-gray-400 pt-3">Beheer</li>
            <li><Link href="/admin/team" className="hover:underline px-1 md:px-0">Team</Link></li>
          </ul>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}

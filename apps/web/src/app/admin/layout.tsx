import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { getSupabaseServer } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const { count } = await supabase
    .from('studio_admins')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (!count) redirect('/account');

  return (
    <>
      <Nav />
      <div className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-[200px_1fr] gap-8">
        <aside className="text-sm space-y-2">
          <h2 className="font-display text-lg mb-2">Admin</h2>
          <ul className="space-y-1">
            <li><Link href="/admin/passes" className="hover:underline">Strippenkaarten</Link></li>
            <li><Link href="/admin/subscriptions" className="hover:underline">Abonnementen</Link></li>
            <li><Link href="/admin/activities" className="hover:underline">Lestypes</Link></li>
            <li><Link href="/admin/classes" className="hover:underline">Rooster</Link></li>
          </ul>
        </aside>
        <main>{children}</main>
      </div>
    </>
  );
}

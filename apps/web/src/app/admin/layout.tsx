import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { getSupabaseServer } from '@/lib/supabase/server';
import { AdminSidebar, AdminMobileMenu } from './_nav';

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
    const { count: instr } = await supabase
      .from('instructors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    redirect(instr ? '/instructor' : '/account');
  }

  return (
    <>
      <Nav />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 md:grid md:grid-cols-[200px_1fr] md:gap-8 space-y-4 md:space-y-0">
        <AdminMobileMenu />
        <AdminSidebar />
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}

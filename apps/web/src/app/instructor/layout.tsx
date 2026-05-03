import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { getSupabaseServer } from '@/lib/supabase/server';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/instructor');

  // Either: linked instructors row, or a studio_admins row of any role.
  const [{ count: instructorCount }, { count: adminCount }] = await Promise.all([
    supabase
      .from('instructors')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', STUDIO_ID)
      .eq('user_id', user.id),
    supabase
      .from('studio_admins')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);

  if (!instructorCount && !adminCount) redirect('/account');

  return (
    <>
      <Nav />
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <div className="flex justify-between items-baseline">
          <h1 className="font-display text-3xl">Instructeur</h1>
          <Link href="/instructor" className="text-sm underline">Mijn lessen</Link>
        </div>
        {children}
      </div>
    </>
  );
}

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { logout } from '@/app/(auth)/login/actions';

export async function Nav() {
  const t = await getTranslations('nav');
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  let surface: 'admin' | 'instructor' | null = null;
  if (user) {
    const { data: adminRow } = await supabase
      .from('studio_admins')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();
    if (adminRow) surface = 'admin';
    else {
      const { count: instr } = await supabase
        .from('instructors')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (instr) surface = 'instructor';
    }
  }

  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-hoe-line bg-white/70 backdrop-blur">
      <Link href="/" className="font-display text-2xl tracking-wide">
        House&nbsp;of&nbsp;Eve
      </Link>
      <ul className="hidden md:flex gap-10 text-sm uppercase tracking-widest text-hoe-fg/80">
        <li><Link href="/rooster" className="hover:text-hoe-brown">{t('schedule')}</Link></li>
        <li><Link href="/prijzen" className="hover:text-hoe-brown">{t('pricing')}</Link></li>
      </ul>
      <div className="flex gap-4 items-center text-sm">
        {user ? (
          <>
            {surface === 'admin' && (
              <Link href="/admin" className="hidden md:inline text-hoe-muted hover:text-hoe-brown">
                Admin
              </Link>
            )}
            {surface === 'instructor' && (
              <Link href="/instructor" className="hidden md:inline text-hoe-muted hover:text-hoe-brown">
                Instructeur
              </Link>
            )}
            <Link href="/account" className="hoe-btn-ghost">
              {t('account')}
            </Link>
            <form action={logout}>
              <button type="submit" className="text-hoe-muted hover:text-hoe-brown">
                {t('logout')}
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="hoe-btn-ghost">
            {t('login')}
          </Link>
        )}
      </div>
    </nav>
  );
}

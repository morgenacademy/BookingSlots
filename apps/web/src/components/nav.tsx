import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { logout } from '@/app/(auth)/login/actions';
import { RoleSwitcher } from './role-switcher';

export async function Nav() {
  const t = await getTranslations('nav');
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Every authed user is a customer; admin and instructor surfaces are
  // additive based on their links.
  const surfaces: Array<{ href: string; label: string }> = [];
  if (user) {
    surfaces.push({ href: '/account', label: 'Klant' });

    const [{ count: instr }, { data: adm }] = await Promise.all([
      supabase
        .from('instructors')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('studio_admins')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['owner', 'manager'])
        .maybeSingle(),
    ]);
    if (instr) surfaces.push({ href: '/instructor', label: 'Instructeur' });
    if (adm) surfaces.push({ href: '/admin', label: 'Admin' });
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
            <RoleSwitcher surfaces={surfaces} />
            {surfaces.length < 2 && (
              <Link href="/account" className="hoe-btn-ghost">
                {t('account')}
              </Link>
            )}
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

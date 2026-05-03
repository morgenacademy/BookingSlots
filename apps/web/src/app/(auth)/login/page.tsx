import { getTranslations } from 'next-intl/server';
import { sendMagicLink } from './actions';
import { LoginForm } from './form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string }>;
}) {
  const t = await getTranslations('auth');
  const sp = await searchParams;

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <div className="hoe-card">
        <h1 className="font-display text-3xl text-center">{t('title')}</h1>
        {sp.sent ? (
          <p className="hoe-callout text-center">{t('checkInbox')}</p>
        ) : (
          <LoginForm action={sendMagicLink} next={sp.next ?? '/account'} />
        )}
      </div>
    </main>
  );
}

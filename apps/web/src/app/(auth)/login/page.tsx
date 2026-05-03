import { getTranslations } from 'next-intl/server';
import { sendMagicLink } from './actions';
import { LoginForm } from './form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string; error?: string }>;
}) {
  const t = await getTranslations('auth');
  const sp = await searchParams;

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <div className="hoe-card">
        <h1 className="font-display text-3xl text-center">{t('title')}</h1>
        {sp.error && (
          <p className="hoe-callout text-center text-red-700">
            Inloggen mislukte: {sp.error}. Vraag een nieuwe link aan.
          </p>
        )}
        {sp.sent ? (
          <p className="hoe-callout text-center">{t('checkInbox')}</p>
        ) : (
          <LoginForm action={sendMagicLink} next={sp.next ?? '/account'} />
        )}
      </div>
    </main>
  );
}

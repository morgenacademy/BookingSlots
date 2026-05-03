'use client';

import { useTranslations } from 'next-intl';

export function LoginForm({
  action,
  next,
}: {
  action: (formData: FormData) => Promise<void>;
  next: string;
}) {
  const t = useTranslations('auth');
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-hoe-muted">{t('emailLabel')}</span>
        <input
          type="email"
          name="email"
          required
          className="border border-hoe-line rounded-full px-4 py-2.5 bg-white"
        />
      </label>
      <button type="submit" className="hoe-btn-primary">
        {t('sendLink')}
      </button>
    </form>
  );
}

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { getSupabaseServer } from '@/lib/supabase/server';

export default async function ReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; subscription?: string }>;
}) {
  const t = await getTranslations('checkout');
  const sp = await searchParams;

  let status: 'paid' | 'pending' | 'failed' = 'pending';
  let invoiceNumber: string | null = null;
  if (sp.order) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from('orders')
      .select('status, invoice_number')
      .eq('id', sp.order)
      .single();
    if (data?.status === 'paid') status = 'paid';
    else if (data?.status === 'failed') status = 'failed';
    invoiceNumber = data?.invoice_number ?? null;
  } else if (sp.subscription) {
    status = 'paid';
  }

  return (
    <>
      <Nav />
      {/* Refresh while we wait on the Mollie webhook. */}
      {status === 'pending' && (
        <meta httpEquiv="refresh" content="3" />
      )}
      <main className="mx-auto max-w-md px-6 py-16 text-center space-y-4">
        {status === 'paid' && <h1 className="font-display text-3xl">{t('success')}</h1>}
        {status === 'failed' && <h1 className="font-display text-3xl">{t('failed')}</h1>}
        {status === 'pending' && <h1 className="font-display text-3xl">{t('redirecting')}</h1>}
        {invoiceNumber && (
          <p className="text-sm text-gray-600">Factuurnummer: {invoiceNumber}</p>
        )}
        <Link
          href="/account"
          className="inline-block hoe-btn-primary !w-auto px-5 py-2"
        >
          {t('viewAccount')}
        </Link>
      </main>
    </>
  );
}

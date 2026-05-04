'use server';

import { redirect } from 'next/navigation';
import { PaymentMethod } from '@mollie/api-client';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { mollie, siteUrl } from '@/lib/mollie';

export async function payPenalty(formData: FormData) {
  const penaltyId = String(formData.get('penalty_id'));
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/account');

  const admin = getSupabaseAdmin();

  const { data: penalty } = await admin
    .from('subscription_penalties')
    .select('id, studio_id, user_id, amount_eur_cents, reason, status')
    .eq('id', penaltyId)
    .single();
  if (!penalty || penalty.user_id !== user.id) redirect('/account');
  if (penalty.status !== 'open') redirect('/account');

  // Single-item order so the payment shows up in /admin/orders too.
  const { data: order } = await admin
    .from('orders')
    .insert({
      studio_id: penalty.studio_id,
      user_id: user.id,
      total_eur_cents: penalty.amount_eur_cents,
      status: 'pending',
    })
    .select('id')
    .single();
  if (!order) redirect('/account?error=order');

  await admin.from('order_items').insert({
    order_id: order.id,
    item_kind: 'penalty',
    quantity: 1,
    unit_price_eur_cents: penalty.amount_eur_cents,
  });

  const payment = await mollie().payments.create({
    amount: { currency: 'EUR', value: (penalty.amount_eur_cents / 100).toFixed(2) },
    description: `Boete: ${penalty.reason}`,
    redirectUrl: `${siteUrl()}/checkout/return?order=${order.id}`,
    webhookUrl: `${siteUrl()}/api/mollie/webhook`,
    metadata: { order_id: order.id, kind: 'penalty', penalty_id: penalty.id },
    method: [PaymentMethod.ideal, PaymentMethod.bancontact, PaymentMethod.creditcard],
  });

  await admin
    .from('orders')
    .update({ mollie_payment_id: payment.id })
    .eq('id', order.id);

  redirect(payment.getCheckoutUrl()!);
}

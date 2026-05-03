'use server';

import { redirect } from 'next/navigation';
import { PaymentMethod, SequenceType } from '@mollie/api-client';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { mollie, siteUrl } from '@/lib/mollie';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

async function ensureMollieCustomer(userId: string, email: string) {
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from('profiles')
    .select('mollie_customer_id, first_name, last_name')
    .eq('id', userId)
    .single();

  if (profile?.mollie_customer_id) return profile.mollie_customer_id;

  const customer = await mollie().customers.create({
    email,
    name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || email,
  });
  await admin
    .from('profiles')
    .update({ mollie_customer_id: customer.id })
    .eq('id', userId);
  return customer.id;
}

export async function addPassToCartAndCheckout(formData: FormData) {
  const passId = String(formData.get('pass_id'));
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/prijzen?buy=${passId}`)}`);
  }

  const admin = getSupabaseAdmin();
  const { data: pass } = await admin
    .from('passes')
    .select('id, name, price_eur_cents')
    .eq('id', passId)
    .eq('studio_id', STUDIO_ID)
    .single();
  if (!pass) redirect('/prijzen?error=notfound');

  // Single-item order — phase 1 keeps cart simple. Multi-item cart is phase 1.x.
  const { data: order, error } = await admin
    .from('orders')
    .insert({
      studio_id: STUDIO_ID,
      user_id: user.id,
      total_eur_cents: pass.price_eur_cents,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !order) redirect('/prijzen?error=order');

  await admin.from('order_items').insert({
    order_id: order.id,
    item_kind: 'pass',
    pass_id: pass.id,
    quantity: 1,
    unit_price_eur_cents: pass.price_eur_cents,
  });

  await ensureMollieCustomer(user.id, user.email!);

  const payment = await mollie().payments.create({
    amount: { currency: 'EUR', value: (pass.price_eur_cents / 100).toFixed(2) },
    description: `${pass.name}`,
    redirectUrl: `${siteUrl()}/checkout/return?order=${order.id}`,
    webhookUrl: `${siteUrl()}/api/mollie/webhook`,
    metadata: { order_id: order.id },
    method: [PaymentMethod.ideal, PaymentMethod.bancontact, PaymentMethod.creditcard],
  });

  await admin
    .from('orders')
    .update({ mollie_payment_id: payment.id })
    .eq('id', order.id);

  redirect(payment.getCheckoutUrl()!);
}

export async function subscribe(formData: FormData) {
  const subscriptionId = String(formData.get('subscription_id'));
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/prijzen?sub=${subscriptionId}`)}`);
  }

  const admin = getSupabaseAdmin();
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, name, price_eur_cents, interval')
    .eq('id', subscriptionId)
    .eq('studio_id', STUDIO_ID)
    .single();
  if (!sub) redirect('/prijzen?error=notfound');

  const customerId = await ensureMollieCustomer(user.id, user.email!);

  // First-payment flow that creates a mandate, then we attach the subscription via webhook.
  const firstPayment = await mollie().customerPayments.create({
    customerId,
    amount: { currency: 'EUR', value: (sub.price_eur_cents / 100).toFixed(2) },
    description: `${sub.name} — eerste betaling`,
    sequenceType: SequenceType.first,
    redirectUrl: `${siteUrl()}/checkout/return?subscription=${sub.id}`,
    webhookUrl: `${siteUrl()}/api/mollie/webhook`,
    metadata: { subscription_template_id: sub.id, kind: 'subscription_first' },
  });

  redirect(firstPayment.getCheckoutUrl()!);
}

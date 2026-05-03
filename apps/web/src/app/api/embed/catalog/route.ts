import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const ALLOW = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=60, s-maxage=60',
};

export async function GET(req: NextRequest) {
  const studio = req.nextUrl.searchParams.get('studio') ??
    process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;
  const admin = getSupabaseAdmin();

  const [{ data: passes }, { data: subs }] = await Promise.all([
    admin
      .from('passes')
      .select('id, slug, name, description, price_eur_cents, credits, validity_days, off_peak_only')
      .eq('studio_id', studio)
      .eq('active', true)
      .order('price_eur_cents'),
    admin
      .from('subscriptions')
      .select('id, slug, name, price_eur_cents, credits_per_period, unlimited')
      .eq('studio_id', studio)
      .eq('active', true)
      .order('price_eur_cents'),
  ]);

  return NextResponse.json({ passes: passes ?? [], subscriptions: subs ?? [] }, { headers: ALLOW });
}

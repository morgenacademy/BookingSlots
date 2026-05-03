import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = url.searchParams.get('next') ?? '/account';

  const supabase = await getSupabaseServer();

  // Two flows. PKCE delivers a `code` param and needs a verifier cookie set
  // by signInWithOtp. The stateless token-hash flow (used by our email
  // templates) just verifies the OTP server-side — works across browsers.
  let error: { message: string } | null = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = { message: 'missing code or token_hash' };
  }

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email!,
        studio_id: process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );

    if (user.email) {
      const admin = getSupabaseAdmin();
      const { data: invites } = await admin
        .from('studio_admin_invites')
        .select('studio_id, role')
        .eq('email', user.email.toLowerCase());
      if (invites?.length) {
        await admin.from('studio_admins').upsert(
          invites.map((i) => ({ studio_id: i.studio_id, user_id: user.id, role: i.role })),
          { onConflict: 'studio_id,user_id' },
        );
        await admin
          .from('studio_admin_invites')
          .delete()
          .eq('email', user.email.toLowerCase());
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}

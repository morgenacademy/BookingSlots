import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const explicitNext = url.searchParams.get('next');

  // Build the redirect response up front so verifyOtp can write session
  // cookies on the response that's actually sent to the browser. Setting
  // cookies via next/headers in route handlers doesn't propagate through
  // NextResponse.redirect.
  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    return res;
  };

  let response = redirectTo('/account');

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  let error: { message: string } | null = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = { message: 'missing code or token_hash' };
  }

  if (error) {
    return redirectTo(`/login?error=${encodeURIComponent(error.message)}`);
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
      const lcEmail = user.email.toLowerCase();

      const { data: invites } = await admin
        .from('studio_admin_invites')
        .select('studio_id, role, display_name')
        .eq('email', lcEmail);
      if (invites?.length) {
        await admin.from('studio_admins').upsert(
          invites.map((i) => ({ studio_id: i.studio_id, user_id: user.id, role: i.role })),
          { onConflict: 'studio_id,user_id' },
        );
        const inviteName = invites.find((i) => i.display_name)?.display_name as string | undefined;
        if (inviteName) {
          await admin
            .from('profiles')
            .update({ first_name: inviteName })
            .eq('id', user.id)
            .is('first_name', null);
        }
        await admin.from('studio_admin_invites').delete().eq('email', lcEmail);
      }

      await admin
        .from('instructors')
        .update({ user_id: user.id, invite_email: null })
        .eq('invite_email', lcEmail)
        .is('user_id', null);
    }
  }

  let next = explicitNext;
  if (!next && user) {
    const [{ data: adm }, { count: instr }] = await Promise.all([
      supabase
        .from('studio_admins')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['owner', 'manager'])
        .maybeSingle(),
      supabase
        .from('instructors')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);
    next = adm ? '/admin' : instr ? '/instructor' : '/account';
  }

  // Preserve cookies that verifyOtp set on `response` while updating the URL.
  const finalUrl = new URL(next ?? '/account', request.url);
  const final = NextResponse.redirect(finalUrl);
  for (const c of response.cookies.getAll()) {
    final.cookies.set(c.name, c.value, c);
  }
  return final;
}

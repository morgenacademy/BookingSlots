import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { inviteAdmin, removeAdmin, cancelInvite } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function TeamAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  const admin = getSupabaseAdmin();

  const [{ data: admins }, { data: invites }, usersList] = await Promise.all([
    supabase.from('studio_admins').select('user_id, role, created_at').eq('studio_id', STUDIO_ID),
    supabase
      .from('studio_admin_invites')
      .select('email, role, created_at')
      .eq('studio_id', STUDIO_ID)
      .order('created_at', { ascending: false }),
    admin.auth.admin.listUsers(),
  ]);

  const emailById = new Map(
    usersList.data?.users.map((u) => [u.id, u.email ?? '—']) ?? []
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Team</h1>
        <p className="text-sm text-gray-600 mt-1">
          Geef collega&apos;s toegang tot het beheerderspaneel. Ze krijgen een magic-link per
          mail; bij het inloggen worden ze automatisch admin.
        </p>
      </header>

      {sp.ok && <p className="hoe-callout">Uitnodiging verstuurd.</p>}
      {sp.err === 'email' && <p className="hoe-callout text-red-700">Vul een e-mailadres in.</p>}

      <section className="border rounded-2xl p-6 space-y-3">
        <h2 className="font-display text-xl">Nieuwe admin uitnodigen</h2>
        <form action={inviteAdmin} className="flex gap-3 items-end flex-wrap text-sm">
          <label className="flex flex-col gap-1 flex-1 min-w-[240px]">
            E-mail
            <input name="email" type="email" required className="border rounded px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            Rol
            <select name="role" defaultValue="manager" className="border rounded px-2 py-1">
              <option value="owner">Eigenaar</option>
              <option value="manager">Manager</option>
              <option value="staff">Medewerker</option>
            </select>
          </label>
          <button className="hoe-btn-primary !w-auto px-4 py-2">Uitnodigen</button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Huidige admins</h2>
        <ul className="border rounded-2xl divide-y">
          {admins?.map((a) => (
            <li key={a.user_id} className="p-4 flex justify-between items-center">
              <div>
                <div className="font-medium">{emailById.get(a.user_id) ?? a.user_id}</div>
                <div className="text-sm text-gray-600">{a.role}</div>
              </div>
              <form action={removeAdmin}>
                <input type="hidden" name="user_id" value={a.user_id} />
                <button className="text-red-700 underline text-sm">Verwijder</button>
              </form>
            </li>
          ))}
          {(!admins || admins.length === 0) && (
            <li className="p-6 text-gray-500 text-sm">Nog geen admins.</li>
          )}
        </ul>
      </section>

      {invites && invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl">Openstaande uitnodigingen</h2>
          <ul className="border rounded-2xl divide-y">
            {invites.map((i) => (
              <li key={i.email} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{i.email}</div>
                  <div className="text-sm text-gray-600">
                    {i.role} · uitgenodigd {new Date(i.created_at).toLocaleDateString('nl-NL')}
                  </div>
                </div>
                <form action={cancelInvite}>
                  <input type="hidden" name="email" value={i.email} />
                  <button className="text-red-700 underline text-sm">Intrekken</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

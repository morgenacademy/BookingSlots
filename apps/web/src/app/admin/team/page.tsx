import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { inviteTeamMember, removeAdmin, cancelInvite } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function TeamAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  const admin = getSupabaseAdmin();

  const [{ data: admins }, { data: invites }, { data: instructors }, usersList] = await Promise.all([
    supabase.from('studio_admins').select('user_id, role, created_at').eq('studio_id', STUDIO_ID),
    supabase
      .from('studio_admin_invites')
      .select('email, role, created_at')
      .eq('studio_id', STUDIO_ID)
      .order('created_at', { ascending: false }),
    supabase
      .from('instructors')
      .select('id, display_name, user_id, invite_email')
      .eq('studio_id', STUDIO_ID)
      .order('display_name'),
    admin.auth.admin.listUsers(),
  ]);

  const emailById = new Map(
    usersList.data?.users.map((u) => [u.id, u.email ?? '—']) ?? []
  );

  const errMessage = ({
    email: 'Vul een e-mailadres in.',
    name: 'Vul een naam in voor de instructeur.',
    create: 'Aanmaken mislukt — probeer opnieuw.',
  } as Record<string, string>)[sp.err ?? ''];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Team</h1>
        <p className="text-sm text-gray-600 mt-1">
          Voeg admins (volledig beheer) of instructeurs (eigen lessen + deelnemerslijst) toe.
          Iedereen krijgt een magic-link om zelf in te loggen.
        </p>
      </header>

      {sp.ok && <p className="hoe-callout">Uitnodiging verstuurd.</p>}
      {errMessage && <p className="hoe-callout text-red-700">{errMessage}</p>}

      <section className="border rounded-2xl p-6 space-y-3">
        <h2 className="font-display text-xl">Nieuw teamlid uitnodigen</h2>
        <form action={inviteTeamMember} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1 sm:col-span-2">
            Rol
            <select name="role" defaultValue="admin" className="hoe-input w-full">
              <option value="admin">Admin (volledig beheer)</option>
              <option value="instructor">Instructeur (eigen lessen + deelnemers)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            E-mail
            <input name="email" type="email" required className="hoe-input w-full" />
          </label>
          <label className="flex flex-col gap-1">
            Naam <span className="text-xs text-gray-500">(verplicht bij instructeur)</span>
            <input name="display_name" className="hoe-input w-full" />
          </label>
          <div className="sm:col-span-2">
            <button className="hoe-btn-sm">Uitnodigen</button>
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Admins</h2>
        <ul className="border rounded-2xl divide-y">
          {admins?.map((a) => (
            <li key={a.user_id} className="p-4 flex justify-between items-center">
              <div>
                <div className="font-medium">{emailById.get(a.user_id) ?? a.user_id}</div>
                <div className="text-sm text-gray-600">Admin</div>
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

      <section className="space-y-2">
        <div className="flex justify-between items-baseline">
          <h2 className="font-display text-xl">Instructeurs</h2>
          <Link href="/admin/instructors" className="text-sm underline">
            Beheer profielen →
          </Link>
        </div>
        <ul className="border rounded-2xl divide-y">
          {instructors?.map((i) => {
            const status = i.user_id
              ? `gekoppeld aan ${emailById.get(i.user_id) ?? i.user_id}`
              : i.invite_email
                ? `uitnodiging open (${i.invite_email})`
                : 'nog geen login';
            return (
              <li key={i.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{i.display_name}</div>
                  <div className="text-sm text-gray-600">{status}</div>
                </div>
              </li>
            );
          })}
          {(!instructors || instructors.length === 0) && (
            <li className="p-6 text-gray-500 text-sm">Nog geen instructeurs.</li>
          )}
        </ul>
      </section>

      {invites && invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl">Openstaande admin-uitnodigingen</h2>
          <ul className="border rounded-2xl divide-y">
            {invites.map((i) => (
              <li key={i.email} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{i.email}</div>
                  <div className="text-sm text-gray-600">
                    Admin · uitgenodigd {new Date(i.created_at).toLocaleDateString('nl-NL')}
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

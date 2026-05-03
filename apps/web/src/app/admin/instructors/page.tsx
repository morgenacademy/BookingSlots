import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  saveInstructor,
  deleteInstructor,
  inviteInstructor,
  unlinkInstructor,
} from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function InstructorsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string; invited?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  const admin = getSupabaseAdmin();

  const [{ data: items }, usersList] = await Promise.all([
    supabase.from('instructors').select('*').eq('studio_id', STUDIO_ID).order('display_name'),
    admin.auth.admin.listUsers(),
  ]);
  const emailById = new Map(usersList.data?.users.map((u) => [u.id, u.email ?? '—']) ?? []);

  const editing = sp.edit ? items?.find((i) => i.id === sp.edit) : sp.new ? null : undefined;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="font-display text-2xl sm:text-3xl">Instructeurs</h1>
        <Link href="/admin/instructors?new=1" className="hoe-btn-sm">
          + Nieuwe instructeur
        </Link>
      </header>

      {sp.invited && <p className="hoe-callout">Uitnodiging verstuurd / instructeur gekoppeld.</p>}
      {sp.err === 'email' && <p className="hoe-callout text-red-700">E-mail is verplicht voor een nieuwe instructeur — daarmee koppelen we het account.</p>}

      <ul className="border rounded-2xl divide-y">
        {items?.map((i) => {
          const status = i.user_id
            ? `gekoppeld aan ${emailById.get(i.user_id) ?? i.user_id}`
            : i.invite_email
              ? `uitnodiging open (${i.invite_email})`
              : 'nog geen login';
          return (
            <li key={i.id} className="p-4 flex justify-between items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {i.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.photo_url as string} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-medium truncate">{i.display_name}</div>
                  <div className="text-sm text-gray-600 truncate">{status}</div>
                </div>
              </div>
              <div className="flex gap-3 text-sm shrink-0">
                <Link href={`/admin/instructors?edit=${i.id}`} className="underline">Bewerk</Link>
                <form action={deleteInstructor}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="text-red-700 underline">Verwijder</button>
                </form>
              </div>
            </li>
          );
        })}
        {(!items || items.length === 0) && (
          <li className="p-6 text-gray-500 text-sm">Nog geen instructeurs.</li>
        )}
      </ul>

      {editing !== undefined && (
        <section className="border rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="font-display text-xl mb-4">
              {editing ? `Bewerk: ${editing.display_name}` : 'Nieuwe instructeur'}
            </h2>
            <InstructorForm ins={editing ?? null} />
          </div>

          {editing && (
            <div className="border-t pt-6">
              <h3 className="font-display text-lg mb-2">Login</h3>
              {editing.user_id ? (
                <div className="text-sm space-y-2">
                  <p>Gekoppeld aan <strong>{emailById.get(editing.user_id) ?? editing.user_id}</strong>.</p>
                  <form action={unlinkInstructor}>
                    <input type="hidden" name="id" value={String(editing.id)} />
                    <button className="text-sm underline text-red-700">Loskoppelen</button>
                  </form>
                </div>
              ) : (
                <>
                  {editing.invite_email && (
                    <p className="text-sm text-gray-600 mb-2">
                      Open uitnodiging voor <strong>{String(editing.invite_email)}</strong>. Stuur opnieuw of wijzig hieronder.
                    </p>
                  )}
                  <form action={inviteInstructor} className="flex gap-3 items-end flex-wrap text-sm">
                    <input type="hidden" name="id" value={String(editing.id)} />
                    <label className="flex flex-col gap-1 flex-1 min-w-[240px]">
                      E-mail
                      <input name="email" type="email" required
                        defaultValue={(editing.invite_email as string) ?? ''}
                        className="hoe-input w-full" />
                    </label>
                    <button className="hoe-btn-sm">Stuur uitnodiging</button>
                  </form>
                  {sp.err === 'email' && (
                    <p className="hoe-callout text-red-700 mt-2">Vul een e-mailadres in.</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    De instructeur krijgt een magic-link en landt op <code>/instructor</code> na inloggen.
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function InstructorForm({ ins }: { ins: Record<string, unknown> | null }) {
  const v = (k: string) => (ins ? String(ins[k] ?? '') : '');
  const isNew = !ins;
  const photoUrl = ins?.photo_url as string | null | undefined;
  return (
    <form action={saveInstructor} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {ins && <input type="hidden" name="id" value={String(ins.id)} />}
      <label className="flex flex-col gap-1 col-span-2">
        Naam
        <input name="display_name" required defaultValue={v('display_name')}
          className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1 col-span-2">
        E-mail {isNew && <span className="text-red-700">*</span>}
        <input name="email" type="email" required={isNew}
          placeholder={isNew ? 'verplicht voor nieuwe instructeur' : 'leeg laten om koppeling niet te wijzigen'}
          className="hoe-input w-full" />
        <span className="text-xs text-gray-500">
          Bestaat dit e-mailadres al als klant of admin? Dan wordt dat account ook instructeur.
          Anders sturen we een magic-link uitnodiging.
        </span>
      </label>
      <label className="flex flex-col gap-1 col-span-2">
        Bio
        <textarea name="bio" rows={3} defaultValue={v('bio')}
          className="hoe-input w-full" />
      </label>
      <div className="col-span-2 flex items-start gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="w-20 h-20 rounded-full object-cover border" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-200" />
        )}
        <div className="flex-1 space-y-2">
          <label className="flex flex-col gap-1">
            Foto uploaden
            <input name="photo" type="file" accept="image/*" className="text-sm" />
          </label>
          {photoUrl && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" name="remove_photo" />
              Huidige foto verwijderen
            </label>
          )}
        </div>
      </div>
      <div className="col-span-2">
        <button className="hoe-btn-sm">Opslaan</button>
      </div>
    </form>
  );
}

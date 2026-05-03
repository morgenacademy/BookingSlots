'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export async function generateRecurring(formData: FormData) {
  const supabase = await getSupabaseServer();

  const activity_id = String(formData.get('activity_id'));
  const instructor_id = (formData.get('instructor_id') as string) || null;
  const room_id = (formData.get('room_id') as string) || null;
  const capacity = Number(formData.get('capacity'));
  const time = String(formData.get('time')); // "HH:MM"
  const duration = Number(formData.get('duration_minutes'));
  const isOffPeak = formData.get('is_off_peak') === 'on';
  const startDate = new Date(String(formData.get('start_date')));
  const endDate = new Date(String(formData.get('end_date')));

  const dows = formData.getAll('dow').map((d) => Number(d)); // 0=Sun..6=Sat
  if (!dows.length || !activity_id) redirect('/admin/classes/recurring?err=invalid');

  const [hh, mm] = time.split(':').map(Number);
  const rows: Array<{
    studio_id: string;
    activity_id: string;
    instructor_id: string | null;
    room_id: string | null;
    capacity: number;
    starts_at: string;
    ends_at: string;
    is_off_peak: boolean;
  }> = [];

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    if (!dows.includes(d.getDay())) continue;
    const start = new Date(d);
    start.setHours(hh, mm, 0, 0);
    const end = new Date(start.getTime() + duration * 60000);
    rows.push({
      studio_id: STUDIO_ID,
      activity_id,
      instructor_id,
      room_id,
      capacity,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      is_off_peak: isOffPeak,
    });
  }

  if (rows.length) await supabase.from('classes').insert(rows);
  revalidatePath('/admin/classes');
  revalidatePath('/rooster');
  redirect(`/admin/classes?created=${rows.length}`);
}

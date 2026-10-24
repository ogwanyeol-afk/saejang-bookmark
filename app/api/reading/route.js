import { userClient, json } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ?days=7|28 → 그 기간 독서 합계 + 최근 기록, 전체 누적
export async function GET(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const days = Number(new URL(req.url).searchParams.get('days')) === 28 ? 28 : 7;
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error: e } = await supabase.from('reading_sessions').select('id, title, author, minutes, pages, memo, read_at')
    .eq('user_id', user.id).order('read_at', { ascending: false }).limit(300);
  if (e) return json({ error: e.message }, 500);
  const all = data || [];
  const inPeriod = all.filter((r) => r.read_at >= since);
  return json({
    days,
    minutes: inPeriod.reduce((a, r) => a + r.minutes, 0),
    pages: inPeriod.reduce((a, r) => a + (r.pages || 0), 0),
    count: inPeriod.length,
    totalMinutes: all.reduce((a, r) => a + r.minutes, 0),
    sessions: all.slice(0, 50),
  });
}

// 기록하기 { title, author?, minutes, pages?, memo? }
export async function POST(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const b = await req.json().catch(() => ({}));
  const title = String(b.title || '').trim().slice(0, 120);
  const minutes = Math.round(Number(b.minutes));
  if (!title) return json({ error: '읽은 책 제목을 넣어 주세요.' }, 400);
  if (!(minutes >= 1 && minutes <= 240)) return json({ error: '읽은 시간을 확인해 주세요.' }, 400);
  const pages = b.pages == null || b.pages === '' ? null : Math.max(0, Math.min(2000, Math.round(Number(b.pages)) || 0));
  const { data, error: e } = await supabase.from('reading_sessions').insert({
    user_id: user.id, title, author: String(b.author || '').trim().slice(0, 80) || null, minutes, pages,
    memo: String(b.memo || '').trim().slice(0, 200) || null,
  }).select('id, title, author, minutes, pages, memo, read_at').single();
  if (e) return json({ error: e.message }, 500);
  return json({ session: data });
}

// ?id= 기록 지우기
export async function DELETE(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const id = Number(new URL(req.url).searchParams.get('id'));
  const { error: e } = await supabase.from('reading_sessions').delete().eq('id', id).eq('user_id', user.id);
  return e ? json({ error: e.message }, 500) : json({ ok: true });
}

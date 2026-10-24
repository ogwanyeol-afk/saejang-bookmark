import { userClient, json } from '@/lib/supabase-server';
import { computeReport, shelfSpecs } from '@/lib/report';
import { fetchBatch } from '@/lib/books';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const since = new Date(Date.now() - 28 * 864e5).toISOString();
  const [{ data: profile }, { data: signals }, { data: books }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('signals').select('src, text, topic, sub, level, taxq, sensitive, minutes, happened_at')
      .eq('user_id', user.id).gte('happened_at', since).order('happened_at', { ascending: false }).limit(2000),
    supabase.from('book_status').select('title, status').eq('user_id', user.id),
  ]);
  const report = computeReport(signals || [], profile);
  const exclude = (books || []).map((b) => b.title);
  const b2b = !!profile?.b2b;

  // 처방 책(주제별 3권)과 영상 밖의 서가(분야별 3권)를 첫 묶음으로 채움
  const [rxBooks, shelf] = await Promise.all([
    Promise.all(report.rx.filter((r) => !r.consult).map(async (r) => [r.topic, await fetchBatch(`topic:${r.topic}`, 0, exclude, b2b)])),
    Promise.all(shelfSpecs(profile).map(async (s) => ({ ...s, batch: await fetchBatch(s.spec, 0, exclude, b2b) }))),
  ]);
  const byTopic = Object.fromEntries(rxBooks);
  report.rx = report.rx.map((r) => (r.consult ? r : { ...r, spec: `topic:${r.topic}`, batch: byTopic[r.topic] }));
  return json({ report, shelf, read: (books || []).filter((b) => b.status === 'read').map((b) => b.title) });
}

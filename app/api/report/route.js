import { userClient, adminClient, json } from '@/lib/supabase-server';
import { computeReport, shelfSpecs } from '@/lib/report';
import { fetchBatch } from '@/lib/books';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const since = new Date(Date.now() - 28 * 864e5).toISOString();
  const since90 = new Date(Date.now() - 90 * 864e5).toISOString();
  const COLS = 'src, text, topic, sub, level, taxq, sensitive, minutes, happened_at';
  const [{ data: profile }, { data: signals }, { data: yt }, { data: books }, { data: link }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('signals').select(COLS).eq('user_id', user.id).not('src', 'in', '(like,sub)')
      .gte('happened_at', since).order('happened_at', { ascending: false }).limit(2000),
    // 유튜브 연결: 구독 채널(전부) + 좋아요 영상(최근 90일)
    supabase.from('signals').select(COLS).eq('user_id', user.id).or(`src.eq.sub,and(src.eq.like,happened_at.gte.${since90})`).limit(1000),
    supabase.from('book_status').select('title, status').eq('user_id', user.id),
    adminClient().from('youtube_links').select('connected_at, last_sync_at, sub_count, like_count, last_error').eq('user_id', user.id).maybeSingle(),
  ]);
  const report = computeReport([...(signals || []), ...(yt || [])], profile);
  const exclude = (books || []).map((b) => b.title);
  const b2b = !!profile?.b2b;

  // 처방 책(주제별 3권)과 영상 밖의 서가(분야별 3권)를 첫 묶음으로 채움
  const [rxBooks, shelf] = await Promise.all([
    Promise.all(report.rx.filter((r) => !r.consult).map(async (r) => [r.topic, await fetchBatch(`topic:${r.topic}`, 0, exclude, { b2b, age: profile?.age ?? null })])),
    Promise.all(shelfSpecs(profile).map(async (s) => ({ ...s, batch: await fetchBatch(s.spec, 0, exclude, { b2b, age: profile?.age ?? null }) }))),
  ]);
  const byTopic = Object.fromEntries(rxBooks);
  report.rx = report.rx.map((r) => (r.consult ? r : { ...r, spec: `topic:${r.topic}`, batch: byTopic[r.topic] }));
  return json({ report, shelf, youtube: link || null, read: (books || []).filter((b) => b.status === 'read').map((b) => b.title) });
}

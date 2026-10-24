import { userClient, json } from '@/lib/supabase-server';
import { fetchBatch } from '@/lib/books';

export const dynamic = 'force-dynamic';

// "다른 책"으로 3권을 다 봤을 때 다음 묶음. body: { spec:"topic:mkt", batch:1, exclude:[제목…] }
export async function POST(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const b = await req.json().catch(() => ({}));
  if (typeof b.spec !== 'string' || !Number.isInteger(b.batch) || b.batch < 0 || b.batch > 2000) return json({ error: '잘못된 요청입니다.' }, 400);
  const [{ data: prof }, { data: st }] = await Promise.all([
    supabase.from('profiles').select('b2b').eq('id', user.id).maybeSingle(),
    supabase.from('book_status').select('title').eq('user_id', user.id),
  ]);
  const exclude = [...(Array.isArray(b.exclude) ? b.exclude.slice(0, 300).map(String) : []), ...(st || []).map((x) => x.title)];
  const res = await fetchBatch(b.spec, b.batch, exclude, !!prof?.b2b);
  return json(res);
}

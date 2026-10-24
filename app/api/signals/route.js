import { userClient, json } from '@/lib/supabase-server';
import { ingest } from '@/lib/ingest';
import { resolveShared } from '@/lib/resolve';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const { data, error: e } = await supabase.from('signals')
    .select('id, src, text, topic, sub, level, taxq, sensitive, minutes, happened_at')
    .eq('user_id', user.id).order('happened_at', { ascending: false }).limit(300);
  if (e) return json({ error: e.message }, 500);
  return json({ signals: data });
}

// body: { items: [{src, text, happened_at, video_id}] } 또는 { share: {title, text, url} }
export async function POST(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    let items = Array.isArray(body.items) ? body.items : [];
    if (body.share) {
      const r = await resolveShared(body.share);
      items = [{ src: r.src, text: r.text, video_id: r.video_id }];
    }
    const saved = await ingest(supabase, user.id, items);
    return json({ saved });
  } catch (e) {
    return json({ error: '저장하지 못했습니다: ' + e.message }, 500);
  }
}

// ?id=123 하나 삭제, ?all=1 전체 삭제
export async function DELETE(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const sp = new URL(req.url).searchParams;
  let q = supabase.from('signals').delete().eq('user_id', user.id);
  if (!sp.get('all')) q = q.eq('id', Number(sp.get('id')));
  const { error: e } = await q;
  if (e) return json({ error: e.message }, 500);
  return json({ ok: true });
}

import { userClient, json } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const { data } = await supabase.from('consult_requests').select('id, topics, status, created_at')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);
  return json({ requests: data || [] });
}

// body: { topics:[상담 주제 문장], contact? }
export async function POST(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const b = await req.json().catch(() => ({}));
  const topics = (Array.isArray(b.topics) ? b.topics : []).map((t) => String(t).slice(0, 120)).filter(Boolean).slice(0, 8);
  if (!topics.length) return json({ error: '상담 주제를 하나 이상 골라 주세요.' }, 400);
  const since = new Date(Date.now() - 28 * 864e5).toISOString();
  const { data: vids } = await supabase.from('signals').select('text').eq('user_id', user.id).eq('topic', 'tax')
    .gte('happened_at', since).order('happened_at', { ascending: false }).limit(20);
  const { data, error: e } = await supabase.from('consult_requests').insert({
    user_id: user.id, topics, videos: (vids || []).map((v) => v.text),
    contact: b.contact ? String(b.contact).slice(0, 100) : null,
  }).select('id, topics, status, created_at').single();
  if (e) return json({ error: e.message }, 500);
  return json({ request: data });
}

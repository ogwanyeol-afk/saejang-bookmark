import { userClient, json } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// body: { title, author?, action: 'read'|'dismiss'|'undo' }
export async function POST(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const b = await req.json().catch(() => ({}));
  const title = String(b.title || '').trim().slice(0, 200);
  if (!title) return json({ error: '책 제목이 없습니다.' }, 400);
  const q = b.action === 'undo'
    ? supabase.from('book_status').delete().eq('user_id', user.id).eq('title', title)
    : ['read', 'dismiss'].includes(b.action)
      ? supabase.from('book_status').upsert({ user_id: user.id, title, author: b.author ? String(b.author).slice(0, 80) : null, status: b.action })
      : null;
  if (!q) return json({ error: '알 수 없는 동작입니다.' }, 400);
  const { error: e } = await q;
  if (e) return json({ error: e.message }, 500);
  return json({ ok: true });
}

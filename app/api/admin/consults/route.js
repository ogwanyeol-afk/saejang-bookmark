import { userClient, adminClient, isAdmin, json } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function guard(req) {
  const { user, error } = await userClient(req);
  if (error) return { res: json({ error }, 401) };
  if (!isAdmin(user)) return { res: json({ error: '관리자만 볼 수 있습니다.' }, 403) };
  return { db: adminClient() };
}

// 상담 신청 목록: 신청자 업종·단계, 고른 주제, 최근 세금 영상
export async function GET(req) {
  const { db, res } = await guard(req);
  if (res) return res;
  const { data: reqs } = await db.from('consult_requests').select('*').order('created_at', { ascending: false }).limit(200);
  const ids = [...new Set((reqs || []).map((r) => r.user_id))];
  const { data: profs } = ids.length ? await db.from('profiles').select('id, form, industry, stage').in('id', ids) : { data: [] };
  const emails = {};
  for (const id of ids) {
    const { data } = await db.auth.admin.getUserById(id);
    emails[id] = data?.user?.email || '';
  }
  const pm = Object.fromEntries((profs || []).map((p) => [p.id, p]));
  return json({ requests: (reqs || []).map((r) => ({ ...r, email: emails[r.user_id], profile: pm[r.user_id] || null })) });
}

// body: { id, status }
export async function PATCH(req) {
  const { db, res } = await guard(req);
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  if (!['new', 'contacted', 'done'].includes(b.status)) return json({ error: '잘못된 상태입니다.' }, 400);
  const { error } = await db.from('consult_requests').update({ status: b.status }).eq('id', Number(b.id));
  return error ? json({ error: error.message }, 500) : json({ ok: true });
}

import { userClient, adminClient, isAdmin, json } from '@/lib/supabase-server';
import { DEFAULT_TIPS } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
const CATS = ['gen', 'gen_corp', 'mkt', 'mkt_b2b', 'sales', 'money', 'money_corp', 'staff'];

async function guard(req) {
  const { user, error } = await userClient(req);
  if (error) return { res: json({ error }, 401) };
  if (!isAdmin(user)) return { res: json({ error: '관리자만 쓸 수 있습니다.' }, 403) };
  return { db: adminClient() };
}

export async function GET(req) {
  const { db, res } = await guard(req);
  if (res) return res;
  const { data } = await db.from('tips').select('*').order('cat').order('id');
  return json({ tips: data || [], defaults: DEFAULT_TIPS, cats: CATS });
}

// body: { cat, text } 추가 · { importDefaults:true } 기본 팁을 DB로 복사
export async function POST(req) {
  const { db, res } = await guard(req);
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  if (b.importDefaults) {
    const { error } = await db.from('tips').insert(DEFAULT_TIPS.map(({ cat, text }) => ({ cat, text })));
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (!CATS.includes(b.cat) || !String(b.text || '').trim()) return json({ error: '분류와 문구를 입력해 주세요.' }, 400);
  const { data, error } = await db.from('tips').insert({ cat: b.cat, text: String(b.text).trim().slice(0, 300) }).select().single();
  return error ? json({ error: error.message }, 500) : json({ tip: data });
}

// body: { id, text?, active? }
export async function PATCH(req) {
  const { db, res } = await guard(req);
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const p = {};
  if (typeof b.text === 'string' && b.text.trim()) p.text = b.text.trim().slice(0, 300);
  if (typeof b.active === 'boolean') p.active = b.active;
  const { error } = await db.from('tips').update(p).eq('id', Number(b.id));
  return error ? json({ error: error.message }, 500) : json({ ok: true });
}

export async function DELETE(req) {
  const { db, res } = await guard(req);
  if (res) return res;
  const id = Number(new URL(req.url).searchParams.get('id'));
  const { error } = await db.from('tips').delete().eq('id', id);
  return error ? json({ error: error.message }, 500) : json({ ok: true });
}

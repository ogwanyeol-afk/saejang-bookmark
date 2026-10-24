import { userClient, json } from '@/lib/supabase-server';
import { DEFAULT_TIPS } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

// 관리자가 등록한 팁이 있으면 그 분류는 DB 팁만, 없는 분류는 기본 팁
export async function GET(req) {
  const { supabase, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const { data } = await supabase.from('tips').select('id, cat, text').eq('active', true).limit(500);
  const db = data || [];
  const cats = new Set(db.map((t) => t.cat));
  return json({ tips: [...db, ...DEFAULT_TIPS.filter((t) => !cats.has(t.cat))] });
}

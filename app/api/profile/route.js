import { userClient, isAdmin, json } from '@/lib/supabase-server';
import { GENRES, GAPS, industryByName, cleanAuthorName, MAX_AUTHORS } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
const OLD = 'consent_at, form, industry, industry_word, b2b, stage, age, genres, gaps, onboarded_at, share_token, exclude_sensitive';
const MID = 'consent_at, age14_at, persona, form, industry, industry_word, b2b, stage, age, genres, gaps, onboarded_at, share_token, exclude_sensitive';
const COLS = 'consent_at, age14_at, persona, authors, form, industry, industry_word, b2b, stage, age, genres, gaps, onboarded_at, share_token, exclude_sensitive';

export async function GET(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  let { data, error: e } = await supabase.from('profiles').select(COLS).eq('id', user.id).maybeSingle();
  let cols = COLS;
  if (e && /authors/.test(e.message)) { cols = MID; ({ data, error: e } = await supabase.from('profiles').select(MID).eq('id', user.id).maybeSingle()); } // 004 마이그레이션 전
  if (e && /persona|age14/.test(e.message)) { cols = OLD; ({ data } = await supabase.from('profiles').select(OLD).eq('id', user.id).maybeSingle()); } // 003 마이그레이션 전
  if (!data) data = (await supabase.from('profiles').insert({ id: user.id }).select(cols).single()).data;
  return json({ profile: data, email: user.email, admin: isAdmin(user) });
}

// body: consent, age14, persona, authors, form, industry, stage, age, genres, gaps, onboarded, exclude_sensitive, newShareToken
export async function PATCH(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const b = await req.json().catch(() => ({}));
  const p = {};
  if (b.consent === true) p.consent_at = new Date().toISOString();
  if (b.age14 === true) p.age14_at = new Date().toISOString();
  if (['worker', 'indiv', 'corp', 'pre', 'free', 'student', 'home', 'senior'].includes(b.persona)) {
    p.persona = b.persona;
    p.form = ['indiv', 'corp', 'pre'].includes(b.persona) ? b.persona : null; // 사업자만 사업 형태
    if (!p.form) { p.industry = null; p.industry_word = null; p.b2b = false; }
  }
  if (['indiv', 'corp', 'pre'].includes(b.form)) p.form = b.form;
  if (typeof b.industry === 'string' && b.industry.trim()) {
    const name = b.industry.trim().slice(0, 40);
    const known = industryByName(name);
    p.industry = name; p.industry_word = known?.word || name; p.b2b = !!known?.b2b;
  }
  if (Number.isInteger(b.stage) && b.stage >= 0 && b.stage <= 3) p.stage = b.stage;
  if (b.age === null || (Number.isInteger(b.age) && b.age >= 0 && b.age <= 5)) p.age = b.age;
  if (Array.isArray(b.genres)) p.genres = [...new Set(b.genres.filter((g) => GENRES[g]))].slice(0, 15);
  if (Array.isArray(b.authors)) p.authors = [...new Set(b.authors.map(cleanAuthorName).filter((a) => a.length >= 2))].slice(0, MAX_AUTHORS);
  if (Array.isArray(b.gaps)) p.gaps = b.gaps.filter((g) => GAPS[g]).slice(0, 3);
  if (b.onboarded === true) p.onboarded_at = new Date().toISOString();
  if (typeof b.exclude_sensitive === 'boolean') p.exclude_sensitive = b.exclude_sensitive;
  if (b.newShareToken) p.share_token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  let { data, error: e } = await supabase.from('profiles').upsert({ id: user.id, ...p }).select(COLS).single();
  if (e && /authors/.test(e.message)) { // 004 마이그레이션 전: 작가 없이 저장
    delete p.authors;
    ({ data, error: e } = await supabase.from('profiles').upsert({ id: user.id, ...p }).select(MID).single());
  }
  if (e) return json({ error: e.message }, 500);
  return json({ profile: data });
}

import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 로그인한 사용자 권한으로 동작하는 클라이언트(행 수준 보안 적용)
export async function userClient(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: '로그인이 필요합니다.' };
  const supabase = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
  return { supabase, user: data.user };
}

// 크론 전용: 모든 사용자 데이터에 접근(서버에서만 사용)
export function adminClient() {
  return createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export const json = (data, status = 200) => Response.json(data, { status });

// 관리자 여부: ADMIN_EMAILS(쉼표 구분)에 로그인 이메일이 있으면 관리자
export function isAdmin(user) {
  const list = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return !!user?.email && list.includes(user.email.toLowerCase());
}

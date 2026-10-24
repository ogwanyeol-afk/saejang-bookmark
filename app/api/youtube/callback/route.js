import { adminClient } from '@/lib/supabase-server';
import { readState, exchangeCode } from '@/lib/youtube-link';

export const dynamic = 'force-dynamic';

// 구글 동의 후 돌아오는 곳: 토큰 저장 → 앱으로 돌아가 분석 시작
export async function GET(req) {
  const u = new URL(req.url);
  const back = (q) => Response.redirect(`${u.origin}/?tab=report&yt=${q}`, 302);
  if (u.searchParams.get('error')) return back('denied');
  const userId = await readState(u.searchParams.get('state'));
  if (!userId) return back('expired');
  try {
    const t = await exchangeCode(u.origin, u.searchParams.get('code'));
    if (!String(t.scope || '').includes('youtube')) return back('noscope');
    const db = adminClient();
    const { data: old } = await db.from('youtube_links').select('refresh_token').eq('user_id', userId).maybeSingle();
    const refresh = t.refresh_token || old?.refresh_token;
    if (!refresh) return back('norefresh');
    const { error } = await db.from('youtube_links').upsert({ user_id: userId, refresh_token: refresh, connected_at: new Date().toISOString(), last_error: null });
    if (error) throw new Error(error.message);
    return back('connected');
  } catch (e) {
    console.error('youtube callback', e.message);
    return back('error');
  }
}

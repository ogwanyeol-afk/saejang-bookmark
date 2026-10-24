import { userClient, adminClient, json } from '@/lib/supabase-server';
import { ytConfigured, makeState, authUrl, syncYouTube, revoke } from '@/lib/youtube-link';

export const dynamic = 'force-dynamic';

// 유튜브 연결 시작 → 구글 동의 화면 주소
export async function POST(req) {
  const { user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  if (!ytConfigured()) return json({ error: '유튜브 연결이 아직 준비되지 않았습니다(관리자 설정 필요).' }, 503);
  const origin = new URL(req.url).origin;
  return json({ url: authUrl(origin, await makeState(user.id), user.email) });
}

// 지금 다시 분석(구독·좋아요 다시 읽기)
export async function PUT(req) {
  const { user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const db = adminClient();
  const { data: link } = await db.from('youtube_links').select('last_sync_at').eq('user_id', user.id).maybeSingle();
  if (!link) return json({ error: '유튜브가 연결되어 있지 않습니다.' }, 400);
  if (link.last_sync_at && Date.now() - Date.parse(link.last_sync_at) < 60e3) return json({ error: '방금 분석했어요. 1분 뒤에 다시 시도해 주세요.' }, 429);
  try { return json(await syncYouTube(db, user.id)); }
  catch (e) { return json({ error: e.message }, 502); }
}

// 연결 끊기: 구글 권한 취소 + 구독·좋아요 기록 삭제
export async function DELETE(req) {
  const { user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const db = adminClient();
  const { data: link } = await db.from('youtube_links').select('refresh_token').eq('user_id', user.id).maybeSingle();
  if (link) await revoke(link.refresh_token);
  await db.from('youtube_links').delete().eq('user_id', user.id);
  await db.from('signals').delete().eq('user_id', user.id).in('src', ['like', 'sub']);
  return json({ ok: true });
}

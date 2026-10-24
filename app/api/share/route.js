import { adminClient, json } from '@/lib/supabase-server';
import { ingest } from '@/lib/ingest';
import { resolveShared } from '@/lib/resolve';
import { topicName, taxqByKey } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

// iOS 단축어용: 로그인 대신 개인 공유 토큰으로 인증. POST { token, url?, text?, title? }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  if (token.length < 20) return json({ message: '공유 토큰이 없습니다. 사장님 책갈피 설정에서 단축어를 다시 설치해 주세요.' }, 401);

  const admin = adminClient();
  const { data: prof } = await admin.from('profiles').select('id, consent_at, b2b').eq('share_token', token).maybeSingle();
  if (!prof) return json({ message: '공유 토큰이 맞지 않습니다. 설정에서 새 토큰으로 단축어를 다시 설치해 주세요.' }, 401);
  if (!prof.consent_at) return json({ message: '사장님 책갈피 앱에서 데이터 수집 동의를 먼저 해 주세요.' }, 403);

  const r = await resolveShared({ title: body.title, text: body.text, url: body.url });
  if (!r.text) return json({ message: '분석할 제목이나 링크가 없습니다.' }, 400);
  try {
    const [s] = await ingest(admin, prof.id, [{ src: r.src, text: r.text, video_id: r.video_id }]);
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const { count } = await admin.from('signals').select('id', { count: 'exact', head: true })
      .eq('user_id', prof.id).eq('topic', s.topic).gte('happened_at', since);
    const tq = s.taxq && taxqByKey(s.taxq);
    const message = s.sensitive ? `"${s.text}" 저장됨 · 민감 주제라 추천에는 쓰지 않습니다`
      : s.topic === 'other' ? `"${s.text}" 저장됨`
      : tq ? `이번 주 세금 영상 ${count}번째 · 상담 주제에 추가: ${tq.q}`
      : `이번 주 ${topicName(s.topic, prof.b2b)} 영상 ${count}번째예요`;
    return json({ message });
  } catch (e) {
    return json({ message: '저장 중 오류가 났습니다: ' + e.message }, 500);
  }
}

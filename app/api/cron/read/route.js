import { adminClient, json } from '@/lib/supabase-server';
import { sendPush } from '@/lib/push';

export const dynamic = 'force-dynamic';

const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`);

// 매주 수요일 15:00(한국시간): "AI에게 일 맡기셨으면 그동안 10분 읽기" 알림
export async function GET(req) {
  if (process.env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'unauthorized' }, 401);
  }
  const db = adminClient();
  const { data: subs } = await db.from('push_subscriptions').select('endpoint, user_id, subscription');
  const users = [...new Set((subs || []).map((s) => s.user_id))];
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data: reads } = users.length
    ? await db.from('reading_sessions').select('user_id, title, minutes, read_at').in('user_id', users).order('read_at', { ascending: false }).limit(5000)
    : { data: [] };
  let sent = 0;
  for (const s of subs || []) {
    const mine = (reads || []).filter((r) => r.user_id === s.user_id);
    const week = mine.filter((r) => r.read_at >= since).reduce((a, r) => a + r.minutes, 0);
    const last = mine[0]?.title;
    const res = await sendPush(s.subscription, {
      title: 'AI가 일하는 동안 10분 읽어볼까요?',
      body: `이번 주 독서 ${hm(week)}.${last ? ` 『${last}』 다음 꼭지가 기다려요.` : ' 유튜브 대신 책 한 꼭지가 사업을 키웁니다.'}`,
      url: '/?tab=report&read=1', tag: 'reading-nudge',
    });
    if (res === 'gone') await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    if (res === 'ok') sent++;
  }
  return json({ subs: (subs || []).length, sent });
}

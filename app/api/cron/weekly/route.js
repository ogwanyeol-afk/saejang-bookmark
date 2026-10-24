import { adminClient, json } from '@/lib/supabase-server';
import { computeReport } from '@/lib/report';
import { sendPush } from '@/lib/push';

export const dynamic = 'force-dynamic';

const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`);

// 매주 일요일 20:00(한국시간) Cloudflare Cron Trigger(worker.js)가 호출: 주간 리포트 알림 + 세금 영상이 3개 이상이면 상담 알림
export async function GET(req) {
  if (process.env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'unauthorized' }, 401);
  }
  const db = adminClient();
  const { data: subs } = await db.from('push_subscriptions').select('endpoint, user_id, subscription');
  const byUser = new Map();
  for (const s of subs || []) byUser.set(s.user_id, [...(byUser.get(s.user_id) || []), s]);
  const since = new Date(Date.now() - 28 * 864e5).toISOString();
  let sent = 0, skipped = 0;

  for (const [userId, list] of byUser) {
    const [{ data: prof }, { data: signals }, { data: reads }] = await Promise.all([
      db.from('profiles').select('*').eq('id', userId).maybeSingle(),
      db.from('signals').select('src, text, topic, sub, level, taxq, sensitive, minutes, happened_at').eq('user_id', userId).gte('happened_at', since).limit(2000),
      db.from('reading_sessions').select('minutes').eq('user_id', userId).gte('read_at', new Date(Date.now() - 7 * 864e5).toISOString()),
    ]);
    const readMin = (reads || []).reduce((a, x) => a + x.minutes, 0);
    if (!prof?.consent_at) { skipped++; continue; }
    const r = computeReport(signals || [], prof);
    if (!r.top) { skipped++; continue; }
    const payloads = [{
      title: '이번 주 리포트가 도착했어요',
      body: `유튜브 ${hm(r.total)} · 독서 ${hm(readMin)} · ${r.top.name} 영상 ${r.top.n}개${r.top.repeats ? ` 중 ${r.top.repeats}개는 같은 얘기였어요` : ''}`,
      url: '/?tab=report', tag: 'weekly-report',
    }];
    const tax = r.topics.find((t) => t.topic === 'tax');
    if (tax && tax.n >= 3) payloads.push({
      title: `세금 영상 ${tax.n}개 보셨네요`,
      body: `"${r.agenda[0]?.q || '세금 고민'}" 등 궁금하신 내용을 정리했어요. 세무사가 직접 답해 드릴게요.`,
      url: '/?tab=tax', tag: 'weekly-tax',
    });
    for (const s of list) for (const p of payloads) {
      const res = await sendPush(s.subscription, p);
      if (res === 'gone') { await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint); break; }
      if (res === 'ok') sent++;
    }
    await db.from('profiles').update({ last_report_at: new Date().toISOString() }).eq('id', userId);
  }
  return json({ users: byUser.size, sent, skipped });
}

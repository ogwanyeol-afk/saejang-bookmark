import { userClient, json } from '@/lib/supabase-server';
import { sendPush } from '@/lib/push';

export const dynamic = 'force-dynamic';

// 구독 저장. body: { subscription, test?: true }
export async function POST(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const { subscription, test } = await req.json().catch(() => ({}));
  if (!subscription?.endpoint) return json({ error: '알림 구독 정보가 없습니다.' }, 400);
  const { error: e } = await supabase.from('push_subscriptions')
    .upsert({ endpoint: subscription.endpoint, user_id: user.id, subscription });
  if (e) return json({ error: e.message }, 500);
  if (test) {
    await sendPush(subscription, { title: '사장님 책갈피', body: '알림이 켜졌습니다. 매주 일요일 저녁 8시에 리포트를 보내드릴게요.', url: '/' });
  }
  return json({ ok: true });
}

export async function DELETE(req) {
  const { supabase, user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const { error: e } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
  if (e) return json({ error: e.message }, 500);
  return json({ ok: true });
}

import { buildPushPayload } from '@block65/webcrypto-web-push';

// 웹 푸시 발송(Web Crypto 사용 · Cloudflare Workers에서 동작)
// 반환: 'ok' | 'gone'(만료된 구독, 삭제 필요) | 'error'
export async function sendPush(subscription, payload) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return 'error';
  try {
    const req = await buildPushPayload(
      { data: JSON.stringify(payload), options: { ttl: 60 * 60 * 12 } },
      subscription,
      { subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com', publicKey: pub, privateKey: priv },
    );
    const res = await fetch(subscription.endpoint, req);
    if (res.status === 404 || res.status === 410) return 'gone';
    if (!res.ok) { console.error('push failed', res.status, (await res.text()).slice(0, 200)); return 'error'; }
    return 'ok';
  } catch (e) {
    console.error('push failed', e.message);
    return 'error';
  }
}

// 유튜브 연결: 이용자가 한 번 동의하면 구독 채널과 좋아요 표시한 영상을 읽어 관심 주제를 분석합니다.
// (유튜브는 2016년부터 시청 기록을 API로 내주지 않아, 구독·좋아요를 관심 신호로 씁니다)
// 권한: youtube.readonly (읽기 전용) · 토큰은 서버(youtube_links)에만 보관
import { ingest } from './ingest';

const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const YT = 'https://www.googleapis.com/youtube/v3';
const MAX_PAGES = 4; // 구독·좋아요 각각 최대 200개

export const ytConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const secret = () => process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev';
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

async function hmac(text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}

/** 로그인한 이용자 id를 담은 10분짜리 서명 값(OAuth state) */
export async function makeState(userId) {
  const body = b64u(new TextEncoder().encode(JSON.stringify({ u: userId, e: Date.now() + 600e3 })));
  return `${body}.${await hmac(body)}`;
}
export async function readState(state) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig || sig !== await hmac(body)) return null;
  try { const p = JSON.parse(fromB64u(body)); return p.e > Date.now() ? p.u : null; } catch { return null; }
}

export const callbackUrl = (origin) => `${origin}/api/youtube/callback`;

export function authUrl(origin, state, email) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: callbackUrl(origin), response_type: 'code', scope: SCOPE,
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state, ...(email ? { login_hint: email } : {}),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function token(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_description || j.error || `구글 토큰 오류 ${res.status}`);
  return j;
}
export const exchangeCode = (origin, code) => token({ grant_type: 'authorization_code', code, redirect_uri: callbackUrl(origin) });
const accessFrom = async (refresh) => (await token({ grant_type: 'refresh_token', refresh_token: refresh })).access_token;

export async function revoke(refresh) {
  try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST' }); } catch {}
}

async function pages(url, access) {
  const out = [];
  let pageToken = '';
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await fetch(`${url}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: { Authorization: `Bearer ${access}` } });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = j.error?.errors?.[0]?.reason || '';
      const e = new Error(j.error?.message || `유튜브 API 오류 ${res.status}`);
      e.reason = reason; e.status = res.status;
      throw e;
    }
    out.push(...(j.items || []));
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return out;
}

/** 구독 채널 [{text, happened_at}] */
async function subscriptions(access) {
  const items = await pages(`${YT}/subscriptions?part=snippet&mine=true&order=relevance`, access);
  return items.map((it) => ({
    src: 'sub',
    text: `${it.snippet?.title || ''} (구독 채널) ${String(it.snippet?.description || '').slice(0, 80)}`,
    happened_at: it.snippet?.publishedAt,
  })).filter((x) => x.text.length > 8);
}

/** 좋아요 표시한 영상 [{text, video_id, happened_at=좋아요 누른 때}] */
async function likes(access) {
  let items;
  try {
    items = await pages(`${YT}/playlistItems?part=snippet&playlistId=LL`, access);
    return items.map((it) => ({ src: 'like', text: it.snippet?.title, video_id: it.snippet?.resourceId?.videoId, happened_at: it.snippet?.publishedAt }))
      .filter((x) => x.text && x.text !== 'Private video' && x.text !== 'Deleted video');
  } catch (e) {
    if (e.status !== 404 && e.status !== 403) throw e;
    // 좋아요 목록을 비공개 재생목록으로 못 읽는 계정: 좋아요 영상 목록으로 대신(누른 시각은 없음)
    items = await pages(`${YT}/videos?part=snippet&myRating=like`, access);
    return items.map((it) => ({ src: 'like', text: it.snippet?.title, video_id: it.id, happened_at: new Date().toISOString() }));
  }
}

/**
 * 구독은 현재 목록으로 교체, 좋아요는 새로 생긴 것만 추가.
 * db = 서버 전용 클라이언트(service role)
 */
export async function syncYouTube(db, userId) {
  const { data: link } = await db.from('youtube_links').select('refresh_token').eq('user_id', userId).maybeSingle();
  if (!link) return { skipped: true };
  try {
    const access = await accessFrom(link.refresh_token);
    const [subs, liked] = await Promise.all([subscriptions(access), likes(access)]);
    const { data: had } = await db.from('signals').select('video_id').eq('user_id', userId).eq('src', 'like').not('video_id', 'is', null).limit(5000);
    const seen = new Set((had || []).map((x) => x.video_id));
    const fresh = liked.filter((x) => !x.video_id || !seen.has(x.video_id));
    await db.from('signals').delete().eq('user_id', userId).eq('src', 'sub');
    const saved = await ingest(db, userId, [...subs, ...fresh].slice(0, 400));
    await db.from('youtube_links').update({ last_sync_at: new Date().toISOString(), sub_count: subs.length, like_count: seen.size + fresh.length, last_error: null }).eq('user_id', userId);
    return { subs: subs.length, likes: liked.length, added: saved.length };
  } catch (e) {
    const msg = /invalid_grant/i.test(e.message) ? '유튜브 연결이 해제되었거나 만료되었습니다. 다시 연결해 주세요.' : e.message;
    await db.from('youtube_links').update({ last_error: msg.slice(0, 200) }).eq('user_id', userId);
    throw new Error(msg);
  }
}

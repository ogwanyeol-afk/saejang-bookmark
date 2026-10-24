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

// 채널 소개글의 연락처·광고 문의 같은 줄은 분석을 흐리므로 지움
const cleanDesc = (d) => String(d || '').split('\n')
  .filter((l) => !/(문의|협찬|광고|비즈니스|business|contact|e-?mail|메일|@|https?:|인스타|instagram|블로그|blog|facebook|틱톡|tiktok|카카오|후원|멤버십)/i.test(l))
  .join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
// 유튜브 분야(위키 주제) → 한국어 힌트
const TOPIC_KO = { Music: '음악', Entertainment: '예능', 'Video_game_culture': '게임', Sport: '스포츠', Film: '영화', Humour: '코미디', Television_program: '방송',
  Knowledge: '지식', Society: '사회', Politics: '정치·시사', Business: '경영·경제', Technology: '기술·IT', Health: '건강', Physical_fitness: '운동', Food: '요리',
  Tourism: '여행', Pet: '반려동물', Lifestyle_: '생활', Hobby: '취미', Fashion: '패션', Religion: '종교', Military: '군사', Vehicle: '자동차' };
const topicKo = (urls) => [...new Set((urls || []).map((u) => { const k = u.split('/').pop(); return TOPIC_KO[k] || Object.entries(TOPIC_KO).find(([w]) => k.startsWith(w))?.[1]; }).filter(Boolean))].join('·');
// 유튜브 영상 분류 번호 → 한국어
const CAT = { 1: '영화', 2: '자동차', 10: '음악', 15: '반려동물', 17: '스포츠', 19: '여행', 20: '게임', 22: '일상', 23: '코미디', 24: '예능', 25: '뉴스·시사', 26: '노하우·생활', 27: '교육', 28: '과학·기술', 29: '사회 활동' };

async function details(url, ids, access) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const res = await fetch(`${url}&id=${part.join(',')}`, { headers: { Authorization: `Bearer ${access}` } });
    const j = await res.json().catch(() => ({}));
    for (const it of j.items || []) out[it.id] = it;
  }
  return out;
}

/** 구독 채널: 채널 이름 + (분석용 힌트) 유튜브 분야·채널 키워드·정리한 소개 */
async function subscriptions(access) {
  const items = await pages(`${YT}/subscriptions?part=snippet&mine=true&order=relevance`, access);
  const ids = items.map((it) => it.snippet?.resourceId?.channelId).filter(Boolean);
  const ch = await details(`${YT}/channels?part=snippet,topicDetails,brandingSettings`, ids, access).catch(() => ({}));
  return items.map((it) => {
    const id = it.snippet?.resourceId?.channelId, c = ch[id] || {};
    const kw = String(c.brandingSettings?.channel?.keywords || '').replace(/"/g, '').slice(0, 80);
    const topics = topicKo(c.topicDetails?.topicCategories);
    return {
      src: 'sub',
      text: `${it.snippet?.title || ''} (구독 채널)`,
      hint: [topics && `[분야: ${topics}]`, kw && `키워드: ${kw}`, cleanDesc(c.snippet?.description || it.snippet?.description)].filter(Boolean).join(' '),
      happened_at: it.snippet?.publishedAt,
    };
  }).filter((x) => x.text.length > 8);
}

/** 좋아요 표시한 영상: 제목 + (분석용 힌트) 유튜브 분류·태그·채널명 */
async function likes(access) {
  let list;
  try {
    const items = await pages(`${YT}/playlistItems?part=snippet&playlistId=LL`, access);
    list = items.map((it) => ({ src: 'like', text: it.snippet?.title, video_id: it.snippet?.resourceId?.videoId, happened_at: it.snippet?.publishedAt, ch: it.snippet?.videoOwnerChannelTitle }))
      .filter((x) => x.text && x.text !== 'Private video' && x.text !== 'Deleted video');
  } catch (e) {
    if (e.status !== 404 && e.status !== 403) throw e;
    const items = await pages(`${YT}/videos?part=snippet&myRating=like`, access);
    list = items.map((it) => ({ src: 'like', text: it.snippet?.title, video_id: it.id, happened_at: new Date().toISOString(), ch: it.snippet?.channelTitle }));
  }
  const v = await details(`${YT}/videos?part=snippet`, list.map((x) => x.video_id).filter(Boolean), access).catch(() => ({}));
  return list.map(({ ch, ...x }) => {
    const sn = v[x.video_id]?.snippet || {};
    const cat = CAT[sn.categoryId];
    return { ...x, hint: [cat && `[분야: ${cat}]`, (sn.tags || []).slice(0, 6).map((t) => `#${t}`).join(' '), ch && `채널: ${ch}`].filter(Boolean).join(' ') };
  });
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
    // 구독·좋아요 모두 현재 목록으로 다시 분석(분석 방식이 좋아지면 지난 기록도 같이 바로잡힘)
    const saved = await ingest(db, userId, [...liked.slice(0, 200), ...subs.slice(0, 200)]);
    const keep = saved.map((x) => x.id).filter(Boolean);
    let del = db.from('signals').delete().eq('user_id', userId).in('src', ['sub', 'like']);
    if (keep.length) del = del.not('id', 'in', `(${keep.join(',')})`);
    await del;
    await db.from('youtube_links').update({ last_sync_at: new Date().toISOString(), sub_count: subs.length, like_count: liked.length, last_error: null }).eq('user_id', userId);
    return { subs: subs.length, likes: liked.length, added: saved.length };
  } catch (e) {
    const msg = /invalid_grant/i.test(e.message) ? '유튜브 연결이 해제되었거나 만료되었습니다. 다시 연결해 주세요.' : e.message;
    await db.from('youtube_links').update({ last_error: msg.slice(0, 200) }).eq('user_id', userId);
    throw new Error(msg);
  }
}

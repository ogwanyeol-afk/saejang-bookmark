// 공유로 들어온 링크를 사람이 읽는 제목으로 바꿉니다.
// 유튜브: oEmbed로 영상 제목 / 그 외: 페이지의 og:title 또는 <title>
const YT = /(youtube\.com|youtu\.be)/i;

function safeUrl(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return null;
    const h = url.hostname;
    if (h === 'localhost' || /^[\d.]+$/.test(h) || h.includes(':') || h.endsWith('.local') || h.endsWith('.internal')) return null;
    return url;
  } catch { return null; }
}

async function fetchWithTimeout(url, ms = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (bookpick share resolver)' } });
  } finally { clearTimeout(t); }
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

export function youtubeId(u) {
  const m = String(u || '').match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function extractUrl(...parts) {
  for (const p of parts) {
    const m = String(p || '').match(/https?:\/\/[^\s]+/);
    if (m) return m[0];
  }
  return null;
}

export async function resolveShared({ title = '', text = '', url = '' }) {
  const link = url || extractUrl(text, title);
  const plain = [title, String(text).replace(/https?:\/\/[^\s]+/g, '')].map((s) => s.trim()).filter(Boolean).join(' ');
  const u = link && safeUrl(link);
  if (!u) return { text: plain, url: link, src: 'share' };

  try {
    if (YT.test(u.hostname)) {
      const r = await fetchWithTimeout(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.href)}`);
      if (r.ok) {
        const j = await r.json();
        return { text: j.title || plain, url: u.href, src: 'yt', channel: j.author_name, video_id: youtubeId(u.href) };
      }
    } else {
      const r = await fetchWithTimeout(u.href);
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.includes('text/html')) {
        const html = (await r.text()).slice(0, 200000);
        const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
        const tt = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const found = og?.[1] || tt?.[1];
        if (found) return { text: decode(found), url: u.href, src: 'share' };
      }
    }
  } catch (e) {
    console.error('resolve failed', e?.message);
  }
  return { text: plain || u.href, url: u.href, src: 'share' };
}

// YouTube Data API로 영상 길이(분)를 가져옵니다. 키가 없으면 빈 결과(평균값으로 계산).
// videos.list 는 영상 50개당 1 단위만 써서 무료 할당량으로 충분합니다.
const iso = (d) => {
  const m = String(d || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const [, D, H, M, S] = m.map((x) => Number(x) || 0);
  return Math.round((D * 1440 + H * 60 + M + S / 60) * 10) / 10;
};

export async function videoMinutes(ids) {
  const key = process.env.YOUTUBE_API_KEY;
  const uniq = [...new Set(ids.filter(Boolean))];
  const out = {};
  if (!key || !uniq.length) return out;
  for (let i = 0; i < uniq.length; i += 50) {
    const part = uniq.slice(i, i + 50);
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${part.join(',')}&key=${key}`);
      const j = await res.json();
      for (const it of j.items || []) {
        const m = iso(it.contentDetails?.duration);
        if (m) out[it.id] = m;
      }
    } catch (e) {
      console.error('youtube duration failed', e?.message);
    }
  }
  return out;
}

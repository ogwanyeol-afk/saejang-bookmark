import { classifyMany } from './classify';
import { videoMinutes } from './youtube';

const SRCS = new Set(['yt', 'search', 'share', 'image', 'like', 'sub']);

// items: [{src, text, happened_at?, video_id?}] → 분류·영상 길이 조회 후 저장
export async function ingest(supabase, userId, items) {
  const clean = items
    .map((it) => ({
      src: SRCS.has(it.src) ? it.src : 'share',
      text: String(it.text || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      video_id: /^[\w-]{11}$/.test(it.video_id || '') ? it.video_id : null,
      happened_at: it.happened_at && !isNaN(Date.parse(it.happened_at)) ? new Date(it.happened_at).toISOString() : new Date().toISOString(),
    }))
    .filter((it) => it.text.length >= 2)
    .slice(0, 400);
  if (!clean.length) return [];

  const [cls, mins] = await Promise.all([
    classifyMany(clean.map((c) => c.text)),
    videoMinutes(clean.map((c) => c.video_id)),
  ]);
  const rows = clean.map((c, i) => ({ user_id: userId, ...c, minutes: c.video_id ? mins[c.video_id] ?? null : null, ...cls[i] }));
  const { data, error } = await supabase.from('signals').insert(rows)
    .select('id, src, text, topic, sub, level, taxq, sensitive, minutes, happened_at');
  if (error) throw new Error(error.message);
  return data;
}

'use client';
import { api } from './supabase-browser';
import { youtubeId } from './resolve';

// 구글 테이크아웃 JSON(내 활동: watch-history.json / search-history.json)에서 최근 4주 기록 추출
export function parseTakeout(arr) {
  const since = Date.now() - 28 * 864e5;
  const out = [];
  for (const it of arr) {
    if (!it || typeof it.title !== 'string') continue;
    const ts = Date.parse(it.time);
    if (ts && ts < since) continue;
    let t = it.title, src = 'yt';
    if (/검색했습니다|^Searched for /.test(t)) {
      src = 'search';
      t = t.replace(/^Searched for /, '').replace(/\s*을\(를\) 검색했습니다\.?$/, '');
    } else {
      t = t.replace(/^Watched /, '').replace(/\s*을\(를\) 시청했습니다\.?$/, '').replace(/\s*을\(를\) 시청함\.?$/, '');
    }
    if (/^https?:\/\//.test(t) || t.length < 2) continue;
    out.push({ src, text: t, happened_at: it.time, video_id: youtubeId(it.titleUrl) });
  }
  return out.slice(0, 600);
}

export async function uploadTakeout(file, onProgress) {
  let arr;
  try { arr = JSON.parse(await file.text()); } catch { throw new Error('JSON 파일이 아닙니다. 테이크아웃에서 형식을 JSON으로 선택해 주세요'); }
  if (!Array.isArray(arr)) throw new Error('유튜브 기록 파일(watch-history.json)이 아닙니다');
  const items = parseTakeout(arr);
  if (!items.length) throw new Error('최근 4주 안의 시청·검색 기록을 찾지 못했습니다');
  let n = 0;
  for (let i = 0; i < items.length; i += 80) {
    const { saved } = await api('/api/signals', { method: 'POST', body: { items: items.slice(i, i + 80) } });
    n += saved.length;
    onProgress?.(n, items.length);
  }
  return n;
}

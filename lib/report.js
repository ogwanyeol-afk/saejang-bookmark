// 주간 리포트 계산 (서버·테스트 공용, 순수 함수)
import { AVG_VIDEO_MIN, BOOK_TOPICS, TOPICS, TAXQ, GENRES, GAPS, AGE_PICK, stagesFor, topicName } from './catalog';

const DAY = 864e5;
const mins = (s) => (s.src === 'yt' || s.src === 'share' ? Number(s.minutes) || AVG_VIDEO_MIN : 0);

function summarize(list, b2b) {
  const by = {};
  for (const s of list) {
    if (!s.topic || s.topic === 'other') continue;
    const o = (by[s.topic] ||= { topic: s.topic, name: topicName(s.topic, b2b), n: 0, minutes: 0, subs: new Map(), titles: [] });
    o.n++;
    o.minutes += mins(s);
    const k = (s.sub || s.text).replace(/\s/g, '');
    o.subs.set(k, (o.subs.get(k) || 0) + 1);
    if (o.titles.length < 3) o.titles.push(s.text);
  }
  return Object.values(by).map((o) => {
    const repeats = [...o.subs.values()].reduce((a, c) => a + (c > 1 ? c : 0), 0); // 같은 소주제를 2번 이상 본 영상 수
    const topSub = [...o.subs.entries()].sort((a, b) => b[1] - a[1])[0];
    const { subs, ...rest } = o;
    return { ...rest, minutes: Math.round(o.minutes), repeats, topSub: topSub && topSub[1] > 1 ? topSub[0] : null };
  }).sort((a, b) => b.n - a.n);
}

export function taxAgenda(signals) {
  const m = new Map();
  for (const s of signals) {
    if (s.topic !== 'tax' || !s.taxq) continue;
    const base = TAXQ.find((x) => x.key === s.taxq);
    if (!base) continue;
    const e = m.get(base.key) || { key: base.key, q: base.q, a: base.a, n: 0, titles: [] };
    e.n++;
    if (e.titles.length < 3 && !e.titles.includes(s.text)) e.titles.push(s.text);
    m.set(base.key, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

// 기록이 없을 때 사업 단계로 고르는 처방 주제(업로드 없이 바로 시작)
const STARTER = [['sales', 'mkt', 'money'], ['mkt', 'staff', 'money'], ['staff', 'money', 'sales'], ['money', 'staff', 'mkt'], ['money', 'staff', 'mkt']];
export function starterTopics(profile) {
  const b2b = !!profile?.b2b;
  const keys = profile?.form === 'pre' ? ['mkt', 'sales', 'money'] : STARTER[Math.min(4, profile?.stage ?? 0)];
  return keys.map((k) => ({ topic: k, name: topicName(k, b2b), n: 0, minutes: 0, repeats: 0, topSub: null, titles: [] }));
}

const WATCH = (s) => s.src === 'yt' || s.src === 'share';

/**
 * signals: 최근 28일 기록 + 구독 채널(src 'sub', 기간 무관) + 좋아요 영상(src 'like', 최근 90일)
 * mode
 *  - 'watch'    : 시청 기록(테이크아웃·공유)이 3건 이상 → 시청 시간·반복 리포트
 *  - 'interest' : 유튜브 연결(구독·좋아요)이나 검색어만 있음 → 관심 주제 리포트
 *  - 'starter'  : 기록 없음 → 가입 정보(업종·단계)로 고른 처방
 * 시청 기록은 최근 7일이 5건 미만이면 최근 4주로 계산합니다.
 */
export function computeReport(signals, profile, now = Date.now()) {
  const b2b = !!profile?.b2b;
  const usable = signals.filter((s) => !(s.sensitive && (profile?.exclude_sensitive ?? true)));
  const inRange = (s, a, b) => { const t = Date.parse(s.happened_at); return t > now - a * DAY && t <= now - b * DAY; };
  const subs = usable.filter((s) => s.src === 'sub');
  const likes = usable.filter((s) => s.src === 'like' && inRange(s, 90, 0));
  const recent = usable.filter((s) => s.src !== 'sub' && s.src !== 'like');
  const week = recent.filter((s) => inRange(s, 7, 0));
  const useMonth = week.filter(WATCH).length < 5;
  const cur = useMonth ? recent.filter((s) => inRange(s, 28, 0)) : week;
  const prev = useMonth ? [] : recent.filter((s) => inRange(s, 14, 7));
  const watched = cur.filter(WATCH);
  const mode = watched.length >= 3 ? 'watch' : (cur.length + subs.length + likes.length) ? 'interest' : 'starter';

  const base = mode === 'watch' ? [...cur, ...likes.filter((s) => inRange(s, useMonth ? 28 : 7, 0))] : [...cur, ...likes, ...subs];
  let topics = summarize(base, b2b);
  const prevTopics = summarize(prev, b2b);
  const total = Math.round(watched.reduce((a, s) => a + mins(s), 0));
  const days = useMonth ? 28 : 7;
  const top = topics[0] || null;
  let rxTopics = topics.filter((t) => BOOK_TOPICS.includes(t.topic) || t.topic === 'tax').slice(0, 3);
  if (mode === 'starter') rxTopics = starterTopics(profile);
  else if (rxTopics.length < 2) rxTopics = [...rxTopics, ...starterTopics(profile).filter((x) => !rxTopics.some((t) => t.topic === x.topic))].slice(0, 2);

  return {
    mode,
    period: useMonth ? 'month' : 'week',
    days,
    total,
    perDay: Math.round(total / days),
    count: watched.length,
    signals: base.length,
    sources: { subs: subs.length, likes: likes.length, other: cur.length - watched.length, watched: watched.length },
    estimated: watched.some((s) => !Number(s.minutes)),
    topics,
    top,
    delta: mode === 'watch' && prev.length ? {
      count: watched.length - prev.filter(WATCH).length,
      repeats: (top?.repeats || 0) - (prevTopics.find((t) => t.topic === top?.topic)?.repeats || 0),
    } : null,
    rx: rxTopics.map((t) => ({ ...t, consult: !!TOPICS[t.topic]?.consult, readHours: TOPICS[t.topic]?.readHours || 5 })),
    agenda: taxAgenda([...usable.filter((s) => s.src !== 'sub' && inRange(s, 28, 0)), ...likes]),
    taxVideos: [...recent, ...likes].filter((s) => s.topic === 'tax' && inRange(s, 90, 0)).slice(0, 20).map((s) => s.text),
  };
}

const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1); if (c < 0xac00 || c > 0xd7a3) return b; return (c - 0xac00) % 28 ? a : b; };

/** 영상 밖의 서가: 세금·회계 1권 + 부족한 지혜와 좋아하는 분야를 번갈아 + 나이대, 분야가 겹치지 않게 최대 6칸 */
export function shelfSpecs(profile) {
  const out = [], cats = new Set();
  const add = (cat, why, spec) => { if (out.length < 6 && !cats.has(cat)) { cats.add(cat); out.push({ cat, why, spec }); } };
  const stage = stagesFor(profile?.form)[profile?.stage ?? 0];
  const who = profile?.form === 'corp' ? '대표님' : '사장님';
  add('세금·회계', profile?.stage >= 1 ? `${stage.name} ${who}, 숫자를 알아야 남깁니다` : '사업의 숫자를 처음부터 읽는 법', 'genre:tax');
  const gp = profile?.gaps || [], gn = (profile?.genres || []).filter((g) => g !== 'tax');
  for (let i = 0; i < Math.max(gp.length, gn.length); i++) {
    if (GAPS[gp[i]]) add(GAPS[gp[i]].name, `'${GAPS[gp[i]].name}'${josa(GAPS[gp[i]].name, '이', '가')} 부족하다고 하셨어요`, `gap:${gp[i]}`);
    if (GENRES[gn[i]]) add(GENRES[gn[i]].name, `${GENRES[gn[i]].name}${josa(GENRES[gn[i]].name, '을', '를')} 좋아하신다고 하셨어요`, `genre:${gn[i]}`);
  }
  if (profile?.age != null && AGE_PICK[profile.age]) {
    const a = AGE_PICK[profile.age];
    add(a.cat, a.why, `age:${profile.age}`);
  }
  for (const g of ['philo', 'novel', 'essay', 'history']) add(GENRES[g].name, `영상에서 못 만나는 ${GENRES[g].name} 한 권`, `genre:${g}`);
  return out;
}

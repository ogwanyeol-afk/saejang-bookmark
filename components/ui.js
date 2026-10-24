'use client';
import { useState } from 'react';
import { api } from '@/lib/supabase-browser';
import { tipCats, personaOf } from '@/lib/catalog';

export const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`);
// 호칭: 사업자는 사장님·대표님, 그 밖의 유형은 호칭 없이
export const who = (p) => (personaOf(p).biz ? (p?.form === 'corp' ? '대표님' : '사장님') : '');
/** 화면 머리글용 "카페 사장님" / "직장인" */
export const whoLabel = (p) => (personaOf(p).biz ? `${p?.industry || ''} ${who(p)}`.trim() : personaOf(p).name);
const hueOf = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

export function Cover({ book, small }) {
  const [broken, setBroken] = useState(false);
  const img = book.cover && !broken;
  return (
    <a className={`cover${small ? ' sm' : ''}${img ? ' img' : ''}`} href={book.kyoboUrl} target="_blank" rel="noopener noreferrer"
      style={img ? undefined : { background: `hsl(${hueOf(book.title)} 42% 36%)` }} aria-label={`${book.title} 교보문고에서 보기`}>
      {img ? <img src={book.cover} alt="" onError={() => setBroken(true)} /> : book.title}
    </a>
  );
}

/** 오늘의 절세팁·세무 포인트: 화면을 볼 때마다(tick) 다음 팁 */
export function Tip({ cat, label = '세무 포인트', tips, profile, tick }) {
  const [extra, setExtra] = useState(0);
  const cats = tipCats(cat, { form: profile?.form, b2b: profile?.b2b, persona: profile?.persona || profile?.form });
  const pool = (tips || []).filter((t) => cats.includes(t.cat));
  if (!pool.length) return null;
  const off = { mkt: 0, sales: 1, money: 2, staff: 3, gen: 1 }[cat] || 0;
  const i = (tick + extra + off) % pool.length;
  return (
    <p className="tip tiprot">
      <span className="tiph"><b>{label}</b><span className="tipn">{i + 1}/{pool.length}</span>
        <button className="tipnext" onClick={() => setExtra((x) => x + 1)}>다음 팁 ›</button></span>
      {pool[i].text}
    </p>
  );
}

/**
 * 책 3권씩 넘겨보기: 3권을 다 보면 외부 API(알라딘·정보나루·국중도)에서 새 3권을 가져옴
 * spec = "topic:mkt" | "genre:philo" …, first = 서버가 준 첫 묶음 {src, books, next}
 */
export function useBookCycle(spec, first, notify) {
  const [batches, setBatches] = useState(first?.books?.length ? [first] : []);
  const [pos, setPos] = useState({ b: 0, i: 0 });
  const [loading, setLoading] = useState(false);
  const cur = batches[pos.b];
  const book = cur?.books[pos.i];
  const last = cur ? pos.i === cur.books.length - 1 : true;
  const seen = batches.flatMap((x) => x.books.map((y) => y.title));

  const fetchMore = async () => {
    const nextBatch = batches.at(-1)?.next;
    if (nextBatch == null) { setPos({ b: 0, i: 0 }); notify?.('지금 가져올 수 있는 책을 모두 보셨어요. 처음 책부터 다시 보여드릴게요'); return; }
    setLoading(true);
    try {
      const res = await api('/api/books', { method: 'POST', body: { spec, batch: nextBatch, exclude: seen } });
      if (res.books?.length) {
        setBatches((bs) => [...bs, res]);
        setPos({ b: batches.length, i: 0 });
        notify?.(`${res.src}에서 새 책 ${res.books.length}권을 가져왔어요`);
      } else {
        setBatches((bs) => bs.map((x, k) => (k === bs.length - 1 ? { ...x, next: null } : x)));
        setPos({ b: 0, i: 0 });
        notify?.('새로 가져올 책을 찾지 못했어요. 처음 책부터 다시 보여드릴게요');
      }
    } catch (e) { notify?.(e.message); }
    setLoading(false);
  };
  const next = () => {
    if (loading) return;
    if (!last) setPos((p) => ({ ...p, i: p.i + 1 }));
    else if (pos.b < batches.length - 1) setPos({ b: pos.b + 1, i: 0 });
    else fetchMore();
  };
  const markRead = async () => {
    if (!book) return;
    try {
      await api('/api/feedback', { method: 'POST', body: { title: book.title, author: book.author, action: 'read' } });
      notify?.('다 읽음 · 내 책장에 담았어요');
      next();
    } catch (e) { notify?.(e.message); }
  };
  const moreLeft = !(last && pos.b === batches.length - 1 && batches.at(-1)?.next == null);
  return { book, cur, pos, loading, last: last && pos.b === batches.length - 1, moreLeft, next, markRead, total: cur?.books.length || 0 };
}

export function SourceLine({ cyc }) {
  if (!cyc.cur) return null;
  return (
    <div className="srcline">
      <span className={`srcb${cyc.pos.b ? ' live' : ''}`}>{cyc.cur.src}</span>
      <span className="dots">{cyc.cur.books.map((_, j) => <i key={j} className={j === cyc.pos.i ? 'on' : j < cyc.pos.i ? 'seen' : ''} />)}</span>
      <span className="hint">{cyc.pos.i + 1}/{cyc.total}</span>
    </div>
  );
}

export function NextButton({ cyc }) {
  return (
    <button className={`sbtn${cyc.last ? ' fetch' : ''}`} onClick={cyc.next} disabled={cyc.loading}>
      {cyc.last ? (cyc.moreLeft ? '새 책 3권 찾기' : '처음 책부터 다시') : '다른 책'}
    </button>
  );
}

export function Loading({ text }) {
  return <div className="loadbox" role="status"><span className="spin" aria-hidden="true" /><div><b>새 책 3권 찾는 중…</b><br /><span className="hint">{text}</span></div></div>;
}

export function Copy({ value }) {
  const [done, setDone] = useState(false);
  return (
    <div className="codebox">
      <span className="code">{value}</span>
      <button className="sbtn" onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
      }}>{done ? '복사됨' : '복사'}</button>
    </div>
  );
}

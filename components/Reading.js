'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/supabase-browser';
import { hm } from './ui';

// AI에게 일을 맡긴 동안 유튜브 대신 책 10분: 책 고르기 → 타이머 → 쪽수·한 줄 기록
const KEY = 'saejang.readTimer';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const save = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };
const DAY = '일월화수목금토';
const dayOf = (s) => {
  const d = new Date(s), t = new Date();
  const diff = Math.floor((new Date(t.toDateString()) - new Date(d.toDateString())) / 864e5);
  return diff === 0 ? '오늘' : diff === 1 ? '어제' : diff < 7 ? `${DAY[d.getDay()]}요일` : `${d.getMonth() + 1}/${d.getDate()}`;
};

/** 리포트·서가에서 지금 추천 중인 책들(읽을 책 후보) */
export function candidates(data, sessions) {
  const out = [], seen = new Set();
  const add = (b, why) => { if (b?.title && !seen.has(b.title)) { seen.add(b.title); out.push({ title: b.title, author: b.author || '', why }); } };
  if (sessions?.[0]) add(sessions[0], '이어 읽기');
  for (const r of data?.report?.rx || []) if (!r.consult) add(r.batch?.books?.[0], `${r.name} 처방`);
  for (const s of data?.shelf || []) add(s.batch?.books?.[0], s.cat);
  return out.slice(0, 5);
}

async function alertDone(title) {
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
  try {
    if (document.visibilityState === 'visible' || Notification?.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.showNotification('10분 독서 끝', { body: `『${title}』 몇 쪽 읽으셨는지 기록해 두세요.`, tag: 'reading-done', data: { url: '/?tab=report' } });
  } catch {}
}

function Sheet({ children, onClose }) {
  return (
    <div className="sheet-ov" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="sheet-card">{children}</div>
    </div>
  );
}

function ReadSheet({ data, sessions, initial, onClose, onSaved, notify }) {
  const picks = candidates(data, sessions);
  const [st, setSt] = useState(() => initial || { step: 'pick', min: 10, book: picks[0] || null, custom: '' });
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const done = useRef(false);
  const total = st.min * 60;
  const el = st.step === 'run' ? Math.min(total, Math.floor((now - st.startedAt) / 1000)) : 0;

  useEffect(() => {
    if (st.step !== 'run') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    const vis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [st.step]);
  useEffect(() => {
    if (st.step === 'run' && el >= total && !done.current) {
      done.current = true;
      alertDone(st.book.title);
      finish(st.min);
    }
  }, [el, total, st]);

  function finish(minutes) {
    save(null);
    setSt((s) => ({ ...s, step: 'done', read: Math.max(1, minutes), pages: null, memo: '' }));
  }
  const start = () => {
    const book = st.book?.custom ? { title: st.custom.trim(), author: '' } : st.book;
    if (!book?.title) { notify('읽을 책을 골라 주세요'); return; }
    const next = { step: 'run', min: st.min, book, startedAt: Date.now() };
    save(next); done.current = false; setNow(Date.now()); setSt(next);
    try { if (Notification?.permission === 'default') Notification.requestPermission(); } catch {}
  };
  const record = async () => {
    setBusy(true);
    try {
      const r = await api('/api/reading', { method: 'POST', body: { title: st.book.title, author: st.book.author, minutes: st.read, pages: st.pages, memo: st.memo } });
      onSaved(r.session);
    } catch (e) { notify(e.message); }
    setBusy(false);
  };

  if (st.step === 'pick') return (
    <Sheet onClose={onClose}>
      <span className="hint">AI가 일하는 동안</span>
      <b style={{ fontSize: '1.05rem' }}>유튜브 대신 책 한 꼭지</b>
      <h3>무엇을 읽을까요?</h3>
      <div className="rpick">
        {picks.map((b) => (
          <button key={b.title} className="rbook" aria-pressed={st.book?.title === b.title && !st.book?.custom} onClick={() => setSt((s) => ({ ...s, book: b }))}>
            <b>{b.title}</b><span className="hint">{b.author ? `${b.author} · ` : ''}{b.why}</span>
          </button>
        ))}
        <button className="rbook" aria-pressed={!!st.book?.custom} onClick={() => setSt((s) => ({ ...s, book: { custom: true } }))}><b>다른 책</b><span className="hint">지금 손에 있는 책</span></button>
        {st.book?.custom && <input className="rmemo" autoFocus placeholder="책 제목" value={st.custom} onChange={(e) => setSt((s) => ({ ...s, custom: e.target.value }))} />}
      </div>
      <h3>얼마나 읽을까요?</h3>
      <div className="pills">{[10, 20, 30].map((m) => <button key={m} className="pill" aria-pressed={st.min === m} onClick={() => setSt((s) => ({ ...s, min: m }))}>{m}분</button>)}</div>
      <div className="acts"><button className="btn" style={{ flex: 1 }} onClick={start}>읽기 시작</button><button className="btn ghost" onClick={onClose}>닫기</button></div>
    </Sheet>
  );

  if (st.step === 'run') {
    const left = total - el;
    return (
      <Sheet>
        <div style={{ textAlign: 'center', display: 'grid', gap: 8 }}>
          <span className="hint">『{st.book.title}』 읽는 중 · 휴대폰은 내려놓으세요</span>
          <div className="timer" aria-live="off">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</div>
          <div className="tbar"><i style={{ width: `${(el / total) * 100}%` }} /></div>
          <p className="hint" style={{ margin: 0 }}>화면을 꺼도 시간은 계속 갑니다. AI 작업이 먼저 끝나도 이 시간은 지켜 보세요.</p>
          <div className="acts" style={{ justifyContent: 'center' }}>
            <button className="btn ghost" onClick={() => finish(Math.ceil(el / 60))}>그만 읽기</button>
            <button className="btn ghost" onClick={() => { save(null); onClose(); }}>취소</button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet>
      <b style={{ fontSize: '1.05rem' }}>{st.read}분 읽었어요</b>
      <span className="hint">『{st.book.title}』</span>
      <h3>몇 쪽 읽으셨어요?</h3>
      <div className="pills">
        {[5, 10, 20, 30].map((n) => <button key={n} className="pill" aria-pressed={st.pages === n} onClick={() => setSt((s) => ({ ...s, pages: n }))}>{n}쪽</button>)}
        <input className="rmemo" style={{ width: 90 }} type="number" inputMode="numeric" min="0" placeholder="직접" value={[5, 10, 20, 30].includes(st.pages) || st.pages == null ? '' : st.pages}
          onChange={(e) => setSt((s) => ({ ...s, pages: e.target.value === '' ? null : Number(e.target.value) }))} />
      </div>
      <h3>기억하고 싶은 한 줄 <span className="hint">· 선택</span></h3>
      <input className="rmemo" placeholder="예: 광고보다 고객 한 명을 먼저 정하라" maxLength={200} value={st.memo} onChange={(e) => setSt((s) => ({ ...s, memo: e.target.value }))} />
      <div className="acts">
        <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={record}>{busy ? '기록 중…' : '기록하기'}</button>
        <button className="btn ghost" onClick={onClose}>기록 안 함</button>
      </div>
    </Sheet>
  );
}

/**
 * 리포트·책장에 놓는 "AI가 일하는 동안, 10분 읽기" 카드
 * youtubeMin = 같은 기간 유튜브 시청 시간(분), days = 7 | 28
 */
export default function Reading({ data, youtubeMin = 0, days = 7, notify, full }) {
  const [r, setR] = useState(null);
  const [open, setOpen] = useState(null); // null | {} | 이어서 열 타이머
  const refresh = useCallback(() => api(`/api/reading?days=${days}`).then(setR).catch(() => setR({ minutes: 0, sessions: [], totalMinutes: 0, count: 0, pages: 0 })), [days]);
  useEffect(() => {
    refresh();
    const t = load();
    if (t?.step === 'run' && t.book?.title) setOpen({ initial: t });
    const p = new URLSearchParams(location.search);
    if (p.get('read') === '1') { setOpen({}); p.delete('read'); history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`); }
  }, [refresh]);

  const rm = r?.minutes || 0;
  const pct = youtubeMin ? Math.round((rm / youtubeMin) * 100) : 0;
  const del = async (id) => {
    try { await api(`/api/reading?id=${id}`, { method: 'DELETE' }); refresh(); notify('기록을 지웠어요'); } catch (e) { notify(e.message); }
  };
  const list = (r?.sessions || []).slice(0, full ? 50 : 3);

  return (
    <div className="panel readp">
      <div className="stg-h"><h2 className="p" style={{ margin: 0 }}>AI가 일하는 동안, 10분 읽기</h2><span className="hint">{days === 7 ? '최근 7일' : '최근 4주'}</span></div>
      <p className="rx-claim">AI에게 일을 맡겨 둔 시간에 유튜브를 켜면 남는 게 없습니다. 같은 시간 책을 읽으면 <b>인생</b>을 보는 눈, <b>사업</b>을 키우는 생각, <b>세상</b>을 보는 견문이 쌓입니다.</p>
      {youtubeMin > 0 && (
        <div className="vsbar">
          <div className="vr"><span>유튜브</span><div className="rtrack"><i style={{ width: '100%' }} /></div><b>{hm(youtubeMin)}</b></div>
          <div className="vr"><span>독서</span><div className="rtrack"><i className="rd" style={{ width: `${Math.min(100, Math.max(rm ? 2 : 0, pct))}%` }} /></div><b>{hm(rm)}</b></div>
        </div>
      )}
      <p className="hint" style={{ margin: '6px 0 10px' }}>
        {!r ? '불러오는 중…' : rm ? `${youtubeMin ? `유튜브 시간의 ${pct}%를 책에 썼어요. ` : ''}${r.count}번 · ${r.pages}쪽. 하루 10분이면 일주일에 1시간 10분입니다.` : 'AI에게 일을 맡길 때마다 10분씩 읽어 보세요. 하루 10분이면 일주일에 1시간 10분입니다.'}
        {full && r?.totalMinutes ? ` 지금까지 모두 ${hm(r.totalMinutes)}.` : ''}
      </p>
      <button className="btn block" onClick={() => setOpen({})}>AI에게 일 맡겼어요 · 10분 읽기</button>
      {list.length > 0 && (
        <div className="rlog">{list.map((s) => (
          <div className="rl" key={s.id}>
            <span className="d">{dayOf(s.read_at)}</span>
            <span className="m"><b>{s.title}</b> · {s.minutes}분{s.pages ? ` · ${s.pages}쪽` : ''}{s.memo && <><br /><span className="hint">"{s.memo}"</span></>}</span>
            {full ? <button className="sbtn" onClick={() => del(s.id)}>지우기</button> : <span />}
          </div>
        ))}</div>
      )}
      {open && (
        <ReadSheet data={data} sessions={r?.sessions} initial={open.initial} notify={notify}
          onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); refresh().then(() => notify('기록했어요 · 유튜브 대신 쌓인 시간이에요')); }} />
      )}
    </div>
  );
}

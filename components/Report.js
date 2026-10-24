'use client';
import { useEffect, useState } from 'react';
import { hm, who, Tip, Cover, useBookCycle, SourceLine, NextButton, Loading } from './ui';
import { stagesFor } from '@/lib/catalog';
import Reading from './Reading';
import { api } from '@/lib/supabase-browser';

function BookRx({ r, mode, profile, tips, tick, notify }) {
  const cyc = useBookCycle(r.spec, r.batch, notify);
  const b = cyc.book;
  return (
    <div className="panel rx">
      <div className="rx-h"><h2 className="p" style={{ margin: 0 }}>{r.name}</h2>{r.repeats >= 3 && <span className="tagw">반복 {r.repeats}개</span>}</div>
      <p className="rx-claim">{mode === 'watch' ? <>{r.repeats >= 3
        ? <>영상 {r.n}개 중 <b>{r.repeats}개</b>가 같은 소주제{r.topSub ? `(${r.topSub})` : ''}를 반복해요. 같은 얘기를 돌려 보는 중입니다.</>
        : <>이 주제 영상 {r.n}개를 보셨어요.</>} 흩어진 내용을 처음부터 순서대로 정리한 책을 골랐어요.</>
        : r.n > 0 ? <>구독·좋아요·보낸 기록 중 <b>{r.n}개</b>가 이 주제예요. 영상으로 조각조각 보던 내용을 한 권으로 정리해 보세요.</>
          : <>{stagesFor(profile.form)[profile.stage ?? 0].name} {who(profile)}께 필요한 <b>{r.name}</b>의 기본을 처음부터 순서대로 정리한 책을 골랐어요.</>}</p>
      {cyc.loading ? <Loading text={`${r.name} 관련 책을 가져오고 있어요`} /> : b ? (
        <div className="book">
          <Cover book={b} />
          <div className="meta">
            <p className="t">{b.title}</p><div className="au">{b.author}{b.publisher ? ` · ${b.publisher}` : ''}</div>
            <SourceLine cyc={cyc} />
            {mode === 'watch' && <div className="vs"><div>영상 {r.n}개<b>{hm(r.minutes)}</b></div><span className="eq">≈</span><div>책 한 권<b>약 {r.readHours}시간</b></div></div>}
            <div className="acts">
              <a className="sbtn" href={b.kyoboUrl} target="_blank" rel="noopener noreferrer">교보문고에서 보기</a>
              <NextButton cyc={cyc} />
              <button className="sbtn" onClick={cyc.markRead}>다 읽었어요</button>
            </div>
          </div>
        </div>
      ) : <p className="hint">추천할 책을 불러오지 못했어요.</p>}
      <Tip cat={r.topic} tips={tips} profile={profile} tick={tick} />
    </div>
  );
}

function ShelfItem({ s, notify }) {
  const cyc = useBookCycle(s.spec, s.batch, notify);
  const b = cyc.book;
  if (cyc.loading) return <Loading text={`${s.cat} 책을 가져오고 있어요`} />;
  if (!b) return null;
  return (
    <div className="ob-b">
      <Cover book={b} small />
      <div className="meta">
        <span className="catb">{s.cat}</span><p className="t">{b.title}</p><div className="au">{b.author}</div><p className="why">{s.why}</p>
        <SourceLine cyc={cyc} />
        <div className="acts"><a className="sbtn" href={b.kyoboUrl} target="_blank" rel="noopener noreferrer">교보문고</a><NextButton cyc={cyc} /><button className="sbtn" onClick={cyc.markRead}>다 읽었어요</button></div>
      </div>
    </div>
  );
}

export function OtherShelf({ title, shelf, profile, onEdit, notify }) {
  return (
    <div className="panel">
      <div className="stg-h"><h2 className="p" style={{ margin: 0 }}>{title}</h2><button className="sbtn" onClick={onEdit}>관심사 수정</button></div>
      <p className="hint" style={{ margin: '4px 0 10px' }}>영상으로 보는 주제만 읽으면 생각이 좁아집니다. 고르신 관심사와 부족하다고 느끼신 지혜로 다른 서가의 책을 골랐어요.</p>
      <div className="other">{shelf.map((s) => <ShelfItem key={s.spec} s={s} notify={notify} />)}</div>
    </div>
  );
}

export function StageBox({ profile, goGrowth }) {
  const stages = stagesFor(profile.form);
  const cur = profile.stage ?? 0, st = stages[cur], nx = stages[Math.min(3, cur + 1)];
  return (
    <div className="panel stagebox">
      <div className="stg-h"><h2 className="p" style={{ margin: 0 }}>{who(profile)} 단계</h2><button className="sbtn" onClick={goGrowth}>성장 지도</button></div>
      <div className="from"><span className="badge">{st.name}</span>{cur < 3 && <><span className="arr">→</span><span className="badge" style={{ background: 'var(--accent)', color: 'var(--surface)' }}>{nx.name}</span></>}</div>
      <p className="rx-claim">{cur < 3 ? <>오늘 장사에 쓰는 영상만으로는 다음 단계가 보이지 않습니다. <b>{nx.name}</b>로 가려면 다음 단계 사장의 생각과 세금을 미리 알아야 합니다.</> : '회사를 경영하는 단계입니다. 생각과 세금 모두 다음 세대까지 봐야 합니다.'}</p>
      <a className="minibook" href={`https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(nx.book.title + ' ' + nx.book.author)}`} target="_blank" rel="noopener noreferrer"><i style={{ background: 'hsl(210 42% 36%)' }} /><span>미리 읽을 책 · <b>{nx.book.title}</b></span></a>
      <p className="tip"><b>{cur < 3 ? '다음 단계에서 생기는 세금' : '이 단계의 세금'}</b> · {nx.tax[0]}</p>
    </div>
  );
}

const YT_MSG = {
  denied: '유튜브 연결을 취소했어요.', expired: '연결 시간이 지났어요. 다시 눌러 주세요.', noscope: '유튜브 읽기 권한에 체크해 주셔야 분석할 수 있어요.',
  norefresh: '구글 계정 설정에서 사장님 책갈피 권한을 지운 뒤 다시 연결해 주세요.', error: '유튜브 연결 중 오류가 났어요. 잠시 뒤 다시 시도해 주세요.',
};
const ago = (s) => { const m = Math.round((Date.now() - Date.parse(s)) / 60000); return m < 60 ? `${Math.max(1, m)}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; };

/** 유튜브 연결(구독·좋아요 자동 분석) · 공유하기 안내 */
export function ConnectCard({ youtube, notify, reload, goRecords }) {
  const [busy, setBusy] = useState('');
  const sync = async (first) => {
    setBusy(first ? '구독 채널과 좋아요 영상을 분석하고 있어요… (최대 30초)' : '다시 분석하는 중…');
    try { const r = await api('/api/youtube', { method: 'PUT' }); notify(`구독 ${r.subs}개 · 좋아요 ${r.likes}개를 분석했어요`); reload(); }
    catch (e) { notify(e.message); }
    setBusy('');
  };
  useEffect(() => {
    const p = new URLSearchParams(location.search), yt = p.get('yt');
    if (!yt) return;
    p.delete('yt'); history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`);
    if (yt === 'connected') sync(true); else notify(YT_MSG[yt] || YT_MSG.error);
  }, []);
  const connect = async () => {
    setBusy('구글로 이동 중…');
    try { location.href = (await api('/api/youtube', { method: 'POST' })).url; } catch (e) { notify(e.message); setBusy(''); }
  };
  const disconnect = async () => { try { await api('/api/youtube', { method: 'DELETE' }); notify('유튜브 연결을 끊고 구독·좋아요 기록을 지웠어요'); reload(); } catch (e) { notify(e.message); } };

  if (youtube) return (
    <div className="panel">
      <div className="stg-h"><h2 className="p" style={{ margin: 0 }}>유튜브 연결됨</h2><span className="hint">{youtube.last_sync_at ? `분석 ${ago(youtube.last_sync_at)}` : '분석 전'}</span></div>
      <p className="hint" style={{ margin: '4px 0 8px' }}>구독 채널 {youtube.sub_count}개 · 좋아요 영상 {youtube.like_count}개 · 매주 일요일 자동으로 다시 분석합니다.</p>
      {youtube.last_error && <p className="tip" style={{ marginTop: 0 }}>{youtube.last_error}</p>}
      <div className="acts">
        <button className="sbtn" disabled={!!busy} onClick={() => sync(false)}>{busy || '지금 다시 분석'}</button>
        <button className="sbtn" onClick={goRecords}>보는 영상 바로 보내기</button>
        <button className="sbtn" onClick={disconnect}>연결 끊기</button>
      </div>
    </div>
  );
  return (
    <div className="panel stack connect">
      <h2 className="p" style={{ margin: 0 }}>유튜브를 연결하면 더 정확해져요</h2>
      <p className="rx-claim">버튼 한 번이면 <b>구독 채널</b>과 <b>좋아요 누른 영상</b>으로 요즘 관심 주제를 분석해, 처방 책과 상담 질문을 다시 골라 드려요. 읽기만 하고 아무것도 올리거나 바꾸지 않습니다.</p>
      <button className="btn block" disabled={!!busy} onClick={connect}>{busy || '유튜브 연결하기'}</button>
      <p className="hint" style={{ margin: 0 }}>보다가 마음에 든 영상은 <b>공유 → 사장님 책갈피</b>로 바로 보낼 수도 있어요. <a href="#" onClick={(e) => { e.preventDefault(); goRecords(); }}>공유 설정</a></p>
    </div>
  );
}

const KIND = { like: '좋아요', sub: '구독', yt: '시청', share: '공유', search: '검색', image: '이미지' };

/** 관심 주제(또는 본 영상) 막대 + 주제를 누르면 어떤 채널·영상이 그 주제로 분류됐는지 보기 */
function TopicsPanel({ r, mode, max, goRecords }) {
  const [open, setOpen] = useState(r.topics[0]?.topic || null);
  const src = r.sources || {};
  return (
    <div className="panel">
      <div className="stg-h"><h2 className="p" style={{ margin: 0 }}>{mode === 'watch' ? '무엇을 보셨나' : '관심 주제'}</h2><span className="hint">주제를 누르면 분석 내용</span></div>
      {r.topics.map((t) => (
        <div className="trow" key={t.topic}>
          <button className="topic tbtn" aria-expanded={open === t.topic} onClick={() => setOpen(open === t.topic ? null : t.topic)}>
            <span className="nm">{t.name} <span className="chev">{open === t.topic ? '▴' : '▾'}</span></span><span className="ct">{t.n}개{mode === 'watch' ? ` · ${hm(t.minutes)}` : ''}</span>
            <div className="bar" style={{ width: `${(t.n / max) * 100}%` }}>
              {mode === 'watch' ? <><i style={{ width: `${((t.n - t.repeats) / t.n) * 100}%` }} /><i className="rep" style={{ width: `${(t.repeats / t.n) * 100}%` }} /></> : <i style={{ width: '100%' }} />}
            </div>
          </button>
          {open === t.topic && (
            <div className="why">
              <p className="hint" style={{ margin: '0 0 6px' }}>{Object.entries(t.kinds || {}).map(([k, n]) => `${KIND[k] || k} ${n}개`).join(' · ')}가 이 주제로 분류됐어요</p>
              <ul>{(t.examples || t.titles.map((x) => ({ t: x }))).map((e, i) => (
                <li key={i}>{e.src && <span className={`kb k-${e.src}`}>{KIND[e.src] || e.src}</span>}<span className="et">{e.t}</span></li>
              ))}</ul>
              {t.n > (t.examples || []).length && <p className="hint" style={{ margin: '4px 0 0' }}>외 {t.n - (t.examples || []).length}개</p>}
            </div>
          )}
        </div>
      ))}
      {mode === 'watch' && <div className="legend"><span><i style={{ background: 'var(--accent)' }} />새로운 내용</span><span><i style={{ background: 'var(--warn)' }} />반복해서 본 내용</span></div>}
      <p className="hint" style={{ margin: '10px 0 0' }}>
        {src.skipped ? `예능·음악처럼 사업과 관계없는 ${src.skipped}개는 분석에서 뺐어요. ` : ''}
        <a href="#" onClick={(e) => { e.preventDefault(); goRecords(); }}>전체 분류 기록 보기 · 잘못 분류된 건 지우기</a>
      </p>
    </div>
  );
}

export default function Report({ data, profile, tips, tick, notify, go, onEditMe, reload }) {
  if (!data) return <div className="panel empty">리포트를 만드는 중…</div>;
  const { report: r, shelf, youtube } = data;
  const mode = r.mode || (r.top ? 'watch' : 'starter');
  const max = r.topics[0]?.n || 1;
  const label = r.period === 'week' ? '최근 7일' : '최근 4주';
  const stage = stagesFor(profile.form)[profile.stage ?? 0];
  const src = r.sources || {};
  return (
    <div className="stack">
      {mode === 'watch' && (
        <div className="wrap-card">
          <div className="wk">{label} · {profile.industry} {who(profile)} 리포트</div>
          <div className="big">{Math.floor(r.total / 60)}<small>시간</small> {r.total % 60}<small>분</small></div>
          <div className="line">유튜브 영상 {r.count}개 · 하루 평균 {hm(r.perDay)}{r.estimated ? ' · 길이를 모르는 영상은 11분으로 계산' : ''}</div>
          <div className="alarm"><b>{r.top.name}</b> 영상만 {r.top.n}개.{r.top.repeats >= 2 && <><br />그중 <b>{r.top.repeats}개</b>는 같은 얘기를 반복하고 있어요.</>}</div>
          {r.delta && <div className="delta">지난주 대비 영상 {r.delta.count >= 0 ? '+' : ''}{r.delta.count}개 · 반복 시청 {r.delta.repeats >= 0 ? '+' : ''}{r.delta.repeats}개</div>}
        </div>
      )}
      {mode === 'interest' && (
        <div className="wrap-card">
          <div className="wk">요즘 관심 주제 · {profile.industry} {who(profile)}</div>
          <div className="big big-t">{r.top.name}</div>
          <div className="line">{[src.subs && `구독 채널 ${src.subs}개`, src.likes && `좋아요 영상 ${src.likes}개`, (src.other + src.watched) > 0 && `보낸 기록 ${src.other + src.watched}개`].filter(Boolean).join(' · ')}로 분석했어요</div>
          <div className="alarm"><b>{r.top.name}</b> 관련이 {r.top.n}개로 가장 많아요.{r.topics[1] && <><br />다음은 <b>{r.topics[1].name}</b> {r.topics[1].n}개.</>}</div>
        </div>
      )}
      {mode === 'starter' && (
        <div className="wrap-card">
          <div className="wk">{profile.industry} {who(profile)} · {stage.name}</div>
          <div className="big big-t">이번 주 처방</div>
          <div className="line">가입 때 알려주신 업종과 사업 단계로 골랐어요</div>
          <div className="alarm">유튜브를 연결하면 <b>요즘 관심 주제</b>로 다시 골라 드려요.</div>
        </div>
      )}
      {mode !== 'watch' && <ConnectCard youtube={youtube} notify={notify} reload={reload} goRecords={() => go('records')} />}
      <Tip cat="gen" label="오늘의 절세팁" tips={tips} profile={profile} tick={tick} />
      <StageBox profile={profile} goGrowth={() => go('growth')} />
      <Reading data={data} youtubeMin={mode === 'watch' ? r.total : 0} days={r.period === 'week' ? 7 : 28} notify={notify} />
      {mode !== 'starter' && r.topics.length > 0 && <TopicsPanel r={r} mode={mode} max={max} goRecords={() => go('records')} />}
      <div><h2 className="p" style={{ margin: '6px 0 2px' }}>이번 주 처방</h2><p className="hint" style={{ margin: 0 }}>영상은 오늘 써먹을 방법을, 책은 사업을 키우는 생각의 틀을 줍니다.</p></div>
      {r.rx.map((x) => x.consult ? (
        <div className="panel rx" key={x.topic}>
          <div className="rx-h"><h2 className="p" style={{ margin: 0 }}>{x.name}</h2><span className="tagw">{mode === 'watch' ? '영상' : '관심'} {x.n}개</span></div>
          <p className="rx-claim">{mode === 'watch' ? <>세금 영상만 <b>{hm(x.minutes)}</b> 보셨어요.</> : <>세금 관련 관심이 <b>{x.n}개</b> 있어요.</>} {who(profile)} 상황에 딱 맞는 답은 영상에 없습니다. <b>궁금해하실 질문</b>을 정리했어요.</p>
          {r.agenda.length > 0 && <ul className="qlist">{r.agenda.slice(0, 3).map((q) => <li key={q.key}><b>{q.q}</b><span>관련 {q.n}개</span></li>)}</ul>}
          <button className="btn" onClick={() => go('tax')}>이 질문으로 상담받기</button>
        </div>
      ) : <BookRx key={x.topic} r={x} mode={mode} profile={profile} tips={tips} tick={tick} notify={notify} />)}
      {shelf?.length > 0 && <OtherShelf title={mode === 'watch' ? '영상 밖의 서가' : '나를 위한 다른 서가'} shelf={shelf} profile={profile} onEdit={onEditMe} notify={notify} />}
      {mode === 'watch' && <ConnectCard youtube={youtube} notify={notify} reload={reload} goRecords={() => go('records')} />}
      {mode === 'watch' && (
        <div className="panel">
          <h2 className="p">이번 주 공유 카드</h2>
          <div className="share-card">
            <span className="s">{label} · {profile.industry} {who(profile)}</span>
            <div className="q">이번 주 유튜브 <em>{hm(r.total)}</em>.<br />{r.top.name} 영상 <em>{r.top.n}개</em>{r.top.repeats >= 2 && <> 중 <em>{r.top.repeats}개</em>는 같은 얘기였다.</>}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}><span className="s">당신의 유튜브는 몇 시간?</span><span className="brand">사장님 책갈피</span></div>
          </div>
          <p className="hint" style={{ margin: '8px 0 0' }}>캡처해서 사장님 단톡방에 공유해 보세요.</p>
        </div>
      )}
    </div>
  );
}

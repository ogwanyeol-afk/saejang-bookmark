'use client';
import { useState } from 'react';
import { hm, who, Tip, Cover, useBookCycle, SourceLine, NextButton, Loading } from './ui';
import { stagesFor } from '@/lib/catalog';
import { uploadTakeout } from '@/lib/takeout';
import Reading from './Reading';

function BookRx({ r, profile, tips, tick, notify }) {
  const cyc = useBookCycle(r.spec, r.batch, notify);
  const b = cyc.book;
  return (
    <div className="panel rx">
      <div className="rx-h"><h2 className="p" style={{ margin: 0 }}>{r.name}</h2>{r.repeats >= 3 && <span className="tagw">반복 {r.repeats}개</span>}</div>
      <p className="rx-claim">{r.repeats >= 3
        ? <>영상 {r.n}개 중 <b>{r.repeats}개</b>가 같은 소주제{r.topSub ? `(${r.topSub})` : ''}를 반복해요. 같은 얘기를 돌려 보는 중입니다.</>
        : <>이 주제 영상 {r.n}개를 보셨어요.</>} 흩어진 내용을 처음부터 순서대로 정리한 책을 골랐어요.</p>
      {cyc.loading ? <Loading text={`${r.name} 관련 책을 가져오고 있어요`} /> : b ? (
        <div className="book">
          <Cover book={b} />
          <div className="meta">
            <p className="t">{b.title}</p><div className="au">{b.author}{b.publisher ? ` · ${b.publisher}` : ''}</div>
            <SourceLine cyc={cyc} />
            <div className="vs"><div>영상 {r.n}개<b>{hm(r.minutes)}</b></div><span className="eq">≈</span><div>책 한 권<b>약 {r.readHours}시간</b></div></div>
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

export function FirstConnect({ reload, notify, goRecords }) {
  const [busy, setBusy] = useState('');
  return (
    <div className="stack">
      <div className="panel stack">
        <h2 className="p" style={{ margin: 0 }}>지난 4주, 뭘 보셨나요?</h2>
        <p className="rx-claim">유튜브 시청 기록을 한 번만 올리면 첫 리포트를 바로 만들어 드려요. 영상 제목만 분석하고 언제든 지울 수 있어요.</p>
        <ol className="guide">
          <li><a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer">takeout.google.com</a>에서 <b>모두 선택 해제</b> → <b>YouTube 및 YouTube Music</b>만 체크</li>
          <li><b>모든 YouTube 데이터 포함됨</b> → <b>기록</b>만 남기고, <b>여러 형식</b>에서 기록을 <b>JSON</b>으로 변경</li>
          <li>내보내기 → 메일로 온 파일을 받아 압축을 풀고 <code>watch-history.json</code>을 아래에서 선택</li>
        </ol>
        <label className="btn" style={{ position: 'relative' }}>
          {busy || 'watch-history.json 올리기'}
          <input type="file" accept=".json,application/json" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} disabled={!!busy}
            onChange={async (e) => {
              const f = e.target.files[0]; e.target.value = '';
              if (!f) return;
              setBusy('읽는 중…');
              try { const n = await uploadTakeout(f, (a, t) => setBusy(`AI가 분석 중… ${a}/${t}`)); notify(`기록 ${n}건으로 첫 리포트를 만들었어요`); reload(); }
              catch (err) { notify(err.message); }
              setBusy('');
            }} />
        </label>
      </div>
      <div className="panel">
        <h3>공유하기로 시작</h3>
        <p className="hint" style={{ margin: '4px 0 8px' }}>오늘부터 보는 영상을 공유해 모읍니다. 기록이 5개쯤 쌓이면 리포트가 나와요.</p>
        <button className="btn ghost" onClick={goRecords}>공유 메뉴 설정하기</button>
      </div>
    </div>
  );
}

export default function Report({ data, profile, tips, tick, notify, go, onEditMe, reload }) {
  if (!data) return <div className="panel empty">리포트를 만드는 중…</div>;
  const { report: r, shelf } = data;
  if (!r.top) return <div className="stack"><FirstConnect reload={reload} notify={notify} goRecords={() => go('records')} /><Reading data={data} notify={notify} /></div>;
  const max = r.topics[0].n;
  const label = r.period === 'week' ? '최근 7일' : '최근 4주';
  return (
    <div className="stack">
      <div className="wrap-card">
        <div className="wk">{label} · {profile.industry} {who(profile)} 리포트</div>
        <div className="big">{Math.floor(r.total / 60)}<small>시간</small> {r.total % 60}<small>분</small></div>
        <div className="line">유튜브 영상 {r.count}개 · 하루 평균 {hm(r.perDay)}{r.estimated ? ' · 길이를 모르는 영상은 11분으로 계산' : ''}</div>
        <div className="alarm"><b>{r.top.name}</b> 영상만 {r.top.n}개.{r.top.repeats >= 2 && <><br />그중 <b>{r.top.repeats}개</b>는 같은 얘기를 반복하고 있어요.</>}</div>
        {r.delta && <div className="delta">지난주 대비 영상 {r.delta.count >= 0 ? '+' : ''}{r.delta.count}개 · 반복 시청 {r.delta.repeats >= 0 ? '+' : ''}{r.delta.repeats}개</div>}
      </div>
      <Tip cat="gen" label="오늘의 절세팁" tips={tips} profile={profile} tick={tick} />
      <StageBox profile={profile} goGrowth={() => go('growth')} />
      <Reading data={data} youtubeMin={r.total} days={r.period === 'week' ? 7 : 28} notify={notify} />
      <div className="panel">
        <h2 className="p">무엇을 보셨나</h2>
        {r.topics.map((t) => (
          <div className="topic" key={t.topic}>
            <span className="nm">{t.name}</span><span className="ct">{t.n}개 · {hm(t.minutes)}</span>
            <div className="bar" style={{ width: `${(t.n / max) * 100}%` }}>
              <i style={{ width: `${((t.n - t.repeats) / t.n) * 100}%` }} /><i className="rep" style={{ width: `${(t.repeats / t.n) * 100}%` }} />
            </div>
          </div>
        ))}
        <div className="legend"><span><i style={{ background: 'var(--accent)' }} />새로운 내용</span><span><i style={{ background: 'var(--warn)' }} />반복해서 본 내용</span></div>
      </div>
      <div><h2 className="p" style={{ margin: '6px 0 2px' }}>이번 주 처방</h2><p className="hint" style={{ margin: 0 }}>영상은 오늘 써먹을 방법을, 책은 사업을 키우는 생각의 틀을 줍니다.</p></div>
      {r.rx.map((x) => x.consult ? (
        <div className="panel rx" key={x.topic}>
          <div className="rx-h"><h2 className="p" style={{ margin: 0 }}>{x.name}</h2><span className="tagw">영상 {x.n}개</span></div>
          <p className="rx-claim">세금 영상만 <b>{hm(x.minutes)}</b> 보셨어요. {who(profile)} 상황에 딱 맞는 답은 영상에 없습니다. 보신 영상을 분석해 <b>궁금해하실 질문</b>을 정리했어요.</p>
          {r.agenda.length > 0 && <ul className="qlist">{r.agenda.slice(0, 3).map((q) => <li key={q.key}><b>{q.q}</b><span>관련 영상 {q.n}개</span></li>)}</ul>}
          <button className="btn" onClick={() => go('tax')}>이 질문으로 상담받기</button>
        </div>
      ) : <BookRx key={x.topic} r={x} profile={profile} tips={tips} tick={tick} notify={notify} />)}
      {shelf?.length > 0 && <OtherShelf title="영상 밖의 서가" shelf={shelf} profile={profile} onEdit={onEditMe} notify={notify} />}
      <div className="panel">
        <h2 className="p">이번 주 공유 카드</h2>
        <div className="share-card">
          <span className="s">{label} · {profile.industry} {who(profile)}</span>
          <div className="q">이번 주 유튜브 <em>{hm(r.total)}</em>.<br />{r.top.name} 영상 <em>{r.top.n}개</em>{r.top.repeats >= 2 && <> 중 <em>{r.top.repeats}개</em>는 같은 얘기였다.</>}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}><span className="s">당신의 유튜브는 몇 시간?</span><span className="brand">사장님 책갈피</span></div>
        </div>
        <p className="hint" style={{ margin: '8px 0 0' }}>캡처해서 사장님 단톡방에 공유해 보세요.</p>
      </div>
    </div>
  );
}

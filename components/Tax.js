'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/supabase-browser';
import { stagesFor, isBiz, personaOf, taxAgendaFor } from '@/lib/catalog';
import { hm, who, whoLabel, Tip } from './ui';

const OFFICE = process.env.NEXT_PUBLIC_OFFICE_NAME || '담당 세무사';
// 유형별 세금 일정(※ 출시 전 세무사 검수)
const SCHEDULE = {
  indiv: [['원천세 신고·납부 (직원 급여 지급 시)', '매월 10일'], ['부가세 확정신고 (개인 일반·간이과세자)', '1월 25일'], ['종합소득세 신고', '5월 31일']],
  pre: [['사업자등록 (사업 시작 후)', '20일 안'], ['부가세 확정신고 (개인 일반·간이과세자)', '1월 25일'], ['종합소득세 신고', '5월 31일']],
  corp: [['원천세 신고·납부 (직원 급여 지급 시)', '매월 10일'], ['부가세 신고 (법인, 분기별)', '1·4·7·10월 25일'], ['법인세 신고 (12월 결산 법인)', '3월 31일']],
  worker: [['연말정산 서류 제출 (회사 안내에 따라)', '1~2월'], ['종합소득세 신고 (부업 수입·놓친 공제)', '5월 31일']],
  free: [['종합소득세 신고·3.3% 환급', '5월 31일'], ['사업장현황신고 (면세 사업자인 경우)', '2월 10일']],
  student: [['아르바이트 3.3% 환급 (종합소득세 신고)', '5월 31일'], ['첫 직장 연말정산 서류 제출', '1~2월']],
  home: [['연말정산 서류 제출 (맞벌이·자녀 공제)', '1~2월'], ['종합소득세 신고 (부업·임대 수입)', '5월 31일']],
  senior: [['종합소득세 신고 (연금·임대·금융소득)', '5월 31일'], ['재산세 납부', '7월·9월'], ['종합부동산세 납부 (대상자)', '12월 15일']],
};
const STATUS = { new: '접수됨', contacted: '연락드림', done: '상담 완료' };

export default function Tax({ data, profile, tips, tick, notify }) {
  const r = data?.report;
  const persona = profile.persona || profile.form || 'indiv';
  const biz = isBiz(profile);
  const fromVideos = r?.agenda || [];
  // 본 세금 영상 + 유형 + 나이 + 관심 주제로 이 사람에게 맞춘 질문
  const agenda = taxAgendaFor(profile, fromVideos, r?.topics || []);
  const [sel, setSel] = useState(null);
  const [contact, setContact] = useState('');
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/consult').then((d) => setMine(d.requests)).catch(() => {}); }, []);
  useEffect(() => { if (sel === null && agenda.length) setSel(new Set(agenda.slice(0, 3).map((q) => q.q))); }, [agenda, sel]);

  const stages = stagesFor(profile);
  const cur = profile.stage ?? 0, st = stages[cur], nx = stages[Math.min(3, cur + 1)];
  const tax = r?.topics.find((t) => t.topic === 'tax');
  const chosen = sel || new Set();
  const submit = async () => {
    setBusy(true);
    try {
      const topics = chosen.size ? [...chosen] : [`${st.name} 단계 세금 전반 점검`];
      const d = await api('/api/consult', { method: 'POST', body: { topics, contact } });
      setMine((m) => [d.request, ...m]);
      notify('상담을 신청했어요. 담당 세무사가 연락드립니다');
    } catch (e) { notify(e.message); }
    setBusy(false);
  };

  return (
    <div className="stack">
      <div className="wrap-card">
        <div className="wk">{whoLabel(profile)} · {st.name}</div>
        <div className="alarm" style={{ marginTop: 6, paddingTop: 0, borderTop: 0, fontSize: '1rem' }}>{biz ? <>사업이 커질수록 세금은<br /><b>신고</b>가 아니라 <b>설계</b>입니다.</> : <>세금은 <b>아는 만큼</b><br />돌려받고, 덜 냅니다.</>}</div>
        <div className="line" style={{ marginTop: 8 }}>{cur < 3 ? <>{nx.name}로 가면 <b>{nx.key}</b> 같은 일이 새로 생깁니다. 미리 알면 줄일 수 있는 세금이 있습니다.</> : (biz ? '대표 급여, 배당, 승계까지 세금이 사업 전략의 일부가 되는 단계입니다.' : `${st.key}, 미리 계산할수록 남는 것이 커집니다.`)}</div>
      </div>
      <Tip cat="gen" label="오늘의 절세팁" tips={tips} profile={profile} tick={tick} />

      {mine.length > 0 && (
        <div className="panel">
          <h2 className="p">내 상담 신청</h2>
          {mine.map((m) => <div className="sh" key={m.id}><span className="tt">{m.topics.join(' · ')}</span><span className="n">{STATUS[m.status]}<br />{new Date(m.created_at).toLocaleDateString('ko-KR')}</span></div>)}
        </div>
      )}

      <div className="panel">
        <h2 className="p">{fromVideos.length ? '보신 세금 영상과 내 상황으로 정리한 상담 주제' : '나에게 맞춘 세금 질문'}</h2>
        {agenda.length ? <>
          <p className="rx-claim" style={{ marginBottom: 8 }}>{fromVideos.length ? <>세금 관련 영상 {tax?.n || r.taxVideos.length}개{tax && tax.minutes ? `(${hm(tax.minutes)})` : ''}를 분석했어요. 같은 주제를 여러 번 보셨다면 아직 답을 못 찾으셨다는 뜻입니다.</> : `${personaOf(profile).name}${profile.age != null ? ' · 나이대' : ''}${r?.topics?.length ? ' · 관심 주제' : ''}에 맞춰 골랐어요. 궁금한 것을 고르시면 세무사가 내 상황에 맞춰 답해 드려요.`}</p>
          <div className="agenda">{agenda.map((q) => (
            <label className="ag" key={q.key}>
              <input type="checkbox" checked={chosen.has(q.q)} onChange={(e) => { const n = new Set(chosen); e.target.checked ? n.add(q.q) : n.delete(q.q); setSel(n); }} />
              <span><b>{q.q}</b> <span className="kb">{q.why}</span>{q.n > 0 && <span className="hint">관련 영상 {q.n}개 · {q.titles[0]}</span>}<span className="ans">→ {q.a}</span></span>
            </label>
          ))}</div>
        </> : <p className="rx-claim">아직 세금 영상 기록이 없어요. 세금 영상을 공유하면 궁금해하실 질문을 자동으로 정리해 드려요. 지금은 {st.name} 단계에 맞춰 전반을 점검해 드립니다.</p>}
      </div>

      <div className="consult">
        <span className="who">{whoLabel(profile)} · {OFFICE}</span>
        <h3>{tax ? `영상 ${tax.n}개 대신, 세무사 10분 상담` : '세무사 10분 상담'}</h3>
        <p className="hint" style={{ margin: 0 }}>고르신 주제와 최근 세금 관련 영상 제목이 상담 전에 세무사에게 전달됩니다. 처음부터 설명하지 않으셔도 {biz ? `${who(profile)} 사업 숫자로` : '내 상황에 맞춰'} 바로 답해 드립니다.</p>
        <div className="inrow"><input type="text" placeholder="연락받을 번호나 카카오톡 ID (선택)" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
        <button className="btn block" disabled={busy} onClick={submit}>{chosen.size ? `고른 ${chosen.size}가지 주제로 무료 상담 신청` : '무료 상담 신청'}</button>
      </div>

      <div className="panel">
        <h2 className="p">놓치면 안 되는 일정</h2>
        {(SCHEDULE[persona] || SCHEDULE.indiv).map(([t, n]) => <div className="sh" key={t}><span className="tt">{t}</span><span className="n">{n}</span></div>)}
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/supabase-browser';
import { stagesFor } from '@/lib/catalog';
import { hm, who, Tip } from './ui';

const OFFICE = process.env.NEXT_PUBLIC_OFFICE_NAME || '담당 세무사';
const STATUS = { new: '접수됨', contacted: '연락드림', done: '상담 완료' };

export default function Tax({ data, profile, tips, tick, notify }) {
  const r = data?.report;
  const agenda = r?.agenda || [];
  const [sel, setSel] = useState(null);
  const [contact, setContact] = useState('');
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/consult').then((d) => setMine(d.requests)).catch(() => {}); }, []);
  useEffect(() => { if (sel === null && agenda.length) setSel(new Set(agenda.slice(0, 3).map((q) => q.q))); }, [agenda, sel]);

  const stages = stagesFor(profile.form);
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
        <div className="wk">{profile.industry} · {st.name} {who(profile)}</div>
        <div className="alarm" style={{ marginTop: 6, paddingTop: 0, borderTop: 0, fontSize: '1rem' }}>사업이 커질수록 세금은<br /><b>신고</b>가 아니라 <b>설계</b>입니다.</div>
        <div className="line" style={{ marginTop: 8 }}>{cur < 3 ? <>{nx.name}로 가면 <b>{nx.key}</b> 같은 일이 새로 생깁니다. 미리 알면 줄일 수 있는 세금이 있습니다.</> : '대표 급여, 배당, 승계까지 세금이 사업 전략의 일부가 되는 단계입니다.'}</div>
      </div>
      <Tip cat="gen" label="오늘의 절세팁" tips={tips} profile={profile} tick={tick} />

      {mine.length > 0 && (
        <div className="panel">
          <h2 className="p">내 상담 신청</h2>
          {mine.map((m) => <div className="sh" key={m.id}><span className="tt">{m.topics.join(' · ')}</span><span className="n">{STATUS[m.status]}<br />{new Date(m.created_at).toLocaleDateString('ko-KR')}</span></div>)}
        </div>
      )}

      <div className="panel">
        <h2 className="p">{agenda.length ? '보신 세금 영상으로 상담 주제를 정리했어요' : '상담받고 싶은 주제'}</h2>
        {agenda.length ? <>
          <p className="rx-claim" style={{ marginBottom: 8 }}>최근 4주 세금 영상 {tax?.n || r.taxVideos.length}개{tax ? `(${hm(tax.minutes)})` : ''}를 분석했어요. 같은 주제를 여러 번 보셨다면 아직 답을 못 찾으셨다는 뜻입니다.</p>
          <div className="agenda">{agenda.map((q) => (
            <label className="ag" key={q.key}>
              <input type="checkbox" checked={chosen.has(q.q)} onChange={(e) => { const n = new Set(chosen); e.target.checked ? n.add(q.q) : n.delete(q.q); setSel(n); }} />
              <span><b>{q.q}</b><span className="hint">관련 영상 {q.n}개 · {q.titles[0]}</span><span className="ans">→ {q.a}</span></span>
            </label>
          ))}</div>
        </> : <p className="rx-claim">아직 세금 영상 기록이 없어요. 세금 영상을 공유하면 궁금해하실 질문을 자동으로 정리해 드려요. 지금은 {st.name} 단계에 맞춰 전반을 점검해 드립니다.</p>}
      </div>

      <div className="consult">
        <span className="who">{profile.industry} {who(profile)} · {OFFICE}</span>
        <h3>{tax ? `영상 ${tax.n}개 대신, 세무사 10분 상담` : '세무사 10분 상담'}</h3>
        <p className="hint" style={{ margin: 0 }}>고르신 주제와 최근 세금 영상 제목이 상담 전에 세무사에게 전달됩니다. 처음부터 설명하지 않으셔도 {who(profile)} 사업 숫자로 바로 답해 드립니다.</p>
        <div className="inrow"><input type="text" placeholder="연락받을 번호나 카카오톡 ID (선택)" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
        <button className="btn block" disabled={busy} onClick={submit}>{chosen.size ? `고른 ${chosen.size}가지 주제로 무료 상담 신청` : '무료 상담 신청'}</button>
      </div>

      <div className="panel">
        <h2 className="p">놓치면 안 되는 일정</h2>
        <div className="sh"><span className="tt">원천세 신고·납부 (직원 급여 지급 시)</span><span className="n">매월 10일</span></div>
        {profile.form === 'corp' ? <>
          <div className="sh"><span className="tt">부가세 신고 (법인, 분기별)</span><span className="n">1·4·7·10월 25일</span></div>
          <div className="sh"><span className="tt">법인세 신고 (12월 결산 법인)</span><span className="n">3월 31일</span></div>
        </> : <>
          <div className="sh"><span className="tt">부가세 확정신고 (개인 일반·간이과세자)</span><span className="n">1월 25일</span></div>
          <div className="sh"><span className="tt">종합소득세 신고</span><span className="n">5월 31일</span></div>
        </>}
      </div>
    </div>
  );
}

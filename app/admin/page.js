'use client';
import { useEffect, useState } from 'react';
import { supabase, configured, api } from '@/lib/supabase-browser';
import { stagesFor, FORMS } from '@/lib/catalog';

const STATUS = { new: '새 신청', contacted: '연락함', done: '완료' };
const CAT = { gen: '공통(개인)', gen_corp: '공통(법인)', mkt: '마케팅', mkt_b2b: '영업(기업 고객)', sales: '매출', money: '재테크(개인)', money_corp: '재테크(법인)', staff: '직원' };

export default function Admin() {
  const [tab, setTab] = useState('consults');
  const [reqs, setReqs] = useState(null);
  const [tips, setTips] = useState(null);
  const [form, setForm] = useState({ cat: 'gen', text: '' });
  const [err, setErr] = useState('');
  const loadReqs = () => api('/api/admin/consults').then((d) => setReqs(d.requests)).catch((e) => setErr(e.message));
  const loadTips = () => api('/api/admin/tips').then(setTips).catch((e) => setErr(e.message));
  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => { if (!data.session) location.href = '/'; else { loadReqs(); loadTips(); } });
  }, []);
  const act = async (fn) => { try { setErr(''); await fn(); } catch (e) { setErr(e.message); } };

  return (
    <div className="wrap admin" style={{ maxWidth: 960 }}>
      <header className="apphead"><div className="a-h1">사장님 <em>책갈피</em> 관리자</div><a className="sbtn" href="/">앱으로</a></header>
      <nav className="tabs">{[['consults', '상담 신청'], ['tips', '절세 팁']].map(([k, l]) => <button key={k} aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</nav>
      {err && <p className="tip" style={{ color: 'var(--warn)' }}>{err}</p>}

      {tab === 'consults' && <div className="panel">
        <h2 className="p">상담 신청 <span className="hint">· {reqs ? `${reqs.filter((r) => r.status === 'new').length}건 새로 들어옴` : ''}</span></h2>
        {!reqs ? <p className="hint">불러오는 중…</p> : !reqs.length ? <p className="hint">아직 신청이 없어요.</p> : (
          <div className="tw"><table>
            <thead><tr><th>신청일</th><th>신청자</th><th>상담 주제</th><th>최근 세금 영상</th><th>상태</th></tr></thead>
            <tbody>{reqs.map((r) => {
              const p = r.profile; const st = p ? stagesFor(p.form)[p.stage ?? 0] : null;
              return (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString('ko-KR')}</td>
                  <td>{r.email}<br /><span className="hint">{p ? `${FORMS.find((f) => f.key === p.form)?.name || ''} · ${p.industry || ''} · ${st?.name || ''}` : ''}</span>{r.contact && <><br /><b>{r.contact}</b></>}</td>
                  <td><ul style={{ margin: 0, paddingLeft: 16 }}>{r.topics.map((t) => <li key={t}>{t}</li>)}</ul></td>
                  <td className="hint">{r.videos.slice(0, 5).join(' / ')}{r.videos.length > 5 ? ` 외 ${r.videos.length - 5}개` : ''}</td>
                  <td><select value={r.status} onChange={(e) => act(async () => { await api('/api/admin/consults', { method: 'PATCH', body: { id: r.id, status: e.target.value } }); loadReqs(); })}>
                    {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>}

      {tab === 'tips' && <div className="stack">
        <div className="panel stack">
          <h2 className="p" style={{ margin: 0 }}>팁 추가</h2>
          <p className="hint" style={{ margin: 0 }}>한 분류에 팁을 하나라도 등록하면 그 분류는 등록한 팁만 보여요. 등록하지 않은 분류는 기본 팁이 나갑니다.</p>
          <select value={form.cat} onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))}>{Object.entries(CAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <textarea value={form.text} placeholder="예: 종합소득세는 5월 31일까지 신고해요." onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} />
          <div className="acts">
            <button className="btn" onClick={() => act(async () => { await api('/api/admin/tips', { method: 'POST', body: form }); setForm((f) => ({ ...f, text: '' })); loadTips(); })}>추가</button>
            {tips && !tips.tips.length && <button className="btn ghost" onClick={() => act(async () => { await api('/api/admin/tips', { method: 'POST', body: { importDefaults: true } }); loadTips(); })}>기본 팁 {tips.defaults.length}개를 가져와서 수정하기</button>}
          </div>
        </div>
        <div className="panel">
          <h2 className="p">등록한 팁 <span className="hint">· {tips?.tips.length || 0}개</span></h2>
          {tips?.tips.length ? <div className="tw"><table>
            <thead><tr><th>분류</th><th>문구</th><th>표시</th><th /></tr></thead>
            <tbody>{tips.tips.map((t) => (
              <tr key={t.id}>
                <td>{CAT[t.cat] || t.cat}</td>
                <td><textarea defaultValue={t.text} onBlur={(e) => e.target.value !== t.text && act(async () => { await api('/api/admin/tips', { method: 'PATCH', body: { id: t.id, text: e.target.value } }); loadTips(); })} /></td>
                <td><input type="checkbox" checked={t.active} onChange={(e) => act(async () => { await api('/api/admin/tips', { method: 'PATCH', body: { id: t.id, active: e.target.checked } }); loadTips(); })} /></td>
                <td><button className="sbtn" onClick={() => act(async () => { await api(`/api/admin/tips?id=${t.id}`, { method: 'DELETE' }); loadTips(); })}>삭제</button></td>
              </tr>
            ))}</tbody>
          </table></div> : <p className="hint">아직 등록한 팁이 없어 기본 팁이 나가고 있어요.</p>}
        </div>
      </div>}
    </div>
  );
}

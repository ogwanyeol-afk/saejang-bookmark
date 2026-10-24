'use client';
import { useState } from 'react';
import { FORMS, GROUPS, INDUSTRIES, AGES, GENRES, GAPS, stagesFor } from '@/lib/catalog';

const STEPS = ['사업 형태', '업종', '매출 규모', '나에 대해'];

/** 시작 4단계. meOnly = "관심사 수정"으로 4단계만 다시 */
export default function Onboarding({ profile, onSave, onCancel, meOnly, notify }) {
  const [step, setStep] = useState(meOnly ? 3 : 0);
  const [form, setForm] = useState(profile?.form || null);
  const [industry, setIndustry] = useState(profile?.industry || '');
  const [custom, setCustom] = useState(profile?.industry && !INDUSTRIES.some((x) => x.name === profile.industry) ? profile.industry : '');
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState(GROUPS[0][0]);
  const [stage, setStage] = useState(profile?.stage ?? null);
  const [age, setAge] = useState(profile?.age ?? null);
  const [genres, setGenres] = useState(new Set(profile?.genres || []));
  const [gaps, setGaps] = useState(new Set(profile?.gaps || []));
  const [busy, setBusy] = useState(false);
  const who = form === 'corp' ? '대표님' : '사장님';
  const chosen = custom.trim() || industry;

  const save = async () => {
    setBusy(true);
    try {
      await onSave(meOnly
        ? { age, genres: [...genres], gaps: [...gaps] }
        : { form, industry: chosen, stage: form === 'pre' ? 0 : stage, age, genres: [...genres], gaps: [...gaps], onboarded: true });
    } catch (e) { notify?.(e.message); setBusy(false); }
  };
  const toggle = (set, setter, k, max) => {
    const n = new Set(set);
    if (n.has(k)) n.delete(k); else if (!max || n.size < max) n.add(k); else { notify?.(`최대 ${max}개까지 고를 수 있어요`); return; }
    setter(n);
  };
  const dots = !meOnly && (
    <div className="obdots">{STEPS.map((s, i) => <span key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{i + 1}. {s}</span>)}</div>
  );
  const hits = q.trim() ? INDUSTRIES.filter((x) => (x.name + x.group + x.word).replace(/\s/g, '').includes(q.replace(/\s/g, ''))) : null;

  return (
    <div className="wrap"><div className="ob">
      {step === 0 && <>
        <div className="a-h1" style={{ fontSize: '1.5rem' }}>사장님 <em>책갈피</em></div>
        <p className="lead">대표님이 본 유튜브를 매주 리포트로 돌려드리고, 다음 단계로 가는 책과 꼭 알아야 할 세금을 알려드려요. 네 가지만 알려주세요.</p>
        {dots}
        <h3>어떤 형태로 사업하세요?</h3>
        <div className="chips one">{FORMS.map((f) => <button key={f.key} className="chip" aria-pressed={form === f.key} onClick={() => setForm(f.key)}><b>{f.name}</b><span>{f.desc}</span></button>)}</div>
        <button className="btn block" disabled={!form} onClick={() => setStep(1)}>다음</button>
      </>}

      {step === 1 && <>
        <div className="a-h1">어떤 사업을 {form === 'pre' ? '준비하세요' : '하세요'}?</div>{dots}
        <input type="search" placeholder="업종 검색 (예: 치과, 스마트스토어, 인테리어)" value={q} onChange={(e) => setQ(e.target.value)} />
        {hits ? (hits.length
          ? <div className="inds">{hits.map((x) => <button key={x.name} className="ind" aria-pressed={!custom && industry === x.name} onClick={() => { setIndustry(x.name); setCustom(''); }}>{x.name}<small>{x.group}</small></button>)}</div>
          : <p className="hint">"{q}"에 맞는 업종이 없어요. 아래에서 직접 입력해 주세요.</p>)
          : <>
            <div className="grps">{GROUPS.map(([g]) => <button key={g} className="grp" aria-pressed={grp === g} onClick={() => setGrp(g)}>{g}</button>)}</div>
            <div className="inds">{INDUSTRIES.filter((x) => x.group === grp).map((x) => <button key={x.name} className="ind" aria-pressed={!custom && industry === x.name} onClick={() => { setIndustry(x.name); setCustom(''); }}>{x.name}</button>)}</div>
          </>}
        <details className="custom" open={!!custom}><summary>목록에 없어요 · 직접 입력</summary>
          <input type="text" placeholder="예: 드론 촬영, 수제 맥주 양조" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </details>
        <p className="hint" style={{ margin: 0 }}>{chosen ? <>선택: <b>{chosen}</b></> : '업종을 하나 골라 주세요'}</p>
        <div className="acts"><button className="btn ghost" onClick={() => setStep(0)}>이전</button><button className="btn" style={{ flex: 1 }} disabled={!chosen} onClick={() => setStep(form === 'pre' ? 3 : 2)}>다음</button></div>
      </>}

      {step === 2 && <>
        <div className="a-h1">작년 매출은 어느 정도인가요?</div>{dots}
        <p className="lead">{form === 'corp' ? '법인' : '개인사업자'} 기준으로 사업 단계를 정하고, 단계에 맞는 책과 세금 정보를 보여드려요. 구간만 고르시면 됩니다.</p>
        <div className="chips">{stagesFor(form).map((s, i) => <button key={s.name} className="chip" aria-pressed={stage === i} onClick={() => setStage(i)}><b>{s.label}</b><span>{s.name}</span></button>)}</div>
        <div className="acts"><button className="btn ghost" onClick={() => setStep(1)}>이전</button><button className="btn" style={{ flex: 1 }} disabled={stage === null} onClick={() => setStep(3)}>다음</button></div>
      </>}

      {step === 3 && <>
        <div className="a-h1">{who}에 대해 알려주세요</div>{dots}
        <p className="lead">영상으로 보는 주제 말고도 {who}께 필요한 책을 찾아드려요. 고를수록 추천이 다양해지고, 언제든 바꿀 수 있어요.</p>
        <h3>나이대</h3>
        <div className="pills">{AGES.map((a, i) => <button key={a} className="pill" aria-pressed={age === i} onClick={() => setAge(age === i ? null : i)}>{a}</button>)}</div>
        <h3>좋아하거나 읽어보고 싶은 분야 <span className="hint">· 여러 개</span></h3>
        <div className="pills">{Object.entries(GENRES).map(([k, g]) => <button key={k} className="pill" aria-pressed={genres.has(k)} onClick={() => toggle(genres, setGenres, k)}>{g.name}</button>)}</div>
        <h3>요즘 부족하다고 느끼는 지혜 <span className="hint">· 최대 3개</span></h3>
        <div className="pills">{Object.entries(GAPS).map(([k, g]) => <button key={k} className="pill" aria-pressed={gaps.has(k)} onClick={() => toggle(gaps, setGaps, k, 3)}>{g.name}</button>)}</div>
        <div className="acts">
          <button className="btn ghost" onClick={() => (meOnly ? onCancel() : setStep(form === 'pre' ? 1 : 2))}>{meOnly ? '취소' : '이전'}</button>
          <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={save}>{meOnly ? '저장' : '시작하기'}</button>
        </div>
        {!meOnly && <button className="sbtn" style={{ justifySelf: 'center' }} disabled={busy} onClick={save}>건너뛰기</button>}
      </>}
    </div></div>
  );
}

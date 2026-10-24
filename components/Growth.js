'use client';
import { stagesFor } from '@/lib/catalog';
import { who } from './ui';

export default function Growth({ profile, go }) {
  const stages = stagesFor(profile.form);
  const cur = profile.stage ?? 0;
  const counts = stages.map((_, i) => stages.slice(0, i + 1).reduce((a, x) => a + x.tax.length, 0));
  const max = counts.at(-1);
  return (
    <div className="stack">
      <div className="panel thesis">
        <h2 className="p" style={{ margin: 0 }}>사업이 커지면, 대표가 알아야 할 것도 커집니다</h2>
        <div className="row2"><span className="lab">생각</span><p>매출은 사장의 생각 크기를 넘기 어렵습니다. 영상은 오늘의 방법을 알려주지만, <b>다음 단계 사장의 생각</b>은 책에 정리돼 있습니다. 먼저 그 단계를 지나간 사람의 생각을 미리 빌려오는 방법입니다.</p></div>
        <div className="row2"><span className="lab tx">세금</span><p>작을 땐 <b>신고</b>만 하면 되지만, 커지면 <b>설계</b>해야 남습니다. 같은 매출이라도 장부, 과세 유형, 개인·법인 구조에 따라 내는 세금이 크게 달라집니다.</p></div>
      </div>
      <div className="panel">
        <h2 className="p" style={{ margin: 0 }}>단계마다 늘어나는 세금 의무</h2>
        <div className="taxcount">{counts.map((c, i) => <span key={i} className={i <= cur ? 'on' : ''} style={{ height: `${Math.round((c / max) * 100)}%` }}><em>{c}</em></span>)}</div>
        <div className="taxlab">{stages.map((s) => <span key={s.name}>{s.name}</span>)}</div>
        <p className="hint" style={{ margin: '8px 0 0' }}>{who(profile)}은 지금 <b>{stages[cur].name}</b>입니다. {cur < 3 ? `다음 단계로 가면 챙길 세금이 ${counts[cur + 1] - counts[cur]}가지 더 생깁니다.` : '이 단계부터는 세금이 사업 전략의 일부입니다.'}</p>
      </div>
      <div className="road">
        {stages.map((s, i) => {
          const cls = i < cur ? 'past' : i === cur ? 'cur' : i === cur + 1 ? 'nx' : '';
          return (
            <div className={`stg ${cls}`} key={s.name}>
              <div className="stg-h"><b>{s.name} {i === cur && <span className="badge">지금</span>}{i === cur + 1 && <span className="badge">다음 단계</span>}</b><span className="rg">{s.range}</span></div>
              <p className="think">{s.think}</p>
              <div className="sub">이 단계 대표의 책</div>
              <a className="minibook" href={`https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(s.book.title + ' ' + s.book.author)}`} target="_blank" rel="noopener noreferrer"><i style={{ background: `hsl(${200 + i * 30} 42% 36%)` }} /><span><b>{s.book.title}</b> · {s.book.author}</span></a>
              <div className="sub">{i === 0 ? '처음 알아야 할 세금' : '이 단계에서 새로 생기는 세금'}</div>
              <ul>{s.tax.map((t) => <li key={t}>{t}</li>)}</ul>
              {(i === cur + 1 || (i === cur && cur === 3)) && <div className="acts"><button className="btn" onClick={() => go('tax')}>이 단계 세금, 미리 상담받기</button></div>}
            </div>
          );
        })}
      </div>
      <p className="hint">세금 기준 금액은 업종과 시기에 따라 달라질 수 있어 정확한 적용은 상담으로 확인하세요.</p>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { supabase, configured, api } from '@/lib/supabase-browser';
import { topicName, taxqByKey } from '@/lib/catalog';

// 안드로이드 공유 메뉴(Web Share Target)로 들어오는 페이지
export default function SharePage() {
  const [msg, setMsg] = useState('분석 중…');
  const [done, setDone] = useState(false);
  useEffect(() => {
    (async () => {
      if (!configured) { setMsg('앱 설정이 완료되지 않았습니다.'); return; }
      const p = new URLSearchParams(location.search);
      const share = { title: p.get('title') || '', text: p.get('text') || '', url: p.get('url') || '' };
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setMsg('먼저 사장님 책갈피에 로그인해 주세요.'); setDone(true); return; }
      try {
        const [{ saved }, { profile }] = await Promise.all([api('/api/signals', { method: 'POST', body: { share } }), api('/api/profile')]);
        const s = saved?.[0];
        const tq = s?.taxq && taxqByKey(s.taxq);
        setMsg(!s ? '분석할 내용이 없습니다.'
          : s.sensitive ? `"${s.text}" 저장됨 · 민감 주제라 추천에는 쓰지 않습니다`
          : s.topic === 'other' ? `"${s.text}" 저장됨`
          : tq ? `"${s.text}" → 상담 주제에 추가했어요: ${tq.q}`
          : `"${s.text}" → ${topicName(s.topic, profile?.b2b)}${s.sub ? ` · ${s.sub}` : ''}`);
      } catch (e) { setMsg(e.message); }
      setDone(true);
    })();
  }, []);
  return (
    <div className="wrap center">
      <div className="panel stack" style={{ maxWidth: 420 }}>
        <h2 className="p">사장님 책갈피로 보내기</h2>
        <p>{msg}</p>
        {done && <div className="acts" style={{ justifyContent: 'center' }}><a className="btn" href="/">리포트 보기</a></div>}
      </div>
    </div>
  );
}

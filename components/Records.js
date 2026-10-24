'use client';
import { useEffect, useState } from 'react';
import { api, supabase } from '@/lib/supabase-browser';
import { topicName, taxqByKey } from '@/lib/catalog';
import { uploadTakeout } from '@/lib/takeout';
import { Copy } from './ui';

const SRC = { yt: '영상', search: '검색', share: '공유', image: '이미지', like: '좋아요', sub: '구독' };
const LV = ['입문', '실무', '심화', '전문'];
const b64ToU8 = (b64) => { const pad = '='.repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };

function label(s, b2b) {
  if (s.sensitive) return '민감 주제 · 추천 제외';
  if (!s.topic || s.topic === 'other') return '다루지 않는 분야';
  const tq = s.taxq && taxqByKey(s.taxq);
  return `${topicName(s.topic, b2b)}${s.sub ? ` · ${s.sub}` : ''} · ${LV[s.level]}${tq ? ' · 상담 주제 추가' : ''}`;
}

export default function Records({ profile, setProfile, email, notify, reload, onRestart }) {
  const [signals, setSignals] = useState(null);
  const [inp, setInp] = useState({ share: '', search: '', image: '' });
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState('');
  const [push, setPush] = useState('확인 중');
  const [env, setEnv] = useState({ origin: '', ios: false, standalone: false });

  const load = () => api('/api/signals').then((d) => setSignals(d.signals)).catch((e) => notify(e.message));
  useEffect(() => {
    load();
    setEnv({ origin: location.origin, ios: /iPhone|iPad|iPod/.test(navigator.userAgent), standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true });
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPush('지원 안 됨'); return; }
    navigator.serviceWorker.register('/sw.js').then(async (reg) => setPush((await reg.pushManager.getSubscription()) ? '켜짐' : '꺼짐')).catch(() => setPush('지원 안 됨'));
  }, []);

  const send = async (kind) => {
    const v = inp[kind].trim();
    if (!v) return;
    setBusy(kind);
    try {
      const body = kind === 'share' ? { share: { text: v } } : { items: [{ src: kind, text: v }] };
      const { saved } = await api('/api/signals', { method: 'POST', body });
      setInp((x) => ({ ...x, [kind]: '' }));
      if (saved?.[0]) notify(`"${saved[0].text}" → ${label(saved[0], profile.b2b)}`);
      load(); reload();
    } catch (e) { notify(e.message); }
    setBusy('');
  };
  const del = async (q) => { try { await api('/api/signals?' + q, { method: 'DELETE' }); setConfirm(''); load(); reload(); notify('기록을 삭제했습니다'); } catch (e) { notify(e.message); } };
  const patch = async (body, msg) => { try { const d = await api('/api/profile', { method: 'PATCH', body }); setProfile(d.profile); if (msg) notify(msg); if ('exclude_sensitive' in body) reload(); } catch (e) { notify(e.message); } };
  const enablePush = async () => {
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error('알림 키(VAPID)가 설정되지 않았습니다.');
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('알림 권한이 거부되었습니다. 휴대폰 설정에서 허용해 주세요.');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) });
      await api('/api/push', { method: 'POST', body: { subscription: sub.toJSON(), test: true } });
      setPush('켜짐'); notify('알림을 켰습니다. 시험 알림을 보냈어요');
    } catch (e) { notify(e.message); }
  };
  const disablePush = async () => {
    try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); await api('/api/push', { method: 'DELETE' }); setPush('꺼짐'); notify('알림을 껐습니다'); }
    catch (e) { notify(e.message); }
  };
  const row = (kind, title, desc, ph, btn) => (
    <div className="src-row">
      <h3>{title}</h3><p>{desc}</p>
      <form className="inrow" onSubmit={(e) => { e.preventDefault(); send(kind); }}>
        <input id={`in-${kind}`} value={inp[kind]} placeholder={ph} onChange={(e) => setInp((x) => ({ ...x, [kind]: e.target.value }))} />
        <button className="btn" disabled={busy === kind}>{busy === kind ? '분석 중…' : btn}</button>
      </form>
    </div>
  );

  return (
    <div className="stack">
      <div className="panel">
        <h2 className="p">기록 보내기</h2>
        {row('share', '유튜브·블로그 링크', '링크를 붙여넣으면 제목을 읽어 분석합니다. 휴대폰 공유 메뉴로 보내면 더 편해요(아래 설정).', 'https://youtu.be/…', '보내기')}
        {row('search', '검색어', '요즘 찾아본 주제를 적어 주세요.', '예: 간이과세자 부가세 신고', '추가')}
        {row('image', '스크린샷 설명', '캡처한 화면의 내용을 한 줄로 적어 주세요.', '예: 배달앱 리뷰 관리 화면', '추가')}
      </div>

      <div className="panel">
        <h2 className="p">휴대폰 공유 메뉴에 추가</h2>
        <h3>안드로이드</h3>
        <ol className="guide"><li>크롬 오른쪽 위 ⋮ → <b>앱 설치</b>(또는 홈 화면에 추가)</li><li>유튜브에서 <b>공유 → 사장님 책갈피</b>를 누르면 바로 분석됩니다</li></ol>
        <h3 style={{ marginTop: 10 }}>아이폰 (단축어)</h3>
        {!profile.share_token ? <button className="btn ghost" onClick={() => patch({ newShareToken: true }, '공유 토큰을 만들었습니다')}>단축어용 공유 토큰 만들기</button> : <>
          <ol className="guide">
            <li><b>단축어</b> 앱 → <b>+</b> → 이름 "책갈피로 보내기"</li>
            <li>정보(ⓘ) → <b>공유 시트에 표시</b> 켜기, 받을 유형은 <b>URL</b>과 <b>텍스트</b></li>
            <li>동작 <b>URL 콘텐츠 가져오기</b> → URL:<Copy value={`${env.origin}/api/share`} /></li>
            <li>방법 <b>POST</b>, 요청 본문 <b>JSON</b>, 필드 <code>token</code> = 아래 토큰, <code>text</code> = <b>단축어 입력</b><Copy value={profile.share_token} /></li>
            <li>동작 <b>사전 값 가져오기</b>(키 <code>message</code>) → <b>알림 보기</b>에 그 값</li>
          </ol>
          <p className="hint">토큰은 비밀번호처럼 다른 사람에게 알려주지 마세요.</p>
          <button className="sbtn" onClick={() => patch({ newShareToken: true }, '새 토큰을 만들었습니다. 단축어의 토큰도 바꿔 주세요')}>토큰 새로 만들기</button>
        </>}
      </div>

      <div className="panel">
        <h2 className="p">일요일 리포트 알림 <span className="hint">· {push}</span></h2>
        {env.ios && !env.standalone && <p className="hint">아이폰은 Safari 공유 버튼 → <b>홈 화면에 추가</b>로 설치한 뒤, 홈 화면 아이콘으로 열어야 알림을 켤 수 있어요.</p>}
        <p className="hint" style={{ margin: '0 0 8px' }}>매주 일요일 저녁 8시에 리포트를, 세금 영상이 3개 이상이면 상담 주제 알림을 보내드려요.</p>
        {push === '켜짐' ? <button className="btn ghost" onClick={disablePush}>알림 끄기</button> : <button className="btn" onClick={enablePush} disabled={push === '지원 안 됨'}>알림 켜기</button>}
        <label className="toggle" style={{ marginTop: 10 }}><input type="checkbox" checked={profile.exclude_sensitive} onChange={(e) => patch({ exclude_sensitive: e.target.checked })} /> 건강·정치 등 민감 주제는 리포트와 추천에서 제외</label>
      </div>

      <div className="panel">
        <h2 className="p">더 정확하게</h2>
        <div className="src-row" style={{ borderTop: 0, paddingTop: 0 }}>
          <h3>시청 기록 파일 올리기 <span className="hint">· 선택</span></h3><p>시청 시간과 반복 시청까지 보고 싶을 때만 쓰세요. takeout.google.com에서 YouTube 기록(JSON)을 내려받아 올리면 최근 4주만 읽습니다.</p>
          <label className="btn ghost" style={{ position: 'relative', marginTop: 8 }}>
            {busy === 'takeout' ? '분석 중…' : 'watch-history.json 선택'}
            <input type="file" accept=".json,application/json" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} disabled={busy === 'takeout'}
              onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; setBusy('takeout'); try { const n = await uploadTakeout(f); notify(`기록 ${n}건을 분석했어요`); load(); reload(); } catch (err) { notify(err.message); } setBusy(''); }} />
          </label>
        </div>
      </div>

      <div className="panel">
        <h2 className="p">수집된 기록 <span className="hint">· {signals ? `${signals.length}건` : ''}</span></h2>
        <div className="sig">
          {!signals ? <div className="empty">불러오는 중…</div> : !signals.length ? <div className="empty">아직 기록이 없습니다.</div>
            : signals.map((s) => (
              <div className="r" key={s.id}><span className="s">{SRC[s.src]}</span>
                <span className="tx">{s.text}<span className={`c${s.sensitive || s.topic === 'other' ? ' x' : ''}`}>{label(s, profile.b2b)}</span></span>
                <button className="xb" aria-label="삭제" onClick={() => del('id=' + s.id)}>×</button></div>
            ))}
        </div>
        {signals?.length > 0 && <div className="acts">{confirm !== 'sig'
          ? <button className="sbtn" onClick={() => setConfirm('sig')}>기록 전체 삭제</button>
          : <><span className="hint">정말 모두 지울까요?</span><button className="sbtn" style={{ color: 'var(--warn)' }} onClick={() => del('all=1')}>모두 삭제</button><button className="sbtn" onClick={() => setConfirm('')}>취소</button></>}</div>}
      </div>

      <div className="panel">
        <h2 className="p">계정 <span className="hint">· {email}</span></h2>
        <div className="acts">
          <button className="sbtn" onClick={onRestart}>사업 정보 다시 입력</button>
          <a className="sbtn" href="/privacy">개인정보처리방침</a>
          <button className="sbtn" onClick={() => supabase.auth.signOut()}>로그아웃</button>
          {confirm !== 'acc' ? <button className="sbtn" onClick={() => setConfirm('acc')}>회원 탈퇴</button>
            : <><span className="hint">계정과 모든 기록이 지워집니다.</span><button className="sbtn" style={{ color: 'var(--warn)' }} onClick={async () => { try { await api('/api/account', { method: 'DELETE' }); await supabase.auth.signOut(); location.reload(); } catch (e) { notify(e.message); } }}>탈퇴하기</button></>}
        </div>
      </div>
    </div>
  );
}

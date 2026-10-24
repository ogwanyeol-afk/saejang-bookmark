'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase-browser';

export function NotConfigured() {
  return (
    <div className="wrap center"><div className="panel">
      <h2 className="p">설정이 필요합니다</h2>
      <p className="hint">환경변수 <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>가 비어 있습니다. README의 설치 안내를 진행한 뒤 다시 배포해 주세요.</p>
    </div></div>
  );
}

export function Login() {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname + location.search } });
  };
  return (
    <div className="wrap center">
      <div className="ob" style={{ maxWidth: 420 }}>
        <div className="a-h1" style={{ fontSize: '1.7rem' }}>하루 <em>한 쪽</em></div>
        <p className="lead">영상만 보면 남는 게 없습니다. 요즘 관심 있는 주제를 한 단계 깊게 읽을 책으로 바꿔 드리고, 하루 10분 읽는 습관을 만들어 드려요. 직장인, 사장님, 학생, 주부, 시니어 누구나.</p>
        <div className="wrap-card">
          <div className="wk">이번 주 리포트 예시</div>
          <div className="big big-t">요즘 관심 주제: 재테크·경제</div>
          <div className="alarm">좋아요 누른 영상 <b>14개</b>가 같은 주제예요.<br />조각조각 본 내용을 <b>책 한 권</b>으로 정리해 보세요.</div>
        </div>
        <button className="btn block" onClick={go} disabled={busy}>{busy ? '구글로 이동 중…' : '구글 계정으로 시작하기'}</button>
        <a className="hint" href="/privacy" style={{ textAlign: 'center' }}>개인정보처리방침</a>
      </div>
    </div>
  );
}

export function Consent({ onAgree }) {
  const [a, setA] = useState(false), [b, setB] = useState(false), [c, setC] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  return (
    <div className="wrap center">
      <div className="panel consent stack" style={{ maxWidth: 520 }}>
        <h2 className="p">시작 전에 동의가 필요해요</h2>
        <div>
          <h3>수집하는 정보</h3>
          <ul>
            <li>직접 보내주신 영상·글 제목과 링크, 앱 안 검색어, 이미지 설명</li>
            <li>유튜브를 연결하신 경우(선택) 구독 채널 이름과 좋아요 표시한 영상 제목 · 읽기 전용, 시청 기록은 받지 않음</li>
            <li>직접 올리신 구글 테이크아웃 파일의 유튜브 시청·검색 기록 제목과 시각(선택)</li>
            <li>이용자 유형(직장인·사업자 등), 나이대, 관심 분야, 사업자인 경우 업종·매출 구간, 로그인 이메일, 읽은 책·독서 기록, 상담 신청 내용</li>
          </ul>
          <h3>이용 목적과 보관</h3>
          <ul>
            <li>주간 리포트, 책 추천, 세금 상담 주제 정리와 알림에만 씁니다</li>
            <li>제목 분석은 AI(Anthropic Claude)가 처리하며, 광고나 제3자 판매에 쓰지 않습니다</li>
            <li>상담을 신청하면 고른 주제와 최근 세금 관련 영상 제목이 담당 세무사에게 전달됩니다</li>
            <li>기록은 언제든 개별 또는 전체 삭제할 수 있고, 탈퇴 시 모두 지워집니다</li>
          </ul>
        </div>
        <label className="toggle"><input type="checkbox" checked={c} onChange={(e) => setC(e.target.checked)} /> (필수) 만 14세 이상입니다</label>
        <p className="hint" style={{ margin: '-4px 0 0' }}>만 14세 미만은 법에 따라 보호자 동의가 필요해 가입할 수 없어요.</p>
        <label className="toggle"><input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} /> (필수) 위 개인정보 수집·이용에 동의합니다</label>
        <label className="toggle"><input type="checkbox" checked={b} onChange={(e) => setB(e.target.checked)} /> (필수) 콘텐츠 제목을 AI 분석 서비스로 보내는 것에 동의합니다</label>
        {err && <p className="hint" style={{ color: 'var(--warn)' }}>{err}</p>}
        <div className="acts">
          <button className="btn" disabled={!a || !b || !c || busy} onClick={async () => { setBusy(true); setErr(''); try { await onAgree(); } catch (e) { setErr(e.message); setBusy(false); } }}>동의하고 시작</button>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>나가기</button>
          <a className="hint" href="/privacy" style={{ alignSelf: 'center' }}>전문 보기</a>
        </div>
      </div>
    </div>
  );
}

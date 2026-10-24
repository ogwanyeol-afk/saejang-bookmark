export const metadata = { title: '개인정보처리방침 · 사장님 책갈피' };

// 출시 전 운영자 정보(상호, 대표자, 연락처, 시행일)를 반드시 실제 정보로 확인·수정하세요.
const OPERATOR = { name: '해양세무회계', owner: '오관열', email: 'ohtax4888@naver.com', effective: '2026년 ○월 ○일' };

export default function Privacy() {
  return (
    <div className="wrap">
      <div className="panel stack" style={{ lineHeight: 1.7 }}>
        <h1 className="a-h1">개인정보처리방침</h1>
        <p className="hint">{OPERATOR.name}(이하 "운영자")는 사장님 책갈피 이용자의 개인정보를 다음과 같이 처리합니다.</p>
        <h2 className="p">1. 수집 항목</h2>
        <ul>
          <li>필수: 구글 계정 이메일, 계정 식별자</li>
          <li>이용자가 입력한 정보: 사업 형태, 업종, 매출 구간, 나이대, 관심 분야, 부족하다고 느끼는 지혜</li>
          <li>이용자가 직접 보낸 정보: 영상·글 제목과 링크, 앱 안 검색어, 이미지 설명, 구글 테이크아웃 파일의 유튜브 시청·검색 기록 제목과 시각</li>
          <li>서비스 이용 정보: 읽은 책, 상담 신청 내용과 연락처(선택), 알림 구독 정보</li>
        </ul>
        <h2 className="p">2. 이용 목적</h2>
        <p>주간 리포트 작성, 도서 추천, 세무 상담 주제 정리와 상담 연결, 알림 발송에만 이용합니다. 광고 목적이나 제3자 판매에 이용하지 않습니다.</p>
        <h2 className="p">3. 제공</h2>
        <p>이용자가 상담을 신청한 경우에 한해, 고른 상담 주제와 최근 4주 세금 관련 영상 제목, 사업 형태·업종·단계, 이메일과 입력한 연락처를 운영자 소속 세무사가 상담 목적으로 열람합니다.</p>
        <h2 className="p">4. 처리 위탁 및 국외 이전</h2>
        <ul>
          <li>Supabase Inc.: 회원 인증 및 데이터 저장</li>
          <li>Anthropic PBC(미국): 콘텐츠 제목의 주제·수준 분류. 제목 텍스트만 전송하며 이메일 등 식별정보는 보내지 않습니다.</li>
          <li>Cloudflare, Inc.: 서비스 호스팅</li>
          <li>Google LLC: 로그인, 유튜브 영상 길이 조회(영상 ID만 전송)</li>
        </ul>
        <h2 className="p">5. 민감정보</h2>
        <p>건강, 정치, 종교 등 민감한 주제로 분류된 기록은 기본 설정상 리포트와 추천에 사용하지 않으며, 이용자는 언제든 해당 기록을 삭제할 수 있습니다.</p>
        <h2 className="p">6. 보관 및 파기</h2>
        <p>리포트에는 최근 4주 기록을 사용합니다. 이용자는 기록을 개별 또는 전체 삭제할 수 있고, 회원 탈퇴 시 모든 정보는 지체 없이 파기합니다.</p>
        <h2 className="p">7. 이용자의 권리</h2>
        <p>앱의 기록·설정 탭에서 언제든 열람, 삭제, 동의 철회(회원 탈퇴)를 할 수 있습니다.</p>
        <h2 className="p">8. 문의</h2>
        <p>개인정보 보호책임자: {OPERATOR.owner} · {OPERATOR.email}</p>
        <p className="hint">시행일: {OPERATOR.effective}</p>
        <a href="/">← 사장님 책갈피로 돌아가기</a>
      </div>
    </div>
  );
}

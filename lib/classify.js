import Anthropic from '@anthropic-ai/sdk';
import { SENSITIVE_KW, taxqOfTitle, TAXQ } from './catalog';

const TOPIC_KW = {
  tax: ['세금', '절세', '부가세', '종합소득세', '종소세', '법인세', '세무', '간이과세', '노란우산', '경비처리', '가지급금', '원천세', '세무조사', '증여', '상속', '연말정산', '양도세', '13월의 월급', '세금 환급'],
  mkt: ['마케팅', '인스타', '릴스', '광고', '홍보', 'sns', '블로그', '브랜딩', '팔로워', '해시태그', '영업', '거래처', '입찰', '제안서'],
  sales: ['매출', '객단가', '단골', '가격', '리뷰', '메뉴', '손님', '고객', '창업', '장사'],
  money: ['재테크', '투자', '주식', 'etf', '부동산', '노후', '연금', '월급', '배당'],
  staff: ['직원 관리', '알바생', '채용', '주휴수당', '조직 관리', '팀장 리더십'],
  career: ['직장', '회사생활', '이직', '연봉', '면접', '커리어', '퇴사', '일잘러', '보고서', '승진'],
  habit: ['자기계발', '습관', '루틴', '동기부여', '시간관리', '목표', '미라클모닝', '성공'],
  health: ['운동', '수영', '등산', '다이어트', '헬스', '건강', '스트레칭', '식단', '수면', '러닝', '필라테스', '요가'],
  parent: ['육아', '우리 아이', '아이 키우', '자녀', '초등', '유아', '교육', '엄마', '아빠', '훈육', '사춘기'],
  mind: ['심리', '관계', '대화법', '자존감', '연애', '친구', '감정', '마음'],
  humanities: ['철학', '인문학', '교양', '니체', '강연', '고전'],
  history: ['역사', '한국사', '세계사', '조선', '전쟁', '고대'],
  science: ['과학', '우주', 'ai', '인공지능', '챗gpt', '코딩', '물리', '생물', '기술'],
  travel: ['여행', '해외여행', '브이로그 여행', '캠핑', '맛집 투어', '문화유산'],
  food: ['요리', '레시피', '집밥', '살림', '정리', '수납', '청소', '반찬'],
  study: ['공부', '공부법', '시험', '영어', '회화', '일본어', '중국어', '단어', '수능', '자격증', '토익', '영어 공부', '독서법', '집중'],
  fiction: ['소설', '책 추천', '북튜버', '문학', '시집', '작가'],
  pet: ['강아지', '반려견', '고양이', '반려동물', '댕댕', '냥이', '분야: 반려동물'],
  news: ['뉴스', '시사', '라디오', '분야: 뉴스·시사', '분야: 정치·시사', '분야: 사회', '토론', '경제 뉴스'],
};
const LEVEL_KW = [
  ['초보', '기초', '입문', '처음', '왕초보', '쉽게', '시작하는', '개념', '이란'],
  ['실전', '따라하기', '방법', '노하우', '하는 법', '구성법', '만드는 법', '팁', '사례'],
  ['분석', '원리', '전략', '심층', '구조', '비교'],
  ['고급', '전문가', '케이스 스터디', '밸류에이션', '설계'],
];

// 키가 없을 때 쓰는 단순 키워드 분류
// 유튜브 분야가 음악·예능·게임·스포츠 등이면 책과 잇기 어려워 제외
const ENTERTAIN = /분야: (음악|예능|게임|스포츠|코미디|영화|방송)(\]|·)/;

export function classifyByKeyword(text) {
  const t = text.toLowerCase();
  if (ENTERTAIN.test(text) && !/분야: [^\]]*(지식|교육|경영|기술|건강|운동|요리|여행|반려동물)/.test(text)) return { topic: 'other', sub: null, level: 0, taxq: null, sensitive: false };
  if (SENSITIVE_KW.some((w) => t.includes(w))) return { topic: 'other', sub: null, level: 0, taxq: null, sensitive: true };
  let topic = 'other', best = 0, sub = null;
  for (const [k, kws] of Object.entries(TOPIC_KW)) {
    const hit = kws.filter((w) => t.includes(w));
    if (hit.length > best) { best = hit.length; topic = k; sub = hit.find((w) => !w.includes('분야')) || null; }
  }
  let level = 0;
  for (let i = 3; i >= 0; i--) if (LEVEL_KW[i].some((w) => t.includes(w))) { level = i; break; }
  return { topic, sub, level, taxq: topic === 'tax' ? taxqOfTitle(text) : null, sensitive: false };
}

const SYSTEM = `너는 '하루 한 쪽' 독서 앱의 분류기다. 이용자(만 14세 이상 누구나)가 구독한 유튜브 채널, 좋아요 누른 영상 제목, 본 영상 제목, 검색어를 받아 각각 분류한다.

topic (하나만):
- career: 직장 생활, 커리어, 이직, 일 잘하는 법
- habit: 자기계발, 습관, 동기부여, 시간 관리
- money: 재테크, 투자, 경제, 부동산, 노후 자금
- health: 건강, 운동, 다이어트, 식단, 수면
- parent: 육아, 자녀 교육, 부모 역할
- mind: 심리, 인간관계, 대화, 연애, 감정
- humanities: 철학, 인문학, 교양 강연
- history: 역사
- science: 과학, IT, AI, 기술
- travel: 여행, 문화, 캠핑
- food: 요리, 살림, 정리 수납
- study: 공부법, 시험, 자격증, 어학, 독서법
- fiction: 소설, 문학, 책 리뷰
- pet: 반려동물, 강아지·고양이 훈련
- news: 시사, 뉴스, 사회 이슈 해설(정당·선거 지지 내용은 sensitive)
- mkt: (사업) 마케팅, SNS 홍보, 광고, 브랜딩, 영업
- sales: (사업) 장사, 매출, 가격, 창업 실무
- staff: (사업) 직원 채용·관리, 조직 운영
- tax: 세금, 절세, 연말정산, 신고, 상속·증여, 4대보험
- other: 예능, 음악, 게임, 스포츠 중계, 연예, 먹방 등 책과 이어지기 어려운 것

입력에는 제목 뒤에 [분야: …], 키워드, #태그, 채널 소개가 붙을 수 있다. 이 힌트를 함께 보고 판단하라. 구독 채널은 '(구독 채널)'로 표시되며, 채널 이름과 힌트로 그 채널이 주로 다루는 내용을 판단한다. 소개글의 광고·협찬 문의 문구는 무시한다. [분야: 음악·예능·게임·스포츠]는 대개 other다.

sub: 같은 내용을 반복해서 보는지 판단할 수 있게, 구체적 소주제를 2~6글자 한국어 명사로 (예: "릴스 알고리즘", "연말정산", "홈트", "사춘기"). 같은 이야기를 다루는 제목은 같은 sub를 써라.
level: 0 입문 · 1 실무 · 2 심화 · 3 전문
taxq: topic이 tax일 때만, 아래 키 중 가장 가까운 것 하나(없으면 null)
${TAXQ.map((x) => `- ${x.key}: ${x.q}`).join('\n')}
sensitive: 건강·질병 진단·정신건강, 정치·선거, 종교, 성생활 등 민감한 주제면 true (이때 topic은 other). 일반적인 운동·식단은 민감하지 않음(health).

반드시 입력 순서대로 JSON 배열만 출력: [{"i":0,"topic":"mkt","sub":"릴스 알고리즘","level":0,"taxq":null,"sensitive":false}, ...]`;

const TOPICS = new Set(['mkt', 'tax', 'sales', 'money', 'staff', 'career', 'habit', 'health', 'parent', 'mind', 'humanities', 'history', 'science', 'travel', 'food', 'study', 'fiction', 'pet', 'news', 'other']);
const TAXQ_KEYS = new Set(TAXQ.map((x) => x.key));

export async function classifyMany(texts) {
  if (!texts.length) return [];
  if (!process.env.ANTHROPIC_API_KEY) return texts.map(classifyByKeyword);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const out = new Array(texts.length);

  for (let start = 0; start < texts.length; start += 40) {
    const chunk = texts.slice(start, start + 40);
    try {
      const res = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: 'user', content: chunk.map((t, i) => `${i}. ${t}`).join('\n') }],
      });
      const raw = res.content.map((c) => c.text || '').join('');
      const arr = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));
      for (const r of arr) {
        if (typeof r.i !== 'number' || r.i < 0 || r.i >= chunk.length) continue;
        const topic = TOPICS.has(r.topic) ? r.topic : 'other';
        out[start + r.i] = {
          topic,
          sub: typeof r.sub === 'string' ? r.sub.slice(0, 20) : null,
          level: Math.min(3, Math.max(0, Number(r.level) || 0)),
          taxq: topic === 'tax' ? (TAXQ_KEYS.has(r.taxq) ? r.taxq : taxqOfTitle(chunk[r.i])) : null,
          sensitive: !!r.sensitive,
        };
      }
    } catch (e) {
      console.error('classify failed, falling back', e?.message);
    }
    for (let i = 0; i < chunk.length; i++) if (!out[start + i]) out[start + i] = classifyByKeyword(chunk[i]);
  }
  return out;
}

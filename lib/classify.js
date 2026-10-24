import Anthropic from '@anthropic-ai/sdk';
import { SENSITIVE_KW, taxqOfTitle, TAXQ } from './catalog';

const TOPIC_KW = {
  tax: ['세금', '절세', '부가세', '종합소득세', '종소세', '법인세', '세무', '간이과세', '노란우산', '경비처리', '가지급금', '원천세', '세무조사', '증여', '상속'],
  mkt: ['마케팅', '인스타', '릴스', '광고', '홍보', 'sns', '블로그', '브랜딩', '팔로워', '해시태그', '영업', '거래처', '입찰', '제안서'],
  sales: ['매출', '객단가', '단골', '가격', '리뷰', '메뉴', '손님', '고객', '창업', '장사'],
  money: ['재테크', '투자', '주식', 'etf', '부동산', '노후', '연금', '월급', '배당'],
  staff: ['직원', '알바', '채용', '주휴수당', '면접', '조직', '팀장', '퇴사'],
};
const LEVEL_KW = [
  ['초보', '기초', '입문', '처음', '왕초보', '쉽게', '시작하는', '개념', '이란'],
  ['실전', '따라하기', '방법', '노하우', '하는 법', '구성법', '만드는 법', '팁', '사례'],
  ['분석', '원리', '전략', '심층', '구조', '비교'],
  ['고급', '전문가', '케이스 스터디', '밸류에이션', '설계'],
];

// 키가 없을 때 쓰는 단순 키워드 분류
export function classifyByKeyword(text) {
  const t = text.toLowerCase();
  if (SENSITIVE_KW.some((w) => t.includes(w))) return { topic: 'other', sub: null, level: 0, taxq: null, sensitive: true };
  let topic = 'other', best = 0, sub = null;
  for (const [k, kws] of Object.entries(TOPIC_KW)) {
    const hit = kws.filter((w) => t.includes(w));
    if (hit.length > best) { best = hit.length; topic = k; sub = hit[0]; }
  }
  let level = 0;
  for (let i = 3; i >= 0; i--) if (LEVEL_KW[i].some((w) => t.includes(w))) { level = i; break; }
  return { topic, sub, level, taxq: topic === 'tax' ? taxqOfTitle(text) : null, sensitive: false };
}

const SYSTEM = `너는 사장님용 독서 앱의 분류기다. 사장님이 본 유튜브 영상 제목, 검색어, 공유한 글 제목을 받아 각각 분류한다.

topic (하나만):
- mkt: 마케팅, SNS, 광고, 홍보, 브랜딩, 영업, 거래처 확보
- tax: 세금, 절세, 신고, 세무, 4대보험, 증여·상속
- sales: 매출, 가격, 고객 관리, 상품·메뉴 구성, 장사 노하우, 창업 실무
- money: 대표 개인의 재테크, 투자, 부동산, 노후
- staff: 직원 채용·관리, 조직, 리더십 실무
- other: 위에 해당하지 않음

sub: 같은 내용을 반복해서 보는지 판단할 수 있게, 영상의 구체적 소주제를 2~6글자 한국어 명사로 (예: "릴스 알고리즘", "간이과세", "객단가", "주휴수당"). 같은 이야기를 다루는 제목은 같은 sub를 써라.
level: 0 입문 · 1 실무 · 2 심화 · 3 전문
taxq: topic이 tax일 때만, 아래 키 중 가장 가까운 것 하나(없으면 null)
${TAXQ.map((x) => `- ${x.key}: ${x.q}`).join('\n')}
sensitive: 건강·질병·정신건강, 정치·선거, 종교, 성생활 등 민감한 주제면 true (이때 topic은 other)

반드시 입력 순서대로 JSON 배열만 출력: [{"i":0,"topic":"mkt","sub":"릴스 알고리즘","level":0,"taxq":null,"sensitive":false}, ...]`;

const TOPICS = new Set(['mkt', 'tax', 'sales', 'money', 'staff', 'other']);
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

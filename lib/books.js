// 도서 정보와 "새 책 3권" 가져오기
// 0번째 묶음 = 큐레이션(catalog.js), 이후 = 알라딘 · 카카오 · 네이버 · 도서관 정보나루 · Google 도서 · 국립중앙도서관을
// 검색어를 바꿔 가며 돌아가며 호출합니다(키가 없는 출처는 건너뜀, Google 도서는 키 없이도 동작).
// 교보문고·예스24·영풍문고는 공개 API가 없어 '구매 링크'로만 연결합니다.
import { topicBooks, topicQueries, GENRES, GAPS, AGE_PICK, MORE_QUERIES } from './catalog';

const cache = new Map();
const clip = (s, n) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const cleanAuthor = (a) => clip(a, 80).replace(/\s*\((지은이|옮긴이|엮은이|글|그림)\)/g, '').split(/[,;]/)[0].replace(/^지은이\s*:\s*/, '').replace(/\s*(지음|저|글|편저|엮음)$/, '').trim();
const cleanTitle = (t) => clip(t, 120).replace(/\s*[-:]\s.*$/, '').trim();

export function withLinks(b) {
  const q = b.isbn13 || `${b.title} ${b.author || ''}`.trim();
  return {
    ...b,
    kyoboUrl: `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(q)}`,
    aladinUrl: b.aladinUrl || `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=${encodeURIComponent(b.title)}`,
    yes24Url: `https://www.yes24.com/Product/Search?domain=BOOK&query=${encodeURIComponent(b.isbn13 || b.title)}`,
  };
}

async function getJson(url, ms = 5000, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    return await res.text();
  } finally { clearTimeout(t); }
}

async function aladin(params) {
  const key = process.env.ALADIN_TTB_KEY;
  if (!key) return null;
  const url = 'https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?' + new URLSearchParams({
    ttbkey: key, SearchTarget: 'Book', output: 'js', Version: '20131101', Cover: 'Big', ...params,
  });
  try {
    const text = (await getJson(url)).trim().replace(/;$/, '').replace(/\\'/g, "'");
    return JSON.parse(text).item || [];
  } catch (e) { console.error('aladin', e?.message); return []; }
}
const fromAladin = (it) => withLinks({
  title: cleanTitle(it.title), author: cleanAuthor(it.author), publisher: it.publisher || '',
  cover: it.cover || null, isbn13: it.isbn13 || null, description: clip(it.description, 200), aladinUrl: it.link,
});

// 큐레이션 도서에 표지·소개를 붙임(알라딘 키가 없으면 링크만)
export async function enrich(book) {
  if (!book) return null;
  if (cache.has(book.title)) return cache.get(book.title);
  let out = withLinks({ ...book, cover: null, isbn13: null, description: '' });
  const items = await aladin({ Query: book.title, QueryType: 'Title', MaxResults: '5', start: '1' });
  if (items?.length) {
    const norm = (x) => String(x || '').replace(/\s/g, '');
    const hit = items.find((it) => norm(it.title).startsWith(norm(book.title)) && it.author?.includes(book.author.split(' ')[0]))
      || items.find((it) => norm(it.title).startsWith(norm(book.title)));
    if (hit) out = withLinks({ ...fromAladin(hit), title: book.title, author: book.author });
  }
  if (!out.cover) { // 알라딘 키가 없으면 카카오 → 네이버 → Google 도서에서 표지·소개만 찾음
    for (const src of ['kakao', 'naver', 'google']) {
      const list = await SOURCES[src](`${book.title} ${book.author.split(' ')[0]}`, 1, null, true).catch(() => null);
      const norm = (x) => String(x || '').replace(/\s/g, '');
      const hit = (list || []).find((b) => norm(b.title).startsWith(norm(book.title)) && b.cover);
      if (hit) { out = withLinks({ ...hit, title: book.title, author: book.author }); break; }
    }
  }
  cache.set(book.title, out);
  return out;
}

// 수험서·문제집·전집·잡지 등은 추천에서 뺌
const JUNK = /(기출|문제집|수험|자격증|교재|워크북|모의고사|합격|전집|세트|\(전 ?\d+권\)|잡지|월간|매거진|e-?book|오디오북|큰글자|큰 글자|단어장|필사)/i;
const okBook = (b) => b.title && b.title.length > 1 && b.author && !JUNK.test(b.title);
const isbn13Of = (s) => (String(s || '').split(' ').find((x) => x.length === 13) || null);

const SOURCES = {
  async kakao(query, page, _dr, lookup) {
    const key = process.env.KAKAO_REST_KEY;
    if (!key) return null;
    const url = 'https://dapi.kakao.com/v3/search/book?' + new URLSearchParams({ query, page: String(Math.min(page, 50)), size: lookup ? '5' : '30', sort: 'accuracy' });
    try {
      const j = JSON.parse(await getJson(url, 5000, { Authorization: `KakaoAK ${key}` }));
      return (j.documents || []).map((d) => withLinks({
        title: cleanTitle(d.title), author: cleanAuthor((d.authors || [])[0]), publisher: d.publisher || '',
        cover: d.thumbnail || null, isbn13: isbn13Of(d.isbn), description: clip(d.contents, 200),
      })).filter(okBook);
    } catch (e) { console.error('kakao', e?.message); return []; }
  },
  async naver(query, page, _dr, lookup) {
    const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
    if (!id || !secret) return null;
    const display = lookup ? 5 : 30;
    const url = 'https://openapi.naver.com/v1/search/book.json?' + new URLSearchParams({ query, display: String(display), start: String(Math.min(1 + (page - 1) * display, 1000)), sort: 'sim' });
    try {
      const j = JSON.parse(await getJson(url, 5000, { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }));
      return (j.items || []).map((d) => withLinks({
        title: cleanTitle(d.title), author: cleanAuthor(String(d.author || '').split('^')[0]), publisher: d.publisher || '',
        cover: d.image || null, isbn13: isbn13Of(d.isbn), description: clip(d.description, 200),
      })).filter(okBook);
    } catch (e) { console.error('naver', e?.message); return []; }
  },
  async google(query, page, _dr, lookup) {
    const n = lookup ? 5 : 30;
    const url = 'https://www.googleapis.com/books/v1/volumes?' + new URLSearchParams({
      q: query, langRestrict: 'ko', printType: 'books', orderBy: 'relevance', maxResults: String(n), startIndex: String((page - 1) * n),
      ...(process.env.GOOGLE_BOOKS_KEY ? { key: process.env.GOOGLE_BOOKS_KEY } : {}),
    });
    try {
      const j = JSON.parse(await getJson(url));
      return (j.items || []).map((it) => it.volumeInfo || {}).filter((v) => v.language === 'ko' || /[가-힣]/.test(v.title || '')).map((v) => withLinks({
        title: cleanTitle(v.title), author: cleanAuthor((v.authors || [])[0]), publisher: v.publisher || '',
        cover: v.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
        isbn13: (v.industryIdentifiers || []).find((x) => x.type === 'ISBN_13')?.identifier || null, description: clip(v.description, 200),
      })).filter(okBook);
    } catch (e) { console.error('google books', e?.message); return []; }
  },
  async aladin(query, page) {
    const items = await aladin({ Query: query, QueryType: 'Keyword', Sort: 'SalesPoint', MaxResults: '20', start: String(page) });
    return items === null ? null : items.map(fromAladin);
  },
  async library(query, page) {
    const key = process.env.LIBRARY_API_KEY;
    if (!key) return null;
    const url = 'https://data4library.kr/api/srchBooks?' + new URLSearchParams({
      authKey: key, keyword: query, pageNo: String(page), pageSize: '20', sort: 'loan', order: 'desc', format: 'json',
    });
    try {
      const j = JSON.parse(await getJson(url));
      return (j.response?.docs || []).map((d) => d.doc).map((d) => withLinks({
        title: cleanTitle(d.bookname), author: cleanAuthor(d.authors), publisher: d.publisher || '',
        cover: d.bookImageURL || null, isbn13: d.isbn13 || null, description: '',
      }));
    } catch (e) { console.error('library', e?.message); return []; }
  },
  async nl(_query, page, drCode) {
    const key = process.env.NL_API_KEY;
    if (!key) return null;
    const from = (page - 1) * 20 + 1;
    const url = 'https://nl.go.kr/NL/search/openApi/saseoApi.do?' + new URLSearchParams({
      key, startRowNumApi: String(from), endRowNumApi: String(from + 19), drCode: String(drCode || 5),
    });
    try {
      const xml = await getJson(url);
      const tag = (s, n) => (s.match(new RegExp(`<${n}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${n}>`)) || [])[1] || '';
      return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => withLinks({
        title: cleanTitle(tag(it, 'recomtitle')), author: cleanAuthor(tag(it, 'recomauthor')), publisher: clip(tag(it, 'recompublisher'), 40),
        cover: tag(it, 'recomfilepath') || null, isbn13: clip(tag(it, 'recomisbn'), 13) || null, description: clip(tag(it, 'recomcontens'), 200),
      })).filter((b) => b.title);
    } catch (e) { console.error('nl', e?.message); return []; }
  },
};
const SRC_LABEL = { aladin: '알라딘 판매 인기', kakao: '카카오 책 검색', naver: '네이버 책 검색', library: '도서관 정보나루 인기 대출', google: 'Google 도서', nl: '국립중앙도서관 사서 추천' };
const ORDER = ['aladin', 'kakao', 'naver', 'library', 'google', 'nl'];

// spec: "topic:mkt" | "genre:philo" | "gap:decide", b2b: 영업 버전 여부
export function specInfo(spec, b2b) {
  const base = specBase(spec, b2b);
  if (!base) return null;
  const more = MORE_QUERIES[spec === 'topic:mkt' && b2b ? 'topic:mkt:b2b' : spec] || [];
  return { ...base, queries: [...new Set([...base.queries, ...more])] };
}

function specBase(spec, b2b) {
  const [kind, key] = String(spec).split(':');
  if (kind === 'topic') return { curated: topicBooks(key, b2b), queries: topicQueries(key, b2b), drCode: 5 };
  if (kind === 'genre' && GENRES[key]) return { curated: GENRES[key].books, queries: [GENRES[key].query], drCode: { novel: 11, essay: 11, science: 4, tax: 5 }[key] || 6 };
  if (kind === 'age' && AGE_PICK[key]) {
    const g = Object.values(GENRES).find((x) => x.name === AGE_PICK[key].cat) || GENRES.essay;
    return { curated: [AGE_PICK[key].book, ...g.books], queries: [g.query], drCode: 6 };
  }
  if (kind === 'gap' && GAPS[key]) return { curated: GAPS[key].books, queries: [GAPS[key].query], drCode: 6 };
  return null;
}

/** 묶음 하나(3권). batch 0 = 큐레이션, 1부터 외부 API. exclude = 이미 본 제목들 */
export async function fetchBatch(spec, batch, exclude = [], b2b = false) {
  const info = specInfo(spec, b2b);
  if (!info) return { src: null, books: [], next: null };
  const seen = new Set(exclude.map((t) => t.replace(/\s/g, '')));
  const fresh = (list) => list.filter((b) => {
    const k = b.title?.replace(/\s/g, '');
    if (!k || seen.has(k)) return false;
    seen.add(k); // 같은 묶음 안 중복도 제거
    return true;
  });

  if (batch === 0) {
    const books = await Promise.all(fresh(info.curated).slice(0, 3).map(enrich));
    return { src: '책갈피 큐레이션', books, next: 1 };
  }
  // 묶음마다 검색어와 출처를 함께 바꿈 → 같은 주제라도 계속 다른 책
  // n번째 묶음: 출처 = n % S, 검색어도 매번 바뀜, 조합을 다 쓰면 다음 페이지
  const Q = info.queries.length, S = ORDER.length;
  for (let tries = 0; tries < S * 3; tries++) {
    const n = batch - 1 + tries;
    const source = ORDER[n % S];
    const query = info.queries[(n + Math.floor(n / S)) % Q]; // 출처가 일부만 있어도 검색어가 고루 돌도록
    const page = 1 + Math.floor(n / (Q * S));
    const list = await SOURCES[source](query, page, info.drCode);
    if (list === null) continue; // 키 없음
    const books = fresh(list).slice(0, 3);
    if (books.length) return { src: `${SRC_LABEL[source]} · ${query}`, books, next: n + 2 };
  }
  return { src: null, books: [], next: null };
}

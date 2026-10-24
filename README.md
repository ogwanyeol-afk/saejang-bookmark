# 사장님 책갈피 (웹앱 · Cloudflare Workers 버전)

대표님이 본 유튜브를 주간 리포트로 돌려드리고, 반복해서 본 영상은 책 한 권으로, 세금 영상은 세무사 상담으로 연결하는 앱입니다. 휴대폰에서 홈 화면에 설치해 앱처럼 씁니다.

## 기능

| 화면 | 내용 |
|---|---|
| 시작 | 구글 로그인 → 필수 동의 2개 → 사업 형태(개인·법인·창업 준비) → 업종(12개 분류 50여 개, 검색, 직접 입력) → 매출 구간 → 나에 대해(나이대·관심 분야·부족한 지혜, 건너뛰기 가능) |
| 첫 리포트 | 구글 테이크아웃 `watch-history.json` 업로드 → 최근 4주 기록을 AI가 분석 |
| 이번 주 리포트 | 시청 시간·영상 수, 같은 소주제 반복 시청, 주제별 막대, 사업 단계 카드, 오늘의 절세팁, 주제별 처방 책(3권씩 → 다 보면 외부 API에서 새 3권), 세금 영상 → 상담 질문, 영상 밖의 서가, 공유 카드 |
| 성장 지도 | 생각·세금 두 메시지, 단계별 세금 의무 막대, 단계별 책과 세금(개인·법인·창업 준비 따로) |
| 세무 상담 | 본 세금 영상으로 정리한 상담 주제 체크 → 상담 신청(연락처 선택) → 내 신청 상태, 신고 일정 |
| AI가 일하는 동안, 10분 읽기 | 리포트·내 책장의 카드에서 "AI에게 일 맡겼어요" → 읽을 책 고르기(이어 읽기·처방 책·다른 서가·직접 입력) → 10/20/30분 타이머(화면을 꺼도, 앱을 다시 열어도 이어짐, 끝나면 진동·알림) → 쪽수와 기억하고 싶은 한 줄 기록. 같은 기간 유튜브 시간과 독서 시간을 막대로 비교 |
| 내 책장 | 독서 기록 전체(지우기 가능), 나를 위한 다른 서가, 다 읽은 책 |
| 기록·설정 | 링크·검색어·스크린샷 설명 보내기, 테이크아웃 재업로드, 안드로이드 공유 메뉴·아이폰 단축어, 일요일 알림, 민감 주제 제외, 기록 삭제, 사업 정보 재입력, 탈퇴 |
| 관리자 `/admin` | 상담 신청 목록(신청자 업종·단계, 고른 주제, 최근 세금 영상, 연락처, 상태 변경), 절세 팁 추가·수정·숨김 |

**자동 처리**
- AI 분류: 제목마다 주제·소주제·수준·세금 상담 주제(Claude). 키가 없으면 키워드 규칙
- 영상 길이: YouTube Data API(키가 없으면 영상당 11분으로 계산하고 화면에 표시)
- 새 책: 큐레이션 → 알라딘 판매 인기 → 도서관 정보나루 인기 대출 → 국립중앙도서관 사서 추천 순서로 돌아가며, 키가 없는 출처는 건너뜀
- 알림: 매주 일요일 20:00 주간 리포트(유튜브·독서 시간), 세금 영상 3개 이상이면 상담 알림 추가, 매주 수요일 15:00 "AI가 일하는 동안 10분 읽기" 알림

## 구조 (Cloudflare Workers 버전)

| 무엇 | 어디서 |
|---|---|
| 화면·API | Cloudflare Workers (Next.js 15를 OpenNext 어댑터로 변환해 실행) |
| 로그인·데이터 | Supabase (구글 로그인, Postgres) |
| 정해진 시각 알림 | Cloudflare Cron Triggers → `worker.js`가 `/api/cron/weekly`(일 20:00), `/api/cron/read`(수 15:00) 호출 |
| 웹 푸시 | Web Crypto로 암호화해 직접 발송(`lib/push.js`) |
| 배포 | GitHub에 올리면 Cloudflare Workers Builds가 자동 빌드·배포 |

## 설치

### 1. GitHub
새 저장소에 이 폴더를 올립니다(`node_modules`, `.next`, `.open-next` 제외).

### 2. Supabase (데이터베이스·로그인)
1. [supabase.com](https://supabase.com)에서 New project를 만듭니다(지역은 Seoul).
2. SQL Editor에 `supabase/schema.sql` 전체를 붙여넣고 Run을 누릅니다.
3. Project Settings → API에서 URL, anon 키, service_role 키를 복사합니다.
4. 구글 로그인을 켭니다.
   1. Google Cloud Console에서 OAuth 동의 화면을 만들고, OAuth 클라이언트(웹)를 만듭니다.
   2. 리디렉션 URI는 `https://<프로젝트ID>.supabase.co/auth/v1/callback`입니다.
   3. 받은 ID와 비밀번호를 Supabase Authentication → Providers → Google에 넣습니다.

### 3. Cloudflare Workers
1. [dash.cloudflare.com](https://dash.cloudflare.com)에 가입합니다(무료).
2. **Workers & Pages → Create → Import a repository**로 들어가 GitHub를 연결하고 1번 저장소를 고릅니다.
3. 설정을 다음과 같이 넣습니다.
   - Project name: `saejang-bookmark` (`wrangler.jsonc`의 `name`과 같아야 합니다)
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - **Build variables**(빌드 때 화면 코드에 들어가는 공개 값):

     | 이름 | 값 |
     |---|---|
     | `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 |
     | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 웹 푸시 공개키 |
     | `NEXT_PUBLIC_OFFICE_NAME` | 부산 해양세무회계 |

4. Deploy를 누릅니다. 약 3~5분 뒤 `https://saejang-bookmark.<계정이름>.workers.dev` 주소가 생깁니다.
5. 만들어진 워커 → **Settings → Variables and Secrets**에서 아래 값을 **Secret** 종류로 추가합니다. 비워 둔 기능은 건너뛰고 동작합니다.

   | 이름 | 내용 |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 (필수) |
   | `CRON_SECRET` | 아무 긴 임의 문자열 (필수) |
   | `VAPID_PRIVATE_KEY` | 웹 푸시 비밀키 (알림을 쓸 때) |
   | `ANTHROPIC_API_KEY` | Claude 키 (없으면 키워드 분류) |
   | `ALADIN_TTB_KEY`, `LIBRARY_API_KEY`, `NL_API_KEY` | 도서 API (없으면 그 출처를 건너뜀) |
   | `YOUTUBE_API_KEY` | 영상 길이 조회 (없으면 영상당 11분) |

   `ADMIN_EMAILS`, `ANTHROPIC_MODEL`, `VAPID_SUBJECT`는 `wrangler.jsonc`의 `vars`에 이미 들어 있습니다.
6. 4번 주소를 Supabase Authentication → URL Configuration의 Site URL과 Redirect URLs에 넣습니다.
7. **Settings → Triggers**에 크론 2개(`0 11 * * 0`, `0 6 * * 3`, UTC 기준)가 보이면 정상입니다.
8. (선택) **Settings → Domains & Routes**에서 내 도메인(예: `book.도메인`)을 연결합니다. 연결한 뒤에는 6번 주소도 바꿔 줍니다.

### 4. 웹 푸시 키
- Node가 설치된 컴퓨터에서 이 폴더에 `npm install`을 한 뒤 `npm run vapid`를 실행합니다.
- 나온 두 줄 중 공개키는 Build variables(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`)에, 비밀키는 Secret(`VAPID_PRIVATE_KEY`)에 넣습니다.

### 5. 요금제
- **무료:** 하루 10만 요청, 요청당 CPU 10ms까지입니다. 시험에는 충분합니다.
- **Workers Paid(월 $5):** 페이지가 무거워 1102 오류가 보이거나 정식으로 공개할 때 전환합니다. 요청당 CPU 30초까지, 크론 30초까지 쓸 수 있습니다.

### 6. 확인
1. 휴대폰으로 접속해 홈 화면에 설치합니다.
2. 구글로 로그인하고 시작 4단계를 마칩니다.
3. `watch-history.json`을 올려 리포트가 나오는지 봅니다.
4. 10분 읽기를 기록해 봅니다.
5. 기록·설정에서 알림을 켭니다.
6. `/admin`에서 상담 신청이 보이는지 확인합니다.

크론을 바로 시험하려면 워커 → Settings → Triggers에서 실행하거나 아래처럼 호출합니다.
`curl -H "Authorization: Bearer <CRON_SECRET>" https://<주소>/api/cron/weekly`

### 내 컴퓨터에서 시험 (선택)
1. `npm install`을 실행합니다.
2. `.dev.vars.example`을 `.dev.vars`로 복사하고 값을 채웁니다.
3. `.env.production.local`에 `NEXT_PUBLIC_` 값들을 넣습니다.
4. `npm run preview`를 실행합니다. Workers 런타임으로 `localhost:8787`에서 열립니다.

이미 Supabase에 이전 스키마를 실행했다면 `supabase/schema.sql`을 한 번 더 실행하면 됩니다. 새로 생긴 독서 기록 테이블만 추가됩니다.

## 바꾸고 싶을 때

| 무엇을 | 어디서 |
|---|---|
| 업종 목록, 단계별 세금·책, 주제별 큐레이션 책, 관심 분야·지혜별 책, 상담 주제 문장 | `lib/catalog.js` |
| 절세 팁 | 관리자 화면 `/admin` → 절세 팁 (코드 수정 없이) |
| AI 분류 기준 | `lib/classify.js`의 `SYSTEM` |
| 반복 시청·리포트 계산 | `lib/report.js` |
| 외부 도서 API 순서·검색어 | `lib/books.js`, `lib/catalog.js`의 `queries` |
| 알림 시각 | `wrangler.jsonc`의 `triggers.crons`와 `worker.js`의 `CRONS` (둘 다 UTC, 함께 바꿈) |
| 사무실 이름 | 환경변수 `NEXT_PUBLIC_OFFICE_NAME` |

## 출시 전 체크리스트
- [ ] `app/privacy/page.js` 운영자 정보와 시행일 확인
- [ ] `lib/catalog.js`의 세금 기준 금액과 기본 절세 팁 세무사 검수(간이과세·복식부기·성실신고 기준, 노란우산 한도 등)
- [ ] 큐레이션 도서 목록 검토
- [ ] 알라딘 표지 이미지 사용 조건 확인
- [ ] Google OAuth 동의 화면 "게시" 전환
- [ ] 상담 신청 시 세무사에게 정보가 전달된다는 동의 문구 법률 검토

## 알려진 한계
- 유튜브 시청 기록은 공식 API로 자동 수집할 수 없어, 테이크아웃 업로드와 공유하기로 모읍니다.
- 테이크아웃 파일에는 영상 길이가 없어 YouTube Data API 키가 없으면 평균값으로 계산합니다.
- 국립중앙도서관 사서추천 API는 분야별 목록이라 검색어가 아니라 분야(문학·인문·사회·과학)로 가져옵니다.
- 아이폰 알림은 홈 화면에 설치한 경우에만 받을 수 있습니다(iOS 16.4 이상).
- 10분 독서 타이머가 끝나는 순간의 알림은 앱이 열려 있거나 백그라운드에 살아 있을 때만 뜹니다. 휴대폰이 앱을 완전히 멈춘 경우에는 다시 열면 "다 읽었어요" 기록 화면이 바로 나옵니다.

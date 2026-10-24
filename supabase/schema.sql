-- 하루 한 쪽 스키마
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run (여러 번 실행해도 안전)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  consent_at timestamptz,                 -- 수집·이용 동의 시각
  form text check (form in ('indiv','corp','pre')),   -- 개인사업자·법인·창업 준비
  industry text,                          -- 업종 이름(목록 또는 직접 입력)
  industry_word text,                     -- 영상 제목 분류에 쓰는 말
  b2b boolean not null default false,     -- 기업 고객 위주 업종
  stage int,                              -- 사업 단계 0~3
  age int,                                -- 0:20대 … 4:60대 이상
  genres text[] not null default '{}',
  gaps text[] not null default '{}',
  onboarded_at timestamptz,
  share_token text unique,                -- iOS 단축어 공유용 개인 토큰
  exclude_sensitive boolean not null default true,
  last_report_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.signals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  src text not null check (src in ('yt','search','share','image','like','sub')),  -- like·sub: 유튜브 연결(좋아요 영상·구독 채널)
  text text not null,
  video_id text,                          -- 유튜브 영상 ID(길이 조회용)
  minutes numeric,                        -- 영상 길이(분), 모르면 null
  topic text,                             -- mkt·tax·sales·money·staff·other
  sub text,                               -- 세부 주제(반복 시청 판단)
  level int not null default 0,
  taxq text,                              -- 세금 영상의 상담 주제 키
  sensitive boolean not null default false,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists signals_user_idx on public.signals(user_id, happened_at desc);

-- 책 반응: read(다 읽음) · dismiss(관심 없음)
create table if not exists public.book_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  status text not null check (status in ('read','dismiss')),
  created_at timestamptz not null default now(),
  primary key (user_id, title)
);

create table if not exists public.consult_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  topics text[] not null,                 -- 고른 상담 주제 문장
  videos text[] not null default '{}',    -- 관련 세금 영상 제목(최근 20개)
  contact text,                           -- 연락받을 방법(선택)
  status text not null default 'new' check (status in ('new','contacted','done')),
  created_at timestamptz not null default now()
);

create table if not exists public.tips (
  id bigint generated always as identity primary key,
  cat text not null,                      -- mkt·mkt_b2b·sales·money·money_corp·staff·gen·gen_corp
  text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- 본인 데이터만 읽고 쓰도록 행 수준 보안 (관리자 화면은 서버에서 service_role로 접근)
alter table public.profiles enable row level security;
alter table public.signals enable row level security;
alter table public.book_status enable row level security;
alter table public.consult_requests enable row level security;
alter table public.tips enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists own_profiles on public.profiles;
create policy own_profiles on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists own_signals on public.signals;
create policy own_signals on public.signals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_books on public.book_status;
create policy own_books on public.book_status for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_consults on public.consult_requests;
create policy own_consults on public.consult_requests for select using (auth.uid() = user_id);
drop policy if exists insert_consults on public.consult_requests;
create policy insert_consults on public.consult_requests for insert with check (auth.uid() = user_id);
drop policy if exists read_tips on public.tips;
create policy read_tips on public.tips for select using (active);
drop policy if exists own_push on public.push_subscriptions;
create policy own_push on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AI가 일하는 동안 10분 읽기: 독서 기록
create table if not exists public.reading_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,                    -- 읽은 책
  author text,
  minutes int not null check (minutes between 1 and 240),
  pages int check (pages between 0 and 2000),
  memo text,                              -- 기억하고 싶은 한 줄
  read_at timestamptz not null default now()
);
create index if not exists reading_user_idx on public.reading_sessions(user_id, read_at desc);
alter table public.reading_sessions enable row level security;
drop policy if exists own_reading on public.reading_sessions;
create policy own_reading on public.reading_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 기록 종류에 like(좋아요 영상)·sub(구독 채널) 추가
alter table public.signals drop constraint if exists signals_src_check;
alter table public.signals add constraint signals_src_check check (src in ('yt','search','share','image','like','sub'));

-- 유튜브 연결 정보(서버만 읽고 씀 · 정책 없음 = 브라우저에서 접근 불가)
create table if not exists public.youtube_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,            -- 구글이 준 유튜브 읽기 권한(서버 전용)
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  sub_count int not null default 0,
  like_count int not null default 0,
  last_error text
);
alter table public.youtube_links enable row level security;

alter table public.profiles add column if not exists persona text;          -- worker·indiv·corp·pre·free·student·home·senior
alter table public.profiles add column if not exists age14_at timestamptz;  -- 만 14세 이상 확인 시각
alter table public.profiles drop constraint if exists profiles_persona_check;
alter table public.profiles add constraint profiles_persona_check check (persona is null or persona in ('worker','indiv','corp','pre','free','student','home','senior'));

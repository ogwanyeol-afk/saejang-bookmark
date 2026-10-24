-- 유튜브 연결(구독 채널·좋아요 영상) 추가
-- 이미 schema.sql 을 실행한 프로젝트는 이 파일만 SQL Editor 에서 한 번 실행하면 됩니다. (여러 번 실행해도 안전)

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

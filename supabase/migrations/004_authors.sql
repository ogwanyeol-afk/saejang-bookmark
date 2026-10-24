-- 004: 좋아하는 작가 (최대 5명)
alter table public.profiles add column if not exists authors text[] not null default '{}';

-- 하루 한 쪽: 누구나 쓰는 앱으로(이용자 유형·만 14세 확인)
-- 이미 앞의 SQL을 실행한 프로젝트는 이 파일만 SQL Editor 에서 한 번 실행하면 됩니다. (여러 번 실행해도 안전)
alter table public.profiles add column if not exists persona text;          -- worker·indiv·corp·pre·free·student·home·senior
alter table public.profiles add column if not exists age14_at timestamptz;  -- 만 14세 이상 확인 시각
alter table public.profiles drop constraint if exists profiles_persona_check;
alter table public.profiles add constraint profiles_persona_check check (persona is null or persona in ('worker','indiv','corp','pre','free','student','home','senior'));

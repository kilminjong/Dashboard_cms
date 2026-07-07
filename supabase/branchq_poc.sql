-- 브랜치Q POC 고객관리 테이블
-- 실행 위치: Supabase Dashboard → 왼쪽 메뉴 SQL Editor → New query → 아래 전체 붙여넣기 → Run
-- (또는 Table Editor에서 수동 생성도 가능하나 SQL이 빠르고 정확합니다)

create table if not exists public.branchq_poc (
  customer_number  text primary key,   -- 고객번호 (키)
  management_code  text,               -- 관리코드
  customer_name    text,               -- 고객명
  business_number  text,               -- 사업자번호
  build_status     text,               -- 브랜치Q 구축여부 (구축완료/구축예정/구축보류/구축대기)
  build_date       text,               -- 브랜치Q 구축일자 (YYYY-MM-DD)
  contact_date     text,               -- 최근 컨택일 (YYYY-MM-DD)
  notes            text,               -- 고객 안내사항 및 문의사항 (통합)
  inquiry          text,               -- (구) 문의사항 — 하위호환
  special_notes    text,               -- (구) 특이사항 — 하위호환
  guidance         text,               -- (구) 안내사항 — 하위호환
  memo             text,               -- 메모
  updated_at       timestamptz default now(),
  created_by       uuid
);
-- 이미 테이블이 있는 경우 통합 컬럼 추가
alter table public.branchq_poc add column if not exists notes text;

-- 행 수준 보안(RLS) 활성화 후, 로그인한 사용자는 읽기/쓰기 모두 허용
alter table public.branchq_poc enable row level security;

drop policy if exists "branchq_poc authenticated all" on public.branchq_poc;
create policy "branchq_poc authenticated all"
  on public.branchq_poc
  for all
  to authenticated
  using (true)
  with check (true);

-- 갱신 시각 자동 업데이트(선택)
create or replace function public.set_branchq_poc_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_branchq_poc_updated_at on public.branchq_poc;
create trigger trg_branchq_poc_updated_at
  before update on public.branchq_poc
  for each row execute function public.set_branchq_poc_updated_at();


-- ============================================================
-- VOC 로그 테이블
-- ============================================================
create table if not exists public.branchq_voc (
  id              uuid primary key default gen_random_uuid(),
  customer_number text not null,
  customer_name   text,
  voc_date        text,            -- YYYY-MM-DD
  voc_type        text,            -- 문의/불만/요청/칭찬/기타
  content         text,
  author          text,            -- 작성자(이름)
  created_at      timestamptz default now(),
  created_by      uuid
);
-- 이미 테이블이 있는 경우 작성자 컬럼 추가
alter table public.branchq_voc add column if not exists author text;
create index if not exists idx_branchq_voc_customer on public.branchq_voc (customer_number);

alter table public.branchq_voc enable row level security;
drop policy if exists "branchq_voc authenticated all" on public.branchq_voc;
create policy "branchq_voc authenticated all"
  on public.branchq_voc for all to authenticated using (true) with check (true);


-- ============================================================
-- 안내 메뉴얼(가이드) 테이블 — steps는 JSONB 배열
-- ============================================================
create table if not exists public.branchq_guides (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  sort_order  int default 0,
  steps       jsonb default '[]'::jsonb,   -- [{title, body, image_url, video_url}, ...]
  updated_at  timestamptz default now(),
  created_by  uuid
);

alter table public.branchq_guides enable row level security;
drop policy if exists "branchq_guides authenticated all" on public.branchq_guides;
create policy "branchq_guides authenticated all"
  on public.branchq_guides for all to authenticated using (true) with check (true);


-- ============================================================
-- Storage 버킷 (가이드 이미지/영상 업로드용)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('branchq-media', 'branchq-media', true)
on conflict (id) do nothing;

-- 누구나 읽기(공개), 로그인 사용자만 업로드/수정/삭제
drop policy if exists "branchq-media public read" on storage.objects;
create policy "branchq-media public read"
  on storage.objects for select using (bucket_id = 'branchq-media');

drop policy if exists "branchq-media auth write" on storage.objects;
create policy "branchq-media auth write"
  on storage.objects for insert to authenticated with check (bucket_id = 'branchq-media');

drop policy if exists "branchq-media auth modify" on storage.objects;
create policy "branchq-media auth modify"
  on storage.objects for update to authenticated using (bucket_id = 'branchq-media');

drop policy if exists "branchq-media auth delete" on storage.objects;
create policy "branchq-media auth delete"
  on storage.objects for delete to authenticated using (bucket_id = 'branchq-media');

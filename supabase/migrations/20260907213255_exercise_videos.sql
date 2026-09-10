-- ============ VIDEO ONBELLEGI ============
-- Paylasilan cache: bir hareket icin bir kez arama yapilir, 30 gun herkes onu kullanir.
-- Satirlari yalnizca Edge Function (service_role) yazar; kullanicilar sadece okur.
create table public.exercise_videos (
  id uuid primary key default gen_random_uuid(),
  query_key text not null unique,
  exercise_id uuid references public.exercises(id) on delete cascade,
  lang text not null default 'tr' check (lang in ('tr','en')),
  query text not null check (char_length(query) <= 120),
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

create index exercise_videos_exercise_idx on public.exercise_videos (exercise_id);
create index exercise_videos_fetched_idx  on public.exercise_videos (fetched_at desc);

alter table public.exercise_videos enable row level security;

create policy "read video cache" on public.exercise_videos
  for select to authenticated using (true);
-- insert/update/delete politikasi bilincli olarak YOK -> sadece service_role yazabilir


-- ============ ARAMA SAYACI ============
-- Sadece cache-miss aramalar buraya yazilir (gercek kota harcayanlar).
create table public.video_search_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null check (char_length(query) <= 120),
  created_at timestamptz not null default now()
);

create index video_search_log_user_idx    on public.video_search_log (user_id, created_at desc);
create index video_search_log_created_idx on public.video_search_log (created_at desc);

alter table public.video_search_log enable row level security;

create policy "own search log select" on public.video_search_log
  for select to authenticated using ((select auth.uid()) = user_id);
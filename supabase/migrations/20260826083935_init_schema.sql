-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 50),
  sex text check (sex in ('male','female','other')),
  birth_year int check (birth_year between 1920 and extract(year from now())::int - 16),
  height_cm numeric(5,2) check (height_cm between 80 and 260),
  experience_level text not null default 'beginner'
    check (experience_level in ('beginner','intermediate','advanced')),
  unit_system text not null default 'metric'
    check (unit_system in ('metric','imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ EXERCISES ============
-- owner_id null ise global katalog, dolu ise kullanicinin ozel hareketi
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  primary_muscle text not null check (primary_muscle in
    ('chest','back','shoulders','biceps','triceps','quads',
     'hamstrings','glutes','calves','core','forearms','full_body')),
  equipment text check (equipment in
    ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other')),
  is_unilateral boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index exercises_unique_name_idx on public.exercises
  (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- ============ WORKOUT SESSIONS ============
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null default now(),
  title text check (char_length(title) <= 80),
  notes text check (char_length(notes) <= 2000),
  duration_minutes int check (duration_minutes between 0 and 600),
  created_at timestamptz not null default now()
);

create index workout_sessions_user_date_idx
  on public.workout_sessions (user_id, performed_at desc);

-- ============ SET LOGS (uygulamanin kalbi) ============
create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_index int not null check (set_index between 1 and 50),
  weight_kg numeric(6,2) not null check (weight_kg >= 0 and weight_kg <= 1000),
  reps int not null check (reps between 1 and 200),
  rpe numeric(3,1) check (rpe between 1 and 10),
  is_warmup boolean not null default false,
  performed_at timestamptz not null default now()
);

create index set_logs_user_exercise_idx
  on public.set_logs (user_id, exercise_id, performed_at desc);
create unique index set_logs_no_duplicate_idx
  on public.set_logs (session_id, exercise_id, set_index);

-- ============ BODY METRICS ============
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,2) check (weight_kg between 20 and 400),
  body_fat_pct numeric(4,1) check (body_fat_pct between 3 and 70),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- ============ NOTES ============
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_date_idx on public.notes (user_id, created_at desc);

-- ============ CHAT ============
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text check (char_length(title) <= 120),
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 10000),
  created_at timestamptz not null default now()
);

create index chat_messages_thread_idx
  on public.chat_messages (thread_id, created_at);

-- ============ TRIGGERS ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

-- Yeni kullanici kaydolunca profil satiri otomatik olussun
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
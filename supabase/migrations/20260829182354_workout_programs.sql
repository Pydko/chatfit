create table public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  day_index int not null check (day_index between 1 and 14),
  name text not null check (char_length(name) between 1 and 40),
  unique (program_id, day_index)
);

create table public.program_day_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position int not null check (position between 1 and 30),
  target_sets int check (target_sets between 1 and 20),
  target_reps int check (target_reps between 1 and 100),
  unique (program_day_id, position)
);

-- Seanslari programa bagla
alter table public.workout_sessions
  add column program_day_id uuid references public.program_days(id) on delete set null;

create index program_days_program_idx on public.program_days (program_id, day_index);
create index pde_day_idx on public.program_day_exercises (program_day_id, position);
create index sessions_program_day_idx on public.workout_sessions (user_id, program_day_id);
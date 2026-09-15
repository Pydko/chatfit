alter table public.program_day_exercises
  add column last_note text check (char_length(last_note) <= 500),
  add column last_note_at timestamptz;
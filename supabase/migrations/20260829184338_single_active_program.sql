create unique index programs_one_active_idx
  on public.programs (user_id)
  where is_active;
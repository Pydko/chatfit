alter table public.programs              enable row level security;
alter table public.program_days          enable row level security;
alter table public.program_day_exercises enable row level security;

do $$
declare t text;
begin
  foreach t in array array['programs','program_days','program_day_exercises']
  loop
    execute format($f$
      create policy "own rows select" on public.%1$I
        for select to authenticated using ((select auth.uid()) = user_id);
      create policy "own rows insert" on public.%1$I
        for insert to authenticated with check ((select auth.uid()) = user_id);
      create policy "own rows update" on public.%1$I
        for update to authenticated using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id);
      create policy "own rows delete" on public.%1$I
        for delete to authenticated using ((select auth.uid()) = user_id);
    $f$, t);
  end loop;
end $$;
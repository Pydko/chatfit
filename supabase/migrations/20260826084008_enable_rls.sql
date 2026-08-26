-- Once hepsinde RLS ac. Politika yazilmadan hicbir satir okunamaz/yazilamaz.
alter table public.profiles         enable row level security;
alter table public.exercises        enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs         enable row level security;
alter table public.body_metrics     enable row level security;
alter table public.notes            enable row level security;
alter table public.chat_threads     enable row level security;
alter table public.chat_messages    enable row level security;

-- Giris yapmamis kullanicilar hicbir sey goremez
revoke all on all tables in schema public from anon;

-- ============ PROFILES ============
create policy "own profile select" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ============ EXERCISES ============
-- Global katalog herkese okunur, ozel hareketler sadece sahibine
create policy "catalog and own exercises" on public.exercises
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "insert own exercise" on public.exercises
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "update own exercise" on public.exercises
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "delete own exercise" on public.exercises
  for delete to authenticated using (owner_id = (select auth.uid()));


  do $$
declare t text;
begin
  foreach t in array array[
    'workout_sessions','set_logs','body_metrics',
    'notes','chat_threads','chat_messages'
  ]
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
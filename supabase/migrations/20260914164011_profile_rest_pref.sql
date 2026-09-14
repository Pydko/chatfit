alter table public.profiles
  add column default_rest_seconds int not null default 90
  check (default_rest_seconds between 15 and 900);
-- Disciplin app — cross-device sync schema.
-- Run this once in your Supabase project's SQL Editor (Project → SQL Editor → New query → Run).
--
-- Design: one table per local entity, each row is {id, user_id, data jsonb, updated_at}.
-- The app keeps writing plain JS objects locally; this table just mirrors them so every
-- signed-in device sees the same rows via Postgres Realtime. Row Level Security makes
-- sure each user can only ever see their own data. Primary key is (user_id, id) so fixed
-- ids like 'baseline' can exist once per user.

create table if not exists public.gym_days       (id text not null, user_id uuid references auth.users(id) not null, data jsonb not null, updated_at timestamptz default now(), primary key (user_id, id));
create table if not exists public.gym_exercises  (id text not null, user_id uuid references auth.users(id) not null, data jsonb not null, updated_at timestamptz default now(), primary key (user_id, id));
create table if not exists public.gym_logs       (id text not null, user_id uuid references auth.users(id) not null, data jsonb not null, updated_at timestamptz default now(), primary key (user_id, id));
create table if not exists public.tms_sessions   (id text not null, user_id uuid references auth.users(id) not null, data jsonb not null, updated_at timestamptz default now(), primary key (user_id, id));
create table if not exists public.tms_baseline   (id text not null, user_id uuid references auth.users(id) not null, data jsonb not null, updated_at timestamptz default now(), primary key (user_id, id));
create table if not exists public.habits         (id text not null, user_id uuid references auth.users(id) not null, data jsonb not null, updated_at timestamptz default now(), primary key (user_id, id));
create table if not exists public.habit_logs     (id text not null, user_id uuid references auth.users(id) not null, data jsonb not null, updated_at timestamptz default now(), primary key (user_id, id));
create table if not exists public.todos          (id text not null, user_id uuid references auth.users(id) not null, data jsonb not null, updated_at timestamptz default now(), primary key (user_id, id));
create table if not exists public.calendar_events(id text not null, user_id uuid references auth.users(id) not null, data jsonb not null, updated_at timestamptz default now(), primary key (user_id, id));

alter table public.gym_days        enable row level security;
alter table public.gym_exercises   enable row level security;
alter table public.gym_logs        enable row level security;
alter table public.tms_sessions    enable row level security;
alter table public.tms_baseline    enable row level security;
alter table public.habits          enable row level security;
alter table public.habit_logs      enable row level security;
alter table public.todos           enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists "own rows" on public.gym_days;
drop policy if exists "own rows" on public.gym_exercises;
drop policy if exists "own rows" on public.gym_logs;
drop policy if exists "own rows" on public.tms_sessions;
drop policy if exists "own rows" on public.tms_baseline;
drop policy if exists "own rows" on public.habits;
drop policy if exists "own rows" on public.habit_logs;
drop policy if exists "own rows" on public.todos;
drop policy if exists "own rows" on public.calendar_events;

create policy "own rows" on public.gym_days        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.gym_exercises   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.gym_logs        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.tms_sessions    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.tms_baseline    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.habits          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.habit_logs      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.todos           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.calendar_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Enable Realtime so changes made on one device push instantly to every other device.
alter publication supabase_realtime add table
  public.gym_days, public.gym_exercises, public.gym_logs, public.tms_sessions, public.tms_baseline,
  public.habits, public.habit_logs, public.todos, public.calendar_events;

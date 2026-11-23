-- Road To Treble v7.0 Multiplayer Schema (Supabase Postgres + Realtime + RLS)
-- Copy-paste into Supabase Dashboard -> SQL Editor -> Run

create table if not exists public.mp_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  mode text not null default '1v1_blind_draft',
  status text not null default 'lobby',
  host_player_id text not null,
  settings jsonb not null default '{"draftLeaguePool":["epl","laliga","seriea","bundesliga","ligue1"],"knockoutRules":true}'::jsonb,
  match_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mp_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mp_rooms(id) on delete cascade,
  player_id text not null,
  seat int not null default 0,
  nickname text not null,
  avatar_json jsonb not null default '{}'::jsonb,
  club_profile jsonb not null default '{}'::jsonb,
  is_ready boolean not null default false,
  draft_progress int not null default 0,
  draft_completed boolean not null default false,
  lineup_payload jsonb,
  tactic_submission jsonb,
  updated_at timestamptz not null default now(),
  unique(room_id, player_id)
);

create index if not exists idx_mp_rooms_code on public.mp_rooms(code);
create index if not exists idx_mp_room_players_room_id on public.mp_room_players(room_id);

create or replace function public.mp_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_mp_rooms_updated on public.mp_rooms;
create trigger trg_mp_rooms_updated
  before update on public.mp_rooms
  for each row execute function public.mp_touch_updated_at();

drop trigger if exists trg_mp_room_players_updated on public.mp_room_players;
create trigger trg_mp_room_players_updated
  before update on public.mp_room_players
  for each row execute function public.mp_touch_updated_at();

alter table public.mp_rooms enable row level security;
alter table public.mp_room_players enable row level security;

drop policy if exists "mp_rooms_public_all" on public.mp_rooms;
create policy "mp_rooms_public_all"
  on public.mp_rooms for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "mp_room_players_public_all" on public.mp_room_players;
create policy "mp_room_players_public_all"
  on public.mp_room_players for all to anon, authenticated
  using (true) with check (true);

alter table public.mp_rooms replica identity full;
alter table public.mp_room_players replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mp_rooms'
  ) then
    alter publication supabase_realtime add table public.mp_rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mp_room_players'
  ) then
    alter publication supabase_realtime add table public.mp_room_players;
  end if;
end $$;

-- =============================================================================
-- v8.0 Multi League (2~4 friends: snake draft + shared league / cup / UCL season)
-- Safe to run more than once. Run this whole block once in Supabase SQL Editor.
-- =============================================================================

-- 1) Remove legacy CHECK constraints on mode / status / seat so 'multi_league' rooms
--    and seats 0..3 are accepted (1v1 keeps working: the app only writes known values).
do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.mp_rooms'::regclass, 'public.mp_room_players'::regclass)
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- 2) Per-player squad + pause lock / acknowledgements
alter table public.mp_room_players
  add column if not exists league_payload jsonb,
  add column if not exists activity jsonb;

-- 3) Public snake draft picks (the DB itself rejects a duplicate player or pick number)
create table if not exists public.mp_league_picks (
  room_id uuid not null references public.mp_rooms(id) on delete cascade,
  draft_generation int not null default 0,
  pick_no int not null,
  player_ref text not null,
  picker_id text not null,
  player_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (room_id, draft_generation, player_ref),
  unique (room_id, draft_generation, pick_no)
);

-- 4) Host-published shared season state
create table if not exists public.mp_league_state (
  room_id uuid primary key references public.mp_rooms(id) on delete cascade,
  live jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_mp_league_state_updated on public.mp_league_state;
create trigger trg_mp_league_state_updated
  before update on public.mp_league_state
  for each row execute function public.mp_touch_updated_at();

-- 5) Friend -> host request queue (interview answers, injury ack, trade accept / reject / counter)
create table if not exists public.mp_league_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mp_rooms(id) on delete cascade,
  player_id text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_mp_league_picks_room
  on public.mp_league_picks(room_id, draft_generation);
create index if not exists idx_mp_league_actions_room
  on public.mp_league_actions(room_id, status);

-- 6) RLS (same open room-code model as the 1v1 tables) + Realtime
alter table public.mp_league_picks enable row level security;
alter table public.mp_league_state enable row level security;
alter table public.mp_league_actions enable row level security;

drop policy if exists "mp_league_picks_public_all" on public.mp_league_picks;
create policy "mp_league_picks_public_all"
  on public.mp_league_picks for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "mp_league_state_public_all" on public.mp_league_state;
create policy "mp_league_state_public_all"
  on public.mp_league_state for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "mp_league_actions_public_all" on public.mp_league_actions;
create policy "mp_league_actions_public_all"
  on public.mp_league_actions for all to anon, authenticated
  using (true) with check (true);

alter table public.mp_league_picks replica identity full;
alter table public.mp_league_actions replica identity full;
-- mp_league_state keeps the default replica identity: clients only need the change signal and refetch.

do $$
declare t text;
begin
  foreach t in array array['mp_league_picks', 'mp_league_state', 'mp_league_actions']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

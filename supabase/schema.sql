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

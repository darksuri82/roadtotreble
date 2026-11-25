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

-- =============================================================================
-- v8.12 Global Hall of Fame TOP 15 Rankings (Atomic Top-15 Cap & Auto-Prune)
-- Safe to run more than once. Copy-paste into Supabase Dashboard -> SQL Editor.
-- =============================================================================

create table if not exists public.global_hof_rankings (
  id uuid primary key default gen_random_uuid(),
  run_id text unique not null,
  season_score int not null check (season_score >= 0 and season_score <= 30000),
  grade text not null,
  club_name text not null,
  manager_name text not null,
  league_id text not null,
  league_korean_name text not null,
  final_league_rank int not null default 1,
  league_points int not null default 0,
  league_total_rounds int not null default 38,
  league_record text not null default '',
  cup_name text not null default '',
  cup_result_label text not null default '',
  cup_won boolean not null default false,
  ucl_result_label text not null default '',
  ucl_won boolean not null default false,
  is_league_champion boolean not null default false,
  is_treble boolean not null default false,
  trophies jsonb not null default '[]'::jsonb,
  formation text not null,
  default_tactic text not null,
  manager_trait_id text,
  manager_rating int not null default 85,
  team_avg_ovr numeric(4,1) not null default 80.0,
  chemistry int not null default 50,
  avg_synergy_ovr_bonus numeric(4,2) not null default 0,
  manager_synergy_count int not null default 0,
  top_scorer_summary text not null default '-',
  club_profile jsonb not null default '{}'::jsonb,
  manager_avatar jsonb not null default '{}'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  squad_snapshot jsonb not null default '{}'::jsonb,
  achieved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_global_hof_rankings_order
  on public.global_hof_rankings (
    season_score desc,
    is_treble desc,
    ucl_won desc,
    achieved_at asc,
    id asc
  );

alter table public.global_hof_rankings enable row level security;

-- Public read-only SELECT policy; direct client INSERT/UPDATE/DELETE are blocked by RLS.
drop policy if exists "global_hof_rankings_public_select" on public.global_hof_rankings;
create policy "global_hof_rankings_public_select"
  on public.global_hof_rankings for select to anon, authenticated
  using (true);

create or replace function public.submit_global_hof_ranking(p_entry jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id text;
  v_score int;
  v_is_treble boolean;
  v_ucl_won boolean;
  v_achieved_at timestamptz;
  v_existing_rank int;
  v_total_before int;
  v_cutoff_row record;
  v_new_rank int;
  v_pruned_count int := 0;
  v_cutoff_score int;
  v_total_after int;
  v_starter_legends int := 0;
  v_total_legends int := 0;
  v_total_players int := 0;
  v_distinct_players int := 0;
  v_team_avg_ovr numeric(4,1);
begin
  v_run_id := trim(coalesce(p_entry->>'run_id', ''));
  v_score := coalesce((p_entry->>'season_score')::int, -1);
  v_is_treble := coalesce((p_entry->>'is_treble')::boolean, false);
  v_ucl_won := coalesce((p_entry->>'ucl_won')::boolean, false);
  v_achieved_at := coalesce((p_entry->>'achieved_at')::timestamptz, now());
  v_team_avg_ovr := coalesce((p_entry->>'team_avg_ovr')::numeric(4,1), 80.0);

  if v_run_id = '' or length(v_run_id) > 120 then
    raise exception 'Invalid run_id';
  end if;
  if v_score < 0 or v_score > 15000 then
    raise exception 'Invalid season_score';
  end if;
  if v_team_avg_ovr > 96.5 then
    raise exception 'Invalid team_avg_ovr';
  end if;
  if jsonb_typeof(p_entry->'squad_snapshot'->'starters') <> 'array'
     or jsonb_array_length(p_entry->'squad_snapshot'->'starters') < 11 then
    raise exception 'Invalid squad_snapshot starters';
  end if;

  -- v8.17 Anti-exploit server validation: reject duplicate player IDs and impossible Legend-spam squads
  select
    count(*) filter (where elem->>'isLegend' = 'true')
    into v_starter_legends
  from jsonb_array_elements(p_entry->'squad_snapshot'->'starters') as elem;

  with all_squad as (
    select elem from jsonb_array_elements(p_entry->'squad_snapshot'->'starters') as elem
    union all
    select elem from jsonb_array_elements(
      case
        when jsonb_typeof(p_entry->'squad_snapshot'->'bench') = 'array'
        then p_entry->'squad_snapshot'->'bench'
        else '[]'::jsonb
      end
    ) as elem
  )
  select
    count(*),
    count(distinct nullif(trim(coalesce(elem->>'id', '')), '')),
    count(*) filter (where elem->>'isLegend' = 'true')
    into v_total_players, v_distinct_players, v_total_legends
  from all_squad;

  if v_distinct_players < v_total_players then
    raise exception 'Duplicate players in squad_snapshot';
  end if;
  if v_starter_legends > 5 or v_total_legends > 6 then
    raise exception 'Invalid legend count in squad_snapshot';
  end if;

  -- Serialize concurrent submissions to eliminate Top-15 race conditions
  perform pg_advisory_xact_lock(hashtext('global_hof_rankings_top15'));

  -- 1) Duplicate run_id guard
  select ranked.rk into v_existing_rank
  from (
    select run_id,
           row_number() over (
             order by season_score desc, is_treble desc, ucl_won desc, achieved_at asc, id asc
           ) as rk
    from public.global_hof_rankings
  ) ranked
  where ranked.run_id = v_run_id;

  if v_existing_rank is not null then
    select count(*), min(season_score) into v_total_after, v_cutoff_score
    from public.global_hof_rankings;

    return jsonb_build_object(
      'entered', v_existing_rank <= 15,
      'rank', v_existing_rank,
      'already_exists', true,
      'cutoff_score', v_cutoff_score,
      'total_count', v_total_after,
      'pruned_count', 0
    );
  end if;

  -- 2) Pre-check against 15th cutoff when table already has 15+ entries
  select count(*) into v_total_before from public.global_hof_rankings;
  if v_total_before >= 15 then
    select season_score, is_treble, ucl_won, achieved_at
      into v_cutoff_row
    from public.global_hof_rankings
    order by season_score desc, is_treble desc, ucl_won desc, achieved_at asc, id asc
    offset 14 limit 1;

    if (
      v_score < v_cutoff_row.season_score
      or (v_score = v_cutoff_row.season_score and v_is_treble < v_cutoff_row.is_treble)
      or (v_score = v_cutoff_row.season_score and v_is_treble = v_cutoff_row.is_treble and v_ucl_won < v_cutoff_row.ucl_won)
      or (v_score = v_cutoff_row.season_score and v_is_treble = v_cutoff_row.is_treble and v_ucl_won = v_cutoff_row.ucl_won and v_achieved_at >= v_cutoff_row.achieved_at)
    ) then
      return jsonb_build_object(
        'entered', false,
        'rank', null,
        'already_exists', false,
        'cutoff_score', v_cutoff_row.season_score,
        'total_count', least(v_total_before, 15),
        'pruned_count', 0
      );
    end if;
  end if;

  -- 3) Insert qualifying record
  insert into public.global_hof_rankings (
    run_id, season_score, grade, club_name, manager_name,
    league_id, league_korean_name, final_league_rank, league_points, league_total_rounds,
    league_record, cup_name, cup_result_label, cup_won, ucl_result_label, ucl_won,
    is_league_champion, is_treble, trophies, formation, default_tactic,
    manager_trait_id, manager_rating, team_avg_ovr, chemistry,
    avg_synergy_ovr_bonus, manager_synergy_count, top_scorer_summary,
    club_profile, manager_avatar, score_breakdown, squad_snapshot, achieved_at
  ) values (
    v_run_id,
    v_score,
    coalesce(p_entry->>'grade', 'C'),
    left(coalesce(nullif(trim(p_entry->>'club_name'), ''), '구단'), 30),
    left(coalesce(nullif(trim(p_entry->>'manager_name'), ''), '감독'), 24),
    coalesce(p_entry->>'league_id', 'epl'),
    coalesce(p_entry->>'league_korean_name', '프리미어리그'),
    coalesce((p_entry->>'final_league_rank')::int, 1),
    coalesce((p_entry->>'league_points')::int, 0),
    coalesce((p_entry->>'league_total_rounds')::int, 38),
    coalesce(p_entry->>'league_record', ''),
    coalesce(p_entry->>'cup_name', ''),
    coalesce(p_entry->>'cup_result_label', ''),
    coalesce((p_entry->>'cup_won')::boolean, false),
    coalesce(p_entry->>'ucl_result_label', ''),
    v_ucl_won,
    coalesce((p_entry->>'is_league_champion')::boolean, false),
    v_is_treble,
    coalesce(p_entry->'trophies', '[]'::jsonb),
    coalesce(p_entry->>'formation', '4-3-3'),
    coalesce(p_entry->>'default_tactic', 'balanced'),
    nullif(p_entry->>'manager_trait_id', ''),
    coalesce((p_entry->>'manager_rating')::int, 85),
    coalesce((p_entry->>'team_avg_ovr')::numeric(4,1), 80.0),
    coalesce((p_entry->>'chemistry')::int, 50),
    coalesce((p_entry->>'avg_synergy_ovr_bonus')::numeric(4,2), 0),
    coalesce((p_entry->>'manager_synergy_count')::int, 0),
    left(coalesce(p_entry->>'top_scorer_summary', '-'), 60),
    coalesce(p_entry->'club_profile', '{}'::jsonb),
    coalesce(p_entry->'manager_avatar', '{}'::jsonb),
    coalesce(p_entry->'score_breakdown', '{}'::jsonb),
    p_entry->'squad_snapshot',
    v_achieved_at
  );

  -- 4) Immediately prune all rows ranked 16th or lower in the same transaction
  with top15 as (
    select id
    from public.global_hof_rankings
    order by season_score desc, is_treble desc, ucl_won desc, achieved_at asc, id asc
    limit 15
  )
  delete from public.global_hof_rankings
  where id not in (select id from top15);
  get diagnostics v_pruned_count = row_count;

  -- 5) Compute final rank & updated cutoff
  select ranked.rk into v_new_rank
  from (
    select run_id,
           row_number() over (
             order by season_score desc, is_treble desc, ucl_won desc, achieved_at asc, id asc
           ) as rk
    from public.global_hof_rankings
  ) ranked
  where ranked.run_id = v_run_id;

  select count(*), min(season_score) into v_total_after, v_cutoff_score
  from public.global_hof_rankings;

  return jsonb_build_object(
    'entered', v_new_rank is not null and v_new_rank <= 15,
    'rank', v_new_rank,
    'already_exists', false,
    'cutoff_score', v_cutoff_score,
    'total_count', v_total_after,
    'pruned_count', v_pruned_count
  );
end;
$$;

grant execute on function public.submit_global_hof_ranking(jsonb) to anon, authenticated;

-- Optional one-time cleanup for legacy exploit rows (>5 starter legends or >6 total legends):
-- delete from public.global_hof_rankings
-- where (
--   select count(*) from jsonb_array_elements(squad_snapshot->'starters') e
--   where e->>'isLegend' = 'true'
-- ) > 5;

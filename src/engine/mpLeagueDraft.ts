import { BENCH_SLOTS, FORMATIONS } from '../data/formations';
import type { FormationId } from '../types/game';
import type { LeagueId } from '../types/league';
import type {
  MpDraftLive,
  MpLeagueLive,
  MpLeaguePickJson,
  MpLeaguePickRow,
  MpLeagueSettings,
} from '../types/mpLeague';
import { MP_LEAGUE_DRAFT_PICKS } from '../types/mpLeague';
import type { Player, Position, SubPosition } from '../types/player';
import { getLeagueById } from './dataLoader';
import { DEFAULT_ROULETTE_LEGEND_RATE, spinClubRoulette } from './draftEngine';

/** Snake order: 1→2→3→3→2→1→1→2→3 ... Returns the index into `order` for a 0-based pick number. */
export function snakePickerIndex(pickNo: number, playerCount: number): number {
  if (playerCount <= 0) return 0;
  const round = Math.floor(pickNo / playerCount);
  const pos = pickNo % playerCount;
  return round % 2 === 0 ? pos : playerCount - 1 - pos;
}

export function snakePickerId(pickNo: number, order: string[]): string | null {
  if (order.length === 0) return null;
  if (pickNo >= order.length * MP_LEAGUE_DRAFT_PICKS) return null;
  return order[snakePickerIndex(pickNo, order.length)] ?? null;
}

export function totalSnakePicks(playerCount: number): number {
  return playerCount * MP_LEAGUE_DRAFT_PICKS;
}

export interface OpenSlot {
  area: 'starter' | 'bench';
  index: number;
  subPosition: SubPosition;
  position: Position;
  label: string;
}

export function findNextOpenDraftSlot(
  formation: FormationId,
  starters: (Player | null)[],
  bench: (Player | null)[],
): OpenSlot | null {
  const cfg = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
  for (let i = 0; i < 11; i += 1) {
    if (!starters[i]) {
      const slot = cfg.slots[i];
      return {
        area: 'starter',
        index: i,
        subPosition: slot.subPosition,
        position: slot.position,
        label: slot.label,
      };
    }
  }
  for (let i = 0; i < 5; i += 1) {
    if (!bench[i]) {
      const slot = BENCH_SLOTS[i];
      return {
        area: 'bench',
        index: i,
        subPosition: slot.subPosition,
        position: slot.position,
        label: slot.label,
      };
    }
  }
  return null;
}

/** Rebuilds one manager's 11 + 5 board from the shared public pick rows. */
export function rebuildSquadFromPicks(
  picks: MpLeaguePickRow[],
  pickerId: string,
): { starters: (Player | null)[]; bench: (Player | null)[] } {
  const starters: (Player | null)[] = Array.from({ length: 11 }, () => null);
  const bench: (Player | null)[] = Array.from({ length: 5 }, () => null);
  const mine = picks
    .filter((p) => p.picker_id === pickerId)
    .sort((a, b) => a.pick_no - b.pick_no);
  const overflow: Player[] = [];
  for (const row of mine) {
    const { player, area, index } = row.player_json;
    if (area === 'starter' && index >= 0 && index < 11 && !starters[index]) {
      starters[index] = player;
    } else if (area === 'bench' && index >= 0 && index < 5 && !bench[index]) {
      bench[index] = player;
    } else {
      overflow.push(player);
    }
  }
  for (const p of overflow) {
    const sIdx = starters.findIndex((x) => !x);
    if (sIdx !== -1) {
      starters[sIdx] = p;
      continue;
    }
    const bIdx = bench.findIndex((x) => !x);
    if (bIdx !== -1) bench[bIdx] = p;
  }
  return { starters, bench };
}

export function collectTakenIds(picks: MpLeaguePickRow[]): Set<string> {
  return new Set(picks.map((p) => p.player_ref));
}

/**
 * Timer-expiry safety pick: spins fresh candidates for the manager's next open slot
 * (excluding every player already taken worldwide) and takes the highest OVR one.
 */
export function buildAutoPick(params: {
  formation: FormationId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  takenIds: Set<string>;
  allowedLeagueIds: LeagueId[];
  /** Candidates already on screen (preferred so the pick matches what the manager was looking at) */
  shownCandidates?: Player[];
  rng?: () => number;
}): MpLeaguePickJson | null {
  const slot = findNextOpenDraftSlot(params.formation, params.starters, params.bench);
  if (!slot) return null;
  const shown = (params.shownCandidates ?? []).filter(
    (p) => !params.takenIds.has(p.id),
  );
  let pool = shown;
  for (let attempt = 0; attempt < 6 && pool.length === 0; attempt += 1) {
    pool = spinClubRoulette(slot.subPosition, slot.position, params.takenIds, {
      legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
      allowedLeagueIds: params.allowedLeagueIds,
      rng: params.rng,
    })
      .flatMap((r) => r.candidates)
      .filter((p) => !params.takenIds.has(p.id));
  }
  const best = [...pool].sort((a, b) => b.ovr - a.ovr)[0];
  if (!best) return null;
  return { player: best, area: slot.area, index: slot.index, auto: true };
}

/** Public room state before the season exists (manager setup → snake draft). */
export function createPreSeasonLive(params: {
  seasonKey: string;
  settings: MpLeagueSettings;
  stage: 'setup' | 'draft';
  draft: MpDraftLive | null;
  rev: number;
}): MpLeagueLive {
  const league = getLeagueById(params.settings.leagueId);
  return {
    rev: params.rev,
    seasonKey: params.seasonKey,
    stage: params.stage,
    flow: { kind: 'auto' },
    draft: params.draft,
    leagueId: params.settings.leagueId,
    uclEnabled: params.settings.uclEnabled,
    autoMs: params.settings.autoMs,
    round: 0,
    totalRounds: league.totalRounds,
    humans: [],
    clubs: [],
    standings: [],
    lastRound: null,
    cup: null,
    cupNews: [],
    topScorers: [],
    topAssisters: [],
    byClub: {},
    h2h: null,
    ucl: null,
    cast: null,
    final: null,
    transferWindowIndex: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Fisher–Yates shuffle used for the fair random snake order. */
export function shuffleDraftOrder(playerIds: string[], rng: () => number = Math.random): string[] {
  const arr = [...playerIds];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

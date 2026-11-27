import { BENCH_SLOTS, FORMATIONS } from '../data/formations';
import type { FormationId, ManagerTraitId, RouletteReelResult } from '../types/game';
import type { LeagueId, TacticId } from '../types/league';
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
import { optimizeBestLineup } from './lineupOptimizer';

/**
 * Rotating round-start draft order so every player (2/3/4P) gets equal first-pick & roulette turns:
 * - 2P: 1→2, 2→1 (8/8)
 * - 3P: 1→2→3, 2→3→1, 3→1→2 (6/5/5)
 * - 4P: 1→2→3→4, 2→3→4→1, 3→4→1→2, 4→1→2→3 (4/4/4/4)
 */
export function snakePickerIndex(pickNo: number, playerCount: number): number {
  if (playerCount <= 0) return 0;
  const round = Math.floor(pickNo / playerCount);
  const pos = pickNo % playerCount;
  return (round + pos) % playerCount;
}

export function snakePickerId(pickNo: number, order: string[]): string | null {
  if (order.length === 0) return null;
  if (pickNo >= order.length * MP_LEAGUE_DRAFT_PICKS) return null;
  return order[snakePickerIndex(pickNo, order.length)] ?? null;
}

/** Ordered player IDs for a given 0-based draft round (index 0 is that round's roulette spinner). */
export function roundOrderIds(round: number, order: string[]): string[] {
  const n = order.length;
  if (n === 0) return [];
  const start = ((round % n) + n) % n;
  return Array.from({ length: n }, (_, i) => order[(start + i) % n]);
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

export function draftRoundOf(pickNo: number, playerCount: number): number {
  return playerCount <= 0 ? 0 : Math.floor(pickNo / playerCount);
}

/** The manager who picks first in a round also spins that round's shared roulette. */
export function roundSpinnerId(round: number, order: string[]): string | null {
  if (order.length === 0) return null;
  return order[snakePickerIndex(round * order.length, order.length)] ?? null;
}

/**
 * Where a player taken from the shared roulette lands on MY board:
 * exact sub-position slot → same line starter → matching bench slot → any open slot.
 */
export function chooseSlotForPlayer(
  formation: FormationId,
  starters: (Player | null)[],
  bench: (Player | null)[],
  player: Player,
): OpenSlot | null {
  const cfg = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
  const mains = new Set<SubPosition>(player.mainPositions ?? []);
  const starterSlot = (i: number): OpenSlot => ({
    area: 'starter',
    index: i,
    subPosition: cfg.slots[i].subPosition,
    position: cfg.slots[i].position,
    label: cfg.slots[i].label,
  });
  const benchSlot = (i: number): OpenSlot => ({
    area: 'bench',
    index: i,
    subPosition: player.mainPositions[0] ?? (player.position === 'GK' ? 'GK' : 'CM'),
    position: player.position,
    label: '벤치',
  });
  const openStarters = cfg.slots.map((_, i) => i).filter((i) => i < 11 && !starters[i]);
  const openBench = Array.from({ length: 5 }, (_, i) => i).filter((i) => !bench[i]);

  const exact = openStarters.find((i) => mains.has(cfg.slots[i].subPosition));
  if (exact !== undefined) return starterSlot(exact);
  const alt = openStarters.find((i) =>
    (cfg.slots[i].alternateSubPositions ?? []).some((sp) => mains.has(sp)),
  );
  if (alt !== undefined) return starterSlot(alt);
  const sameLine = openStarters.find((i) => cfg.slots[i].position === player.position);
  if (sameLine !== undefined) return starterSlot(sameLine);
  if (openBench.length > 0) return benchSlot(openBench[0]);
  const safeStarter = openStarters.find(
    (i) => (cfg.slots[i].position === 'GK') === (player.position === 'GK'),
  );
  if (safeStarter !== undefined) return starterSlot(safeStarter);
  if (openStarters.length > 0) return starterSlot(openStarters[0]);
  return null;
}

/**
 * Dynamically resolves the target sub-position & label shown on the Multiplayer Draft Roulette
 * both before the round's spin (never stuck on hardcoded 'CM') and while previewing/picking.
 */
export function resolveMpRouletteTargetDisplay(params: {
  previewSlot: { subPosition: SubPosition; label: string } | null;
  roll: { subPosition: SubPosition; label: string } | null;
  myNextOpenSlot: { subPosition: SubPosition; label: string } | null;
  spinnerNextOpenSlot: { subPosition: SubPosition; label: string } | null;
  iAmSpinner: boolean;
}): { subPosition: SubPosition; label: string | null } {
  const { previewSlot, roll, myNextOpenSlot, spinnerNextOpenSlot, iAmSpinner } = params;
  if (previewSlot) {
    return { subPosition: previewSlot.subPosition, label: previewSlot.label };
  }
  if (roll) {
    const active = myNextOpenSlot ?? null;
    return {
      subPosition: active?.subPosition ?? roll.subPosition,
      label: roll.label || active?.label || null,
    };
  }
  const preSpinTarget = iAmSpinner
    ? (myNextOpenSlot ?? spinnerNextOpenSlot)
    : (spinnerNextOpenSlot ?? myNextOpenSlot);
  if (preSpinTarget) {
    return { subPosition: preSpinTarget.subPosition, label: preSpinTarget.label };
  }
  return { subPosition: 'CM', label: null };
}

/**
 * One shared roulette per round: spun for the first picker's next open slot,
 * guaranteed to hold at least one free candidate per manager.
 * Uses 4 clubs when 3+ managers participate (keeps 3 clubs for 2 or fewer).
 */
export function spinSharedRoll(params: {
  formation: FormationId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  takenIds: Set<string>;
  allowedLeagueIds: LeagueId[];
  playerCount: number;
  rng?: () => number;
}): RouletteReelResult[] {
  const slot = findNextOpenDraftSlot(params.formation, params.starters, params.bench);
  const sub: SubPosition = slot?.subPosition ?? 'CM';
  const pos: Position = slot?.position ?? 'MF';
  const reelCount = params.playerCount >= 3 ? 4 : 3;
  let best: RouletteReelResult[] = [];
  let bestCount = -1;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const reels = spinClubRoulette(sub, pos, params.takenIds, {
      reelCount,
      legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
      allowedLeagueIds: params.allowedLeagueIds,
      rng: params.rng,
    });
    const count = new Set(reels.flatMap((r) => r.candidates.map((c) => c.id))).size;
    if (count > bestCount) {
      best = reels;
      bestCount = count;
    }
    if (count >= params.playerCount) break;
  }
  return best;
}

export function rollCandidates(
  reels: RouletteReelResult[],
  takenIds: Set<string>,
): Player[] {
  const seen = new Set<string>();
  const out: Player[] = [];
  for (const reel of reels) {
    for (const c of reel.candidates) {
      if (takenIds.has(c.id) || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

/**
 * Timer-expiry / auto-draft pick: best OVR still free in the round's shared roulette,
 * placed on the manager's best fitting open slot. Falls back to a private spin only
 * if the shared roulette has nothing left.
 */
export function buildAutoPick(params: {
  formation: FormationId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  takenIds: Set<string>;
  allowedLeagueIds: LeagueId[];
  /** Free candidates of the round's shared roulette */
  shownCandidates?: Player[];
  rng?: () => number;
}): MpLeaguePickJson | null {
  if (!findNextOpenDraftSlot(params.formation, params.starters, params.bench)) return null;
  let pool = (params.shownCandidates ?? []).filter((p) => !params.takenIds.has(p.id));
  if (pool.length === 0) {
    pool = rollCandidates(
      spinSharedRoll({
        formation: params.formation,
        starters: params.starters,
        bench: params.bench,
        takenIds: params.takenIds,
        allowedLeagueIds: params.allowedLeagueIds,
        playerCount: 1,
        rng: params.rng,
      }),
      params.takenIds,
    );
  }
  // Prefer a candidate that fits one of my open slots; otherwise simply the best one
  const ranked = [...pool].sort((a, b) => b.ovr - a.ovr);
  for (const candidate of ranked) {
    const slot = chooseSlotForPlayer(
      params.formation,
      params.starters,
      params.bench,
      candidate,
    );
    if (slot) return { player: candidate, area: slot.area, index: slot.index, auto: true };
  }
  return null;
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
    ticker: null,
    summary: null,
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

/**
 * Multi-league Draft `[빠른 선발]` helper (identical optimization engine as solo `DraftScreen`):
 * Optimizes all currently picked players into the best starter/bench slots for the manager's
 * formation, tactic, and manager trait, returning a pure `playerId -> slot` override map without
 * mutating `mp_league_picks`.
 */
export function buildQuickLineupOverrides(params: {
  formation: FormationId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  tactic: TacticId;
  managerTraitId: ManagerTraitId | null;
}): Record<string, { area: 'starter' | 'bench'; index: number }> {
  const optimized = optimizeBestLineup(
    params.starters,
    params.bench,
    params.formation,
    params.tactic,
    params.managerTraitId,
  );
  const overrides: Record<string, { area: 'starter' | 'bench'; index: number }> = {};
  optimized.starters.forEach((p, index) => {
    if (p) overrides[p.id] = { area: 'starter', index };
  });
  optimized.bench.forEach((p, index) => {
    if (p) overrides[p.id] = { area: 'bench', index };
  });
  return overrides;
}

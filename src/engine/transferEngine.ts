import type {
  TransferClubOffer,
  TransferFormTrend,
  TransferMarketState,
  TransferTargetPlayer,
} from '../types/game';
import type {
  Club,
  LeagueId,
  PlayerSeasonStats,
  StandingRow,
} from '../types/league';
import type { Player, SubPosition } from '../types/player';
import { getCardTier } from '../types/player';
import {
  ACTIVE_PLAYERS,
  ALL_CLUBS_WITH_LEAGUE,
  generateClubRotationPlayer,
  getLeagueById,
  LEGEND_PLAYERS,
} from './dataLoader';
import {
  DEFAULT_ROULETTE_LEGEND_RATE,
  TOP4_TRANSFER_LEGEND_RATE,
} from './draftEngine';

export const ATTEMPTS_PER_WINDOW = 3;
export const UCL_CHAMPION_LEGEND_RATE = 0.055;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function seededUnit(seedKey: string): number {
  return (hashSeed(seedKey) % 10000) / 10000;
}

export function createClosedTransferState(
  completedWindows: number[] = [],
  history: TransferMarketState['history'] = [],
): TransferMarketState {
  return {
    isOpen: false,
    windowIndex: completedWindows.length,
    triggerRound: 0,
    attemptsRemaining: 0,
    maxAttempts: ATTEMPTS_PER_WINDOW,
    legendBonusActive: false,
    isUclSpecial: false,
    championBonusActive: false,
    userRankAtOpen: 0,
    hasSpunClubs: false,
    rolledClubs: [],
    attemptedPlayerIds: [],
    signedPlayerIds: [],
    lastOfferResult: null,
    history,
    completedWindows,
  };
}

export function checkTransferWindowTrigger(
  currentRound: number,
  transferWindows: [number, number, number],
  completedWindows: number[],
): { windowIndex: number; triggerRound: number } | null {
  const idx = transferWindows.indexOf(currentRound);
  if (idx === -1) return null;
  const windowIndex = idx + 1;
  if (completedWindows.includes(windowIndex)) return null;
  return { windowIndex, triggerRound: currentRound };
}

export function getNextTransferWindowRound(
  currentRound: number,
  transferWindows: [number, number, number],
  completedWindows: number[],
): number | null {
  for (let i = 0; i < transferWindows.length; i += 1) {
    const windowIndex = i + 1;
    if (
      transferWindows[i] > currentRound &&
      !completedWindows.includes(windowIndex)
    ) {
      return transferWindows[i];
    }
  }
  return null;
}

export function createOpenTransferState(
  windowIndex: number,
  triggerRound: number,
  userRank: number,
  prev: TransferMarketState,
  options?: { isUclSpecial?: boolean; championBonusActive?: boolean },
): TransferMarketState {
  const isUclSpecial = Boolean(options?.isUclSpecial);
  const championBonusActive = Boolean(options?.championBonusActive);
  return {
    isOpen: true,
    windowIndex,
    triggerRound,
    attemptsRemaining: ATTEMPTS_PER_WINDOW,
    maxAttempts: ATTEMPTS_PER_WINDOW,
    legendBonusActive: userRank <= 4 || isUclSpecial,
    isUclSpecial,
    championBonusActive,
    userRankAtOpen: userRank,
    hasSpunClubs: false,
    rolledClubs: [],
    attemptedPlayerIds: [],
    signedPlayerIds: [],
    lastOfferResult: null,
    history: prev.history,
    completedWindows: prev.completedWindows,
  };
}

/**
 * Non-linear realistic market base value (€M) by OVR & card tier.
 */
function computeBaseMarketValueM(player: Player): number {
  if (player.isLegend) {
    return Math.round(145 + Math.max(0, player.ovr - 90) * 16);
  }
  const ovr = player.ovr;
  if (ovr <= 73) return Math.max(4, Math.round(4 + (ovr - 70) * 1.5));
  if (ovr <= 78) return Math.round(9 + (ovr - 73) * 3.0); // 12..24M
  if (ovr <= 83) return Math.round(25 + (ovr - 78) * 5.8); // 31..54M
  if (ovr <= 87) return Math.round(56 + (ovr - 83) * 9.5); // 66..94M
  return Math.round(98 + (ovr - 87) * 15.5); // 114..190M
}

/**
 * Base signing probability before form, selling club rank, and user prestige adjustments.
 * Tuned so:
 * - Rotation (<=78): ~74-90%
 * - Key starter (79-84): ~48-66%
 * - Worldclass (85-88): ~30-42%
 * - Superstar (89+ / superstar): ~23-29% (minimum floor 20%)
 * - Legend FA: ~28-34% (minimum floor 20%)
 */
function computeBaseSigningChance(player: Player): number {
  const tier = getCardTier(player);
  if (tier === 'legend') {
    return clamp(Math.round(34 - Math.max(0, player.ovr - 91) * 0.7), 28, 34);
  }
  if (tier === 'superstar' || player.ovr >= 89) {
    return clamp(Math.round(29 - Math.max(0, player.ovr - 89) * 1.2), 23, 29);
  }
  if (player.ovr >= 85) {
    // 85 -> 42, 86 -> 38, 87 -> 34, 88 -> 30
    return Math.round(42 - (player.ovr - 85) * 4);
  }
  if (player.ovr >= 79) {
    // 79 -> 66, 80 -> 62, 81 -> 59, 82 -> 55, 83 -> 52, 84 -> 48
    return Math.round(66 - (player.ovr - 79) * 3.6);
  }
  // 70..78 -> 90..76
  return clamp(Math.round(90 - Math.max(0, player.ovr - 70) * 1.75), 74, 92);
}

/**
 * Estimates a club's virtual league rank for leagues outside the user's current league,
 * adding mild season-to-season variance scaled by currentRound.
 */
export function estimateVirtualClubRank(
  club: Club,
  leagueId: LeagueId,
  currentRound: number,
  windowIndex: number,
): { rank: number; leagueSize: number } {
  const league = getLeagueById(leagueId);
  const scored = league.clubs.map((c) => {
    const base = (c.att + c.mid + c.def) / 3;
    const noise =
      (seededUnit(`${c.id}-r${currentRound}-w${windowIndex}`) - 0.5) * 3.8;
    return { id: c.id, score: base + noise };
  });
  scored.sort((a, b) => b.score - a.score);
  const idx = scored.findIndex((s) => s.id === club.id);
  return {
    rank: idx === -1 ? Math.ceil(league.clubs.length / 2) : idx + 1,
    leagueSize: league.clubs.length,
  };
}

export interface EvaluateTransferTargetParams {
  player: Player;
  club: Club | null;
  leagueId: LeagueId | 'LEGEND';
  clubRank: number;
  leagueSize: number;
  currentRound: number;
  totalRounds: number;
  windowIndex: number;
  userRank: number;
  userLeagueSize: number;
  realStats?: PlayerSeasonStats | null;
  championBonusActive?: boolean;
}

/**
 * Evaluates a player's dynamic transfer market value (€M) and signing success probability (%)
 * based on current season form (rating, goals, assists, clean sheets), selling club rank,
 * and user club prestige (current league standing + UCL champion bonus).
 */
export function evaluateTransferTarget(
  params: EvaluateTransferTargetParams,
): TransferTargetPlayer {
  const {
    player,
    club,
    leagueId,
    clubRank,
    leagueSize,
    currentRound,
    totalRounds,
    windowIndex,
    userRank,
    userLeagueSize,
    realStats,
    championBonusActive = false,
  } = params;

  const isLegendFa = player.isLegend || leagueId === 'LEGEND';
  const expectedRating = 6.52 + (player.ovr - 74) * 0.044;
  const effectiveRounds = Math.max(4, currentRound);

  let formRating: number;
  let formGoals: number;
  let formAssists: number;
  let formCleanSheets: number;
  let formScore: number; // -1.0 (deep slump) .. +1.0 (blistering form)

  if (isLegendFa) {
    formRating = Number((7.65 + seededUnit(`leg-${player.id}-w${windowIndex}`) * 0.65).toFixed(2));
    formGoals = 0;
    formAssists = 0;
    formCleanSheets = 0;
    formScore = 0.25;
  } else if (realStats && realStats.appearances >= 2) {
    formRating = Number(realStats.avgRating.toFixed(2));
    formGoals = realStats.goals;
    formAssists = realStats.assists;
    formCleanSheets = realStats.cleanSheets;

    const ratingDiff = formRating - expectedRating;
    const apps = Math.max(1, realStats.appearances);
    let outputDiff = 0;
    if (player.position === 'FW') {
      const gaPerMatch = (formGoals + formAssists * 0.7) / apps;
      const expectedGa = 0.28 + Math.max(0, player.ovr - 75) * 0.032;
      outputDiff = (gaPerMatch - expectedGa) * 0.9;
    } else if (player.position === 'MF') {
      const gaPerMatch = (formGoals * 0.8 + formAssists) / apps;
      const expectedGa = 0.16 + Math.max(0, player.ovr - 75) * 0.022;
      outputDiff = (gaPerMatch - expectedGa) * 0.85;
    } else {
      const csRate = formCleanSheets / apps;
      const expectedCs = 0.26 + Math.max(0, player.ovr - 75) * 0.015;
      outputDiff = (csRate - expectedCs) * 0.9;
    }
    formScore = clamp(ratingDiff * 1.15 + outputDiff, -1.0, 1.0);
  } else {
    // Deterministic season form simulation for players in other leagues / unused squad members
    const u1 = seededUnit(`form-${player.id}-r${currentRound}-w${windowIndex}`);
    const u2 = seededUnit(`out-${player.id}-r${currentRound}-w${windowIndex}`);
    // Club performing well gently lifts form
    const rankNorm = (leagueSize - clubRank) / Math.max(1, leagueSize - 1); // 0..1
    const rawMood = (u1 - 0.5) * 1.9 + (rankNorm - 0.5) * 0.35;
    formScore = clamp(rawMood, -1.0, 1.0);

    formRating = Number(
      clamp(expectedRating + formScore * 0.62, 5.9, 8.65).toFixed(2),
    );
    const scale = effectiveRounds / Math.max(1, totalRounds);
    if (player.position === 'FW') {
      const expectedSeasonGoals = 8 + Math.max(0, player.ovr - 74) * 1.15;
      const expectedSeasonAssists = 3 + Math.max(0, player.ovr - 75) * 0.45;
      formGoals = Math.max(
        0,
        Math.round(expectedSeasonGoals * scale * (1 + formScore * 0.55 + (u2 - 0.5) * 0.25)),
      );
      formAssists = Math.max(
        0,
        Math.round(expectedSeasonAssists * scale * (1 + formScore * 0.45)),
      );
      formCleanSheets = 0;
    } else if (player.position === 'MF') {
      const expectedSeasonGoals = 3 + Math.max(0, player.ovr - 75) * 0.45;
      const expectedSeasonAssists = 5 + Math.max(0, player.ovr - 75) * 0.65;
      formGoals = Math.max(
        0,
        Math.round(expectedSeasonGoals * scale * (1 + formScore * 0.45)),
      );
      formAssists = Math.max(
        0,
        Math.round(expectedSeasonAssists * scale * (1 + formScore * 0.55 + (u2 - 0.5) * 0.2)),
      );
      formCleanSheets = 0;
    } else {
      const expectedCs = 6 + Math.max(0, player.ovr - 74) * 0.65;
      formGoals = player.position === 'DF' && u2 > 0.65 ? Math.max(1, Math.round(scale * 3)) : 0;
      formAssists = player.position === 'DF' && u2 > 0.55 ? Math.max(0, Math.round(scale * 4)) : 0;
      formCleanSheets = Math.max(
        0,
        Math.round(expectedCs * scale * (1 + formScore * 0.4)),
      );
    }
  }

  // Value multipliers
  const baseValueM = computeBaseMarketValueM(player);
  const formDeltaPct = Math.round(formScore * 30); // -30% .. +30%

  let clubRankDeltaPct = 0;
  if (!isLegendFa) {
    if (clubRank <= 2) clubRankDeltaPct = 14;
    else if (clubRank <= 4) clubRankDeltaPct = 9;
    else if (clubRank <= 7) clubRankDeltaPct = 4;
    else if (clubRank >= leagueSize - 3) clubRankDeltaPct = -13;
    else if (clubRank >= leagueSize - 6) clubRankDeltaPct = -7;
  }

  const rawMarketValue =
    baseValueM * (1 + formDeltaPct / 100) * (1 + clubRankDeltaPct / 100);
  const marketValueM = Math.max(3, Math.round(rawMarketValue));

  // Probability modifiers
  const baseChance = computeBaseSigningChance(player);
  // Hot form lowers signing chance (harder to pry away), slump increases signing chance
  const formChanceMod = isLegendFa ? 0 : Math.round(-formScore * 11);
  // Selling club rank modifier
  let sellingClubChanceMod = 0;
  if (!isLegendFa) {
    if (clubRank <= 4) sellingClubChanceMod = -5;
    else if (clubRank >= leagueSize - 3) sellingClubChanceMod = 8;
    else if (clubRank >= leagueSize - 6) sellingClubChanceMod = 4;
  }
  // User club prestige modifier (+ extra UCL Champion prestige bonus!)
  let userPrestigeDeltaPct = 0;
  if (userRank === 1) userPrestigeDeltaPct = 9;
  else if (userRank <= 4) userPrestigeDeltaPct = 6;
  else if (userRank <= 7) userPrestigeDeltaPct = 2;
  else if (userRank >= userLeagueSize - 3) userPrestigeDeltaPct = -7;
  else if (userRank >= userLeagueSize - 6) userPrestigeDeltaPct = -3;

  if (championBonusActive) {
    userPrestigeDeltaPct += isLegendFa ? 4 : 5;
  }

  const tier = getCardTier(player);
  const maxCap =
    tier === 'legend' || isLegendFa
      ? championBonusActive
        ? 46
        : 42
      : tier === 'superstar' || player.ovr >= 89
        ? championBonusActive
          ? 41
          : 36
        : 95;
  const minFloor = tier === 'legend' || isLegendFa ? 22 : 20;

  const finalChance = clamp(
    Math.round(
      baseChance + formChanceMod + sellingClubChanceMod + userPrestigeDeltaPct,
    ),
    minFloor,
    maxCap,
  );

  const formTrend: TransferFormTrend =
    formDeltaPct >= 8 ? 'up' : formDeltaPct <= -8 ? 'down' : 'flat';

  let formSummary: string;
  if (isLegendFa) {
    formSummary = championBonusActive
      ? '자유계약 레전드 · 리그 우승 프리미엄 적용'
      : '자유계약 레전드 · 특별 영입 협상';
  } else if (player.position === 'GK' || player.position === 'DF') {
    formSummary = `평점 ${formRating.toFixed(2)} · CS ${formCleanSheets}${formGoals + formAssists > 0 ? ` · ${formGoals}골 ${formAssists}도움` : ''}`;
  } else {
    formSummary = `평점 ${formRating.toFixed(2)} · ${formGoals}골 ${formAssists}도움`;
  }

  return {
    player,
    clubName: club ? club.name : '레전드 FA',
    clubShortName: club ? club.shortName : 'LEG',
    clubPrimaryColor: club ? club.primaryColor : '#f59e0b',
    clubSecondaryColor: club ? club.secondaryColor : '#1c1917',
    leagueId,
    clubRank,
    leagueSize,
    marketValueM,
    successChance: finalChance,
    formTrend,
    formRating,
    formGoals,
    formAssists,
    formCleanSheets,
    formSummary,
    breakdown: {
      baseValueM,
      formDeltaPct,
      clubRankDeltaPct,
      userPrestigeDeltaPct,
      baseChance,
      finalChance,
    },
    isLegendFa,
  };
}

const SQUAD_FILL_TEMPLATE: SubPosition[] = [
  'GK',
  'CB',
  'CB',
  'LB',
  'RB',
  'CDM',
  'CM',
  'CAM',
  'LW',
  'RW',
  'ST',
];

/**
 * Builds a realistic browseable 2026-27 squad (up to 16 players) for a rolled club,
 * guaranteeing that Top-3 OVR real players in every broad position (GK/DF/MF/FW) are always exposed,
 * while excluding globally owned or departed players to preserve single-instance player uniqueness.
 */
export function buildTransferClubSquad(params: {
  club: Club;
  leagueId: LeagueId;
  ownedIds: Set<string>;
  excludeIds?: Set<string>;
  aiRoster?: Player[];
  clubRank: number;
  leagueSize: number;
  currentRound: number;
  totalRounds: number;
  windowIndex: number;
  userRank: number;
  userLeagueSize: number;
  allPlayerStats: Record<string, PlayerSeasonStats>;
  isUserLeague: boolean;
  championBonusActive?: boolean;
}): TransferTargetPlayer[] {
  const {
    club,
    leagueId,
    ownedIds,
    excludeIds,
    aiRoster,
    clubRank,
    leagueSize,
    currentRound,
    totalRounds,
    windowIndex,
    userRank,
    userLeagueSize,
    allPlayerStats,
    isUserLeague,
    championBonusActive = false,
  } = params;

  const squadPlayers: Player[] = [];
  const usedIds = new Set<string>(ownedIds);
  if (excludeIds) {
    for (const id of excludeIds) usedIds.add(id);
  }
  const usedNames = new Set<string>();

  const pushUnique = (p: Player): boolean => {
    if (usedIds.has(p.id) || usedNames.has(p.name)) return false;
    usedIds.add(p.id);
    usedNames.add(p.name);
    squadPlayers.push(p);
    return true;
  };

  // 1) All real 2026-27 players from activePlayers.json belonging to this club, sorted by OVR desc
  const realClubPlayers = ACTIVE_PLAYERS.filter(
    (p) => p.club === club.name && !usedIds.has(p.id),
  ).sort(
    (a, b) =>
      b.ovr - a.ovr || b.att + b.mid + b.def - (a.att + a.mid + a.def),
  );

  // 1a) Guarantee Top-3 OVR per broad position (GK/DF/MF/FW) first so no star is hidden by club cap
  for (const pos of ['GK', 'DF', 'MF', 'FW'] as const) {
    const posTop3 = realClubPlayers
      .filter((p) => p.position === pos)
      .slice(0, 3);
    for (const p of posTop3) {
      pushUnique(p);
    }
  }

  // 1b) Fill remaining real club players up to 16
  for (const p of realClubPlayers) {
    if (squadPlayers.length >= 16) break;
    pushUnique(p);
  }

  // 2) Pull additional AI starters if this club is in user's league (e.g., traded-in players)
  if (aiRoster && squadPlayers.length < 16) {
    const sortedAi = [...aiRoster].sort((a, b) => b.ovr - a.ovr);
    for (const p of sortedAi) {
      if (squadPlayers.length >= 16) break;
      pushUnique(p);
    }
  }

  // 3) Fill remaining roles up to 9 players so every club has a balanced squad
  const targetCount = 9;
  for (
    let i = 0;
    i < SQUAD_FILL_TEMPLATE.length && squadPlayers.length < targetCount;
    i += 1
  ) {
    const neededSub = SQUAD_FILL_TEMPLATE[i];
    const alreadyCovered = squadPlayers.some((p) =>
      p.mainPositions.includes(neededSub),
    );
    if (alreadyCovered && squadPlayers.length >= 6) continue;

    const seed = hashSeed(`tm-${club.id}-${neededSub}-${i}`);
    const detRng = () => ((seed + i * 19) % 97) / 97;
    const gen = generateClubRotationPlayer({
      club,
      leagueId,
      subPosition: neededSub,
      seedKey: `tm-${club.id}-${neededSub}-${i}`,
      excludeNames: usedNames,
      rng: detRng,
    });
    pushUnique(gen);
  }

  const targets = squadPlayers.map((player) => {
    const realStats = isUserLeague ? allPlayerStats[player.id] ?? null : null;
    return evaluateTransferTarget({
      player,
      club,
      leagueId,
      clubRank,
      leagueSize,
      currentRound,
      totalRounds,
      windowIndex,
      userRank,
      userLeagueSize,
      realStats,
      championBonusActive,
    });
  });

  // Sort by OVR desc, then market value desc
  targets.sort(
    (a, b) => b.player.ovr - a.player.ovr || b.marketValueM - a.marketValueM,
  );
  return targets;
}

export interface SpinTransferClubsParams {
  currentRound: number;
  totalRounds: number;
  windowIndex: number;
  userLeagueId: LeagueId;
  userRank: number;
  standings: StandingRow[];
  otherLeagues?: Partial<Record<LeagueId, { standings: StandingRow[] }>>;
  allPlayerStats: Record<string, PlayerSeasonStats>;
  aiRosters: Record<string, Player[]>;
  ownedIds: Set<string>;
  departedPlayerIds?: string[];
  legendBonusActive: boolean;
  championBonusActive?: boolean;
  allowedLeagueIds?: LeagueId[];
  rng?: () => number;
}

/**
 * Spins the V5 3-Club Transfer Market Roulette:
 * - Draws 3 unique clubs from the user's selected draftLeaguePool (default all 96 European Top-5 clubs),
 *   with a rare chance (2.5% base, 4.0% Top 4/UCL, 5.5% League Champion UCL Special) per reel for a
 *   golden [LEGEND FA] slot presenting exactly 1 Legend player (unaffected by league pool filter).
 * - Each club slot contains its full 2026-27 browseable squad with dynamic form values & probabilities.
 */
export function spinTransferClubs(
  params: SpinTransferClubsParams,
): TransferClubOffer[] {
  const {
    currentRound,
    totalRounds,
    windowIndex,
    userLeagueId,
    userRank,
    standings,
    otherLeagues,
    allPlayerStats,
    aiRosters,
    ownedIds,
    departedPlayerIds = [],
    legendBonusActive,
    championBonusActive = false,
    allowedLeagueIds,
    rng = Math.random,
  } = params;

  const excludeIds = new Set<string>([...ownedIds, ...departedPlayerIds]);

  const legendRate = championBonusActive
    ? UCL_CHAMPION_LEGEND_RATE
    : legendBonusActive
      ? TOP4_TRANSFER_LEGEND_RATE
      : DEFAULT_ROULETTE_LEGEND_RATE;
  const userLeagueSize = standings.length || 20;

  const allowedSet =
    allowedLeagueIds && allowedLeagueIds.length > 0
      ? new Set<LeagueId>(allowedLeagueIds)
      : null;
  const filteredClubPool = allowedSet
    ? ALL_CLUBS_WITH_LEAGUE.filter((entry) => allowedSet.has(entry.leagueId))
    : ALL_CLUBS_WITH_LEAGUE;
  const clubPool =
    filteredClubPool.length >= 3 ? filteredClubPool : ALL_CLUBS_WITH_LEAGUE;

  const pickedClubIds = new Set<string>();
  const usedLegendIds = new Set<string>(excludeIds);
  const offers: TransferClubOffer[] = [];
  let legendSlotCount = 0;

  for (let reelIndex = 0; reelIndex < 3; reelIndex += 1) {
    const rolledLegend = legendSlotCount === 0 && rng() < legendRate;
    if (rolledLegend) {
      const availableLegends = LEGEND_PLAYERS.filter(
        (l) => !usedLegendIds.has(l.id),
      );
      if (availableLegends.length > 0) {
        const chosenLegend =
          availableLegends[Math.floor(rng() * availableLegends.length)];
        usedLegendIds.add(chosenLegend.id);
        legendSlotCount += 1;

        const target = evaluateTransferTarget({
          player: chosenLegend,
          club: null,
          leagueId: 'LEGEND',
          clubRank: 1,
          leagueSize: 1,
          currentRound,
          totalRounds,
          windowIndex,
          userRank,
          userLeagueSize,
          realStats: null,
          championBonusActive,
        });

        offers.push({
          reelIndex,
          isLegendSlot: true,
          club: null,
          leagueId: 'LEGEND',
          clubRank: 1,
          leagueSize: 1,
          squad: [target],
        });
        continue;
      }
    }

    const candidates = clubPool.filter(
      (entry) => !pickedClubIds.has(entry.club.id),
    );
    const picked = candidates[Math.floor(rng() * candidates.length)];
    pickedClubIds.add(picked.club.id);

    const isUserLeague = picked.leagueId === userLeagueId;
    let clubRank: number;
    let leagueSize: number;

    if (isUserLeague) {
      const standingIdx = standings.findIndex(
        (s) => s.teamId === picked.club.id,
      );
      if (standingIdx !== -1) {
        clubRank = standingIdx + 1;
        leagueSize = standings.length;
      } else {
        const est = estimateVirtualClubRank(
          picked.club,
          picked.leagueId,
          currentRound,
          windowIndex,
        );
        clubRank = est.rank;
        leagueSize = est.leagueSize;
      }
    } else {
      const bgStandings = otherLeagues?.[picked.leagueId]?.standings;
      const bgIdx = bgStandings
        ? bgStandings.findIndex((s) => s.teamId === picked.club.id)
        : -1;
      if (bgStandings && bgIdx !== -1) {
        clubRank = bgIdx + 1;
        leagueSize = bgStandings.length;
      } else {
        const est = estimateVirtualClubRank(
          picked.club,
          picked.leagueId,
          currentRound,
          windowIndex,
        );
        clubRank = est.rank;
        leagueSize = est.leagueSize;
      }
    }

    const squad = buildTransferClubSquad({
      club: picked.club,
      leagueId: picked.leagueId,
      ownedIds,
      excludeIds,
      aiRoster: isUserLeague ? aiRosters[picked.club.id] : undefined,
      clubRank,
      leagueSize,
      currentRound,
      totalRounds,
      windowIndex,
      userRank,
      userLeagueSize,
      allPlayerStats,
      isUserLeague,
      championBonusActive,
    });

    offers.push({
      reelIndex,
      isLegendSlot: false,
      club: picked.club,
      leagueId: picked.leagueId,
      clubRank,
      leagueSize,
      squad,
    });
  }

  return offers;
}

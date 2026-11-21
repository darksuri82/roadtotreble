import type { PlayerConditionMap } from '../types/condition';
import type {
  ClubPositionNeeds,
  IncomingTradeOffer,
  TradeAssetValuation,
  TradeHistoryRecord,
  TradePackageEvaluation,
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
import type { Player, Position, SubPosition } from '../types/player';
import { getCardTier } from '../types/player';
import { getMoraleTier, isPlayerActivelyInjured } from './conditionEngine';
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
  tradeHistory: TradeHistoryRecord[] = [],
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
    incomingOffers: [],
    attemptedPlayerIds: [],
    signedPlayerIds: [],
    lastOfferResult: null,
    history,
    tradeHistory,
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
  options?: {
    isUclSpecial?: boolean;
    championBonusActive?: boolean;
    incomingOffers?: IncomingTradeOffer[];
  },
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
    incomingOffers: options?.incomingOffers ?? [],
    attemptedPlayerIds: [],
    signedPlayerIds: [],
    lastOfferResult: null,
    history: prev.history,
    tradeHistory: prev.tradeHistory ?? [],
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

  // 1) If live season aiRoster is provided, treat it as the authoritative squad (reflects all trades!)
  if (aiRoster && aiRoster.length >= 11) {
    const sortedLive = [...aiRoster]
      .filter((p) => !usedIds.has(p.id))
      .sort(
        (a, b) =>
          b.ovr - a.ovr || b.att + b.mid + b.def - (a.att + a.mid + a.def),
      );
    for (const pos of ['GK', 'DF', 'MF', 'FW'] as const) {
      for (const p of sortedLive.filter((x) => x.position === pos).slice(0, 3)) {
        pushUnique(p);
      }
    }
    for (const p of sortedLive) {
      if (squadPlayers.length >= 18) break;
      pushUnique(p);
    }
  } else {
    // 2) Static real 2026-27 players belonging to this club, sorted by OVR desc
    const realClubPlayers = ACTIVE_PLAYERS.filter(
      (p) => p.club === club.name && !usedIds.has(p.id),
    ).sort(
      (a, b) =>
        b.ovr - a.ovr || b.att + b.mid + b.def - (a.att + a.mid + a.def),
    );

    for (const pos of ['GK', 'DF', 'MF', 'FW'] as const) {
      const posTop3 = realClubPlayers
        .filter((p) => p.position === pos)
        .slice(0, 3);
      for (const p of posTop3) {
        pushUnique(p);
      }
    }

    for (const p of realClubPlayers) {
      if (squadPlayers.length >= 16) break;
      pushUnique(p);
    }

    if (aiRoster && squadPlayers.length < 16) {
      const sortedAi = [...aiRoster].sort((a, b) => b.ovr - a.ovr);
      for (const p of sortedAi) {
        if (squadPlayers.length >= 16) break;
        pushUnique(p);
      }
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
  otherLeagues?: Partial<
    Record<
      LeagueId,
      {
        standings: StandingRow[];
        aiRosters?: Record<string, Player[]>;
        playerStats?: Record<string, PlayerSeasonStats>;
      }
    >
  >;
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

    const liveClubRoster = isUserLeague
      ? aiRosters[picked.club.id]
      : otherLeagues?.[picked.leagueId]?.aiRosters?.[picked.club.id];
    const clubStatsMap = isUserLeague
      ? allPlayerStats
      : otherLeagues?.[picked.leagueId]?.playerStats ?? allPlayerStats;

    const squad = buildTransferClubSquad({
      club: picked.club,
      leagueId: picked.leagueId,
      ownedIds,
      excludeIds,
      aiRoster: liveClubRoster,
      clubRank,
      leagueSize,
      currentRound,
      totalRounds,
      windowIndex,
      userRank,
      userLeagueSize,
      allPlayerStats: clubStatsMap,
      isUserLeague,
      championBonusActive,
    });

    const clubNeeds = analyzeClubPositionNeeds(
      liveClubRoster && liveClubRoster.length >= 11
        ? liveClubRoster
        : squad.map((t) => t.player),
    );

    offers.push({
      reelIndex,
      isLegendSlot: false,
      club: picked.club,
      leagueId: picked.leagueId,
      clubRank,
      leagueSize,
      squad,
      clubNeeds,
    });
  }

  return offers;
}

// =============================================================================
// NBA-STYLE TRADE ENGINE (v3.2 — Option 3 Roster Rule + Exponential TP Curve)
// =============================================================================

const POS_LABEL_KO: Record<Position, string> = {
  GK: 'GK(골키퍼)',
  DF: 'DF(수비)',
  MF: 'MF(미드필더)',
  FW: 'FW(공격수)',
};

const IDEAL_SQUAD_COUNT: Record<Position, number> = {
  GK: 2,
  DF: 5,
  MF: 5,
  FW: 4,
};

/**
 * Analyzes an actual club roster to identify its weakest/thinnest positions (Needs)
 * and overstocked positions (Saturated).
 */
export function analyzeClubPositionNeeds(roster: Player[]): ClubPositionNeeds {
  const positions: Position[] = ['GK', 'DF', 'MF', 'FW'];
  const countByPos: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const avgOvrByPos: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };

  const sortedAll = [...roster].sort((a, b) => b.ovr - a.ovr);
  const top11 = sortedAll.slice(0, Math.min(11, sortedAll.length));
  const teamAvgOvr =
    top11.length > 0
      ? top11.reduce((acc, p) => acc + p.ovr, 0) / top11.length
      : 78;

  const needScores: { pos: Position; score: number }[] = [];
  const saturatedPositions: Position[] = [];

  for (const pos of positions) {
    const group = roster
      .filter((p) => p.position === pos)
      .sort((a, b) => b.ovr - a.ovr);
    countByPos[pos] = group.length;
    const starterSliceCount = pos === 'GK' ? 1 : pos === 'FW' ? 2 : 3;
    const starters = group.slice(0, starterSliceCount);
    const posAvg =
      starters.length > 0
        ? starters.reduce((acc, p) => acc + p.ovr, 0) / starters.length
        : teamAvgOvr - 8;
    avgOvrByPos[pos] = Math.round(posAvg * 10) / 10;

    const depthDeficit = IDEAL_SQUAD_COUNT[pos] - group.length;
    const qualityDeficit = teamAvgOvr - posAvg;
    const urgencyScore = depthDeficit * 3.8 + qualityDeficit * 1.15;
    needScores.push({ pos, score: urgencyScore });

    if (
      (pos === 'GK' && group.length >= 3) ||
      (pos !== 'GK' &&
        group.length >= IDEAL_SQUAD_COUNT[pos] + 2 &&
        posAvg >= teamAvgOvr - 0.5)
    ) {
      saturatedPositions.push(pos);
    }
  }

  needScores.sort((a, b) => b.score - a.score);
  const neededPositions = needScores
    .filter((entry, idx) => idx === 0 || entry.score > 0.5)
    .slice(0, 2)
    .map((entry) => entry.pos);

  const summaryParts = neededPositions.map(
    (p, idx) => `${idx === 0 ? '최우선' : '보강'} ${POS_LABEL_KO[p]}`,
  );
  const summaryText =
    summaryParts.length > 0
      ? `보강 필요: ${summaryParts.join(' · ')}`
      : '균형 잡힌 스쿼드';

  return {
    neededPositions,
    saturatedPositions,
    avgOvrByPos,
    countByPos,
    summaryText,
  };
}

/**
 * Exponential Trade Point (TP) formula preventing low-OVR quantity abuse:
 * Base TP = 10 * 1.185^(ovr - 70)
 * - OVR 75 ≈ 23.4 | OVR 80 ≈ 54.6 | OVR 84 ≈ 107.7 | OVR 88 ≈ 212.4 | OVR 90 ≈ 298.2
 */
export function computePlayerTradePoints(params: {
  player: Player;
  receivingClubNeeds?: ClubPositionNeeds | null;
  stats?: PlayerSeasonStats | null;
  conditionMap?: PlayerConditionMap;
}): TradeAssetValuation {
  const { player, receivingClubNeeds = null, stats = null, conditionMap } = params;

  const baseRaw = 10 * Math.pow(1.185, Math.max(-4, player.ovr - 70));
  const baseTp = Math.round(baseRaw * (player.isLegend ? 1.12 : 1) * 10) / 10;

  // Athleticism & versatility upside modifier (replaces age since Player schema tracks stamina + multi-pos)
  let ageModPct = 0;
  if (!player.isLegend) {
    const posCoverage =
      player.mainPositions.length + player.secondaryPositions.length;
    if (player.stamina >= 88 && posCoverage >= 3) ageModPct = 10;
    else if (player.stamina >= 84 || posCoverage >= 3) ageModPct = 5;
    else if (player.stamina <= 70) ageModPct = -6;
  }

  // Current season form modifier
  let formModPct = 0;
  if (stats && stats.appearances >= 2) {
    const expectedRating = 6.52 + (player.ovr - 74) * 0.044;
    formModPct = clamp(Math.round((stats.avgRating - expectedRating) * 20), -15, 18);
  }

  // Condition (Injury + Morale) modifier
  let injuryModPct = 0;
  let moraleModPct = 0;
  const cond = conditionMap?.[player.id];
  if (cond) {
    if (isPlayerActivelyInjured(cond) && cond.injury) {
      if (cond.injury.severity === 'severe') injuryModPct = -35;
      else if (cond.injury.severity === 'moderate') injuryModPct = -15;
      else injuryModPct = -3;
    }
    const mt = getMoraleTier(cond.morale);
    if (mt === 'ecstatic') moraleModPct = 4;
    else if (mt === 'frozen') moraleModPct = -6;
  }

  // Receiving club positional need modifier
  let needModPct = 0;
  if (receivingClubNeeds) {
    if (receivingClubNeeds.neededPositions[0] === player.position) {
      needModPct = 18;
    } else if (receivingClubNeeds.neededPositions[1] === player.position) {
      needModPct = 10;
    } else if (receivingClubNeeds.saturatedPositions.includes(player.position)) {
      needModPct = -15;
    }
  }

  const totalPct = ageModPct + formModPct + injuryModPct + moraleModPct + needModPct;
  const effectiveTp = Math.max(
    4,
    Math.round(baseTp * (1 + totalPct / 100) * 10) / 10,
  );

  return {
    playerId: player.id,
    baseTp,
    ageModPct,
    formModPct,
    injuryModPct,
    moraleModPct,
    needModPct,
    effectiveTp,
  };
}

/**
 * Option 3 Roster Safety Rule:
 * For 2:1 or 3:1 deals (user sends more players than AI targets), automatically selects
 * real low-OVR rotation backups from the AI club so user stays at exact 16 players
 * and AI keeps >= 15 players & >= 1 GK. Only generates a club youth player if AI pool is short.
 */
export function selectAutoFillerPlayers(params: {
  aiRoster: Player[];
  aiTargetIds: Set<string>;
  userSentPlayers: Player[];
  neededCount: number;
  club: Club;
  leagueId: LeagueId;
  excludeIds: Set<string>;
}): Player[] {
  const {
    aiRoster,
    aiTargetIds,
    userSentPlayers,
    neededCount,
    club,
    leagueId,
    excludeIds,
  } = params;
  if (neededCount <= 0) return [];

  const fillers: Player[] = [];
  const pickedIds = new Set<string>(aiTargetIds);
  const usedNames = new Set<string>(aiRoster.map((p) => p.name));

  // Count how many GKs AI will have after losing targets and gaining userSentPlayers
  const incomingGkCount = userSentPlayers.filter((p) => p.position === 'GK').length;
  const remainingAiPlayers = aiRoster.filter((p) => !aiTargetIds.has(p.id));
  let remainingGkCount =
    remainingAiPlayers.filter((p) => p.position === 'GK').length + incomingGkCount;

  // Prefer lowest-OVR rotation players (ideally OVR 70..78) from AI club
  const candidates = [...remainingAiPlayers].sort(
    (a, b) => a.ovr - b.ovr || a.stamina - b.stamina,
  );

  for (const cand of candidates) {
    if (fillers.length >= neededCount) break;
    if (pickedIds.has(cand.id) || excludeIds.has(cand.id)) continue;
    // Never strip AI club of its last GK
    if (cand.position === 'GK' && remainingGkCount <= 1) continue;
    fillers.push(cand);
    pickedIds.add(cand.id);
    if (cand.position === 'GK') remainingGkCount -= 1;
  }

  // Rare fallback: synthesize club academy backup (OVR 71..73) if AI roster lacked spares
  const fallbackSubs: SubPosition[] = ['CM', 'CB', 'ST'];
  let genIdx = 0;
  while (fillers.length < neededCount) {
    const sub = fallbackSubs[genIdx % fallbackSubs.length];
    const seedKey = `trade-youth-${club.id}-${sub}-${genIdx}`;
    const detRng = () => ((hashSeed(seedKey) + genIdx * 23) % 97) / 97;
    const youth = generateClubRotationPlayer({
      club,
      leagueId,
      subPosition: sub,
      seedKey,
      excludeNames: usedNames,
      rng: detRng,
    });
    const clampedOvr = clamp(youth.ovr, 71, 73);
    const academyPlayer: Player = {
      ...youth,
      ovr: clampedOvr,
    };
    fillers.push(academyPlayer);
    usedNames.add(academyPlayer.name);
    genIdx += 1;
  }

  return fillers;
}

export interface EvaluateTradePackageParams {
  userSentPlayers: Player[];
  aiTargetPlayers: Player[];
  aiFillerPlayers?: Player[];
  aiClub: Club;
  aiRoster: Player[];
  aiNeeds: ClubPositionNeeds;
  userSquad: Player[];
  userRank: number;
  userLeagueSize: number;
  aiClubRank: number;
  aiLeagueSize: number;
  allPlayerStats: Record<string, PlayerSeasonStats>;
  conditionMap?: PlayerConditionMap;
  championBonusActive?: boolean;
}

/**
 * Evaluates an NBA-style 1:1 / 2:1 / 3:1 / multi-player trade package with:
 * - Exponential TP curve
 * - Multi-player Consolidation Tax (100% / 78% / 60%, +10% relief on needy positions)
 * - Star Min Quality Guard (87+ target requires maxUserOvr >= targetOvr - 7)
 * - Positional need bonuses (+18% / +10% / -15%)
 * - GK minimum & roster safety checks
 */
export function evaluateTradePackage(
  params: EvaluateTradePackageParams,
): TradePackageEvaluation {
  const {
    userSentPlayers,
    aiTargetPlayers,
    aiFillerPlayers = [],
    aiClub,
    aiRoster,
    aiNeeds,
    userSquad,
    userRank,
    userLeagueSize,
    aiClubRank,
    aiLeagueSize,
    allPlayerStats,
    conditionMap,
    championBonusActive = false,
  } = params;

  const requiredAutoFillers = Math.max(
    0,
    userSentPlayers.length - aiTargetPlayers.length,
  );
  const requiredUserReleaseCount = Math.max(
    0,
    aiTargetPlayers.length - userSentPlayers.length,
  );

  const userValuations = userSentPlayers.map((player) =>
    computePlayerTradePoints({
      player,
      receivingClubNeeds: aiNeeds,
      stats: allPlayerStats[player.id] ?? allPlayerStats[`user::${player.id}`] ?? null,
      conditionMap,
    }),
  );

  const allAiOutgoing = [...aiTargetPlayers, ...aiFillerPlayers];
  const aiValuations = allAiOutgoing.map((player) =>
    computePlayerTradePoints({
      player,
      receivingClubNeeds: null,
      stats: allPlayerStats[player.id] ?? null,
      conditionMap,
    }),
  );

  // Consolidation Tax on user's multi-player package (prevents 3 mediocre players > 1 star)
  const sortedUserVals = [...userValuations].sort(
    (a, b) => b.effectiveTp - a.effectiveTp,
  );
  const taxSteps = [1.0, 0.78, 0.6];
  let userRawTp = 0;
  let userEffectiveTp = 0;

  sortedUserVals.forEach((val, idx) => {
    userRawTp += val.effectiveTp;
    const baseMult = taxSteps[Math.min(idx, taxSteps.length - 1)];
    const needRelief = idx > 0 && val.needModPct > 0 ? 0.1 : 0;
    userEffectiveTp += val.effectiveTp * Math.min(1, baseMult + needRelief);
  });
  userRawTp = Math.round(userRawTp * 10) / 10;
  userEffectiveTp = Math.round(userEffectiveTp * 10) / 10;

  // Fillers are rotation throw-ins (valued at 65% TP so 2:1 / 3:1 deals stay realistic)
  const fillerIds = new Set(aiFillerPlayers.map((p) => p.id));
  const aiEffectiveTp =
    Math.round(
      aiValuations.reduce(
        (acc, v) => acc + v.effectiveTp * (fillerIds.has(v.playerId) ? 0.65 : 1),
        0,
      ) * 10,
    ) / 10;

  const ratio =
    aiEffectiveTp > 0 ? Math.round((userEffectiveTp / aiEffectiveTp) * 100) / 100 : 0;

  const makeBlocked = (reason: string, reaction: string): TradePackageEvaluation => ({
    userRawTp,
    userEffectiveTp,
    aiEffectiveTp,
    ratio,
    acceptanceChance: 0,
    blockedReason: reason,
    gmReaction: reaction,
    gmTone: 'offended',
    userValuations,
    aiValuations,
    requiredAutoFillers,
    requiredUserReleaseCount,
  });

  if (userSentPlayers.length === 0 || aiTargetPlayers.length === 0) {
    return makeBlocked(
      '양 팀에서 최소 1명 이상의 트레이드 선수를 선택해 주세요.',
      `${aiClub.shortName} 단장: "구체적인 트레이드 카드를 올려주시면 검토하겠습니다."`,
    );
  }

  if (userSentPlayers.length > 3 || aiTargetPlayers.length > 3) {
    return makeBlocked(
      '트레이드는 한 번에 최대 3명까지 구성할 수 있습니다.',
      `${aiClub.shortName} 단장: "한 번에 너무 많은 선수를 움직이는 건 무리입니다."`,
    );
  }

  // User GK minimum guard
  const sentIds = new Set(userSentPlayers.map((p) => p.id));
  const postUserGks =
    userSquad.filter((p) => !sentIds.has(p.id) && p.position === 'GK').length +
    allAiOutgoing.filter((p) => p.position === 'GK').length;
  if (postUserGks < 1) {
    return makeBlocked(
      '우리 팀 로스터에 최소 1명의 골키퍼(GK)를 유지해야 합니다.',
      '수석코치: "골키퍼가 0명이 되면 다음 경기를 치를 수 없습니다!"',
    );
  }

  // AI GK minimum guard
  const aiOutIds = new Set(allAiOutgoing.map((p) => p.id));
  const postAiGks =
    aiRoster.filter((p) => !aiOutIds.has(p.id) && p.position === 'GK').length +
    userSentPlayers.filter((p) => p.position === 'GK').length;
  if (aiRoster.length > 0 && postAiGks < 1) {
    return makeBlocked(
      `${aiClub.name}은(는) 마지막 골키퍼를 대체 없이 보낼 수 없습니다.`,
      `${aiClub.shortName} 단장: "우리 주전 골키퍼를 데려가려면 GK 자원을 포함해 주셔야 합니다."`,
    );
  }

  // Anti-Cheese Star Min Quality Guard (OVR 87+ target requires core piece within 7 OVR)
  const maxAiTargetOvr = Math.max(...aiTargetPlayers.map((p) => p.ovr));
  const maxUserSentOvr = Math.max(...userSentPlayers.map((p) => p.ovr));
  if (maxAiTargetOvr >= 87 && maxUserSentOvr < maxAiTargetOvr - 7) {
    const starName =
      aiTargetPlayers.find((p) => p.ovr === maxAiTargetOvr)?.name ?? '핵심 스타';
    return makeBlocked(
      `OVR ${maxAiTargetOvr} 슈퍼스타(${starName}) 영입에는 최소 OVR ${maxAiTargetOvr - 7} 이상의 핵심 선수가 포함되어야 합니다.`,
      `${aiClub.shortName} 단장: "장난하십니까? ${starName} 같은 프랜차이즈 스타를 로테이션 선수들 묶음으로 바꿀 순 없습니다!"`,
    );
  }

  // Prestige & standing gentle shift
  let prestigeShift = 0;
  if (userRank === 1) prestigeShift += 0.04;
  else if (userRank <= 4) prestigeShift += 0.025;
  else if (userRank >= userLeagueSize - 3) prestigeShift -= 0.03;
  if (championBonusActive) prestigeShift += 0.03;
  if (aiClubRank <= 3) prestigeShift -= 0.03;
  else if (aiClubRank >= aiLeagueSize - 4) prestigeShift += 0.04;

  const adjRatio = ratio + prestigeShift;
  let chance = 0;
  if (adjRatio < 0.72) {
    chance = 0;
  } else if (adjRatio < 0.88) {
    chance = 5 + ((adjRatio - 0.72) / 0.16) * 23; // 5..28%
  } else if (adjRatio < 1.0) {
    chance = 28 + ((adjRatio - 0.88) / 0.12) * 34; // 28..62%
  } else if (adjRatio < 1.14) {
    chance = 62 + ((adjRatio - 1.0) / 0.14) * 24; // 62..86%
  } else {
    chance = 86 + Math.min(9, ((adjRatio - 1.14) / 0.2) * 9); // 86..95%
  }

  const acceptanceChance = clamp(Math.round(chance), 0, 95);
  const fillsTopNeed = userSentPlayers.some(
    (p) => p.position === aiNeeds.neededPositions[0],
  );
  const topTarget = [...aiTargetPlayers].sort((a, b) => b.ovr - a.ovr)[0];
  const topSent = [...userSentPlayers].sort((a, b) => b.ovr - a.ovr)[0];

  let gmTone: TradePackageEvaluation['gmTone'];
  let gmReaction: string;
  if (acceptanceChance >= 78) {
    gmTone = 'eager';
    gmReaction = fillsTopNeed
      ? `${aiClub.shortName} 단장: "딱 우리가 찾던 ${POS_LABEL_KO[topSent.position]} 보강 카드입니다! ${topSent.name} 포함 패키지라면 당장 서명하고 싶네요."`
      : `${aiClub.shortName} 단장: "매우 매력적인 제안입니다. 이 조건이라면 이사회 승인이 거의 확실합니다!"`;
  } else if (acceptanceChance >= 48) {
    gmTone = 'considering';
    gmReaction = fillsTopNeed
      ? `${aiClub.shortName} 단장: "${topSent.name}이(가) 우리 취약 포지션에 잘 맞긴 한데, ${topTarget.name}을(를) 내주기엔 조금 더 고민이 필요합니다."`
      : `${aiClub.shortName} 단장: "나쁘지 않은 테이블입니다. 다만 우리가 급한 ${POS_LABEL_KO[aiNeeds.neededPositions[0] ?? 'MF']} 자원이 포함되면 확률이 크게 올라갈 겁니다."`;
  } else if (acceptanceChance >= 15) {
    gmTone = 'hesitant';
    gmReaction = `${aiClub.shortName} 단장: "${topTarget.name}의 위상을 생각하면 아직 가치가 부족합니다. 더 확실한 주전급 카드나 필요 포지션 선수를 보태주세요."`;
  } else {
    gmTone = 'offended';
    gmReaction = `${aiClub.shortName} 단장: "이건 너무 일방적인 제안입니다. ${topTarget.name}을(를) 영입하려면 훨씬 진지한 패키지를 가져오셔야 합니다."`;
  }

  return {
    userRawTp,
    userEffectiveTp,
    aiEffectiveTp,
    ratio,
    acceptanceChance,
    blockedReason: null,
    gmReaction,
    gmTone,
    userValuations,
    aiValuations,
    requiredAutoFillers,
    requiredUserReleaseCount,
  };
}

/**
 * Builds a browseable TransferClubOffer for any specific club (used when user clicks
 * [역제안 / 조건 수정] on an incoming AI trade offer whose club wasn't in the 3 rolled reels).
 */
export function buildTradeClubOfferForClub(params: {
  club: Club;
  leagueId: LeagueId;
  clubRank: number;
  leagueSize: number;
  currentRound: number;
  totalRounds: number;
  windowIndex: number;
  userRank: number;
  userLeagueSize: number;
  isUserLeague: boolean;
  aiRoster?: Player[];
  allPlayerStats: Record<string, PlayerSeasonStats>;
  ownedIds: Set<string>;
  excludeIds?: Set<string>;
  championBonusActive?: boolean;
}): TransferClubOffer {
  const {
    club,
    leagueId,
    clubRank,
    leagueSize,
    currentRound,
    totalRounds,
    windowIndex,
    userRank,
    userLeagueSize,
    isUserLeague,
    aiRoster,
    allPlayerStats,
    ownedIds,
    excludeIds,
    championBonusActive = false,
  } = params;

  const squad = buildTransferClubSquad({
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
    championBonusActive,
  });

  const clubNeeds = analyzeClubPositionNeeds(
    aiRoster && aiRoster.length >= 11 ? aiRoster : squad.map((s) => s.player),
  );

  return {
    reelIndex: 99,
    isLegendSlot: false,
    club,
    leagueId,
    clubRank,
    leagueSize,
    squad,
    clubNeeds,
  };
}

export interface GenerateIncomingTradeOffersParams {
  windowIndex: number;
  currentRound: number;
  userLeagueId: LeagueId;
  userStarters: (Player | null)[];
  userBench: (Player | null)[];
  standings: StandingRow[];
  otherLeagues?: Partial<
    Record<
      LeagueId,
      {
        standings: StandingRow[];
        aiRosters?: Record<string, Player[]>;
        playerStats?: Record<string, PlayerSeasonStats>;
      }
    >
  >;
  aiRosters: Record<string, Player[]>;
  allPlayerStats: Record<string, PlayerSeasonStats>;
  conditionMap?: PlayerConditionMap;
  departedPlayerIds?: string[];
  allowedLeagueIds?: LeagueId[];
  rng?: () => number;
}

/**
 * Generates 0 to 5 realistic incoming AI trade offers per transfer window.
 * Each AI club analyzes its actual position needs, targets a fitting player on the user's squad,
 * and constructs a fair 1:1 or 2:1 trade offer.
 */
export function generateIncomingTradeOffers(
  params: GenerateIncomingTradeOffersParams,
): IncomingTradeOffer[] {
  const {
    windowIndex,
    currentRound,
    userLeagueId,
    userStarters,
    userBench,
    standings,
    otherLeagues,
    aiRosters,
    allPlayerStats,
    conditionMap,
    departedPlayerIds = [],
    allowedLeagueIds,
    rng = Math.random,
  } = params;

  const userSquad = [
    ...userStarters.filter((p): p is Player => p !== null),
    ...userBench.filter((p): p is Player => p !== null),
  ];
  if (userSquad.length < 11) return [];

  // Weighted 0..5 offer count distribution (average ~2.3 offers, can be 0 or up to 5)
  const rollCount = rng();
  let targetCount: number;
  if (rollCount < 0.1) targetCount = 0;
  else if (rollCount < 0.28) targetCount = 1;
  else if (rollCount < 0.56) targetCount = 2;
  else if (rollCount < 0.8) targetCount = 3;
  else if (rollCount < 0.94) targetCount = 4;
  else targetCount = 5;

  if (targetCount === 0) return [];

  const ownedIds = new Set(userSquad.map((p) => p.id));
  const globalExclude = new Set<string>([...ownedIds, ...departedPlayerIds]);
  const userGkCount = userSquad.filter((p) => p.position === 'GK').length;

  const allowedSet =
    allowedLeagueIds && allowedLeagueIds.length > 0
      ? new Set<LeagueId>(allowedLeagueIds)
      : null;
  const candidateClubs = (
    allowedSet
      ? ALL_CLUBS_WITH_LEAGUE.filter((c) => allowedSet.has(c.leagueId))
      : ALL_CLUBS_WITH_LEAGUE
  ).filter((c) => !c.club.isUser);

  // Shuffle clubs (slight preference for user's own league so rivalries feel alive)
  const shuffled = [...candidateClubs].sort((a, b) => {
    const aBonus = a.leagueId === userLeagueId ? 0.18 : 0;
    const bBonus = b.leagueId === userLeagueId ? 0.18 : 0;
    return rng() + bBonus - (rng() + aBonus);
  });

  const offers: IncomingTradeOffer[] = [];
  const usedClubIds = new Set<string>();
  const usedAiPlayerIds = new Set<string>();

  for (const entry of shuffled) {
    if (offers.length >= targetCount) break;
    if (usedClubIds.has(entry.club.id)) continue;

    const isUserLeague = entry.leagueId === userLeagueId;
    const liveRoster = isUserLeague
      ? aiRosters[entry.club.id]
      : otherLeagues?.[entry.leagueId]?.aiRosters?.[entry.club.id];
    const clubRoster = (
      liveRoster && liveRoster.length >= 11
        ? liveRoster
        : ACTIVE_PLAYERS.filter((p) => p.club === entry.club.name)
    ).filter((p) => !globalExclude.has(p.id) && !usedAiPlayerIds.has(p.id));

    if (clubRoster.length < 11) continue;

    const clubNeeds = analyzeClubPositionNeeds(clubRoster);
    const wantedPos = clubNeeds.neededPositions[0] ?? 'MF';

    // Pick an appealing user player matching AI's needed position (prefer OVR >= 77)
    const userCandidates = userSquad
      .filter((p) => {
        if (p.position === 'GK' && userGkCount <= 1) return false;
        return clubNeeds.neededPositions.includes(p.position) && p.ovr >= 76;
      })
      .sort((a, b) => b.ovr - a.ovr);

    const fallbackUserCandidates =
      userCandidates.length > 0
        ? userCandidates
        : userSquad
            .filter((p) => !(p.position === 'GK' && userGkCount <= 1) && p.ovr >= 78)
            .sort((a, b) => b.ovr - a.ovr);

    if (fallbackUserCandidates.length === 0) continue;

    const pickIdx = Math.min(
      fallbackUserCandidates.length - 1,
      Math.floor(rng() * Math.min(4, fallbackUserCandidates.length)),
    );
    const requestedPlayer = fallbackUserCandidates[pickIdx];
    const requestedVal = computePlayerTradePoints({
      player: requestedPlayer,
      receivingClubNeeds: clubNeeds,
      stats: allPlayerStats[requestedPlayer.id] ?? null,
      conditionMap,
    });

    // Find a fair 1:1 trade chip from AI's roster (prefer non-need or surplus position, keeping AI GK >= 1)
    const aiGkCount = clubRoster.filter((p) => p.position === 'GK').length;
    const aiChips = clubRoster
      .filter((p) => {
        if (p.position === 'GK' && aiGkCount <= 1 && requestedPlayer.position !== 'GK') {
          return false;
        }
        return Math.abs(p.ovr - requestedPlayer.ovr) <= 4;
      })
      .map((p) => ({
        player: p,
        val: computePlayerTradePoints({
          player: p,
          receivingClubNeeds: null,
          stats: allPlayerStats[p.id] ?? null,
          conditionMap,
        }),
      }))
      .sort(
        (a, b) =>
          Math.abs(a.val.effectiveTp - requestedVal.effectiveTp) -
          Math.abs(b.val.effectiveTp - requestedVal.effectiveTp),
      );

    if (aiChips.length === 0) continue;

    const chosenAiPlayer = aiChips[0].player;
    const ratio = aiChips[0].val.effectiveTp / Math.max(1, requestedVal.effectiveTp);
    // Keep offers realistically fair (0.82 .. 1.24 TP ratio)
    if (ratio < 0.8 || ratio > 1.28) continue;

    let clubRank = 10;
    let leagueSize = 20;
    const table = isUserLeague
      ? standings
      : otherLeagues?.[entry.leagueId]?.standings;
    if (table && table.length > 0) {
      const idx = table.findIndex((s) => s.teamId === entry.club.id);
      if (idx !== -1) {
        clubRank = idx + 1;
        leagueSize = table.length;
      }
    } else {
      const est = estimateVirtualClubRank(
        entry.club,
        entry.leagueId,
        currentRound,
        windowIndex,
      );
      clubRank = est.rank;
      leagueSize = est.leagueSize;
    }

    const pitches = [
      `"우리 구단은 지금 ${POS_LABEL_KO[wantedPos]} 보강이 절실합니다. ${chosenAiPlayer.name} (OVR ${chosenAiPlayer.ovr}) 카드를 드릴 테니 ${requestedPlayer.name} 트레이드를 논의해 보시죠."`,
      `"${requestedPlayer.name} 선수를 오래 지켜봤습니다. ${chosenAiPlayer.name}과의 맞트레이드라면 양 팀 모두 전력 보강이 될 겁니다!"`,
      `"스카우트 팀에서 ${requestedPlayer.name} 영입을 강력 추천했습니다. ${chosenAiPlayer.name}을(를) 내어드리는 진지한 제안입니다."`,
    ];

    usedClubIds.add(entry.club.id);
    usedAiPlayerIds.add(chosenAiPlayer.id);

    offers.push({
      id: `inc-w${windowIndex}-r${currentRound}-${entry.club.id}-${offers.length}`,
      club: entry.club,
      leagueId: entry.leagueId,
      clubRank,
      leagueSize,
      clubNeeds,
      aiOffersPlayers: [chosenAiPlayer],
      userRequestedPlayers: [requestedPlayer],
      aiPitch: pitches[offers.length % pitches.length],
      status: 'pending',
    });
  }

  return offers;
}


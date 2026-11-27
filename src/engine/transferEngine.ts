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
  ALL_CLUBS_WITH_LEAGUE,
  buildAiClubSquad16,
  generateClubRotationPlayer,
  getLeagueById,
  LEGEND_PLAYERS,
} from './dataLoader';
import {
  CASH_STAR_GUARD_RELIEF_THRESHOLD_M,
  computeCashOfferTp,
} from './budgetEngine';
import { DEFAULT_ROULETTE_LEGEND_RATE } from './draftEngine';

export const ATTEMPTS_PER_WINDOW = 3;
/** Transfer market roulette Legend FA rate is fixed at base 2.5% per reel regardless of league rank. */
export const TRANSFER_ROULETTE_LEGEND_RATE = DEFAULT_ROULETTE_LEGEND_RATE;

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
    maxAttemptsOverride?: number;
    ffpEmbargoActive?: boolean;
  },
): TransferMarketState {
  const isUclSpecial = Boolean(options?.isUclSpecial);
  const championBonusActive = Boolean(options?.championBonusActive);
  const maxAttempts =
    typeof options?.maxAttemptsOverride === 'number'
      ? Math.max(0, options.maxAttemptsOverride)
      : ATTEMPTS_PER_WINDOW;
  return {
    isOpen: true,
    windowIndex,
    triggerRound,
    attemptsRemaining: maxAttempts,
    maxAttempts,
    legendBonusActive: false,
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
    ffpEmbargoActive: Boolean(options?.ffpEmbargoActive),
  };
}

/**
 * Non-linear realistic market base value (€M) by OVR & card tier.
 */
function computeBaseMarketValueM(player: Player): number {
  if (player.isLegend) {
    return Math.round(140 + Math.max(0, player.ovr - 89) * 14);
  }
  const ovr = player.ovr;
  if (ovr <= 73) return Math.max(4, Math.round(4 + (ovr - 70) * 1.5));
  if (ovr <= 78) return Math.round(9 + (ovr - 73) * 3.0); // 12..24M
  if (ovr <= 83) return Math.round(25 + (ovr - 78) * 5.8); // 31..54M
  if (ovr <= 86) return Math.round(56 + (ovr - 83) * 10.5); // 67..88M
  return Math.round(92 + (ovr - 86) * 16.0); // 108..188M
}

/**
 * Single source of truth for a player's estimated market value (€M) across Solo & Multiplayer transfer markets.
 * Applies the same athleticism/versatility curve as computePlayerTradePoints and optional shock-bargain discount.
 */
export function computePlayerMarketValueM(
  player: Player,
  options?: { isShockBargain?: boolean; marketValueMOverride?: number },
): number {
  if (
    typeof options?.marketValueMOverride === 'number' &&
    options.marketValueMOverride > 0
  ) {
    const overridden = options.isShockBargain
      ? Math.round(options.marketValueMOverride * 0.65)
      : Math.round(options.marketValueMOverride);
    return Math.max(3, overridden);
  }
  const base = computeBaseMarketValueM(player);
  let mult = 1;
  if (!player.isLegend) {
    const posCoverage =
      player.mainPositions.length + player.secondaryPositions.length;
    if (player.stamina >= 88 && posCoverage >= 3) mult += 0.1;
    else if (player.stamina >= 84 || posCoverage >= 3) mult += 0.05;
    else if (player.stamina <= 70) mult -= 0.06;
  }
  if (options?.isShockBargain) {
    mult *= 0.65;
  }
  return Math.max(3, Math.round(base * mult));
}

/**
 * Base signing probability before form, selling club rank, and user prestige adjustments.
 * Tuned for the compressed active OVR scale (max 92):
 * - Rotation (<=78): ~74-90%
 * - Key starter (79-83): ~50-66%
 * - Worldclass (84-87): ~30-45%
 * - Superstar (88+ / superstar): ~23-29% (minimum floor 20%)
 * - Classic FA: ~21-26% (minimum floor 15%, cap 30% / 34% with champion bonus)
 */
function computeBaseSigningChance(player: Player): number {
  const tier = getCardTier(player);
  if (tier === 'legend') {
    return clamp(Math.round(26 - Math.max(0, player.ovr - 90) * 0.8), 21, 26);
  }
  if (tier === 'superstar' || player.ovr >= 88) {
    return clamp(Math.round(29 - Math.max(0, player.ovr - 88) * 1.4), 23, 29);
  }
  if (player.ovr >= 84) {
    // 84 -> 45, 85 -> 40, 86 -> 35, 87 -> 31
    return Math.round(45 - (player.ovr - 84) * 4.6);
  }
  if (player.ovr >= 79) {
    // 79 -> 66, 80 -> 62, 81 -> 58, 82 -> 54, 83 -> 50
    return Math.round(66 - (player.ovr - 79) * 4.0);
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
        ? 34
        : 30
      : tier === 'superstar' || player.ovr >= 88
        ? championBonusActive
          ? 41
          : 36
        : 95;
  const minFloor = tier === 'legend' || isLegendFa ? 15 : 20;

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
    const eraPrefix = player.classicEra ? `${player.classicEra} 클래식` : '클래식';
    formSummary = championBonusActive
      ? `자유계약 ${eraPrefix} · 리그 우승 프리미엄 적용`
      : `자유계약 ${eraPrefix} · 특별 영입 협상`;
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

const SHOCK_BARGAIN_REASONS = [
  '🚨 보드진 갈등 · 프런트 급매 (-35%)',
  '🚨 단장 기행 · 전술 전면 개편 급매 (-35%)',
  '🚨 재계약 협상 결렬 · 긴급 처분 (-35%)',
];

/**
 * Deterministic check for whether an AI player on a rolled club is a rare
 * "Luka Dončić style" front-office shock bargain (~4.5% per player, max 1 per club).
 */
export function evaluateShockBargainStatus(params: {
  player: Player;
  clubId: string;
  windowIndex: number;
  currentRound: number;
}): {
  isShockBargain: boolean;
  bargainDiscountPct: number;
  bargainReason?: string;
} {
  const { player, clubId, windowIndex, currentRound } = params;
  if (player.isLegend) {
    return { isShockBargain: false, bargainDiscountPct: 0 };
  }
  const u = seededUnit(
    `shock-bargain-${clubId}-${player.id}-w${windowIndex}-r${currentRound}`,
  );
  // ~4.5% rare chance for outfield/key players (OVR >= 76)
  if (player.ovr >= 76 && u < 0.045) {
    const rIdx =
      hashSeed(`${player.id}-w${windowIndex}`) % SHOCK_BARGAIN_REASONS.length;
    return {
      isShockBargain: true,
      bargainDiscountPct: -35,
      bargainReason: SHOCK_BARGAIN_REASONS[rIdx],
    };
  }
  return { isShockBargain: false, bargainDiscountPct: 0 };
}

/**
 * Builds an AI club's standardized 16-player browseable 2026-27 squad matching the user's 16-man structure:
 * - Starting 11 assigned to `club.formation` slots (`isStarter: true`)
 * - Core Bench 5 sorted by highest OVR: 1 GK + 2 DF + 2 FW/MF (`isStarter: false`)
 * - Guarantees Top-3 OVR real players per position are included while excluding globally owned/departed players.
 * - Rolls rare (~4.5%, max 1 per club) "Dončić-style" Shock Bargain discount (-35%).
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

  const squad16 = buildAiClubSquad16({
    club,
    leagueId,
    liveAiRoster: aiRoster,
    ownedIds,
    excludeIds,
  });

  let shockCount = 0;
  const buildEntry = (
    player: Player,
    isStarter: boolean,
    slotLabel: string,
  ): TransferTargetPlayer => {
    const realStats = isUserLeague ? allPlayerStats[player.id] ?? null : null;
    const baseTarget = evaluateTransferTarget({
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

    const shock =
      shockCount < 1
        ? evaluateShockBargainStatus({
            player,
            clubId: club.id,
            windowIndex,
            currentRound,
          })
        : { isShockBargain: false, bargainDiscountPct: 0 };
    if (shock.isShockBargain) {
      shockCount += 1;
    }

    return {
      ...baseTarget,
      isStarter,
      slotLabel,
      isShockBargain: shock.isShockBargain,
      bargainDiscountPct: shock.bargainDiscountPct,
      bargainReason: shock.bargainReason,
    };
  };

  const starterTargets = squad16.starters.map((p, idx) =>
    buildEntry(p, true, squad16.starterSlotLabels[idx] ?? p.position),
  );
  const benchTargets = squad16.bench.map((p) =>
    buildEntry(p, false, `벤치 ${p.mainPositions[0] ?? p.position}`),
  );

  return [...starterTargets, ...benchTargets];
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
 *   with a fixed rare chance (2.5% per reel, regardless of league standing) for a
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
    championBonusActive = false,
    allowedLeagueIds,
    rng = Math.random,
  } = params;

  const excludeIds = new Set<string>([...ownedIds, ...departedPlayerIds]);

  // Fixed base 2.5% per reel regardless of league rank/UCL champion status
  const legendRate = TRANSFER_ROULETTE_LEGEND_RATE;
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
          classicEra: chosenLegend.classicEra,
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

    const clubNeeds = analyzeClubPositionNeeds(squad.map((t) => t.player));

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
// NBA-STYLE TRADE ENGINE (v3.3 — 16-Man Squad + Boosted Needs + Shock Bargains)
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
 * Exponential Trade Value formula preventing low-OVR quantity abuse while heavily weighting
 * club positional needs (+32% / +18% / -25%) and rare Dončić-style shock bargains (-35%):
 * Base Value = 10 * 1.185^(ovr - 70)
 * - OVR 75 ≈ 23.4 | OVR 80 ≈ 54.6 | OVR 84 ≈ 107.7 | OVR 88 ≈ 212.4 | OVR 90 ≈ 298.2
 */
export function computePlayerTradePoints(params: {
  player: Player;
  receivingClubNeeds?: ClubPositionNeeds | null;
  sellingClubNeeds?: ClubPositionNeeds | null;
  isShockBargain?: boolean;
  stats?: PlayerSeasonStats | null;
  conditionMap?: PlayerConditionMap;
}): TradeAssetValuation {
  const {
    player,
    receivingClubNeeds = null,
    sellingClubNeeds = null,
    isShockBargain = false,
    stats = null,
    conditionMap,
  } = params;

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

  // Boosted receiving club positional need modifier (+32% / +18% / -25%)
  let needModPct = 0;
  if (receivingClubNeeds) {
    if (receivingClubNeeds.neededPositions[0] === player.position) {
      needModPct = 32;
    } else if (receivingClubNeeds.neededPositions[1] === player.position) {
      needModPct = 18;
    } else if (receivingClubNeeds.saturatedPositions.includes(player.position)) {
      needModPct = -25;
    }
  } else if (sellingClubNeeds) {
    // AI selling from its saturated position discounts demand (-12%); selling from its #1 scarce position adds premium (+12%)
    if (sellingClubNeeds.saturatedPositions.includes(player.position)) {
      needModPct = -12;
    } else if (sellingClubNeeds.neededPositions[0] === player.position) {
      needModPct = 12;
    }
  }

  // Rare "Dončić-style" Shock Bargain discount (-35%)
  const bargainModPct = isShockBargain ? -35 : 0;

  const totalPct =
    ageModPct +
    formModPct +
    injuryModPct +
    moraleModPct +
    needModPct +
    bargainModPct;
  const effectiveTp = Math.max(
    4,
    Math.round(baseTp * Math.max(0.35, 1 + totalPct / 100) * 10) / 10,
  );

  return {
    playerId: player.id,
    baseTp,
    ageModPct,
    formModPct,
    injuryModPct,
    moraleModPct,
    needModPct,
    bargainModPct,
    isShockBargain,
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
  shockBargainIds?: Set<string>;
  /** Optional cash sweetener (€M) from remaining draft budget */
  cashOfferM?: number;
}

/**
 * Evaluates an NBA-style 1:1 / 2:1 / 3:1 / multi-player trade package with:
 * - Exponential trade value curve
 * - Multi-player Consolidation Tax (100% / 78% / 60%, +15% relief on needy positions)
 * - Optional cash sweetener (€M -> TP, exempt from consolidation tax)
 * - Star Min Quality Guard (87+ target requires maxUserOvr >= targetOvr - 7, waived on Shock Bargains)
 * - Boosted positional need bonuses (+32% / +18% / -25% + direct probability boost)
 * - Rare "Dončić-style" Shock Bargain (-35% demand discount & +12%p acceptance boost)
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
    shockBargainIds,
    cashOfferM = 0,
  } = params;

  const safeCashOfferM = Math.max(0, Math.round(cashOfferM));
  const cashTp = computeCashOfferTp(safeCashOfferM);

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
      sellingClubNeeds: aiNeeds,
      isShockBargain: Boolean(shockBargainIds?.has(player.id)),
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
    const needRelief = idx > 0 && val.needModPct > 0 ? 0.15 : 0;
    userEffectiveTp += val.effectiveTp * Math.min(1, baseMult + needRelief);
  });
  userRawTp = Math.round((userRawTp + cashTp) * 10) / 10;
  userEffectiveTp = Math.round((userEffectiveTp + cashTp) * 10) / 10;

  // Fillers are rotation throw-ins (valued at 65% value so 2:1 / 3:1 deals stay realistic)
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
    cashOfferM: safeCashOfferM,
    cashTp,
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

  const hasShockBargainTarget = aiTargetPlayers.some((p) =>
    Boolean(shockBargainIds?.has(p.id)),
  );

  // Anti-Cheese Star Quality Penalty (waived on Shock Bargains; large €80M+ cash relaxes OVR-7 guard by 1)
  const maxAiTargetOvr = Math.max(...aiTargetPlayers.map((p) => p.ovr));
  const maxUserSentOvr = Math.max(...userSentPlayers.map((p) => p.ovr));
  const starOvrGapLimit =
    safeCashOfferM >= CASH_STAR_GUARD_RELIEF_THRESHOLD_M ? 8 : 7;
  const starQualityMismatch =
    !hasShockBargainTarget &&
    maxAiTargetOvr >= 87 &&
    maxUserSentOvr < maxAiTargetOvr - starOvrGapLimit;

  // Prestige & standing gentle shift
  let prestigeShift = 0;
  if (userRank === 1) prestigeShift += 0.04;
  else if (userRank <= 4) prestigeShift += 0.025;
  else if (userRank >= userLeagueSize - 3) prestigeShift -= 0.025;
  if (championBonusActive) prestigeShift += 0.03;
  if (aiClubRank <= 3) prestigeShift -= 0.025;
  else if (aiClubRank >= aiLeagueSize - 4) prestigeShift += 0.04;

  const adjRatio = ratio + prestigeShift;
  let chance = 3;
  if (adjRatio < 0.55) {
    chance = 3 + Math.max(0, adjRatio / 0.55) * 5; // 3..8% (never 0%!)
  } else if (adjRatio < 0.78) {
    chance = 8 + ((adjRatio - 0.55) / 0.23) * 20; // 8..28%
  } else if (adjRatio < 0.92) {
    chance = 28 + ((adjRatio - 0.78) / 0.14) * 26; // 28..54%
  } else if (adjRatio < 1.02) {
    chance = 54 + ((adjRatio - 0.92) / 0.1) * 22; // 54..76% (fair 1:1 ~72%)
  } else if (adjRatio < 1.14) {
    chance = 76 + ((adjRatio - 1.02) / 0.12) * 15; // 76..91%
  } else {
    chance = 91 + Math.min(5, ((adjRatio - 1.14) / 0.2) * 5); // 91..96%
  }

  const fillsTopNeed = userSentPlayers.some(
    (p) => p.position === aiNeeds.neededPositions[0],
  );
  const fillsSecondNeed = userSentPlayers.some(
    (p) => p.position === aiNeeds.neededPositions[1],
  );
  const allSaturated =
    userSentPlayers.length > 0 &&
    userSentPlayers.every((p) =>
      aiNeeds.saturatedPositions.includes(p.position),
    );

  // Direct positional-need & shock-bargain probability shifts
  if (!starQualityMismatch) {
    if (fillsTopNeed) chance += 8;
    else if (fillsSecondNeed) chance += 4;
    else if (allSaturated) chance -= 10;

    if (hasShockBargainTarget) chance += 12;
  }

  if (starQualityMismatch) {
    chance = clamp(chance * 0.26, 2, 10);
  }

  const acceptanceChance = clamp(Math.round(chance), 2, 96);
  const topTarget = [...aiTargetPlayers].sort((a, b) => b.ovr - a.ovr)[0];
  const topSent = [...userSentPlayers].sort((a, b) => b.ovr - a.ovr)[0];

  let gmTone: TradePackageEvaluation['gmTone'];
  let gmReaction: string;
  if (starQualityMismatch) {
    gmTone = 'offended';
    gmReaction = `${aiClub.shortName} 단장: "기적이라도 바라시는 겁니까? ${topTarget.name}급 슈퍼스타를 영입하려면 OVR ${maxAiTargetOvr - starOvrGapLimit}+ 핵심 선수가 필요합니다. (극저확률 도전은 가능)"`;
  } else if (hasShockBargainTarget && acceptanceChance >= 55) {
    gmTone = 'eager';
    gmReaction = `${aiClub.shortName} 단장: "🚨 보드진에서 ${topTarget.name} 긴급 처분을 지시했습니다. 솔직히 우리 손해라는 건 알지만, 구단 리빌딩을 위해 ${topSent.name} 카드만 주신다면 바로 서명하겠습니다!"`;
  } else if (acceptanceChance >= 76) {
    gmTone = 'eager';
    const cashNote = safeCashOfferM > 0 ? ` 현금 €${safeCashOfferM}M까지 얹어주시니` : '';
    gmReaction = fillsTopNeed
      ? `${aiClub.shortName} 단장: "딱 우리가 찾던 ${POS_LABEL_KO[topSent.position]} 최우선 보강 카드입니다!${cashNote} ${topSent.name} 포함 패키지라면 당장 서명하고 싶네요."`
      : `${aiClub.shortName} 단장: "${safeCashOfferM > 0 ? `현금 €${safeCashOfferM}M이 포함된 ` : ''}매우 매력적인 제안입니다. 이 조건이라면 이사회 승인이 거의 확실합니다!"`;
  } else if (acceptanceChance >= 48) {
    gmTone = 'considering';
    gmReaction = fillsTopNeed
      ? `${aiClub.shortName} 단장: "${topSent.name}이(가) 우리 취약 포지션에 잘 맞긴 한데, ${topTarget.name}을(를) 내주기엔 조금 더 고민이 필요합니다."`
      : `${aiClub.shortName} 단장: "나쁘지 않은 테이블입니다. 다만 우리가 급한 ${POS_LABEL_KO[aiNeeds.neededPositions[0] ?? 'MF']} 자원이나 현금이 보태지면 확률이 크게 올라갈 겁니다."`;
  } else if (acceptanceChance >= 18) {
    gmTone = 'hesitant';
    gmReaction = allSaturated
      ? `${aiClub.shortName} 단장: "${POS_LABEL_KO[topSent.position]} 자원은 이미 포화 상태입니다. 우리가 시급한 ${POS_LABEL_KO[aiNeeds.neededPositions[0] ?? 'MF']} 포지션 선수를 제시해 주세요."`
      : `${aiClub.shortName} 단장: "${topTarget.name}의 위상을 생각하면 아직 가치가 부족합니다. 더 확실한 주전급 카드나 현금을 보태주세요."`;
  } else {
    gmTone = 'offended';
    gmReaction = `${aiClub.shortName} 단장: "솔직히 일방적인 조건입니다. 성사되려면 기적에 가까우니 더 진지한 패키지를 권해드립니다."`;
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
    cashOfferM: safeCashOfferM,
    cashTp,
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

  const clubNeeds = analyzeClubPositionNeeds(squad.map((s) => s.player));

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
  /** User's current league rank (1-based). Higher standing attracts more AI clubs seeking coveted squad players. */
  userRank?: number;
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
  /** AI club IDs to skip (e.g. already negotiating with another human in multiplayer) */
  excludeClubIds?: string[];
  /** Minimum offer count floor (default 0; multiplayer sets 1 so every manager opens the window with offers) */
  minOfferCount?: number;
  rng?: () => number;
}

/**
 * Rolls the target incoming AI trade offer count (0..5) scaled by current league standing:
 * - 1st: 100% receive rate (min 2, avg ~3.54)
 * - 2nd–4th: 100% receive rate (min 1, avg ~3.05)
 * - 5th–8th: 95% receive rate (avg ~2.54)
 * - Mid-table (9th–14th in 20-team / 9th–12th in 18-team): 88% receive rate (avg ~2.06)
 * - Lower-table (bottom 6): 78% receive rate (avg ~1.49)
 */
export function rollIncomingOfferTargetCount(
  userRank: number | undefined,
  leagueSize: number,
  rng: () => number = Math.random,
): number {
  const safeLeagueSize = Math.max(8, leagueSize || 20);
  const rank =
    typeof userRank === 'number' && userRank >= 1
      ? userRank
      : Math.ceil(safeLeagueSize / 2);
  const midTableMaxRank = Math.max(9, safeLeagueSize - 6);
  const roll = rng();

  if (rank === 1) {
    if (roll < 0.18) return 2;
    if (roll < 0.48) return 3;
    if (roll < 0.8) return 4;
    return 5;
  }
  if (rank <= 4) {
    if (roll < 0.1) return 1;
    if (roll < 0.32) return 2;
    if (roll < 0.65) return 3;
    if (roll < 0.88) return 4;
    return 5;
  }
  if (rank <= 8) {
    if (roll < 0.05) return 0;
    if (roll < 0.2) return 1;
    if (roll < 0.48) return 2;
    if (roll < 0.79) return 3;
    if (roll < 0.94) return 4;
    return 5;
  }
  if (rank <= midTableMaxRank) {
    if (roll < 0.12) return 0;
    if (roll < 0.34) return 1;
    if (roll < 0.64) return 2;
    if (roll < 0.87) return 3;
    if (roll < 0.97) return 4;
    return 5;
  }
  if (roll < 0.22) return 0;
  if (roll < 0.54) return 1;
  if (roll < 0.81) return 2;
  if (roll < 0.95) return 3;
  if (roll < 0.99) return 4;
  return 5;
}

/**
 * Generates 0 to 5 realistic incoming AI trade offers per transfer window.
 * Higher league standing increases both the chance of receiving offers and average offer volume.
 * Each AI club analyzes its actual 16-player squad (11 starters + 5 core bench),
 * targets a fitting player on the user's squad, and constructs a coherent 1:1 trade offer.
 * Includes a rare (~8%, max 1 per window) "Luka Dončić style" blockbuster bargain offer!
 */
export function generateIncomingTradeOffers(
  params: GenerateIncomingTradeOffersParams,
): IncomingTradeOffer[] {
  const {
    windowIndex,
    currentRound,
    userLeagueId,
    userRank,
    userStarters,
    userBench,
    standings,
    otherLeagues,
    aiRosters,
    allPlayerStats,
    conditionMap,
    departedPlayerIds = [],
    allowedLeagueIds,
    excludeClubIds = [],
    minOfferCount = 0,
    rng = Math.random,
  } = params;

  const userSquad = [
    ...userStarters.filter((p): p is Player => p !== null),
    ...userBench.filter((p): p is Player => p !== null),
  ];
  if (userSquad.length < 11) return [];

  const inferredRankIdx = standings.findIndex((s) => s.isUser);
  const resolvedUserRank =
    typeof userRank === 'number' && userRank >= 1
      ? userRank
      : inferredRankIdx !== -1
        ? inferredRankIdx + 1
        : undefined;
  const targetCount = Math.max(
    minOfferCount,
    rollIncomingOfferTargetCount(
      resolvedUserRank,
      standings.length || 20,
      rng,
    ),
  );
  if (targetCount === 0) return [];

  const ownedIds = new Set(userSquad.map((p) => p.id));
  const globalExclude = new Set<string>([...ownedIds, ...departedPlayerIds]);
  const userGkCount = userSquad.filter((p) => p.position === 'GK').length;

  const allowedSet =
    allowedLeagueIds && allowedLeagueIds.length > 0
      ? new Set<LeagueId>(allowedLeagueIds)
      : null;
  const excludedClubs = new Set<string>(excludeClubIds);
  const candidateClubs = (
    allowedSet
      ? ALL_CLUBS_WITH_LEAGUE.filter((c) => allowedSet.has(c.leagueId))
      : ALL_CLUBS_WITH_LEAGUE
  ).filter((c) => !c.club.isUser && !excludedClubs.has(c.club.id));

  // Shuffle clubs (slight preference for user's own league so rivalries feel alive)
  const shuffled = [...candidateClubs].sort((a, b) => {
    const aBonus = a.leagueId === userLeagueId ? 0.18 : 0;
    const bBonus = b.leagueId === userLeagueId ? 0.18 : 0;
    return rng() + bBonus - (rng() + aBonus);
  });

  const offers: IncomingTradeOffer[] = [];
  const usedClubIds = new Set<string>();
  const usedAiPlayerIds = new Set<string>();
  let blockbusterCount = 0;

  for (const entry of shuffled) {
    if (offers.length >= targetCount) break;
    if (usedClubIds.has(entry.club.id)) continue;

    const isUserLeague = entry.leagueId === userLeagueId;
    const liveRoster = isUserLeague
      ? aiRosters[entry.club.id]
      : otherLeagues?.[entry.leagueId]?.aiRosters?.[entry.club.id];
    const squad16 = buildAiClubSquad16({
      club: entry.club,
      leagueId: entry.leagueId,
      liveAiRoster: liveRoster,
      ownedIds,
      excludeIds: globalExclude,
    });
    const clubRoster = squad16.all16.filter(
      (p) => !globalExclude.has(p.id) && !usedAiPlayerIds.has(p.id),
    );

    if (clubRoster.length < 11) continue;

    const clubNeeds = analyzeClubPositionNeeds(clubRoster);
    const topNeedPos = clubNeeds.neededPositions[0] ?? 'MF';

    // Pick an appealing user player matching AI's needed position (prefer OVR >= 76)
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
            .filter((p) => !(p.position === 'GK' && userGkCount <= 1) && p.ovr >= 75)
            .sort((a, b) => b.ovr - a.ovr);

    if (fallbackUserCandidates.length === 0) continue;

    // Rare (~8%, max 1 per window) "Luka Dončić trade" shock bargain offer!
    const isBlockbusterTry = blockbusterCount === 0 && rng() < 0.08;
    const aiGkCount = clubRoster.filter((p) => p.position === 'GK').length;

    const findChipsFor = (target: Player, targetVal: ReturnType<typeof computePlayerTradePoints>) =>
      clubRoster
        .filter((p) => {
          if (p.position === target.position) return false;
          if (p.position === topNeedPos) return false;
          if (
            p.position === 'GK' &&
            (aiGkCount <= 2 || clubNeeds.neededPositions.includes('GK'))
          ) {
            return false;
          }
          if (isBlockbusterTry) {
            return p.ovr >= target.ovr + 1 && p.ovr <= target.ovr + 5;
          }
          return Math.abs(p.ovr - target.ovr) <= 4;
        })
        .map((p) => {
          const val = computePlayerTradePoints({
            player: p,
            receivingClubNeeds: null,
            sellingClubNeeds: clubNeeds,
            isShockBargain: isBlockbusterTry,
            stats: allPlayerStats[p.id] ?? null,
            conditionMap,
          });
          const surplusBonus = clubNeeds.saturatedPositions.includes(p.position)
            ? -14
            : clubNeeds.neededPositions.includes(p.position)
              ? 14
              : 0;
          return { player: p, val, surplusBonus };
        })
        .sort((a, b) =>
          isBlockbusterTry
            ? b.player.ovr - a.player.ovr
            : Math.abs(a.val.effectiveTp - targetVal.effectiveTp) +
              a.surplusBonus -
              (Math.abs(b.val.effectiveTp - targetVal.effectiveTp) +
                b.surplusBonus),
        );

    const pickIdx = Math.min(
      fallbackUserCandidates.length - 1,
      Math.floor(rng() * Math.min(4, fallbackUserCandidates.length)),
    );
    let requestedPlayer = fallbackUserCandidates[pickIdx];
    let requestedVal = computePlayerTradePoints({
      player: requestedPlayer,
      receivingClubNeeds: clubNeeds,
      stats: allPlayerStats[requestedPlayer.id] ?? null,
      conditionMap,
    });
    let aiChips = findChipsFor(requestedPlayer, requestedVal);

    // If the user's top-4 superstars exceed every remaining AI club's OVR reach (common in 4-player rooms),
    // fall back to an eligible user squad member whose OVR matches this AI club's available chips.
    if (aiChips.length === 0) {
      const clubMaxOvr = Math.max(...clubRoster.map((p) => p.ovr));
      const allEligible = userSquad
        .filter((p) => !(p.position === 'GK' && userGkCount <= 1))
        .sort((a, b) => Math.abs(a.ovr - clubMaxOvr) - Math.abs(b.ovr - clubMaxOvr));
      for (const alt of allEligible) {
        if (alt.id === requestedPlayer.id) continue;
        const altVal = computePlayerTradePoints({
          player: alt,
          receivingClubNeeds: clubNeeds,
          stats: allPlayerStats[alt.id] ?? null,
          conditionMap,
        });
        const altChips = findChipsFor(alt, altVal);
        if (altChips.length > 0) {
          const altRatio =
            altChips[0].val.effectiveTp / Math.max(1, altVal.effectiveTp);
          if (isBlockbusterTry || (altRatio >= 0.72 && altRatio <= 1.35)) {
            requestedPlayer = alt;
            requestedVal = altVal;
            aiChips = altChips;
            break;
          }
        }
      }
    }

    if (aiChips.length === 0) continue;

    const chosenAiPlayer = aiChips[0].player;
    const ratio =
      aiChips[0].val.effectiveTp / Math.max(1, requestedVal.effectiveTp);
    if (!isBlockbusterTry && (ratio < 0.72 || ratio > 1.35)) continue;

    const isBlockbusterBargain =
      isBlockbusterTry && chosenAiPlayer.ovr >= requestedPlayer.ovr + 1;
    if (isBlockbusterBargain) {
      blockbusterCount += 1;
    }

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

    const reqPosMatchesNeed = clubNeeds.neededPositions.includes(
      requestedPlayer.position,
    );
    const pitches = isBlockbusterBargain
      ? [
          `"🚨 [프런트 전격 결단] 수비와 팀 밸런스가 우승을 만듭니다! 우리 보드진에서 에이스 ${chosenAiPlayer.name} (${chosenAiPlayer.position} · OVR ${chosenAiPlayer.ovr}) 카드를 과감히 내놓기로 결정했습니다. 우리가 가장 급한 ${POS_LABEL_KO[requestedPlayer.position]} ${requestedPlayer.name} 선수만 주신다면 지금 당장 도장 찍겠습니다!"`,
          `"🚨 [충격 급매 오퍼] 구단 전술 방향을 완전히 새로 짜고 있습니다. 시장 가치로만 보면 우리가 손해라는 걸 알지만, ${POS_LABEL_KO[requestedPlayer.position]} ${requestedPlayer.name} 영입을 위해 ${chosenAiPlayer.name} (OVR ${chosenAiPlayer.ovr}) 맞트레이드를 전격 제안합니다!"`,
        ]
      : reqPosMatchesNeed
        ? [
            `"우리 구단은 지금 ${POS_LABEL_KO[requestedPlayer.position]} 보강이 절실합니다. 여유 자원인 ${chosenAiPlayer.name} (${chosenAiPlayer.position} · OVR ${chosenAiPlayer.ovr}) 카드를 드릴 테니 ${requestedPlayer.name} 트레이드를 논의해 보시죠."`,
            `"${POS_LABEL_KO[requestedPlayer.position]} 라인 강화를 위해 ${requestedPlayer.name} 선수를 오래 지켜봤습니다. ${chosenAiPlayer.name} (${chosenAiPlayer.position})과의 맞트레이드라면 양 팀 모두 빈자리를 채울 수 있습니다!"`,
            `"스카우트 팀에서 ${POS_LABEL_KO[requestedPlayer.position]} 최우선 타깃으로 ${requestedPlayer.name} 영입을 추천했습니다. ${chosenAiPlayer.name}을(를) 내어드리는 진지한 제안입니다."`,
          ]
        : [
            `"${requestedPlayer.name} 선수의 전술적 활용도를 높게 평가하고 있습니다. ${chosenAiPlayer.name} (${chosenAiPlayer.position} · OVR ${chosenAiPlayer.ovr})과의 맞트레이드를 제안드립니다."`,
            `"우리 구단 스타일에 ${requestedPlayer.name} 선수가 꼭 맞습니다. ${chosenAiPlayer.name} 카드를 제시하는 진지한 오퍼입니다."`,
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
      isBlockbusterBargain,
      bargainHeadline: isBlockbusterBargain
        ? '🚨 충격의 급매물 · 보드진 파격 제안'
        : undefined,
    });
  }

  return offers;
}


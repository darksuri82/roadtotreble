import { FORMATIONS } from '../data/formations';
import { evaluateManagerPlayerSynergy, MANAGER_TRAITS } from '../data/managerTraits';
import { getPlayerAttributes } from '../engine/attributeEngine';
import { applyAwakeningToPlayer, isValidAwakeningRecord } from '../engine/awakeningEngine';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS, LEGEND_PLAYERS } from '../engine/dataLoader';
import {
  HOF_RULE_ERA_V9,
  isV9EraHofEntry,
  isV9PlusRuleEra,
  reconstructHallOfFameSquad,
} from '../engine/legacyEngine';
import { TACTICS } from '../engine/tacticEngine';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import type {
  FormationId,
  ManagerAvatarConfig,
  ManagerTraitId,
  UserClubProfile,
} from '../types/game';
import { DEFAULT_MANAGER_AVATAR, DEFAULT_MANAGER_NAME } from '../types/game';
import type { Club, JerseyPattern, LeagueId, TacticId } from '../types/league';
import type {
  GlobalHofRankingEntry,
  GlobalRankingSubmitResult,
  GlobalSquadSnapshot,
  GlobalSquadSnapshotPlayer,
  HallOfFameEntry,
  SeasonScoreBreakdown,
} from '../types/legacy';
import type { Player, PlaystyleId, Position, SubPosition } from '../types/player';

export const GLOBAL_TOP15_LIMIT = 15;
export const GLOBAL_RANKING_RULE_ERA = HOF_RULE_ERA_V9;
const CELEBRATED_RUNS_STORAGE_KEY = 'rtt_global_top15_celebrated_v1';

export function isV9EraGlobalEntry(
  entry:
    | Pick<GlobalHofRankingEntry, 'ruleEra' | 'scoreBreakdown' | 'squadSnapshot'>
    | null
    | undefined,
): boolean {
  if (!entry) return false;
  return (
    isV9PlusRuleEra(entry.ruleEra) ||
    isV9PlusRuleEra(entry.scoreBreakdown?.ruleEra) ||
    isV9PlusRuleEra(entry.squadSnapshot?.ruleEra)
  );
}

const REAL_PLAYERS_BY_ID: Map<string, Player> = (() => {
  const map = new Map<string, Player>();
  for (const p of LEGEND_PLAYERS) map.set(p.id, p);
  for (const p of ACTIVE_PLAYERS) {
    if (!map.has(p.id)) map.set(p.id, p);
  }
  return map;
})();

const REAL_ACTIVE_BY_NAME: Map<string, Player> = new Map(
  ACTIVE_PLAYERS.map((p) => [p.name, p]),
);
const REAL_CLASSIC_BY_NAME: Map<string, Player> = new Map(
  LEGEND_PLAYERS.map((p) => [p.name, p]),
);

const VALID_POSITIONS = new Set<Position>(['GK', 'DF', 'MF', 'FW']);
const VALID_SUB_POSITIONS = new Set<SubPosition>([
  'GK',
  'LB',
  'CB',
  'RB',
  'LWB',
  'RWB',
  'CDM',
  'CM',
  'CAM',
  'LM',
  'RM',
  'LW',
  'RW',
  'ST',
]);
const VALID_LEAGUE_IDS = new Set<LeagueId>([
  'epl',
  'laliga',
  'seriea',
  'bundesliga',
  'ligue1',
]);
const VALID_PATTERNS = new Set<JerseyPattern>([
  'solid',
  'stripes',
  'hoops',
  'sash',
  'half',
]);

function isValidFormation(value: unknown): value is FormationId {
  return typeof value === 'string' && value in FORMATIONS;
}

function isValidTactic(value: unknown): value is TacticId {
  return typeof value === 'string' && value in TACTICS;
}

function isValidManagerTrait(value: unknown): value is ManagerTraitId {
  return typeof value === 'string' && value in MANAGER_TRAITS;
}

function isValidLeagueId(value: unknown): value is LeagueId {
  return typeof value === 'string' && VALID_LEAGUE_IDS.has(value as LeagueId);
}

export function compareGlobalRankingEntries(
  a: Pick<
    GlobalHofRankingEntry,
    'seasonScore' | 'isTreble' | 'uclWon' | 'achievedAt' | 'id'
  >,
  b: Pick<
    GlobalHofRankingEntry,
    'seasonScore' | 'isTreble' | 'uclWon' | 'achievedAt' | 'id'
  >,
): number {
  if (b.seasonScore !== a.seasonScore) return b.seasonScore - a.seasonScore;
  if (a.isTreble !== b.isTreble) return a.isTreble ? -1 : 1;
  if (a.uclWon !== b.uclWon) return a.uclWon ? -1 : 1;
  const timeCmp = a.achievedAt.localeCompare(b.achievedAt);
  if (timeCmp !== 0) return timeCmp;
  return a.id.localeCompare(b.id);
}

export function sortGlobalRankingEntries<
  T extends Pick<
    GlobalHofRankingEntry,
    'seasonScore' | 'isTreble' | 'uclWon' | 'achievedAt' | 'id'
  >,
>(entries: readonly T[]): (T & { rank: number })[] {
  return [...entries]
    .sort(compareGlobalRankingEntries)
    .slice(0, GLOBAL_TOP15_LIMIT)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

/**
 * Pure mirror of the PostgreSQL `submit_global_hof_ranking` Top-15 cap & auto-prune rules.
 * Excludes all pre-v9.0 entries from ranking & cutoff, keeps at most 15 v9.0+ entries,
 * prevents duplicate `runId`, and prunes rank 16+.
 */
export function applyTop15RankingLogic(
  existing: readonly GlobalHofRankingEntry[],
  candidate: GlobalHofRankingEntry,
): {
  nextEntries: GlobalHofRankingEntry[];
  result: GlobalRankingSubmitResult;
} {
  const validExisting = existing.filter((e) => isV9EraGlobalEntry(e));
  const orderedExisting = sortGlobalRankingEntries(validExisting);
  const existingCutoff =
    orderedExisting.length >= GLOBAL_TOP15_LIMIT
      ? orderedExisting[GLOBAL_TOP15_LIMIT - 1].seasonScore
      : orderedExisting.length > 0
        ? orderedExisting[orderedExisting.length - 1].seasonScore
        : null;

  if (!isV9EraGlobalEntry(candidate)) {
    return {
      nextEntries: orderedExisting,
      result: {
        ok: false,
        entered: false,
        rank: null,
        alreadyExists: false,
        cutoffScore: existingCutoff,
        totalCount: orderedExisting.length,
        prunedCount: 0,
        error: 'v9.0 이전 구버전 기록은 글로벌 TOP 15에 등록할 수 없습니다.',
      },
    };
  }

  const existingFound = orderedExisting.find((e) => e.runId === candidate.runId);
  if (existingFound) {
    return {
      nextEntries: orderedExisting,
      result: {
        ok: true,
        entered: existingFound.rank <= GLOBAL_TOP15_LIMIT,
        rank: existingFound.rank,
        alreadyExists: true,
        cutoffScore: existingCutoff,
        totalCount: orderedExisting.length,
        prunedCount: 0,
      },
    };
  }

  const combined = [...orderedExisting, candidate].sort(
    compareGlobalRankingEntries,
  );
  const top15 = combined
    .slice(0, GLOBAL_TOP15_LIMIT)
    .map((e, idx) => ({ ...e, rank: idx + 1 }));
  const placed = top15.find((e) => e.runId === candidate.runId);
  const prunedCount = placed ? Math.max(0, combined.length - top15.length) : 0;
  const cutoffScore =
    top15.length > 0 ? top15[top15.length - 1].seasonScore : null;

  return {
    nextEntries: top15,
    result: {
      ok: true,
      entered: Boolean(placed),
      rank: placed ? placed.rank : null,
      alreadyExists: false,
      cutoffScore,
      totalCount: top15.length,
      prunedCount,
    },
  };
}

function serializePlayerForSnapshot(
  player: Player,
  stats?: { goals: number; assists: number; avgRating: number },
): GlobalSquadSnapshotPlayer {
  const isKnownStatic = REAL_PLAYERS_BY_ID.has(player.id) && !player.isGenerated;
  const base: GlobalSquadSnapshotPlayer = {
    id: player.id,
    name: player.name,
    ovr: player.ovr,
    position: player.position,
    mainPositions: [...player.mainPositions],
    isLegend: Boolean(player.isLegend),
    ...(player.classicEra ? { classicEra: player.classicEra } : {}),
    ...(player.awakening ? { awakening: player.awakening } : {}),
    ...(stats && stats.goals > 0 ? { goals: stats.goals } : {}),
    ...(stats && stats.assists > 0 ? { assists: stats.assists } : {}),
    ...(stats && stats.avgRating > 0
      ? { avgRating: Math.round(stats.avgRating * 100) / 100 }
      : {}),
  };

  if (!isKnownStatic) {
    base.isGenerated = Boolean(player.isGenerated);
    base.club = player.club;
    base.leagueId = player.leagueId;
    base.nationality = player.nationality;
    base.nationalityCode = player.nationalityCode;
    base.att = player.att;
    base.mid = player.mid;
    base.def = player.def;
    base.stamina = player.stamina;
    base.playstyles = [...player.playstyles];
  }

  return base;
}

export function buildSquadSnapshotFromHofEntry(
  entry: HallOfFameEntry,
): GlobalSquadSnapshot {
  const reconstructed = reconstructHallOfFameSquad(entry);
  const statsById = new Map(
    [...entry.starters, ...entry.bench].map((m) => [
      m.id,
      { goals: m.goals, assists: m.assists, avgRating: m.avgRating },
    ]),
  );

  const starters = reconstructed.starters
    .filter((p): p is Player => p !== null)
    .slice(0, 11)
    .map((p) => serializePlayerForSnapshot(p, statsById.get(p.id)));

  const bench = reconstructed.bench
    .filter((p): p is Player => p !== null)
    .slice(0, 5)
    .map((p) => serializePlayerForSnapshot(p, statsById.get(p.id)));

  const ruleEra = isV9PlusRuleEra(entry.ruleEra)
    ? entry.ruleEra
    : isV9PlusRuleEra(entry.seasonScore?.ruleEra)
      ? entry.seasonScore.ruleEra
      : GLOBAL_RANKING_RULE_ERA;

  return { ruleEra, starters, bench };
}

function rebuildPlayerFromSnapshot(
  snap: GlobalSquadSnapshotPlayer,
  fallbackLeagueId: LeagueId,
  fallbackClubName: string,
): Player {
  if (!snap.isGenerated) {
    const byId = REAL_PLAYERS_BY_ID.get(snap.id);
    if (byId) {
      if (snap.awakening && isValidAwakeningRecord(byId, snap.awakening)) {
        return applyAwakeningToPlayer(byId, snap.awakening);
      }
      return { ...byId, attrs: getPlayerAttributes(byId) };
    }
    const byName = snap.isLegend
      ? REAL_CLASSIC_BY_NAME.get(snap.name)
      : REAL_ACTIVE_BY_NAME.get(snap.name);
    if (byName) {
      if (snap.awakening && isValidAwakeningRecord(byName, snap.awakening)) {
        return applyAwakeningToPlayer(byName, snap.awakening);
      }
      return { ...byName, attrs: getPlayerAttributes(byName) };
    }
  }

  const pos: Position = VALID_POSITIONS.has(snap.position as Position)
    ? (snap.position as Position)
    : 'MF';
  const mainPositions: SubPosition[] = (snap.mainPositions ?? []).filter(
    (sp): sp is SubPosition => VALID_SUB_POSITIONS.has(sp as SubPosition),
  );
  if (mainPositions.length === 0) {
    mainPositions.push(
      pos === 'GK' ? 'GK' : pos === 'DF' ? 'CB' : pos === 'FW' ? 'ST' : 'CM',
    );
  }

  const ovr = Math.max(60, Math.min(99, Number(snap.ovr) || 82));
  const playstyles: PlaystyleId[] =
    Array.isArray(snap.playstyles) && snap.playstyles.length > 0
      ? (snap.playstyles as PlaystyleId[])
      : pos === 'GK'
        ? ['shot_stopper']
        : pos === 'DF'
          ? ['stopper_cb']
          : pos === 'FW'
            ? ['complete_forward']
            : ['box_to_box'];

  const synthetic: Player = {
    id: snap.id,
    name: snap.name,
    position: pos,
    mainPositions,
    secondaryPositions: [],
    ovr,
    nationality: snap.nationality ?? '유럽',
    nationalityCode: snap.nationalityCode ?? 'EU',
    leagueId: snap.isLegend
      ? 'LEGEND'
      : isValidLeagueId(snap.leagueId)
        ? snap.leagueId
        : fallbackLeagueId,
    club: snap.club ?? fallbackClubName,
    att:
      typeof snap.att === 'number'
        ? snap.att
        : pos === 'FW'
          ? Math.min(96, ovr + 1)
          : pos === 'MF'
            ? ovr - 3
            : Math.max(45, ovr - 18),
    mid:
      typeof snap.mid === 'number'
        ? snap.mid
        : pos === 'MF'
          ? Math.min(96, ovr + 1)
          : pos === 'GK'
            ? Math.max(45, ovr - 16)
            : ovr - 5,
    def:
      typeof snap.def === 'number'
        ? snap.def
        : pos === 'DF' || pos === 'GK'
          ? Math.min(96, ovr + 1)
          : pos === 'MF'
            ? ovr - 5
            : Math.max(40, ovr - 28),
    stamina: typeof snap.stamina === 'number' ? snap.stamina : 84,
    playstyles,
    scoutNote: '글로벌 TOP 15 랭킹 스쿼드 복원 선수',
    isLegend: Boolean(snap.isLegend),
    ...(snap.isGenerated ? { isGenerated: true } : {}),
  };

  return { ...synthetic, attrs: getPlayerAttributes(synthetic) };
}

export function reconstructSquadFromGlobalRanking(
  entry: GlobalHofRankingEntry,
): { starters: Player[]; bench: Player[] } {
  const starters = (entry.squadSnapshot?.starters ?? [])
    .slice(0, 11)
    .map((p) =>
      rebuildPlayerFromSnapshot(p, entry.leagueId, entry.clubProfile.name),
    );

  // Guarantee 11 playable starters even if an unexpected malformed row appears
  while (starters.length < 11) {
    const fallback = ACTIVE_PLAYERS.find(
      (p) => !starters.some((s) => s.id === p.id),
    );
    if (!fallback) break;
    starters.push({ ...fallback, attrs: getPlayerAttributes(fallback) });
  }

  const bench = (entry.squadSnapshot?.bench ?? [])
    .slice(0, 5)
    .map((p) =>
      rebuildPlayerFromSnapshot(p, entry.leagueId, entry.clubProfile.name),
    );

  return { starters, bench };
}

export interface GlobalDreamOpponentBundle {
  club: Club;
  starters: Player[];
  bench: Player[];
  fullRoster: Player[];
  chemistryTotal: number;
  avgSynergyOvrBonus: number;
  managerSynergyCount: number;
}

/**
 * Converts a Global TOP 15 Ranking entry into a full match-ready opponent bundle
 * for DreamMatchArena using the exact same chemistry, ratings & 2D engine pipeline.
 */
export function buildGlobalClubForMatch(
  entry: GlobalHofRankingEntry,
): GlobalDreamOpponentBundle {
  const { starters, bench } = reconstructSquadFromGlobalRanking(entry);
  const managerTrait: ManagerTraitId = entry.managerTraitId ?? 'big_game_hunter';
  const managerRating = Math.max(75, Math.min(99, entry.managerRating || 88));

  const chem = calculateChemistry(
    entry.formation,
    starters,
    entry.defaultTactic,
    entry.managerTraitId,
    managerRating,
  );
  const effRatings = calculateTeamRatings(
    entry.formation,
    starters,
    chem.total,
    entry.managerTraitId,
    chem.slotSynergies,
    entry.defaultTactic,
  );
  const slotSynValues = Object.values(chem.slotSynergies);
  const avgSynergyOvrBonus =
    slotSynValues.length > 0
      ? Math.round(
          (slotSynValues.reduce((sum, s) => sum + s.totalBonus, 0) /
            slotSynValues.length) *
            100,
        ) / 100
      : 0;
  const managerSynergyCount = starters.filter(
    (p) =>
      evaluateManagerPlayerSynergy(p, entry.managerTraitId, managerRating)
        .isMatch,
  ).length;

  const topAttackers = [...starters]
    .sort((a, b) => b.att - a.att || b.ovr - a.ovr)
    .slice(0, 3)
    .map((p) => p.name);

  const club: Club = {
    id: `global-rank-${entry.id}`,
    name: entry.clubProfile.name || entry.clubName,
    shortName: entry.clubProfile.shortName || entry.clubName.slice(0, 3).toUpperCase(),
    primaryColor: entry.clubProfile.primaryColor || '#10b981',
    secondaryColor: entry.clubProfile.secondaryColor || '#f8fafc',
    pattern: entry.clubProfile.pattern || 'solid',
    formation: entry.formation,
    defaultTactic: entry.defaultTactic,
    att: Math.round(effRatings.effectiveAtt),
    mid: Math.round(effRatings.effectiveMid),
    def: Math.round(effRatings.effectiveDef),
    topScorers: [
      topAttackers[0] ?? starters[10]?.name ?? '에이스',
      topAttackers[1] ?? starters[9]?.name ?? '공격수',
      topAttackers[2] ?? starters[8]?.name ?? '미드필더',
    ],
    manager: {
      name: entry.managerName || DEFAULT_MANAGER_NAME,
      ovr: managerRating,
      traitId: managerTrait,
      preferredFormations: [entry.formation, '4-2-3-1', '4-3-3'],
      preferredTactics: [entry.defaultTactic, 'balanced', 'counter'],
    },
  };

  return {
    club,
    starters,
    bench,
    fullRoster: [...starters, ...bench],
    chemistryTotal: chem.total,
    avgSynergyOvrBonus,
    managerSynergyCount,
  };
}

export function buildGlobalSubmissionPayload(entry: HallOfFameEntry) {
  const runId = (entry.runId ?? entry.id).trim();
  const squadSnapshot = buildSquadSnapshotFromHofEntry(entry);
  const ruleEra = isV9PlusRuleEra(entry.ruleEra)
    ? entry.ruleEra!
    : isV9PlusRuleEra(entry.seasonScore?.ruleEra)
      ? entry.seasonScore.ruleEra!
      : GLOBAL_RANKING_RULE_ERA;

  return {
    run_id: runId,
    rule_era: ruleEra,
    season_score: Math.round(entry.seasonScore.totalScore),
    grade: entry.seasonScore.grade,
    club_name: entry.userClub.name,
    manager_name: entry.managerName ?? DEFAULT_MANAGER_NAME,
    league_id: entry.leagueId,
    league_korean_name: entry.leagueKoreanName,
    final_league_rank: entry.finalLeagueRank,
    league_points: entry.leaguePoints,
    league_total_rounds: entry.leagueTotalRounds,
    league_record: entry.leagueRecord,
    cup_name: entry.cupName,
    cup_result_label: entry.cupResultLabel,
    cup_won: entry.cupWon,
    ucl_result_label: entry.uclResultLabel,
    ucl_won: entry.uclWon,
    is_league_champion: entry.isLeagueChampion,
    is_treble: entry.isTreble,
    trophies: entry.trophies,
    formation: entry.formation,
    default_tactic: entry.defaultTactic,
    manager_trait_id: entry.managerTraitId,
    manager_rating: Math.round(entry.managerRating ?? 86),
    team_avg_ovr: Math.round(entry.teamAvgOvr * 10) / 10,
    chemistry: Math.round(entry.chemistry),
    avg_synergy_ovr_bonus: Math.round((entry.avgSynergyOvrBonus ?? 0) * 100) / 100,
    manager_synergy_count: entry.managerSynergyCount ?? 0,
    top_scorer_summary: entry.topScorerSummary || '-',
    club_profile: entry.userClub,
    manager_avatar: entry.managerAvatar ?? DEFAULT_MANAGER_AVATAR,
    score_breakdown: { ...entry.seasonScore, ruleEra },
    squad_snapshot: { ...squadSnapshot, ruleEra },
    achieved_at: entry.completedAt,
  };
}

export interface RawGlobalRankingRow {
  id: string;
  run_id: string;
  rule_era?: string | null;
  season_score: number;
  grade: string;
  club_name: string;
  manager_name: string;
  league_id: string;
  league_korean_name: string;
  final_league_rank: number;
  league_points: number;
  league_total_rounds?: number;
  league_record: string;
  cup_name: string;
  cup_result_label: string;
  cup_won: boolean;
  ucl_result_label: string;
  ucl_won: boolean;
  is_league_champion: boolean;
  is_treble: boolean;
  trophies: unknown;
  formation: string;
  default_tactic: string;
  manager_trait_id: string | null;
  manager_rating: number;
  team_avg_ovr: number | string;
  chemistry: number;
  avg_synergy_ovr_bonus?: number | string;
  manager_synergy_count?: number;
  top_scorer_summary: string;
  club_profile: unknown;
  manager_avatar: unknown;
  score_breakdown: unknown;
  squad_snapshot: unknown;
  achieved_at: string;
}

function sanitizeClubProfile(
  raw: unknown,
  fallbackName: string,
): UserClubProfile {
  const obj =
    raw && typeof raw === 'object' ? (raw as Partial<UserClubProfile>) : {};
  const name =
    typeof obj.name === 'string' && obj.name.trim() ? obj.name : fallbackName;
  const shortName =
    typeof obj.shortName === 'string' && obj.shortName.trim()
      ? obj.shortName
      : name.slice(0, 3).toUpperCase();
  const pattern: JerseyPattern =
    typeof obj.pattern === 'string' &&
    VALID_PATTERNS.has(obj.pattern as JerseyPattern)
      ? (obj.pattern as JerseyPattern)
      : 'solid';
  return {
    name,
    shortName,
    primaryColor:
      typeof obj.primaryColor === 'string' && obj.primaryColor
        ? obj.primaryColor
        : '#10b981',
    secondaryColor:
      typeof obj.secondaryColor === 'string' && obj.secondaryColor
        ? obj.secondaryColor
        : '#f8fafc',
    pattern,
  };
}

function sanitizeManagerAvatar(raw: unknown): ManagerAvatarConfig {
  const obj =
    raw && typeof raw === 'object'
      ? (raw as Partial<ManagerAvatarConfig>)
      : {};
  return {
    ...DEFAULT_MANAGER_AVATAR,
    ...obj,
  };
}

function sanitizeScoreBreakdown(
  raw: unknown,
  fallbackScore: number,
  fallbackGrade: SeasonScoreBreakdown['grade'],
): SeasonScoreBreakdown {
  const obj =
    raw && typeof raw === 'object'
      ? (raw as Partial<SeasonScoreBreakdown>)
      : {};
  return {
    leagueConvertedScore: Number(obj.leagueConvertedScore) || 0,
    leagueRankBonus: Number(obj.leagueRankBonus) || 0,
    cupBonus: Number(obj.cupBonus) || 0,
    uclBonus: Number(obj.uclBonus) || 0,
    honorsBonus: Number(obj.honorsBonus) || 0,
    honorsBonusDetails: Array.isArray(obj.honorsBonusDetails)
      ? obj.honorsBonusDetails.map(String)
      : [],
    underdogBonus: Number(obj.underdogBonus) || 0,
    squadCraftBonus: Number(obj.squadCraftBonus) || 0,
    squadCraftDetails: Array.isArray(obj.squadCraftDetails)
      ? obj.squadCraftDetails.map(String)
      : [],
    awardsBonus: Number(obj.awardsBonus) || 0,
    awardsBonusDetails: Array.isArray(obj.awardsBonusDetails)
      ? obj.awardsBonusDetails.map(String)
      : [],
    ...(typeof obj.ffpPenaltyPct === 'number' && obj.ffpPenaltyPct > 0
      ? {
          ffpPenaltyPct: obj.ffpPenaltyPct,
          ffpPenaltyPoints: Number(obj.ffpPenaltyPoints) || 0,
        }
      : {}),
    ...(typeof obj.ruleEra === 'string' ? { ruleEra: obj.ruleEra } : {}),
    totalScore: Number(obj.totalScore) || fallbackScore,
    grade: (obj.grade as SeasonScoreBreakdown['grade']) ?? fallbackGrade,
  };
}

function extractRawRowRuleEra(row: RawGlobalRankingRow): string | undefined {
  if (typeof row.rule_era === 'string' && row.rule_era.trim()) {
    return row.rule_era.trim();
  }
  const sb =
    row.score_breakdown && typeof row.score_breakdown === 'object'
      ? (row.score_breakdown as { ruleEra?: unknown })
      : null;
  if (sb && typeof sb.ruleEra === 'string' && sb.ruleEra.trim()) {
    return sb.ruleEra.trim();
  }
  const snap =
    row.squad_snapshot && typeof row.squad_snapshot === 'object'
      ? (row.squad_snapshot as { ruleEra?: unknown })
      : null;
  if (snap && typeof snap.ruleEra === 'string' && snap.ruleEra.trim()) {
    return snap.ruleEra.trim();
  }
  return undefined;
}

function mapRawRowToEntry(
  row: RawGlobalRankingRow,
  rank: number,
): GlobalHofRankingEntry {
  const grade = (
    ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C'].includes(row.grade)
      ? row.grade
      : 'C'
  ) as SeasonScoreBreakdown['grade'];
  const rawSnap =
    row.squad_snapshot && typeof row.squad_snapshot === 'object'
      ? (row.squad_snapshot as Partial<GlobalSquadSnapshot>)
      : {};
  const ruleEra = extractRawRowRuleEra(row);
  return {
    id: row.id,
    runId: row.run_id,
    ...(ruleEra ? { ruleEra } : {}),
    rank,
    seasonScore: Number(row.season_score) || 0,
    grade,
    clubName: row.club_name || '구단',
    managerName: row.manager_name || DEFAULT_MANAGER_NAME,
    leagueId: isValidLeagueId(row.league_id) ? row.league_id : 'epl',
    leagueKoreanName: row.league_korean_name || '프리미어리그',
    finalLeagueRank: Number(row.final_league_rank) || 1,
    leaguePoints: Number(row.league_points) || 0,
    leagueTotalRounds: Number(row.league_total_rounds) || 38,
    leagueRecord: row.league_record || '',
    cupName: row.cup_name || '자국 컵',
    cupResultLabel: row.cup_result_label || '-',
    cupWon: Boolean(row.cup_won),
    uclResultLabel: row.ucl_result_label || '미진출',
    uclWon: Boolean(row.ucl_won),
    isLeagueChampion: Boolean(row.is_league_champion),
    isTreble: Boolean(row.is_treble),
    trophies: Array.isArray(row.trophies) ? row.trophies.map(String) : [],
    formation: isValidFormation(row.formation) ? row.formation : '4-3-3',
    defaultTactic: isValidTactic(row.default_tactic)
      ? row.default_tactic
      : 'balanced',
    managerTraitId: isValidManagerTrait(row.manager_trait_id)
      ? row.manager_trait_id
      : null,
    managerRating: Number(row.manager_rating) || 86,
    teamAvgOvr: Math.round((Number(row.team_avg_ovr) || 80) * 10) / 10,
    chemistry: Number(row.chemistry) || 50,
    avgSynergyOvrBonus:
      Math.round((Number(row.avg_synergy_ovr_bonus) || 0) * 100) / 100,
    managerSynergyCount: Number(row.manager_synergy_count) || 0,
    topScorerSummary: row.top_scorer_summary || '-',
    clubProfile: sanitizeClubProfile(row.club_profile, row.club_name || '구단'),
    managerAvatar: sanitizeManagerAvatar(row.manager_avatar),
    scoreBreakdown: sanitizeScoreBreakdown(
      row.score_breakdown,
      Number(row.season_score) || 0,
      grade,
    ),
    squadSnapshot: {
      ...(typeof rawSnap.ruleEra === 'string' ? { ruleEra: rawSnap.ruleEra } : {}),
      starters: Array.isArray(rawSnap.starters) ? rawSnap.starters : [],
      bench: Array.isArray(rawSnap.bench) ? rawSnap.bench : [],
    },
    achievedAt: row.achieved_at || new Date().toISOString(),
  };
}

/**
 * Filters raw Supabase rows to ONLY v9.0+ rule-era entries, sorts deterministically,
 * caps at TOP 15, and computes cutoffScore excluding any pre-v9.0 rows.
 */
export function filterAndRankV9GlobalRows(rows: readonly RawGlobalRankingRow[]): {
  entries: GlobalHofRankingEntry[];
  cutoffScore: number | null;
} {
  const mappedValid = rows
    .filter((row) => isV9PlusRuleEra(extractRawRowRuleEra(row)))
    .map((row, idx) => mapRawRowToEntry(row, idx + 1));
  const entries = sortGlobalRankingEntries(mappedValid);
  const cutoffScore =
    entries.length >= GLOBAL_TOP15_LIMIT
      ? entries[GLOBAL_TOP15_LIMIT - 1].seasonScore
      : entries.length > 0
        ? entries[entries.length - 1].seasonScore
        : null;
  return { entries, cutoffScore };
}

export interface FetchGlobalTop15Result {
  ok: boolean;
  configured: boolean;
  entries: GlobalHofRankingEntry[];
  cutoffScore: number | null;
  error?: string;
}

export async function fetchGlobalTop15Rankings(): Promise<FetchGlobalTop15Result> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      configured: false,
      entries: [],
      cutoffScore: null,
      error: 'Supabase 미연결 환경',
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      configured: false,
      entries: [],
      cutoffScore: null,
      error: 'Supabase 클라이언트 초기화 불가',
    };
  }

  try {
    const { data, error } = await client
      .from('global_hof_rankings')
      .select('*')
      .order('season_score', { ascending: false })
      .order('is_treble', { ascending: false })
      .order('ucl_won', { ascending: false })
      .order('achieved_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(50);

    if (error) {
      return {
        ok: false,
        configured: true,
        entries: [],
        cutoffScore: null,
        error: error.message,
      };
    }

    const rows = (data ?? []) as RawGlobalRankingRow[];
    const { entries, cutoffScore } = filterAndRankV9GlobalRows(rows);

    return {
      ok: true,
      configured: true,
      entries,
      cutoffScore,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      entries: [],
      cutoffScore: null,
      error: err instanceof Error ? err.message : '네트워크 오류',
    };
  }
}

export const MAX_GLOBAL_HOF_STARTER_LEGENDS = 5;
export const MAX_GLOBAL_HOF_TOTAL_LEGENDS = 6;
export const MAX_GLOBAL_HOF_TEAM_AVG_OVR = 96.5;

/**
 * Validates that a Hall of Fame squad snapshot is v9.0+ eligible and free of duplicate players,
 * tampered OVR, or impossible Legend-spam rosters before global TOP 15 submission.
 */
export function validateGlobalHofEntryIntegrity(entry: HallOfFameEntry): {
  valid: boolean;
  reason?: string;
} {
  if (!isV9EraHofEntry(entry)) {
    return {
      valid: false,
      reason: 'v9.0 이전 구버전 기록은 글로벌 TOP 15에 등록할 수 없습니다.',
    };
  }
  const payload = buildGlobalSubmissionPayload(entry);
  const starters = payload.squad_snapshot.starters;
  const bench = payload.squad_snapshot.bench;
  if (starters.length < 11) {
    return { valid: false, reason: '선발 11명 스쿼드 정보가 부족합니다.' };
  }
  const seenIds = new Set<string>();
  let starterLegends = 0;
  let totalLegends = 0;
  for (const p of starters) {
    if (!p.id || seenIds.has(p.id)) {
      return { valid: false, reason: '중복된 선수가 포함된 스쿼드는 등록할 수 없습니다.' };
    }
    seenIds.add(p.id);
    if (p.isLegend) {
      starterLegends += 1;
      totalLegends += 1;
    }
  }
  for (const p of bench) {
    if (!p.id || seenIds.has(p.id)) {
      return { valid: false, reason: '중복된 선수가 포함된 스쿼드는 등록할 수 없습니다.' };
    }
    seenIds.add(p.id);
    if (p.isLegend) totalLegends += 1;
  }
  if (
    starterLegends > MAX_GLOBAL_HOF_STARTER_LEGENDS ||
    totalLegends > MAX_GLOBAL_HOF_TOTAL_LEGENDS
  ) {
    return {
      valid: false,
      reason: '비정상적인 레전드 편성 스쿼드는 글로벌 랭킹에 등록할 수 없습니다.',
    };
  }
  if (payload.team_avg_ovr > MAX_GLOBAL_HOF_TEAM_AVG_OVR) {
    return {
      valid: false,
      reason: '비정상적인 팀 능력치 스쿼드는 글로벌 랭킹에 등록할 수 없습니다.',
    };
  }
  return { valid: true };
}

export async function submitGlobalHofRanking(
  entry: HallOfFameEntry,
): Promise<GlobalRankingSubmitResult> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      entered: false,
      rank: null,
      alreadyExists: false,
      cutoffScore: null,
      totalCount: 0,
      prunedCount: 0,
      error: 'Supabase 미연결 환경',
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      entered: false,
      rank: null,
      alreadyExists: false,
      cutoffScore: null,
      totalCount: 0,
      prunedCount: 0,
      error: 'Supabase 클라이언트 초기화 불가',
    };
  }

  try {
    const integrity = validateGlobalHofEntryIntegrity(entry);
    if (!integrity.valid) {
      return {
        ok: false,
        entered: false,
        rank: null,
        alreadyExists: false,
        cutoffScore: null,
        totalCount: 0,
        prunedCount: 0,
        error: integrity.reason ?? '스쿼드 무결성 검증에 실패했습니다.',
      };
    }

    const payload = buildGlobalSubmissionPayload(entry);

    const { data, error } = await client.rpc('submit_global_hof_ranking', {
      p_entry: payload,
    });

    if (error) {
      return {
        ok: false,
        entered: false,
        rank: null,
        alreadyExists: false,
        cutoffScore: null,
        totalCount: 0,
        prunedCount: 0,
        error: error.message,
      };
    }

    const parsed = (data ?? {}) as {
      entered?: boolean;
      rank?: number | null;
      already_exists?: boolean;
      cutoff_score?: number | null;
      total_count?: number;
      pruned_count?: number;
    };

    return {
      ok: true,
      entered: Boolean(parsed.entered),
      rank: typeof parsed.rank === 'number' ? parsed.rank : null,
      alreadyExists: Boolean(parsed.already_exists),
      cutoffScore:
        typeof parsed.cutoff_score === 'number' ? parsed.cutoff_score : null,
      totalCount: typeof parsed.total_count === 'number' ? parsed.total_count : 0,
      prunedCount:
        typeof parsed.pruned_count === 'number' ? parsed.pruned_count : 0,
    };
  } catch (err) {
    return {
      ok: false,
      entered: false,
      rank: null,
      alreadyExists: false,
      cutoffScore: null,
      totalCount: 0,
      prunedCount: 0,
      error: err instanceof Error ? err.message : '네트워크 오류',
    };
  }
}

export function hasCelebratedGlobalTop15(runId: string): boolean {
  if (typeof window === 'undefined' || !runId) return false;
  try {
    const raw = window.localStorage.getItem(CELEBRATED_RUNS_STORAGE_KEY);
    if (!raw) return false;
    const ids = JSON.parse(raw) as unknown;
    return Array.isArray(ids) && ids.includes(runId);
  } catch {
    return false;
  }
}

export function markGlobalTop15Celebrated(runId: string): void {
  if (typeof window === 'undefined' || !runId) return;
  try {
    const raw = window.localStorage.getItem(CELEBRATED_RUNS_STORAGE_KEY);
    const prev = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(prev) ? prev.filter((x): x is string => typeof x === 'string') : [];
    if (!list.includes(runId)) {
      const next = [runId, ...list].slice(0, 60);
      window.localStorage.setItem(
        CELEBRATED_RUNS_STORAGE_KEY,
        JSON.stringify(next),
      );
    }
  } catch {
    // Ignore storage errors
  }
}

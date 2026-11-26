import { FORMATIONS } from '../data/formations';
import { evaluateManagerPlayerSynergy, MANAGER_TRAITS } from '../data/managerTraits';
import { getPlayerAttributes } from '../engine/attributeEngine';
import { applyAwakeningToPlayer, isValidAwakeningRecord } from '../engine/awakeningEngine';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS, LEGEND_PLAYERS } from '../engine/dataLoader';
import {
  HOF_RULE_ERA_V9,
  isHofEntryFullFiveLeagueEligible,
  isV9EraHofEntry,
  isV9PlusRuleEra,
  isValidIsoTimestamp,
  recalibrateScoreBreakdownForLeagueDifficulty,
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

export const GLOBAL_DAILY_TOP_LIMIT = 10;
export const GLOBAL_PAST_DAY_ARCHIVE_LIMIT = 3;
/** Backward-compatible alias now equal to GLOBAL_DAILY_TOP_LIMIT (10). */
export const GLOBAL_TOP15_LIMIT = GLOBAL_DAILY_TOP_LIMIT;
export const GLOBAL_RANKING_RULE_ERA = HOF_RULE_ERA_V9;
const CELEBRATED_RUNS_STORAGE_KEY = 'rtt_global_top15_celebrated_v1';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function toKstShiftedDate(input?: Date | string): Date {
  const d =
    input instanceof Date
      ? input
      : typeof input === 'string' && input
        ? new Date(input)
        : new Date();
  const safeMs = Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
  return new Date(safeMs + KST_OFFSET_MS);
}

/** Formats a Date/ISO timestamp as 'YYYY-MM-DD' in KST (Asia/Seoul, UTC+9). */
export function getKstDateKey(input?: Date | string): string {
  const kst = toKstShiftedDate(input);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns the Monday 'YYYY-MM-DD' of the KST week containing `input`.
 * Matches PostgreSQL `to_char(date_trunc('week', now() at time zone 'Asia/Seoul'), 'YYYY-MM-DD')`.
 */
export function getKstWeekStartKey(input?: Date | string): string {
  const kst = toKstShiftedDate(input);
  const dayOfWeek = kst.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - daysSinceMonday),
  );
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const day = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns all KST date keys in the current week from today back to Monday (descending).
 * Example on Thursday: [Thu(today), Wed, Tue, Mon].
 */
export function getKstWeekDateKeys(referenceDate?: Date | string): string[] {
  const kst = toKstShiftedDate(referenceDate);
  const dayOfWeek = kst.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const keys: string[] = [];
  for (let offset = 0; offset <= daysSinceMonday; offset += 1) {
    const d = new Date(
      Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - offset),
    );
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    keys.push(`${y}-${m}-${day}`);
  }
  return keys;
}

/** Formats a KST date key ('YYYY-MM-DD') as a concise UI tab label ('오늘', '어제', 'MM.DD (월)'). */
export function formatKstDateTabLabel(
  dateKey: string,
  todayKey: string,
): string {
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const todayUtc = Date.UTC(ty || 2026, (tm || 1) - 1, td || 1);
  const [y, m, d] = dateKey.split('-').map(Number);
  const targetUtc = Date.UTC(y || 2026, (m || 1) - 1, d || 1);
  const diffDays = Math.round((todayUtc - targetUtc) / (24 * 60 * 60 * 1000));
  const wd = KO_WEEKDAYS[new Date(targetUtc).getUTCDay()] ?? '';
  if (diffDays === 0) return `오늘 (${wd})`;
  if (diffDays === 1) return `어제 (${wd})`;
  return `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${wd})`;
}

/** Formats an ISO timestamp as 'YYYY.MM.DD' in KST (Asia/Seoul). Returns '' if invalid. */
export function formatKstDisplayDate(iso: string | undefined | null): string {
  if (!isValidIsoTimestamp(iso)) return '';
  return getKstDateKey(iso).replaceAll('-', '.');
}

/**
 * Returns true ONLY when the HOF record has a valid timestamp whose KST calendar date
 * matches today (KST). Past records can be viewed in personal HOF but never submitted today.
 */
export function isHofEntryFromTodayKst(
  entry: Pick<HallOfFameEntry, 'completedAt'> | null | undefined,
  referenceDate?: Date | string,
): boolean {
  if (!entry || !isValidIsoTimestamp(entry.completedAt)) return false;
  return getKstDateKey(entry.completedAt) === getKstDateKey(referenceDate);
}

const MIDNIGHT_ROLLOVER_GRACE_MS = 10 * 60 * 1000;

/**
 * Checks whether a ranking row's `achievedAt` timestamp genuinely belongs to `rankingDate` (KST),
 * allowing a 10-minute grace window right across midnight KST for auto-submissions finished at 23:55+.
 */
export function isAchievedDateMatchingRankingDate(
  achievedAt: string | undefined | null,
  rankingDate: string,
): boolean {
  if (!isValidIsoTimestamp(achievedAt)) return false;
  const achievedKstDate = getKstDateKey(achievedAt);
  if (achievedKstDate === rankingDate) return true;
  // Allow tiny midnight rollover grace (e.g. finished 23:55 KST, submitted 00:01 KST)
  const shiftedMs = Date.parse(achievedAt) + MIDNIGHT_ROLLOVER_GRACE_MS;
  return getKstDateKey(new Date(shiftedMs)) === rankingDate;
}

export interface DailyRankingBucket {
  dateKey: string;
  label: string;
  isToday: boolean;
  limit: number;
  entries: GlobalHofRankingEntry[];
  cutoffScore: number | null;
}

export interface WeeklyDailyRankingsBoard {
  weekStartKey: string;
  todayKey: string;
  dateKeys: string[];
  buckets: DailyRankingBucket[];
  byDate: Record<string, DailyRankingBucket>;
  todayEntries: GlobalHofRankingEntry[];
  todayCutoffScore: number | null;
}

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

  return {
    ruleEra,
    fullFiveLeaguePool: isHofEntryFullFiveLeagueEligible(entry),
    ...(entry.staffCoachId ? { staffCoachId: entry.staffCoachId } : {}),
    ...(entry.teamStory ? { teamStory: entry.teamStory } : {}),
    starters,
    bench,
  };
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

  const { breakdown: calibratedBreakdown } =
    recalibrateScoreBreakdownForLeagueDifficulty(
      entry.seasonScore,
      entry.leagueId,
      entry.finalLeagueRank,
    );

  return {
    run_id: runId,
    rule_era: ruleEra,
    season_score: Math.round(calibratedBreakdown.totalScore),
    grade: calibratedBreakdown.grade,
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
    score_breakdown: { ...calibratedBreakdown, ruleEra },
    squad_snapshot: { ...squadSnapshot, ruleEra },
    achieved_at: entry.completedAt,
  };
}

export interface RawGlobalRankingRow {
  id: string;
  run_id: string;
  rule_era?: string | null;
  ranking_date?: string | null;
  ranking_week_start?: string | null;
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
    ...(typeof obj.leagueRankBaseBonus === 'number'
      ? { leagueRankBaseBonus: obj.leagueRankBaseBonus }
      : {}),
    ...(typeof obj.leagueStrengthAvg === 'number'
      ? { leagueStrengthAvg: obj.leagueStrengthAvg }
      : {}),
    ...(typeof obj.leagueDifficultyFactor === 'number' &&
    obj.leagueDifficultyFactor > 0
      ? { leagueDifficultyFactor: obj.leagueDifficultyFactor }
      : {}),
    ...(typeof obj.leagueStrengthEraLabel === 'string' &&
    obj.leagueStrengthEraLabel
      ? { leagueStrengthEraLabel: obj.leagueStrengthEraLabel }
      : {}),
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
  const rawGrade = (
    ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C'].includes(row.grade)
      ? row.grade
      : 'C'
  ) as SeasonScoreBreakdown['grade'];
  const rawSnap =
    row.squad_snapshot && typeof row.squad_snapshot === 'object'
      ? (row.squad_snapshot as Partial<GlobalSquadSnapshot>)
      : {};
  const ruleEra = extractRawRowRuleEra(row);
  const leagueId: LeagueId = isValidLeagueId(row.league_id) ? row.league_id : 'epl';
  const finalLeagueRank = Number(row.final_league_rank) || 1;
  const rawScore = Number(row.season_score) || 0;
  const sanitizedBreakdown = sanitizeScoreBreakdown(
    row.score_breakdown,
    rawScore,
    rawGrade,
  );
  // v9.3.1: Idempotently recalibrate already-uploaded Global TOP 15 rows lacking leagueDifficultyFactor
  const { breakdown: calibratedBreakdown, changed } =
    recalibrateScoreBreakdownForLeagueDifficulty(
      { ...sanitizedBreakdown, totalScore: rawScore },
      leagueId,
      finalLeagueRank,
    );
  const effectiveScore = changed ? calibratedBreakdown.totalScore : rawScore;
  const effectiveGrade = changed ? calibratedBreakdown.grade : rawGrade;

  return {
    id: row.id,
    runId: row.run_id,
    ...(ruleEra ? { ruleEra } : {}),
    rank,
    seasonScore: effectiveScore,
    grade: effectiveGrade,
    clubName: row.club_name || '구단',
    managerName: row.manager_name || DEFAULT_MANAGER_NAME,
    leagueId,
    leagueKoreanName: row.league_korean_name || '프리미어리그',
    finalLeagueRank,
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
    ...(rawSnap.staffCoachId ? { staffCoachId: rawSnap.staffCoachId } : {}),
    teamAvgOvr: Math.round((Number(row.team_avg_ovr) || 80) * 10) / 10,
    chemistry: Number(row.chemistry) || 50,
    avgSynergyOvrBonus:
      Math.round((Number(row.avg_synergy_ovr_bonus) || 0) * 100) / 100,
    managerSynergyCount: Number(row.manager_synergy_count) || 0,
    topScorerSummary: row.top_scorer_summary || '-',
    clubProfile: sanitizeClubProfile(row.club_profile, row.club_name || '구단'),
    managerAvatar: sanitizeManagerAvatar(row.manager_avatar),
    scoreBreakdown: calibratedBreakdown,
    squadSnapshot: {
      ...(typeof rawSnap.ruleEra === 'string' ? { ruleEra: rawSnap.ruleEra } : {}),
      ...(typeof rawSnap.fullFiveLeaguePool === 'boolean'
        ? { fullFiveLeaguePool: rawSnap.fullFiveLeaguePool }
        : {}),
      ...(rawSnap.staffCoachId ? { staffCoachId: rawSnap.staffCoachId } : {}),
      ...(rawSnap.teamStory ? { teamStory: rawSnap.teamStory } : {}),
      starters: Array.isArray(rawSnap.starters) ? rawSnap.starters : [],
      bench: Array.isArray(rawSnap.bench) ? rawSnap.bench : [],
    },
    ...(rawSnap.teamStory ? { teamStory: rawSnap.teamStory } : {}),
    rankingDate:
      typeof row.ranking_date === 'string' && row.ranking_date.trim()
        ? row.ranking_date.trim()
        : getKstDateKey(row.achieved_at),
    rankingWeekStart:
      typeof row.ranking_week_start === 'string' && row.ranking_week_start.trim()
        ? row.ranking_week_start.trim()
        : getKstWeekStartKey(row.achieved_at),
    achievedAt: row.achieved_at || new Date().toISOString(),
  };
}

/**
 * Groups global ranking entries into the current KST weekly board:
 * - Weekly reset every Monday 00:00 KST (entries from earlier weeks are excluded).
 * - Today (`todayKey`): capped at TOP 10 (`GLOBAL_DAILY_TOP_LIMIT`).
 * - Earlier days of the same week (`dateKey < todayKey`): capped at TOP 3 (`GLOBAL_PAST_DAY_ARCHIVE_LIMIT`).
 * - Excludes past-dated records mistakenly submitted on a later day (`achievedAt` KST date != `rankingDate`)
 *   and entries explicitly flagged as `fullFiveLeaguePool === false`.
 */
export function groupWeeklyDailyRankings(
  entries: readonly GlobalHofRankingEntry[],
  referenceDate?: Date | string,
): WeeklyDailyRankingsBoard {
  const todayKey = getKstDateKey(referenceDate);
  const weekStartKey = getKstWeekStartKey(referenceDate);
  const dateKeys = getKstWeekDateKeys(referenceDate);
  const dateKeySet = new Set(dateKeys);

  const rawByDate = new Map<string, GlobalHofRankingEntry[]>();
  for (const dk of dateKeys) rawByDate.set(dk, []);

  for (const entry of entries) {
    if (!isV9EraGlobalEntry(entry)) continue;
    if (entry.squadSnapshot?.fullFiveLeaguePool === false) continue;
    const entryDate = entry.rankingDate?.trim() || getKstDateKey(entry.achievedAt);
    const entryWeek =
      entry.rankingWeekStart?.trim() || getKstWeekStartKey(entry.achievedAt);
    if (entryWeek !== weekStartKey || !dateKeySet.has(entryDate)) continue;
    if (!isAchievedDateMatchingRankingDate(entry.achievedAt, entryDate)) continue;
    rawByDate.get(entryDate)?.push({
      ...entry,
      rankingDate: entryDate,
      rankingWeekStart: entryWeek,
    });
  }

  const buckets: DailyRankingBucket[] = [];
  const byDate: Record<string, DailyRankingBucket> = {};

  for (const dk of dateKeys) {
    const isToday = dk === todayKey;
    const limit = isToday
      ? GLOBAL_DAILY_TOP_LIMIT
      : GLOBAL_PAST_DAY_ARCHIVE_LIMIT;
    const ranked = [...(rawByDate.get(dk) ?? [])]
      .sort(compareGlobalRankingEntries)
      .slice(0, limit)
      .map((e, idx) => ({ ...e, rank: idx + 1 }));
    const cutoffScore =
      ranked.length >= limit
        ? ranked[limit - 1].seasonScore
        : ranked.length > 0
          ? ranked[ranked.length - 1].seasonScore
          : null;
    const bucket: DailyRankingBucket = {
      dateKey: dk,
      label: formatKstDateTabLabel(dk, todayKey),
      isToday,
      limit,
      entries: ranked,
      cutoffScore,
    };
    buckets.push(bucket);
    byDate[dk] = bucket;
  }

  const todayBucket = byDate[todayKey];
  return {
    weekStartKey,
    todayKey,
    dateKeys,
    buckets,
    byDate,
    todayEntries: todayBucket?.entries ?? [],
    todayCutoffScore: todayBucket?.cutoffScore ?? null,
  };
}

/**
 * Pure mirror of the PostgreSQL KST Daily TOP 10 / Past-Day TOP 3 / Weekly Reset RPC.
 */
export function applyDailyTop10RankingLogic(
  existing: readonly GlobalHofRankingEntry[],
  candidate: GlobalHofRankingEntry,
  referenceDate?: Date | string,
): {
  board: WeeklyDailyRankingsBoard;
  result: GlobalRankingSubmitResult;
} {
  const todayKey = getKstDateKey(referenceDate);
  const weekStartKey = getKstWeekStartKey(referenceDate);
  const beforeBoard = groupWeeklyDailyRankings(existing, referenceDate);

  if (!isV9EraGlobalEntry(candidate)) {
    return {
      board: beforeBoard,
      result: {
        ok: false,
        entered: false,
        rank: null,
        alreadyExists: false,
        cutoffScore: beforeBoard.todayCutoffScore,
        totalCount: beforeBoard.todayEntries.length,
        prunedCount: 0,
        rankingDate: todayKey,
        error: 'v9.0 이전 구버전 기록은 일일 랭킹에 등록할 수 없습니다.',
      },
    };
  }

  if (!isAchievedDateMatchingRankingDate(candidate.achievedAt, todayKey)) {
    return {
      board: beforeBoard,
      result: {
        ok: false,
        entered: false,
        rank: null,
        alreadyExists: false,
        cutoffScore: beforeBoard.todayCutoffScore,
        totalCount: beforeBoard.todayEntries.length,
        prunedCount: 0,
        rankingDate: todayKey,
        error: '오늘(KST) 완료한 시즌 기록만 오늘의 일일 랭킹에 제출할 수 있습니다.',
      },
    };
  }

  if (candidate.squadSnapshot?.fullFiveLeaguePool === false) {
    return {
      board: beforeBoard,
      result: {
        ok: false,
        entered: false,
        rank: null,
        alreadyExists: false,
        cutoffScore: beforeBoard.todayCutoffScore,
        totalCount: beforeBoard.todayEntries.length,
        prunedCount: 0,
        rankingDate: todayKey,
        error: '5대 리그 드래프트 풀을 모두 선택한 시즌만 일일 랭킹에 제출할 수 있습니다.',
      },
    };
  }

  const existingToday = beforeBoard.todayEntries.find(
    (e) => e.runId === candidate.runId,
  );
  if (existingToday) {
    return {
      board: beforeBoard,
      result: {
        ok: true,
        entered: existingToday.rank <= GLOBAL_DAILY_TOP_LIMIT,
        rank: existingToday.rank,
        alreadyExists: true,
        cutoffScore: beforeBoard.todayCutoffScore,
        totalCount: beforeBoard.todayEntries.length,
        prunedCount: 0,
        rankingDate: todayKey,
      },
    };
  }

  const taggedCandidate: GlobalHofRankingEntry = {
    ...candidate,
    rankingDate: todayKey,
    rankingWeekStart: weekStartKey,
  };
  const nextAll = [
    ...beforeBoard.buckets.flatMap((b) => b.entries),
    taggedCandidate,
  ];
  const afterBoard = groupWeeklyDailyRankings(nextAll, referenceDate);
  const inserted = afterBoard.todayEntries.find(
    (e) => e.runId === candidate.runId,
  );
  const entered = Boolean(inserted && inserted.rank <= GLOBAL_DAILY_TOP_LIMIT);
  const prunedCount =
    entered && beforeBoard.todayEntries.length >= GLOBAL_DAILY_TOP_LIMIT ? 1 : 0;

  return {
    board: afterBoard,
    result: {
      ok: true,
      entered,
      rank: entered && inserted ? inserted.rank : null,
      alreadyExists: false,
      cutoffScore: afterBoard.todayCutoffScore,
      totalCount: afterBoard.todayEntries.length,
      prunedCount,
      rankingDate: todayKey,
    },
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
  weekly?: WeeklyDailyRankingsBoard;
  error?: string;
}

export async function fetchWeeklyDailyRankings(
  referenceDate?: Date | string,
): Promise<FetchGlobalTop15Result> {
  const emptyBoard = groupWeeklyDailyRankings([], referenceDate);
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      configured: false,
      entries: [],
      cutoffScore: null,
      weekly: emptyBoard,
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
      weekly: emptyBoard,
      error: 'Supabase 클라이언트 초기화 불가',
    };
  }

  try {
    const weekStartKey = getKstWeekStartKey(referenceDate);
    // Prefer week-filtered query; gracefully fall back if DB migration hasn't added ranking_week_start yet
    let rows: RawGlobalRankingRow[] = [];
    const primary = await client
      .from('global_hof_rankings')
      .select('*')
      .eq('ranking_week_start', weekStartKey)
      .order('season_score', { ascending: false })
      .order('is_treble', { ascending: false })
      .order('ucl_won', { ascending: false })
      .order('achieved_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(120);

    if (primary.error) {
      const fallback = await client
        .from('global_hof_rankings')
        .select('*')
        .order('season_score', { ascending: false })
        .order('is_treble', { ascending: false })
        .order('ucl_won', { ascending: false })
        .order('achieved_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(120);

      if (fallback.error) {
        return {
          ok: false,
          configured: true,
          entries: [],
          cutoffScore: null,
          weekly: emptyBoard,
          error: fallback.error.message,
        };
      }
      rows = (fallback.data ?? []) as RawGlobalRankingRow[];
    } else {
      rows = (primary.data ?? []) as RawGlobalRankingRow[];
    }

    const mappedValid = rows
      .filter((row) => isV9PlusRuleEra(extractRawRowRuleEra(row)))
      .map((row, idx) => mapRawRowToEntry(row, idx + 1));

    const weekly = groupWeeklyDailyRankings(mappedValid, referenceDate);

    return {
      ok: true,
      configured: true,
      entries: weekly.todayEntries,
      cutoffScore: weekly.todayCutoffScore,
      weekly,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      entries: [],
      cutoffScore: null,
      weekly: emptyBoard,
      error: err instanceof Error ? err.message : '네트워크 오류',
    };
  }
}

export async function fetchGlobalTop15Rankings(): Promise<FetchGlobalTop15Result> {
  return fetchWeeklyDailyRankings();
}

export const MAX_GLOBAL_HOF_STARTER_LEGENDS = 5;
export const MAX_GLOBAL_HOF_TOTAL_LEGENDS = 6;
export const MAX_GLOBAL_HOF_TEAM_AVG_OVR = 96.5;

/**
 * Validates that a Hall of Fame squad snapshot is v9.0+ eligible, satisfied the full 5-league draft pool rule,
 * and is free of duplicate players, tampered OVR, or impossible Classic-spam rosters.
 */
export function validateGlobalHofEntryIntegrity(entry: HallOfFameEntry): {
  valid: boolean;
  reason?: string;
} {
  if (!isV9EraHofEntry(entry)) {
    return {
      valid: false,
      reason: 'v9.0 이전 구버전 기록은 일일 랭킹에 등록할 수 없습니다.',
    };
  }
  if (!isHofEntryFullFiveLeagueEligible(entry)) {
    return {
      valid: false,
      reason: '5대 리그 드래프트 풀을 모두 선택한 시즌만 일일 랭킹에 제출할 수 있습니다.',
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
      reason: '비정상적인 클래식 편성 스쿼드는 일일 랭킹에 등록할 수 없습니다.',
    };
  }
  if (payload.team_avg_ovr > MAX_GLOBAL_HOF_TEAM_AVG_OVR) {
    return {
      valid: false,
      reason: '비정상적인 팀 능력치 스쿼드는 일일 랭킹에 등록할 수 없습니다.',
    };
  }
  return { valid: true };
}

export type DailyRankingIneligibleCode =
  | 'missing_date'
  | 'past_date'
  | 'partial_pool'
  | 'integrity';

/**
 * Complete eligibility check for submitting a Hall of Fame entry to today's KST Daily Ranking:
 * 1) Valid completion date
 * 2) Completed today (KST) — past records cannot be submitted today
 * 3) Full 5-league draft pool enabled — partial pools are personal HOF only
 * 4) Squad & rule-era integrity checks
 */
export function validateDailyRankingEligibility(
  entry: HallOfFameEntry,
  referenceDate?: Date | string,
): {
  eligible: boolean;
  code?: DailyRankingIneligibleCode;
  reason?: string;
} {
  if (!isValidIsoTimestamp(entry.completedAt)) {
    return {
      eligible: false,
      code: 'missing_date',
      reason: '기록 날짜 정보가 없는 과거 기록은 일일 랭킹에 제출할 수 없습니다.',
    };
  }
  if (!isHofEntryFromTodayKst(entry, referenceDate)) {
    return {
      eligible: false,
      code: 'past_date',
      reason: '과거에 완료한 기록은 오늘의 일일 랭킹에 제출할 수 없습니다.',
    };
  }
  if (!isHofEntryFullFiveLeagueEligible(entry)) {
    return {
      eligible: false,
      code: 'partial_pool',
      reason: '5대 리그 드래프트 풀을 모두 선택한 시즌만 일일 랭킹에 제출할 수 있습니다.',
    };
  }
  const integrity = validateGlobalHofEntryIntegrity(entry);
  if (!integrity.valid) {
    return {
      eligible: false,
      code: 'integrity',
      reason: integrity.reason ?? '스쿼드 무결성 검증에 실패했습니다.',
    };
  }
  return { eligible: true };
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
    const eligibility = validateDailyRankingEligibility(entry);
    if (!eligibility.eligible) {
      return {
        ok: false,
        entered: false,
        rank: null,
        alreadyExists: false,
        cutoffScore: null,
        totalCount: 0,
        prunedCount: 0,
        error: eligibility.reason ?? '일일 랭킹 제출 조건을 충족하지 않습니다.',
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
      ranking_date?: string | null;
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
      ...(typeof parsed.ranking_date === 'string' && parsed.ranking_date.trim()
        ? { rankingDate: parsed.ranking_date.trim() }
        : {}),
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

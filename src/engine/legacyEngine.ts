import { HIDDEN_ACHIEVEMENTS } from '../data/achievements';
import type { DomesticCupState } from '../types/cup';
import type {
  FormationId,
  ManagerTraitId,
  UserClubProfile,
} from '../types/game';
import type {
  LeagueId,
  MatchResult,
  PlayerSeasonStats,
  StandingRow,
  TacticId,
} from '../types/league';
import type {
  HallOfFameEntry,
  LegacyStorageState,
  SeasonAchievementTrackers,
  SeasonScoreBreakdown,
  UnlockedAchievementRecord,
} from '../types/legacy';
import { buildHallOfFameMember } from '../types/legacy';
import type { Player } from '../types/player';
import type { UclTournamentState } from '../types/ucl';
import { didUserWinCup, getUserCupResultLabel } from './cupEngine';
import { getLeagueById } from './dataLoader';
import { USER_CLUB_ID } from './matchEngine';
import { getUserRank } from './standingsEngine';
import { didUserWinUcl, getUserUclResultLabel } from './uclEngine';

export const LEGACY_STORAGE_KEY = 'pitch_manager_legacy_v1';

export function createEmptyLegacyState(): LegacyStorageState {
  return {
    version: 1,
    hallOfFame: [],
    unlockedAchievements: {},
  };
}

export function loadLegacyState(): LegacyStorageState {
  if (typeof window === 'undefined') return createEmptyLegacyState();
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return createEmptyLegacyState();
    const parsed = JSON.parse(raw) as Partial<LegacyStorageState>;
    return {
      version: 1,
      hallOfFame: Array.isArray(parsed.hallOfFame) ? parsed.hallOfFame : [],
      unlockedAchievements:
        parsed.unlockedAchievements &&
        typeof parsed.unlockedAchievements === 'object'
          ? parsed.unlockedAchievements
          : {},
    };
  } catch {
    return createEmptyLegacyState();
  }
}

export function saveLegacyState(state: LegacyStorageState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export interface SeasonScoreInput {
  leaguePoints: number;
  leaguePlayed: number;
  leagueGoalDifference: number;
  leagueLosses: number;
  finalLeagueRank: number;
  cup: DomesticCupState | null;
  ucl: UclTournamentState | null;
  teamAvgOvr: number;
  userClubId?: string;
}

/**
 * Computes a fair cross-league Season Score normalizing 34-round (Bundesliga / Ligue 1)
 * and 38-round (EPL / La Liga / Serie A) leagues via PPG * 38!
 */
export function computeSeasonScore(
  input: SeasonScoreInput,
): SeasonScoreBreakdown {
  const {
    leaguePoints,
    leaguePlayed,
    leagueGoalDifference,
    leagueLosses,
    finalLeagueRank,
    cup,
    ucl,
    teamAvgOvr,
    userClubId = USER_CLUB_ID,
  } = input;

  const safePlayed = Math.max(1, leaguePlayed);
  const ppg = leaguePoints / safePlayed;
  const converted38Points = ppg * 38;
  const gdNormalized = (leagueGoalDifference / safePlayed) * 38;
  const leagueConvertedScore = Math.max(
    0,
    Math.round(converted38Points * 25 + Math.max(-150, gdNormalized * 3.5)),
  );

  // League Rank Bonus
  let leagueRankBonus = 0;
  if (finalLeagueRank === 1) leagueRankBonus = 1200;
  else if (finalLeagueRank === 2) leagueRankBonus = 750;
  else if (finalLeagueRank === 3) leagueRankBonus = 520;
  else if (finalLeagueRank === 4) leagueRankBonus = 380;
  else if (finalLeagueRank <= 6) leagueRankBonus = 200;
  else if (finalLeagueRank <= 10) leagueRankBonus = 80;

  // Domestic Cup Bonus
  let cupBonus = 0;
  if (cup) {
    if (cup.championTeamId === userClubId) cupBonus = 850;
    else if (cup.userEliminatedAt === 'final') cupBonus = 480;
    else if (cup.userEliminatedAt === 'sf') cupBonus = 260;
    else if (cup.userEliminatedAt === 'qf') cupBonus = 120;
  }

  // 36-Team UEFA Champions League Bonus
  let uclBonus = 0;
  if (ucl) {
    if (ucl.championTeamId === userClubId) uclBonus = 2200;
    else if (ucl.userEliminatedAt === 'final') uclBonus = 1400;
    else if (ucl.userEliminatedAt === 'sf') uclBonus = 950;
    else if (ucl.userEliminatedAt === 'qf') uclBonus = 620;
    else if (ucl.userEliminatedAt === 'r16') uclBonus = 360;
    else if (ucl.userEliminatedAt === 'playoff') uclBonus = 180;
    else if (ucl.userEliminatedAt === 'league_phase') uclBonus = 60;
  }

  // Honors Bonus (Treble / Double / League Unbeaten)
  const wonLeague = finalLeagueRank === 1;
  const wonCup = didUserWinCup(cup, userClubId);
  const wonUcl = didUserWinUcl(ucl, userClubId);
  const trophyCount = (wonLeague ? 1 : 0) + (wonCup ? 1 : 0) + (wonUcl ? 1 : 0);

  let honorsBonus = 0;
  if (trophyCount === 3) honorsBonus += 1500; // Treble
  else if (trophyCount === 2) honorsBonus += 550; // Double
  if (wonLeague && leagueLosses === 0 && leaguePlayed >= 34) {
    honorsBonus += 750; // Invincible League Champion
  }

  // Underdog Bonus (lower avg OVR achieving Top 4 / Title / UCL deep run)
  let underdogBonus = 0;
  if (teamAvgOvr < 85 && (finalLeagueRank <= 4 || wonCup || wonUcl)) {
    const ovrGap = Math.max(0, 85 - teamAvgOvr);
    const achievementMult =
      wonUcl || wonLeague ? 85 : finalLeagueRank <= 4 ? 45 : 30;
    underdogBonus = Math.min(900, Math.round(ovrGap * achievementMult));
  }

  const totalScore =
    leagueConvertedScore +
    leagueRankBonus +
    cupBonus +
    uclBonus +
    honorsBonus +
    underdogBonus;

  let grade: SeasonScoreBreakdown['grade'];
  if (totalScore >= 7200) grade = 'S+';
  else if (totalScore >= 5600) grade = 'S';
  else if (totalScore >= 4200) grade = 'A+';
  else if (totalScore >= 3200) grade = 'A';
  else if (totalScore >= 2300) grade = 'B+';
  else if (totalScore >= 1500) grade = 'B';
  else grade = 'C';

  return {
    leagueConvertedScore,
    leagueRankBonus,
    cupBonus,
    uclBonus,
    honorsBonus,
    underdogBonus,
    totalScore,
    grade,
  };
}

function didUserLoseMatch(match: MatchResult, userClubId: string): boolean {
  const isHome = match.homeTeamId === userClubId;
  const ug = isHome ? match.homeGoals : match.awayGoals;
  const og = isHome ? match.awayGoals : match.homeGoals;
  // In knockout matches decided by penalties, regular/ET was a draw; losing PK is a loss of tie,
  // while winning on PK still counts as undefeated in open play!
  if (match.extraTime?.penalties) {
    return match.extraTime.penalties.winnerTeamId !== userClubId;
  }
  return ug < og;
}

export interface EvaluateAchievementsInput {
  leagueId: LeagueId;
  totalRounds: number;
  standings: StandingRow[];
  userLeagueMatchHistory: MatchResult[];
  allPlayerStats: Record<string, PlayerSeasonStats>;
  cup: DomesticCupState | null;
  userCupMatchHistory: MatchResult[];
  ucl: UclTournamentState | null;
  userUclMatchHistory: MatchResult[];
  starters: (Player | null)[];
  bench: (Player | null)[];
  teamAvgOvr: number;
  chemistry: number;
  trackers: SeasonAchievementTrackers;
  userClubId?: string;
}

/**
 * Evaluates all 24 Hidden Achievements for the current season state and returns
 * the list of achievement IDs satisfied right now.
 */
export function evaluateAchievements(
  input: EvaluateAchievementsInput,
): string[] {
  const {
    leagueId,
    totalRounds,
    standings,
    userLeagueMatchHistory,
    allPlayerStats,
    cup,
    userCupMatchHistory,
    ucl,
    userUclMatchHistory,
    starters,
    bench,
    teamAvgOvr,
    chemistry,
    trackers,
    userClubId = USER_CLUB_ID,
  } = input;

  const earned = new Set<string>();
  const userRow = standings.find((r) => r.teamId === userClubId);
  const finalRank = getUserRank(standings, userClubId);
  const leagueFinished = Boolean(userRow && userRow.played >= totalRounds);
  const wonLeague = leagueFinished && finalRank === 1;
  const wonCup = didUserWinCup(cup, userClubId);
  const wonUcl = didUserWinUcl(ucl, userClubId);

  // 1-3: EPL
  if (leagueId === 'epl' && wonLeague && userRow) {
    if (userRow.goalsAgainst <= 15) earned.add('epl_iron_wall');
    if (userRow.lost === 0) earned.add('epl_invincibles');
    if (userRow.points >= 100) earned.add('epl_centurions');
  }

  // 4-5: La Liga
  if (leagueId === 'laliga' && userRow) {
    if (wonLeague && userRow.points >= 100) earned.add('laliga_100_king');
    if (userRow.goalsFor >= 100) earned.add('laliga_100_goals');
  }

  // 6-7: Serie A
  if (leagueId === 'seriea' && wonLeague && userRow) {
    if (userRow.points >= 102) earned.add('seriea_102_dominator');
    if (userRow.lost === 0) earned.add('seriea_catenaccio_unbeaten');
  }

  // 8-9: Bundesliga
  if (leagueId === 'bundesliga' && wonLeague && userRow) {
    if (userRow.lost === 0) earned.add('bundesliga_neverkusen');
    if (userRow.points >= 91) earned.add('bundesliga_91_limit');
  }

  // 10: Ligue 1
  if (leagueId === 'ligue1' && wonLeague && userRow) {
    if (userRow.lost === 0) earned.add('ligue1_unbeaten_myth');
  }

  // 11-13: Europe (UCL)
  if (ucl) {
    if (wonUcl) earned.add('ucl_big_ears');

    const uclRow = ucl.standings.find((r) => r.teamId === userClubId);
    if (
      ucl.leaguePhaseRound >= 8 &&
      ucl.userLeaguePhaseRank === 1 &&
      uclRow &&
      uclRow.won === 8 &&
      uclRow.drawn === 0 &&
      uclRow.lost === 0
    ) {
      earned.add('ucl_swiss_perfect');
    }

    if (wonUcl && ucl.enteredViaPlayoff) {
      earned.add('ucl_playoff_miracle');
    }
  }

  // 14-15: Dynasty (Treble & Perfect Invincible)
  if (wonLeague && wonCup && wonUcl) {
    earned.add('dynasty_treble');

    const leagueUnbeaten = Boolean(userRow && userRow.lost === 0);
    const cupUnbeaten = userCupMatchHistory.every(
      (m) => !didUserLoseMatch(m, userClubId),
    );
    const uclUnbeaten = userUclMatchHistory.every(
      (m) => !didUserLoseMatch(m, userClubId),
    );
    if (leagueUnbeaten && cupUnbeaten && uclUnbeaten) {
      earned.add('dynasty_perfect_invincible');
    }
  }

  // 16-17: Fairytale
  if (wonLeague && teamAvgOvr <= 82) {
    earned.add('fairytale_leicester');
  }
  const fullSquad = [...starters, ...bench].filter(
    (p): p is Player => p !== null,
  );
  if (wonUcl && fullSquad.length > 0 && fullSquad.every((p) => !p.isLegend)) {
    earned.add('fairytale_no_legends');
  }

  // 18: Drama (Istanbul comeback from 2+ down at HT)
  if (trackers.comebackFrom2DownCount >= 1) {
    earned.add('drama_istanbul');
  }

  // 19: Tactics (HT tactic comeback wins >= 3 in season)
  if (trackers.halftimeTacticComebackWins >= 3) {
    earned.add('tactics_ht_wizard');
  }

  // 20-21: Individual league stats (single user player >=35 goals / >=20 assists)
  const userStatsList = Object.values(allPlayerStats).filter(
    (st) => st.isUserTeam,
  );
  if (userStatsList.some((st) => st.goals >= 35)) {
    earned.add('individual_35_goals');
  }
  if (userStatsList.some((st) => st.assists >= 20)) {
    earned.add('individual_20_assists');
  }

  // 22: Defense (20+ league clean sheets)
  const leagueCleanSheets = userLeagueMatchHistory.filter((m) => {
    const isHome = m.homeTeamId === userClubId;
    return isHome ? m.awayGoals === 0 : m.homeGoals === 0;
  }).length;
  if (leagueCleanSheets >= 20) {
    earned.add('defense_20_cleansheets');
  }

  // 23: Chemistry (>= 95 & League Champion)
  if (wonLeague && chemistry >= 95) {
    earned.add('chemistry_one_team');
  }

  // 24: Transfer Gambler (signed player with <=20% chance)
  if (trackers.signedUnder20PctSuccess) {
    earned.add('transfer_gambler');
  }

  return Array.from(earned);
}

/**
 * Persists newly unlocked achievements into localStorage and returns ONLY the newly unlocked IDs
 * (for instant toast notifications).
 */
export function unlockAchievementsInStorage(params: {
  achievementIds: string[];
  clubName: string;
  leagueName: string;
  summaryNote: string;
}): {
  legacyState: LegacyStorageState;
  newlyUnlockedIds: string[];
} {
  const current = loadLegacyState();
  const nextUnlocked: Record<string, UnlockedAchievementRecord> = {
    ...current.unlockedAchievements,
  };
  const newlyUnlockedIds: string[] = [];
  const nowIso = new Date().toISOString();

  for (const id of params.achievementIds) {
    if (!nextUnlocked[id]) {
      nextUnlocked[id] = {
        id,
        unlockedAt: nowIso,
        clubName: params.clubName,
        leagueName: params.leagueName,
        summaryNote: params.summaryNote,
      };
      newlyUnlockedIds.push(id);
    }
  }

  const updated: LegacyStorageState = {
    ...current,
    unlockedAchievements: nextUnlocked,
  };
  if (newlyUnlockedIds.length > 0) {
    saveLegacyState(updated);
  }

  return { legacyState: updated, newlyUnlockedIds };
}

export function archiveSeasonToHallOfFame(params: {
  userClub: UserClubProfile;
  managerTraitId: ManagerTraitId | null;
  leagueId: LeagueId;
  formation: FormationId;
  defaultTactic: TacticId;
  standings: StandingRow[];
  totalRounds: number;
  cup: DomesticCupState | null;
  ucl: UclTournamentState | null;
  teamAvgOvr: number;
  chemistry: number;
  seasonScore: SeasonScoreBreakdown;
  starters: (Player | null)[];
  bench: (Player | null)[];
  combinedPlayerStats: Record<string, PlayerSeasonStats>;
  unlockedAchievementIds: string[];
  userClubId?: string;
}): LegacyStorageState {
  const {
    userClub,
    managerTraitId,
    leagueId,
    formation,
    defaultTactic,
    standings,
    totalRounds,
    cup,
    ucl,
    teamAvgOvr,
    chemistry,
    seasonScore,
    starters,
    bench,
    combinedPlayerStats,
    unlockedAchievementIds,
    userClubId = USER_CLUB_ID,
  } = params;

  const league = getLeagueById(leagueId);
  const userRow = standings.find((r) => r.teamId === userClubId);
  const finalLeagueRank = getUserRank(standings, userClubId);
  const isLeagueChampion = finalLeagueRank === 1;
  const cupWon = didUserWinCup(cup, userClubId);
  const uclWon = didUserWinUcl(ucl, userClubId);
  const isTreble = isLeagueChampion && cupWon && uclWon;

  const trophies: string[] = [];
  if (isLeagueChampion) trophies.push(`${league.koreanName} 우승`);
  if (cupWon && cup) trophies.push(`${cup.meta.koreanName} 우승`);
  if (uclWon) trophies.push('UEFA 챔피언스리그 우승');

  const toMember = (p: Player) => {
    const st = combinedPlayerStats[`user::${p.id}`];
    return buildHallOfFameMember(
      p,
      st?.goals ?? 0,
      st?.assists ?? 0,
      st?.avgRating ?? 0,
    );
  };

  const starterMembers = starters
    .filter((p): p is Player => p !== null)
    .map(toMember);
  const benchMembers = bench
    .filter((p): p is Player => p !== null)
    .map(toMember);

  const topScorer = [...starterMembers, ...benchMembers].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists,
  )[0];

  const entry: HallOfFameEntry = {
    id: `hof-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    completedAt: new Date().toISOString(),
    userClub: { ...userClub },
    managerTraitId,
    leagueId,
    leagueKoreanName: league.koreanName,
    formation,
    defaultTactic,
    finalLeagueRank,
    leaguePoints: userRow?.points ?? 0,
    leagueTotalRounds: totalRounds,
    leagueRecord: `${userRow?.won ?? 0}승 ${userRow?.drawn ?? 0}무 ${userRow?.lost ?? 0}패`,
    cupName: cup?.meta.koreanName ?? '자국 컵',
    cupResultLabel: getUserCupResultLabel(cup, userClubId),
    cupWon,
    uclResultLabel: getUserUclResultLabel(ucl, userClubId),
    uclWon,
    isTreble,
    isLeagueChampion,
    teamAvgOvr: Math.round(teamAvgOvr * 10) / 10,
    chemistry,
    seasonScore,
    trophies,
    topScorerSummary: topScorer
      ? `${topScorer.name} (${topScorer.goals}골 ${topScorer.assists}도움)`
      : '-',
    starters: starterMembers,
    bench: benchMembers,
    unlockedAchievementIds,
  };

  const current = loadLegacyState();
  const nextHallOfFame = [entry, ...current.hallOfFame].slice(0, 50);
  const updated: LegacyStorageState = {
    ...current,
    hallOfFame: nextHallOfFame,
  };
  saveLegacyState(updated);
  return updated;
}

export function deleteHallOfFameEntry(entryId: string): LegacyStorageState {
  const current = loadLegacyState();
  const updated: LegacyStorageState = {
    ...current,
    hallOfFame: current.hallOfFame.filter((e) => e.id !== entryId),
  };
  saveLegacyState(updated);
  return updated;
}

export function getAchievementProgress(state: LegacyStorageState): {
  unlocked: number;
  total: number;
} {
  const total = HIDDEN_ACHIEVEMENTS.length;
  const unlocked = HIDDEN_ACHIEVEMENTS.filter((a) =>
    Boolean(state.unlockedAchievements[a.id]),
  ).length;
  return { unlocked, total };
}

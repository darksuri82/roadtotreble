import { HIDDEN_ACHIEVEMENTS } from '../data/achievements';
import type { DomesticCupState } from '../types/cup';
import type {
  FormationId,
  ManagerAvatarConfig,
  ManagerTraitId,
  UserClubProfile,
} from '../types/game';
import type {
  GlobalSeasonAwards,
  LeagueId,
  MatchResult,
  PlayerSeasonStats,
  SeasonAwards,
  StandingRow,
  TacticId,
} from '../types/league';
import type {
  DreamMatchRecord,
  HallOfFameEntry,
  HallOfFameMatchSummary,
  HallOfFameSquadMember,
  LegacyStorageState,
  SeasonAchievementTrackers,
  SeasonScoreBreakdown,
  UnlockedAchievementRecord,
} from '../types/legacy';
import { buildHallOfFameMember } from '../types/legacy';
import type { Player, Position, SubPosition } from '../types/player';
import type { UclTournamentState } from '../types/ucl';
import { getPlayerAttributes } from './attributeEngine';
import { didUserWinCup, getUserCupResultLabel } from './cupEngine';
import { ACTIVE_PLAYERS, getLeagueById, LEGEND_PLAYERS } from './dataLoader';
import { USER_CLUB_ID } from './matchEngine';
import { getUserRank } from './standingsEngine';
import { didUserWinUcl, getUserUclResultLabel } from './uclEngine';

export const LEGACY_STORAGE_KEY = 'pitch_manager_legacy_v1';

export function createEmptyLegacyState(): LegacyStorageState {
  return {
    version: 1,
    hallOfFame: [],
    unlockedAchievements: {},
    dreamMatchRecords: {},
  };
}

export function loadLegacyState(): LegacyStorageState {
  if (typeof window === 'undefined') return createEmptyLegacyState();
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return createEmptyLegacyState();
    const parsed = JSON.parse(raw) as Partial<LegacyStorageState>;
    const hallOfFame = Array.isArray(parsed.hallOfFame)
      ? parsed.hallOfFame.map((entry) => ({
          ...entry,
          finalLeagueRank:
            typeof entry.finalLeagueRank === 'number' &&
            entry.finalLeagueRank >= 1
              ? entry.finalLeagueRank
              : 1,
        }))
      : [];
    return {
      version: 1,
      hallOfFame,
      unlockedAchievements:
        parsed.unlockedAchievements &&
        typeof parsed.unlockedAchievements === 'object'
          ? parsed.unlockedAchievements
          : {},
      dreamMatchRecords:
        parsed.dreamMatchRecords &&
        typeof parsed.dreamMatchRecords === 'object'
          ? parsed.dreamMatchRecords
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

export const AWARD_SCORE_WEIGHTS = {
  ballonDor: 350,
  worldBestXiPerPlayer: 90,
  leagueMvp: 150,
  leagueBestXiPerPlayer: 45,
} as const;

export interface SeasonScoreInput {
  leaguePoints: number;
  leaguePlayed: number;
  leagueGoalDifference: number;
  leagueLosses: number;
  leagueGoalsFor?: number;
  leagueGoalsAgainst?: number;
  finalLeagueRank: number;
  cup: DomesticCupState | null;
  ucl: UclTournamentState | null;
  uclPerfectWin?: boolean;
  uclUnbeatenWin?: boolean;
  teamAvgOvr: number;
  benchAvgOvr?: number;
  chemistry?: number;
  avgSynergyOvrBonus?: number;
  managerSynergyCount?: number;
  managerRating?: number;
  tacticalFit?: number;
  awards?: SeasonAwards | null;
  globalAwards?: GlobalSeasonAwards | null;
  userClubId?: string;
}

/**
 * Evaluates a user manager's seasonal managerial rating (80..99) on the exact same scale
 * as historical legendary managers (91..99), based on trophies, unbeaten runs, chemistry & synergy.
 */
export function computeUserSeasonManagerRating(params: {
  finalLeagueRank: number;
  wonCup: boolean;
  wonUcl: boolean;
  leagueLosses: number;
  leaguePlayed: number;
  converted38Points: number;
  chemistry: number;
  managerSynergyCount: number;
}): number {
  let rating = 80;
  if (params.finalLeagueRank === 1) rating += 6;
  else if (params.finalLeagueRank === 2) rating += 3;
  else if (params.finalLeagueRank <= 4) rating += 2;
  if (params.wonCup) rating += 2;
  if (params.wonUcl) rating += 5;
  if (params.finalLeagueRank === 1 && params.leagueLosses === 0 && params.leaguePlayed >= 34) {
    rating += 3;
  }
  if (params.converted38Points >= 98) rating += 2;
  else if (params.converted38Points >= 90) rating += 1;
  if (params.chemistry >= 90) rating += 2;
  else if (params.chemistry >= 80) rating += 1;
  if (params.managerSynergyCount >= 7) rating += 2;
  else if (params.managerSynergyCount >= 4) rating += 1;
  return Math.max(80, Math.min(99, rating));
}

/**
 * Computes a fair cross-league Season Score normalizing 34-round (Bundesliga / Ligue 1)
 * and 38-round (EPL / La Liga / Serie A) leagues via PPG * 38, plus capped historic milestone bonuses,
 * squad OVR/chemistry/manager synergy/tactical-fit craft bonuses, and capped individual awards bonuses.
 * Identical formula is applied to BOTH User Teams and Historical Benchmark Teams with zero team-specific overrides.
 */
export function computeSeasonScore(
  input: SeasonScoreInput,
): SeasonScoreBreakdown {
  const {
    leaguePoints,
    leaguePlayed,
    leagueGoalDifference,
    leagueLosses,
    leagueGoalsFor,
    leagueGoalsAgainst,
    finalLeagueRank,
    cup,
    ucl,
    uclPerfectWin = false,
    uclUnbeatenWin = false,
    teamAvgOvr,
    benchAvgOvr,
    chemistry,
    avgSynergyOvrBonus,
    managerSynergyCount,
    managerRating,
    tacticalFit,
    awards = null,
    globalAwards = null,
    userClubId = USER_CLUB_ID,
  } = input;

  const safePlayed = Math.max(1, leaguePlayed);
  const ppg = leaguePoints / safePlayed;
  const converted38Points = ppg * 38;
  const gdNormalized = (leagueGoalDifference / safePlayed) * 38;
  // Gentle diminishing returns above 95 converted pts so 34R extrapolation stays balanced with 38R
  const ptsBase =
    Math.min(95, converted38Points) * 24 +
    Math.max(0, converted38Points - 95) * 12;
  const leagueConvertedScore = Math.max(
    0,
    Math.round(ptsBase + Math.max(-150, Math.min(360, gdNormalized * 3.6))),
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

  // 36-Team UEFA Champions League Bonus (only when user actually participated)
  let uclBonus = 0;
  if (ucl && ucl.userParticipated !== false) {
    if (ucl.championTeamId === userClubId) uclBonus = 2500;
    else if (ucl.userEliminatedAt === 'final') uclBonus = 1500;
    else if (ucl.userEliminatedAt === 'sf') uclBonus = 950;
    else if (ucl.userEliminatedAt === 'qf') uclBonus = 620;
    else if (ucl.userEliminatedAt === 'r16') uclBonus = 360;
    else if (ucl.userEliminatedAt === 'playoff') uclBonus = 180;
    else if (ucl.userEliminatedAt === 'league_phase') uclBonus = 60;
  }

  // Honors & Historic Milestones Bonus (38R-normalized, capped at 2,750)
  const wonLeague = finalLeagueRank === 1;
  const wonCup = didUserWinCup(cup, userClubId);
  const wonUcl = didUserWinUcl(ucl, userClubId);
  const trophyCount = (wonLeague ? 1 : 0) + (wonCup ? 1 : 0) + (wonUcl ? 1 : 0);

  let honorsBonus = 0;
  const honorsBonusDetails: string[] = [];
  if (trophyCount === 3) {
    honorsBonus += 1600;
    honorsBonusDetails.push('트레블 +1,600');
  } else if (trophyCount === 2) {
    honorsBonus += 600;
    honorsBonusDetails.push('더블 +600');
  }
  if (wonLeague && leagueLosses === 0 && leaguePlayed >= 34) {
    honorsBonus += 800;
    honorsBonusDetails.push('리그 무패 우승 +800');
  }
  if (wonLeague && leaguePlayed >= 34) {
    if (converted38Points >= 100) {
      honorsBonus += 360;
      honorsBonusDetails.push('센추리온즈(환산 100점+) +360');
    } else if (converted38Points >= 95) {
      honorsBonus += 180;
      honorsBonusDetails.push('압도적 우승(환산 95점+) +180');
    }
  }
  if (typeof leagueGoalsFor === 'number' && leaguePlayed >= 34) {
    const gf38 = (leagueGoalsFor / safePlayed) * 38;
    if (gf38 >= 100) {
      honorsBonus += 180;
      honorsBonusDetails.push('역사적 화력(환산 100득점+) +180');
    }
  }
  if (wonLeague && typeof leagueGoalsAgainst === 'number' && leaguePlayed >= 34) {
    const ga38 = (leagueGoalsAgainst / safePlayed) * 38;
    if (ga38 <= 18) {
      honorsBonus += 400;
      honorsBonusDetails.push('철벽 수비(환산 18실점 이하) +400');
    } else if (ga38 <= 22) {
      honorsBonus += 160;
      honorsBonusDetails.push('최소 실점급(환산 22실점 이하) +160');
    }
  }
  if (wonUcl) {
    if (uclPerfectWin) {
      honorsBonus += 900;
      honorsBonusDetails.push('UCL 전승 우승 +900');
    } else if (uclUnbeatenWin) {
      honorsBonus += 320;
      honorsBonusDetails.push('UCL 무패 우승 +320');
    }
  }
  honorsBonus = Math.min(2750, honorsBonus);

  // Underdog Bonus (lower avg OVR achieving Top 4 / Title / UCL deep run)
  let underdogBonus = 0;
  if (teamAvgOvr < 85 && (finalLeagueRank <= 4 || wonCup || wonUcl)) {
    const ovrGap = Math.max(0, 85 - teamAvgOvr);
    const achievementMult =
      wonUcl || wonLeague ? 145 : finalLeagueRank <= 4 ? 55 : 35;
    const baseUnderdog = Math.round(ovrGap * achievementMult);
    const miracleBonus =
      (wonUcl || wonLeague) && teamAvgOvr <= 82
        ? Math.round((82 - teamAvgOvr) * 220)
        : 0;
    underdogBonus = Math.min(1750, baseUnderdog + miracleBonus);
  }

  // Squad Craft, Synergy & Tactical Fit Bonus (pure linear with clean caps, max 5,940)
  let squadCraftBonus = 0;
  const squadCraftDetails: string[] = [];
  const chemOvrBonus =
    typeof chemistry === 'number'
      ? Math.max(-1.5, Math.min(2.5, (chemistry - 50) * 0.05))
      : 0;
  const effectiveStarterOvr =
    teamAvgOvr + (avgSynergyOvrBonus ?? 0) + chemOvrBonus;
  const effectiveBenchOvr =
    typeof benchAvgOvr === 'number'
      ? benchAvgOvr
      : Math.max(0, teamAvgOvr - 5);

  const ovrPts = Math.max(
    0,
    Math.min(
      3400,
      Math.round(
        Math.max(0, teamAvgOvr - 80) * 165 +
          Math.max(0, effectiveStarterOvr - 82) * 105,
      ),
    ),
  );
  if (ovrPts > 0) {
    squadCraftBonus += ovrPts;
    squadCraftDetails.push(
      `선발 전력 OVR ${teamAvgOvr.toFixed(1)} → 실효 ${effectiveStarterOvr.toFixed(1)} +${ovrPts}`,
    );
  }
  const benchPts = Math.max(
    0,
    Math.min(500, Math.round(Math.max(0, effectiveBenchOvr - 76) * 50)),
  );
  if (benchPts > 0) {
    squadCraftBonus += benchPts;
    squadCraftDetails.push(
      `스쿼드 뎁스(벤치 ${effectiveBenchOvr.toFixed(1)}) +${benchPts}`,
    );
  }
  if (typeof managerRating === 'number' && managerRating > 82) {
    const mgrPts = Math.max(
      0,
      Math.min(420, Math.round((managerRating - 82) * 24)),
    );
    if (mgrPts > 0) {
      squadCraftBonus += mgrPts;
      squadCraftDetails.push(`감독 역량 ${Math.round(managerRating)} +${mgrPts}`);
    }
  }
  if (typeof managerSynergyCount === 'number') {
    const clampedMgrCount = Math.min(11, Math.max(0, managerSynergyCount));
    const mgrSynPts = Math.round((clampedMgrCount / 11) * 520);
    if (mgrSynPts > 0) {
      squadCraftBonus += mgrSynPts;
      squadCraftDetails.push(
        `감독-선수 시너지 ${clampedMgrCount}/11명 +${mgrSynPts}`,
      );
    }
  }
  if (typeof chemistry === 'number' && chemistry > 55) {
    const chemPts = Math.max(
      0,
      Math.min(440, Math.round((chemistry - 55) * 9.8)),
    );
    if (chemPts > 0) {
      squadCraftBonus += chemPts;
      squadCraftDetails.push(`팀 케미 ${Math.round(chemistry)} +${chemPts}`);
    }
  }
  if (typeof tacticalFit === 'number' && tacticalFit > 65) {
    const tacPts = Math.max(
      0,
      Math.min(680, Math.round((tacticalFit - 65) * 22.5)),
    );
    if (tacPts > 0) {
      squadCraftBonus += tacPts;
      squadCraftDetails.push(`전술 이행도 ${Math.round(tacticalFit)}% +${tacPts}`);
    }
  }

  // Individual Awards Bonus (capped at 1,100 so single-player awards support rather than dominate team honors)
  let awardsBonus = 0;
  const awardsBonusDetails: string[] = [];

  if (globalAwards?.ballonDorWinner?.stats.teamId === userClubId) {
    awardsBonus += AWARD_SCORE_WEIGHTS.ballonDor;
    awardsBonusDetails.push(
      `발롱도르 수상 (${globalAwards.ballonDorWinner.stats.playerName}) +${AWARD_SCORE_WEIGHTS.ballonDor}`,
    );
  }
  if (globalAwards?.worldBestXi) {
    const worldXiUserCount = globalAwards.worldBestXi.filter(
      (x) => x.stats.teamId === userClubId,
    ).length;
    if (worldXiUserCount > 0) {
      const pts = worldXiUserCount * AWARD_SCORE_WEIGHTS.worldBestXiPerPlayer;
      awardsBonus += pts;
      awardsBonusDetails.push(`월드베스트 XI ${worldXiUserCount}명 +${pts}`);
    }
  }
  if (awards?.poty?.teamId === userClubId) {
    awardsBonus += AWARD_SCORE_WEIGHTS.leagueMvp;
    awardsBonusDetails.push(
      `리그 MVP (${awards.poty.playerName}) +${AWARD_SCORE_WEIGHTS.leagueMvp}`,
    );
  }
  if (awards?.bestXi) {
    const leagueXiUserCount = awards.bestXi.filter(
      (x) => x.stats.teamId === userClubId,
    ).length;
    if (leagueXiUserCount > 0) {
      const pts = leagueXiUserCount * AWARD_SCORE_WEIGHTS.leagueBestXiPerPlayer;
      awardsBonus += pts;
      awardsBonusDetails.push(`리그 베스트 11 ${leagueXiUserCount}명 +${pts}`);
    }
  }
  awardsBonus = Math.min(1100, awardsBonus);

  const totalScore =
    leagueConvertedScore +
    leagueRankBonus +
    cupBonus +
    uclBonus +
    honorsBonus +
    underdogBonus +
    squadCraftBonus +
    awardsBonus;

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
    honorsBonusDetails,
    underdogBonus,
    squadCraftBonus,
    squadCraftDetails,
    awardsBonus,
    awardsBonusDetails,
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

  // 11-13: Europe (UCL) — only when user actually participated
  if (ucl && ucl.userParticipated !== false) {
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

export function buildCompactMatchHistory(params: {
  leagueMatches: MatchResult[];
  cupMatches: MatchResult[];
  uclMatches: MatchResult[];
  clubNameById: Record<string, string>;
  userClubId?: string;
}): HallOfFameMatchSummary[] {
  const userClubId = params.userClubId ?? USER_CLUB_ID;
  const convert = (
    m: MatchResult,
    fallbackComp: 'league' | 'cup' | 'ucl',
  ): HallOfFameMatchSummary => {
    const comp = m.competition ?? fallbackComp;
    const isHome = m.homeTeamId === userClubId;
    const oppId = isHome ? m.awayTeamId : m.homeTeamId;
    const userGoals = isHome ? m.homeGoals : m.awayGoals;
    const oppGoals = isHome ? m.awayGoals : m.homeGoals;
    let outcome: 'W' | 'D' | 'L' =
      userGoals > oppGoals ? 'W' : userGoals < oppGoals ? 'L' : 'D';
    let note: string | undefined;
    if (m.extraTime?.penalties) {
      const penWon = m.extraTime.penalties.winnerTeamId === userClubId;
      outcome = penWon ? 'W' : 'L';
      const uPen = isHome
        ? m.extraTime.penalties.homePenGoals
        : m.extraTime.penalties.awayPenGoals;
      const oPen = isHome
        ? m.extraTime.penalties.awayPenGoals
        : m.extraTime.penalties.homePenGoals;
      note = `PK ${uPen}-${oPen}`;
    } else if (m.extraTime) {
      note = '연장';
    }
    const allEvents = [
      ...m.events,
      ...(m.extraTime?.etEvents ?? []),
    ];
    const scorers = allEvents
      .filter((e) => e.type === 'goal' && e.teamId === userClubId && e.scorerName)
      .map((e) => `${e.scorerName} ${e.minute}'`);

    return {
      competition: comp,
      label: m.competitionLabel ?? (comp === 'league' ? `리그 ${m.round}R` : comp === 'cup' ? '자국 컵' : 'UCL'),
      opponentName: params.clubNameById[oppId] ?? oppId,
      isHome,
      userGoals,
      oppGoals,
      outcome,
      scorers,
      note,
    };
  };

  return [
    ...params.leagueMatches.map((m) => convert(m, 'league')),
    ...params.cupMatches.map((m) => convert(m, 'cup')),
    ...params.uclMatches.map((m) => convert(m, 'ucl')),
  ];
}

export function generateSeasonRunId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `run-${crypto.randomUUID()}`;
  }
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function archiveSeasonToHallOfFame(params: {
  runId?: string;
  userClub: UserClubProfile;
  managerName?: string;
  managerAvatar?: ManagerAvatarConfig;
  managerTraitId: ManagerTraitId | null;
  managerRating?: number;
  leagueId: LeagueId;
  formation: FormationId;
  defaultTactic: TacticId;
  standings: StandingRow[];
  totalRounds: number;
  cup: DomesticCupState | null;
  ucl: UclTournamentState | null;
  teamAvgOvr: number;
  chemistry: number;
  avgSynergyOvrBonus?: number;
  managerSynergyCount?: number;
  seasonScore: SeasonScoreBreakdown;
  awards?: SeasonAwards | null;
  globalAwards?: GlobalSeasonAwards | null;
  matchHistory?: HallOfFameMatchSummary[];
  starters: (Player | null)[];
  bench: (Player | null)[];
  combinedPlayerStats: Record<string, PlayerSeasonStats>;
  unlockedAchievementIds: string[];
  userClubId?: string;
}): LegacyStorageState {
  const {
    runId,
    userClub,
    managerName,
    managerAvatar,
    managerTraitId,
    managerRating,
    leagueId,
    formation,
    defaultTactic,
    standings,
    totalRounds,
    cup,
    ucl,
    teamAvgOvr,
    chemistry,
    avgSynergyOvrBonus,
    managerSynergyCount,
    seasonScore,
    awards = null,
    globalAwards = null,
    matchHistory,
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
    const st = combinedPlayerStats[p.id] ?? combinedPlayerStats[`user::${p.id}`];
    return buildHallOfFameMember(
      p,
      st?.goals ?? 0,
      st?.assists ?? 0,
      st?.avgRating ?? 0,
    );
  };

  const fullStarters = starters
    .filter((p): p is Player => p !== null)
    .map((p) => ({ ...p, attrs: getPlayerAttributes(p) }));
  const fullBench = bench
    .filter((p): p is Player => p !== null)
    .map((p) => ({ ...p, attrs: getPlayerAttributes(p) }));

  const starterMembers = fullStarters.map(toMember);
  const benchMembers = fullBench.map(toMember);

  const topScorer = [...starterMembers, ...benchMembers].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists,
  )[0];

  const ballonWinner = globalAwards?.ballonDorWinner ?? null;
  const worldBestXiUserCount = globalAwards
    ? globalAwards.worldBestXi.filter((x) => x.stats.teamId === userClubId).length
    : undefined;
  const leagueBestXiUserCount = awards
    ? awards.bestXi.filter((x) => x.stats.teamId === userClubId).length
    : undefined;

  const generatedId = `hof-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const effectiveRunId = runId?.trim() || generatedId;

  const current = loadLegacyState();
  if (current.hallOfFame.some((e) => (e.runId ?? e.id) === effectiveRunId)) {
    return current;
  }

  const entry: HallOfFameEntry = {
    id: generatedId,
    runId: effectiveRunId,
    completedAt: new Date().toISOString(),
    userClub: { ...userClub },
    managerName,
    managerAvatar: managerAvatar ? { ...managerAvatar } : undefined,
    managerTraitId,
    managerRating,
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
    avgSynergyOvrBonus:
      typeof avgSynergyOvrBonus === 'number'
        ? Math.round(avgSynergyOvrBonus * 100) / 100
        : undefined,
    managerSynergyCount,
    seasonScore,
    trophies,
    topScorerSummary: topScorer
      ? `${topScorer.name} (${topScorer.goals}골 ${topScorer.assists}도움)`
      : '-',
    ballonDorWinnerName: ballonWinner?.stats.playerName,
    ballonDorWinnerClub: ballonWinner?.stats.teamName,
    ballonDorIsUser: ballonWinner ? ballonWinner.stats.teamId === userClubId : undefined,
    worldBestXiUserCount,
    leagueBestXiUserCount,
    matchHistory,
    starters: starterMembers,
    bench: benchMembers,
    fullStarters,
    fullBench,
    unlockedAchievementIds,
  };

  const nextHallOfFame = [entry, ...current.hallOfFame].slice(0, 50);
  const updated: LegacyStorageState = {
    ...current,
    hallOfFame: nextHallOfFame,
  };
  saveLegacyState(updated);
  return updated;
}

/**
 * Minimum season score to automatically enter the Hall of Fame (comparable to
 * the lowest Historical Benchmark team: 15-16 Leicester City at 6,513 pts, below S+ 7,200).
 * Seasons below this threshold can still be manually inducted from Season Summary.
 */
export const HOF_AUTO_INDUCTION_MIN_SCORE = 6500;

export function isEligibleForAutoHofInduction(params: {
  seasonScore: SeasonScoreBreakdown;
  wonUcl: boolean;
  isTreble: boolean;
}): boolean {
  const { seasonScore, wonUcl, isTreble } = params;
  return (
    seasonScore.totalScore >= HOF_AUTO_INDUCTION_MIN_SCORE ||
    seasonScore.grade === 'S+' ||
    wonUcl ||
    isTreble
  );
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

export function recordDreamMatchResult(params: {
  historicalTeamId: string;
  outcome: 'W' | 'D' | 'L';
  scoreLabel: string;
}): LegacyStorageState {
  const current = loadLegacyState();
  const prevRecords = current.dreamMatchRecords ?? {};
  const existing: DreamMatchRecord = prevRecords[params.historicalTeamId] ?? {
    historicalTeamId: params.historicalTeamId,
    wins: 0,
    losses: 0,
    draws: 0,
    lastPlayedAt: new Date().toISOString(),
  };

  const nextRec: DreamMatchRecord = {
    ...existing,
    wins: existing.wins + (params.outcome === 'W' ? 1 : 0),
    losses: existing.losses + (params.outcome === 'L' ? 1 : 0),
    draws: existing.draws + (params.outcome === 'D' ? 1 : 0),
    bestResultLabel:
      params.outcome === 'W' || !existing.bestResultLabel
        ? params.scoreLabel
        : existing.bestResultLabel,
    lastPlayedAt: new Date().toISOString(),
  };

  const updated: LegacyStorageState = {
    ...current,
    dreamMatchRecords: {
      ...prevRecords,
      [params.historicalTeamId]: nextRec,
    },
  };
  saveLegacyState(updated);
  return updated;
}

const VALID_POSITIONS = new Set<Position>(['GK', 'DF', 'MF', 'FW']);
const VALID_SUB_POSITIONS = new Set<SubPosition>([
  'GK', 'LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST',
]);

function rebuildPlayerFromLegacyMember(
  m: HallOfFameSquadMember,
  leagueId: LeagueId,
  clubName: string,
): Player {
  const byId =
    LEGEND_PLAYERS.find((p) => p.id === m.id) ??
    ACTIVE_PLAYERS.find((p) => p.id === m.id);
  if (byId) {
    return { ...byId, attrs: getPlayerAttributes(byId) };
  }
  const byName =
    LEGEND_PLAYERS.find((p) => p.name === m.name) ??
    ACTIVE_PLAYERS.find((p) => p.name === m.name);
  if (byName) {
    return { ...byName, attrs: getPlayerAttributes(byName) };
  }

  const pos: Position = VALID_POSITIONS.has(m.position as Position)
    ? (m.position as Position)
    : 'MF';
  const mainPositions: SubPosition[] = m.mainPositions.filter((sp): sp is SubPosition =>
    VALID_SUB_POSITIONS.has(sp as SubPosition),
  );
  if (mainPositions.length === 0) {
    mainPositions.push(pos === 'GK' ? 'GK' : pos === 'DF' ? 'CB' : pos === 'FW' ? 'ST' : 'CM');
  }

  const ovr = Math.max(65, Math.min(99, m.ovr || 82));
  const synthetic: Player = {
    id: m.id,
    name: m.name,
    position: pos,
    mainPositions,
    secondaryPositions: [],
    ovr,
    nationality: '유럽',
    nationalityCode: 'EU',
    leagueId: m.isLegend ? 'LEGEND' : leagueId,
    club: clubName,
    att: pos === 'FW' ? ovr + 1 : pos === 'MF' ? ovr - 3 : Math.max(45, ovr - 18),
    mid: pos === 'MF' ? ovr + 1 : pos === 'GK' ? Math.max(45, ovr - 16) : ovr - 5,
    def: pos === 'DF' || pos === 'GK' ? ovr + 1 : pos === 'MF' ? ovr - 5 : Math.max(40, ovr - 28),
    stamina: 84,
    playstyles:
      pos === 'GK'
        ? ['shot_stopper']
        : pos === 'DF'
          ? ['stopper_cb']
          : pos === 'FW'
            ? ['complete_forward']
            : ['box_to_box'],
    scoutNote: '명예의 전당 레거시 스쿼드 복원 선수',
    isLegend: m.isLegend,
  };
  return { ...synthetic, attrs: getPlayerAttributes(synthetic) };
}

/**
 * Reconstructs a playable 11-starter + 5-bench squad from any HallOfFameEntry,
 * supporting both v4.1+ full snapshots and older pre-v4.1 saved legacy entries.
 */
export function reconstructHallOfFameSquad(entry: HallOfFameEntry): {
  starters: (Player | null)[];
  bench: (Player | null)[];
  usedLegacyFallback: boolean;
} {
  if (
    Array.isArray(entry.fullStarters) &&
    entry.fullStarters.length >= 11
  ) {
    const starters: (Player | null)[] = entry.fullStarters
      .slice(0, 11)
      .map((p) => ({ ...p, attrs: getPlayerAttributes(p) }));
    const rawBench = (entry.fullBench ?? []).map((p) => ({
      ...p,
      attrs: getPlayerAttributes(p),
    }));
    const bench: (Player | null)[] = Array.from(
      { length: 5 },
      (_, idx) => rawBench[idx] ?? null,
    );
    return { starters, bench, usedLegacyFallback: false };
  }

  const rebuiltStarters = entry.starters
    .slice(0, 11)
    .map((m) => rebuildPlayerFromLegacyMember(m, entry.leagueId, entry.userClub.name));
  while (rebuiltStarters.length < 11) {
    const fallbackPool = ACTIVE_PLAYERS.find(
      (p) => !rebuiltStarters.some((s) => s.id === p.id),
    );
    if (!fallbackPool) break;
    rebuiltStarters.push({ ...fallbackPool, attrs: getPlayerAttributes(fallbackPool) });
  }

  const rebuiltBenchRaw = entry.bench
    .slice(0, 5)
    .map((m) => rebuildPlayerFromLegacyMember(m, entry.leagueId, entry.userClub.name));
  const bench: (Player | null)[] = Array.from(
    { length: 5 },
    (_, idx) => rebuiltBenchRaw[idx] ?? null,
  );

  return {
    starters: rebuiltStarters.slice(0, 11),
    bench,
    usedLegacyFallback: true,
  };
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

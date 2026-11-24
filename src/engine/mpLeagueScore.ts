import { compareScoreWithHistoricalTeams } from '../data/historicalTeams';
import { evaluateManagerPlayerSynergy } from '../data/managerTraits';
import type { CupStageId, DomesticCupState } from '../types/cup';
import type { PlayerSeasonStats } from '../types/league';
import type { SeasonScoreBreakdown } from '../types/legacy';
import type {
  MpFriendRankRow,
  MpH2HRecord,
  MpHumanSeasonState,
  MpLeagueHostState,
  MpLeagueHuman,
  MpLiteMatch,
  MpSquadInput,
} from '../types/mpLeague';
import type { UclKnockoutStage, UclPhaseStage, UclTournamentState } from '../types/ucl';
import { mergePlayerStatsMaps } from './analyticsEngine';
import { computeGlobalSeasonAwards } from './awardsEngine';
import { calculateChemistry, calculateTeamRatings } from './chemistryEngine';
import { getUserCupResultLabel } from './cupEngine';
import { computeSeasonScore, computeUserSeasonManagerRating } from './legacyEngine';
import { evaluateTeamTacticalProfile } from './unifiedTacticsEngine';
import { getUserUclResultLabel } from './uclEngine';

/** Maximum friend-leaderboard points a manager can earn from head-to-head matches. */
export const MP_H2H_MAX_POINTS = 1500;

const CUP_STAGES: CupStageId[] = ['r16', 'qf', 'sf', 'final'];
const UCL_KO_STAGES: UclKnockoutStage[] = ['playoff', 'r16', 'qf', 'sf', 'final'];

/**
 * Head-to-head points: (3 per win + 1 per draw) / (3 x matches played) scaled to 1,500,
 * so the weight is identical whether 2, 3 or 4 friends play.
 */
export function computeMpH2HPoints(record: MpH2HRecord): number {
  if (record.played <= 0) return 0;
  const earned = record.won * 3 + record.drawn;
  return Math.round((earned / (record.played * 3)) * MP_H2H_MAX_POINTS);
}

/** Per-friend view of the shared cup bracket (fills the single-user `userEliminatedAt` field). */
export function buildCupViewForClub(
  cup: DomesticCupState | null,
  clubId: string,
): DomesticCupState | null {
  if (!cup) return null;
  let eliminatedAt: CupStageId | null = null;
  for (const stage of CUP_STAGES) {
    const node = cup.rounds[stage].find(
      (n) => n.played && (n.homeTeamId === clubId || n.awayTeamId === clubId),
    );
    if (node && node.winnerId && node.winnerId !== clubId) {
      eliminatedAt = stage;
      break;
    }
  }
  return { ...cup, userEliminatedAt: eliminatedAt };
}

/** Per-friend view of the shared UCL state (participation flag, league phase rank, exit stage). */
export function buildUclViewForClub(
  ucl: UclTournamentState | null,
  clubId: string,
  participated: boolean,
): UclTournamentState | null {
  if (!ucl) return null;
  if (!participated) return { ...ucl, userParticipated: false };
  const rankIdx = ucl.standings.findIndex((r) => r.teamId === clubId);
  const rank = rankIdx === -1 ? null : rankIdx + 1;
  const lpDone = ucl.leaguePhaseRound >= 8;
  let eliminatedAt: UclPhaseStage | null = null;
  if (lpDone && rank !== null && rank >= 25) {
    eliminatedAt = 'league_phase';
  } else {
    for (const stage of UCL_KO_STAGES) {
      const tie = ucl.ties[stage].find(
        (t) => t.teamAId === clubId || t.teamBId === clubId,
      );
      if (tie && tie.winnerId && tie.winnerId !== clubId) {
        eliminatedAt = stage;
        break;
      }
    }
  }
  return {
    ...ucl,
    userParticipated: true,
    userLeaguePhaseRank: lpDone ? rank : null,
    enteredViaPlayoff: Boolean(lpDone && rank !== null && rank >= 9 && rank <= 24),
    userEliminatedAt: eliminatedAt,
  };
}

function uclRunFlags(
  history: MpLiteMatch[],
  clubId: string,
  wonUcl: boolean,
): { unbeaten: boolean; perfect: boolean } {
  if (!wonUcl || history.length === 0) return { unbeaten: false, perfect: false };
  const unbeaten = history.every((m) => {
    const isHome = m.homeTeamId === clubId;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    if (m.penalties) return m.etWinnerId === clubId;
    return gf >= ga;
  });
  const perfect =
    history.length >= 8 &&
    history.every((m) => {
      const isHome = m.homeTeamId === clubId;
      return (isHome ? m.homeGoals : m.awayGoals) > (isHome ? m.awayGoals : m.homeGoals);
    });
  return { unbeaten, perfect };
}

/**
 * The exact single-player / Hall of Fame season score for one friend's club.
 * Head-to-head points are deliberately NOT part of this number.
 */
export function computeMpHumanSeasonScore(params: {
  state: MpLeagueHostState;
  human: MpLeagueHuman;
  squad: MpSquadInput;
  humanSeason: MpHumanSeasonState;
}): SeasonScoreBreakdown {
  const { state, human, squad, humanSeason } = params;
  const clubId = human.clubId;
  const chem = calculateChemistry(
    squad.formation,
    squad.starters,
    squad.tactic,
    human.managerTraitId,
  );
  const ratings = calculateTeamRatings(
    squad.formation,
    squad.starters,
    chem.total,
    human.managerTraitId,
    chem.slotSynergies,
    squad.tactic,
  );
  const rowIdx = state.standings.findIndex((r) => r.teamId === clubId);
  const row = rowIdx === -1 ? null : state.standings[rowIdx];
  const finalRank = rowIdx === -1 ? state.standings.length : rowIdx + 1;
  const played = Math.max(1, row?.played ?? state.totalRounds);
  const converted38Points = ((row?.points ?? 0) / played) * 38;

  const synValues = Object.values(chem.slotSynergies);
  const avgSynergyOvrBonus =
    synValues.length > 0
      ? Math.round(
          (synValues.reduce((sum, s) => sum + s.totalBonus, 0) / synValues.length) * 100,
        ) / 100
      : 0;
  const managerSynergyCount = squad.starters.filter(
    (p) => evaluateManagerPlayerSynergy(p, human.managerTraitId).isMatch,
  ).length;

  const cupView = buildCupViewForClub(state.cup, clubId);
  const uclView = buildUclViewForClub(
    state.ucl,
    clubId,
    state.uclHumanClubIds.includes(clubId),
  );
  const wonCup = Boolean(cupView && cupView.championTeamId === clubId);
  const wonUcl = Boolean(
    uclView && uclView.userParticipated !== false && uclView.championTeamId === clubId,
  );
  const run = uclRunFlags(humanSeason.uclHistory, clubId, wonUcl);

  const managerRating = computeUserSeasonManagerRating({
    finalLeagueRank: finalRank,
    wonCup,
    wonUcl,
    leagueLosses: row?.lost ?? 0,
    leaguePlayed: played,
    converted38Points,
    chemistry: chem.total,
    managerSynergyCount,
  });

  const benchAvgOvr =
    squad.bench.length > 0
      ? Math.round(
          (squad.bench.reduce((sum, p) => sum + p.ovr, 0) / squad.bench.length) * 10,
        ) / 10
      : undefined;

  const tacticalFit =
    squad.starters.length > 0
      ? evaluateTeamTacticalProfile({
          starters: squad.starters,
          formation: squad.formation,
          tactic: squad.tactic,
          managerTraitId: human.managerTraitId,
          managerOvr: managerRating,
        }).tacticalFit
      : undefined;

  return computeSeasonScore({
    leaguePoints: row?.points ?? 0,
    leaguePlayed: played,
    leagueGoalDifference: row?.goalDifference ?? 0,
    leagueLosses: row?.lost ?? 0,
    leagueGoalsFor: row?.goalsFor,
    leagueGoalsAgainst: row?.goalsAgainst,
    finalLeagueRank: finalRank,
    cup: cupView,
    ucl: uclView,
    uclPerfectWin: run.perfect,
    uclUnbeatenWin: run.unbeaten,
    teamAvgOvr: ratings.rawOvr,
    benchAvgOvr,
    chemistry: chem.total,
    avgSynergyOvrBonus,
    managerSynergyCount,
    managerRating,
    tacticalFit,
    awards: state.awards,
    globalAwards: state.globalAwards,
    userClubId: clubId,
  });
}

/**
 * Builds the two final boards:
 *  1) friends leaderboard = existing season score + head-to-head points
 *  2) historical benchmark = existing season score only (no head-to-head)
 */
export function buildMpFriendRanking(
  state: MpLeagueHostState,
  squads: Record<string, MpSquadInput>,
): MpFriendRankRow[] {
  const rows: MpFriendRankRow[] = [];
  for (const human of state.humans) {
    const squad = squads[human.clubId];
    const hs = state.perHuman[human.clubId];
    if (!squad || !hs) continue;
    const seasonScore = computeMpHumanSeasonScore({
      state,
      human,
      squad,
      humanSeason: hs,
    });
    const h2hPoints = computeMpH2HPoints(hs.h2h);
    const rowIdx = state.standings.findIndex((r) => r.teamId === human.clubId);
    const historical = compareScoreWithHistoricalTeams(seasonScore.totalScore);
    rows.push({
      clubId: human.clubId,
      playerId: human.playerId,
      rank: 0,
      seasonScore,
      h2hPoints,
      h2h: hs.h2h,
      total: seasonScore.totalScore + h2hPoints,
      leagueRank: rowIdx === -1 ? state.standings.length : rowIdx + 1,
      leaguePoints: rowIdx === -1 ? 0 : state.standings[rowIdx].points,
      cupLabel: getUserCupResultLabel(
        buildCupViewForClub(state.cup, human.clubId),
        human.clubId,
      ),
      uclLabel: getUserUclResultLabel(
        buildUclViewForClub(
          state.ucl,
          human.clubId,
          state.uclHumanClubIds.includes(human.clubId),
        ),
        human.clubId,
      ),
      historicalRank: historical.rankAmongAll,
      historicalTotal: historical.totalTeams,
    });
  }
  rows.sort(
    (a, b) =>
      b.total - a.total || b.h2hPoints - a.h2hPoints || a.leagueRank - b.leagueRank,
  );
  return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
}

export function finalizeMpLeagueSeason(
  state: MpLeagueHostState,
  squads: Record<string, MpSquadInput>,
): MpLeagueHostState {
  const excludeIds = new Set<string>(state.departedIds);
  for (const squad of Object.values(squads)) {
    for (const p of [...squad.starters, ...squad.bench]) excludeIds.add(p.id);
  }
  const globalAwards = computeGlobalSeasonAwards({
    allLeaguePlayerStats: state.allPlayerStats,
    cupPlayerStats: state.cupPlayerStats,
    uclPlayerStats: state.uclPlayerStats,
    leagueStandings: state.standings,
    cup: state.cup,
    ucl: state.ucl,
    otherLeagues: state.otherLeagues,
    userLeagueId: state.settings.leagueId,
    userClubId: 'mp-league-no-user',
    excludeIds,
  });
  const withAwards: MpLeagueHostState = { ...state, globalAwards };
  const rows = buildMpFriendRanking(withAwards, squads);
  const combinedStats = mergePlayerStatsMaps(
    state.allPlayerStats,
    state.cupPlayerStats,
    state.uclPlayerStats,
  );
  const squadStats: Record<string, PlayerSeasonStats[]> = {};
  for (const h of state.humans) {
    const sq = squads[h.clubId];
    squadStats[h.clubId] = sq
      ? [...sq.starters, ...sq.bench]
          .map((p) => combinedStats[p.id])
          .filter((x): x is PlayerSeasonStats => Boolean(x))
      : [];
  }
  return {
    ...withAwards,
    stage: 'final',
    flow: { kind: 'done' },
    todo: [],
    cast: null,
    h2hLive: null,
    final: {
      rows,
      awards: state.awards,
      globalAwards,
      championClubId: state.standings[0]?.teamId ?? null,
      cupChampionId: state.cup?.championTeamId ?? null,
      uclChampionId: state.ucl?.championTeamId ?? null,
      squadStats,
    },
  };
}

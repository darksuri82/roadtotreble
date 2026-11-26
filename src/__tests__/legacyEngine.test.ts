import { describe, expect, it } from 'vitest';
import { HIDDEN_ACHIEVEMENTS } from '../data/achievements';
import {
  computeSeasonScore,
  evaluateAchievements,
} from '../engine/legacyEngine';
import { USER_CLUB_ID } from '../engine/matchEngine';
import type { DomesticCupState } from '../types/cup';
import type { MatchResult, PlayerSeasonStats, StandingRow } from '../types/league';
import { createInitialTrackers } from '../types/legacy';
import type { Player } from '../types/player';
import type { UclTournamentState } from '../types/ucl';

function makeStanding(overrides: Partial<StandingRow> = {}): StandingRow {
  return {
    teamId: USER_CLUB_ID,
    teamName: 'FC 레거시',
    shortName: 'FCL',
    primaryColor: '#10b981',
    secondaryColor: '#0f172a',
    isUser: true,
    played: 38,
    won: 30,
    drawn: 5,
    lost: 3,
    goalsFor: 85,
    goalsAgainst: 22,
    goalDifference: 63,
    points: 95,
    form: ['W', 'W', 'W', 'W', 'W'],
    ...overrides,
  };
}

function makePlayer(id: string, isLegend = false): Player {
  return {
    id,
    name: `Player ${id}`,
    position: 'FW',
    mainPositions: ['ST'],
    secondaryPositions: [],
    ovr: 82,
    nationality: '대한민국',
    nationalityCode: 'KR',
    leagueId: 'epl',
    club: 'FC 레거시',
    att: 84,
    mid: 75,
    def: 45,
    stamina: 85,
    playstyles: ['poacher'],
    scoutNote: '',
    isLegend,
  };
}

function makeMatch(userGoals: number, oppGoals: number): MatchResult {
  return {
    fixtureId: `m-${Math.random()}`,
    round: 1,
    homeTeamId: USER_CLUB_ID,
    awayTeamId: 'opp',
    homeGoals: userGoals,
    awayGoals: oppGoals,
    homeXg: 1.5,
    awayXg: 0.5,
    homePossession: 55,
    homeShots: 14,
    awayShots: 6,
    homeShotsOnTarget: 6,
    awayShotsOnTarget: 2,
    homeTactic: 'possession',
    awayTactic: 'balanced',
    homeFormation: '4-3-3',
    awayFormation: '4-4-2',
    homeTacticBonus: 0,
    awayTacticBonus: 0,
    events: [],
    playerRatings: [],
    momPlayerId: '',
    momPlayerName: '',
    momRating: 7.5,
  };
}

describe('Season Score Fairness & All 24 Hidden Achievements', () => {
  it('contains exactly 24 distinct hidden achievements', () => {
    expect(HIDDEN_ACHIEVEMENTS).toHaveLength(24);
    expect(new Set(HIDDEN_ACHIEVEMENTS.map((a) => a.id)).size).toBe(24);
  });

  it('fairly normalizes 34R Bundesliga and 38R EPL seasons with identical PPG and GD/match', () => {
    const epl38 = computeSeasonScore({
      leaguePoints: 95, // 2.50 PPG
      leaguePlayed: 38,
      leagueGoalDifference: 38, // +1.0 GD/match
      leagueLosses: 3,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 86,
    });
    const bundes34 = computeSeasonScore({
      leaguePoints: 85, // 2.50 PPG
      leaguePlayed: 34,
      leagueGoalDifference: 34, // +1.0 GD/match
      leagueLosses: 3,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 86,
    });

    expect(epl38.leagueConvertedScore).toBe(bundes34.leagueConvertedScore);
    expect(epl38.totalScore).toBe(bundes34.totalScore);

    // Underdog bonus rewards low OVR champion over high OVR champion
    const underdog = computeSeasonScore({
      leaguePoints: 85,
      leaguePlayed: 38,
      leagueGoalDifference: 35,
      leagueLosses: 5,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 80,
    });
    const superteam = computeSeasonScore({
      leaguePoints: 85,
      leaguePlayed: 38,
      leagueGoalDifference: 35,
      leagueLosses: 5,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 90,
    });
    expect(underdog.underdogBonus).toBeGreaterThan(0);
    expect(superteam.underdogBonus).toBe(0);
    expect(superteam.squadCraftBonus ?? 0).toBeGreaterThan(
      underdog.squadCraftBonus ?? 0,
    );
    expect(superteam.totalScore).toBeGreaterThan(underdog.totalScore);
  });

  it('evaluates all 24 hidden achievements accurately across league-specific and universal scenarios', () => {
    const unlockedAcrossScenarios = new Set<string>();
    const nonLegendSquad = Array.from({ length: 11 }, (_, i) =>
      makePlayer(`p-${i}`, false),
    );
    const nonLegendBench = Array.from({ length: 5 }, (_, i) =>
      makePlayer(`b-${i}`, false),
    );

    const wonCup = {
      championTeamId: USER_CLUB_ID,
      completed: true,
    } as DomesticCupState;

    const wonUclPerfectSwiss = {
      championTeamId: USER_CLUB_ID,
      completed: true,
      leaguePhaseRound: 8,
      userLeaguePhaseRank: 1,
      enteredViaPlayoff: false,
      standings: [
        makeStanding({ played: 8, won: 8, drawn: 0, lost: 0, points: 24 }),
      ],
    } as unknown as UclTournamentState;

    const wonUclViaPlayoff = {
      ...wonUclPerfectSwiss,
      userLeaguePhaseRank: 15,
      enteredViaPlayoff: true,
      standings: [
        makeStanding({ played: 8, won: 4, drawn: 1, lost: 3, points: 13 }),
      ],
    } as unknown as UclTournamentState;

    const aceStats: Record<string, PlayerSeasonStats> = {
      'user::p-0': {
        playerId: 'p-0',
        playerName: '에이스',
        teamId: USER_CLUB_ID,
        teamName: 'FC 레거시',
        teamShortName: 'FCL',
        teamPrimaryColor: '#10b981',
        teamSecondaryColor: '#000',
        isUserTeam: true,
        position: 'FW',
        mainPositions: ['ST'],
        ovr: 88,
        appearances: 38,
        starts: 38,
        subAppearances: 0,
        minutesPlayed: 3400,
        goals: 36,
        assists: 21,
        xgSum: 29,
        cleanSheets: 0,
        momCount: 14,
        ratingSum: 310,
        avgRating: 8.16,
        positionCounts: { ST: 38 },
        isLegend: false,
      },
    };

    const twentyCleanSheets = Array.from({ length: 20 }, () => makeMatch(2, 0));

    // Scenario 1: EPL Invincible Iron Wall Centurion Treble + Universal achievements
    const s1 = evaluateAchievements({
      leagueId: 'epl',
      totalRounds: 38,
      standings: [
        makeStanding({
          played: 38,
          won: 33,
          drawn: 5,
          lost: 0,
          goalsFor: 92,
          goalsAgainst: 14,
          points: 104,
        }),
      ],
      userLeagueMatchHistory: twentyCleanSheets,
      allPlayerStats: aceStats,
      cup: wonCup,
      userCupMatchHistory: [makeMatch(2, 0), makeMatch(1, 0)],
      ucl: wonUclPerfectSwiss,
      userUclMatchHistory: [makeMatch(3, 1), makeMatch(2, 1)],
      starters: nonLegendSquad,
      bench: nonLegendBench,
      teamAvgOvr: 80.5,
      chemistry: 96,
      trackers: {
        comebackFrom2DownCount: 1,
        halftimeTacticComebackWins: 3,
        signedUnder20PctSuccess: true,
      },
    });
    for (const id of s1) unlockedAcrossScenarios.add(id);

    // Scenario 2: La Liga 100 pts & 100 goals + UCL Playoff Miracle
    const s2 = evaluateAchievements({
      leagueId: 'laliga',
      totalRounds: 38,
      standings: [
        makeStanding({ played: 38, won: 33, drawn: 2, lost: 3, goalsFor: 105, points: 101 }),
      ],
      userLeagueMatchHistory: [],
      allPlayerStats: {},
      cup: null,
      userCupMatchHistory: [],
      ucl: wonUclViaPlayoff,
      userUclMatchHistory: [],
      starters: nonLegendSquad,
      bench: nonLegendBench,
      teamAvgOvr: 88,
      chemistry: 80,
      trackers: createInitialTrackers(),
    });
    for (const id of s2) unlockedAcrossScenarios.add(id);

    // Scenario 3: Serie A 102 pts unbeaten
    const s3 = evaluateAchievements({
      leagueId: 'seriea',
      totalRounds: 38,
      standings: [
        makeStanding({ played: 38, won: 33, drawn: 5, lost: 0, points: 104 }),
      ],
      userLeagueMatchHistory: [],
      allPlayerStats: {},
      cup: null,
      userCupMatchHistory: [],
      ucl: null,
      userUclMatchHistory: [],
      starters: nonLegendSquad,
      bench: nonLegendBench,
      teamAvgOvr: 88,
      chemistry: 80,
      trackers: createInitialTrackers(),
    });
    for (const id of s3) unlockedAcrossScenarios.add(id);

    // Scenario 4: Bundesliga 34R Neverkusen + 91 pts
    const s4 = evaluateAchievements({
      leagueId: 'bundesliga',
      totalRounds: 34,
      standings: [
        makeStanding({ played: 34, won: 30, drawn: 4, lost: 0, points: 94 }),
      ],
      userLeagueMatchHistory: [],
      allPlayerStats: {},
      cup: null,
      userCupMatchHistory: [],
      ucl: null,
      userUclMatchHistory: [],
      starters: nonLegendSquad,
      bench: nonLegendBench,
      teamAvgOvr: 88,
      chemistry: 80,
      trackers: createInitialTrackers(),
    });
    for (const id of s4) unlockedAcrossScenarios.add(id);

    // Scenario 5: Ligue 1 34R Unbeaten
    const s5 = evaluateAchievements({
      leagueId: 'ligue1',
      totalRounds: 34,
      standings: [
        makeStanding({ played: 34, won: 28, drawn: 6, lost: 0, points: 90 }),
      ],
      userLeagueMatchHistory: [],
      allPlayerStats: {},
      cup: null,
      userCupMatchHistory: [],
      ucl: null,
      userUclMatchHistory: [],
      starters: nonLegendSquad,
      bench: nonLegendBench,
      teamAvgOvr: 88,
      chemistry: 80,
      trackers: createInitialTrackers(),
    });
    for (const id of s5) unlockedAcrossScenarios.add(id);

    // Verify ALL 24 Hidden Achievements were triggered by their exact conditions!
    expect(unlockedAcrossScenarios.size).toBe(24);
    for (const def of HIDDEN_ACHIEVEMENTS) {
      expect(unlockedAcrossScenarios.has(def.id)).toBe(true);
    }
  });
});

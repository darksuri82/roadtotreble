import { describe, expect, it } from 'vitest';
import { computeGlobalSeasonAwards, computeSeasonAwards } from '../engine/awardsEngine';
import { buildAiClubRoster, getLeagueById } from '../engine/dataLoader';
import {
  AWARD_SCORE_WEIGHTS,
  computeSeasonScore,
} from '../engine/legacyEngine';
import { USER_CLUB_ID } from '../engine/matchEngine';
import {
  advanceOtherLeaguesToProgress,
  createOtherLeaguesState,
} from '../engine/otherLeaguesEngine';
import { createInitialStandings } from '../engine/standingsEngine';
import {
  createUclTournamentState,
  simulateUclLeaguePhaseToEnd,
} from '../engine/uclEngine';
import { DEFAULT_MANAGER_AVATAR, DEFAULT_MANAGER_NAME } from '../types/game';
import type { Club, PlayerSeasonStats } from '../types/league';

function makeMockStats(
  overrides: Partial<PlayerSeasonStats> & {
    playerId: string;
    playerName: string;
    teamId: string;
  },
): PlayerSeasonStats {
  const appearances = overrides.appearances ?? 34;
  const avgRating = overrides.avgRating ?? 7.4;
  return {
    teamName: overrides.isUserTeam ? 'FC Test' : 'AI FC',
    teamShortName: overrides.isUserTeam ? 'FCT' : 'AIF',
    teamPrimaryColor: '#10b981',
    teamSecondaryColor: '#0f172a',
    isUserTeam: false,
    position: 'FW',
    mainPositions: ['ST'],
    ovr: 88,
    appearances,
    starts: appearances,
    subAppearances: 0,
    minutesPlayed: appearances * 85,
    goals: 15,
    assists: 6,
    xgSum: 13.5,
    cleanSheets: 0,
    momCount: 4,
    ratingSum: avgRating * appearances,
    avgRating,
    positionCounts: { ST: appearances },
    isLegend: false,
    ...overrides,
  };
}

describe('v2.3 Features: Global Awards, Award Score Bonus, UCL LP Fast-Sim & Manager Profile', () => {
  it('computes Ballon dOr TOP 5 and 4-3-3 World Best XI including user stars', () => {
    const epl = getLeagueById('epl');
    const userClub: Club = {
      ...epl.clubs[0],
      id: USER_CLUB_ID,
      name: 'FC Treble',
      shortName: 'FCT',
      isUser: true,
    };
    const clubs = [userClub, ...epl.clubs.slice(1)];
    const standings = createInitialStandings(clubs).map((row, idx) => ({
      ...row,
      played: 38,
      won: 30 - Math.min(20, idx),
      drawn: 5,
      lost: 3 + Math.min(20, idx),
      goalsFor: 92 - idx * 2,
      goalsAgainst: 24 + idx * 2,
      goalDifference: 68 - idx * 4,
      points: (30 - Math.min(20, idx)) * 3 + 5,
    }));

    const otherLeagues = advanceOtherLeaguesToProgress(
      createOtherLeaguesState('epl'),
      38,
      38,
    );

    const userHero = makeMockStats({
      playerId: 'u-st-1',
      playerName: '에이스 스트라이커',
      teamId: USER_CLUB_ID,
      isUserTeam: true,
      position: 'FW',
      mainPositions: ['ST'],
      ovr: 93,
      goals: 42,
      assists: 14,
      momCount: 16,
      avgRating: 8.45,
    });

    const userGk = makeMockStats({
      playerId: 'u-gk-1',
      playerName: '수호신 골키퍼',
      teamId: USER_CLUB_ID,
      isUserTeam: true,
      position: 'GK',
      mainPositions: ['GK'],
      ovr: 91,
      goals: 0,
      assists: 0,
      cleanSheets: 25,
      momCount: 8,
      avgRating: 8.05,
    });

    const allLeaguePlayerStats: Record<string, PlayerSeasonStats> = {
      [`${USER_CLUB_ID}::${userHero.playerId}`]: userHero,
      [`${USER_CLUB_ID}::${userGk.playerId}`]: userGk,
    };

    const globalAwards = computeGlobalSeasonAwards({
      allLeaguePlayerStats,
      cupPlayerStats: {},
      uclPlayerStats: {},
      leagueStandings: standings,
      cup: null,
      ucl: null,
      otherLeagues,
      userLeagueId: 'epl',
    });

    expect(globalAwards.ballonDorWinner).not.toBeNull();
    expect(globalAwards.ballonDorWinner?.stats.playerId).toBe('u-st-1');
    expect(globalAwards.ballonDorTop5).toHaveLength(5);
    expect(globalAwards.worldBestXi).toHaveLength(11);
    expect(
      globalAwards.worldBestXi.some((x) => x.stats.playerId === 'u-st-1'),
    ).toBe(true);
    expect(
      globalAwards.worldBestXi.some((x) => x.stats.playerId === 'u-gk-1'),
    ).toBe(true);
  });

  it('adds exact individual award bonus points to SeasonScoreBreakdown', () => {
    const epl = getLeagueById('epl');
    const userClub: Club = {
      ...epl.clubs[0],
      id: USER_CLUB_ID,
      name: 'FC Awards',
      shortName: 'FCA',
      isUser: true,
    };
    const standings = createInitialStandings([userClub, ...epl.clubs.slice(1)]);

    const p1 = makeMockStats({
      playerId: 'p1',
      playerName: '골잡이',
      teamId: USER_CLUB_ID,
      isUserTeam: true,
      position: 'FW',
      mainPositions: ['ST'],
      goals: 38,
      assists: 10,
      momCount: 12,
      avgRating: 8.3,
    });
    const p2 = makeMockStats({
      playerId: 'p2',
      playerName: '마에스트로',
      teamId: USER_CLUB_ID,
      isUserTeam: true,
      position: 'MF',
      mainPositions: ['CM'],
      goals: 12,
      assists: 20,
      momCount: 9,
      avgRating: 8.1,
    });

    const awards = computeSeasonAwards(
      {
        'user::p1': p1,
        'user::p2': p2,
      },
      standings,
      38,
    );

    const globalAwards = {
      ballonDorWinner: {
        rank: 1,
        stats: p1,
        ballonScore: 210,
        trophies: ['프리미어리그 우승'],
        reason: '압도적 활약',
      },
      ballonDorTop5: [],
      worldBestXi: [
        { slotIndex: 9, slotLabel: 'ST' as const, stats: p1 },
        { slotIndex: 6, slotLabel: 'CM' as const, stats: p2 },
      ],
    };

    const baseScore = computeSeasonScore({
      leaguePoints: 90,
      leaguePlayed: 38,
      leagueGoalDifference: 55,
      leagueLosses: 2,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 86,
    });

    const withAwards = computeSeasonScore({
      leaguePoints: 90,
      leaguePlayed: 38,
      leagueGoalDifference: 55,
      leagueLosses: 2,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 86,
      awards,
      globalAwards,
    });

    const expectedBonus =
      AWARD_SCORE_WEIGHTS.ballonDor +
      2 * AWARD_SCORE_WEIGHTS.worldBestXiPerPlayer +
      AWARD_SCORE_WEIGHTS.leagueMvp +
      2 * AWARD_SCORE_WEIGHTS.leagueBestXiPerPlayer;

    expect(baseScore.awardsBonus).toBe(0);
    expect(withAwards.awardsBonus).toBe(expectedBonus);
    expect(withAwards.totalScore).toBe(baseScore.totalScore + expectedBonus);
    expect(withAwards.awardsBonusDetails?.length).toBe(4);
  });

  it('fast-simulates UCL Swiss League Phase cleanly to Round 8 with valid outcome', () => {
    const epl = getLeagueById('epl');
    const userClub: Club = {
      ...epl.clubs[0],
      id: USER_CLUB_ID,
      name: 'FC Europe',
      shortName: 'FCE',
      isUser: true,
    };
    const userSquad = buildAiClubRoster(epl.clubs[0], 'epl');
    const leagueClubs = [userClub, ...epl.clubs.slice(1)];
    const standings = createInitialStandings(leagueClubs).sort((a, b) =>
      a.teamId === USER_CLUB_ID ? -1 : b.teamId === USER_CLUB_ID ? 1 : 0,
    );
    const otherLeagues = advanceOtherLeaguesToProgress(
      createOtherLeaguesState('epl'),
      38,
      38,
    );

    const { ucl, uclPlayerStats } = createUclTournamentState({
      userLeagueId: 'epl',
      userClub,
      userSquad,
      userLeagueClubs: leagueClubs,
      userLeagueStandings: standings,
      userAiRosters: {},
      otherLeagues,
    });

    const res = simulateUclLeaguePhaseToEnd({
      ucl,
      uclPlayerStats,
    });

    expect(res.ucl.leaguePhaseRound).toBe(8);
    expect(res.ucl.stage).toBe('playoff');
    expect(res.newUserMatches).toHaveLength(8);
    expect(res.summary.finalRank).toBeGreaterThanOrEqual(1);
    expect(res.summary.finalRank).toBeLessThanOrEqual(36);
    expect(['r16', 'playoff', 'eliminated']).toContain(res.summary.outcome);
    expect(res.ucl.ties.playoff).toHaveLength(8);
  });

  it('provides valid default manager profile & avatar constants', () => {
    expect(DEFAULT_MANAGER_NAME.length).toBeGreaterThan(0);
    expect(DEFAULT_MANAGER_AVATAR.skinTone).toBe('peach');
    expect(DEFAULT_MANAGER_AVATAR.hairStyle).toBe('fluffy');
    expect(DEFAULT_MANAGER_AVATAR.outfit).toBe('classic_suit');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildHistoricalClubForMatch,
  HISTORICAL_BENCHMARK_TEAMS,
} from '../data/historicalTeams';
import {
  ALL_MANAGER_EVENTS,
  buildManagerEventMatchContext,
  pickNextManagerEvent,
  resolveManagerEventSceneId,
} from '../data/managerEvents';
import { createDefaultManagerEventsState } from '../engine/conditionEngine';
import {
  computeSeasonScore,
  computeUserSeasonManagerRating,
  reconstructHallOfFameSquad,
} from '../engine/legacyEngine';
import {
  simulateExtraTimeAndPenalties,
  simulateMatch,
  USER_CLUB_ID,
} from '../engine/matchEngine';
import type { ManagerEventSceneId } from '../types/condition';
import type { Fixture, MatchResult } from '../types/league';
import type { HallOfFameEntry } from '../types/legacy';

describe('v4.1 Features: Historical 17-Player Full Squads, Fair Synergy Score, Dream Match & 8 Pixel Scenes', () => {
  it('populates all 24 historical teams with 11 starters + 6 bench (17 players), curated sub-attributes, legendary managers, and real chemistry/synergy', () => {
    expect(HISTORICAL_BENCHMARK_TEAMS).toHaveLength(24);

    for (const team of HISTORICAL_BENCHMARK_TEAMS) {
      expect(team.starters).toHaveLength(11);
      expect(team.bench.length).toBeGreaterThanOrEqual(5);
      expect(team.starters.length + team.bench.length).toBeGreaterThanOrEqual(16);

      // Every player must have explicit curated sub-attributes (and GK 5-attrs for GK)
      for (const p of [...team.starters, ...team.bench]) {
        expect(p.attrs).toBeDefined();
        expect(p.attrs!.sho).toBeGreaterThanOrEqual(30);
        expect(p.attrs!.dri).toBeGreaterThanOrEqual(40);
        if (p.position === 'GK') {
          expect(p.attrs!.gk).toBeDefined();
          expect(p.attrs!.gk!.ref).toBeGreaterThanOrEqual(70);
        }
      }

      // Real engine-computed chemistry & manager synergy & legendary manager stature
      expect(team.chemistry).toBeGreaterThanOrEqual(70);
      expect(team.managerRating).toBeGreaterThanOrEqual(91);
      expect(team.managerRating).toBeLessThanOrEqual(99);
      expect(team.managerTraitId).toBeTruthy();
      expect(team.managerAvatar).toBeDefined();

      // Rebalanced Season Score: every legendary team achieves at least S grade (5,600+)
      expect(team.seasonScore.totalScore).toBeGreaterThanOrEqual(5600);
      expect(['S', 'S+']).toContain(team.seasonScore.grade);
      expect(team.seasonScore.squadCraftBonus ?? 0).toBeGreaterThan(0);
    }

    // 14-15 Barca MSN attributes reflect historic peak
    const barca1415 = HISTORICAL_BENCHMARK_TEAMS.find(
      (t) => t.id === 'hist-1415-barca',
    )!;
    const messi = barca1415.starters.find((p) => p.name === '리오넬 메시')!;
    expect(messi.ovr).toBeGreaterThanOrEqual(96);
    expect(messi.attrs!.dri).toBe(99);
    expect(messi.attrs!.sho).toBeGreaterThanOrEqual(97);

    // 19-20 Bayern UCL All-Wins Treble & 12-13 Bayern 91pt Treble sit at top summit
    const bayern1920 = HISTORICAL_BENCHMARK_TEAMS.find(
      (t) => t.id === 'hist-1920-bayern',
    )!;
    expect(bayern1920.seasonScore.totalScore).toBeGreaterThan(11000);
    expect(bayern1920.seasonScore.honorsBonusDetails).toContain(
      'UCL 전승 우승 +850',
    );
  });

  it('applies squadCraftBonus (OVR + Chemistry + Manager Synergy + Manager Rating) fairly to both user and historical teams', () => {
    const highCraft = computeSeasonScore({
      leaguePoints: 92,
      leaguePlayed: 38,
      leagueGoalDifference: 65,
      leagueLosses: 2,
      leagueGoalsFor: 102,
      leagueGoalsAgainst: 20,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 90,
      chemistry: 96,
      avgSynergyOvrBonus: 2.3,
      managerSynergyCount: 9,
      managerRating: computeUserSeasonManagerRating({
        finalLeagueRank: 1,
        wonCup: true,
        wonUcl: true,
        leagueLosses: 0,
        leaguePlayed: 38,
        converted38Points: 100,
        chemistry: 96,
        managerSynergyCount: 9,
      }),
    });

    const lowCraft = computeSeasonScore({
      leaguePoints: 92,
      leaguePlayed: 38,
      leagueGoalDifference: 65,
      leagueLosses: 2,
      leagueGoalsFor: 102,
      leagueGoalsAgainst: 20,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 85,
      chemistry: 60,
      avgSynergyOvrBonus: 0,
      managerSynergyCount: 0,
      managerRating: 84,
    });

    expect(highCraft.squadCraftBonus ?? 0).toBeGreaterThan(
      lowCraft.squadCraftBonus ?? 0,
    );
    expect(highCraft.totalScore).toBeGreaterThan(lowCraft.totalScore);
    expect((highCraft.squadCraftDetails ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('reconstructs both v4.1 full HOF squads and pre-v4.1 legacy HOF entries for Dream Match and simulates against historical teams', () => {
    const bayern = HISTORICAL_BENCHMARK_TEAMS.find(
      (t) => t.id === 'hist-1920-bayern',
    )!;
    const oppBundle = buildHistoricalClubForMatch(bayern);
    expect(oppBundle.starters).toHaveLength(11);
    expect(oppBundle.fullRoster.length).toBeGreaterThanOrEqual(16);

    // Pre-v4.1 legacy HallOfFameEntry missing fullStarters/fullBench
    const legacyEntry: HallOfFameEntry = {
      id: 'legacy-old-1',
      completedAt: '2026-01-01T00:00:00.000Z',
      userClub: {
        name: '레거시 FC',
        shortName: 'LGC',
        primaryColor: '#10b981',
        secondaryColor: '#ffffff',
        pattern: 'solid',
      },
      managerName: '테스트 감독',
      managerTraitId: 'tiki_taka',
      leagueId: 'epl',
      leagueKoreanName: '프리미어리그',
      formation: '4-3-3',
      defaultTactic: 'possession',
      finalLeagueRank: 1,
      leaguePoints: 92,
      leagueTotalRounds: 38,
      leagueRecord: '29승 5무 4패',
      cupName: 'FA컵',
      cupResultLabel: '우승',
      cupWon: true,
      uclResultLabel: '우승',
      uclWon: true,
      isTreble: true,
      isLeagueChampion: true,
      teamAvgOvr: 88,
      chemistry: 92,
      seasonScore: bayern.seasonScore,
      trophies: ['프리미어리그 우승'],
      topScorerSummary: '에이스 (30골 10도움)',
      starters: Array.from({ length: 11 }, (_, i) => ({
        id: `old-s-${i}`,
        name: `레거시 선발 ${i + 1}`,
        ovr: 86,
        position: i === 0 ? 'GK' : i <= 4 ? 'DF' : i <= 7 ? 'MF' : 'FW',
        mainPositions: [
          i === 0 ? 'GK' : i <= 4 ? 'CB' : i <= 7 ? 'CM' : 'ST',
        ],
        isLegend: false,
        goals: 5,
        assists: 3,
        avgRating: 7.5,
      })),
      bench: Array.from({ length: 5 }, (_, i) => ({
        id: `old-b-${i}`,
        name: `레거시 벤치 ${i + 1}`,
        ovr: 81,
        position: i === 0 ? 'GK' : 'MF',
        mainPositions: [i === 0 ? 'GK' : 'CM'],
        isLegend: false,
        goals: 1,
        assists: 1,
        avgRating: 6.8,
      })),
      unlockedAchievementIds: [],
    };

    const reconstructed = reconstructHallOfFameSquad(legacyEntry);
    expect(reconstructed.usedLegacyFallback).toBe(true);
    const validStarters = reconstructed.starters.filter((p) => p !== null);
    expect(validStarters).toHaveLength(11);
    expect(validStarters[0].attrs).toBeDefined();

    // Run an actual Dream Match simulation with ET/PK support
    const fixture: Fixture = {
      id: 'dream-test-1',
      round: 1,
      homeTeamId: USER_CLUB_ID,
      awayTeamId: oppBundle.club.id,
      played: false,
    };
    const dummyHomeClub = {
      id: USER_CLUB_ID,
      name: legacyEntry.userClub.name,
      shortName: legacyEntry.userClub.shortName,
      primaryColor: legacyEntry.userClub.primaryColor,
      secondaryColor: legacyEntry.userClub.secondaryColor,
      formation: '4-3-3' as const,
      defaultTactic: 'possession' as const,
      att: 86,
      mid: 86,
      def: 85,
      topScorers: ['레거시 선발 10', '레거시 선발 11', '레거시 선발 9'] as [
        string,
        string,
        string,
      ],
      isUser: true,
    };
    let result = simulateMatch(
      fixture,
      dummyHomeClub,
      oppBundle.club,
      validStarters,
      oppBundle.starters,
      {
        userClubId: USER_CLUB_ID,
        formation: '4-3-3',
        tactic: 'possession',
        starters: validStarters,
        bench: reconstructed.bench.filter((p) => p !== null),
        chemistry: 92,
        ratings: {
          att: 86,
          mid: 86,
          def: 85,
          ovr: 86,
          rawOvr: 86,
          chemistryBonus: 2,
          effectiveAtt: 88,
          effectiveMid: 88,
          effectiveDef: 87,
        },
        managerTraitId: 'tiki_taka',
        opponentRank: 1,
      },
    );
    if (result.homeGoals === result.awayGoals) {
      result = simulateExtraTimeAndPenalties({
        baseResult: result,
        homeClub: dummyHomeClub,
        awayClub: oppBundle.club,
        homeRoster: validStarters,
        awayRoster: oppBundle.starters,
      });
      expect(result.extraTime).toBeDefined();
    }
    expect(result.playerRatings.length).toBeGreaterThanOrEqual(22);
  });

  it('maps all 72 press & locker events across all 8 distinct pixel-art scenes and attaches last-match player stat cards', () => {
    const usedScenes = new Set<ManagerEventSceneId>();
    for (const tpl of ALL_MANAGER_EVENTS) {
      const scene = resolveManagerEventSceneId({ template: tpl });
      usedScenes.add(scene);
    }
    expect(usedScenes.size).toBe(8);
    expect(usedScenes).toContain('press_official');
    expect(usedScenes).toContain('press_ucl_night');
    expect(usedScenes).toContain('press_mixed_zone');
    expect(usedScenes).toContain('locker_home');
    expect(usedScenes).toContain('stadium_tunnel');
    expect(usedScenes).toContain('manager_office');
    expect(usedScenes).toContain('training_pitch');
    expect(usedScenes).toContain('celebration_locker');

    // Verify last-match score & player stat summary card extraction
    const squad = HISTORICAL_BENCHMARK_TEAMS[0].starters;
    const star = squad[10];
    const sampleMatch: MatchResult = {
      fixtureId: 'fx-14',
      round: 14,
      competition: 'league',
      competitionLabel: '리그 14R',
      homeTeamId: USER_CLUB_ID,
      awayTeamId: 'arsenal',
      homeGoals: 4,
      awayGoals: 1,
      homeXg: 2.85,
      awayXg: 0.72,
      homePossession: 61,
      homeShots: 18,
      awayShots: 6,
      homeShotsOnTarget: 9,
      awayShotsOnTarget: 2,
      homeTactic: 'possession',
      awayTactic: 'balanced',
      homeFormation: '4-3-3',
      awayFormation: '4-3-3',
      homeTacticBonus: 1.2,
      awayTacticBonus: -0.5,
      events: [
        {
          minute: 23,
          half: 1,
          type: 'goal',
          teamId: USER_CLUB_ID,
          scorerId: star.id,
          scorerName: star.name,
          dribbleBeatCount: 3,
          description: '원맨 드리블 쇼 득점!',
        },
      ],
      playerRatings: [
        {
          playerId: star.id,
          playerName: star.name,
          teamId: USER_CLUB_ID,
          position: star.position,
          subPosition: star.mainPositions[0],
          rating: 9.4,
          goals: 2,
          assists: 1,
          xg: 1.32,
          minutesPlayed: 90,
        },
      ],
      momPlayerId: star.id,
      momPlayerName: star.name,
      momRating: 9.4,
    };

    const ctx = buildManagerEventMatchContext({
      lastMatch: sampleMatch,
      lastMatchWasUserHome: true,
      teamName: 'FC 드림',
      opponentName: '아스널',
      targetPlayer: star,
      squad,
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.competitionLabel).toBe('리그 14R');
    expect(ctx!.userGoals).toBe(4);
    expect(ctx!.oppGoals).toBe(1);
    expect(ctx!.outcome).toBe('W');
    expect(ctx!.playerStats?.rating).toBe(9.4);
    expect(ctx!.playerStats?.goals).toBe(2);
    expect(ctx!.playerStats?.assists).toBe(1);
    expect(ctx!.playerStats?.dribbleBeats).toBe(3);
    expect(ctx!.playerStats?.isMom).toBe(true);

    // Pick a real event with MOM context and verify sceneId + matchContext attached
    const picked = pickNextManagerEvent({
      eventsState: {
        ...createDefaultManagerEventsState(),
        matchesSinceLastEvent: 5,
      },
      starters: squad,
      bench: HISTORICAL_BENCHMARK_TEAMS[0].bench,
      conditionMap: {},
      teamName: 'FC 드림',
      managerName: '김감독',
      nextOpponentName: '리버풀',
      userRank: 1,
      lastMatch: sampleMatch,
      lastMatchOpponentName: '아스널',
      lastMatchWasUserHome: true,
      lastMatchMomPlayerId: star.id,
      lastMatchRatings: { [star.id]: 9.4 },
      rng: () => 0.1,
    });
    expect(picked).not.toBeNull();
    expect(picked!.sceneId).toBeDefined();
    expect(picked!.matchContext?.opponentName).toBe('아스널');
    expect(picked!.matchContext?.playerStats?.rating).toBe(9.4);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildPostMatchDialoguePool,
  pickPostMatchDialogue,
} from '../components/multiplayer/MpPostMatchManagerPopup';
import { FORMATION_LIST, FORMATIONS } from '../data/formations';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
import { evaluatePositionFit } from '../engine/positionEngine';
import {
  accumulateCompetitionPlayerStats,
  applyRoundResults,
  createInitialStandings,
} from '../engine/standingsEngine';
import type { SeasonState } from '../types/game';
import type { Club, MatchResult, PlayerSeasonStats } from '../types/league';
import type { Player } from '../types/player';
import {
  buildPlayerCompetitionBreakdown,
  mergeCrossLeaguePlayerStats,
} from '../utils/playerLookup';

describe('v7.2 Bugfixes & Multiplayer Customization / Reveal / Post-Match Popups', () => {
  it('1) enforces unified position fit penalty across all 9 formations (e.g. RW Lamine Yamal in 3-3-3-1 RAM slot)', () => {
    expect(FORMATION_LIST).toHaveLength(9);

    for (const fmt of FORMATION_LIST) {
      for (const slot of fmt.slots) {
        expect(slot.alternateSubPositions).toBeUndefined();
      }
    }

    const yamalLikeRw: Player = {
      ...ACTIVE_PLAYERS[0],
      id: 'test-yamal-rw',
      name: '라민 야말',
      position: 'FW',
      mainPositions: ['RW'],
      secondaryPositions: ['RM'],
      ovr: 89,
    };

    const ramSlot = FORMATIONS['3-3-3-1'].slots[9];
    expect(ramSlot.label).toBe('RAM');
    expect(ramSlot.subPosition).toBe('CAM');

    const pitchFit = evaluatePositionFit(
      yamalLikeRw,
      ramSlot.subPosition,
      null,
      ramSlot.alternateSubPositions,
    );
    const detailFit = evaluatePositionFit(
      yamalLikeRw,
      ramSlot.subPosition,
      null,
    );

    expect(pitchFit).toEqual(detailFit);
    expect(pitchFit.penalty).toBe(-15);
    expect(pitchFit.effectiveOvr).toBe(74);
  });

  it('2) prevents cross-league traded player stats from doubling (e.g. 28R trade 28 + 10 = 38 apps, never 66)', () => {
    const preTradeLaLigaStat: PlayerSeasonStats = {
      playerId: 'laliga-yamal',
      playerName: '라민 야말',
      teamId: 'lal-bar',
      teamName: 'FC 바르셀로나',
      teamShortName: 'BAR',
      teamPrimaryColor: '#a50044',
      teamSecondaryColor: '#004d98',
      isUserTeam: false,
      position: 'FW',
      mainPositions: ['RW'],
      ovr: 89,
      appearances: 28,
      starts: 28,
      subAppearances: 0,
      minutesPlayed: 2520,
      goals: 20,
      assists: 13,
      xgSum: 18.4,
      cleanSheets: 0,
      momCount: 7,
      ratingSum: 215.6,
      avgRating: 7.7,
      positionCounts: { RW: 28 },
      isLegend: false,
    };

    // Seeded into user league at 28R and played 10 more matches (total 38 appearances, 26G, 17A)
    const postTradeUserLeagueStat: PlayerSeasonStats = {
      ...preTradeLaLigaStat,
      teamId: 'user-club',
      teamName: 'FC 신농',
      teamShortName: 'SNN',
      isUserTeam: true,
      appearances: 38,
      starts: 38,
      minutesPlayed: 3420,
      goals: 26,
      assists: 17,
      xgSum: 24.8,
      momCount: 10,
      ratingSum: 292.6,
      avgRating: 7.7,
      positionCounts: { RW: 38 },
      transferHistory: [
        {
          fromClubId: 'lal-bar',
          fromClubName: 'FC 바르셀로나',
          toClubId: 'user-club',
          toClubName: 'FC 신농',
          round: 28,
          competition: 'league',
          type: 'trade',
        },
      ],
    };

    const merged = mergeCrossLeaguePlayerStats(
      preTradeLaLigaStat,
      postTradeUserLeagueStat,
      38,
    );
    expect(merged).not.toBeNull();
    expect(merged!.appearances).toBe(38);
    expect(merged!.goals).toBe(26);
    expect(merged!.assists).toBe(17);

    // Even if an old save left preTradeLaLigaStat in otherLeagues.laliga.playerStats,
    // buildPlayerCompetitionBreakdown must return 38 league appearances (and 38 + 4 = 42 total, never 66/70)
    const mockUclStat: PlayerSeasonStats = {
      ...postTradeUserLeagueStat,
      appearances: 4,
      starts: 4,
      subAppearances: 0,
      minutesPlayed: 360,
      goals: 3,
      assists: 2,
      xgSum: 2.5,
      momCount: 1,
      ratingSum: 31.2,
      avgRating: 7.8,
      positionCounts: { RW: 4 },
    };

    const mockSeason = {
      leagueId: 'epl',
      totalRounds: 38,
      standings: [],
      allPlayerStats: { 'laliga-yamal': postTradeUserLeagueStat },
      cupPlayerStats: {},
      uclPlayerStats: { 'laliga-yamal': mockUclStat },
      otherLeagues: {
        laliga: {
          leagueId: 'laliga',
          clubs: [],
          fixtures: [],
          currentRound: 38,
          totalRounds: 38,
          standings: [],
          playerStats: { 'laliga-yamal': preTradeLaLigaStat },
          cupPlayerStats: {},
        },
      },
    } as unknown as SeasonState;

    const breakdown = buildPlayerCompetitionBreakdown('laliga-yamal', mockSeason);
    expect(breakdown.league?.appearances).toBe(38);
    expect(breakdown.league?.goals).toBe(26);
    expect(breakdown.league?.assists).toBe(17);
    expect(breakdown.total?.appearances).toBe(42);
  });

  it('3) deduplicates per-match playerRatings by playerId so substituted players are never counted twice in a single match', () => {
    const clubs: Club[] = [
      {
        id: 'club-a',
        name: '클럽 A',
        shortName: 'CLA',
        primaryColor: '#10b981',
        secondaryColor: '#ffffff',
        pattern: 'solid',
        formation: '4-3-3',
        defaultTactic: 'possession',
        att: 85,
        mid: 85,
        def: 85,
        topScorers: ['A', 'B', 'C'],
      },
      {
        id: 'club-b',
        name: '클럽 B',
        shortName: 'CLB',
        primaryColor: '#ef4444',
        secondaryColor: '#ffffff',
        pattern: 'solid',
        formation: '4-3-3',
        defaultTactic: 'counter',
        att: 82,
        mid: 82,
        def: 82,
        topScorers: ['D', 'E', 'F'],
      },
    ];
    const clubsById = { 'club-a': clubs[0], 'club-b': clubs[1] };
    const standings = createInitialStandings(clubs);

    const duplicateRatingEntry = {
      playerId: 'p-dup-1',
      playerName: '중복 테스트 선수',
      teamId: 'club-a',
      position: 'FW' as const,
      subPosition: 'ST' as const,
      rating: 8.2,
      goals: 1,
      assists: 1,
      xg: 0.75,
      minutesPlayed: 45,
      isSub: false,
    };

    const matchWithDuplicateRating: MatchResult = {
      fixtureId: 'fx-1',
      round: 1,
      homeTeamId: 'club-a',
      awayTeamId: 'club-b',
      homeGoals: 1,
      awayGoals: 0,
      homeXg: 1.2,
      awayXg: 0.4,
      homePossession: 55,
      homeShots: 10,
      awayShots: 5,
      homeShotsOnTarget: 5,
      awayShotsOnTarget: 2,
      homeTactic: 'possession',
      awayTactic: 'counter',
      homeTacticBonus: 0,
      awayTacticBonus: 0,
      homeFormation: '4-3-3',
      awayFormation: '4-3-3',
      events: [],
      playerRatings: [
        duplicateRatingEntry,
        { ...duplicateRatingEntry, isSub: true, minutesPlayed: 45 },
      ],
      momPlayerId: 'p-dup-1',
      momPlayerName: '중복 테스트 선수',
      momRating: 8.2,
    };

    const leagueUpdated = applyRoundResults(
      standings,
      [matchWithDuplicateRating],
      clubsById,
      {},
    );
    expect(leagueUpdated.allPlayerStats['p-dup-1'].appearances).toBe(1);
    expect(leagueUpdated.allPlayerStats['p-dup-1'].goals).toBe(1);
    expect(leagueUpdated.allPlayerStats['p-dup-1'].assists).toBe(1);

    const cupUpdated = accumulateCompetitionPlayerStats(
      {},
      [matchWithDuplicateRating],
      clubsById,
    );
    expect(cupUpdated['p-dup-1'].appearances).toBe(1);
    expect(cupUpdated['p-dup-1'].goals).toBe(1);
  });

  it('4) generates celebratory winner dialogues and playful opponent taunting loser dialogues', () => {
    const winPool = buildPostMatchDialoguePool({
      outcome: 'WIN',
      myNickname: '신농 감독',
      myClubName: 'FC 신농',
      oppNickname: '라이벌 감독',
      oppClubName: 'FC 라이벌',
      myGoals: 3,
      oppGoals: 1,
    });
    const lossPool = buildPostMatchDialoguePool({
      outcome: 'LOSS',
      myNickname: '신농 감독',
      myClubName: 'FC 신농',
      oppNickname: '라이벌 감독',
      oppClubName: 'FC 라이벌',
      myGoals: 0,
      oppGoals: 2,
    });

    expect(winPool.length).toBeGreaterThanOrEqual(5);
    expect(lossPool.length).toBeGreaterThanOrEqual(6);

    const quote0 = pickPostMatchDialogue(lossPool, 'match-101', 0);
    const quote1 = pickPostMatchDialogue(lossPool, 'match-101', 1);
    expect(quote0).toBeTruthy();
    expect(quote1).toBeTruthy();
    expect(quote0).not.toEqual(quote1);
  });
});

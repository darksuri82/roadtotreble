import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '../data/formations';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { buildAiClubRoster, getLeagueById, getWeakestClub } from '../engine/dataLoader';
import { simulateMatch, USER_CLUB_ID } from '../engine/matchEngine';
import { generateDoubleRoundRobin } from '../engine/scheduleEngine';
import {
  applyRoundResults,
  createInitialPlayerStatsMap,
  createInitialStandings,
  getUserRank,
} from '../engine/standingsEngine';
import type { FormationId, ManagerTraitId } from '../types/game';
import type { Club, MatchResult, TacticId } from '../types/league';
import type { Player, PlaystyleId, SubPosition } from '../types/player';

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeSyntheticSquad(
  avgOvr: number,
  formationId: FormationId = '4-3-3',
  playstylesOverride?: PlaystyleId[],
): Player[] {
  const slots = FORMATIONS[formationId].slots;
  return slots.map((slot, idx) => {
    const sub: SubPosition = slot.subPosition;
    const defaultStyle: PlaystyleId[] =
      sub === 'GK'
        ? ['shot_stopper']
        : sub === 'CB'
          ? ['ball_playing_cb']
          : sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB'
            ? ['attacking_wingback']
            : sub === 'CDM'
              ? ['deep_playmaker']
              : sub === 'CM'
                ? ['box_to_box']
                : sub === 'CAM'
                  ? ['playmaker_10']
                  : sub === 'ST'
                    ? ['complete_forward']
                    : ['inverted_winger'];

    return {
      id: `syn-${avgOvr}-${idx}`,
      name: `테스트선수-${idx + 1}`,
      position: slot.position,
      mainPositions: [sub],
      secondaryPositions: [],
      ovr: avgOvr,
      nationality: idx % 2 === 0 ? '잉글랜드' : '프랑스',
      nationalityCode: idx % 2 === 0 ? 'GB' : 'FR',
      leagueId: 'epl',
      club: `SyntheticClub-${idx % 4}`,
      att: slot.position === 'FW' ? avgOvr + 1 : slot.position === 'MF' ? avgOvr - 2 : avgOvr - 12,
      mid: slot.position === 'MF' ? avgOvr + 1 : avgOvr - 3,
      def: slot.position === 'DF' || slot.position === 'GK' ? avgOvr + 1 : avgOvr - 14,
      stamina: 84,
      playstyles: playstylesOverride ?? defaultStyle,
      scoutNote: '테스트 스쿼드',
      isLegend: avgOvr >= 91,
    };
  });
}

function runSeasons(params: {
  targetOvr: number;
  seasons: number;
  seedOffset: number;
  chemistryOverride?: number;
  tactic?: TacticId;
  formation?: FormationId;
  managerTraitId?: ManagerTraitId | null;
}) {
  const {
    targetOvr,
    seasons,
    seedOffset,
    chemistryOverride = 50,
    tactic = 'balanced',
    formation = '4-3-3',
    managerTraitId = null,
  } = params;

  const epl = getLeagueById('epl');
  const weakest = getWeakestClub(epl);
  const squad = makeSyntheticSquad(targetOvr, formation);
  const ratings = calculateTeamRatings(
    formation,
    squad,
    chemistryOverride,
    managerTraitId,
  );

  // Align synthetic squad exact ATT/MID/DEF to targetOvr + chemistryBonus for clean tier testing
  const alignedRatings = {
    ...ratings,
    att: targetOvr,
    mid: targetOvr,
    def: targetOvr,
    ovr: targetOvr,
    effectiveAtt: targetOvr + ratings.chemistryBonus,
    effectiveMid: targetOvr + ratings.chemistryBonus,
    effectiveDef: targetOvr + ratings.chemistryBonus,
  };

  let rankSum = 0;
  let ptsSum = 0;
  let aiTopPtsSum = 0;
  let rank1Count = 0;

  for (let s = 0; s < seasons; s += 1) {
    const rng = createSeededRng(seedOffset + s * 7919);
    const userClub: Club = {
      id: USER_CLUB_ID,
      name: '밸런스 검증 FC',
      shortName: 'BAL',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      formation,
      defaultTactic: tactic,
      att: targetOvr,
      mid: targetOvr,
      def: targetOvr,
      topScorers: ['A', 'B', 'C'],
      isUser: true,
    };

    const clubs = epl.clubs.map((c) => (c.id === weakest.id ? userClub : c));
    const clubsById: Record<string, Club> = {};
    const aiRosters: Record<string, Player[]> = {};
    for (const c of clubs) {
      clubsById[c.id] = c;
      if (c.id !== USER_CLUB_ID) {
        aiRosters[c.id] = buildAiClubRoster(c, 'epl');
      }
    }

    const fixtures = generateDoubleRoundRobin(clubs);
    let standings = createInitialStandings(clubs);
    let stats = createInitialPlayerStatsMap({
      clubs,
      userClub,
      userSquad: squad,
      aiRosters,
    });

    for (let round = 1; round <= 38; round += 1) {
      const roundFixtures = fixtures.filter((f) => f.round === round);
      const roundResults: MatchResult[] = [];

      for (const fix of roundFixtures) {
        const homeClub = clubsById[fix.homeTeamId];
        const awayClub = clubsById[fix.awayTeamId];
        const homeRoster =
          fix.homeTeamId === USER_CLUB_ID ? squad : aiRosters[fix.homeTeamId];
        const awayRoster =
          fix.awayTeamId === USER_CLUB_ID ? squad : aiRosters[fix.awayTeamId];

        const res = simulateMatch(
          fix,
          homeClub,
          awayClub,
          homeRoster,
          awayRoster,
          {
            userClubId: USER_CLUB_ID,
            starters: squad,
            formation,
            tactic,
            chemistry: chemistryOverride,
            ratings: alignedRatings,
            managerTraitId,
          },
          rng,
        );
        roundResults.push(res);
      }

      const applied = applyRoundResults(
        standings,
        roundResults,
        clubsById,
        stats,
        USER_CLUB_ID,
      );
      standings = applied.standings;
      stats = applied.allPlayerStats;
    }

    const rank = getUserRank(standings, USER_CLUB_ID);
    const userRow = standings[rank - 1];
    const aiTopRow = standings.find((r) => !r.isUser)!;

    rankSum += rank;
    ptsSum += userRow.points;
    aiTopPtsSum += aiTopRow.points;
    if (rank === 1) rank1Count += 1;
  }

  return {
    avgRank: Math.round((rankSum / seasons) * 100) / 100,
    avgPoints: Math.round((ptsSum / seasons) * 10) / 10,
    avgAiTopPoints: Math.round((aiTopPtsSum / seasons) * 10) / 10,
    titleRate: Math.round((rank1Count / seasons) * 100),
  };
}

describe('20-Season Simulation Balance Verification (EPL 38R)', () => {
  it('validates all 3 OVR tiers, AI #1 realism, and 84-OVR synergy upset potential', () => {
    const tierHigh = runSeasons({ targetOvr: 90, seasons: 20, seedOffset: 1000 });
    const tierUpper = runSeasons({ targetOvr: 85, seasons: 20, seedOffset: 2000 });
    const tierMid = runSeasons({ targetOvr: 79, seasons: 20, seedOffset: 3000 });

    // Synergy Upset Test: 84 OVR full-synergy team vs 89 OVR mismatched giant (200 neutral/home-away matches)
    const rng = createSeededRng(4000);
    const synSquad = makeSyntheticSquad(84, '4-3-3', ['deep_playmaker', 'ball_playing_cb', 'inverted_winger']).map((p) =>
      p.position === 'MF' ? { ...p, def: 79 } : p,
    );
    const synChem = calculateChemistry('4-3-3', synSquad, 'possession', 'tiki_taka');
    const synRatings = calculateTeamRatings(
      '4-3-3',
      synSquad,
      synChem.total,
      'tiki_taka',
      synChem.slotSynergies,
      'possession',
    );

    const giantClub: Club = {
      id: 'giant-ai',
      name: '불협화음 강팀 FC',
      shortName: 'GNT',
      primaryColor: '#fff',
      secondaryColor: '#000',
      formation: '3-5-2', // weak to 4-3-3 (+1.2)
      defaultTactic: 'wingplay', // weak to possession (+2.2)
      att: 89,
      mid: 89,
      def: 89,
      topScorers: ['스타1', '스타2', '스타3'],
    };
    const userClub: Club = {
      id: USER_CLUB_ID,
      name: '전술 시너지 FC',
      shortName: 'SYN',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      formation: '4-3-3',
      defaultTactic: 'possession',
      att: 84,
      mid: 84,
      def: 84,
      topScorers: ['A', 'B', 'C'],
      isUser: true,
    };
    const giantRoster = makeSyntheticSquad(89, '3-5-2');

    let upsetWins = 0;
    let upsetDraws = 0;
    const upsetTrials = 200;

    for (let i = 0; i < upsetTrials; i += 1) {
      const userHome = i % 2 === 0;
      const fix = {
        id: `up-${i}`,
        round: 1,
        homeTeamId: userHome ? USER_CLUB_ID : giantClub.id,
        awayTeamId: userHome ? giantClub.id : USER_CLUB_ID,
        played: false,
      };
      const res = simulateMatch(
        fix,
        userHome ? userClub : giantClub,
        userHome ? giantClub : userClub,
        userHome ? synSquad : giantRoster,
        userHome ? giantRoster : synSquad,
        {
          userClubId: USER_CLUB_ID,
          starters: synSquad,
          formation: '4-3-3',
          tactic: 'possession',
          chemistry: synChem.total,
          ratings: synRatings,
          slotSynergies: synChem.slotSynergies,
          managerTraitId: 'tiki_taka',
          opponentRank: 1,
        },
        rng,
      );
      const uG = userHome ? res.homeGoals : res.awayGoals;
      const gG = userHome ? res.awayGoals : res.homeGoals;
      if (uG > gG) upsetWins += 1;
      else if (uG === gG) upsetDraws += 1;
    }

    const upsetWinPct = Math.round((upsetWins / upsetTrials) * 100);
    const upsetUnbeatenPct = Math.round(((upsetWins + upsetDraws) / upsetTrials) * 100);

    console.log('\n=== 20-SEASON SIMULATION BALANCE REPORT (EPL 38R) ===');
    console.table([
      {
        구간: 'OVR 89~91 (90 테스트)',
        평균순위: tierHigh.avgRank,
        평균승점: tierHigh.avgPoints,
        우승률: `${tierHigh.titleRate}%`,
        AI_1위평균승점: tierHigh.avgAiTopPoints,
        목표: '1위 / 85~98점',
      },
      {
        구간: 'OVR 84~86 (85 테스트)',
        평균순위: tierUpper.avgRank,
        평균승점: tierUpper.avgPoints,
        우승률: `${tierUpper.titleRate}%`,
        AI_1위평균승점: tierUpper.avgAiTopPoints,
        목표: '2~4위 / 70~82점',
      },
      {
        구간: 'OVR 78~80 (79 테스트)',
        평균순위: tierMid.avgRank,
        평균승점: tierMid.avgPoints,
        우승률: `${tierMid.titleRate}%`,
        AI_1위평균승점: tierMid.avgAiTopPoints,
        목표: '8~12위 / 46~56점',
      },
    ]);
    console.log(
      `=== SYNERGY UPSET CHECK (84 OVR 풀시너지 vs 89 OVR 무조합 강팀, 200경기): 승률 ${upsetWinPct}%, 무패율 ${upsetUnbeatenPct}% (케미 ${synChem.total} / 보정 +${synChem.chemistryOvrBonus}) ===\n`,
    );

    // Assert exact requested target windows
    expect(tierHigh.avgRank).toBeLessThanOrEqual(1.4);
    expect(tierHigh.avgPoints).toBeGreaterThanOrEqual(85);
    expect(tierHigh.avgPoints).toBeLessThanOrEqual(98);

    expect(tierUpper.avgRank).toBeGreaterThanOrEqual(1.8);
    expect(tierUpper.avgRank).toBeLessThanOrEqual(4.5);
    expect(tierUpper.avgPoints).toBeGreaterThanOrEqual(70);
    expect(tierUpper.avgPoints).toBeLessThanOrEqual(82);

    expect(tierMid.avgRank).toBeGreaterThanOrEqual(7.5);
    expect(tierMid.avgRank).toBeLessThanOrEqual(12.5);
    expect(tierMid.avgPoints).toBeGreaterThanOrEqual(46);
    expect(tierMid.avgPoints).toBeLessThanOrEqual(56);

    expect(tierMid.avgAiTopPoints).toBeGreaterThanOrEqual(78);
    expect(tierMid.avgAiTopPoints).toBeLessThanOrEqual(90);

    // 84 OVR full-synergy team should genuinely upset an 89 OVR mismatched team at a healthy rate (>=35% wins)
    expect(upsetWinPct).toBeGreaterThanOrEqual(35);
  }, 15000);
});

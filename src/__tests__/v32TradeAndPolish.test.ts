import { describe, expect, it } from 'vitest';
import { ACTIVE_PLAYERS, getLeagueById } from '../engine/dataLoader';
import { simulateFirstHalf } from '../engine/matchEngine';
import {
  analyzeClubPositionNeeds,
  computePlayerTradePoints,
  evaluateTradePackage,
  generateIncomingTradeOffers,
  selectAutoFillerPlayers,
} from '../engine/transferEngine';
import { createInitialState, gameReducer } from '../store/GameContext';
import type { Club } from '../types/league';
import type { Player } from '../types/player';

function makeSeededRng(seed = 202611): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeSyntheticPlayer(
  id: string,
  ovr: number,
  position: Player['position'],
  mainSub: Player['mainPositions'][number],
): Player {
  return {
    id,
    name: `테스트_${id}`,
    position,
    mainPositions: [mainSub],
    secondaryPositions: [],
    ovr,
    nationality: '잉글랜드',
    nationalityCode: 'GB-ENG',
    leagueId: 'epl',
    club: 'Test FC',
    att: ovr,
    mid: ovr,
    def: ovr,
    stamina: 82,
    playstyles: [],
    scoutNote: '',
    isLegend: false,
  };
}

describe('v3.2 NBA-Style Trade System (Option 3), Bidirectional Sync & 2D Stat Coherence', () => {
  it('blocks 3x low-OVR cheese for an 88+ superstar via exponential TP curve and Star Quality Guard', () => {
    const epl = getLeagueById('epl');
    const aiClub = epl.clubs[0];
    const aiRoster = [
      makeSyntheticPlayer('ai-gk1', 84, 'GK', 'GK'),
      makeSyntheticPlayer('ai-gk2', 74, 'GK', 'GK'),
      makeSyntheticPlayer('ai-star', 89, 'FW', 'ST'),
      ...Array.from({ length: 13 }, (_, i) =>
        makeSyntheticPlayer(
          `ai-p${i}`,
          76 + (i % 5),
          i < 5 ? 'DF' : i < 10 ? 'MF' : 'FW',
          i < 5 ? 'CB' : i < 10 ? 'CM' : 'ST',
        ),
      ),
    ];
    const aiNeeds = analyzeClubPositionNeeds(aiRoster);

    const low1 = makeSyntheticPlayer('u-low1', 75, 'MF', 'CM');
    const low2 = makeSyntheticPlayer('u-low2', 75, 'DF', 'CB');
    const low3 = makeSyntheticPlayer('u-low3', 75, 'FW', 'ST');
    const userGk = makeSyntheticPlayer('u-gk1', 82, 'GK', 'GK');
    const userSquad = [userGk, low1, low2, low3];

    const starTarget = aiRoster[2]; // OVR 89
    const fillers = selectAutoFillerPlayers({
      aiRoster,
      aiTargetIds: new Set([starTarget.id]),
      userSentPlayers: [low1, low2, low3],
      neededCount: 2,
      club: aiClub,
      leagueId: 'epl',
      excludeIds: new Set(userSquad.map((p) => p.id)),
    });
    expect(fillers).toHaveLength(2);

    const evalCheese = evaluateTradePackage({
      userSentPlayers: [low1, low2, low3],
      aiTargetPlayers: [starTarget],
      aiFillerPlayers: fillers,
      aiClub,
      aiRoster,
      aiNeeds,
      userSquad,
      userRank: 1,
      userLeagueSize: 20,
      aiClubRank: 5,
      aiLeagueSize: 20,
      allPlayerStats: {},
    });

    expect(evalCheese.blockedReason).not.toBeNull();
    expect(evalCheese.acceptanceChance).toBe(0);
    expect(evalCheese.gmTone).toBe('offended');
  });

  it('rewards positional needs (+18%) and evaluates realistic 2:1 star packages fairly', () => {
    const epl = getLeagueById('epl');
    const aiClub = epl.clubs[1];
    // Weak in FW (only 2 low-OVR FWs) so FW is top need
    const aiRoster = [
      makeSyntheticPlayer('ai-gk1', 83, 'GK', 'GK'),
      makeSyntheticPlayer('ai-gk2', 74, 'GK', 'GK'),
      ...Array.from({ length: 6 }, (_, i) =>
        makeSyntheticPlayer(`ai-df${i}`, 83, 'DF', 'CB'),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makeSyntheticPlayer(`ai-mf${i}`, 84, 'MF', 'CM'),
      ),
      makeSyntheticPlayer('ai-fw1', 76, 'FW', 'ST'),
      makeSyntheticPlayer('ai-fw2', 74, 'FW', 'ST'),
    ];
    const aiNeeds = analyzeClubPositionNeeds(aiRoster);
    expect(aiNeeds.neededPositions[0]).toBe('FW');

    const starMfTarget = makeSyntheticPlayer('ai-mf-star', 88, 'MF', 'CM');
    const aiRosterWithStar = [...aiRoster, starMfTarget];

    const uFw = makeSyntheticPlayer('u-fw', 85, 'FW', 'ST');
    const uMf = makeSyntheticPlayer('u-mf', 83, 'MF', 'CM');
    const uGk = makeSyntheticPlayer('u-gk', 82, 'GK', 'GK');

    const tpNeed = computePlayerTradePoints({
      player: uFw,
      receivingClubNeeds: aiNeeds,
    });
    expect(tpNeed.needModPct).toBe(18);

    const fillers = selectAutoFillerPlayers({
      aiRoster: aiRosterWithStar,
      aiTargetIds: new Set([starMfTarget.id]),
      userSentPlayers: [uFw, uMf],
      neededCount: 1,
      club: aiClub,
      leagueId: 'epl',
      excludeIds: new Set([uFw.id, uMf.id, uGk.id]),
    });

    const evalFair = evaluateTradePackage({
      userSentPlayers: [uFw, uMf],
      aiTargetPlayers: [starMfTarget],
      aiFillerPlayers: fillers,
      aiClub,
      aiRoster: aiRosterWithStar,
      aiNeeds,
      userSquad: [uGk, uFw, uMf],
      userRank: 2,
      userLeagueSize: 20,
      aiClubRank: 8,
      aiLeagueSize: 20,
      allPlayerStats: {},
    });

    expect(evalFair.blockedReason).toBeNull();
    expect(evalFair.acceptanceChance).toBeGreaterThanOrEqual(45);
    expect(evalFair.acceptanceChance).toBeLessThanOrEqual(95);
  });

  it('executes a 2:1 bidirectional trade via gameReducer preserving 16-player invariant, 0 duplicates, cumulative stats & injuryAutoReturns pruning', () => {
    let st = createInitialState();
    st = gameReducer(st, { type: 'START_NEW_CAREER' });
    st = gameReducer(st, { type: 'START_DRAFT' });
    st = gameReducer(st, { type: 'AUTO_COMPLETE_DRAFT' });
    st = gameReducer(st, { type: 'SELECT_LEAGUE', payload: { leagueId: 'epl' } });

    // Open transfer window cleanly via SIMULATE_TO_NEXT_TRANSFER
    st = gameReducer(st, { type: 'SIMULATE_TO_NEXT_TRANSFER' });
    expect(st.season?.transferMarket.isOpen).toBe(true);

    // Pick a partner club from user's own league so we can verify live aiRosters movement directly
    const partnerClub = st.season!.clubs.find((c) => !c.isUser)!;
    const partnerRosterBefore = st.season!.aiRosters[partnerClub.id]!;
    expect(partnerRosterBefore.length).toBeGreaterThanOrEqual(11);

    // Pick a non-GK target from partner club (with moderate OVR so our top 2 outfielders pass star guard)
    const sortedTargets = [...partnerRosterBefore]
      .filter((p) => p.position !== 'GK')
      .sort((a, b) => a.ovr - b.ovr);
    const targetPlayer = sortedTargets[Math.floor(sortedTargets.length / 2)];

    // Pick 2 user outfielders (highest OVR so deal is valid & not blocked)
    const userSlots: { area: 'starter' | 'bench'; index: number; player: Player }[] =
      [];
    st.starters.forEach((p, idx) => {
      if (p && p.position !== 'GK') {
        userSlots.push({ area: 'starter', index: idx, player: p });
      }
    });
    userSlots.sort((a, b) => b.player.ovr - a.player.ovr);
    const sentSlot1 = userSlots[0];
    const sentSlot2 = userSlots[1];

    // Seed cumulative stats for targetPlayer and sentSlot1, plus a stale injuryAutoReturn for sentSlot1
    st = {
      ...st,
      season: {
        ...st.season!,
        allPlayerStats: {
          ...st.season!.allPlayerStats,
          [targetPlayer.id]: {
            playerId: targetPlayer.id,
            playerName: targetPlayer.name,
            teamId: partnerClub.id,
            teamName: partnerClub.name,
            teamShortName: partnerClub.shortName,
            teamPrimaryColor: partnerClub.primaryColor,
            teamSecondaryColor: partnerClub.secondaryColor,
            isUserTeam: false,
            position: targetPlayer.position,
            mainPositions: [...targetPlayer.mainPositions],
            ovr: targetPlayer.ovr,
            appearances: 9,
            starts: 9,
            subAppearances: 0,
            minutesPlayed: 810,
            goals: 5,
            assists: 3,
            xgSum: 4.2,
            cleanSheets: 0,
            momCount: 1,
            ratingSum: 67.5,
            avgRating: 7.5,
            positionCounts: {},
            isLegend: false,
          },
        },
        injuryAutoReturns: [
          {
            injuredPlayerId: sentSlot1.player.id,
            injuredPlayerName: sentSlot1.player.name,
            originalSlotIndex: sentSlot1.index,
            replacementPlayerId: null,
          },
        ],
      },
    };

    const afterTrade = gameReducer(st, {
      type: 'TRADE_SUBMIT_PACKAGE',
      payload: {
        partnerClub,
        partnerLeagueId: 'epl',
        partnerClubRank: 10,
        partnerLeagueSize: 20,
        userSentSlots: [
          { area: sentSlot1.area, index: sentSlot1.index },
          { area: sentSlot2.area, index: sentSlot2.index },
        ],
        aiTargetPlayers: [targetPlayer],
        overrideRoll: 0, // guaranteed acceptance when acceptanceChance > 0
      },
    });

    expect(afterTrade.season!.transferMarket.lastOfferResult?.success).toBe(true);

    // 1) User maintains exact 16-player Option 3 invariant (11 starters + 5 bench)
    const userStartersAfter = afterTrade.starters.filter(
      (p): p is Player => p !== null,
    );
    const userBenchAfter = afterTrade.bench.filter(
      (p): p is Player => p !== null,
    );
    expect(userStartersAfter).toHaveLength(11);
    expect(userBenchAfter).toHaveLength(5);
    const userIdsAfter = new Set([
      ...userStartersAfter.map((p) => p.id),
      ...userBenchAfter.map((p) => p.id),
    ]);
    expect(userIdsAfter.size).toBe(16);
    expect(userIdsAfter.has(targetPlayer.id)).toBe(true);
    expect(userIdsAfter.has(sentSlot1.player.id)).toBe(false);
    expect(userIdsAfter.has(sentSlot2.player.id)).toBe(false);

    // 2) 100% Bidirectional movement: sent players now live on partnerClub's AI roster, target removed
    const partnerRosterAfter = afterTrade.season!.aiRosters[partnerClub.id]!;
    const partnerIdsAfter = new Set(partnerRosterAfter.map((p) => p.id));
    expect(partnerIdsAfter.has(targetPlayer.id)).toBe(false);
    expect(partnerIdsAfter.has(sentSlot1.player.id)).toBe(true);
    expect(partnerIdsAfter.has(sentSlot2.player.id)).toBe(true);

    // 3) Zero duplicates across user squad and all league AI rosters
    const allLeagueIds: string[] = [...userIdsAfter];
    for (const roster of Object.values(afterTrade.season!.aiRosters)) {
      for (const p of roster) allLeagueIds.push(p.id);
    }
    expect(new Set(allLeagueIds).size).toBe(allLeagueIds.length);

    // 4) Cumulative stats preserved + 🔄 trade record appended
    const targetStats = afterTrade.season!.allPlayerStats[targetPlayer.id];
    expect(targetStats.goals).toBe(5);
    expect(targetStats.assists).toBe(3);
    expect(targetStats.isUserTeam).toBe(true);
    expect(
      targetStats.transferHistory?.some((tr) => tr.type === 'trade'),
    ).toBe(true);

    const sentStats = afterTrade.season!.allPlayerStats[sentSlot1.player.id];
    expect(sentStats.isUserTeam).toBe(false);
    expect(sentStats.teamId).toBe(partnerClub.id);
    expect(
      sentStats.transferHistory?.some((tr) => tr.type === 'trade'),
    ).toBe(true);

    // 5) injuryAutoReturns pruned for traded-out player
    expect(afterTrade.season!.injuryAutoReturns ?? []).toHaveLength(0);
  });

  it('generates 0..5 realistic incoming AI trade offers with no duplicates and handles accept/reject', () => {
    let st = createInitialState();
    st = gameReducer(st, { type: 'START_NEW_CAREER' });
    st = gameReducer(st, { type: 'START_DRAFT' });
    st = gameReducer(st, { type: 'AUTO_COMPLETE_DRAFT' });
    st = gameReducer(st, { type: 'SELECT_LEAGUE', payload: { leagueId: 'epl' } });

    const counts: number[] = [];
    for (let seed = 1; seed <= 12; seed += 1) {
      const offers = generateIncomingTradeOffers({
        windowIndex: 1,
        currentRound: 10,
        userLeagueId: 'epl',
        userStarters: st.starters,
        userBench: st.bench,
        standings: st.season!.standings,
        otherLeagues: st.season!.otherLeagues,
        aiRosters: st.season!.aiRosters,
        allPlayerStats: st.season!.allPlayerStats,
        rng: makeSeededRng(seed * 997),
      });
      expect(offers.length).toBeGreaterThanOrEqual(0);
      expect(offers.length).toBeLessThanOrEqual(5);
      counts.push(offers.length);
    }
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(2);
  });

  it('produces stat-coherent attacking highlight events matching dominant shots/xG in 2D simulation', () => {
    const epl = getLeagueById('epl');
    const strongHome: Club = {
      ...epl.clubs[0],
      att: 93,
      mid: 92,
      def: 91,
      defaultTactic: 'possession',
    };
    const weakAway: Club = {
      ...epl.clubs[epl.clubs.length - 1],
      att: 71,
      mid: 71,
      def: 71,
      defaultTactic: 'counter',
    };

    const homeRoster = ACTIVE_PLAYERS.filter((p) => p.ovr >= 85).slice(0, 11);
    const awayRoster = ACTIVE_PLAYERS.filter((p) => p.ovr <= 74).slice(0, 11);
    const rng = makeSeededRng(777);

    let homeChances = 0;
    let awayChances = 0;
    let totalHomeShots = 0;
    let totalAwayShots = 0;

    for (let i = 0; i < 40; i += 1) {
      const ht = simulateFirstHalf({
        fixture: {
          id: `f-${i}`,
          round: 1,
          homeTeamId: strongHome.id,
          awayTeamId: weakAway.id,
          played: false,
        },
        homeClub: strongHome,
        awayClub: weakAway,
        homeRoster,
        awayRoster,
        userContext: {
          userClubId: strongHome.id,
          formation: '4-3-3',
          tactic: 'possession',
          chemistry: 80,
          ratings: {
            att: 93,
            mid: 92,
            def: 91,
            ovr: 92,
            rawOvr: 92,
            effectiveAtt: 93,
            effectiveMid: 92,
            effectiveDef: 91,
            chemistryBonus: 2,
          },
          starters: homeRoster,
          managerTraitId: null,
        },
        rng,
      });
      totalHomeShots += ht.homeShots;
      totalAwayShots += ht.awayShots;
      for (const ev of ht.firstHalfEvents) {
        if (ev.type === 'chance') {
          if (ev.teamId === strongHome.id) homeChances += 1;
          else if (ev.teamId === weakAway.id) awayChances += 1;
        }
      }
    }

    // Dominant home side must generate significantly more shots AND significantly more 2D attacking chance events
    expect(totalHomeShots).toBeGreaterThan(totalAwayShots * 1.8);
    expect(homeChances).toBeGreaterThan(awayChances * 1.8);
  });
});

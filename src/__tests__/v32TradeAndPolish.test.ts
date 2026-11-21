import { describe, expect, it } from 'vitest';
import { computeFullPlayerOvrBreakdown } from '../engine/conditionEngine';
import {
  ACTIVE_PLAYERS,
  buildAiClubSquad16,
  getLeagueById,
  LEAGUES,
} from '../engine/dataLoader';
import { simulateFirstHalf } from '../engine/matchEngine';
import {
  analyzeClubPositionNeeds,
  buildTransferClubSquad,
  computePlayerTradePoints,
  evaluateTradePackage,
  generateIncomingTradeOffers,
  selectAutoFillerPlayers,
} from '../engine/transferEngine';
import { createInitialState, gameReducer } from '../store/GameContext';
import type { Club, LeagueId } from '../types/league';
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

describe('v3.2 / v3.3 NBA-Style Trade System, 16-Player AI Squad (11 Starters + 5 Core Bench), Shock Bargain & Condition OVR Breakdown', () => {
  it('heavily penalizes 3x low-OVR cheese for an 89 superstar without ever showing 0%', () => {
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

    // No 0% floor: miracle chance stays very low (2..10%) rather than 0%, still preventing easy cheese
    expect(evalCheese.blockedReason).toBeNull();
    expect(evalCheese.acceptanceChance).toBeGreaterThanOrEqual(2);
    expect(evalCheese.acceptanceChance).toBeLessThanOrEqual(10);
    expect(evalCheese.gmTone).toBe('offended');
  });

  it('rewards positional needs (+32% #1 need) and evaluates realistic 2:1 star packages generously', () => {
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
    expect(tpNeed.needModPct).toBe(32);

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
    expect(evalFair.acceptanceChance).toBeGreaterThanOrEqual(55);
    expect(evalFair.acceptanceChance).toBeLessThanOrEqual(96);
  });

  it('executes a 2:1 bidirectional trade via gameReducer preserving 16-player invariant, 0 duplicates, cumulative stats & injuryAutoReturns pruning', () => {
    let st = createInitialState();
    st = gameReducer(st, { type: 'START_NEW_CAREER' });
    st = gameReducer(st, { type: 'START_DRAFT' });
    st = gameReducer(st, { type: 'AUTO_COMPLETE_DRAFT' });
    st = gameReducer(st, { type: 'SELECT_LEAGUE', payload: { leagueId: 'epl' } });

    st = gameReducer(st, { type: 'SIMULATE_TO_NEXT_TRANSFER' });
    expect(st.season?.transferMarket.isOpen).toBe(true);

    const partnerClub = st.season!.clubs.find((c) => !c.isUser)!;
    const partnerRosterBefore = st.season!.aiRosters[partnerClub.id]!;
    expect(partnerRosterBefore.length).toBeGreaterThanOrEqual(11);

    const sortedTargets = [...partnerRosterBefore]
      .filter((p) => p.position !== 'GK')
      .sort((a, b) => a.ovr - b.ovr);
    const targetPlayer = sortedTargets[Math.floor(sortedTargets.length / 2)];

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
        overrideRoll: 0,
      },
    });

    expect(afterTrade.season!.transferMarket.lastOfferResult?.success).toBe(true);

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

    const partnerRosterAfter = afterTrade.season!.aiRosters[partnerClub.id]!;
    const partnerIdsAfter = new Set(partnerRosterAfter.map((p) => p.id));
    expect(partnerIdsAfter.has(targetPlayer.id)).toBe(false);
    expect(partnerIdsAfter.has(sentSlot1.player.id)).toBe(true);
    expect(partnerIdsAfter.has(sentSlot2.player.id)).toBe(true);

    const allLeagueIds: string[] = [...userIdsAfter];
    for (const roster of Object.values(afterTrade.season!.aiRosters)) {
      for (const p of roster) allLeagueIds.push(p.id);
    }
    expect(new Set(allLeagueIds).size).toBe(allLeagueIds.length);

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

    expect(afterTrade.season!.injuryAutoReturns ?? []).toHaveLength(0);
  });

  it('never generates contradictory incoming offers (e.g., asking for GK while selling GK) across 80 simulated windows', () => {
    let st = createInitialState();
    st = gameReducer(st, { type: 'START_NEW_CAREER' });
    st = gameReducer(st, { type: 'START_DRAFT' });
    st = gameReducer(st, { type: 'AUTO_COMPLETE_DRAFT' });
    st = gameReducer(st, { type: 'SELECT_LEAGUE', payload: { leagueId: 'epl' } });

    let totalOffersChecked = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      const offers = generateIncomingTradeOffers({
        windowIndex: (seed % 3) + 1,
        currentRound: 10,
        userLeagueId: 'epl',
        userStarters: st.starters,
        userBench: st.bench,
        standings: st.season!.standings,
        otherLeagues: st.season!.otherLeagues,
        aiRosters: st.season!.aiRosters,
        allPlayerStats: st.season!.allPlayerStats,
        rng: makeSeededRng(seed * 1301),
      });
      expect(offers.length).toBeGreaterThanOrEqual(0);
      expect(offers.length).toBeLessThanOrEqual(5);

      for (const offer of offers) {
        totalOffersChecked += 1;
        const aiOffered = offer.aiOffersPlayers[0];
        const userReq = offer.userRequestedPlayers[0];
        // Never offer the same position as the requested player!
        expect(aiOffered.position).not.toBe(userReq.position);
        // Never offer from AI's #1 needed position!
        expect(aiOffered.position).not.toBe(offer.clubNeeds.neededPositions[0]);
        // Never offer a GK if AI needs a GK!
        if (offer.clubNeeds.neededPositions.includes('GK')) {
          expect(aiOffered.position).not.toBe('GK');
        }
      }
    }
    expect(totalOffersChecked).toBeGreaterThan(80);
  });

  it('stress-tests 5 full seasons across all 5 Big-5 leagues (3 windows + trades + close + cup + UCL) with zero invariant failures', () => {
    const leagues: LeagueId[] = [
      'epl',
      'laliga',
      'seriea',
      'bundesliga',
      'ligue1',
    ];

    for (const leagueId of leagues) {
      let st = createInitialState();
      st = gameReducer(st, { type: 'START_NEW_CAREER' });
      st = gameReducer(st, { type: 'START_DRAFT' });
      st = gameReducer(st, { type: 'AUTO_COMPLETE_DRAFT' });
      st = gameReducer(st, { type: 'SELECT_LEAGUE', payload: { leagueId } });

      let windowsHandled = 0;
      let guard = 0;
      while (st.phase === 'season' && guard < 12) {
        guard += 1;
        st = gameReducer(st, { type: 'SIMULATE_TO_NEXT_TRANSFER' });
        if (st.phase !== 'season' || !st.season) break;

        if (st.season.transferMarket.isOpen) {
          windowsHandled += 1;
          // 1) Spin clubs
          st = gameReducer(st, { type: 'TRANSFER_SPIN_CLUBS' });
          expect(st.season!.transferMarket.hasSpunClubs).toBe(true);
          expect(st.season!.transferMarket.rolledClubs).toHaveLength(3);

          // 2) Accept first pending incoming offer if any
          const pendingInc = (st.season!.transferMarket.incomingOffers ?? []).find(
            (o) => o.status === 'pending',
          );
          if (pendingInc) {
            st = gameReducer(st, {
              type: 'TRADE_ACCEPT_INCOMING',
              payload: { offerId: pendingInc.id },
            });
          }

          // 3) Submit a 1:1 trade with first non-legend rolled club
          const clubOffer = st.season!.transferMarket.rolledClubs.find(
            (c) => !c.isLegendSlot && c.club && c.leagueId !== 'LEGEND',
          );
          if (clubOffer && clubOffer.club && clubOffer.leagueId !== 'LEGEND') {
            const target = clubOffer.squad.find(
              (t) =>
                t.player.position !== 'GK' &&
                !st.season!.transferMarket.signedPlayerIds.includes(t.player.id),
            );
            const userIdx = st.starters.findIndex(
              (p) => p !== null && p.position !== 'GK',
            );
            if (target && userIdx >= 0) {
              st = gameReducer(st, {
                type: 'TRADE_SUBMIT_PACKAGE',
                payload: {
                  partnerClub: clubOffer.club,
                  partnerLeagueId: clubOffer.leagueId,
                  partnerClubRank: clubOffer.clubRank,
                  partnerLeagueSize: clubOffer.leagueSize,
                  userSentSlots: [{ area: 'starter', index: userIdx }],
                  aiTargetPlayers: [target.player],
                  overrideRoll: 0,
                },
              });
            }
          }

          // 4) Close transfer window cleanly
          st = gameReducer(st, { type: 'TRANSFER_CLOSE_WINDOW' });
          expect(st.season!.transferMarket.isOpen).toBe(false);

          // Assert 16-player invariant + >= 1 GK + 0 duplicates in user league
          const uStarters = st.starters.filter((p): p is Player => p !== null);
          const uBench = st.bench.filter((p): p is Player => p !== null);
          expect(uStarters).toHaveLength(11);
          expect(uBench).toHaveLength(5);
          const allUser = [...uStarters, ...uBench];
          expect(allUser.some((p) => p.position === 'GK')).toBe(true);

          const seenIds = new Set(allUser.map((p) => p.id));
          expect(seenIds.size).toBe(16);
          for (const roster of Object.values(st.season!.aiRosters)) {
            expect(roster.length).toBeGreaterThanOrEqual(11);
            for (const p of roster) {
              expect(seenIds.has(p.id)).toBe(false);
              seenIds.add(p.id);
            }
          }
          // Also verify zero duplicates across all 4 background otherLeagues
          for (const ol of Object.values(st.season!.otherLeagues)) {
            if (!ol?.aiRosters) continue;
            for (const roster of Object.values(ol.aiRosters)) {
              for (const p of roster) {
                expect(seenIds.has(p.id)).toBe(false);
                seenIds.add(p.id);
              }
            }
          }
        }
      }

      expect(windowsHandled).toBe(3);
      expect(st.phase).toBe('season_end');
      expect(st.season?.currentRound).toBe(st.season?.totalRounds);
      expect(st.season?.awards).not.toBeNull();

      // If user finished Top 4, also verify UCL Special Transfer open -> trade -> close -> League Phase -> completion
      const userStandingIdx = st.season!.standings.findIndex((r) => r.isUser);
      if (userStandingIdx >= 0 && userStandingIdx < 4) {
        st = gameReducer(st, { type: 'ENTER_UCL_MODE' });
        expect(st.phase).toBe('ucl');
        expect(st.season?.transferMarket.isOpen).toBe(true);
        expect(st.season?.ucl?.stage).toBe('special_transfer');

        st = gameReducer(st, { type: 'TRANSFER_SPIN_CLUBS' });
        st = gameReducer(st, { type: 'TRANSFER_CLOSE_WINDOW' });
        expect(st.season?.transferMarket.isOpen).toBe(false);
        expect(st.season?.ucl?.stage).toBe('league_phase');

        st = gameReducer(st, { type: 'SIMULATE_UCL_LEAGUE_PHASE_TO_END' });
        expect(st.season?.ucl?.leaguePhaseRound).toBe(8);
        st = gameReducer(st, { type: 'SIMULATE_UCL_TO_END' });
        expect(st.season?.ucl?.completed).toBe(true);
      }
    }
  }, 45000);

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

    expect(totalHomeShots).toBeGreaterThan(totalAwayShots * 1.8);
    expect(homeChances).toBeGreaterThan(awayChances * 1.8);
  });

  it('guarantees all 96 clubs across 5 leagues have full activePlayers depth and buildAiClubSquad16 / buildTransferClubSquad produce 11 starters + 5 core bench (GK 1, DF 2, FW/MF 2)', () => {
    for (const league of LEAGUES) {
      for (const club of league.clubs) {
        const clubPlayers = ACTIVE_PLAYERS.filter(
          (p) => p.leagueId === league.id && p.club === club.name,
        );
        expect(clubPlayers.length).toBeGreaterThanOrEqual(20);
        expect(
          clubPlayers.filter((p) => p.position === 'GK').length,
        ).toBeGreaterThanOrEqual(2);
        expect(
          clubPlayers.filter((p) => p.position === 'DF').length,
        ).toBeGreaterThanOrEqual(6);
        expect(
          clubPlayers.filter((p) => p.position === 'MF').length,
        ).toBeGreaterThanOrEqual(5);
        expect(
          clubPlayers.filter((p) => p.position === 'FW').length,
        ).toBeGreaterThanOrEqual(4);

        const sq16 = buildAiClubSquad16({
          club,
          leagueId: league.id,
          excludeIds: new Set(),
        });
        expect(sq16.starters).toHaveLength(11);
        expect(sq16.bench).toHaveLength(5);
        expect(sq16.all16).toHaveLength(16);

        // Verify 5-man core bench composition: 1 GK, 2 DF, 2 FW/MF
        expect(sq16.bench[0].position).toBe('GK');
        expect(sq16.bench[1].position).toBe('DF');
        expect(sq16.bench[2].position).toBe('DF');
        expect(['MF', 'FW']).toContain(sq16.bench[3].position);
        expect(['MF', 'FW']).toContain(sq16.bench[4].position);

        // Verify trade market buildTransferClubSquad also exposes all 16 (11 starters + 5 bench) even when live aiRoster has 11 players
        const tradeSquad = buildTransferClubSquad({
          club,
          leagueId: league.id,
          ownedIds: new Set(),
          excludeIds: new Set(),
          aiRoster: sq16.starters, // simulate 11-player live aiRoster
          clubRank: 5,
          leagueSize: league.clubs.length,
          currentRound: 9,
          totalRounds: 38,
          windowIndex: 1,
          userRank: 1,
          userLeagueSize: 20,
          allPlayerStats: {},
          isUserLeague: true,
        });
        expect(tradeSquad).toHaveLength(16);
        expect(tradeSquad.filter((t) => t.isStarter)).toHaveLength(11);
        expect(tradeSquad.filter((t) => !t.isStarter)).toHaveLength(5);
      }
    }
  });

  it('applies -35% shock bargain discount and waives 87+ star guard when a superstar is on shock fire-sale', () => {
    const epl = getLeagueById('epl');
    const aiClub = epl.clubs[0];
    const starTarget = makeSyntheticPlayer('ai-donic-star', 90, 'FW', 'ST');
    const aiRoster = [
      makeSyntheticPlayer('ai-gk1', 84, 'GK', 'GK'),
      makeSyntheticPlayer('ai-gk2', 75, 'GK', 'GK'),
      starTarget,
      ...Array.from({ length: 13 }, (_, i) =>
        makeSyntheticPlayer(
          `ai-p${i}`,
          78 + (i % 4),
          i < 5 ? 'DF' : i < 10 ? 'MF' : 'FW',
          i < 5 ? 'CB' : i < 10 ? 'CM' : 'ST',
        ),
      ),
    ];
    const aiNeeds = analyzeClubPositionNeeds(aiRoster);

    const normalValuation = computePlayerTradePoints({
      player: starTarget,
      isShockBargain: false,
    });
    const bargainValuation = computePlayerTradePoints({
      player: starTarget,
      isShockBargain: true,
    });
    expect(bargainValuation.isShockBargain).toBe(true);
    expect(bargainValuation.bargainModPct).toBe(-35);
    expect(bargainValuation.effectiveTp).toBeLessThan(
      normalValuation.effectiveTp * 0.72,
    );

    const u1 = makeSyntheticPlayer('u-p1', 82, 'DF', 'CB');
    const u2 = makeSyntheticPlayer('u-p2', 81, 'MF', 'CM');
    const uGk = makeSyntheticPlayer('u-gk', 82, 'GK', 'GK');
    const fillers = selectAutoFillerPlayers({
      aiRoster,
      aiTargetIds: new Set([starTarget.id]),
      userSentPlayers: [u1, u2],
      neededCount: 1,
      club: aiClub,
      leagueId: 'epl',
      excludeIds: new Set([u1.id, u2.id, uGk.id]),
    });

    const evalNormal = evaluateTradePackage({
      userSentPlayers: [u1, u2],
      aiTargetPlayers: [starTarget],
      aiFillerPlayers: fillers,
      aiClub,
      aiRoster,
      aiNeeds,
      userSquad: [uGk, u1, u2],
      userRank: 3,
      userLeagueSize: 20,
      aiClubRank: 6,
      aiLeagueSize: 20,
      allPlayerStats: {},
    });
    const evalShock = evaluateTradePackage({
      userSentPlayers: [u1, u2],
      aiTargetPlayers: [starTarget],
      aiFillerPlayers: fillers,
      aiClub,
      aiRoster,
      aiNeeds,
      userSquad: [uGk, u1, u2],
      userRank: 3,
      userLeagueSize: 20,
      aiClubRank: 6,
      aiLeagueSize: 20,
      allPlayerStats: {},
      shockBargainIds: new Set([starTarget.id]),
    });

    expect(evalShock.acceptanceChance).toBeGreaterThan(
      evalNormal.acceptanceChance + 20,
    );
  });

  it('computes full player OVR breakdown (base + position + synergy + morale + injury -> finalEffectiveOvr)', () => {
    const healthyFlame = computeFullPlayerOvrBreakdown({
      baseOvr: 86,
      positionPenalty: 0,
      synergyBonus: 2,
      condition: {
        morale: 4, // 최상 (+2)
        injury: null,
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 3,
        recentGoalDrought: 0,
      },
    });
    expect(healthyFlame.moraleBonus).toBe(2);
    expect(healthyFlame.injuryPenalty).toBe(0);
    expect(healthyFlame.finalEffectiveOvr).toBe(90);
    expect(healthyFlame.summaryLine).toContain('최종 실효 OVR 90');

    const minorInjuredFrozen = computeFullPlayerOvrBreakdown({
      baseOvr: 85,
      positionPenalty: -3,
      synergyBonus: 1,
      condition: {
        morale: -4, // 최악 (-2)
        injury: {
          id: 'inj-1',
          name: '발목 타박상',
          severity: 'minor',
          matchesRemaining: 2,
          initialMatches: 2,
          canPlayThrough: true,
          playThroughPenalty: -3,
          recoveryMatchesRemaining: 0,
          occurredRound: 5,
          occurredCompetition: 'league',
        },
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 1,
        recentGoalDrought: 0,
      },
    });
    expect(minorInjuredFrozen.moraleBonus).toBe(-2);
    expect(minorInjuredFrozen.injuryPenalty).toBe(-3);
    expect(minorInjuredFrozen.isUnavailableInjured).toBe(false);
    expect(minorInjuredFrozen.finalEffectiveOvr).toBe(85 - 3 + 1 - 2 - 3);
  });
});

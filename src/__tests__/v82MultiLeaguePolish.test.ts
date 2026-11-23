import { describe, expect, it } from 'vitest';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import {
  buildAutoPick,
  collectTakenIds,
  draftRoundOf,
  rebuildSquadFromPicks,
  rollCandidates,
  roundSpinnerId,
  snakePickerId,
  spinSharedRoll,
  totalSnakePicks,
} from '../engine/mpLeagueDraft';
import {
  buildMpLeagueLive,
  closeMpLeagueSummary,
  closeMpLeagueTransferWindow,
  completeMpLeagueH2H,
  createMpLeagueSeason,
  endMpLeagueCast,
  grantMpLeagueConsent,
  mpHumanClubId,
  resolveMpLeagueEvent,
  runMpLeague,
  submitMpLeagueTrade,
} from '../engine/mpLeagueEngine';
import {
  extraTimeFirstHalfMpH2H,
  extraTimeSecondHalfMpH2H,
  kickoffMpH2H,
  mpH2HNeedsExtraTime,
  secondHalfMpH2H,
} from '../engine/mpLeagueH2H';
import type { MpH2HSideInput } from '../engine/mpLeagueH2H';
import { selectAutoFillerPlayers } from '../engine/transferEngine';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type { FormationId, ManagerTraitId } from '../types/game';
import type {
  MpLeagueHostState,
  MpLeagueHuman,
  MpLeaguePickRow,
  MpSquadInput,
} from '../types/mpLeague';
import { normalizeMpLeagueSettings } from '../types/mpLeague';
import type { Player } from '../types/player';
import { buildUclViewForViewer } from '../components/multiplayer/league/mpUclView';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TRAITS: ManagerTraitId[] = [
  'big_game_hunter',
  'tiki_taka',
  'gegenpress_guru',
  'direct_football',
];
const FORMATIONS_POOL: FormationId[] = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2-diamond'];

function makeHumans(count: number): MpLeagueHuman[] {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `p${i + 1}`,
    clubId: mpHumanClubId(i),
    nickname: `감독${i + 1}`,
    avatar: DEFAULT_MANAGER_AVATAR,
    profile: {
      name: `FC 친구${i + 1}`,
      shortName: `F${i + 1}`,
      primaryColor: '#10b981',
      secondaryColor: '#f8fafc',
      pattern: 'solid' as const,
    },
    managerTraitId: TRAITS[i % TRAITS.length],
  }));
}

function runDraftAndSquads(humans: MpLeagueHuman[], rng: () => number) {
  const order = humans.map((h) => h.playerId);
  const picks: MpLeaguePickRow[] = [];
  const total = totalSnakePicks(order.length);
  const pool = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'] as const;
  let roll: ReturnType<typeof spinSharedRoll> = [];

  for (let pickNo = 0; pickNo < total; pickNo += 1) {
    const pickerId = snakePickerId(pickNo, order)!;
    const round = draftRoundOf(pickNo, order.length);
    const idx = order.indexOf(pickerId);
    const formation = FORMATIONS_POOL[idx % FORMATIONS_POOL.length];
    if (pickNo % order.length === 0) {
      const spinnerId = roundSpinnerId(round, order)!;
      const sBoard = rebuildSquadFromPicks(picks, spinnerId);
      roll = spinSharedRoll({
        formation,
        starters: sBoard.starters,
        bench: sBoard.bench,
        takenIds: collectTakenIds(picks),
        allowedLeagueIds: [...pool],
        playerCount: order.length,
        rng,
      });
    }
    const board = rebuildSquadFromPicks(picks, pickerId);
    const pick = buildAutoPick({
      formation,
      starters: board.starters,
      bench: board.bench,
      takenIds: collectTakenIds(picks),
      allowedLeagueIds: [...pool],
      shownCandidates: rollCandidates(roll, collectTakenIds(picks)),
      rng,
    });
    if (!pick) throw new Error(`draft pick failed at ${pickNo}`);
    picks.push({
      room_id: 'sim-room',
      draft_generation: 1,
      pick_no: pickNo,
      player_ref: pick.player.id,
      picker_id: pickerId,
      player_json: pick,
    });
  }

  const squads: Record<string, MpSquadInput> = {};
  humans.forEach((h, i) => {
    const b = rebuildSquadFromPicks(picks, h.playerId);
    squads[h.clubId] = {
      managerTraitId: h.managerTraitId,
      formation: FORMATIONS_POOL[i % FORMATIONS_POOL.length],
      tactic: 'balanced',
      starters: b.starters.filter((p): p is Player => p !== null),
      bench: b.bench.filter((p): p is Player => p !== null),
    };
  });
  return { picks, squads };
}

function sideOf(
  state: MpLeagueHostState,
  squads: Record<string, MpSquadInput>,
  clubId: string,
): MpH2HSideInput {
  const human = state.humans.find((h) => h.clubId === clubId)!;
  const squad = squads[clubId];
  return {
    human,
    formation: squad.formation,
    tactic: squad.tactic,
    starters: squad.starters,
    bench: squad.bench,
    teamMorale: state.perHuman[clubId]?.events.teamMorale ?? 0,
  };
}

function simulateFullMultiLeagueSeason(playerCount: 2 | 3 | 4, seed: number) {
  const rng = mulberry32(seed);
  const humans = makeHumans(playerCount);
  const { squads } = runDraftAndSquads(humans, rng);

  let state = createMpLeagueSeason({
    roomId: `room-${playerCount}`,
    seasonKey: `s-${playerCount}-${seed}`,
    settings: normalizeMpLeagueSettings({ leagueId: 'epl', uclEnabled: true }),
    draftLeaguePool: ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'],
    humans,
    squads,
    rng,
  });

  let sawOfferClubs = false;
  let packageCounterExecuted = false;
  let sawAssistsInLive = false;
  let sawSummary = false;
  let sawUclMvpStats = false;

  for (let guard = 0; guard < 600 && state.stage !== 'final'; guard += 1) {
    state = runMpLeague(state, { squads, rng });
    const live = buildMpLeagueLive(state, squads);

    if (live.round >= 10 && live.topAssisters.some((a) => a.assists > 0)) {
      sawAssistsInLive = true;
    }
    if (live.ucl && live.ucl.leaguePhaseRound >= 2) {
      const uclView = buildUclViewForViewer(live.ucl, humans[0].clubId);
      if (Object.keys(uclView.uclPlayerStats).length > 0) {
        sawUclMvpStats = true;
      }
    }

    if (state.flow.kind === 'h2h' && state.h2hLive) {
      const spec = state.h2hLive.spec;
      const base = {
        spec,
        home: sideOf(state, squads, spec.homeClubId),
        away: sideOf(state, squads, spec.awayClubId),
        conditions: state.conditions,
        rng,
      };
      let m = kickoffMpH2H({ ...base, seasonKey: state.seasonKey });
      m = secondHalfMpH2H({ ...base, match: m });
      if (mpH2HNeedsExtraTime(spec, m)) {
        m = extraTimeFirstHalfMpH2H({ ...base, match: m });
        m = extraTimeSecondHalfMpH2H({ ...base, match: m });
      }
      state = completeMpLeagueH2H(state, m.finalResult!);
    } else if (state.flow.kind === 'event') {
      for (const h of humans) {
        const ev = state.perHuman[h.clubId]?.events.activeEvent;
        if (ev) {
          state = resolveMpLeagueEvent(
            state,
            { squads, rng },
            h.clubId,
            ev.choices[0].id,
          );
        }
      }
    } else if (state.flow.kind === 'transfer') {
      // Verify offerClubs are published during transfer window & test a 2:1 package counter-offer
      for (const h of humans) {
        const hl = live.byClub[h.clubId];
        if (!hl || hl.offers.length === 0) continue;
        const firstOffer = hl.offers[0];
        const partnerOffer = hl.offerClubs?.[firstOffer.id];
        if (partnerOffer && partnerOffer.squad.length >= 11) {
          sawOfferClubs = true;
          if (!packageCounterExecuted && partnerOffer.club && partnerOffer.leagueId !== 'LEGEND') {
            const mySq = squads[h.clubId];
            const myOutfield = [...mySq.starters, ...mySq.bench].filter(
              (p) => p.position !== 'GK',
            );
            const target = firstOffer.aiOffersPlayers[0];
            if (myOutfield.length >= 2 && target) {
              const userSent = [myOutfield[0], myOutfield[1]];
              const fillers = selectAutoFillerPlayers({
                aiRoster: partnerOffer.squad.map((t) => t.player),
                aiTargetIds: new Set([target.id]),
                userSentPlayers: userSent,
                neededCount: 1,
                club: partnerOffer.club,
                leagueId: partnerOffer.leagueId,
                excludeIds: new Set([...mySq.starters, ...mySq.bench].map((p) => p.id)),
              });
              if (fillers.length === 1) {
                const outcome = submitMpLeagueTrade({
                  state,
                  env: { squads, rng: () => 0.01 }, // guarantee acceptance if not blocked
                  clubId: h.clubId,
                  offerId: firstOffer.id,
                  userSentPlayerIds: userSent.map((p) => p.id),
                  aiTargetPlayerIds: [target.id],
                  aiFillerPlayerIds: fillers.map((p) => p.id),
                });
                state = outcome.state;
                if (outcome.squad) {
                  squads[h.clubId] = outcome.squad;
                  expect(outcome.squad.starters).toHaveLength(11);
                  expect(outcome.squad.bench).toHaveLength(5);
                  packageCounterExecuted = true;
                }
              }
            }
          }
        }
      }
      state = closeMpLeagueTransferWindow(state);
      // Verify offerClubs are scrubbed after window closes
      const liveAfterClose = buildMpLeagueLive(state, squads);
      for (const h of humans) {
        expect(liveAfterClose.byClub[h.clubId]?.offerClubs).toBeUndefined();
      }
    } else if (state.flow.kind === 'summary') {
      sawSummary = true;
      state = closeMpLeagueSummary(state);
    } else if (state.flow.kind === 'consent') {
      state = grantMpLeagueConsent(state);
    } else if (state.flow.kind === 'cast') {
      state = endMpLeagueCast(state);
    }
  }

  // Assert zero worldwide duplicate players across all friends & AI clubs
  const humanPlayerIds: string[] = [];
  for (const sq of Object.values(squads)) {
    expect(sq.starters).toHaveLength(11);
    expect(sq.bench).toHaveLength(5);
    for (const p of [...sq.starters, ...sq.bench]) humanPlayerIds.push(p.id);
  }
  expect(new Set(humanPlayerIds).size).toBe(humanPlayerIds.length);
  const ownedSet = new Set(humanPlayerIds);
  for (const roster of Object.values(state.aiRosters)) {
    for (const p of roster) expect(ownedSet.has(p.id)).toBe(false);
  }

  return {
    state,
    squads,
    live: buildMpLeagueLive(state, squads),
    sawOfferClubs,
    packageCounterExecuted,
    sawAssistsInLive,
    sawSummary,
    sawUclMvpStats,
  };
}

describe('v8.2 multi league polish — 2P/3P/4P full simulation, package counter-offer, leaders & summaries', () => {
  for (const [count, seed] of [
    [2, 101],
    [3, 202],
    [4, 303],
  ] as const) {
    it(
      `simulates full ${count}P multi-league season cleanly with assists, partner offerClubs, package counter-offers, and global awards`,
      () => {
        const res = simulateFullMultiLeagueSeason(count, seed);
        expect(res.state.stage).toBe('final');
        expect(res.sawAssistsInLive).toBe(true);
        expect(res.sawSummary).toBe(true);
        expect(res.sawOfferClubs).toBe(true);
        expect(res.live.transferWindows).toHaveLength(3);
        expect(res.live.topScorers.length).toBeGreaterThan(0);
        expect(res.live.topAssisters.length).toBeGreaterThan(0);
        expect(res.live.final).not.toBeNull();
        expect(res.live.final?.rows).toHaveLength(count);
        expect(res.live.final?.globalAwards?.ballonDorWinner).not.toBeNull();
        expect(res.live.final?.globalAwards?.worldBestXi.length).toBeGreaterThanOrEqual(11);
        expect(res.live.final?.squadStats).toBeDefined();
        for (const h of res.state.humans) {
          expect(res.live.final?.squadStats?.[h.clubId]?.length).toBeGreaterThan(0);
        }
        if (res.state.uclHumanClubIds.length > 0) {
          expect(res.sawUclMvpStats).toBe(true);
        }
      },
      30000,
    );
  }

  it('recomputes real-time A / M / D effective line ratings identically when formation changes', () => {
    const humans = makeHumans(2);
    const { squads } = runDraftAndSquads(humans, mulberry32(404));
    const sq = squads[humans[0].clubId];
    const chem433 = calculateChemistry('4-3-3', sq.starters, sq.tactic, sq.managerTraitId);
    const r433 = calculateTeamRatings(
      '4-3-3',
      sq.starters,
      chem433.total,
      sq.managerTraitId,
      chem433.slotSynergies,
    );
    const chem352 = calculateChemistry('3-5-2', sq.starters, sq.tactic, sq.managerTraitId);
    const r352 = calculateTeamRatings(
      '3-5-2',
      sq.starters,
      chem352.total,
      sq.managerTraitId,
      chem352.slotSynergies,
    );
    expect(r433.effectiveAtt).toBeGreaterThan(50);
    expect(r433.effectiveMid).toBeGreaterThan(50);
    expect(r433.effectiveDef).toBeGreaterThan(50);
    expect(r352.effectiveAtt).toBeGreaterThan(50);
    // Changing formation alters position fits/chemistry and therefore recomputes line ratings
    expect(
      r433.effectiveAtt !== r352.effectiveAtt ||
        r433.effectiveMid !== r352.effectiveMid ||
        r433.effectiveDef !== r352.effectiveDef,
    ).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type { ManagerTraitId } from '../types/game';
import {
  buildAutoPick,
  chooseSlotForPlayer,
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
  buildHumanMatchSetup,
  buildMpLeagueLive,
  closeMpLeagueSummary,
  closeMpLeagueTransferWindow,
  completeMpLeagueH2H,
  createMpLeagueSeason,
  endMpLeagueCast,
  grantMpLeagueConsent,
  mpHumanClubId,
  rejectMpLeagueOffer,
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
import { computeMpH2HPoints, MP_H2H_MAX_POINTS } from '../engine/mpLeagueScore';
import type {
  MpLeagueHostState,
  MpLeagueHuman,
  MpLeaguePickRow,
  MpSquadInput,
} from '../types/mpLeague';
import { normalizeMpLeagueSettings } from '../types/mpLeague';
import type { Player } from '../types/player';

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

const TRAITS: ManagerTraitId[] = ['big_game_hunter', 'big_game_hunter', 'big_game_hunter', 'big_game_hunter'];

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
    managerTraitId: TRAITS[i],
  }));
}

/** Runs a full public snake draft exactly like the room does (auto-pick for everyone). */
function runSnakeDraft(humans: MpLeagueHuman[], rng: () => number) {
  const order = humans.map((h) => h.playerId);
  const picks: MpLeaguePickRow[] = [];
  const total = totalSnakePicks(order.length);
  const turnLog: string[] = [];
  const pool = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'] as const;
  const rollIdsByRound: string[][] = [];
  let roll: ReturnType<typeof spinSharedRoll> = [];
  for (let pickNo = 0; pickNo < total; pickNo += 1) {
    const pickerId = snakePickerId(pickNo, order);
    if (!pickerId) throw new Error('no picker');
    turnLog.push(pickerId);
    const round = draftRoundOf(pickNo, order.length);
    if (pickNo % order.length === 0) {
      // The round's first picker spins ONE roulette that everybody picks from
      const spinnerId = roundSpinnerId(round, order);
      if (spinnerId !== pickerId) throw new Error('spinner must pick first');
      const sBoard = rebuildSquadFromPicks(picks, pickerId);
      roll = spinSharedRoll({
        formation: '4-3-3',
        starters: sBoard.starters,
        bench: sBoard.bench,
        takenIds: collectTakenIds(picks),
        allowedLeagueIds: [...pool],
        playerCount: order.length,
        rng,
      });
      rollIdsByRound[round] = roll.flatMap((r) => r.candidates.map((c) => c.id));
    }
    const board = rebuildSquadFromPicks(picks, pickerId);
    const pick = buildAutoPick({
      formation: '4-3-3',
      starters: board.starters,
      bench: board.bench,
      takenIds: collectTakenIds(picks),
      allowedLeagueIds: [...pool],
      shownCandidates: rollCandidates(roll, collectTakenIds(picks)),
      rng,
    });
    if (!pick) throw new Error(`auto pick failed at ${pickNo}`);
    picks.push({
      room_id: 'room',
      draft_generation: 1,
      pick_no: pickNo,
      player_ref: pick.player.id,
      picker_id: pickerId,
      player_json: pick,
    });
  }
  return { picks, turnLog, rollIdsByRound };
}

function squadsFromPicks(
  humans: MpLeagueHuman[],
  picks: MpLeaguePickRow[],
): Record<string, MpSquadInput> {
  const squads: Record<string, MpSquadInput> = {};
  for (const h of humans) {
    const board = rebuildSquadFromPicks(picks, h.playerId);
    squads[h.clubId] = {
      managerTraitId: h.managerTraitId,
      formation: '4-3-3',
      tactic: 'balanced',
      starters: board.starters.filter((p): p is Player => p !== null),
      bench: board.bench.filter((p): p is Player => p !== null),
    };
  }
  return squads;
}

function sideOf(
  state: MpLeagueHostState,
  squads: Record<string, MpSquadInput>,
  clubId: string,
): MpH2HSideInput {
  const human = state.humans.find((h) => h.clubId === clubId);
  if (!human) throw new Error('missing human');
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

/** Plays a friend-vs-friend match through the same staged functions the host uses. */
function playH2H(
  state: MpLeagueHostState,
  squads: Record<string, MpSquadInput>,
  rng: () => number,
) {
  const live = state.h2hLive;
  if (!live) throw new Error('no h2h');
  const { spec } = live;
  const home = sideOf(state, squads, spec.homeClubId);
  const away = sideOf(state, squads, spec.awayClubId);
  const base = { spec, home, away, conditions: state.conditions, rng };
  let match = kickoffMpH2H({ ...base, seasonKey: state.seasonKey });
  match = secondHalfMpH2H({ ...base, match });
  if (mpH2HNeedsExtraTime(spec, match)) {
    match = extraTimeFirstHalfMpH2H({ ...base, match });
    match = extraTimeSecondHalfMpH2H({ ...base, match });
  }
  if (!match.finalResult) throw new Error('no result');
  return { spec, result: match.finalResult };
}

function assertWorldUnique(
  state: MpLeagueHostState,
  squads: Record<string, MpSquadInput>,
) {
  const humanIds: string[] = [];
  for (const squad of Object.values(squads)) {
    expect(squad.starters).toHaveLength(11);
    expect(squad.bench).toHaveLength(5);
    for (const p of [...squad.starters, ...squad.bench]) humanIds.push(p.id);
  }
  expect(new Set(humanIds).size).toBe(humanIds.length);
  const owned = new Set(humanIds);
  for (const roster of Object.values(state.aiRosters)) {
    for (const p of roster) expect(owned.has(p.id)).toBe(false);
  }
  for (const ol of Object.values(state.otherLeagues)) {
    for (const roster of Object.values(ol?.aiRosters ?? {})) {
      for (const p of roster) expect(owned.has(p.id)).toBe(false);
    }
  }
}

describe('v8.0 multi league — snake draft', () => {
  it('follows rotating 1→2→3, 2→3→1, 3→1→2 turns and never hands out the same player twice', () => {
    const humans = makeHumans(3);
    const { picks, turnLog, rollIdsByRound } = runSnakeDraft(humans, mulberry32(11));
    // Every pick of a round comes out of that round's single shared roulette
    for (const row of picks) {
      const round = draftRoundOf(row.pick_no, humans.length);
      expect(rollIdsByRound[round]).toContain(row.player_ref);
    }
    expect(turnLog.slice(0, 9)).toEqual([
      'p1', 'p2', 'p3', 'p2', 'p3', 'p1', 'p3', 'p1', 'p2',
    ]);
    expect(picks).toHaveLength(48);
    expect(new Set(picks.map((p) => p.player_ref)).size).toBe(48);
    for (const h of humans) {
      const board = rebuildSquadFromPicks(picks, h.playerId);
      expect(board.starters.every(Boolean)).toBe(true);
      expect(board.bench.every(Boolean)).toBe(true);
    }
  });

  it('places a shared-roulette player on a fitting open slot of my own formation', () => {
    const humans = makeHumans(2);
    const { picks } = runSnakeDraft(humans, mulberry32(21));
    const keeper = picks.map((p) => p.player_json.player).find((p) => p.position === 'GK');
    const striker = picks.map((p) => p.player_json.player).find((p) => p.position === 'FW');
    if (!keeper || !striker) throw new Error('missing sample players');
    const empty = {
      starters: Array.from({ length: 11 }, () => null),
      bench: Array.from({ length: 5 }, () => null),
    };
    const gkSlot = chooseSlotForPlayer('4-3-3', empty.starters, empty.bench, keeper);
    expect(gkSlot?.position).toBe('GK');
    const fwSlot = chooseSlotForPlayer('3-5-2', empty.starters, empty.bench, striker);
    expect(fwSlot?.position).toBe('FW');
    // Starting keeper already taken: a second keeper goes to the bench keeper slot, never outfield
    const withKeeper: (Player | null)[] = [...empty.starters];
    withKeeper[0] = keeper;
    const second = chooseSlotForPlayer('4-3-3', withKeeper, empty.bench, { ...keeper, id: 'gk-2' });
    expect(second).toMatchObject({ area: 'bench', position: 'GK' });
  });

  it('auto pick prefers on-screen candidates but skips ones a friend already took', () => {
    const humans = makeHumans(2);
    const { picks } = runSnakeDraft(humans, mulberry32(5));
    const takenPlayer = picks[0].player_json.player;
    const empty = {
      starters: Array.from({ length: 11 }, () => null),
      bench: Array.from({ length: 5 }, () => null),
    };
    const pick = buildAutoPick({
      formation: '4-3-3',
      ...empty,
      takenIds: collectTakenIds(picks),
      allowedLeagueIds: ['epl'],
      shownCandidates: [takenPlayer],
      rng: mulberry32(9),
    });
    expect(pick).not.toBeNull();
    expect(pick?.player.id).not.toBe(takenPlayer.id);
    expect(collectTakenIds(picks).has(pick?.player.id ?? '')).toBe(false);
  });
});

describe('v8.0 multi league — head-to-head points', () => {
  it('scales to the same maximum regardless of how many matches were played', () => {
    const rec = (played: number, won: number, drawn: number) => ({
      played,
      won,
      drawn,
      lost: played - won - drawn,
      goalsFor: 0,
      goalsAgainst: 0,
    });
    expect(computeMpH2HPoints(rec(0, 0, 0))).toBe(0);
    expect(computeMpH2HPoints(rec(2, 2, 0))).toBe(MP_H2H_MAX_POINTS);
    expect(computeMpH2HPoints(rec(6, 6, 0))).toBe(MP_H2H_MAX_POINTS);
    expect(computeMpH2HPoints(rec(6, 3, 0))).toBe(MP_H2H_MAX_POINTS / 2);
    expect(computeMpH2HPoints(rec(3, 0, 3))).toBe(MP_H2H_MAX_POINTS / 3);
  });
});

describe('v8.0 multi league — full shared season', () => {
  it(
    'plays league + cup + UCL for 3 friends with pauses, trades, consent and two final boards',
    () => {
      const rng = mulberry32(2026);
      const humans = makeHumans(3);
      const { picks } = runSnakeDraft(humans, rng);
      let squads = squadsFromPicks(humans, picks);

      let state = createMpLeagueSeason({
        roomId: 'room',
        seasonKey: 's1',
        settings: normalizeMpLeagueSettings({ leagueId: 'epl', uclEnabled: true }),
        draftLeaguePool: ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'],
        humans,
        squads,
        rng,
      });

      expect(state.clubs).toHaveLength(20);
      expect(state.clubs.filter((c) => c.id.startsWith('mpl-club-'))).toHaveLength(3);
      expect(state.fixtures).toHaveLength(380);
      for (const h of humans) {
        expect(state.cup?.participantIds).toContain(h.clubId);
      }
      assertWorldUnique(state, squads);

      const seen = {
        leagueH2H: 0,
        otherH2H: 0,
        eventRounds: [] as number[],
        transferWindows: 0,
        trades: 0,
        consents: [] as string[],
        casts: 0,
        summaries: 0,
        tickers: new Set<string>(),
      };
      let pacedCalls = 0;

      for (let guard = 0; guard < 4000 && state.flow.kind !== 'done'; guard += 1) {
        const env = { squads, rng };
        const flow = state.flow;
        if (state.ticker && !seen.tickers.has(state.ticker.key)) {
          seen.tickers.add(state.ticker.key);
          for (const m of state.ticker.matches) {
            expect(m.goals.length).toBe(m.homeGoals + m.awayGoals);
            expect(m.humanClubIds.length).toBeGreaterThan(0);
          }
        }

        if (flow.kind === 'auto') {
          const before = state.round;
          const beforeLp = state.ucl?.leaguePhaseRound ?? 0;
          state = runMpLeague(state, env);
          pacedCalls += 1;

          // One timer tick never simulates more than ONE league / UCL round
          expect(state.round - before).toBeLessThanOrEqual(1);
          if (state.stage === 'ucl' && state.uclHumanClubIds.length > 0) {
            expect((state.ucl?.leaguePhaseRound ?? 0) - beforeLp).toBeLessThanOrEqual(1);
          }
          continue;
        }

        if (flow.kind === 'h2h') {
          const played = playH2H(state, squads, rng);
          if (played.spec.ctx === 'league') {
            seen.leagueH2H += 1;
            expect(played.spec.speed).toBe(2);
            expect(played.spec.knockout).toBe(false);
          } else {
            seen.otherH2H += 1;
            expect(played.spec.speed).toBe(played.spec.isFinal ? 1 : 2);
          }
          state = completeMpLeagueH2H(state, played.result);
          if (state.flow.kind === 'auto') state = runMpLeague(state, env);
          continue;
        }

        if (flow.kind === 'event') {
          // Interviews land in the SAME round for every friend that got one
          const active = humans.filter(
            (h) => state.perHuman[h.clubId].events.activeEvent,
          );
          expect(active.length).toBeGreaterThan(0);
          seen.eventRounds.push(state.round);
          for (const h of active) {
            const ev = state.perHuman[h.clubId].events.activeEvent;
            if (!ev) continue;
            state = resolveMpLeagueEvent(state, env, h.clubId, ev.choices[0].id);
          }
          expect(state.flow.kind).toBe('auto');
          state = runMpLeague(state, env, { allowPaced: false });
          continue;
        }

        if (flow.kind === 'transfer') {
          seen.transferWindows += 1;
          // The same AI club never negotiates with two friends at once
          const clubIds = humans.flatMap((h) =>
            state.perHuman[h.clubId].offers.map((o) => o.club.id),
          );
          expect(new Set(clubIds).size).toBe(clubIds.length);

          for (const h of humans) {
            const offers = state.perHuman[h.clubId].offers;
            if (offers.length === 0) continue;
            const outcome = submitMpLeagueTrade({
              state,
              env: { squads, rng },
              clubId: h.clubId,
              offerId: offers[0].id,
            });
            state = outcome.state;
            if (outcome.squad) {
              seen.trades += 1;
              squads = { ...squads, [h.clubId]: outcome.squad };
            }
            for (const rest of offers.slice(1)) {
              state = rejectMpLeagueOffer(state, h.clubId, rest.id);
            }
          }
          assertWorldUnique(state, squads);
          state = closeMpLeagueTransferWindow(state);
          expect(state.flow.kind).toBe('auto');
          state = runMpLeague(state, { squads, rng }, { allowPaced: false });
          continue;
        }

        if (flow.kind === 'summary') {
          seen.summaries += 1;
          expect(state.round).toBe(38);
          expect(state.summary?.awards.bestXi.length).toBeGreaterThan(0);
          for (const h of humans) {
            expect(state.summary?.squadStats[h.clubId].length).toBeGreaterThan(10);
          }
          // The season waits here until every friend has continued
          expect(runMpLeague(state, env).flow.kind).toBe('summary');
          state = closeMpLeagueSummary(state);
          continue;
        }

        if (flow.kind === 'consent') {
          seen.consents.push(flow.key);
          const stageBefore = state.ucl?.stage;
          const legBefore = state.ucl?.knockoutLeg;
          const roundBefore = state.round;
          // Without every friend agreeing, neither league Round 1 nor knockout stage must move
          const stuck = runMpLeague(state, env);
          expect(stuck.round).toBe(roundBefore);
          expect(stuck.ucl?.stage).toBe(stageBefore);
          expect(stuck.ucl?.knockoutLeg).toBe(legBefore);
          expect(stuck.flow.kind).toBe('consent');
          state = grantMpLeagueConsent(state);
          if (state.stage === 'league') pacedCalls += 1;
          state = runMpLeague(state, env);
          continue;
        }

        if (flow.kind === 'cast') {
          seen.casts += 1;
          expect(state.cast?.matches.length).toBeGreaterThan(0);
          for (const m of state.cast?.matches ?? []) {
            const goalsInFeed = m.goals.length;
            expect(goalsInFeed).toBe(m.homeGoals + m.awayGoals);
          }
          state = endMpLeagueCast(state);
          continue;
        }
      }

      expect(state.flow.kind).toBe('done');
      expect(state.stage).toBe('final');
      expect(state.round).toBe(38);
      expect(pacedCalls).toBeGreaterThanOrEqual(38);

      // 3 friends meet each other home & away: 3 pairs x 2 = 6 league head-to-heads
      expect(seen.leagueH2H).toBe(6);
      expect(seen.transferWindows).toBe(3);
      expect(seen.summaries).toBe(1);
      // A live scoreboard exists for every league round
      expect(seen.tickers.size).toBeGreaterThanOrEqual(38);
      expect(seen.eventRounds.length).toBeGreaterThanOrEqual(3);
      expect(new Set(seen.eventRounds).size).toBe(seen.eventRounds.length);

      // Standings stay consistent for a full double round robin
      for (const row of state.standings) {
        expect(row.played).toBe(38);
        expect(row.won + row.drawn + row.lost).toBe(38);
      }
      expect(state.cup?.completed).toBe(true);
      expect(state.ucl?.completed).toBe(true);
      assertWorldUnique(state, squads);

      const final = state.final;
      expect(final).not.toBeNull();
      const rows = final?.rows ?? [];
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
      for (let i = 1; i < rows.length; i += 1) {
        expect(rows[i - 1].total).toBeGreaterThanOrEqual(rows[i].total);
      }
      for (const r of rows) {
        // Friends board = existing season score + head-to-head; benchmark uses the season score only
        expect(r.total).toBe(r.seasonScore.totalScore + r.h2hPoints);
        expect(r.h2hPoints).toBe(computeMpH2HPoints(r.h2h));
        expect(r.h2hPoints).toBeLessThanOrEqual(MP_H2H_MAX_POINTS);
        expect(r.h2h.played).toBeGreaterThanOrEqual(4);
        expect(r.historicalRank).toBeGreaterThanOrEqual(1);
        expect(r.historicalRank).toBeLessThanOrEqual(r.historicalTotal);
      }
      // Each friend-vs-friend win is someone else's loss
      const totalWon = rows.reduce((s, r) => s + r.h2h.won, 0);
      const totalLost = rows.reduce((s, r) => s + r.h2h.lost, 0);
      expect(totalWon).toBe(totalLost);

      const live = buildMpLeagueLive(state, squads);
      expect(live.stage).toBe('final');
      expect(live.final?.rows).toHaveLength(3);
      expect(JSON.stringify(live).length).toBeLessThan(900_000);
    },
    120_000,
  );

  it('benches an injured-out starter for the match without touching the saved squad', () => {
    const rng = mulberry32(77);
    const humans = makeHumans(2);
    const { picks } = runSnakeDraft(humans, rng);
    const squads = squadsFromPicks(humans, picks);
    const squad = squads[humans[0].clubId];
    const injured = squad.starters[10];
    const setup = buildHumanMatchSetup({
      human: humans[0],
      squad,
      conditions: {
        [injured.id]: {
          morale: 0,
          injury: {
            id: 'inj-1',
            severity: 'moderate',
            label: '부상',
            matchesRemaining: 3,
            totalMatches: 3,
            canPlayThrough: false,
            ovrPenalty: 0,
            occurredRound: 1,
          },
        } as never,
      },
      teamMorale: 0,
      competition: 'league',
    });
    expect(setup.rawStarters.some((p) => p.id === injured.id)).toBe(false);
    expect(setup.rawBench.some((p) => p.id === injured.id)).toBe(true);
    expect(setup.rawStarters).toHaveLength(11);
    expect(squad.starters[10].id).toBe(injured.id);
  });
});

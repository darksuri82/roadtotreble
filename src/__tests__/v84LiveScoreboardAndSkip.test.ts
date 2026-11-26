import { describe, expect, it } from 'vitest';
import {
  matchResultToCastMatch,
  SOLO_LIVE_SPEED_OPTIONS,
} from '../components/common/SoloLiveScoreboard';
import { shouldRenderLiveMatchBroadcast } from '../components/league/LiveMatchBroadcast';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
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
  closeMpLeagueSummary,
  closeMpLeagueTransferWindow,
  completeMpLeagueH2H,
  createMpLeagueSeason,
  endMpLeagueCast,
  getMpTickerExtraPkMs,
  grantMpLeagueConsent,
  MP_LEAGUE_MAX_EVENTS_PER_SEASON,
  MP_LEAGUE_MIN_EVENT_COOLDOWN,
  mpHumanClubId,
  resolveMpLeagueEvent,
  runMpLeague,
} from '../engine/mpLeagueEngine';
import {
  kickoffMpH2H,
  mpH2HPreSkipKey,
  resolveMpH2HFullInstant,
} from '../engine/mpLeagueH2H';
import type { MpH2HSideInput } from '../engine/mpLeagueH2H';
import { createInitialState, gameReducer } from '../store/GameContext';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type { FormationId, ManagerTraitId } from '../types/game';
import type { MatchResult } from '../types/league';
import type {
  MpH2HSpec,
  MpLeagueHuman,
  MpLeaguePickRow,
  MpSquadInput,
} from '../types/mpLeague';
import {
  MP_LEAGUE_AUTO_MS_OPTIONS,
  normalizeMpLeagueSettings,
} from '../types/mpLeague';
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

function pickBySub(sub: string, count: number, used: Set<string>): Player[] {
  const out = ACTIVE_PLAYERS.filter(
    (p) => !used.has(p.id) && (p.mainPositions ?? []).includes(sub as never),
  ).slice(0, count);
  for (const p of out) used.add(p.id);
  return out;
}

function buildQuickSquad(used: Set<string>): MpSquadInput {
  const starters: Player[] = [
    ...pickBySub('GK', 1, used),
    ...pickBySub('LB', 1, used),
    ...pickBySub('CB', 2, used),
    ...pickBySub('RB', 1, used),
    ...pickBySub('CDM', 1, used),
    ...pickBySub('CM', 2, used),
    ...pickBySub('LW', 1, used),
    ...pickBySub('ST', 1, used),
    ...pickBySub('RW', 1, used),
  ];
  const bench: Player[] = [
    ...pickBySub('GK', 1, used),
    ...pickBySub('CB', 2, used),
    ...pickBySub('CM', 1, used),
    ...pickBySub('ST', 1, used),
  ];
  return {
    managerTraitId: 'tiki_taka',
    formation: '4-3-3',
    tactic: 'balanced',
    starters,
    bench,
  };
}

function makeHuman(idx: number): MpLeagueHuman {
  const traits: ManagerTraitId[] = ['tiki_taka', 'gegenpress_guru', 'big_game_hunter'];
  return {
    playerId: `p${idx + 1}`,
    clubId: mpHumanClubId(idx),
    nickname: `감독${idx + 1}`,
    avatar: DEFAULT_MANAGER_AVATAR,
    profile: {
      name: `FC 친구${idx + 1}`,
      shortName: `F${idx + 1}`,
      primaryColor: '#10b981',
      secondaryColor: '#f8fafc',
      pattern: 'solid',
    },
    managerTraitId: traits[idx % traits.length],
  };
}

describe('v8.4 solo live scoreboard, H2H preview skip/result confirmation & reduced MP interview frequency', () => {
  it('exposes 5s / 7s / 9s live auto-advance speeds and converts MatchResult cleanly without duplicating ET goals', () => {
    expect([...SOLO_LIVE_SPEED_OPTIONS]).toEqual([5000, 7000, 9000]);
    expect([...MP_LEAGUE_AUTO_MS_OPTIONS]).toEqual([5000, 7000, 9000]);
    expect(normalizeMpLeagueSettings({ autoMs: 9000 }).autoMs).toBe(9000);

    const mockResult: MatchResult = {
      fixtureId: 'cup-sf-1',
      round: 24,
      homeTeamId: 'user',
      awayTeamId: 'opp',
      homeGoals: 2,
      awayGoals: 1,
      homeXg: 1.9,
      awayXg: 1.1,
      homeShots: 14,
      awayShots: 9,
      homeShotsOnTarget: 6,
      awayShotsOnTarget: 3,
      homePossession: 56,
      homeFormation: '4-3-3',
      awayFormation: '4-2-3-1',
      homeTactic: 'possession',
      awayTactic: 'counter',
      homeTacticBonus: 0,
      awayTacticBonus: 0,
      events: [
        {
          minute: 22,
          half: 1,
          type: 'goal',
          teamId: 'user',
          scorerName: '손흥민',
          description: '손흥민 선제골!',
        },
        {
          minute: 71,
          half: 2,
          type: 'goal',
          teamId: 'opp',
          scorerName: '상대공격수',
          description: '동점골!',
        },
        {
          minute: 108,
          half: 2,
          type: 'goal',
          teamId: 'user',
          scorerName: '엘링 홀란',
          description: '연장 결승골!',
        },
      ],
      extraTime: {
        homeEtGoals: 1,
        awayEtGoals: 0,
        etEvents: [
          {
            minute: 108,
            half: 2,
            type: 'goal',
            teamId: 'user',
            scorerName: '엘링 홀란',
            description: '연장 결승골!',
          },
        ],
        winnerTeamId: 'user',
      },
      playerRatings: [],
      momPlayerId: 'p1',
      momPlayerName: '엘링 홀란',
      momRating: 8.6,
    };

    const cast = matchResultToCastMatch(mockResult, 'FA컵 준결승', 'user');
    expect(cast.goals).toHaveLength(3); // ET goal is NOT double-counted
    expect(cast.homeGoals).toBe(2);
    expect(cast.awayGoals).toBe(1);
    expect(cast.extraTime).toBe(true);
    expect(cast.feed?.length).toBe(3);
  });

  it('resolves H2H instantly to phase="finished" from both preview skip and mid-match skip (including knockout winner)', () => {
    const used = new Set<string>();
    const squadA = buildQuickSquad(used);
    const squadB = buildQuickSquad(used);
    const humanA = makeHuman(0);
    const humanB = makeHuman(1);
    const home: MpH2HSideInput = {
      human: humanA,
      formation: squadA.formation,
      tactic: squadA.tactic,
      starters: squadA.starters,
      bench: squadA.bench,
      teamMorale: 0,
    };
    const away: MpH2HSideInput = {
      human: humanB,
      formation: squadB.formation,
      tactic: squadB.tactic,
      starters: squadB.starters,
      bench: squadB.bench,
      teamMorale: 0,
    };

    const cupSpec: MpH2HSpec = {
      key: 'cup-sf-0',
      ctx: 'cup',
      label: 'FA컵 준결승',
      homeClubId: humanA.clubId,
      awayClubId: humanB.clubId,
      round: 25,
      knockout: true,
      speed: 4,
    };
    expect(mpH2HPreSkipKey(cupSpec, 's1')).toContain('h2h-pre-skip:');

    // 1) Preview consensus skip (no existingMatch) → immediately produces phase='finished' + finalResult with decisive knockout winner
    const fromPreview = resolveMpH2HFullInstant({
      spec: cupSpec,
      seasonKey: 's1',
      home,
      away,
      conditions: {},
      rng: mulberry32(777),
    });
    expect(fromPreview.phase).toBe('finished');
    expect(fromPreview.finalResult).not.toBeNull();
    const res1 = fromPreview.finalResult!;
    if (res1.homeGoals === res1.awayGoals) {
      expect(res1.extraTime?.winnerTeamId).toBeTruthy();
    }

    // 2) Mid-match consensus skip (from first_half) → finishes remaining halves into phase='finished'
    const started = kickoffMpH2H({
      spec: cupSpec,
      seasonKey: 's2',
      home,
      away,
      conditions: {},
      rng: mulberry32(888),
    });
    expect(started.phase).toBe('first_half');
    const fromMidMatch = resolveMpH2HFullInstant({
      spec: cupSpec,
      seasonKey: 's2',
      home,
      away,
      conditions: {},
      existingMatch: started,
      rng: mulberry32(889),
    });
    expect(fromMidMatch.phase).toBe('finished');
    expect(fromMidMatch.finalResult).not.toBeNull();
  });

  it('caps multi-league interview frequency at 4 per season with 8-round cooldown and zero transfer-round collisions', () => {
    const rng = mulberry32(20260804);
    const humans = [makeHuman(0), makeHuman(1), makeHuman(2)];
    const order = humans.map((h) => h.playerId);
    const picks: MpLeaguePickRow[] = [];
    const pool = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'] as const;
    const formations: FormationId[] = ['4-3-3', '4-2-3-1', '3-5-2'];
    let roll: ReturnType<typeof spinSharedRoll> = [];

    for (let pickNo = 0; pickNo < totalSnakePicks(order.length); pickNo += 1) {
      const pickerId = snakePickerId(pickNo, order)!;
      const round = draftRoundOf(pickNo, order.length);
      const idx = order.indexOf(pickerId);
      const formation = formations[idx % formations.length];
      if (pickNo % order.length === 0) {
        const spinnerId = roundSpinnerId(round, order)!;
        const sb = rebuildSquadFromPicks(picks, spinnerId);
        roll = spinSharedRoll({
          formation,
          starters: sb.starters,
          bench: sb.bench,
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
        room_id: 'r-v84',
        draft_generation: 1,
        pick_no: pickNo,
        picker_id: pickerId,
        player_ref: pick.player.id,
        player_json: pick,
        created_at: new Date().toISOString(),
      });
    }

    const squads: Record<string, MpSquadInput> = {};
    humans.forEach((h, i) => {
      const b = rebuildSquadFromPicks(picks, h.playerId);
      squads[h.clubId] = {
        managerTraitId: h.managerTraitId,
        formation: formations[i % formations.length],
        tactic: 'balanced',
        starters: b.starters.filter((p): p is Player => p !== null),
        bench: b.bench.filter((p): p is Player => p !== null),
      };
    });

    let state = createMpLeagueSeason({
      roomId: 'r-v84',
      seasonKey: 's-v84',
      settings: normalizeMpLeagueSettings({ leagueId: 'epl', uclEnabled: false }),
      draftLeaguePool: [...pool],
      humans,
      squads,
      rng,
    });

    const eventRounds: number[] = [];
    for (let guard = 0; guard < 1200 && state.flow.kind !== 'done'; guard += 1) {
      const env = { squads, rng };
      if (state.flow.kind === 'auto') {
        state = runMpLeague(state, env);
      } else if (state.flow.kind === 'h2h' && state.h2hLive) {
        const spec = state.h2hLive.spec;
        const hHuman = humans.find((h) => h.clubId === spec.homeClubId)!;
        const aHuman = humans.find((h) => h.clubId === spec.awayClubId)!;
        const hSq = squads[spec.homeClubId];
        const aSq = squads[spec.awayClubId];
        const finished = resolveMpH2HFullInstant({
          spec,
          seasonKey: state.seasonKey,
          home: {
            human: hHuman,
            formation: hSq.formation,
            tactic: hSq.tactic,
            starters: hSq.starters,
            bench: hSq.bench,
            teamMorale: 0,
          },
          away: {
            human: aHuman,
            formation: aSq.formation,
            tactic: aSq.tactic,
            starters: aSq.starters,
            bench: aSq.bench,
            teamMorale: 0,
          },
          conditions: state.conditions,
          rng,
        });
        state = completeMpLeagueH2H(state, finished.finalResult!);
      } else if (state.flow.kind === 'event') {
        eventRounds.push(state.round);
        for (const h of humans) {
          const ev = state.perHuman[h.clubId]?.events.activeEvent;
          if (ev) {
            state = resolveMpLeagueEvent(state, env, h.clubId, ev.choices[0].id);
          }
        }
      } else if (state.flow.kind === 'transfer') {
        state = closeMpLeagueTransferWindow(state);
      } else if (state.flow.kind === 'summary') {
        state = closeMpLeagueSummary(state);
      } else if (state.flow.kind === 'consent') {
        state = grantMpLeagueConsent(state);
      } else if (state.flow.kind === 'cast') {
        state = endMpLeagueCast(state);
      }
    }

    expect(state.flow.kind).toBe('done');
    expect(eventRounds.length).toBeGreaterThanOrEqual(3);
    expect(eventRounds.length).toBeLessThanOrEqual(MP_LEAGUE_MAX_EVENTS_PER_SEASON);
    for (const r of eventRounds) {
      expect(state.transferWindows).not.toContain(r);
    }
    for (let i = 1; i < eventRounds.length; i += 1) {
      expect(eventRounds[i] - eventRounds[i - 1]).toBeGreaterThanOrEqual(
        MP_LEAGUE_MIN_EVENT_COOLDOWN,
      );
    }
  }, 25_000);

  it('v8.4.2: supports uncommitted solo live streaming, mid-stream 2D jump-in (1st/2nd half), and clean cancel', () => {
    let st = createInitialState();
    st = gameReducer(st, { type: 'START_NEW_CAREER' });
    st = gameReducer(st, { type: 'START_DRAFT' });
    st = gameReducer(st, { type: 'AUTO_COMPLETE_DRAFT' });
    st = gameReducer(st, { type: 'SELECT_LEAGUE', payload: { leagueId: 'epl' } });

    expect(st.season?.currentRound).toBe(0);

    // Start solo live stream → uncommitted streamAutoMode liveHalftime with fullMatchResult
    // Crucial: LiveMatchBroadcast MUST NOT open while streamAutoMode === true (top SoloLiveScoreboard plays instead!)
    const streaming = gameReducer(st, { type: 'START_SOLO_STREAM_MATCH' });
    expect(streaming.season?.currentRound).toBe(0);
    expect(streaming.season?.liveHalftime?.streamAutoMode).toBe(true);
    expect(shouldRenderLiveMatchBroadcast(streaming.season?.liveHalftime)).toBe(false);
    expect(streaming.season?.liveHalftime?.fullMatchResult).toBeTruthy();
    expect(streaming.season?.liveHalftime?.streamResult90).toBeTruthy();

    // Jump into 2D mid-1st-half (minute 28) → switches to first_half, clears fullMatchResult so halftime coaching works
    const mid1st = gameReducer(streaming, {
      type: 'ENTER_LIVE_BROADCAST_FROM_STREAM',
      payload: { minute: 28, inPenalties: false },
    });
    expect(mid1st.season?.liveHalftime?.streamAutoMode).toBe(false);
    expect(shouldRenderLiveMatchBroadcast(mid1st.season?.liveHalftime)).toBe(true);
    expect(mid1st.season?.liveHalftime?.phase).toBe('first_half');
    expect(mid1st.season?.liveHalftime?.resumeFromMinute).toBe(28);
    expect(mid1st.season?.liveHalftime?.fullMatchResult).toBeUndefined();

    // Jump into 2D mid-2nd-half (minute 66) → switches to second_half keeping streamResult90
    const mid2nd = gameReducer(streaming, {
      type: 'ENTER_LIVE_BROADCAST_FROM_STREAM',
      payload: { minute: 66, inPenalties: false },
    });
    expect(mid2nd.season?.liveHalftime?.streamAutoMode).toBe(false);
    expect(shouldRenderLiveMatchBroadcast(mid2nd.season?.liveHalftime)).toBe(true);
    expect(mid2nd.season?.liveHalftime?.phase).toBe('second_half');
    expect(mid2nd.season?.liveHalftime?.resumeFromMinute).toBe(66);
    expect(mid2nd.season?.liveHalftime?.fullMatchResult).toBeTruthy();

    // Anti-save-scum (v9.5.0): cancelling an in-progress stream settles the match instead of wiping it
    const cancelled = gameReducer(streaming, { type: 'CANCEL_SOLO_STREAM_MATCH' });
    expect(cancelled.season?.liveHalftime).toBeNull();
    expect(shouldRenderLiveMatchBroadcast(cancelled.season?.liveHalftime)).toBe(false);
    expect(cancelled.season?.currentRound).toBe(1);

    // Committing after scoreboard FT also advances round to 1 cleanly
    const committed = gameReducer(streaming, { type: 'COMMIT_LIVE_MATCH' });
    expect(committed.season?.liveHalftime).toBeNull();
    expect(committed.season?.currentRound).toBe(1);
  });

  it('v8.4.2: freezes all fast-skip and instant-match reducers while an interview or injury alert is pending', () => {
    let st = createInitialState();
    st = gameReducer(st, { type: 'START_NEW_CAREER' });
    st = gameReducer(st, { type: 'START_DRAFT' });
    st = gameReducer(st, { type: 'AUTO_COMPLETE_DRAFT' });
    st = gameReducer(st, { type: 'SELECT_LEAGUE', payload: { leagueId: 'epl' } });

    const withActiveInterview = {
      ...st,
      season: {
        ...st.season!,
        managerEvents: {
          ...st.season!.managerEvents!,
          activeEvent: {
            templateId: 'press_test',
            category: 'press_conference' as const,
            targetScope: 'team' as const,
            title: '테스트 기자회견',
            speakerLabel: 'BBC 기자',
            contextBadge: '기자회견',
            prompt: '질문',
            choices: [
              {
                id: 'c1',
                label: '응답',
                toneTag: '자신감',
                quote: '우리는 준비됐다.',
                successEffect: {
                  summaryText: '팀 사기 +1',
                  reactionText: '선수단이 호응했다.',
                  teamMoraleDelta: 1,
                },
              },
            ],
          },
        },
      },
    };

    expect(
      gameReducer(withActiveInterview, {
        type: 'SIMULATE_ONE_FAST_ROUND',
        payload: { stopAtTransfer: true, stopAtCup: true },
      }),
    ).toBe(withActiveInterview);
    expect(
      gameReducer(withActiveInterview, { type: 'SIMULATE_SINGLE_MATCH_INSTANT' }),
    ).toBe(withActiveInterview);
    expect(
      gameReducer(withActiveInterview, { type: 'SIMULATE_TO_NEXT_TRANSFER' }),
    ).toBe(withActiveInterview);
    expect(
      gameReducer(withActiveInterview, { type: 'SKIP_TO_SEASON_END' }),
    ).toBe(withActiveInterview);

    const starter0 = st.starters[0]!;
    const withInjury = {
      ...st,
      season: {
        ...st.season!,
        pendingInjuryAlerts: [
          {
            playerId: starter0.id,
            playerName: starter0.name,
            nationality: starter0.nationality,
            nationalityCode: starter0.nationalityCode,
            position: starter0.position,
            mainPosition: starter0.mainPositions[0] ?? 'GK',
            ovr: starter0.ovr,
            isStarter: true,
            starterSlotIndex: 0,
            injury: {
              id: 'inj-test-1',
              name: '경미한 타박상',
              severity: 'minor' as const,
              matchesRemaining: 2,
              initialMatches: 2,
              canPlayThrough: true,
              playThroughPenalty: -2,
              recoveryMatchesRemaining: 0,
            },
          },
        ],
      },
    };
    expect(
      gameReducer(withInjury, {
        type: 'SIMULATE_ONE_FAST_ROUND',
        payload: { stopAtTransfer: true, stopAtCup: true },
      }),
    ).toBe(withInjury);
    expect(
      gameReducer(withInjury, { type: 'SIMULATE_SINGLE_MATCH_INSTANT' }),
    ).toBe(withInjury);
  });

  it('v8.4.2: preserves PK kicker logs in live cast and computes extra shootout duration beyond match clock', () => {
    let homePk = 0;
    let awayPk = 0;
    const kicks = Array.from({ length: 10 }, (_, idx) => {
      const isHome = idx % 2 === 0;
      const scored = idx !== 9;
      if (scored) {
        if (isHome) homePk += 1;
        else awayPk += 1;
      }
      return {
        round: Math.floor(idx / 2) + 1,
        teamId: isHome ? 'user' : 'opp',
        teamShortName: isHome ? 'USR' : 'OPP',
        kickerName: `키커${idx + 1}`,
        scored,
        homeScoreAfter: homePk,
        awayScoreAfter: awayPk,
      };
    });

    const pkResult: MatchResult = {
      fixtureId: 'cup-final-pk',
      round: 30,
      homeTeamId: 'user',
      awayTeamId: 'opp',
      homeGoals: 1,
      awayGoals: 1,
      homeXg: 1.5,
      awayXg: 1.4,
      homeShots: 12,
      awayShots: 11,
      homeShotsOnTarget: 5,
      awayShotsOnTarget: 4,
      homePossession: 52,
      homeFormation: '4-3-3',
      awayFormation: '4-3-3',
      homeTactic: 'balanced',
      awayTactic: 'balanced',
      homeTacticBonus: 0,
      awayTacticBonus: 0,
      events: [],
      extraTime: {
        homeEtGoals: 0,
        awayEtGoals: 0,
        etEvents: [],
        winnerTeamId: 'user',
        penalties: {
          homePenGoals: 5,
          awayPenGoals: 4,
          winnerTeamId: 'user',
          kicks,
        },
      },
      playerRatings: [],
      momPlayerId: 'p1',
      momPlayerName: '키커1',
      momRating: 8.2,
    };

    const cast = matchResultToCastMatch(pkResult, 'FA컵 결승', 'user');
    expect(cast.penalties?.kicks).toHaveLength(10);
    expect(cast.penalties?.kicks?.[9]).toMatchObject({
      round: 5,
      teamId: 'opp',
      kickerName: '키커10',
      scored: false,
    });
    expect(getMpTickerExtraPkMs([cast])).toBe(10 * 700 + 1200);
    expect(getMpTickerExtraPkMs([{ ...cast, penalties: undefined }])).toBe(0);
  });
});

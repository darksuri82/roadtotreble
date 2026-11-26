import { describe, expect, it } from 'vitest';
import mpBoardSrc from '../components/multiplayer/league/MpUclMulticastBoard.tsx?raw';
import mpPreviewSrc from '../components/multiplayer/league/MpUclMatchPreviewModal.tsx?raw';
import soloDashSrc from '../components/ucl/UclDashboard.tsx?raw';
import { getInitialUclCastClock } from '../components/ucl/UclMulticastPopupBoard';
import sharedPopupSrc from '../components/ucl/UclMulticastPopupBoard.tsx?raw';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
import {
  buildMpLeagueLive,
  buildUclConsentFlow,
  createMpLeagueSeason,
  endMpLeagueCast,
  grantMpLeagueConsent,
  mpHumanClubId,
  runMpLeague,
} from '../engine/mpLeagueEngine';
import { USER_CLUB_ID } from '../engine/matchEngine';
import { createUclTournamentState } from '../engine/uclEngine';
import { createInitialState, gameReducer } from '../store/GameContext';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type { GameState } from '../types/game';
import {
  normalizeMpLeagueSettings,
  type MpLeagueHostState,
  type MpLeagueHuman,
  type MpSquadInput,
} from '../types/mpLeague';
import type { Player } from '../types/player';
import type { UclKnockoutStage, UclKnockoutTie } from '../types/ucl';

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
    tactic: 'possession',
    starters,
    bench,
  };
}

function buildSoloUclState(): GameState {
  const used = new Set<string>();
  const squad = buildQuickSquad(used);
  const initial = createInitialState();
  let state: GameState = {
    ...initial,
    phase: 'league_select',
    formation: squad.formation,
    starters: squad.starters,
    bench: squad.bench,
    manager: {
      ...initial.manager,
      traitId: squad.managerTraitId,
    },
  };
  state = gameReducer(state, { type: 'SELECT_LEAGUE', payload: { leagueId: 'epl' } });
  const season = state.season!;
  const userClub = season.clubs.find((c) => c.id === USER_CLUB_ID)!;
  const top4Standings = [
    ...season.standings.filter((r) => r.teamId === USER_CLUB_ID),
    ...season.standings.filter((r) => r.teamId !== USER_CLUB_ID),
  ];
  const created = createUclTournamentState({
    userLeagueId: 'epl',
    userClub,
    userSquad: [...squad.starters, ...squad.bench],
    userLeagueClubs: season.clubs,
    userLeagueStandings: top4Standings,
    userAiRosters: season.aiRosters,
    otherLeagues: season.otherLeagues ?? {},
    userParticipated: true,
  });
  return {
    ...state,
    phase: 'ucl',
    season: {
      ...season,
      ucl: {
        ...created.ucl,
        stage: 'league_phase',
      },
      uclPlayerStats: created.uclPlayerStats,
    },
  };
}

describe('v8.16 — Unified UCL Auto-Sim Popup, Solo Pause/Takeover, KO Boundaries & MP Knockout Preview', () => {
  it('1. ABORT_STREAM_AND_START_LIVE_2D atomically discards uncommitted preview and enters 2D broadcast with zero duplicate commits', () => {
    const base = buildSoloUclState();
    expect(base.season?.ucl?.leaguePhaseRound).toBe(0);
    expect(base.season?.userUclMatchHistory.length).toBe(0);

    // Start auto-sim stream preview for Round 1 (uncommitted)
    const streaming = gameReducer(base, { type: 'START_SOLO_STREAM_MATCH' });
    expect(streaming.season?.liveHalftime?.streamAutoMode).toBe(true);
    expect(streaming.season?.ucl?.leaguePhaseRound).toBe(0);
    expect(streaming.season?.userUclMatchHistory.length).toBe(0);

    // Abort mid-stream and take over directly into 2D broadcast
    const takeover = gameReducer(streaming, { type: 'ABORT_STREAM_AND_START_LIVE_2D' });
    expect(takeover.season?.liveHalftime).not.toBeNull();
    expect(takeover.season?.liveHalftime?.streamAutoMode).toBeFalsy();
    expect(takeover.season?.liveHalftime?.phase).toBe('first_half');
    // Standings & history must remain strictly uncommitted until 2D match finishes
    expect(takeover.season?.ucl?.leaguePhaseRound).toBe(0);
    expect(takeover.season?.userUclMatchHistory.length).toBe(0);

    // Calling ABORT_STREAM_AND_START_LIVE_2D again while already in 2D broadcast is a safe no-op
    const doubleTakeover = gameReducer(takeover, {
      type: 'ABORT_STREAM_AND_START_LIVE_2D',
    });
    expect(doubleTakeover).toBe(takeover);

    // Committing once advances exactly 1 round; committing a second time is strictly a no-op
    const committed = gameReducer(takeover, { type: 'COMMIT_LIVE_MATCH' });
    expect(committed.season?.liveHalftime).toBeNull();
    expect(committed.season?.ucl?.leaguePhaseRound).toBe(1);
    expect(committed.season?.userUclMatchHistory.length).toBe(1);

    const doubleCommit = gameReducer(committed, { type: 'COMMIT_LIVE_MATCH' });
    expect(doubleCommit).toBe(committed);
    expect(doubleCommit.season?.ucl?.leaguePhaseRound).toBe(1);
    expect(doubleCommit.season?.userUclMatchHistory.length).toBe(1);

    // Clicking direct 2D right after FT commit starts Round 2 cleanly without touching Round 1
    const nextMatch2D = gameReducer(committed, {
      type: 'ABORT_STREAM_AND_START_LIVE_2D',
    });
    expect(nextMatch2D.season?.liveHalftime?.round).toBe(2);
    expect(nextMatch2D.season?.liveHalftime?.streamAutoMode).toBeFalsy();
    expect(nextMatch2D.season?.ucl?.leaguePhaseRound).toBe(1);
  });

  it('2. Single-player UCL knockout advances strictly ONE leg at a time (1st leg -> 2nd leg -> next stage)', () => {
    const base = buildSoloUclState();
    const ucl = base.season!.ucl!;
    const aiClubs = ucl.clubs.filter((c) => c.id !== USER_CLUB_ID);

    const r16Ties: UclKnockoutTie[] = [
      {
        id: 'ucl-r16-0',
        stage: 'r16',
        tieIndex: 0,
        teamAId: USER_CLUB_ID,
        teamBId: aiClubs[0].id,
        aggTeamA: 0,
        aggTeamB: 0,
        winnerId: null,
      },
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `ucl-r16-${i + 1}`,
        stage: 'r16' as const,
        tieIndex: i + 1,
        teamAId: aiClubs[i * 2 + 1].id,
        teamBId: aiClubs[i * 2 + 2].id,
        aggTeamA: 0,
        aggTeamB: 0,
        winnerId: null,
      })),
    ];

    const koStart: GameState = {
      ...base,
      season: {
        ...base.season!,
        ucl: {
          ...ucl,
          stage: 'r16',
          leaguePhaseRound: 8,
          knockoutLeg: 1,
          ties: { playoff: [], r16: r16Ties, qf: [], sf: [], final: [] },
        },
      },
    };

    // Leg 1 stream + commit must stop cleanly at R16 Leg 2 boundary
    const leg1Stream = gameReducer(koStart, { type: 'START_SOLO_STREAM_MATCH' });
    expect(leg1Stream.season?.liveHalftime?.streamAutoMode).toBe(true);
    expect(leg1Stream.season?.liveHalftime?.isKnockoutDecider).toBe(false);

    const afterLeg1 = gameReducer(leg1Stream, { type: 'COMMIT_LIVE_MATCH' });
    expect(afterLeg1.season?.ucl?.stage).toBe('r16');
    expect(afterLeg1.season?.ucl?.knockoutLeg).toBe(2);
    expect(afterLeg1.season?.ucl?.ties.r16[0].leg1).toBeDefined();
    expect(afterLeg1.season?.ucl?.ties.r16[0].leg2).toBeUndefined();

    // Leg 2 stream + commit must advance strictly into QF Leg 1 boundary (never skipping ahead)
    const leg2Stream = gameReducer(afterLeg1, { type: 'START_SOLO_STREAM_MATCH' });
    expect(leg2Stream.season?.liveHalftime?.streamAutoMode).toBe(true);
    expect(leg2Stream.season?.liveHalftime?.isKnockoutDecider).toBe(true);
    expect(leg2Stream.season?.liveHalftime?.aggHomeBeforeMatch).toBe(
      afterLeg1.season?.ucl?.ties.r16[0].aggTeamA,
    );

    const afterLeg2 = gameReducer(leg2Stream, { type: 'COMMIT_LIVE_MATCH' });
    expect(afterLeg2.season?.ucl?.stage).toBe('qf');
    expect(afterLeg2.season?.ucl?.knockoutLeg).toBe(1);
    expect(afterLeg2.season?.ucl?.ties.r16[0].winnerId).not.toBeNull();
    expect(afterLeg2.season?.ucl?.ties.qf.length).toBe(4);
  });

  it('3. Multiplayer UCL emits preview consent at EVERY knockout boundary (leg1->leg2 and stage->stage) and ships opponent rosters only during consent', () => {
    const used = new Set<string>();
    const humans: MpLeagueHuman[] = [0, 1].map((idx) => ({
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
      managerTraitId: 'tiki_taka',
    }));
    const squads: Record<string, MpSquadInput> = {
      [humans[0].clubId]: buildQuickSquad(used),
      [humans[1].clubId]: buildQuickSquad(used),
    };
    const base = createMpLeagueSeason({
      roomId: 'room-v816',
      seasonKey: 'v816-preview-test',
      settings: normalizeMpLeagueSettings({
        leagueId: 'epl',
        uclEnabled: true,
        autoMs: 5000,
      }),
      draftLeaguePool: ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'],
      humans,
      squads,
    });
    const aiClubs = base.clubs.filter((c) => !humans.some((h) => h.clubId === c.id));

    const stagesToCheck: { stage: UclKnockoutStage; legs: (1 | 2)[] }[] = [
      { stage: 'playoff', legs: [1, 2] },
      { stage: 'r16', legs: [1, 2] },
      { stage: 'qf', legs: [1, 2] },
      { stage: 'sf', legs: [1, 2] },
      { stage: 'final', legs: [1] },
    ];

    for (const { stage, legs } of stagesToCheck) {
      const tie: UclKnockoutTie = {
        id: `tie-${stage}-0`,
        stage,
        tieIndex: 0,
        teamAId: humans[0].clubId,
        teamBId: aiClubs[0].id,
        aggTeamA: 1,
        aggTeamB: 0,
        winnerId: null,
      };
      for (const leg of legs) {
        const st: MpLeagueHostState = {
          ...base,
          stage: 'ucl',
          uclConsentedStage: null,
          uclHumanClubIds: [humans[0].clubId, humans[1].clubId],
          todo: [{ t: 'ucl_ko_leg' }],
          flow: { kind: 'auto' },
          ucl: {
            stage,
            teams: [],
            clubs: base.clubs,
            aiRosters: base.aiRosters,
            leaguePhaseFixtures: [],
            leaguePhaseRound: 8,
            standings: [],
            userLeaguePhaseRank: 1,
            enteredViaPlayoff: false,
            knockoutLeg: leg,
            ties: {
              playoff: stage === 'playoff' ? [tie] : [],
              r16: stage === 'r16' ? [tie] : [],
              qf: stage === 'qf' ? [tie] : [],
              sf: stage === 'sf' ? [tie] : [],
              final: stage === 'final' ? [tie] : [],
            },
            userEliminatedAt: null,
            championTeamId: null,
            lastUserMatch: null,
            completed: false,
          },
        };

        const consentFlow = buildUclConsentFlow(st);
        expect(consentFlow?.kind).toBe('consent');
        expect(consentFlow?.key).toBe(`ucl-consent-${stage}-leg${leg}`);
        expect(consentFlow?.requiredClubIds).toEqual([humans[0].clubId]);
        expect(consentFlow?.allEliminated).toBe(false);

        const consentState: MpLeagueHostState = { ...st, flow: consentFlow! };
        const liveDuringConsent = buildMpLeagueLive(consentState, squads);
        expect(
          liveDuringConsent.ucl?.knockoutPreviewRosters?.[aiClubs[0].id]?.length,
        ).toBe(11);

        // Once consent is granted, knockoutPreviewRosters is omitted from live payload
        const afterGrant = grantMpLeagueConsent(consentState);
        const liveAfterGrant = buildMpLeagueLive(afterGrant, squads);
        expect(liveAfterGrant.ucl?.knockoutPreviewRosters).toBeUndefined();
      }
    }

    // Verify Leg 1 -> Cast -> Leg 2 consent transition still triggers immediately with opponent rosters
    const r16Tie: UclKnockoutTie = {
      id: 'tie-r16-live',
      stage: 'r16',
      tieIndex: 0,
      teamAId: humans[0].clubId,
      teamBId: aiClubs[0].id,
      aggTeamA: 0,
      aggTeamB: 0,
      winnerId: null,
    };
    const r16Start: MpLeagueHostState = {
      ...base,
      stage: 'ucl',
      uclConsentedStage: 'league_phase',
      uclHumanClubIds: [humans[0].clubId],
      todo: [{ t: 'ucl_ko_leg' }],
      flow: { kind: 'auto' },
      ucl: {
        stage: 'r16',
        teams: [],
        clubs: base.clubs,
        aiRosters: base.aiRosters,
        leaguePhaseFixtures: [],
        leaguePhaseRound: 8,
        standings: [],
        userLeaguePhaseRank: 1,
        enteredViaPlayoff: false,
        knockoutLeg: 1,
        ties: { playoff: [], r16: [r16Tie], qf: [], sf: [], final: [] },
        userEliminatedAt: null,
        championTeamId: null,
        lastUserMatch: null,
        completed: false,
      },
    };
    const leg1Consent = runMpLeague(r16Start, { squads });
    expect(leg1Consent.flow.kind).toBe('consent');
    const afterLeg1 = runMpLeague(grantMpLeagueConsent(leg1Consent), { squads });
    expect(afterLeg1.flow.kind).toBe('cast');
    const leg2Consent = endMpLeagueCast(afterLeg1);
    expect(leg2Consent.flow).toMatchObject({
      kind: 'consent',
      key: 'ucl-consent-r16-leg2',
      requiredClubIds: [humans[0].clubId],
      allEliminated: false,
    });
    const leg2Live = buildMpLeagueLive(leg2Consent, squads);
    expect(leg2Live.ucl?.knockoutPreviewRosters?.[aiClubs[0].id]?.length).toBe(11);
  });

  it('4. Source contract checks: shared popup with PK visual, zero solo controls in multiplayer, zero tactics editor in MP knockout preview, no CSS zoom', () => {
    expect(sharedPopupSrc).toContain('PenaltyShootoutVisual');
    expect(sharedPopupSrc).toContain('ModalBodyLock');
    expect(sharedPopupSrc).toContain('solo-ucl-cast-pause-btn');
    expect(sharedPopupSrc).toContain('solo-ucl-cast-direct-2d-btn');
    expect(sharedPopupSrc).not.toMatch(/zoom\s*:/);

    expect(mpBoardSrc).toContain('UclMulticastPopupBoard');
    expect(mpBoardSrc).not.toContain('soloControls');

    expect(soloDashSrc).toContain('UclMulticastPopupBoard');
    expect(soloDashSrc).toContain('solo-ucl-ko-boundary-bar');
    expect(soloDashSrc).toContain('solo-ucl-ko-continue-btn');
    expect(soloDashSrc).toContain('solo-ucl-ko-direct-2d-btn');
    expect(soloDashSrc).not.toContain('<SoloLiveScoreboard');

    expect(mpPreviewSrc).toContain('ModalBodyLock');
    expect(mpPreviewSrc).toContain('UnifiedTacticsStrip');
    expect(mpPreviewSrc).toContain('생존자 준비');
    expect(mpPreviewSrc).toContain('다음 경기 진행');
    expect(mpPreviewSrc).not.toContain('MpLeagueSquadEditor');
    expect(mpPreviewSrc).not.toContain('전술 수정');
    expect(mpPreviewSrc).not.toMatch(/zoom\s*:/);
  });

  it('5. v9.2.1 hotfix: mounts already-settled UCL casts directly at final FT/AET/PK state so post-match interviews never replay leg 1', () => {
    const regularCast = {
      key: 'solo-ucl-cast:r16-leg1',
      title: 'UCL 16강 1차전',
      matches: [
        {
          key: 'm1',
          label: 'UCL 16강 1차전',
          homeTeamId: USER_CLUB_ID,
          awayTeamId: 'opp-1',
          homeGoals: 2,
          awayGoals: 1,
          extraTime: false,
          goals: [{ minute: 20, teamId: USER_CLUB_ID, scorer: '에이스' }],
          humanClubIds: [USER_CLUB_ID],
        },
      ],
    };
    expect(getInitialUclCastClock(regularCast, false)).toEqual({
      minute: 0,
      phase: 'regular',
      revealedPenKicks: 0,
    });
    expect(getInitialUclCastClock(regularCast, true)).toEqual({
      minute: 90,
      phase: 'final',
      revealedPenKicks: 0,
    });

    const etPkCast = {
      key: 'solo-ucl-cast:r16-leg2',
      title: 'UCL 16강 2차전',
      matches: [
        {
          ...regularCast.matches[0],
          extraTime: true,
          penalties: {
            home: 5,
            away: 4,
            winnerId: USER_CLUB_ID,
            kicks: Array.from({ length: 10 }, (_, idx) => ({
              round: Math.floor(idx / 2) + 1,
              side: idx % 2 === 0 ? ('home' as const) : ('away' as const),
              teamId: idx % 2 === 0 ? USER_CLUB_ID : 'opp-1',
              teamShortName: idx % 2 === 0 ? 'USR' : 'OPP',
              kickerName: `키커${idx}`,
              scored: idx !== 9,
              homeScoreAfter: Math.floor(idx / 2) + (idx % 2 === 0 ? 1 : 0),
              awayScoreAfter: Math.floor(idx / 2) + (idx % 2 === 1 && idx !== 9 ? 1 : 0),
            })),
          },
        },
      ],
    };
    expect(getInitialUclCastClock(etPkCast, true)).toEqual({
      minute: 120,
      phase: 'final',
      revealedPenKicks: 10,
    });

    expect(sharedPopupSrc).toContain('initiallySettled?: boolean');
    expect(sharedPopupSrc).toContain('if (initiallySettled)');
    expect(soloDashSrc).toContain('isActiveCastAlreadySettled');
    expect(soloDashSrc).toContain('initiallySettled={isActiveCastAlreadySettled}');
  });
});

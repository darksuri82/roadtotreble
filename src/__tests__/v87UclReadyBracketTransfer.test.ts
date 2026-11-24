import { describe, expect, it } from 'vitest';
import {
  buildUclConsentFlow,
  createMpLeagueSeason,
  endMpLeagueCast,
  grantMpLeagueConsent,
  humansAliveInUcl,
  mpHumanClubId,
  runMpLeague,
} from '../engine/mpLeagueEngine';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import {
  normalizeMpLeagueSettings,
  type MpLeagueHostState,
  type MpLeagueHuman,
  type MpSquadInput,
} from '../types/mpLeague';
import type { Player } from '../types/player';
import type { UclKnockoutTie } from '../types/ucl';

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

function makeThreePlayerState(): {
  base: MpLeagueHostState;
  humans: MpLeagueHuman[];
  squads: Record<string, MpSquadInput>;
} {
  const used = new Set<string>();
  const humans: MpLeagueHuman[] = [0, 1, 2].map((idx) => ({
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
    [humans[2].clubId]: buildQuickSquad(used),
  };
  const base = createMpLeagueSeason({
    roomId: 'room-v87',
    seasonKey: 'v87-ko-test',
    settings: normalizeMpLeagueSettings({
      leagueId: 'epl',
      uclEnabled: true,
      autoMs: 5000,
    }),
    draftLeaguePool: ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'],
    humans,
    squads,
  });
  return { base, humans, squads };
}

describe('v8.7 UCL 1st↔2nd leg prep consent, survivor-only ready & spoiler-free cast snapshot', () => {
  it('excludes eliminated players from knockout consent and transitions directly from Leg 1 cast end to Leg 2 consent with 0ms gap', () => {
    const { base, humans, squads } = makeThreePlayerState();
    const aiClubs = base.clubs.filter((c) => !humans.some((h) => h.clubId === c.id));

    // Only human[0] and human[1] remain alive in R16; human[2] was eliminated earlier!
    const r16Ties: UclKnockoutTie[] = [
      {
        id: 'r16-0',
        stage: 'r16',
        tieIndex: 0,
        teamAId: humans[0].clubId,
        teamBId: aiClubs[0].id,
        aggTeamA: 0,
        aggTeamB: 0,
        winnerId: null,
      },
      {
        id: 'r16-1',
        stage: 'r16',
        tieIndex: 1,
        teamAId: humans[1].clubId,
        teamBId: aiClubs[1].id,
        aggTeamA: 0,
        aggTeamB: 0,
        winnerId: null,
      },
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `r16-${i + 2}`,
        stage: 'r16' as const,
        tieIndex: i + 2,
        teamAId: aiClubs[i * 2 + 2].id,
        teamBId: aiClubs[i * 2 + 3].id,
        aggTeamA: 0,
        aggTeamB: 0,
        winnerId: null,
      })),
    ];

    const state: MpLeagueHostState = {
      ...base,
      stage: 'ucl',
      uclConsentedStage: 'league_phase',
      uclHumanClubIds: humans.map((h) => h.clubId),
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
        ties: { playoff: [], r16: r16Ties, qf: [], sf: [], final: [] },
        userEliminatedAt: null,
        championTeamId: null,
        lastUserMatch: null,
        completed: false,
      },
    };

    // 1) Survivors should ONLY be human[0] & human[1] (human[2] is eliminated)
    expect(humansAliveInUcl(state)).toEqual([humans[0].clubId, humans[1].clubId]);

    // 2) Leg 1 consent pauses specifically for R16 Leg 1 and only requires the 2 survivors
    const leg1ConsentState = runMpLeague(state, { squads });
    expect(leg1ConsentState.flow).toEqual({
      kind: 'consent',
      key: 'ucl-consent-r16-leg1',
      label: 'UCL 16강 토너먼트 1차전',
      requiredClubIds: [humans[0].clubId, humans[1].clubId],
      allEliminated: false,
    });

    // 3) Granting Leg 1 consent runs Leg 1 and produces a spoiler-free cast snapshot (prevUclTies + tieId)
    const afterLeg1 = runMpLeague(grantMpLeagueConsent(leg1ConsentState), { squads });
    expect(afterLeg1.flow.kind).toBe('cast');
    expect(afterLeg1.cast?.prevUclStage).toBe('r16');
    expect(afterLeg1.cast?.prevUclKnockoutLeg).toBe(1);
    expect(afterLeg1.cast?.prevUclTies?.r16[0].leg1).toBeUndefined();
    expect(afterLeg1.cast?.matches.every((m) => Boolean(m.tieId))).toBe(true);
    expect(afterLeg1.ucl?.knockoutLeg).toBe(2);

    // 4) Ending the Leg 1 cast transitions IMMEDIATELY into Leg 2 consent (zero extra auto-tick delay!)
    const afterCast = endMpLeagueCast(afterLeg1);
    expect(afterCast.cast).toBeNull();
    expect(afterCast.flow).toEqual({
      kind: 'consent',
      key: 'ucl-consent-r16-leg2',
      label: 'UCL 16강 토너먼트 2차전',
      requiredClubIds: [humans[0].clubId, humans[1].clubId],
      allEliminated: false,
    });
  });

  it('prevents softlock when 0 human survivors remain by emitting allEliminated consent and fast-finishing on host consent', () => {
    const { base, humans } = makeThreePlayerState();
    const aiClubs = base.clubs.filter((c) => !humans.some((h) => h.clubId === c.id));

    // Quarter-finals with ONLY AI clubs (all 3 humans eliminated!)
    const qfTies: UclKnockoutTie[] = Array.from({ length: 4 }, (_, i) => ({
      id: `qf-${i}`,
      stage: 'qf',
      tieIndex: i,
      teamAId: aiClubs[i * 2].id,
      teamBId: aiClubs[i * 2 + 1].id,
      aggTeamA: 0,
      aggTeamB: 0,
      winnerId: null,
    }));

    const allOutState: MpLeagueHostState = {
      ...base,
      stage: 'ucl',
      uclConsentedStage: 'r16:leg2',
      uclHumanClubIds: humans.map((h) => h.clubId),
      todo: [{ t: 'ucl_ko_leg' }],
      flow: { kind: 'auto' },
      ucl: {
        stage: 'qf',
        teams: [],
        clubs: base.clubs,
        aiRosters: base.aiRosters,
        leaguePhaseFixtures: [],
        leaguePhaseRound: 8,
        standings: [],
        userLeaguePhaseRank: 10,
        enteredViaPlayoff: true,
        knockoutLeg: 1,
        ties: { playoff: [], r16: [], qf: qfTies, sf: [], final: [] },
        userEliminatedAt: 'r16',
        championTeamId: null,
        lastUserMatch: null,
        completed: false,
      },
    };

    const consent = buildUclConsentFlow(allOutState);
    expect(consent).toEqual({
      kind: 'consent',
      key: 'ucl-consent-finish-qf-leg1',
      label: 'UCL 전원 탈락 · 남은 토너먼트',
      requiredClubIds: [],
      allEliminated: true,
    });

    const paused: MpLeagueHostState = { ...allOutState, flow: consent! };
    const finished = grantMpLeagueConsent(paused);
    expect(finished.ucl?.completed).toBe(true);
    expect(finished.ucl?.championTeamId).toBeTruthy();
    expect(finished.todo).toEqual([{ t: 'finalize' }]);
    expect(finished.flow).toEqual({ kind: 'auto' });
  });
});

import { describe, expect, it } from 'vitest';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { ALL_PLAYERS } from '../engine/dataLoader';
import { spinClubRoulette } from '../engine/draftEngine';
import {
  simulateExtraTimeFirstHalf,
  simulateExtraTimeSecondHalfAndPenalties,
  simulateFirstHalf,
  simulateSecondHalf,
} from '../engine/matchEngine';
import type { UserMatchContext } from '../engine/matchEngine';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  buildDraftProgressPayload,
  createRoom,
  generateRoomCode,
  joinRoomByCode,
  MP_GUEST_TEAM_ID,
  MP_HOST_TEAM_ID,
  sanitizeRoomCode,
} from '../services/multiplayerService';
import type { FormationId, ManagerTraitId } from '../types/game';
import type { Club, Fixture, TacticId } from '../types/league';
import type { Player } from '../types/player';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';

function buildSampleSquad(): { starters: Player[]; bench: Player[] } {
  const all = ALL_PLAYERS;
  const gks = all.filter((p) => p.position === 'GK').slice(0, 2);
  const dfs = all.filter((p) => p.position === 'DF').slice(0, 5);
  const mfs = all.filter((p) => p.position === 'MF').slice(0, 5);
  const fws = all.filter((p) => p.position === 'FW').slice(0, 4);

  const starters = [
    gks[0],
    dfs[0],
    dfs[1],
    dfs[2],
    dfs[3],
    mfs[0],
    mfs[1],
    mfs[2],
    fws[0],
    fws[1],
    fws[2],
  ];
  const bench = [gks[1], dfs[4], mfs[3], mfs[4], fws[3]];
  return { starters, bench };
}

function makePvpTeam(params: {
  id: string;
  name: string;
  shortName: string;
  formation: FormationId;
  tactic: TacticId;
  traitId: ManagerTraitId;
  starters: Player[];
  bench: Player[];
  halftimeAdjusted?: boolean;
  halftimeSubsMade?: number;
  halftimeSubIds?: string[];
  firstHalfStarters?: Player[];
}): { club: Club; ctx: UserMatchContext } {
  const chem = calculateChemistry(
    params.formation,
    params.starters,
    params.tactic,
    params.traitId,
  );
  const ratings = calculateTeamRatings(
    params.formation,
    params.starters,
    chem.total,
    params.traitId,
    chem.slotSynergies,
  );
  const club: Club = {
    id: params.id,
    name: params.name,
    shortName: params.shortName,
    primaryColor: '#10b981',
    secondaryColor: '#0f172a',
    pattern: 'solid',
    formation: params.formation,
    defaultTactic: params.tactic,
    att: Math.round(ratings.effectiveAtt || 84),
    mid: Math.round(ratings.effectiveMid || 84),
    def: Math.round(ratings.effectiveDef || 84),
    topScorers: [
      params.starters[10].name,
      params.starters[9].name,
      params.starters[8].name,
    ],
    isUser: params.id === MP_HOST_TEAM_ID,
  };
  const ctx: UserMatchContext = {
    userClubId: params.id,
    formation: params.formation,
    tactic: params.tactic,
    starters: params.starters,
    bench: params.bench,
    chemistry: chem.total,
    ratings,
    slotSynergies: chem.slotSynergies,
    managerTraitId: params.traitId,
    halftimeAdjusted: params.halftimeAdjusted ?? false,
    halftimeSubsMade: params.halftimeSubsMade ?? 0,
    halftimeSubIds: params.halftimeSubIds ?? [],
    firstHalfStarters: params.firstHalfStarters,
    liveSubs: [],
    allowAutoSubs: false,
    opponentRank: 1,
    competition: 'ucl',
  };
  return { club, ctx };
}

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('v7.0 Multiplayer 1v1 Infrastructure & Blind Draft Privacy', () => {
  it('generates clean 6-char room codes excluding ambiguous characters', () => {
    const rng = makeSeededRng(42);
    for (let i = 0; i < 30; i += 1) {
      const code = generateRoomCode(rng);
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
    expect(sanitizeRoomCode(' a7k-9m2!! ')).toBe('A7K9M2');
  });

  it('enforces zero-leak draft progress payload (no player picks or manager traits)', () => {
    const p1 = buildDraftProgressPayload(9, false);
    expect(Object.keys(p1).sort()).toEqual(['draft_completed', 'draft_progress']);
    expect(p1).toEqual({ draft_progress: 9, draft_completed: false });

    const clampedHigh = buildDraftProgressPayload(99, true);
    expect(clampedHigh).toEqual({ draft_progress: 16, draft_completed: true });

    const clampedLow = buildDraftProgressPayload(-5, false);
    expect(clampedLow).toEqual({ draft_progress: 0, draft_completed: false });
  });

  it('allows independent blind drafts with duplicate players across both teams', () => {
    const hostPicked = new Set<string>();
    const guestPicked = new Set<string>();
    const hostReels = spinClubRoulette('ST', 'FW', hostPicked, {
      allowedLeagueIds: ['epl'],
    });
    const hostFirstPick = hostReels[0]?.candidates[0];
    expect(hostFirstPick).toBeDefined();
    if (hostFirstPick) hostPicked.add(hostFirstPick.id);

    // Guest's pickedIds is isolated, so hostFirstPick is NOT excluded for Guest
    expect(guestPicked.has(hostFirstPick!.id)).toBe(false);
    const guestReels = spinClubRoulette('ST', 'FW', guestPicked, {
      allowedLeagueIds: ['epl'],
    });
    expect(guestReels.length).toBe(3);
  });

  it('gracefully reports unconfigured Supabase without throwing exceptions', async () => {
    if (!isSupabaseConfigured) {
      expect(getSupabaseClient()).toBeNull();
      const createRes = await createRoom({
        playerId: 'test-host',
        nickname: '테스터',
        avatar: DEFAULT_MANAGER_AVATAR,
        clubProfile: {
          name: 'FC 테스트',
          shortName: 'TST',
          primaryColor: '#10b981',
          secondaryColor: '#0f172a',
          pattern: 'solid',
        },
      });
      expect(createRes.data).toBeNull();
      expect(createRes.error).toBeTruthy();

      const joinRes = await joinRoomByCode({
        code: 'ABC234',
        playerId: 'test-guest',
        nickname: '도전자',
        avatar: DEFAULT_MANAGER_AVATAR,
        clubProfile: {
          name: 'FC 도전자',
          shortName: 'CHL',
          primaryColor: '#38bdf8',
          secondaryColor: '#0f172a',
          pattern: 'solid',
        },
      });
      expect(joinRes.data).toBeNull();
      expect(joinRes.error).toBeTruthy();
    }
  });
});

describe('v7.0 Symmetric 1v1 PvP Match Engine (Zero AI Override)', () => {
  it('honors both Host and Guest halftime formation/tactic/subs without AI counterplay override', () => {
    const squadA = buildSampleSquad();
    const squadB = buildSampleSquad(); // Duplicate players allowed in 1v1 blind draft!

    const host1st = makePvpTeam({
      id: MP_HOST_TEAM_ID,
      name: '호스트 FC',
      shortName: 'HST',
      formation: '4-3-3',
      tactic: 'possession',
      traitId: 'tiki_taka',
      starters: squadA.starters,
      bench: squadA.bench,
    });
    const guest1st = makePvpTeam({
      id: MP_GUEST_TEAM_ID,
      name: '게스트 FC',
      shortName: 'GST',
      formation: '4-4-2',
      tactic: 'counter',
      traitId: 'catenaccio',
      starters: squadB.starters,
      bench: squadB.bench,
    });

    const fixture: Fixture = {
      id: 'mp-test-fixture-1',
      round: 1,
      homeTeamId: MP_HOST_TEAM_ID,
      awayTeamId: MP_GUEST_TEAM_ID,
      played: false,
    };

    const rng = makeSeededRng(2026);
    const ht = simulateFirstHalf({
      fixture,
      homeClub: host1st.club,
      awayClub: guest1st.club,
      homeRoster: squadA.starters,
      awayRoster: squadB.starters,
      userContext: host1st.ctx,
      opponentUserContext: guest1st.ctx,
      rng,
    });

    expect(ht.homeFormation).toBe('4-3-3');
    expect(ht.awayFormation).toBe('4-4-2');
    expect(ht.homeTactic).toBe('possession');
    expect(ht.awayTactic).toBe('counter');

    // Halftime: Host switches to 4-2-3-1 wingplay; Guest switches to 3-5-2 gegenpressing + 1 sub!
    const guest2ndStarters = [...squadB.starters];
    const guestOut = guest2ndStarters[10];
    const guestIn = squadB.bench[4];
    guest2ndStarters[10] = guestIn;

    const host2nd = makePvpTeam({
      id: MP_HOST_TEAM_ID,
      name: '호스트 FC',
      shortName: 'HST',
      formation: '4-2-3-1',
      tactic: 'wingplay',
      traitId: 'tiki_taka',
      starters: squadA.starters,
      bench: squadA.bench,
      halftimeAdjusted: true,
      firstHalfStarters: squadA.starters,
    });
    const guest2nd = makePvpTeam({
      id: MP_GUEST_TEAM_ID,
      name: '게스트 FC',
      shortName: 'GST',
      formation: '3-5-2',
      tactic: 'gegenpressing',
      traitId: 'catenaccio',
      starters: guest2ndStarters,
      bench: [...squadB.bench.slice(0, 4), guestOut],
      halftimeAdjusted: true,
      halftimeSubsMade: 1,
      halftimeSubIds: [guestIn.id],
      firstHalfStarters: squadB.starters,
    });

    const fullResult = simulateSecondHalf({
      halftime: ht,
      homeClub: host2nd.club,
      awayClub: guest2nd.club,
      homeRoster: host2nd.ctx.starters,
      awayRoster: guest2nd.ctx.starters,
      userContext: host2nd.ctx,
      opponentUserContext: guest2nd.ctx,
      opponentHalftimeSubs: [
        { outPlayerName: guestOut.name, inPlayerName: guestIn.name },
      ],
      rng,
    });

    // AI counterplay MUST be bypassed completely
    expect(fullResult.aiHalftimeAdjustment).toBeUndefined();
    // Exact human formations & tactics preserved
    expect(fullResult.homeFormation).toBe('4-2-3-1');
    expect(fullResult.homeTactic).toBe('wingplay');
    expect(fullResult.awayFormation).toBe('3-5-2');
    expect(fullResult.awayTactic).toBe('gegenpressing');
    // Guest's 46' sub event appears in shared timeline
    const guestSubEv = fullResult.events.find(
      (e) =>
        e.type === 'sub' &&
        e.teamId === MP_GUEST_TEAM_ID &&
        e.subInName === guestIn.name,
    );
    expect(guestSubEv).toBeDefined();

    // Extra Time 1st Half + 2nd Half + PK resolution with symmetric PvP contexts
    const tied90 = {
      ...fullResult,
      homeGoals: 1,
      awayGoals: 1,
      homeGoals90: 1,
      awayGoals90: 1,
    };
    const et1 = simulateExtraTimeFirstHalf({
      baseResult: tied90,
      homeClub: host2nd.club,
      awayClub: guest2nd.club,
      homeRoster: host2nd.ctx.starters,
      awayRoster: guest2nd.ctx.starters,
      userContext: host2nd.ctx,
      opponentUserContext: guest2nd.ctx,
      rng: makeSeededRng(77),
    });
    expect(et1.extraTime).toBeDefined();

    const et2 = simulateExtraTimeSecondHalfAndPenalties({
      et1Result: et1,
      homeClub: host2nd.club,
      awayClub: guest2nd.club,
      homeRoster: host2nd.ctx.starters,
      awayRoster: guest2nd.ctx.starters,
      userContext: host2nd.ctx,
      opponentUserContext: guest2nd.ctx,
      rng: makeSeededRng(99),
    });
    expect(et2.extraTime?.winnerTeamId).toBeTruthy();
    if (et2.homeGoals === et2.awayGoals) {
      expect(et2.extraTime?.penalties).toBeDefined();
      expect([MP_HOST_TEAM_ID, MP_GUEST_TEAM_ID]).toContain(
        et2.extraTime?.penalties?.winnerTeamId,
      );
    }
  });
});

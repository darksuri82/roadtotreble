import { describe, expect, it } from 'vitest';
import dashSrc from '../components/multiplayer/league/MpLeagueDashboard.tsx?raw';
import draftSrc from '../components/multiplayer/league/MpLeagueDraftBoard.tsx?raw';
import finalSrc from '../components/multiplayer/league/MpLeagueFinalBoard.tsx?raw';
import summarySrc from '../components/multiplayer/league/MpLeagueSeasonSummary.tsx?raw';
import previewSrc from '../components/multiplayer/league/MpUclMatchPreviewModal.tsx?raw';
import hostSrc from '../components/multiplayer/league/useMpLeagueHost.ts?raw';
import {
  hasMpPopupBeenSeen,
  markMpPopupSeen,
} from '../components/multiplayer/league/MpLeagueDashboard';
import { MANAGER_TRAIT_LIST } from '../data/managerTraits';
import { ALL_PLAYERS, getLeagueById } from '../engine/dataLoader';
import { buildQuickLineupOverrides } from '../engine/mpLeagueDraft';
import {
  applyMpLeagueTacticsUpdate,
  buildMpAwakeningSeenKey,
  createMpLeagueSeason,
  dismissMpLeagueAwakeningAlert,
  hydrateMpSquadWithAwakenings,
  runMpLeague,
} from '../engine/mpLeagueEngine';
import { finalizeMpLeagueSeason } from '../engine/mpLeagueScore';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import {
  normalizeMpLeagueSettings,
  type MpLeagueHuman,
  type MpSquadInput,
} from '../types/mpLeague';
import type { Player, PlayerAwakeningRecord } from '../types/player';

function pickRealistic16(offset = 0): { starters: Player[]; bench: Player[] } {
  const all = ALL_PLAYERS.filter((p) => !p.isLegend && p.ovr <= 85).slice(offset);
  const gks = all.filter((p) => p.position === 'GK');
  const dfs = all.filter((p) => p.position === 'DF');
  const mfs = all.filter((p) => p.position === 'MF');
  const fws = all.filter((p) => p.position === 'FW');

  const starters: Player[] = [
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
  const used = new Set(starters.map((p) => p.id));
  const bench: Player[] = [
    gks[1],
    dfs[4],
    mfs[3],
    fws[3],
    all.find(
      (p) =>
        !used.has(p.id) &&
        p.id !== gks[1].id &&
        p.id !== dfs[4].id &&
        p.id !== mfs[3].id &&
        p.id !== fws[3].id,
    )!,
  ];
  return { starters, bench };
}

function makeHumans(): MpLeagueHuman[] {
  const clubs = getLeagueById('epl').clubs;
  return [
    {
      playerId: 'host-p1',
      nickname: '방장감독',
      avatar: DEFAULT_MANAGER_AVATAR,
      clubId: clubs[0].id,
      profile: {
        name: clubs[0].name,
        shortName: clubs[0].shortName,
        primaryColor: clubs[0].primaryColor,
        secondaryColor: clubs[0].secondaryColor,
        pattern: clubs[0].pattern ?? 'solid',
      },
      managerTraitId: MANAGER_TRAIT_LIST[0].id,
    },
    {
      playerId: 'guest-p2',
      nickname: '참가감독',
      avatar: DEFAULT_MANAGER_AVATAR,
      clubId: clubs[1].id,
      profile: {
        name: clubs[1].name,
        shortName: clubs[1].shortName,
        primaryColor: clubs[1].primaryColor,
        secondaryColor: clubs[1].secondaryColor,
        pattern: clubs[1].pattern ?? 'solid',
      },
      managerTraitId: MANAGER_TRAIT_LIST[1].id,
    },
  ];
}

describe('v9.8.0 Multi-League Polish & Single-Player Parity', () => {
  it('1. buildQuickLineupOverrides optimizes scrambled drafted squad without losing or duplicating picks', () => {
    const { starters, bench } = pickRealistic16(0);
    const all16 = [...starters, ...bench];
    // Intentionally scramble positions: put a FW in slot 0 (GK) and GK on the bench
    const scrambled = [...all16].reverse();

    const overrides = buildQuickLineupOverrides({
      formation: '4-3-3',
      starters: scrambled.slice(0, 11),
      bench: scrambled.slice(11, 16),
      tactic: 'possession',
      managerTraitId: MANAGER_TRAIT_LIST[0].id,
    });

    // Must map all 16 unique players onto 16 distinct slots (11 starters + 5 bench)
    expect(Object.keys(overrides)).toHaveLength(16);
    const occupied = new Set<string>();
    let gkStarterSlot = -1;
    for (const [pid, pos] of Object.entries(overrides)) {
      const slotKey = `${pos.area}:${pos.index}`;
      expect(occupied.has(slotKey)).toBe(false);
      occupied.add(slotKey);
      const pl = all16.find((x) => x.id === pid)!;
      if (pos.area === 'starter' && pos.index === 0 && pl.position === 'GK') {
        gkStarterSlot = 0;
      }
    }
    expect(gkStarterSlot).toBe(0);
  });

  it('2. Awakening hydration propagates into squad, summary.squads, and final.squads for both host and guest', () => {
    const humans = makeHumans();
    const s1 = pickRealistic16(0);
    const s2 = pickRealistic16(40);
    const squads: Record<string, MpSquadInput> = {
      [humans[0].clubId]: {
        managerTraitId: humans[0].managerTraitId,
        formation: '4-3-3',
        tactic: 'possession',
        starters: s1.starters,
        bench: s1.bench,
      },
      [humans[1].clubId]: {
        managerTraitId: humans[1].managerTraitId,
        formation: '4-2-3-1',
        tactic: 'counter',
        starters: s2.starters,
        bench: s2.bench,
      },
    };

    const hostTarget = s1.starters[8];
    const guestTarget = s2.starters[9];
    const hostRecord: PlayerAwakeningRecord = {
      originalOvr: hostTarget.ovr,
      ovrGain: 5,
      round: 14,
      competition: 'league',
      statDeltas: [{ key: 'sho', label: '슈팅', before: 78, after: 84 }],
    };
    const guestRecord: PlayerAwakeningRecord = {
      originalOvr: guestTarget.ovr,
      ovrGain: 4,
      round: 21,
      competition: 'league',
      statDeltas: [{ key: 'pas', label: '패스', before: 76, after: 82 }],
    };

    const hydratedHost = hydrateMpSquadWithAwakenings(squads[humans[0].clubId], {
      [hostTarget.id]: hostRecord,
    });
    expect(hydratedHost.starters[8].ovr).toBe(hostTarget.ovr + 5);
    expect(hydratedHost.starters[8].awakening?.ovrGain).toBe(5);
    // Original static player object must never be mutated
    expect(hostTarget.awakening).toBeUndefined();

    // Propagate through stepFinishLeague -> summary.squads & finalizeMpLeagueSeason -> final.squads
    const state = createMpLeagueSeason({
      roomId: 'room-1',
      seasonKey: '2026-S1',
      settings: normalizeMpLeagueSettings({ leagueId: 'epl', uclEnabled: false }),
      draftLeaguePool: ['epl'],
      humans,
      squads,
    });
    state.perHuman[humans[0].clubId].awakenedPlayers = { [hostTarget.id]: hostRecord };
    state.perHuman[humans[1].clubId].awakenedPlayers = { [guestTarget.id]: guestRecord };
    state.round = state.totalRounds;
    state.flow = { kind: 'auto' };
    state.todo = [{ t: 'finish_league' }];

    const finished = runMpLeague(state, { squads });
    expect(finished.summary?.squads?.[humans[0].clubId]?.starters[8].awakening?.ovrGain).toBe(5);
    expect(finished.summary?.squads?.[humans[1].clubId]?.starters[9].awakening?.ovrGain).toBe(4);

    const finalState = finalizeMpLeagueSeason(finished, squads);
    expect(finalState.final?.squads?.[humans[0].clubId]?.starters[8].ovr).toBe(
      hostTarget.ovr + 5,
    );
    expect(finalState.final?.squads?.[humans[1].clubId]?.starters[9].ovr).toBe(
      guestTarget.ovr + 4,
    );
  });

  it('3. Awakening 1-time seen key & targeted idempotent dismiss prevent duplicate popups', () => {
    const k1 = buildMpAwakeningSeenKey('2026-S1', 'club-a', 'player-10');
    const k2 = buildMpAwakeningSeenKey('2026-S1', 'club-a', 'player-11');
    const k3 = buildMpAwakeningSeenKey('2026-S2', 'club-a', 'player-10');
    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);

    const uniqueKey = `test-room-${Date.now()}:${k1}`;
    expect(hasMpPopupBeenSeen(uniqueKey)).toBe(false);
    markMpPopupSeen(uniqueKey);
    expect(hasMpPopupBeenSeen(uniqueKey)).toBe(true);

    // Targeted dismiss removes only the dismissed playerId and is idempotent on double-click / duplicate action
    const humans = makeHumans();
    const s1 = pickRealistic16(0);
    const s2 = pickRealistic16(40);
    const squads: Record<string, MpSquadInput> = {
      [humans[0].clubId]: {
        managerTraitId: humans[0].managerTraitId,
        formation: '4-3-3',
        tactic: 'possession',
        starters: s1.starters,
        bench: s1.bench,
      },
      [humans[1].clubId]: {
        managerTraitId: humans[1].managerTraitId,
        formation: '4-2-3-1',
        tactic: 'counter',
        starters: s2.starters,
        bench: s2.bench,
      },
    };
    const state = createMpLeagueSeason({
      roomId: 'room-1',
      seasonKey: '2026-S1',
      settings: normalizeMpLeagueSettings({ leagueId: 'epl', uclEnabled: false }),
      draftLeaguePool: ['epl'],
      humans,
      squads,
    });
    const cid = humans[0].clubId;
    state.perHuman[cid].pendingAwakeningAlerts = [
      {
        id: 'aw-1',
        playerId: 'p-first',
        playerName: '첫번째 선수',
        position: 'FW',
        mainPosition: 'ST',
        nationality: '대한민국',
        nationalityCode: 'KR',
        originalOvr: 80,
        newOvr: 85,
        ovrGain: 5,
        round: 10,
        competition: 'league',
        statDeltas: [],
      },
      {
        id: 'aw-2',
        playerId: 'p-second',
        playerName: '두번째 선수',
        position: 'MF',
        mainPosition: 'CM',
        nationality: '대한민국',
        nationalityCode: 'KR',
        originalOvr: 79,
        newOvr: 83,
        ovrGain: 4,
        round: 10,
        competition: 'league',
        statDeltas: [],
      },
    ];

    const afterFirst = dismissMpLeagueAwakeningAlert(state, cid, 'p-first');
    expect(afterFirst.perHuman[cid].pendingAwakeningAlerts?.map((a) => a.playerId)).toEqual([
      'p-second',
    ]);
    // Duplicate dismiss of 'p-first' must NOT accidentally drop 'p-second'
    const afterDuplicate = dismissMpLeagueAwakeningAlert(afterFirst, cid, 'p-first');
    expect(afterDuplicate.perHuman[cid].pendingAwakeningAlerts?.map((a) => a.playerId)).toEqual([
      'p-second',
    ]);
  });

  it('4. applyMpLeagueTacticsUpdate applies valid formation/tactic/lineup changes and rejects tampered rosters', () => {
    const humans = makeHumans();
    const s1 = pickRealistic16(0);
    const s2 = pickRealistic16(40);
    const baseSquad: MpSquadInput = {
      managerTraitId: humans[1].managerTraitId,
      formation: '4-3-3',
      tactic: 'possession',
      starters: s1.starters,
      bench: s1.bench,
    };
    const awakenedRec: PlayerAwakeningRecord = {
      originalOvr: s1.starters[0].ovr,
      ovrGain: 3,
      round: 15,
      competition: 'league',
      statDeltas: [],
    };
    const squads: Record<string, MpSquadInput> = {
      [humans[0].clubId]: {
        managerTraitId: humans[0].managerTraitId,
        formation: '4-3-3',
        tactic: 'possession',
        starters: s2.starters,
        bench: s2.bench,
      },
      [humans[1].clubId]: baseSquad,
    };
    const state = createMpLeagueSeason({
      roomId: 'room-1',
      seasonKey: '2026-S1',
      settings: normalizeMpLeagueSettings({ leagueId: 'epl', uclEnabled: true }),
      draftLeaguePool: ['epl'],
      humans,
      squads,
    });
    state.perHuman[humans[1].clubId].awakenedPlayers = {
      [s1.starters[0].id]: awakenedRec,
    };

    // Valid swap (bench[0] <-> starters[10]) + formation/tactic change to 3-2-4-1 / gegenpressing
    const nextStarters = [...s1.starters];
    const nextBench = [...s1.bench];
    const tmp = nextStarters[10];
    nextStarters[10] = nextBench[0];
    nextBench[0] = tmp;

    const updated = applyMpLeagueTacticsUpdate({
      state,
      squads,
      clubId: humans[1].clubId,
      formation: '3-2-4-1',
      tactic: 'gegenpressing',
      starterIds: nextStarters.map((p) => p.id),
      benchIds: nextBench.map((p) => p.id),
    });
    expect(updated).not.toBeNull();
    expect(updated?.formation).toBe('3-2-4-1');
    expect(updated?.tactic).toBe('gegenpressing');
    expect(updated?.starters[10].id).toBe(s1.bench[0].id);
    expect(updated?.starters[0].awakening?.ovrGain).toBe(3);

    // Tampered payload with unknown player ID must NOT admit fake player; authoritative roster stays intact
    const tampered = applyMpLeagueTacticsUpdate({
      state,
      squads,
      clubId: humans[1].clubId,
      formation: '3-2-4-1',
      tactic: 'counter',
      starterIds: ['fake-player-id', ...nextStarters.slice(1).map((p) => p.id)],
      benchIds: nextBench.map((p) => p.id),
    });
    expect(tampered).not.toBeNull();
    expect(tampered?.starters.some((p) => p.id === 'fake-player-id')).toBe(false);
    expect(tampered?.starters.map((p) => p.id)).toEqual(s1.starters.map((p) => p.id));
    expect(tampered?.bench.map((p) => p.id)).toEqual(s1.bench.map((p) => p.id));
  });

  it('5. Source contracts: popup queue, FFP chemPenalty fix, UCL inline tactics sync, draft quick lineup, and summary awakening hydration', () => {
    // Single sequential popup queue & 1-time awakening guard
    expect(dashSrc).toContain('activeOverlayModal');
    expect(dashSrc).toContain('buildMpAwakeningSeenKey');
    expect(dashSrc).toContain('hasMpPopupBeenSeen');
    expect(dashSrc).toContain('markMpPopupSeen');
    expect(dashSrc).toContain('mine?.budget?.chemPenalty ?? 0');
    expect(dashSrc).not.toMatch(/zoom\s*:/);

    // UCL preview inline tactics + unified single-player PitchBoard + async save before ack
    expect(previewSrc).toContain('PitchBoard');
    expect(previewSrc).toContain('UnifiedTacticsStrip');
    expect(previewSrc).toContain('ModalBodyLock');
    expect(previewSrc).toContain('onSaveSquad');
    expect(previewSrc).toContain('optimizeBestLineup');
    expect(previewSrc).not.toMatch(/zoom\s*:/);

    // Host flushes pending tactics_update actions before consent barrier advances
    expect(hostSrc).toContain("action.kind === 'tactics_update'");
    expect(hostSrc).toContain('applyMpLeagueTacticsUpdate');
    expect(hostSrc).toContain('await handleActions(st, squads, p, true)');

    // Draft Quick Lineup + duplicate-pick guard + v9.4 roulette parity
    expect(draftSrc).toContain('mpl-quick-lineup-btn');
    expect(draftSrc).toContain('buildQuickLineupOverrides');
    expect(draftSrc).toContain('submittingRef');
    expect(draftSrc).toContain('submittedTurnKeyRef');
    expect(draftSrc).toContain('previewTargetSubPosition');
    expect(draftSrc).toContain('expectedLinksByPlayerId');

    // Summary & Final Board defensive awakening hydration + H2H summary forwarding
    expect(summarySrc).toContain('hydrateMpSquadWithAwakenings');
    expect(summarySrc).toContain('h2hSummary');
    expect(finalSrc).toContain('hydrateMpSquadWithAwakenings');
    expect(finalSrc).toContain('h2hSummary');
  });
});

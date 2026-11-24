import { describe, expect, it } from 'vitest';
import {
  roundOrderIds,
  snakePickerIndex,
} from '../engine/mpLeagueDraft';
import {
  closeMpLeagueSummary,
  createMpLeagueSeason,
  grantMpLeagueConsent,
  mpHumanClubId,
  runMpLeague,
} from '../engine/mpLeagueEngine';
import {
  hasMpPopupBeenSeen,
  markMpPopupSeen,
} from '../components/multiplayer/league/MpLeagueDashboard';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import {
  normalizeMpLeagueSettings,
  type MpLeagueHostState,
  type MpLeagueHuman,
  type MpSquadInput,
} from '../types/mpLeague';
import type { Player } from '../types/player';

const DRAFT_ROUNDS = 16;

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

describe('v8.6 MP equalized draft order, 1-time popup latch, and UCL prep pause', () => {
  it('distributes roulette spins and first-pick turns evenly across 2P, 3P, and 4P drafts', () => {
    for (const playerCount of [2, 3, 4]) {
      const order = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);
      const firstPickCounts = Object.fromEntries(order.map((id) => [id, 0]));
      const totalPickCounts = Object.fromEntries(order.map((id) => [id, 0]));

      for (let round = 0; round < DRAFT_ROUNDS; round += 1) {
        const expectedRound = roundOrderIds(round, order);
        expect(expectedRound).toHaveLength(playerCount);
        expect(new Set(expectedRound).size).toBe(playerCount);

        for (let pos = 0; pos < playerCount; pos += 1) {
          const pickNo = round * playerCount + pos;
          const idx = snakePickerIndex(pickNo, playerCount);
          const pid = order[idx];
          expect(pid).toBe(expectedRound[pos]);
          totalPickCounts[pid] += 1;
          if (pos === 0) firstPickCounts[pid] += 1;
        }
      }

      // Every player receives exactly 16 total picks
      for (const pid of order) {
        expect(totalPickCounts[pid]).toBe(DRAFT_ROUNDS);
      }

      // First-pick / roulette-spin counts differ by at most 1 (2P: 8/8, 3P: 6/5/5, 4P: 4/4/4/4)
      const counts = Object.values(firstPickCounts);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      if (playerCount === 2) expect(counts).toEqual([8, 8]);
      if (playerCount === 3) expect(counts).toEqual([6, 5, 5]);
      if (playerCount === 4) expect(counts).toEqual([4, 4, 4, 4]);
    }
  });

  it('tracks seen MP popup keys strictly once via markMpPopupSeen / hasMpPopupBeenSeen', () => {
    const key = `ROOM86:season-test:player-a:cup-champ:${Date.now()}`;
    expect(hasMpPopupBeenSeen(key)).toBe(false);
    markMpPopupSeen(key);
    expect(hasMpPopupBeenSeen(key)).toBe(true);
    markMpPopupSeen(key);
    expect(hasMpPopupBeenSeen(key)).toBe(true);
  });

  it('pauses immediately for tactics prep when entering UCL League Phase before 1R and resumes cleanly on consent', () => {
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
      roomId: 'room-v86',
      seasonKey: 'v86-ucl-prep',
      settings: normalizeMpLeagueSettings({
        leagueId: 'epl',
        uclEnabled: true,
        autoMs: 5000,
      }),
      draftLeaguePool: ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'],
      humans,
      squads,
    });

    const enteringUcl: MpLeagueHostState = {
      ...base,
      stage: 'ucl',
      uclConsentedStage: null,
      uclHumanClubIds: [humans[0].clubId],
      ucl: {
        stage: 'league_phase',
        teams: [],
        clubs: base.clubs,
        aiRosters: {},
        leaguePhaseFixtures: [],
        leaguePhaseRound: 0,
        standings: [],
        userLeaguePhaseRank: null,
        enteredViaPlayoff: false,
        knockoutLeg: 1,
        ties: { playoff: [], r16: [], qf: [], sf: [], final: [] },
        userEliminatedAt: null,
        championTeamId: null,
        lastUserMatch: null,
        completed: false,
      },
      flow: { kind: 'summary', key: `league-summary-${base.seasonKey}` },
      todo: [{ t: 'league_summary' }, { t: 'ucl_lp_round' }],
    };

    // Closing league summary immediately pauses for UCL League Phase tactics prep
    const afterSummary = closeMpLeagueSummary(enteringUcl);
    expect(afterSummary.flow).toEqual({
      kind: 'consent',
      key: 'ucl-consent-league_phase',
      label: 'UCL 리그페이즈',
    });
    expect(afterSummary.ucl?.leaguePhaseRound).toBe(0);

    // Calling runMpLeague while unconsented holds at the same consent pause
    const held = runMpLeague(
      { ...afterSummary, flow: { kind: 'auto' } },
      { squads },
    );
    expect(held.flow).toEqual({
      kind: 'consent',
      key: 'ucl-consent-league_phase',
      label: 'UCL 리그페이즈',
    });

    // After everyone clicks Ready (grantMpLeagueConsent), uclConsentedStage is recorded and flow resumes
    const consented = grantMpLeagueConsent(held);
    expect(consented.uclConsentedStage).toBe('league_phase');
    expect(consented.flow).toEqual({ kind: 'auto' });
  });
});

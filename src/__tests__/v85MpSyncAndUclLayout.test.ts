import { describe, expect, it } from 'vitest';
import { hasPlayableTickerMatches } from '../components/multiplayer/league/MpLiveTicker';
import { uclZoneOf } from '../components/multiplayer/league/MpUclSidePanel';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
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
} from '../engine/mpLeagueEngine';
import { resolveMpH2HFullInstant } from '../engine/mpLeagueH2H';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type { ManagerTraitId } from '../types/game';
import type {
  MpLeagueHuman,
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
  const traits: ManagerTraitId[] = ['tiki_taka', 'gegenpress_guru'];
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

describe('v8.5 MP Fast Sync, Spoiler-Free Cup/Standings Snapshots & UCL Phase 2 Sidebar', () => {
  it('hasPlayableTickerMatches returns false for empty or instant-only tickers so popups can never deadlock', () => {
    expect(hasPlayableTickerMatches(null)).toBe(false);
    expect(hasPlayableTickerMatches(undefined)).toBe(false);
    expect(
      hasPlayableTickerMatches({ key: 'empty', title: 'R1', matches: [] }),
    ).toBe(false);
    expect(
      hasPlayableTickerMatches({
        key: 'h2h-only',
        title: 'R2',
        matches: [
          {
            key: 'm1',
            label: 'R2',
            homeTeamId: 'a',
            awayTeamId: 'b',
            goals: [],
            homeGoals: 1,
            awayGoals: 0,
            extraTime: false,
            humanClubIds: ['a', 'b'],
            instant: true,
          },
        ],
      }),
    ).toBe(false);
    expect(
      hasPlayableTickerMatches({
        key: 'live',
        title: 'R3',
        matches: [
          {
            key: 'm2',
            label: 'R3',
            homeTeamId: 'a',
            awayTeamId: 'c',
            goals: [],
            homeGoals: 2,
            awayGoals: 1,
            extraTime: false,
            humanClubIds: ['a'],
          },
        ],
      }),
    ).toBe(true);
  });

  it('uclZoneOf maps 1..8 to direct R16, 9..24 to playoff, and 25..36 to elimination', () => {
    expect(uclZoneOf(1).label).toBe('16강 직행');
    expect(uclZoneOf(8).label).toBe('16강 직행');
    expect(uclZoneOf(9).label).toBe('플레이오프');
    expect(uclZoneOf(24).label).toBe('플레이오프');
    expect(uclZoneOf(25).label).toBe('탈락권');
    expect(uclZoneOf(36).label).toBe('탈락권');
  });

  it('publishes spoiler-free prevCup/prevStandings/prevUclStandings on tickers and real-time UCL leaders in Phase 2', () => {
    const rng = mulberry32(202611);
    const used = new Set<string>();
    const humans = [makeHuman(0), makeHuman(1)];
    const squads: Record<string, MpSquadInput> = {
      [humans[0].clubId]: buildQuickSquad(used),
      [humans[1].clubId]: buildQuickSquad(used),
    };
    const env = { squads, rng };

    let state = createMpLeagueSeason({
      roomId: 'room-v85',
      seasonKey: 's-v85',
      settings: normalizeMpLeagueSettings({
        leagueId: 'seriea',
        uclEnabled: true,
        autoMs: 5000,
      }),
      draftLeaguePool: ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'],
      humans,
      squads,
      rng,
    });

    let verifiedLeagueTickerSnapshot = false;
    let verifiedCupFinalNoSpoiler = false;
    let verifiedUclSidebarSnapshot = false;

    for (let step = 0; step < 260; step += 1) {
      if (state.flow.kind === 'done') break;
      if (state.flow.kind === 'auto') {
        const prevCupCompleted = Boolean(state.cup?.completed);
        state = runMpLeague(state, env);
        const live = buildMpLeagueLive(state, squads);

        if (live.stage === 'league' && live.ticker && live.round === 1) {
          expect(live.ticker.prevStandings).toBeDefined();
          expect(live.ticker.prevStandings?.[0]?.played).toBe(0);
          expect(live.ticker.prevCup).toBeDefined();
          expect(live.ticker.prevTopScorers).toBeDefined();
          expect(live.ticker.prevTopAssisters).toBeDefined();
          verifiedLeagueTickerSnapshot = true;
        }

        // The exact turn the Coppa Italia Final completes, prevCup on ticker MUST still be uncompleted!
        if (!prevCupCompleted && live.cup?.completed && live.ticker) {
          expect(live.cup.championTeamId).toBeTruthy();
          expect(live.ticker.prevCup?.completed).toBe(false);
          expect(live.ticker.prevCup?.championTeamId).toBeNull();
          verifiedCupFinalNoSpoiler = true;
        }

        if (
          live.stage === 'ucl' &&
          live.ucl &&
          live.ucl.stage === 'league_phase' &&
          live.ucl.leaguePhaseRound >= 1 &&
          live.ticker
        ) {
          expect(live.ticker.prevUclStandings).toBeDefined();
          expect(live.ticker.prevUclStandings?.length).toBe(36);
          expect(live.ucl.standings.length).toBe(36);
          expect(Array.isArray(live.ucl.topScorers)).toBe(true);
          expect(Array.isArray(live.ucl.topAssisters)).toBe(true);
          verifiedUclSidebarSnapshot = true;
        }
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
    expect(verifiedLeagueTickerSnapshot).toBe(true);
    expect(verifiedCupFinalNoSpoiler).toBe(true);
    expect(verifiedUclSidebarSnapshot).toBe(true);
  }, 25_000);
});

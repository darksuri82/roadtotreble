import { describe, expect, it } from 'vitest';
import { getLeagueById } from '../engine/dataLoader';
import {
  advanceOtherLeaguesToProgress,
  buildFiveLeagueUclQualifiers,
  createOtherLeaguesState,
} from '../engine/otherLeaguesEngine';
import { createInitialStandings } from '../engine/standingsEngine';

function createSeededRng(seed = 2026): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('Background 4-League Simulation & Phase 2 UCL 20-Club Qualifier Engine', () => {
  it('synchronizes 38R and 34R background leagues proportionally and finishes all 5 leagues cleanly', () => {
    const rng = createSeededRng(99);
    const initial = createOtherLeaguesState('epl');

    expect(Object.keys(initial).sort()).toEqual([
      'bundesliga',
      'laliga',
      'ligue1',
      'seriea',
    ]);

    // Mid-season check: EPL 19/38R (50%) -> LaLiga/SerieA 19R, Bundesliga/Ligue1 17R
    const mid = advanceOtherLeaguesToProgress(initial, 19, 38, rng);
    expect(mid.laliga?.currentRound).toBe(19);
    expect(mid.seriea?.currentRound).toBe(19);
    expect(mid.bundesliga?.currentRound).toBe(17);
    expect(mid.ligue1?.currentRound).toBe(17);

    for (const st of mid.bundesliga?.standings ?? []) {
      expect(st.played).toBe(17);
    }

    // End-of-season check: EPL 38/38R -> all 4 leagues complete full schedule
    const finalState = advanceOtherLeaguesToProgress(mid, 38, 38, rng);
    expect(finalState.laliga?.currentRound).toBe(38);
    expect(finalState.seriea?.currentRound).toBe(38);
    expect(finalState.bundesliga?.currentRound).toBe(34);
    expect(finalState.ligue1?.currentRound).toBe(34);

    expect(finalState.laliga?.standings[0].points).toBeGreaterThan(60);
    expect(finalState.bundesliga?.standings[0].points).toBeGreaterThan(55);
  });

  it('extracts exact Top 4 UCL qualifiers from all 5 leagues (20 unique clubs total)', () => {
    const rng = createSeededRng(4242);
    const epl = getLeagueById('epl');
    const eplStandings = createInitialStandings(epl.clubs);
    const other = advanceOtherLeaguesToProgress(
      createOtherLeaguesState('epl'),
      38,
      38,
      rng,
    );

    const qualifiers = buildFiveLeagueUclQualifiers({
      userLeagueId: 'epl',
      userLeagueClubs: epl.clubs,
      userLeagueStandings: eplStandings,
      otherLeagues: other,
    });

    expect(qualifiers.length).toBe(5);
    const allTeamIds = new Set<string>();
    for (const entry of qualifiers) {
      expect(entry.teams.length).toBe(4);
      for (const t of entry.teams) {
        expect(allTeamIds.has(t.id)).toBe(false);
        allTeamIds.add(t.id);
      }
    }
    expect(allTeamIds.size).toBe(20);

    // Verify background league qualifiers match actual simulated Top 4 standings
    const bundesEntry = qualifiers.find((q) => q.leagueId === 'bundesliga')!;
    const bundesTop4Ids = other.bundesliga!.standings
      .slice(0, 4)
      .map((r) => r.teamId);
    expect(bundesEntry.teams.map((t) => t.id)).toEqual(bundesTop4Ids);
  });
});

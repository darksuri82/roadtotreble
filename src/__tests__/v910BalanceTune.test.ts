import { describe, expect, it } from 'vitest';
import { WHATS_NEW_HIGHLIGHT_RANGE } from '../components/common/WhatsNewModal';
import whatsNewSrc from '../components/common/WhatsNewModal.tsx?raw';
import { CURRENT_APP_VERSION, PATCH_NOTES } from '../data/patchNotes';
import {
  CASH_LEGEND_CHANCE_MAX_BONUS,
  CASH_LEGEND_CHANCE_PER_10M,
  classifyFfpTier,
  computeCashLegendChanceBonus,
  createSeasonBudgetState,
  DRAFT_BUDGET_CAP_M,
  evaluateSquadBudget,
} from '../engine/budgetEngine';
import {
  ACTIVE_PLAYERS,
  ALL_CLUBS_WITH_LEAGUE,
  LEAGUES,
  LEGEND_PLAYERS,
} from '../engine/dataLoader';
import {
  BIG_CLUB_RANDOM_DRAFT_MIN_AVG,
  isBigClubForRandomDraft,
  pickClubCandidatesForSlot,
} from '../engine/draftEngine';
import { evaluateTransferTarget } from '../engine/transferEngine';
import type { Player } from '../types/player';

function createSeededRng(seed = 2026): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('v9.10.0 Difficulty & Balance Patch', () => {
  it('1) enforces €900M draft soft cap, FFP Tier 1/2 thresholds, and uncapped 100% cash carryover', () => {
    expect(DRAFT_BUDGET_CAP_M).toBe(900);
    expect(classifyFfpTier(900)).toBe(0);
    expect(classifyFfpTier(901)).toBe(1);
    expect(classifyFfpTier(1035)).toBe(1); // 900 * 1.15 = 1035
    expect(classifyFfpTier(1036)).toBe(2);

    const lowBudgetSquad: Player[] = Array.from({ length: 16 }, (_, i) => ({
      ...ACTIVE_PLAYERS[0],
      id: `value-${i}`,
      ovr: 76, // €16M each -> €256M total -> €644M carryover (uncapped)
      isLegend: false,
    }));
    const ev = evaluateSquadBudget(lowBudgetSquad);
    expect(ev.ffpTier).toBe(0);
    expect(ev.remainingM).toBe(DRAFT_BUDGET_CAP_M - ev.spentM);
    expect(ev.remainingM).toBeGreaterThan(500);

    const seasonBudget = createSeasonBudgetState(lowBudgetSquad);
    expect(seasonBudget.transferCashM).toBe(ev.remainingM);
  });

  it('2) extracts big-club (avg >= 81, 12 teams) candidates uniformly at random while sorting displayed 3 cards OVR desc, and preserves Top-OVR extraction for mid/lower clubs', () => {
    expect(BIG_CLUB_RANDOM_DRAFT_MIN_AVG).toBe(81);

    const bigClubs = ALL_CLUBS_WITH_LEAGUE.filter((c) =>
      isBigClubForRandomDraft(c.club),
    );
    expect(bigClubs.length).toBe(12);

    // Real Madrid (big club, avg 85) has >3 CBs/CMs — repeated draws must surface non-top-3 players too,
    // while every returned 3-card batch remains sorted OVR descending for UI clarity.
    const laliga = LEAGUES.find((l) => l.id === 'laliga')!;
    const realMadrid = laliga.clubs.find((c) => c.name === '레알 마드리드')!;
    expect(isBigClubForRandomDraft(realMadrid)).toBe(true);

    const rng = createSeededRng(910);
    const seenIds = new Set<string>();
    const rmCms = ACTIVE_PLAYERS.filter(
      (p) => p.club === realMadrid.name && p.mainPositions.includes('CM'),
    ).sort((a, b) => b.ovr - a.ovr);
    expect(rmCms.length).toBeGreaterThan(3);

    for (let i = 0; i < 40; i += 1) {
      const cands = pickClubCandidatesForSlot({
        club: realMadrid,
        leagueId: 'laliga',
        targetSub: 'CM',
        targetBroad: 'MF',
        excludeIds: new Set(),
        activePool: ACTIVE_PLAYERS,
        count: 3,
        rng,
      });
      expect(cands.length).toBe(3);
      // Option B: displayed 3 cards sorted OVR descending
      expect(cands[0].ovr).toBeGreaterThanOrEqual(cands[1].ovr);
      expect(cands[1].ovr).toBeGreaterThanOrEqual(cands[2].ovr);
      for (const p of cands) seenIds.add(p.id);
    }
    // Uniform random across Real Madrid's CM pool must expose more than just the fixed top 3
    expect(seenIds.size).toBeGreaterThan(3);

    // Mid-table club (Lazio, avg 79 < 81) stays strictly deterministic Top-3 OVR
    const serieA = LEAGUES.find((l) => l.id === 'seriea')!;
    const lazio = serieA.clubs.find((c) => c.name === '라치오')!;
    expect(isBigClubForRandomDraft(lazio)).toBe(false);

    const firstIds = pickClubCandidatesForSlot({
      club: lazio,
      leagueId: 'seriea',
      targetSub: 'CM',
      targetBroad: 'MF',
      excludeIds: new Set(),
      activePool: ACTIVE_PLAYERS,
      count: 3,
      rng: createSeededRng(1),
    }).map((p) => p.id);

    const secondIds = pickClubCandidatesForSlot({
      club: lazio,
      leagueId: 'seriea',
      targetSub: 'CM',
      targetBroad: 'MF',
      excludeIds: new Set(),
      activePool: ACTIVE_PLAYERS,
      count: 3,
      rng: createSeededRng(999),
    }).map((p) => p.id);

    expect(secondIds).toEqual(firstIds);
  });

  it('3) lowers Era Classic FA signing chances to 15..30% (34% champion) and cash bonus to +1.2%p/€10M (max +12%p) without altering regular superstars', () => {
    expect(CASH_LEGEND_CHANCE_PER_10M).toBe(1.2);
    expect(CASH_LEGEND_CHANCE_MAX_BONUS).toBe(12);
    expect(computeCashLegendChanceBonus(50)).toBe(6);
    expect(computeCashLegendChanceBonus(100)).toBe(12);
    expect(computeCashLegendChanceBonus(250)).toBe(12);

    const peakClassic = [...LEGEND_PLAYERS].sort((a, b) => b.ovr - a.ovr)[0];
    const baseClassic = [...LEGEND_PLAYERS].sort((a, b) => a.ovr - b.ovr)[0];

    const bottomUser = evaluateTransferTarget({
      player: peakClassic,
      club: null,
      leagueId: 'LEGEND',
      clubRank: 1,
      leagueSize: 1,
      currentRound: 12,
      totalRounds: 38,
      windowIndex: 1,
      userRank: 20,
      userLeagueSize: 20,
      realStats: null,
    });
    expect(bottomUser.successChance).toBe(15);

    const rank1User = evaluateTransferTarget({
      player: baseClassic,
      club: null,
      leagueId: 'LEGEND',
      clubRank: 1,
      leagueSize: 1,
      currentRound: 12,
      totalRounds: 38,
      windowIndex: 1,
      userRank: 1,
      userLeagueSize: 20,
      realStats: null,
      championBonusActive: false,
    });
    expect(rank1User.successChance).toBe(30);

    const champUser = evaluateTransferTarget({
      player: baseClassic,
      club: null,
      leagueId: 'LEGEND',
      clubRank: 1,
      leagueSize: 1,
      currentRound: 38,
      totalRounds: 38,
      windowIndex: 4,
      userRank: 1,
      userLeagueSize: 20,
      realStats: null,
      championBonusActive: true,
    });
    expect(champUser.successChance).toBe(34);
  });

  it('4) synchronizes v9.10.0 patch notes and WhatsNewModal "난이도 상승!" default tab', () => {
    expect(CURRENT_APP_VERSION).toBe('v9.10.0');
    expect(PATCH_NOTES[0].version).toBe('v9.10.0');
    expect(WHATS_NEW_HIGHLIGHT_RANGE).toContain('v9.10.0');
    expect(whatsNewSrc).toContain("useState<WhatsNewTabId>('v910')");
    expect(whatsNewSrc).toContain('난이도 상승!');
  });
});

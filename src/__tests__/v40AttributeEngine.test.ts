import { describe, expect, it } from 'vitest';
import {
  computePositionWeightedAttributeOvr,
  getPlayerArchetypeProfile,
  getPlayerAttributes,
} from '../engine/attributeEngine';
import {
  ACTIVE_PLAYERS,
  ALL_PLAYERS,
  buildAiClubRoster,
  getLeagueById,
  LEGEND_PLAYERS,
} from '../engine/dataLoader';
import { simulateMatch } from '../engine/matchEngine';
import { generateDoubleRoundRobin } from '../engine/scheduleEngine';
import { computeTacticalPlayerOffset } from '../engine/tacticalMovement';
import type { AttackRouteId, Club, Fixture, LeagueId } from '../types/league';
import type { Player } from '../types/player';

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('v4.0 Sub-Attributes, Staged Attack Chain & Tactical 2D Movement', () => {
  it('verifies all 2,239 players have valid 40-99 sub-attributes within ±2 OVR consistency', () => {
    expect(ACTIVE_PLAYERS.length).toBeGreaterThanOrEqual(2200);
    expect(LEGEND_PLAYERS.length).toBe(101);

    for (const p of ALL_PLAYERS) {
      const attrs = getPlayerAttributes(p);
      for (const val of [
        attrs.sho,
        attrs.pas,
        attrs.cro,
        attrs.dri,
        attrs.aer,
        attrs.def,
        attrs.phy,
      ]) {
        expect(val).toBeGreaterThanOrEqual(40);
        expect(val).toBeLessThanOrEqual(99);
      }

      if (p.position === 'GK') {
        expect(attrs.gk).toBeDefined();
        if (attrs.gk) {
          for (const gval of [
            attrs.gk.div,
            attrs.gk.han,
            attrs.gk.ref,
            attrs.gk.kic,
            attrs.gk.pos,
          ]) {
            expect(gval).toBeGreaterThanOrEqual(40);
            expect(gval).toBeLessThanOrEqual(99);
          }
        }
      }

      const weightedOvr = computePositionWeightedAttributeOvr(p, attrs);
      expect(Math.abs(weightedOvr - p.ovr)).toBeLessThanOrEqual(2);

      // Archetype profile returns a non-empty tag & topStats
      const profile = getPlayerArchetypeProfile(p);
      expect(profile.tag.length).toBeGreaterThan(0);
      expect(profile.topStats.length).toBe(2);
    }

    // Spot-check key archetype relationships without artificial nerfs
    const byId = new Map(ALL_PLAYERS.map((p) => [p.id, p]));
    const yamal = getPlayerAttributes(byId.get('act-004')!);
    const olise = getPlayerAttributes(byId.get('act-017')!);
    const doku = getPlayerAttributes(byId.get('act-120')!);
    const haaland = getPlayerAttributes(byId.get('act-006')!);
    const kane = getPlayerAttributes(byId.get('act-002')!);
    const odegaard = getPlayerAttributes(byId.get('act-024')!);

    // Creative wingers retain strong SHO while excelling in PAS/CRO/DRI
    expect(yamal.dri).toBeGreaterThan(yamal.sho);
    expect(yamal.pas).toBeGreaterThan(yamal.sho);
    expect(yamal.sho).toBeGreaterThanOrEqual(85);
    expect(olise.cro).toBeGreaterThan(olise.sho);
    expect(olise.pas).toBeGreaterThan(olise.sho);
    expect(olise.sho).toBeGreaterThanOrEqual(85);
    // Crack dribbler excels in DRI & PHY
    expect(doku.dri).toBeGreaterThanOrEqual(93);
    expect(doku.phy).toBeGreaterThanOrEqual(90);
    // Target 9 excels in SHO & AER over PAS
    expect(haaland.sho).toBeGreaterThanOrEqual(95);
    expect(haaland.aer).toBeGreaterThanOrEqual(92);
    expect(haaland.sho).toBeGreaterThan(haaland.pas + 15);
    // Complete link-up 9 combines elite SHO with high PAS
    expect(kane.sho).toBeGreaterThanOrEqual(95);
    expect(kane.pas).toBeGreaterThanOrEqual(88);
    // Playmaker 10 excels in PAS
    expect(odegaard.pas).toBeGreaterThan(odegaard.sho + 6);
  });

  it('produces realistic multi-season archetype goals/assists and diverse attack routes across 5-league clubs', () => {
    const leaguesToSim: LeagueId[] = ['epl', 'laliga', 'bundesliga'];
    const seasons = 4;
    const rng = createSeededRng(20260401);

    const playerTotals = new Map<
      string,
      { name: string; club: string; pos: string; goals: number; assists: number; soloGoals: number; headerGoals: number }
    >();
    const routeCounts = new Map<AttackRouteId, number>();
    let totalGoals = 0;
    let totalAssistedGoals = 0;
    let totalHeaderGoals = 0;
    let totalSoloGoals = 0;
    let totalLongGoals = 0;
    let totalSetPieceGoals = 0;

    const recordPlayer = (p: Player) => {
      if (!playerTotals.has(p.id)) {
        playerTotals.set(p.id, {
          name: p.name,
          club: p.club,
          pos: p.mainPositions[0] ?? p.position,
          goals: 0,
          assists: 0,
          soloGoals: 0,
          headerGoals: 0,
        });
      }
      return playerTotals.get(p.id)!;
    };

    for (const lid of leaguesToSim) {
      const league = getLeagueById(lid);
      const rosterByClub = new Map<string, Player[]>();
      const clubById = new Map<string, Club>();
      const playerById = new Map<string, Player>();

      for (const c of league.clubs) {
        clubById.set(c.id, c);
        const r = buildAiClubRoster(c, lid);
        rosterByClub.set(c.id, r);
        for (const p of r) playerById.set(p.id, p);
      }

      for (let s = 0; s < seasons; s += 1) {
        const fixtures = generateDoubleRoundRobin(league.clubs, rng);
        for (const fix of fixtures) {
          const hClub = clubById.get(fix.homeTeamId)!;
          const aClub = clubById.get(fix.awayTeamId)!;
          const res = simulateMatch(
            fix,
            hClub,
            aClub,
            rosterByClub.get(hClub.id)!,
            rosterByClub.get(aClub.id)!,
            undefined,
            rng,
          );
          for (const ev of res.events) {
            if (ev.type !== 'goal') continue;
            totalGoals += 1;
            if (ev.assistId) totalAssistedGoals += 1;
            if (ev.attackRoute) {
              routeCounts.set(
                ev.attackRoute,
                (routeCounts.get(ev.attackRoute) ?? 0) + 1,
              );
            }
            if (ev.finishType === 'header') totalHeaderGoals += 1;
            if (ev.attackRoute === 'solo_dribble') totalSoloGoals += 1;
            if (ev.attackRoute === 'long_range_cannon') totalLongGoals += 1;
            if (
              ev.attackRoute === 'corner_header' ||
              ev.attackRoute === 'direct_fk' ||
              ev.attackRoute === 'penalty_kick'
            ) {
              totalSetPieceGoals += 1;
            }
            if (ev.scorerId && playerById.has(ev.scorerId)) {
              const rec = recordPlayer(playerById.get(ev.scorerId)!);
              rec.goals += 1;
              if (ev.attackRoute === 'solo_dribble') rec.soloGoals += 1;
              if (ev.finishType === 'header') rec.headerGoals += 1;
            }
            if (ev.assistId && playerById.has(ev.assistId)) {
              const rec = recordPlayer(playerById.get(ev.assistId)!);
              rec.assists += 1;
            }
          }
        }
      }
    }

    const assistRate = totalAssistedGoals / Math.max(1, totalGoals);
    const headerRate = totalHeaderGoals / Math.max(1, totalGoals);
    const soloRate = totalSoloGoals / Math.max(1, totalGoals);
    const longRate = totalLongGoals / Math.max(1, totalGoals);
    const setPieceRate = totalSetPieceGoals / Math.max(1, totalGoals);

    const watchIds = [
      'act-006', // 홀란
      'act-002', // 케인
      'act-001', // 음바페
      'act-054', // 요케레스
      'act-004', // 야말
      'act-017', // 올리세
      'act-027', // 사카
      'act-024', // 외데고르
      'act-0031', // 브루노
      'act-016', // 비니시우스
      'act-120', // 도쿠
    ];

    const summaryLines = watchIds.map((id) => {
      const r = playerTotals.get(id);
      if (!r) return `${id}: N/A`;
      const gPer = (r.goals / seasons).toFixed(1);
      const aPer = (r.assists / seasons).toFixed(1);
      return `${r.name} (${r.pos}): ${gPer}G / ${aPer}A per season (solo=${r.soloGoals}, hdr=${r.headerGoals})`;
    });
    console.log(
      `\n[v4.0 Archetype Sim (${seasons} seasons × 3 leagues, ${totalGoals} goals)]\n` +
        `Assist Rate: ${(assistRate * 100).toFixed(1)}% | Header: ${(headerRate * 100).toFixed(1)}% | SoloDribble: ${(soloRate * 100).toFixed(1)}% | LongShot: ${(longRate * 100).toFixed(1)}% | SetPiece: ${(setPieceRate * 100).toFixed(1)}%\n` +
        summaryLines.join('\n'),
    );

    // 1. All 14 diverse attack routes are represented
    expect(routeCounts.size).toBe(14);
    // 2. Realistic league-wide goal distribution
    expect(assistRate).toBeGreaterThanOrEqual(0.62);
    expect(assistRate).toBeLessThanOrEqual(0.84);
    expect(headerRate).toBeGreaterThanOrEqual(0.11);
    expect(headerRate).toBeLessThanOrEqual(0.28);
    expect(soloRate).toBeGreaterThanOrEqual(0.03);
    expect(longRate).toBeGreaterThanOrEqual(0.02);
    expect(setPieceRate).toBeGreaterThanOrEqual(0.18);
    expect(setPieceRate).toBeLessThanOrEqual(0.38);

    // 3. Archetype realism: Target 9 scores far more goals than assists
    const haalandRec = playerTotals.get('act-006')!;
    const kaneRec = playerTotals.get('act-002')!;
    const yamalRec = playerTotals.get('act-004')!;
    const oliseRec = playerTotals.get('act-017')!;
    const odegaardRec = playerTotals.get('act-024')!;
    const brunoRec = playerTotals.get('act-0031')!;

    expect(haalandRec.goals).toBeGreaterThan(haalandRec.assists * 2.2);
    expect(haalandRec.headerGoals).toBeGreaterThanOrEqual(4);
    expect(kaneRec.goals).toBeGreaterThan(kaneRec.assists * 1.4);
    // Creative wingers & 10s now produce strong assist totals naturally alongside goals
    expect(yamalRec.assists / seasons).toBeGreaterThanOrEqual(7.0);
    expect(yamalRec.goals / seasons).toBeGreaterThanOrEqual(5.0);
    expect(oliseRec.assists / seasons).toBeGreaterThanOrEqual(7.0);
    expect(oliseRec.goals / seasons).toBeGreaterThanOrEqual(5.0);
    expect(brunoRec.assists).toBeGreaterThan(brunoRec.goals * 0.75);
    expect(odegaardRec.assists / seasons).toBeGreaterThanOrEqual(5.5);
  }, 30000);

  it('produces distinct tactical possession, route profiles, and 2D off-ball offsets per tactic', () => {
    const epl = getLeagueById('epl');
    const clubA = { ...epl.clubs[0], defaultTactic: 'possession' as const };
    const clubB = { ...epl.clubs[1], defaultTactic: 'counter' as const };
    const rosterA = buildAiClubRoster(clubA, 'epl');
    const rosterB = buildAiClubRoster(clubB, 'epl');
    const rng = createSeededRng(777);

    let possSum = 0;
    const n = 20;
    for (let i = 0; i < n; i += 1) {
      const fix: Fixture = {
        id: `tac-${i}`,
        round: 1,
        homeTeamId: clubA.id,
        awayTeamId: clubB.id,
        played: false,
      };
      const res = simulateMatch(fix, clubA, clubB, rosterA, rosterB, undefined, rng);
      possSum += res.homePossession;
    }
    expect(possSum / n).toBeGreaterThan(54);

    // 2D Tactical Movement differentiation checks
    const gkPoss = computeTacticalPlayerOffset({
      slotIndex: 0,
      base: { x: 0.065, y: 0.5 },
      isHome: true,
      hasBall: true,
      tactic: 'possession',
      formation: '4-3-3',
      attackPhase: 0,
      ball: { x: 0.35, y: 0.5 },
      simClock: 2.0,
    });
    const gkCounter = computeTacticalPlayerOffset({
      slotIndex: 0,
      base: { x: 0.065, y: 0.5 },
      isHome: true,
      hasBall: false,
      tactic: 'counter',
      formation: '4-3-3',
      attackPhase: 0,
      ball: { x: 0.35, y: 0.5 },
      simClock: 2.0,
    });
    expect(gkPoss.x).toBeGreaterThan(gkCounter.x);

    // Wingplay fullback overlaps further forward & wider than possession inverted fullback
    const fbWing = computeTacticalPlayerOffset({
      slotIndex: 1,
      base: { x: 0.22, y: 0.14 },
      isHome: true,
      hasBall: true,
      tactic: 'wingplay',
      formation: '4-3-3',
      attackPhase: 2,
      ball: { x: 0.68, y: 0.2 },
      simClock: 3.0,
    });
    const fbPoss = computeTacticalPlayerOffset({
      slotIndex: 1,
      base: { x: 0.22, y: 0.14 },
      isHome: true,
      hasBall: true,
      tactic: 'possession',
      formation: '4-3-3',
      attackPhase: 2,
      ball: { x: 0.68, y: 0.2 },
      simClock: 3.0,
    });
    expect(fbWing.x).toBeGreaterThan(fbPoss.x); // deeper overlap
    expect(fbPoss.y).toBeGreaterThan(fbWing.y); // inverted tuck toward center

    // Counter defending sits much deeper than gegenpressing defending
    const defCounter = computeTacticalPlayerOffset({
      slotIndex: 5,
      base: { x: 0.42, y: 0.5 },
      isHome: true,
      hasBall: false,
      tactic: 'counter',
      formation: '4-3-3',
      attackPhase: 1,
      ball: { x: 0.55, y: 0.5 },
      simClock: 4.0,
    });
    const defGegen = computeTacticalPlayerOffset({
      slotIndex: 5,
      base: { x: 0.42, y: 0.5 },
      isHome: true,
      hasBall: false,
      tactic: 'gegenpressing',
      formation: '4-3-3',
      attackPhase: 1,
      ball: { x: 0.55, y: 0.5 },
      simClock: 4.0,
    });
    expect(defGegen.x).toBeGreaterThan(defCounter.x + 0.08);
  });
});

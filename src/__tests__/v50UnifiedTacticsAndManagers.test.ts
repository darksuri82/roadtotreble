import { describe, expect, it } from 'vitest';
import { AI_MANAGERS_BY_CLUB_ID, getClubManager } from '../data/aiManagers';
import { FORMATION_LIST, FORMATIONS } from '../data/formations';
import {
  evaluateSharedClubHeritage,
  VERIFIED_CAREER_CLUBS_BY_NAME,
} from '../data/formerClubs';
import {
  buildHistoricalClubForMatch,
  HISTORICAL_BENCHMARK_TEAMS,
} from '../data/historicalTeams';
import { evaluateManagerPlayerSynergy, MANAGER_TRAITS } from '../data/managerTraits';
import {
  calculateChemistry,
  ELITE_PAIR_MIN_OVR,
  evaluatePairLink,
} from '../engine/chemistryEngine';
import {
  ACTIVE_PLAYERS,
  buildAiClubSquad16,
  LEGEND_PLAYERS,
  LEAGUES,
} from '../engine/dataLoader';
import {
  simulateFirstHalf,
  simulateSecondHalf,
  USER_CLUB_ID,
} from '../engine/matchEngine';
import { evaluatePositionFit } from '../engine/positionEngine';
import { computeTacticalPlayerOffset } from '../engine/tacticalMovement';
import { UCL_EXTERNAL_TEAMS } from '../engine/uclEngine';
import {
  decideAiHalftimeAdjustment,
  evaluateTeamTacticalProfile,
  evaluateUnifiedTacticalMatchup,
} from '../engine/unifiedTacticsEngine';
import type { FormationId } from '../types/game';
import type { Club, Fixture } from '../types/league';
import type { Player } from '../types/player';

function findPlayerByName(name: string): Player {
  const found = [...ACTIVE_PLAYERS, ...LEGEND_PLAYERS].find((p) => p.name === name);
  if (!found) throw new Error(`Player not found: ${name}`);
  return found;
}

describe('v5.0 — 9 Formations, Unified Tactical Engine, 4-Pillar Synergy & AI Managers', () => {
  it('1) supports all 9 formations including 4-4-2 Diamond, 3-3-3-1, and 3-5-2 DM with valid slots, links, alternateSubPositions & 2D movement', () => {
    expect(FORMATION_LIST).toHaveLength(10);
    const newIds: FormationId[] = ['4-4-2-diamond', '3-3-3-1', '3-5-2-dm'];

    for (const id of newIds) {
      const cfg = FORMATIONS[id];
      expect(cfg).toBeDefined();
      expect(cfg.slots).toHaveLength(11);
      expect(cfg.links.length).toBeGreaterThanOrEqual(18);
      for (const [a, b] of cfg.links) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(11);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(11);
      }
      // Verify 2D tactical movement returns finite vectors for every slot
      for (let i = 0; i < 11; i += 1) {
        const vec = computeTacticalPlayerOffset({
          slotIndex: i,
          base: { x: 0.4, y: 0.5 },
          isHome: true,
          hasBall: true,
          tactic: 'gegenpressing',
          formation: id,
          attackPhase: 2,
          ball: { x: 0.65, y: 0.4 },
          simClock: 1.5,
        });
        expect(Number.isFinite(vec.x)).toBe(true);
        expect(Number.isFinite(vec.y)).toBe(true);
      }
    }

    // 3-3-3-1 LWB(LWB) and RAM(CAM) evaluate unified position fit identically on pitch & detail modal
    const slotLwb = FORMATIONS['3-3-3-1'].slots[4];
    const slotRam = FORMATIONS['3-3-3-1'].slots[9];
    const lwbPlayer: Player = {
      ...ACTIVE_PLAYERS[0],
      mainPositions: ['LWB'],
      secondaryPositions: [],
      ovr: 85,
    };
    const rwOnlyPlayer: Player = {
      ...ACTIVE_PLAYERS[0],
      mainPositions: ['RW'],
      secondaryPositions: ['RM'],
      ovr: 88,
    };
    expect(
      evaluatePositionFit(lwbPlayer, slotLwb.subPosition, null).penalty,
    ).toBe(0);
    // Out-of-position RW in 3-3-3-1 RAM (CAM) receives minus penalty (-15) on both pitch and detail card
    const ramFit = evaluatePositionFit(rwOnlyPlayer, slotRam.subPosition, null);
    expect(ramFit.penalty).toBe(-15);
    expect(ramFit.effectiveOvr).toBe(73);
  });

  it('2) strictly validates canonical club names in VERIFIED_CAREER_CLUBS_BY_NAME and triggers real former-club synergies', () => {
    const validClubNames = new Set<string>([
      ...LEAGUES.flatMap((l) => l.clubs.map((c) => c.name)),
      ...UCL_EXTERNAL_TEAMS.map((u) => u.club.name),
    ]);

    for (const [playerName, clubs] of Object.entries(VERIFIED_CAREER_CLUBS_BY_NAME)) {
      for (const c of clubs) {
        expect(
          validClubNames.has(c),
          `Invalid canonical club name "${c}" for ${playerName}`,
        ).toBe(true);
      }
    }

    // Real verified former club pairs
    const haaland = findPlayerByName('엘링 홀란');
    const bellingham = findPlayerByName('주드 벨링엄');
    const kane = findPlayerByName('해리 케인');
    const son = findPlayerByName('손흥민');
    const messi = findPlayerByName('리오넬 메시');
    const yamal = findPlayerByName('라민 야말');
    const mbappe = findPlayerByName('킬리안 음바페');
    const hakimi = findPlayerByName('아슈라프 하키미');

    expect(evaluateSharedClubHeritage(haaland, bellingham)).toEqual({
      type: 'former',
      clubName: '보루시아 도르트문트',
    });
    expect(evaluateSharedClubHeritage(kane, son)).toEqual({
      type: 'former',
      clubName: '토트넘 홋스퍼',
    });
    expect(evaluateSharedClubHeritage(messi, yamal)).toEqual({
      type: 'former',
      clubName: 'FC 바르셀로나',
    });
    const mbappeHakimi = evaluateSharedClubHeritage(mbappe, hakimi);
    expect(mbappeHakimi.type).toBe('former');
    expect(['레알 마드리드', '파리 생제르맹']).toContain(mbappeHakimi.clubName);
  });

  it('3) enforces strict 4-pillar player synergy (no legend wildcard / no tactic-only links) and separates Manager OVR compatibility', () => {
    // Two non-matching players (different clubs, no shared former club, different nations, non-complementary styles, OVR < 88)
    const pA: Player = {
      id: 'test-a',
      name: '테스트A',
      position: 'MF',
      mainPositions: ['CM'],
      secondaryPositions: [],
      ovr: 82,
      nationality: '스페인',
      nationalityCode: 'ES',
      leagueId: 'laliga',
      club: '세비야',
      att: 78,
      mid: 82,
      def: 76,
      stamina: 82,
      playstyles: ['box_to_box'],
      scoutNote: '',
      isLegend: false,
    };
    const pB: Player = {
      id: 'test-b',
      name: '테스트B',
      position: 'MF',
      mainPositions: ['CM'],
      secondaryPositions: [],
      ovr: 83,
      nationality: '독일',
      nationalityCode: 'DE',
      leagueId: 'bundesliga',
      club: 'SC 프라이부르크',
      att: 78,
      mid: 83,
      def: 76,
      stamina: 82,
      playstyles: ['box_to_box'],
      scoutNote: '',
      isLegend: false,
    };

    // Even when both match 'gegenpressing' and 'gegenpress_guru', player-to-player link MUST stay 'none'
    const linkNoMatch = evaluatePairLink(pA, pB, 'gegenpressing', 'gegenpress_guru');
    expect(linkNoMatch.activeLines).toEqual([]);
    expect(linkNoMatch.score).toBe(0);

    // Legend with no shared European club (Pele) should NOT get artificial wildcard with unrelated club player
    const pele = findPlayerByName('펠레');
    const peleLink = evaluatePairLink(pele, pB, 'possession', 'tiki_taka');
    expect(peleLink.hasClubLink).toBe(false);
    expect(peleLink.isLegendWildcard).toBe(false);

    // Elite Pair triggers strictly at OVR >= 88
    const eliteA: Player = { ...pA, ovr: ELITE_PAIR_MIN_OVR };
    const eliteB: Player = { ...pB, ovr: ELITE_PAIR_MIN_OVR };
    const eliteLink = evaluatePairLink(eliteA, eliteB);
    expect(eliteLink.hasEliteLink).toBe(true);
    expect(eliteLink.activeLines).toContain('elite');

    const nonEliteLink = evaluatePairLink({ ...pA, ovr: 85 }, eliteB);
    expect(nonEliteLink.hasEliteLink).toBe(false);

    // Independent Manager Compatibility gives flat +1 to all matching players (decoupled from +3 player link cap)
    const pedri = findPlayerByName('페드리');
    const stdMgr = evaluateManagerPlayerSynergy(pedri, 'tiki_taka', 80);
    const eliteMgr = evaluateManagerPlayerSynergy(pedri, 'tiki_taka', 94);
    expect(stdMgr.isMatch).toBe(true);
    expect(stdMgr.bonus).toBe(1);
    expect(eliteMgr.isMatch).toBe(true);
    expect(eliteMgr.bonus).toBe(1);
  });

  it('4) evaluates Unified 2-Stage Tactical Matchup realistically across formations, tactics, and personnel', () => {
    const epl = LEAGUES.find((l) => l.id === 'epl')!;
    const ars = epl.clubs.find((c) => c.id === 'epl-ars')!;
    const liv = epl.clubs.find((c) => c.id === 'epl-liv')!;
    const arsSquad = buildAiClubSquad16({ club: ars, leagueId: 'epl' }).starters;
    const livSquad = buildAiClubSquad16({ club: liv, leagueId: 'epl' }).starters;

    // 3-3-3-1 Gegenpressing exposes higher line than 3-5-2 DM Counter
    const highPress3331 = evaluateTeamTacticalProfile({
      starters: livSquad,
      formation: '3-3-3-1',
      tactic: 'gegenpressing',
      managerTraitId: 'gegenpress_guru',
      managerOvr: 90,
    });
    const deepBlock352dm = evaluateTeamTacticalProfile({
      starters: arsSquad,
      formation: '3-5-2-dm',
      tactic: 'counter',
      managerTraitId: 'catenaccio',
      managerOvr: 90,
    });
    expect(highPress3331.highLineExposure).toBeGreaterThan(deepBlock352dm.highLineExposure + 25);
    expect(deepBlock352dm.boxCompactness).toBeGreaterThan(highPress3331.boxCompactness + 15);
    expect(highPress3331.pressIntensity).toBeGreaterThan(deepBlock352dm.pressIntensity + 15);

    // Unified matchup returns 5 zones and bounded modifiers
    const clash = evaluateUnifiedTacticalMatchup(
      {
        starters: arsSquad,
        formation: '3-5-2-dm',
        tactic: 'counter',
        managerTraitId: 'catenaccio',
        managerOvr: 90,
      },
      {
        starters: livSquad,
        formation: '3-3-3-1',
        tactic: 'gegenpressing',
        managerTraitId: 'gegenpress_guru',
        managerOvr: 90,
      },
    );
    expect(clash.zones).toHaveLength(5);
    const transZone = clash.zones.find((z) => z.id === 'transition')!;
    expect(transZone.delta).toBeGreaterThan(0); // Counter team exploits 3-3-3-1 high line!
  });

  it('5) equips all 96 Top-5 clubs, 16 UCL clubs & 14 HOF teams with AI managers and runs OVR-differentiated halftime counterplay', () => {
    const allClubs: Club[] = [
      ...LEAGUES.flatMap((l) => l.clubs),
      ...UCL_EXTERNAL_TEAMS.map((u) => u.club),
    ];
    expect(allClubs).toHaveLength(112);

    for (const c of allClubs) {
      expect(AI_MANAGERS_BY_CLUB_ID[c.id], `Missing AI manager for ${c.id}`).toBeDefined();
      const mgr = getClubManager(c);
      expect(mgr.ovr).toBeGreaterThanOrEqual(70);
      expect(mgr.ovr).toBeLessThanOrEqual(99);
      expect(MANAGER_TRAITS[mgr.traitId]).toBeDefined();
    }

    // All 14 HOF teams attach their legendary manager profile
    for (const hof of HISTORICAL_BENCHMARK_TEAMS) {
      const bundle = buildHistoricalClubForMatch(hof);
      expect(bundle.club.manager).toBeDefined();
      expect(bundle.club.manager!.name).toBe(hof.managerName);
      expect(bundle.club.manager!.ovr).toBe(hof.managerRating);
      expect(bundle.club.manager!.ovr).toBeGreaterThanOrEqual(91);
    }

    // Compare halftime adjustment activation rate: Elite OVR 95 manager vs Lower OVR 73 manager when trailing 0-1
    const hofBarca = HISTORICAL_BENCHMARK_TEAMS[0];
    const hofBundle = buildHistoricalClubForMatch(hofBarca);
    const epl = LEAGUES.find((l) => l.id === 'epl')!;
    const arsSquad = buildAiClubSquad16({ club: epl.clubs[1], leagueId: 'epl' });

    let eliteAdjustCount = 0;
    let lowAdjustCount = 0;
    const trials = 40;
    for (let i = 0; i < trials; i += 1) {
      const seedRng = () => ((i * 37 + 13) % 100) / 100;
      const eliteRes = decideAiHalftimeAdjustment({
        aiManager: { name: '명장', ovr: 95, traitId: 'halftime_wizard', preferredFormations: ['4-2-3-1', '3-5-2-dm', '4-3-3'] },
        aiStarters: hofBundle.starters,
        aiBench: hofBundle.bench,
        aiFormation: hofBundle.club.formation,
        aiTactic: hofBundle.club.defaultTactic,
        userStarters: arsSquad.starters,
        userFormation: '4-3-3',
        userTactic: 'possession',
        userManagerTraitId: 'tiki_taka',
        aiGoals: 0,
        userGoals: 1,
        aiXg: 0.4,
        userXg: 1.1,
        aiPossession: 44,
        rng: seedRng,
      });
      if (eliteRes) eliteAdjustCount += 1;

      const lowRes = decideAiHalftimeAdjustment({
        aiManager: { name: '하위 감독', ovr: 73, traitId: 'catenaccio', preferredFormations: ['4-4-2'] },
        aiStarters: hofBundle.starters,
        aiBench: hofBundle.bench,
        aiFormation: hofBundle.club.formation,
        aiTactic: hofBundle.club.defaultTactic,
        userStarters: arsSquad.starters,
        userFormation: '4-3-3',
        userTactic: 'possession',
        userManagerTraitId: 'tiki_taka',
        aiGoals: 0,
        userGoals: 1,
        aiXg: 0.4,
        userXg: 1.1,
        aiPossession: 44,
        rng: seedRng,
      });
      if (lowRes) lowAdjustCount += 1;
    }

    expect(eliteAdjustCount).toBeGreaterThan(lowAdjustCount);

    // End-to-end simulateFirstHalf -> simulateSecondHalf propagates aiHalftimeAdjustment
    const userClub: Club = {
      ...epl.clubs[1],
      id: USER_CLUB_ID,
      isUser: true,
    };
    const chem = calculateChemistry('4-3-3', arsSquad.starters, 'possession', 'tiki_taka', 86);
    const fixture: Fixture = {
      id: 'fx-v5-ht',
      round: 1,
      homeTeamId: USER_CLUB_ID,
      awayTeamId: hofBundle.club.id,
      played: false,
    };
    const ht = simulateFirstHalf({
      fixture,
      homeClub: userClub,
      awayClub: hofBundle.club,
      homeRoster: arsSquad.starters,
      awayRoster: hofBundle.fullRoster,
      userContext: {
        userClubId: USER_CLUB_ID,
        starters: arsSquad.starters,
        bench: arsSquad.bench,
        formation: '4-3-3',
        tactic: 'possession',
        chemistry: chem.total,
        ratings: {
          att: 86,
          mid: 86,
          def: 86,
          ovr: 86,
          rawOvr: 85,
          chemistryBonus: 1.2,
          effectiveAtt: 87,
          effectiveMid: 87,
          effectiveDef: 87,
        },
        slotSynergies: chem.slotSynergies,
        managerTraitId: 'tiki_taka',
      },
      rng: () => 0.15,
    });
    const full = simulateSecondHalf({
      halftime: { ...ht, homeGoals: 2, awayGoals: 0 },
      homeClub: userClub,
      awayClub: hofBundle.club,
      homeRoster: arsSquad.starters,
      awayRoster: hofBundle.fullRoster,
      userContext: {
        userClubId: USER_CLUB_ID,
        starters: arsSquad.starters,
        bench: arsSquad.bench,
        formation: '4-3-3',
        tactic: 'possession',
        chemistry: chem.total,
        ratings: {
          att: 86,
          mid: 86,
          def: 86,
          ovr: 86,
          rawOvr: 85,
          chemistryBonus: 1.2,
          effectiveAtt: 87,
          effectiveMid: 87,
          effectiveDef: 87,
        },
        slotSynergies: chem.slotSynergies,
        managerTraitId: 'tiki_taka',
        firstHalfStarters: arsSquad.starters,
      },
      rng: () => 0.1,
    });
    expect(full.aiHalftimeAdjustment).toBeDefined();
    expect(full.aiHalftimeAdjustment!.headline).toContain('⚡');
    expect(full.aiHalftimeAdjustment!.headline).toContain(hofBarca.managerName);
  });
});

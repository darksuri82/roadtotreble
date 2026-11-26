import { describe, expect, it } from 'vitest';
import appSrc from '../App.tsx?raw';
import teamArchiveSrc from '../components/common/TeamSeasonArchiveTab.tsx?raw';
import draftScreenSrc from '../components/draft/DraftScreen.tsx?raw';
import rouletteReelsSrc from '../components/draft/RouletteReelsView.tsx?raw';
import tutorialSrc from '../components/guide/SoloVisualTutorialModal.tsx?raw';
import systemGuideSrc from '../components/guide/SystemGuideModal.tsx?raw';
import formationSelectSrc from '../components/setup/FormationSelect.tsx?raw';
import gameContextSrc from '../store/GameContext.tsx?raw';
import { FORMATION_LIST, FORMATIONS } from '../data/formations';
import { evaluateDraftAwakeningPotential } from '../engine/awakeningEngine';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
import { createPitchSimState, stepPitchSim } from '../engine/pitchSimEngine';
import {
  ADAPTATION_MAX_ATT_PENALTY,
  ADAPTATION_MAX_MID_PENALTY,
  ADAPTATION_STREAK_HISTORY_LIMIT,
  createInitialTacticalAdaptationState,
  evaluateAiPreMatchCounter,
  evaluateTacticalExposure,
  recordMatchTacticalAdaptation,
} from '../engine/tacticalAdaptationEngine';
import {
  evaluateFormationMatchup,
  getBestCounterFormation,
} from '../engine/tacticEngine';
import {
  evaluateUnifiedTacticalMatchup,
  FORMATION_PROFILES,
} from '../engine/unifiedTacticsEngine';
import type { FormationId } from '../types/game';
import type { Player } from '../types/player';

describe('v9.4 Rebalance, 3-2-4-1 Formation, Preview-Only Awakening & Immediate Popup', () => {
  it('1) evaluates draft awakening potential strictly for previewed starter slots (never pre-revealed on unselected cards or bench slots)', () => {
    const rawGem = ACTIVE_PLAYERS.find(
      (p) => !p.isLegend && p.ovr <= 81 && p.mainPositions.includes('CM'),
    );
    expect(rawGem).toBeDefined();

    const starterHint = evaluateDraftAwakeningPotential(rawGem!, {
      managerTraitId: 'midfield_maestro',
      targetSubPosition: 'CM',
      expectedLinkCount: 3,
      isBenchSlot: false,
    });
    expect(starterHint).not.toBeNull();

    const benchHint = evaluateDraftAwakeningPotential(rawGem!, {
      managerTraitId: 'midfield_maestro',
      targetSubPosition: 'CM',
      expectedLinkCount: 3,
      isBenchSlot: true,
    });
    expect(benchHint).toBeNull();

    // Unselected cards in RouletteReelsView must NEVER pass pre-computed awakeningHintsByPlayerId
    expect(rouletteReelsSrc).not.toContain('awakeningHintsByPlayerId');
    expect(rouletteReelsSrc).toContain(
      'awakeningHint={isPreviewing ? selectedAwakeningHint : null}',
    );
    expect(draftScreenSrc).toContain('previewTargetSubPosition={previewTargetSubPosition}');
    expect(draftScreenSrc).toContain('previewSlotArea={previewSlotArea}');
    expect(draftScreenSrc).toContain('포텐 각성 원리');
  });

  it('2) registers 3-2-4-1 (W-M Box Midfield) as the 10th formation across formations, tactics, unified engine, 2D pitch, and UI', () => {
    expect(FORMATION_LIST).toHaveLength(10);
    const f3241 = FORMATIONS['3-2-4-1'];
    expect(f3241).toBeDefined();
    expect(f3241.slots).toHaveLength(11);
    expect(f3241.slots.map((s) => s.subPosition)).toEqual([
      'GK',
      'CB',
      'CB',
      'CB',
      'CDM',
      'CDM',
      'LW',
      'CAM',
      'CAM',
      'RW',
      'ST',
    ]);
    expect(f3241.links.length).toBeGreaterThanOrEqual(19);
    for (const [a, b] of f3241.links) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(11);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(11);
      expect(a).not.toBe(b);
    }

    // Symmetric formation matchup matrix & counter recommendation
    const allIds = FORMATION_LIST.map((f) => f.id) as FormationId[];
    for (const opp of allIds) {
      const aVsB = evaluateFormationMatchup('3-2-4-1', opp).delta;
      const bVsA = evaluateFormationMatchup(opp, '3-2-4-1').delta;
      expect(aVsB + bVsA).toBeCloseTo(0, 5);
    }
    expect(getBestCounterFormation('3-2-4-1')).toBe('4-4-2');

    // Unified profile & 5-zone evaluation
    expect(FORMATION_PROFILES['3-2-4-1'].midfieldDensity).toBeGreaterThanOrEqual(94);
    const sampleXi: Player[] = [
      ACTIVE_PLAYERS.find((p) => p.position === 'GK')!,
      ...ACTIVE_PLAYERS.filter((p) => p.mainPositions.includes('CB')).slice(0, 3),
      ...ACTIVE_PLAYERS.filter((p) => p.mainPositions.includes('CDM')).slice(0, 2),
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('LW'))!,
      ...ACTIVE_PLAYERS.filter((p) => p.mainPositions.includes('CAM')).slice(0, 2),
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('RW'))!,
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('ST'))!,
    ];
    const chem = calculateChemistry('3-2-4-1', sampleXi, 'possession', 'tiki_taka');
    const ratings = calculateTeamRatings(
      '3-2-4-1',
      sampleXi,
      chem.total,
      'tiki_taka',
      chem.slotSynergies,
      'possession',
    );
    expect(ratings.effectiveMid).toBeGreaterThan(70);

    const unified = evaluateUnifiedTacticalMatchup(
      {
        starters: sampleXi,
        formation: '3-2-4-1',
        tactic: 'possession',
        managerTraitId: 'tiki_taka',
      },
      {
        starters: sampleXi,
        formation: '4-3-3',
        tactic: 'wingplay',
        managerTraitId: 'wing_bomber',
      },
    );
    expect(Number.isFinite(unified.netOvrEquivalent)).toBe(true);

    // 2D pitch simulation executes cleanly with 3-2-4-1 without NaN coordinates
    const sim = createPitchSimState({
      seed: 'v94-3241-test',
      homeTeamId: 'user-club',
      awayTeamId: 'epl-ars',
      home: {
        formation: '3-2-4-1',
        tactic: 'possession',
        starters: sampleXi,
        managerTraitId: 'tiki_taka',
        managerOvr: 88,
      },
      away: {
        formation: '4-3-3',
        tactic: 'counter',
        starters: sampleXi,
        managerTraitId: 'catenaccio',
        managerOvr: 86,
      },
      startMinute: 0,
      endMinute: 45,
      half: 1,
      targetHomePossession: 56,
      homeShotsTarget: 7,
      awayShotsTarget: 5,
      homeXgTarget: 1.0,
      awayXgTarget: 0.7,
      homeGoalsSoFar: 0,
      awayGoalsSoFar: 0,
      events: [],
    });
    for (let i = 0; i < 60; i += 1) {
      stepPitchSim(sim, 0.05);
    }
    for (const pl of [...sim.homeAgents, ...sim.awayAgents]) {
      expect(Number.isFinite(pl.x)).toBe(true);
      expect(Number.isFinite(pl.y)).toBe(true);
    }

    expect(formationSelectSrc).toContain('10종 포메이션 선택');
    expect(systemGuideSrc).toContain('10종 포메이션');
  });

  it('3) fires AwakeningCelebrationModal immediately after the awakening match (highest post-match priority, guarded auto-stream & transfer skip)', () => {
    // App.tsx promotes awakening ahead of transfer, staff coach, and injury modals, and allows season_end
    expect(appSrc).toContain("state.phase === 'season_end'");
    expect(appSrc).toContain('!pendingAwakeningAlert');
    const awakeningDefIdx = appSrc.indexOf('const pendingAwakeningAlert =');
    const staffCoachDefIdx = appSrc.indexOf('const hasPendingStaffCoach =');
    const injuryDefIdx = appSrc.indexOf('const pendingInjuryAlerts =');
    expect(awakeningDefIdx).toBeGreaterThan(0);
    expect(awakeningDefIdx).toBeLessThan(staffCoachDefIdx);
    expect(awakeningDefIdx).toBeLessThan(injuryDefIdx);

    // START_SOLO_STREAM_MATCH guards against pending awakening/coach/adaptation
    const streamCaseIdx = gameContextSrc.indexOf("case 'START_SOLO_STREAM_MATCH':");
    const streamBlock = gameContextSrc.slice(streamCaseIdx, streamCaseIdx + 650);
    expect(streamBlock).toContain('pendingAwakeningAlerts');
    expect(streamBlock).toContain('staffCoach?.pendingSelection');
    expect(streamBlock).toContain('tacticalAdaptation?.pendingAlert');

    // SIMULATE_TO_NEXT_TRANSFER breaks immediately on pendingAwakeningAlerts
    const skipTransferIdx = gameContextSrc.indexOf("case 'SIMULATE_TO_NEXT_TRANSFER':");
    const skipTransferBlock = gameContextSrc.slice(skipTransferIdx, skipTransferIdx + 3600);
    expect(skipTransferBlock).toContain('(currentSeason.pendingAwakeningAlerts?.length ?? 0) > 0');
  });

  it('4) displays Base Total OVR and Effective OVR (with delta) in TeamSeasonArchiveTab', () => {
    expect(teamArchiveSrc).toContain('총 OVR');
    expect(teamArchiveSrc).toContain('실효');
    expect(teamArchiveSrc).toContain('starterBaseAvg');
    expect(teamArchiveSrc).toContain('effectiveTotalOvr');
  });

  it('5) strengthens tactical adaptation penalties and escalates persistent 10+/14+ match rigidity', () => {
    expect(ADAPTATION_STREAK_HISTORY_LIMIT).toBeGreaterThanOrEqual(14);
    expect(ADAPTATION_MAX_ATT_PENALTY).toBeGreaterThanOrEqual(3.0);
    expect(ADAPTATION_MAX_MID_PENALTY).toBeGreaterThanOrEqual(3.2);

    let adapt = createInitialTacticalAdaptationState();
    for (let r = 1; r <= 8; r += 1) {
      adapt = recordMatchTacticalAdaptation({
        prev: adapt,
        formation: '4-3-3',
        tactic: 'possession',
        round: r,
        competition: 'league',
      });
    }
    const exp8 = evaluateTacticalExposure({
      history: adapt.history,
      formation: '4-3-3',
      tactic: 'possession',
    });
    const counter8 = evaluateAiPreMatchCounter({
      exposure: exp8,
      userTactic: 'possession',
      aiDefaultTactic: 'balanced',
      aiManager: { ovr: 86, traitId: 'gegenpress_guru' },
      rng: () => 0.1,
    });

    for (let r = 9; r <= 14; r += 1) {
      adapt = recordMatchTacticalAdaptation({
        prev: adapt,
        formation: '4-3-3',
        tactic: 'possession',
        round: r,
        competition: 'league',
      });
    }
    const exp14 = evaluateTacticalExposure({
      history: adapt.history,
      formation: '4-3-3',
      tactic: 'possession',
    });
    expect(exp14.consecutiveExactStreak).toBe(14);

    const counter14 = evaluateAiPreMatchCounter({
      exposure: exp14,
      userTactic: 'possession',
      aiDefaultTactic: 'balanced',
      aiManager: { ovr: 86, traitId: 'gegenpress_guru' },
      rng: () => 0.1,
    });
    expect(Math.abs(counter14.userMidPenalty)).toBeGreaterThan(
      Math.abs(counter8.userMidPenalty),
    );
    expect(counter14.aiXgBonus).toBeGreaterThan(counter8.aiXgBonus);

    // Mid-table AI manager (OVR 78) also applies meaningful tactical resistance (>= 0.30 scale)
    const midCounter = evaluateAiPreMatchCounter({
      exposure: exp14,
      userTactic: 'possession',
      aiDefaultTactic: 'balanced',
      aiManager: { ovr: 78, traitId: 'balanced' as never },
      rng: () => 0.1,
    });
    expect(midCounter.aiIntelScale).toBeGreaterThanOrEqual(0.45);
    expect(Math.abs(midCounter.userMidPenalty)).toBeGreaterThanOrEqual(1.8);
  });

  it('6) reflects verified 2026-27 FotMob & real-evaluation OVR adjustments across all 5 leagues', () => {
    const byId = new Map(ACTIVE_PLAYERS.map((p) => [p.id, p]));

    // User-highlighted EPL midfield hierarchy: Elliot Anderson (87) > Szoboszlai (86) > Gravenberch (84) & Zubimendi (84)
    expect(byId.get('act-110')?.ovr).toBe(87); // Elliot Anderson
    expect(byId.get('act-0013')?.ovr).toBe(86); // Dominik Szoboszlai
    expect(byId.get('act-0014')?.ovr).toBe(84); // Ryan Gravenberch
    expect(byId.get('act-055')?.ovr).toBe(84); // Martin Zubimendi
    expect(byId.get('act-110')!.ovr).toBeGreaterThan(byId.get('act-0013')!.ovr);
    expect(byId.get('act-0013')!.ovr).toBeGreaterThan(byId.get('act-0014')!.ovr);
    expect(byId.get('act-0013')!.ovr).toBeGreaterThan(byId.get('act-055')!.ovr);

    // Key 26-27 upgrades & trims across all 5 leagues
    expect(byId.get('act-011')?.ovr).toBe(90); // Declan Rice
    expect(byId.get('act-128')?.ovr).toBe(86); // Joao Pedro
    expect(byId.get('act-345')?.ovr).toBe(84); // Evanilson
    expect(byId.get('act-257')?.ovr).toBe(86); // Bart Verbruggen
    expect(byId.get('act-028')?.ovr).toBe(89); // Raphinha
    expect(byId.get('act-154')?.ovr).toBe(86); // Arda Guler
    expect(byId.get('act-0271')?.ovr).toBe(82); // Yan Diomande
    expect(byId.get('act-017')?.ovr).toBe(91); // Michael Olise
    expect(byId.get('act-109')?.ovr).toBe(87); // Aleksandar Pavlovic
    expect(byId.get('act-180')?.ovr).toBe(83); // Patrik Schick
    expect(byId.get('act-251')?.ovr).toBe(86); // Donyell Malen
    expect(byId.get('act-658')?.ovr).toBe(83); // Christos Mandas
    expect(byId.get('act-133')?.ovr).toBe(84); // Guglielmo Vicario
    expect(byId.get('act-227')?.ovr).toBe(83); // Giorgio Scalvini
    expect(byId.get('act-635')?.ovr).toBe(83); // Florian Thauvin
    expect(byId.get('act-845')?.ovr).toBe(80); // Cristian Casseres

    // Guidebook & tutorial stay synchronized with v9.4 changes
    expect(systemGuideSrc).toContain('드래프트 프리뷰 표기 기준');
    expect(systemGuideSrc).toContain('장기 고정 가중');
    expect(tutorialSrc).toContain('3-2-4-1');
    expect(tutorialSrc).toContain('포텐 각성 원리');
  });

  it('7) runs 50-Season EPL Balance Simulation comparing Fixed-Tactic Auto vs Active Rotation vs Full-Buffs (Coach + Awakening)', async () => {
    const { buildAiClubRoster, getLeagueById } = await import('../engine/dataLoader');
    const { simulateMatch, USER_CLUB_ID } = await import('../engine/matchEngine');
    const { generateDoubleRoundRobin } = await import('../engine/scheduleEngine');
    const { createInitialStandings } = await import('../engine/standingsEngine');

    const createSeededRng = (seed: number) => {
      let s = seed >>> 0;
      return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 4294967296;
      };
    };

    const epl = getLeagueById('epl')!;
    const formation: FormationId = '4-3-3';
    const slotSubs = FORMATIONS[formation].slots.map((s) => s.subPosition);
    const used = new Set<string>();
    const baseStarters: Player[] = slotSubs.map((sub) => {
      const pick =
        ACTIVE_PLAYERS.find(
          (p) => !used.has(p.id) && p.ovr >= 84 && p.ovr <= 86 && p.mainPositions.includes(sub),
        ) ??
        ACTIVE_PLAYERS.find(
          (p) => !used.has(p.id) && p.ovr >= 83 && p.ovr <= 87 && p.mainPositions.includes(sub),
        )!;
      used.add(pick.id);
      return pick;
    });
    const benchPositions = ['GK', 'DF', 'DF', 'MF', 'FW'] as const;
    const bench: Player[] = benchPositions.map((pos) => {
      const pick = ACTIVE_PLAYERS.find(
        (p) => !used.has(p.id) && p.ovr >= 78 && p.ovr <= 80 && p.position === pos,
      )!;
      used.add(pick.id);
      return pick;
    });

    // Awakened version (+4 OVR on 2 starters, mimicking mid-season awakening + staff coach)
    const fullBuffStarters = baseStarters.map((p, idx) =>
      idx === 6 || idx === 9
        ? { ...p, ovr: Math.min(91, p.ovr + 4), att: p.att + 4, mid: p.mid + 4, def: p.def + 3 }
        : p,
    );

    const aiClubs = epl.clubs.slice(0, 19);
    const aiRosterById = new Map<string, Player[]>();
    for (const c of aiClubs) {
      aiRosterById.set(c.id, buildAiClubRoster(c, 'epl'));
    }

    const scenarios = [
      {
        label: '1. 고정 전술 풀오토 (85.5 OVR · 무변주 38R)',
        starters: baseStarters,
        fixedTactic: true,
        staffCoachId: null as 'line_attack' | null,
      },
      {
        label: '2. 정상 전술 로테이션 (85.5 OVR · 변주 운용)',
        starters: baseStarters,
        fixedTactic: false,
        staffCoachId: null as 'line_attack' | null,
      },
      {
        label: '3. 로테이션 + 수석코치 + 각성 2인 (86.2 OVR)',
        starters: fullBuffStarters,
        fixedTactic: false,
        staffCoachId: 'line_attack' as const,
      },
    ];

    const SEASONS = 50;
    const results: {
      label: string;
      avgPts: number;
      avgRank: number;
      titleRate: number;
      top4Rate: number;
      avgAiFirstPts: number;
    }[] = [];

    const rotationTactics = ['possession', 'gegenpressing', 'wingplay', 'balanced'] as const;
    const rotationFormations: FormationId[] = ['4-3-3', '3-2-4-1', '4-2-3-1', '3-4-2-1'];

    for (let scIdx = 0; scIdx < scenarios.length; scIdx += 1) {
      const sc = scenarios[scIdx];
      let ptsSum = 0;
      let rankSum = 0;
      let titles = 0;
      let top4 = 0;
      let aiFirstPtsSum = 0;

      const baseChem = calculateChemistry(formation, sc.starters, 'possession', 'tiki_taka', undefined, {
        staffCoachId: sc.staffCoachId,
      });
      const baseRatings = calculateTeamRatings(
        formation,
        sc.starters,
        baseChem.total,
        'tiki_taka',
        baseChem.slotSynergies,
        'possession',
        sc.staffCoachId,
      );

      const userClub = {
        id: USER_CLUB_ID,
        name: sc.label,
        shortName: `S${scIdx + 1}`,
        primaryColor: '#10b981',
        secondaryColor: '#ffffff',
        pattern: 'solid' as const,
        att: baseRatings.att,
        mid: baseRatings.mid,
        def: baseRatings.def,
        formation,
        defaultTactic: 'possession' as const,
        topScorers: [sc.starters[8].name, sc.starters[9].name, sc.starters[10].name] as [
          string,
          string,
          string,
        ],
      };

      const leagueClubs = [userClub, ...aiClubs];
      const clubById = new Map(leagueClubs.map((c) => [c.id, c]));

      for (let s = 0; s < SEASONS; s += 1) {
        const rng = createSeededRng(94000 + scIdx * 10000 + s * 97);
        const fixtures = generateDoubleRoundRobin(leagueClubs, rng);
        const standingsMap = new Map(
          createInitialStandings(leagueClubs).map((row) => [row.teamId, { ...row }]),
        );
        let adapt = createInitialTacticalAdaptationState();
        let userMatchCount = 0;

        for (const fix of fixtures) {
          const h = clubById.get(fix.homeTeamId)!;
          const a = clubById.get(fix.awayTeamId)!;
          const hRoster = h.id === USER_CLUB_ID ? sc.starters : aiRosterById.get(h.id)!;
          const aRoster = a.id === USER_CLUB_ID ? sc.starters : aiRosterById.get(a.id)!;
          const isUserMatch = h.id === USER_CLUB_ID || a.id === USER_CLUB_ID;

          let activeForm: FormationId = formation;
          let activeTac: (typeof rotationTactics)[number] = 'possession';
          if (isUserMatch && !sc.fixedTactic) {
            const block = Math.floor(userMatchCount / 4);
            activeTac = rotationTactics[block % rotationTactics.length];
            activeForm = rotationFormations[block % rotationFormations.length];
          }

          const res = simulateMatch(
            fix,
            h,
            a,
            hRoster,
            aRoster,
            isUserMatch
              ? {
                  userClubId: USER_CLUB_ID,
                  formation: activeForm,
                  tactic: activeTac,
                  chemistry: baseChem.total,
                  ratings: baseRatings,
                  managerTraitId: 'tiki_taka',
                  staffCoachId: sc.staffCoachId,
                  starters: sc.starters,
                  bench,
                  tacticalHistory: adapt.history,
                }
              : undefined,
            rng,
          );

          if (isUserMatch) {
            userMatchCount += 1;
            adapt = recordMatchTacticalAdaptation({
              prev: adapt,
              formation: activeForm,
              tactic: activeTac,
              round: userMatchCount,
              competition: 'league',
              staffCoachId: sc.staffCoachId,
            });
          }

          const hRow = standingsMap.get(h.id)!;
          const aRow = standingsMap.get(a.id)!;
          hRow.played += 1;
          aRow.played += 1;
          hRow.goalsFor += res.homeGoals;
          hRow.goalsAgainst += res.awayGoals;
          aRow.goalsFor += res.awayGoals;
          aRow.goalsAgainst += res.homeGoals;
          hRow.goalDifference = hRow.goalsFor - hRow.goalsAgainst;
          aRow.goalDifference = aRow.goalsFor - aRow.goalsAgainst;
          if (res.homeGoals > res.awayGoals) {
            hRow.won += 1;
            hRow.points += 3;
            aRow.lost += 1;
          } else if (res.homeGoals < res.awayGoals) {
            aRow.won += 1;
            aRow.points += 3;
            hRow.lost += 1;
          } else {
            hRow.drawn += 1;
            aRow.drawn += 1;
            hRow.points += 1;
            aRow.points += 1;
          }
        }

        const sorted = [...standingsMap.values()].sort(
          (x, y) =>
            y.points - x.points ||
            y.goalDifference - x.goalDifference ||
            y.goalsFor - x.goalsFor,
        );
        const uIdx = sorted.findIndex((r) => r.teamId === USER_CLUB_ID);
        const aiTop = sorted.find((r) => r.teamId !== USER_CLUB_ID)!;
        const uRow = sorted[uIdx];
        ptsSum += uRow.points;
        rankSum += uIdx + 1;
        if (uIdx === 0) titles += 1;
        if (uIdx < 4) top4 += 1;
        aiFirstPtsSum += aiTop.points;
      }

      results.push({
        label: sc.label,
        avgPts: Math.round((ptsSum / SEASONS) * 10) / 10,
        avgRank: Math.round((rankSum / SEASONS) * 100) / 100,
        titleRate: Math.round((titles / SEASONS) * 100),
        top4Rate: Math.round((top4 / SEASONS) * 100),
        avgAiFirstPts: Math.round((aiFirstPtsSum / SEASONS) * 10) / 10,
      });
    }

    console.log('\n[v9.4 50-Season EPL Balance & Tactical Adaptation Sim]');
    for (const r of results) {
      console.log(
        `${r.label} | 평균승점=${r.avgPts} | 평균순위=${r.avgRank}위 | 우승=${r.titleRate}% | TOP4=${r.top4Rate}% | AI 1위=${r.avgAiFirstPts}점`,
      );
    }

    // 1) Fixed-tactic auto-stream is decisively punished vs active tactical rotation
    expect(results[1].avgPts - results[0].avgPts).toBeGreaterThanOrEqual(8);
    expect(results[0].avgRank).toBeGreaterThan(results[1].avgRank);
    // 2) Fixed-tactic 85.5 OVR auto-stream cannot comfortably breeze into Top 3
    expect(results[0].avgRank).toBeGreaterThanOrEqual(3.8);
    // 3) Full-buffs (rotation + coach + awakening) competes tightly for title without trivial 80%+ runaway
    expect(results[2].avgPts).toBeGreaterThan(results[1].avgPts);
    expect(results[2].titleRate).toBeGreaterThanOrEqual(10);
    expect(results[2].titleRate).toBeLessThanOrEqual(75);
  }, 60000);
});

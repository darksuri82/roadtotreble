import { describe, expect, it } from 'vitest';
import { VERIFIED_CAREER_CLUBS_BY_NAME } from '../data/formerClubs';
import { FORMATIONS } from '../data/formations';
import {
  buildHistoricalClubForMatch,
  ERA_BEST_XI_DREAM_TEAMS,
  getHistoricalTeamById,
} from '../data/historicalTeams';
import {
  computePositionWeightedAttributeOvr,
  getPlayerAttributes,
} from '../engine/attributeEngine';
import {
  AWAKENING_FOURTH_PLUS_MULT,
  AWAKENING_OVR_HARD_CAP,
  AWAKENING_SECOND_COUNT_MULT,
  AWAKENING_SUPERSTAR_OVR_THRESHOLD,
  AWAKENING_THIRD_COUNT_MULT,
  evaluateDraftAwakeningPotential,
  evaluatePostMatchAwakening,
  evaluateSquadAwakeningReadiness,
} from '../engine/awakeningEngine';
import {
  computePlayerDraftCostM,
  DRAFT_BUDGET_CAP_M,
  evaluateSquadBudget,
  LEGEND_FLAT_DRAFT_COST_M,
} from '../engine/budgetEngine';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import {
  ACTIVE_PLAYERS,
  ALL_PLAYERS,
  buildAiClubRoster,
  getLeagueById,
  LEGEND_PLAYERS,
  PLAYER_BY_ID_MAP,
} from '../engine/dataLoader';
import {
  DEFAULT_ROULETTE_LEGEND_RATE,
  spinClubRoulette,
} from '../engine/draftEngine';
import {
  computeSeasonScore,
  reconstructHallOfFameSquad,
} from '../engine/legacyEngine';
import { simulateMatch, USER_CLUB_ID } from '../engine/matchEngine';
import { evaluatePositionFit } from '../engine/positionEngine';
import { generateDoubleRoundRobin } from '../engine/scheduleEngine';
import {
  accumulateCompetitionPlayerStats,
  createInitialStandings,
  sortStandings,
} from '../engine/standingsEngine';
import {
  buildGlobalClubForMatch,
  buildGlobalSubmissionPayload,
  filterAndRankV9GlobalRows,
  type RawGlobalRankingRow,
} from '../services/globalRankingService';
import type { PlayerConditionMap } from '../types/condition';
import {
  DEFAULT_MANAGER_AVATAR,
  type FormationId,
  type PlayerSlotSynergy,
} from '../types/game';
import type { Club, PlayerSeasonStats } from '../types/league';
import {
  buildHallOfFameMember,
  type HallOfFameEntry,
} from '../types/legacy';
import {
  CLASSIC_ERA_ORDER,
  formatPlayerRecordName,
  getCardTier,
  getClassicEra,
  type ClassicEra,
  type Player,
} from '../types/player';

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('v9.3 Era Classics, Active OVR Rebalance & 50-Season Simulation Verification', () => {
  it('1) verifies 101 Era Classics (60s~10s), strict 95+ rarity (7 max 96), position balance, attrs, formerClubs & unified €130M cost', () => {
    expect(LEGEND_PLAYERS.length).toBe(101);
    expect(LEGEND_FLAT_DRAFT_COST_M).toBe(130);

    const eraCounts: Record<ClassicEra, number> = {
      '60s': 0,
      '70s': 0,
      '80s': 0,
      '90s': 0,
      '00s': 0,
      '10s': 0,
    };
    const posCounts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    const ninetyFivePlus: Player[] = [];

    for (const p of LEGEND_PLAYERS) {
      expect(p.isLegend).toBe(true);
      expect(p.classicEra).toBeDefined();
      expect(CLASSIC_ERA_ORDER).toContain(p.classicEra);
      expect(p.classicSeasonTag).toBeTruthy();
      expect(p.ovr).toBeGreaterThanOrEqual(88);
      expect(p.ovr).toBeLessThanOrEqual(96);
      expect(computePlayerDraftCostM(p)).toBe(130);
      expect(getCardTier(p)).toBe('legend');
      expect(PLAYER_BY_ID_MAP.get(p.id)?.id).toBe(p.id);

      const attrs = getPlayerAttributes(p);
      const weighted = computePositionWeightedAttributeOvr(p, attrs);
      expect(
        Math.abs(weighted - p.ovr),
        `${p.name} weighted=${weighted} vs ovr=${p.ovr}`,
      ).toBeLessThanOrEqual(2);

      // Every classic has verified formerClubs entry
      expect(
        VERIFIED_CAREER_CLUBS_BY_NAME[p.name],
        `Missing formerClubs for classic ${p.name}`,
      ).toBeDefined();

      const era = getClassicEra(p);
      expect(era).not.toBeNull();
      eraCounts[era!] += 1;
      posCounts[p.position] += 1;
      if (p.ovr >= 95) ninetyFivePlus.push(p);
    }

    // 60s famous icons (Pelé, Yashin, Garrincha) included; 90s/00s/10s richer
    expect(eraCounts['60s']).toBe(3);
    expect(eraCounts['70s']).toBeGreaterThanOrEqual(5);
    expect(eraCounts['80s']).toBeGreaterThanOrEqual(10);
    expect(eraCounts['90s']).toBeGreaterThanOrEqual(20);
    expect(eraCounts['00s']).toBeGreaterThanOrEqual(24);
    expect(eraCounts['10s']).toBeGreaterThanOrEqual(30);

    // Position balance across GK/DF/MF/FW
    expect(posCounts.GK).toBeGreaterThanOrEqual(10);
    expect(posCounts.DF).toBeGreaterThanOrEqual(28);
    expect(posCounts.MF).toBeGreaterThanOrEqual(26);
    expect(posCounts.FW).toBeGreaterThanOrEqual(30);

    // Strictly 7 classics at OVR >= 95, max 96
    expect(ninetyFivePlus.length).toBe(7);
    const topNames = new Set(ninetyFivePlus.map((p) => p.name));
    for (const expected of [
      '리오넬 메시',
      '크리스티아누 호날두',
      '펠레',
      '디에고 마라도나',
      '요한 크루이프',
      '프란츠 베켄바워',
      '호나우두 (R9)',
    ]) {
      expect(topNames.has(expected)).toBe(true);
    }

    console.log(
      `[v9.3 Era Classics Pool] total=${LEGEND_PLAYERS.length} | eras=${JSON.stringify(eraCounts)} | pos=${JSON.stringify(posCounts)} | 95+=${ninetyFivePlus.length}`,
    );
  });

  it('2) verifies Active OVR compression (max 92), mid-table boosts, form trims, no artificial non-big-club cap, zero inversion & distinct attrs', () => {
    const byName = new Map(ACTIVE_PLAYERS.map((p) => [p.name, p]));
    const maxActiveOvr = Math.max(...ACTIVE_PLAYERS.map((p) => p.ovr));
    expect(maxActiveOvr).toBe(92);

    // Top superstars compressed to 90..92
    expect(byName.get('킬리안 음바페')?.ovr).toBe(92);
    expect(byName.get('라민 야말')?.ovr).toBe(92);
    expect(byName.get('해리 케인')?.ovr).toBe(91);
    expect(byName.get('엘링 홀란')?.ovr).toBe(91);
    expect(byName.get('로드리')?.ovr).toBe(91);

    // Underperforming big-club form trims
    expect(byName.get('빅토르 요케레스')?.ovr).toBeLessThanOrEqual(85);
    expect(byName.get('필 포든')?.ovr).toBeLessThanOrEqual(86);
    expect(byName.get('엔소 페르난데스')?.ovr).toBeLessThanOrEqual(86);
    expect(byName.get('마르틴 외데고르')?.ovr).toBeLessThanOrEqual(87);

    // Non-big-club real-world elites NOT capped at 85
    expect(byName.get('니코 슐로터베크')?.ovr).toBeGreaterThanOrEqual(87);
    expect(byName.get('니코 윌리엄스')?.ovr).toBeGreaterThanOrEqual(86);
    expect(byName.get('그레고어 코벨')?.ovr).toBeGreaterThanOrEqual(86);
    expect(byName.get('우나이 시몬')?.ovr).toBeGreaterThanOrEqual(86);

    // 9 user-named mid-table stars boosted realistically
    const gross = byName.get('파스칼 그로스')!;
    const mgw = byName.get('모건 깁스화이트')!;
    const brobbey = byName.get('브라이언 브로베이')!;
    const malen = byName.get('도니얼 말런')!;
    const tzolakis = byName.get('콘스탄티노스 초라키스')!;
    const damsgaard = byName.get('미켈 담스고르')!;
    const dcl = byName.get('도미니크 칼벨트 레윈')!;
    const douvikas = byName.get('아나스타시오스 두비카스')!;
    const deroon = byName.get('마르턴 더 론')!;

    expect(gross.ovr).toBe(85);
    expect(mgw.ovr).toBe(85);
    expect(brobbey.ovr).toBe(84);
    expect(malen.ovr).toBe(84);
    expect(tzolakis.ovr).toBe(83);
    expect(damsgaard.ovr).toBe(83);
    expect(dcl.ovr).toBe(82);
    expect(douvikas.ovr).toBe(82);
    expect(deroon.ovr).toBe(81);

    // Zero unrealistic rank inversions vs elite big-club peers
    expect(gross.ovr).toBeLessThan(byName.get('데클런 라이스')!.ovr);
    expect(gross.ovr).toBeLessThan(byName.get('모이세스 카이세도')!.ovr);
    expect(mgw.ovr).toBeLessThan(byName.get('콜 팔머')!.ovr);
    expect(mgw.ovr).toBeLessThan(byName.get('주드 벨링엄')!.ovr);
    expect(tzolakis.ovr).toBeLessThan(byName.get('다비드 라야')!.ovr);

    // Same-OVR players retain genuinely distinct sub-attribute profiles
    const grossAttrs = getPlayerAttributes(gross);
    const mgwAttrs = getPlayerAttributes(mgw);
    expect(grossAttrs.cro).toBeGreaterThan(mgwAttrs.cro + 8);
    expect(grossAttrs.def).toBeGreaterThan(mgwAttrs.def + 8);
    expect(mgwAttrs.phy).toBeGreaterThan(grossAttrs.phy + 5);

    const brobbeyAttrs = getPlayerAttributes(brobbey);
    const malenAttrs = getPlayerAttributes(malen);
    expect(brobbeyAttrs.aer).toBeGreaterThan(malenAttrs.aer + 10);
    expect(malenAttrs.dri).toBeGreaterThan(brobbeyAttrs.dri + 6);
    expect(malenAttrs.cro).toBeGreaterThan(brobbeyAttrs.cro + 8);
  });

  it('3) allows Active & 10s Classic twins (Modrić) to coexist as separate players across Squad, Match, AI Rosters, HOF & Global TOP 15', () => {
    const activeModric = ACTIVE_PLAYERS.find((p) => p.name === '루카 모드리치')!;
    const classicModric = LEGEND_PLAYERS.find((p) => p.name === '루카 모드리치')!;
    expect(activeModric).toBeDefined();
    expect(classicModric).toBeDefined();
    expect(activeModric.id).not.toBe(classicModric.id);
    expect(activeModric.isLegend).toBe(false);
    expect(classicModric.isLegend).toBe(true);
    expect(classicModric.classicEra).toBe('10s');

    // Distinct record labels everywhere
    expect(formatPlayerRecordName(activeModric)).toBe('루카 모드리치');
    expect(formatPlayerRecordName(classicModric)).toBe('루카 모드리치 (10s)');

    // Owning 10s Classic Modric must NOT remove Active Modric from AC Milan AI roster
    const serieA = getLeagueById('seriea');
    const milan = serieA.clubs.find((c) => c.name === 'AC 밀란')!;
    const milanRoster = buildAiClubRoster(milan, 'seriea', new Set([classicModric.id]));
    expect(milanRoster.some((p) => p.id === activeModric.id)).toBe(true);

    // Both Modrics playing together on the same team produce distinct match ratings & season stats
    const baseStarters = ACTIVE_PLAYERS.slice(0, 11);
    const squadWithBoth: Player[] = [
      baseStarters[0],
      baseStarters[1],
      baseStarters[2],
      baseStarters[3],
      baseStarters[4],
      baseStarters[5],
      activeModric,
      classicModric,
      baseStarters[8],
      baseStarters[9],
      baseStarters[10],
    ];
    const oppClub = serieA.clubs[0];
    const oppRoster = buildAiClubRoster(oppClub, 'seriea');
    const coexistChem = calculateChemistry('4-3-3', squadWithBoth, 'possession', 'tiki_taka');
    const coexistRatings = calculateTeamRatings(
      '4-3-3',
      squadWithBoth,
      coexistChem.total,
      'tiki_taka',
      coexistChem.slotSynergies,
      'possession',
    );
    const userClub: Club = {
      ...oppClub,
      id: USER_CLUB_ID,
      name: 'FC 듀얼모드리치',
      shortName: 'DMD',
      att: coexistRatings.att,
      mid: coexistRatings.mid,
      def: coexistRatings.def,
    };
    const res = simulateMatch(
      {
        id: 'coexist-match',
        round: 1,
        homeTeamId: USER_CLUB_ID,
        awayTeamId: oppClub.id,
        played: false,
      },
      userClub,
      oppClub,
      squadWithBoth,
      oppRoster,
      {
        userClubId: USER_CLUB_ID,
        formation: '4-3-3',
        tactic: 'possession',
        chemistry: coexistChem.total,
        ratings: coexistRatings,
        managerTraitId: 'tiki_taka',
        starters: squadWithBoth,
        bench: [],
      },
      createSeededRng(20260930),
    );

    const activeRating = res.playerRatings?.find((r) => r.playerId === activeModric.id);
    const classicRating = res.playerRatings?.find((r) => r.playerId === classicModric.id);
    expect(activeRating).toBeDefined();
    expect(classicRating).toBeDefined();
    expect(activeRating!.playerName).toBe('루카 모드리치');
    expect(classicRating!.playerName).toBe('루카 모드리치 (10s)');
    expect(classicRating!.classicEra).toBe('10s');

    const statsMap = accumulateCompetitionPlayerStats(
      {},
      [res],
      { [userClub.id]: userClub, [oppClub.id]: oppClub },
      USER_CLUB_ID,
    );
    expect(statsMap[activeModric.id]?.playerName).toBe('루카 모드리치');
    expect(statsMap[classicModric.id]?.playerName).toBe('루카 모드리치 (10s)');
    expect(statsMap[classicModric.id]?.classicEra).toBe('10s');

    // HOF legacy reconstruction preserves both versions without name collision
    const seasonScore = computeSeasonScore({
      finalLeagueRank: 1,
      leaguePoints: 88,
      leaguePlayed: 38,
      leagueGoalDifference: 45,
      leagueLosses: 4,
      cup: null,
      ucl: null,
      teamAvgOvr: 86,
      chemistry: 82,
    });
    const hofEntry: HallOfFameEntry = {
      id: 'hof-coexist',
      completedAt: new Date().toISOString(),
      ruleEra: 'v9.0',
      leagueId: 'epl',
      leagueKoreanName: '프리미어리그',
      userClub: {
        name: 'FC 듀얼모드리치',
        shortName: 'DMD',
        primaryColor: '#10b981',
        secondaryColor: '#ffffff',
        pattern: 'solid',
      },
      formation: '4-3-3',
      defaultTactic: 'possession',
      managerTraitId: 'tiki_taka',
      managerName: '감독',
      managerRating: 90,
      managerAvatar: DEFAULT_MANAGER_AVATAR,
      teamAvgOvr: 86,
      chemistry: 82,
      finalLeagueRank: 1,
      leaguePoints: 88,
      leagueTotalRounds: 38,
      leagueRecord: '28승 4무 6패',
      cupName: 'FA컵',
      cupResultLabel: '우승',
      cupWon: true,
      uclResultLabel: '우승',
      uclWon: true,
      isTreble: true,
      isLeagueChampion: true,
      seasonScore,
      starters: squadWithBoth.map((p) => buildHallOfFameMember(p, 5, 5, 7.6)),
      bench: [],
      trophies: ['프리미어리그 우승', 'FA컵 우승', '챔피언스리그 우승'],
      topScorerSummary: '루카 모드리치 (10s) 15골',
      unlockedAchievementIds: [],
    };
    const rebuiltHof = reconstructHallOfFameSquad(hofEntry);
    const hofActive = rebuiltHof.starters.find((p) => p?.id === activeModric.id);
    const hofClassic = rebuiltHof.starters.find((p) => p?.id === classicModric.id);
    expect(hofActive?.isLegend).toBe(false);
    expect(hofClassic?.isLegend).toBe(true);
    expect(hofClassic?.classicEra).toBe('10s');

    // Global TOP 15 snapshot payload & match builder also keep both versions distinct
    const payload = buildGlobalSubmissionPayload(hofEntry);
    const rawRow: RawGlobalRankingRow = {
      id: 'global-coexist-1',
      ...payload,
    };
    const { entries } = filterAndRankV9GlobalRows([rawRow]);
    expect(entries.length).toBe(1);
    const globalClub = buildGlobalClubForMatch(entries[0]);
    expect(globalClub.starters.some((p) => p.id === activeModric.id && !p.isLegend)).toBe(true);
    expect(globalClub.starters.some((p) => p.id === classicModric.id && p.isLegend && p.classicEra === '10s')).toBe(true);
  });

  it('4) validates unified 2.5%/reel Era Classics roulette rate across 2,000 spins covering multiple eras', () => {
    expect(DEFAULT_ROULETTE_LEGEND_RATE).toBe(0.025);
    const rng = createSeededRng(20260931);
    const SPINS = 2000;
    let totalReels = 0;
    let classicReels = 0;
    const eraHits = new Map<ClassicEra, number>();

    const positions: { sub: 'ST' | 'CM' | 'CB' | 'GK'; broad: 'FW' | 'MF' | 'DF' | 'GK' }[] = [
      { sub: 'ST', broad: 'FW' },
      { sub: 'CM', broad: 'MF' },
      { sub: 'CB', broad: 'DF' },
      { sub: 'GK', broad: 'GK' },
    ];

    for (let i = 0; i < SPINS; i += 1) {
      const slot = positions[i % positions.length];
      const reels = spinClubRoulette(slot.sub, slot.broad, new Set(), { rng });
      for (const reel of reels) {
        totalReels += 1;
        if (reel.isLegendSlot) {
          classicReels += 1;
          expect(reel.classicEra).toBeDefined();
          expect(reel.candidates.length).toBe(1);
          expect(reel.candidates[0].isLegend).toBe(true);
          eraHits.set(reel.classicEra!, (eraHits.get(reel.classicEra!) ?? 0) + 1);
        }
      }
    }

    const hitRate = classicReels / totalReels;
    console.log(
      `[v9.3 Roulette 2,000-Spin Sim] reels=${totalReels} | classicHits=${classicReels} (${(hitRate * 100).toFixed(2)}%) | eras=${JSON.stringify(Object.fromEntries(eraHits))}`,
    );

    expect(hitRate).toBeGreaterThanOrEqual(0.018);
    expect(hitRate).toBeLessThanOrEqual(0.033);
    expect(eraHits.size).toBeGreaterThanOrEqual(5);
  });

  it('5) validates all 6 Era Best XI Dream Match teams (zero starter pos penalty, non-roulette icons, playable simulation)', () => {
    expect(ERA_BEST_XI_DREAM_TEAMS.length).toBe(6);

    const allEraPlayerNames = new Set<string>();
    for (const team of ERA_BEST_XI_DREAM_TEAMS) {
      expect(getHistoricalTeamById(team.id)?.id).toBe(team.id);
      expect(team.starters.length).toBe(11);
      expect(team.bench.length).toBe(5);

      const formation = FORMATIONS[team.formation];
      for (let i = 0; i < 11; i += 1) {
        const p = team.starters[i];
        const slot = formation.slots[i];
        const fit = evaluatePositionFit(
          p,
          slot.subPosition,
          team.managerTraitId,
          slot.alternateSubPositions,
        );
        expect(
          fit.penalty,
          `${team.id} starter #${i} (${p.name}) at ${slot.subPosition}`,
        ).toBe(0);
        allEraPlayerNames.add(p.name);
      }
      for (const b of team.bench) {
        allEraPlayerNames.add(b.name);
      }

      const built = buildHistoricalClubForMatch(team);
      expect(built.starters.length).toBe(11);
      expect(built.fullRoster.length).toBe(16);
    }

    // Non-roulette legends are playable via Era Best XI Dream Match!
    for (const nonRouletteIcon of [
      '제프 마이어',
      '보비 무어',
      '카를루스 아우베르투',
      '에우제비우',
      '조지 베스트',
      '소크라테스',
      '미하엘 발락',
      '야야 투레',
      '메수트 외질',
    ]) {
      expect(
        allEraPlayerNames.has(nonRouletteIcon),
        `Missing Era Best XI icon ${nonRouletteIcon}`,
      ).toBe(true);
    }

    // Play a live Dream Match against 90s Best XI cleanly
    const built90s = buildHistoricalClubForMatch(ERA_BEST_XI_DREAM_TEAMS[3]);
    const epl = getLeagueById('epl');
    const challengerClub = epl.clubs[0];
    const challengerRoster = buildAiClubRoster(challengerClub, 'epl');
    const match = simulateMatch(
      {
        id: 'dream-era-90s',
        round: 1,
        homeTeamId: challengerClub.id,
        awayTeamId: built90s.club.id,
        played: false,
      },
      challengerClub,
      built90s.club,
      challengerRoster,
      built90s.starters,
      undefined,
      createSeededRng(9090),
    );
    expect(match.homeGoals).toBeGreaterThanOrEqual(0);
    expect(match.awayGoals).toBeGreaterThanOrEqual(0);
    expect(match.playerRatings?.length).toBeGreaterThanOrEqual(22);
  });

  it('6) runs 50-season Low/Mid OVR Awakening Simulation (0~3/season target, Classics 0%, draft & squad visual guides)', () => {
    // Build a realistic mid-table + value gem squad (OVR 78..84) with tiki_taka matching playstyles + 1 Classic (must never awaken)
    const formation: FormationId = '4-3-3';
    const slots = FORMATIONS[formation].slots;
    const used = new Set<string>();
    const gemStarters: Player[] = slots.map((slot, idx) => {
      if (idx === 10) return LEGEND_PLAYERS[0]; // 1 Classic card in squad
      const pick =
        ACTIVE_PLAYERS.find(
          (p) =>
            !used.has(p.id) &&
            p.ovr >= 78 &&
            p.ovr <= 84 &&
            p.mainPositions.includes(slot.subPosition),
        ) ??
        ACTIVE_PLAYERS.find(
          (p) => !used.has(p.id) && p.ovr >= 78 && p.ovr <= 84 && p.position === slot.position,
        )!;
      used.add(pick.id);
      // Give slots 1..6 manager-matching playstyle to represent intentional tactical drafting
      return idx >= 1 && idx <= 6
        ? { ...pick, playstyles: ['playmaker_10'] }
        : pick;
    });

    // Draft potential hint & Squad readiness checks
    const midTableGem = ACTIVE_PLAYERS.find((p) => p.name === '파스칼 그로스')!; // 85 (>84 -> null on draft chip, eligible on readiness)
    const rawGem = ACTIVE_PLAYERS.find((p) => p.name === '미켈 담스고르')!; // 83
    expect(
      evaluateDraftAwakeningPotential(rawGem, {
        managerTraitId: 'tiki_taka',
        targetSubPosition: rawGem.mainPositions[0],
        expectedLinkCount: 2,
      }),
    ).not.toBeNull();
    expect(
      evaluateDraftAwakeningPotential(LEGEND_PLAYERS[0], {
        managerTraitId: 'galactico_manager',
        targetSubPosition: LEGEND_PLAYERS[0].mainPositions[0],
        expectedLinkCount: 4,
      }),
    ).toBeNull();
    expect(
      evaluateSquadAwakeningReadiness({
        player: midTableGem,
        managerTraitId: 'tiki_taka',
        positionPenalty: 0,
      })?.eligible,
    ).toBe(true);
    expect(
      evaluateSquadAwakeningReadiness({
        player: LEGEND_PLAYERS[0],
        managerTraitId: 'galactico_manager',
        positionPenalty: 0,
      }),
    ).toBeNull();

    const SEASONS = 50;
    const dist = { zero: 0, one: 0, two: 0, three: 0, fourPlus: 0 };
    let totalAwakened = 0;
    let totalOvrGain = 0;
    let classicAwakenings = 0;

    for (let s = 0; s < SEASONS; s += 1) {
      const rng = createSeededRng(93000 + s * 173);
      const awakened: Record<
        string,
        { originalOvr: number; ovrGain: number; round: number; competition: 'league'; statDeltas: [] }
      > = {};
      const statsMap: Record<string, PlayerSeasonStats> = {};
      const condMap: PlayerConditionMap = {};
      const synMap: Record<number, PlayerSlotSynergy> = {};

      gemStarters.forEach((p, idx) => {
        statsMap[p.id] = {
          playerId: p.id,
          playerName: formatPlayerRecordName(p),
          teamId: USER_CLUB_ID,
          teamName: 'FC 육성',
          teamShortName: 'GEM',
          teamPrimaryColor: '#10b981',
          teamSecondaryColor: '#ffffff',
          isUserTeam: true,
          position: p.position,
          mainPositions: p.mainPositions,
          ovr: p.ovr,
          appearances: 0,
          starts: 0,
          subAppearances: 0,
          minutesPlayed: 0,
          goals: 0,
          assists: 0,
          xgSum: 0,
          cleanSheets: 0,
          momCount: 0,
          ratingSum: 0,
          avgRating: 0,
          positionCounts: {},
          isLegend: p.isLegend,
        };
        condMap[p.id] = {
          morale: 4,
          injury: null,
          consecutiveBenchMatches: 0,
          consecutiveMatchesPlayed: 3,
          recentGoalDrought: 0,
        };
        const neighborBonus = idx <= 6 ? 3 : 2;
        const managerBonus = idx >= 1 && idx <= 6 ? 1 : 0;
        const totalBonus = neighborBonus + managerBonus;
        synMap[idx] = {
          slotIndex: idx,
          playerId: p.id,
          baseEffectiveOvr: p.ovr,
          effectiveOvrWithSynergy: p.ovr + totalBonus,
          neighborBonus,
          managerBonus,
          totalBonus,
          reasons: ['육성 시너지'],
          lineCount: idx <= 6 ? 8 : 4,
        };
      });

      for (let m = 1; m <= 42; m += 1) {
        const ratingsById: Record<string, number> = {};
        const goalsById: Record<string, number> = {};
        const assistsById: Record<string, number> = {};
        const minsById: Record<string, number> = {};
        const cs = rng() < 0.36;

        for (const p of gemStarters) {
          const hot = rng() < 0.25;
          const rating = hot ? 7.6 + rng() * 1.1 : 6.9 + rng() * 0.6;
          ratingsById[p.id] = Math.round(rating * 10) / 10;
          const g = p.position !== 'GK' && hot && rng() < 0.55 ? 1 : 0;
          const a = p.position !== 'GK' && hot && rng() < 0.45 ? 1 : 0;
          if (g) goalsById[p.id] = g;
          if (a) assistsById[p.id] = a;
          minsById[p.id] = 90;

          const st = statsMap[p.id];
          st.appearances += 1;
          st.starts += 1;
          st.minutesPlayed = (st.minutesPlayed ?? 0) + 90;
          st.goals += g;
          st.assists += a;
          if (cs && (p.position === 'GK' || p.position === 'DF')) st.cleanSheets += 1;
          st.ratingSum += ratingsById[p.id];
          st.avgRating = st.ratingSum / st.appearances;
        }

        const res = evaluatePostMatchAwakening({
          starters: gemStarters,
          bench: [],
          formation,
          matchPlayedNumber: m,
          round: m,
          competition: 'league',
          ratingsByPlayerId: ratingsById,
          goalsByPlayerId: goalsById,
          assistsByPlayerId: assistsById,
          minutesByPlayerId: minsById,
          cleanSheet: cs,
          allPlayerStats: statsMap,
          slotSynergies: synMap,
          conditionMap: condMap,
          managerTraitId: 'tiki_taka',
          existingAwakenedPlayers: awakened,
          rng,
        });

        if (res.triggered && res.awakenedPlayer && res.record) {
          if (res.awakenedPlayer.isLegend) classicAwakenings += 1;
          expect(res.awakenedPlayer.ovr).toBeLessThanOrEqual(AWAKENING_OVR_HARD_CAP);
          totalOvrGain += res.record.ovrGain;
          awakened[res.awakenedPlayer.id] = {
            ...res.record,
            competition: 'league',
            statDeltas: [],
          };
        }
      }

      const cnt = Object.keys(awakened).length;
      totalAwakened += cnt;
      if (cnt === 0) dist.zero += 1;
      else if (cnt === 1) dist.one += 1;
      else if (cnt === 2) dist.two += 1;
      else if (cnt === 3) dist.three += 1;
      else dist.fourPlus += 1;
    }

    const avgPerSeason = totalAwakened / SEASONS;
    const avgGain = totalOvrGain / Math.max(1, totalAwakened);
    console.log(
      `[v9.3 Low/Mid OVR Awakening 50-Season Sim] 0명=${dist.zero}(${dist.zero * 2}%) | 1명=${dist.one}(${dist.one * 2}%) | 2명=${dist.two}(${dist.two * 2}%) | 3명=${dist.three}(${dist.three * 2}%) | 4명+=${dist.fourPlus}(${dist.fourPlus * 2}%) | 평균=${avgPerSeason.toFixed(2)}명/시즌 | 평균 OVR 상승=+${avgGain.toFixed(2)} | 클래식 각성=${classicAwakenings}`,
    );

    expect(AWAKENING_SECOND_COUNT_MULT).toBe(0.78);
    expect(AWAKENING_THIRD_COUNT_MULT).toBe(0.48);
    expect(AWAKENING_FOURTH_PLUS_MULT).toBe(0.05);
    expect(AWAKENING_SUPERSTAR_OVR_THRESHOLD).toBe(88);
    expect(AWAKENING_OVR_HARD_CAP).toBe(94);
    expect(classicAwakenings).toBe(0);
    expect(avgPerSeason).toBeGreaterThanOrEqual(1.4);
    expect(avgPerSeason).toBeLessThanOrEqual(2.9);
    expect(dist.three).toBeGreaterThanOrEqual(5);
    expect(dist.fourPlus).toBeLessThanOrEqual(6);
    expect(avgGain).toBeGreaterThanOrEqual(3.8);
    expect(avgGain).toBeLessThanOrEqual(7.0);
  });

  it('7) runs 50-Season EPL Competitive Balance Simulation across 3 FFP-Compliant Archetypes', () => {
    const epl = getLeagueById('epl');
    const formation: FormationId = '4-3-3';
    const slots = FORMATIONS[formation].slots;

    const buildSquadInOvrBand = (
      minOvr: number,
      maxOvr: number,
      includeClassic?: Player,
    ): { starters: Player[]; bench: Player[] } => {
      const used = new Set<string>();
      const starters = slots.map((slot, idx) => {
        if (idx === 9 && includeClassic) {
          used.add(includeClassic.id);
          return includeClassic;
        }
        const pick =
          ACTIVE_PLAYERS.find(
            (p) =>
              !used.has(p.id) &&
              p.ovr >= minOvr &&
              p.ovr <= maxOvr &&
              p.mainPositions.includes(slot.subPosition),
          ) ??
          ACTIVE_PLAYERS.find(
            (p) =>
              !used.has(p.id) &&
              p.ovr >= minOvr - 2 &&
              p.ovr <= maxOvr + 1 &&
              p.position === slot.position,
          )!;
        used.add(pick.id);
        return pick;
      });
      const benchPositions: ('GK' | 'DF' | 'MF' | 'FW')[] = ['GK', 'DF', 'MF', 'MF', 'FW'];
      const bench = benchPositions.map((pos) => {
        const pick = ACTIVE_PLAYERS.find(
          (p) => !used.has(p.id) && p.ovr >= 78 && p.ovr <= 80 && p.position === pos,
        )!;
        used.add(pick.id);
        return pick;
      });
      return { starters, bench };
    };

    // Archetype A: Big-Club Active Core (84..86, fits cleanly inside €950M)
    const archA = buildSquadInOvrBand(84, 86);
    // Archetype B: Mid-Table Aces + 2 Awakened Gems (82..84 base -> 2 players awakened +5 OVR mid-season)
    const archBBase = buildSquadInOvrBand(82, 84);
    const archBAwakenedStarters = archBBase.starters.map((p, idx) =>
      idx === 6 || idx === 9
        ? { ...p, ovr: Math.min(91, p.ovr + 5), att: p.att + 5, mid: p.mid + 5, def: p.def + 3 }
        : p,
    );
    // Archetype C: 1 Era Classic (€130M) + Smart Value Core (83..85, fits cleanly inside €950M)
    const classicStar = LEGEND_PLAYERS.find((p) => p.name === '티에리 앙리')!;
    const archC = buildSquadInOvrBand(83, 85, classicStar);

    const archetypes = [
      {
        label: 'A. 현역 빅클럽 밸런스',
        starters: archA.starters,
        bench: archA.bench,
        budgetStarters: archA.starters,
      },
      {
        label: 'B. 중위권 알짜 + 2인 각성',
        starters: archBAwakenedStarters,
        bench: archBBase.bench,
        budgetStarters: archBBase.starters,
      },
      {
        label: 'C. 클래식 1인 + 알짜 하이브리드',
        starters: archC.starters,
        bench: archC.bench,
        budgetStarters: archC.starters,
      },
    ];

    const SEASONS = 50;
    const summaryRows: string[] = [];

    // Pre-build 19 EPL AI clubs (replace weakest club with User FC)
    const aiClubs = epl.clubs.slice(0, 19);
    const aiRosterById = new Map<string, Player[]>();
    for (const c of aiClubs) {
      aiRosterById.set(c.id, buildAiClubRoster(c, 'epl'));
    }

    for (let aIdx = 0; aIdx < archetypes.length; aIdx += 1) {
      const arch = archetypes[aIdx];
      const budget = evaluateSquadBudget([...arch.budgetStarters, ...arch.bench]);
      expect(budget.spentM).toBeLessThanOrEqual(DRAFT_BUDGET_CAP_M);
      expect(budget.ffpTier).toBe(0);

      const chem = calculateChemistry(formation, arch.starters, 'balanced', 'tiki_taka');
      const ratings = calculateTeamRatings(
        formation,
        arch.starters,
        chem.total,
        'tiki_taka',
        chem.slotSynergies,
        'balanced',
      );
      const userClub: Club = {
        id: USER_CLUB_ID,
        name: arch.label,
        shortName: `AR${aIdx + 1}`,
        primaryColor: '#10b981',
        secondaryColor: '#ffffff',
        pattern: 'solid',
        att: ratings.att,
        mid: ratings.mid,
        def: ratings.def,
        formation,
        defaultTactic: 'balanced',
        topScorers: [
          arch.starters[8].name,
          arch.starters[9].name,
          arch.starters[10].name,
        ],
      };

      const leagueClubs = [userClub, ...aiClubs];
      const clubById = new Map(leagueClubs.map((c) => [c.id, c]));

      let ptsSum = 0;
      let rankSum = 0;
      let titles = 0;
      let top4 = 0;
      let gfSum = 0;
      let gaSum = 0;

      for (let s = 0; s < SEASONS; s += 1) {
        const rng = createSeededRng(50000 + aIdx * 10000 + s * 73);
        const fixtures = generateDoubleRoundRobin(leagueClubs, rng);
        const standingsMap = new Map(
          createInitialStandings(leagueClubs).map((row) => [row.teamId, { ...row }]),
        );

        for (const fix of fixtures) {
          const h = clubById.get(fix.homeTeamId)!;
          const a = clubById.get(fix.awayTeamId)!;
          const hRoster =
            h.id === USER_CLUB_ID ? arch.starters : aiRosterById.get(h.id)!;
          const aRoster =
            a.id === USER_CLUB_ID ? arch.starters : aiRosterById.get(a.id)!;
          const isUserMatch = h.id === USER_CLUB_ID || a.id === USER_CLUB_ID;
          const res = simulateMatch(
            fix,
            h,
            a,
            hRoster,
            aRoster,
            isUserMatch
              ? {
                  userClubId: USER_CLUB_ID,
                  formation,
                  tactic: 'balanced',
                  chemistry: chem.total,
                  ratings,
                  managerTraitId: 'tiki_taka',
                  starters: arch.starters,
                  bench: arch.bench,
                }
              : undefined,
            rng,
          );
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

        const standings = sortStandings([...standingsMap.values()]);
        const userRank = standings.findIndex((r) => r.teamId === USER_CLUB_ID) + 1;
        const userRow = standings[userRank - 1];
        ptsSum += userRow.points;
        rankSum += userRank;
        gfSum += userRow.goalsFor;
        gaSum += userRow.goalsAgainst;
        if (userRank === 1) titles += 1;
        if (userRank <= 4) top4 += 1;
      }

      const avgOvr =
        arch.starters.reduce((sum, p) => sum + p.ovr, 0) / arch.starters.length;
      const avgPts = ptsSum / SEASONS;
      const avgRank = rankSum / SEASONS;
      const titlePct = (titles / SEASONS) * 100;
      const top4Pct = (top4 / SEASONS) * 100;

      summaryRows.push(
        `${arch.label} | OVR=${avgOvr.toFixed(1)} | 비용=€${budget.spentM}M (${budget.ffpTier}) | 평균승점=${avgPts.toFixed(1)} | 평균순위=${avgRank.toFixed(2)}위 | 우승=${titlePct.toFixed(0)}% | TOP4=${top4Pct.toFixed(0)}% | 득실=${(gfSum / SEASONS).toFixed(1)}/${(gaSum / SEASONS).toFixed(1)}`,
      );

      // Healthy competitive bounds: no broken 105+ monopoly, all 3 archetypes genuinely competitive
      expect(avgPts).toBeGreaterThanOrEqual(62);
      expect(avgPts).toBeLessThanOrEqual(96);
      expect(top4Pct).toBeGreaterThanOrEqual(45);
    }

    console.log(
      `\n[v9.3 50-Season EPL Balance Sim (${SEASONS} seasons × 3 FFP-Compliant Archetypes)]\n` +
        summaryRows.join('\n'),
    );
    expect(ALL_PLAYERS.length).toBe(ACTIVE_PLAYERS.length + LEGEND_PLAYERS.length);
  }, 60000);
});

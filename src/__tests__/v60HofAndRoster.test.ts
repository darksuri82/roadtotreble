import { describe, expect, it } from 'vitest';
import { getPlayerFormerClubs } from '../data/formerClubs';
import { FORMATIONS } from '../data/formations';
import {
  buildHistoricalClubForMatch,
  buildUnifiedLeaderboard,
  HISTORICAL_BENCHMARK_TEAMS,
} from '../data/historicalTeams';
import {
  ACTIVE_PLAYERS,
  LEAGUES,
  LEGEND_PLAYERS,
} from '../engine/dataLoader';
import { computeSeasonScore } from '../engine/legacyEngine';
import { evaluatePositionFit } from '../engine/positionEngine';

describe('v6.0 Stage 1 & Stage 2: HoF Scoring, 24 Historical Teams & 2026-27 Roster Audit', () => {
  it('ranks teams with higher effective OVR and manager synergy ratio strictly higher for identical season records', () => {
    const baseInput = {
      leaguePoints: 90,
      leaguePlayed: 38,
      leagueGoalDifference: 56,
      leagueLosses: 4,
      leagueGoalsFor: 82,
      leagueGoalsAgainst: 26,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 84,
      benchAvgOvr: 80,
      chemistry: 92,
      avgSynergyOvrBonus: 2.3,
      managerSynergyCount: 10,
      managerRating: 95,
    };

    const highSynergy = computeSeasonScore(baseInput);
    const lowSynergy = computeSeasonScore({
      ...baseInput,
      chemistry: 72,
      avgSynergyOvrBonus: 0.4,
      managerSynergyCount: 2,
      managerRating: 82,
    });

    expect(highSynergy.squadCraftBonus ?? 0).toBeGreaterThan(
      lowSynergy.squadCraftBonus ?? 0,
    );
    expect(highSynergy.totalScore).toBeGreaterThan(lowSynergy.totalScore);
  });

  it('includes all 10 newly added iconic historical teams (24 total) with 0 starter position penalty and valid Dream Match clubs', () => {
    expect(HISTORICAL_BENCHMARK_TEAMS).toHaveLength(24);

    const expectedNewIds = [
      'hist-7172-ajax',
      'hist-1011-barca',
      'hist-1617-realmadrid',
      'hist-2425-psg',
      'hist-8889-milan',
      'hist-0708-manutd',
      'hist-1920-liverpool',
      'hist-0607-milan',
      'hist-0102-realmadrid',
      'hist-9495-ajax',
    ];

    for (const id of expectedNewIds) {
      const team = HISTORICAL_BENCHMARK_TEAMS.find((t) => t.id === id);
      expect(team, `missing historical team ${id}`).toBeDefined();
      expect(team!.starters).toHaveLength(11);
      expect(team!.bench).toHaveLength(6);

      const built = buildHistoricalClubForMatch(team!);
      expect(built.fullRoster).toHaveLength(17);
      expect(built.club.formation).toBe(team!.formation);
      expect(built.club.manager?.traitId).toBe(team!.managerTraitId);
    }

    // All 24 historical teams must have 0 starter position penalty
    for (const team of HISTORICAL_BENCHMARK_TEAMS) {
      const formation = FORMATIONS[team.formation];
      for (let i = 0; i < 11; i += 1) {
        const slot = formation.slots[i];
        const fit = evaluatePositionFit(
          team.starters[i],
          slot.subPosition,
          team.managerTraitId,
          slot.alternateSubPositions,
        );
        expect(
          fit.penalty,
          `${team.id} starter #${i} (${team.starters[i].name}) at ${slot.subPosition}`,
        ).toBe(0);
      }
    }

    // Non-league-champion UCL winners should display accurate league finish in unified leaderboard
    const board = buildUnifiedLeaderboard({
      userEntries: [],
      filter: 'historical',
      sortBy: 'score',
    });
    const milan89 = board.find((e) => e.id === 'hist-8889-milan')!;
    const milan07 = board.find((e) => e.id === 'hist-0607-milan')!;
    const real02 = board.find((e) => e.id === 'hist-0102-realmadrid')!;
    const psg25 = board.find((e) => e.id === 'hist-2425-psg')!;

    expect(milan89.subtitle).toContain('3위(62점)');
    expect(milan89.subtitle).not.toContain('점 우승');
    expect(milan07.subtitle).toContain('4위(61점)');
    expect(milan07.subtitle).not.toContain('점 우승');
    expect(real02.subtitle).toContain('3위(66점)');
    expect(real02.subtitle).not.toContain('점 우승');
    expect(psg25.subtitle).toContain('점 우승');
  });

  it('upgrades Brighton Pascal Groß, adds Chelsea Jordan Henderson, removes 3 global duplicates, and preserves 96-club depth + 33 legends', () => {
    // 1. Brighton Pascal Groß
    const gross = ACTIVE_PLAYERS.find((p) => p.id === 'act-263')!;
    expect(gross).toBeDefined();
    expect(gross.name).toBe('파스칼 그로스');
    expect(gross.club).toBe('브라이튼');
    expect(gross.ovr).toBe(83);
    expect(gross.attrs?.pas).toBeGreaterThanOrEqual(88);
    expect(gross.attrs?.cro).toBeGreaterThanOrEqual(87);
    const grossFormer = getPlayerFormerClubs(gross);
    expect(grossFormer).toContain('TSG 호펜하임');
    expect(grossFormer).toContain('보루시아 도르트문트');
    expect(grossFormer).not.toContain('브라이튼');

    // 2. Chelsea Jordan Henderson
    const hendo = ACTIVE_PLAYERS.find((p) => p.id === 'act-v6-henderson')!;
    expect(hendo).toBeDefined();
    expect(hendo.name).toBe('조던 헨더슨');
    expect(hendo.club).toBe('첼시');
    expect(hendo.ovr).toBe(79);

    // 3. Deduplication verification (Rulli, Villalibre, Cole Campbell)
    expect(ACTIVE_PLAYERS.filter((p) => p.name.includes('룰리') || p.name === '헤로니모 루이')).toHaveLength(1);
    expect(ACTIVE_PLAYERS.find((p) => p.name === '헤로니모 룰리')?.club).toBe('맨체스터 시티');

    expect(ACTIVE_PLAYERS.filter((p) => p.name.includes('비얄리브레') || p.name.includes('비야리브레'))).toHaveLength(1);
    expect(ACTIVE_PLAYERS.find((p) => p.name === '아시에르 비얄리브레')?.club).toBe('라싱 산탄데르');

    expect(ACTIVE_PLAYERS.filter((p) => p.name === '콜 캠벨' || p.name === '콜 캄프벨')).toHaveLength(1);
    expect(ACTIVE_PLAYERS.find((p) => p.name === '콜 캠벨')?.club).toBe('SV 엘버스베르크');

    // 4. Marseille #1 GK Jeffrey De Lange upgraded
    const deLange = ACTIVE_PLAYERS.find((p) => p.id === 'act-1134')!;
    expect(deLange.club).toBe('올랭피크 마르세유');
    expect(deLange.ovr).toBe(78);

    // 5. All 96 clubs preserve squad depth minimums
    const clubs = LEAGUES.flatMap((l) => l.clubs);
    expect(clubs).toHaveLength(96);
    for (const c of clubs) {
      const sq = ACTIVE_PLAYERS.filter((p) => p.club === c.name);
      const gk = sq.filter((p) => p.mainPositions.includes('GK')).length;
      const df = sq.filter((p) => p.mainPositions.some((pos) => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos))).length;
      const mf = sq.filter((p) => p.mainPositions.some((pos) => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos))).length;
      const fw = sq.filter((p) => p.mainPositions.some((pos) => ['ST', 'CF', 'LW', 'RW'].includes(pos))).length;
      expect(sq.length, `${c.name} total`).toBeGreaterThanOrEqual(20);
      expect(gk, `${c.name} GK`).toBeGreaterThanOrEqual(2);
      expect(df, `${c.name} DF`).toBeGreaterThanOrEqual(6);
      expect(mf, `${c.name} MF`).toBeGreaterThanOrEqual(5);
      expect(fw, `${c.name} FW`).toBeGreaterThanOrEqual(4);
    }

    // 6. 33 Legends preserved (including 레벤수 trio) with 0 overlap against active players
    expect(LEGEND_PLAYERS).toHaveLength(33);
    const activeNames = new Set(ACTIVE_PLAYERS.map((p) => p.name));
    for (const leg of LEGEND_PLAYERS) {
      expect(activeNames.has(leg.name), `legend ${leg.name} duplicated in active`).toBe(false);
    }
  });
});

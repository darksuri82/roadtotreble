import { describe, expect, it } from 'vitest';
import { FORMATION_LIST } from '../data/formations';
import { MANAGER_TRAIT_LIST } from '../data/managerTraits';
import {
  ACTIVE_PLAYERS,
  LEAGUES,
  LEGEND_PLAYERS,
} from '../engine/dataLoader';
import { getCardTier } from '../types/player';

describe('V4 2026-27 Data Integrity & Multi MainPositions', () => {
  it('has 220+ active players, exact 19 Superstars (91..94), 2026-27 clubs/transfers, and non-empty mainPositions[]', () => {
    expect(ACTIVE_PLAYERS.length).toBeGreaterThanOrEqual(220);

    const validClubNames = new Set(
      LEAGUES.flatMap((l) => l.clubs.map((c) => c.name)),
    );
    const ids = new Set<string>();
    const superstars = ACTIVE_PLAYERS.filter((p) => p.ovr >= 91);

    expect(superstars.length).toBe(19);
    for (const st of superstars) {
      expect(st.isLegend).toBe(false);
      expect(getCardTier(st)).toBe('superstar');
      expect(st.ovr).toBeGreaterThanOrEqual(91);
      expect(st.ovr).toBeLessThanOrEqual(94);
    }

    // Verify 2026-27 mandatory transfers & multi mainPositions
    const cunha = ACTIVE_PLAYERS.find((p) => p.name === '마테우스 쿠냐')!;
    expect(cunha.club).toBe('맨체스터 유나이티드');
    expect(cunha.leagueId).toBe('epl');
    expect(cunha.mainPositions).toContain('CAM');

    const kdb = ACTIVE_PLAYERS.find((p) => p.name === '케빈 더 브라위너')!;
    expect(kdb.club).toBe('SSC 나폴리');
    expect(kdb.leagueId).toBe('seriea');

    const rodri = ACTIVE_PLAYERS.find((p) => p.name === '로드리')!;
    expect(rodri.club).toBe('FC 바르셀로나');
    expect(rodri.ovr).toBe(93);

    const donnarumma = ACTIVE_PLAYERS.find((p) => p.name === '잔루이지 돈나룸마')!;
    expect(donnarumma.club).toBe('맨체스터 시티');
    expect(donnarumma.ovr).toBe(91);

    const dembele = ACTIVE_PLAYERS.find((p) => p.name === '우스만 뎀벨레')!;
    expect(dembele.mainPositions).toEqual(['RW', 'ST']);

    const valverde = ACTIVE_PLAYERS.find((p) => p.name === '페데리코 발베르데')!;
    expect(valverde.mainPositions).toEqual(['CM', 'RB', 'RW']);

    for (const p of ACTIVE_PLAYERS) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.isLegend).toBe(false);
      expect(Array.isArray(p.mainPositions)).toBe(true);
      expect(p.mainPositions.length).toBeGreaterThanOrEqual(1);
      expect(['손흥민', '리오넬 메시', '크리스티아누 호날두']).not.toContain(
        p.name,
      );
      expect(validClubNames.has(p.club)).toBe(true);
      expect(p.playstyles.length).toBeGreaterThanOrEqual(1);
      expect(p.scoutNote.length).toBeGreaterThan(4);
      expect(p.stamina).toBeGreaterThanOrEqual(60);
      expect(p.stamina).toBeLessThanOrEqual(99);
    }

    expect(valverde.stamina).toBeGreaterThanOrEqual(95);
    const rice = ACTIVE_PLAYERS.find((p) => p.name === '데클런 라이스')!;
    expect(rice.stamina).toBeGreaterThanOrEqual(95);
  });

  it('has exact 30 custom legends with multi mainPositions (Messi, CR7, Maldini, Cruyff, Park, Son)', () => {
    expect(LEGEND_PLAYERS.length).toBe(30);

    const messi = LEGEND_PLAYERS.find((p) => p.name === '리오넬 메시')!;
    const cr7 = LEGEND_PLAYERS.find((p) => p.name === '크리스티아누 호날두')!;
    const son = LEGEND_PLAYERS.find((p) => p.name === '손흥민')!;
    const park = LEGEND_PLAYERS.find((p) => p.name === '박지성')!;
    const maldini = LEGEND_PLAYERS.find((p) => p.name === '파올로 말디니')!;
    const cruyff = LEGEND_PLAYERS.find((p) => p.name === '요한 크루이프')!;

    expect(messi.ovr).toBe(99);
    expect(messi.mainPositions).toEqual(['RW', 'CAM']);
    expect(cr7.ovr).toBe(98);
    expect(cr7.mainPositions).toEqual(['LW', 'ST']);
    expect(son.ovr).toBe(91);
    expect(son.mainPositions).toEqual(['LW', 'ST']);
    expect(park.mainPositions).toEqual(['CM', 'LW', 'RW']);
    expect(park.stamina).toBeGreaterThanOrEqual(96);
    expect(maldini.mainPositions).toEqual(['LB', 'CB']);
    expect(cruyff.mainPositions).toEqual(['CAM', 'ST']);

    const ids = new Set<string>();
    for (const p of LEGEND_PLAYERS) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.isLegend).toBe(true);
      expect(getCardTier(p)).toBe('legend');
      expect(p.mainPositions.length).toBeGreaterThanOrEqual(1);
      expect(p.ovr).toBeGreaterThanOrEqual(91);
      expect(p.ovr).toBeLessThanOrEqual(99);
      expect(p.stamina).toBeGreaterThanOrEqual(60);
      expect(p.stamina).toBeLessThanOrEqual(99);
    }
  });

  it('has 6 formations, 14 manager traits, and exact 96 2026-27 European Top-5 clubs (20/20/20/18/18)', () => {
    expect(FORMATION_LIST.length).toBe(6);
    expect(MANAGER_TRAIT_LIST.length).toBe(14);
    expect(LEAGUES.length).toBe(5);

    const totalClubs = LEAGUES.reduce((acc, l) => acc + l.clubs.length, 0);
    expect(totalClubs).toBe(96);

    for (const league of LEAGUES) {
      for (const club of league.clubs) {
        const avg = (club.att + club.mid + club.def) / 3;
        expect(avg).toBeGreaterThanOrEqual(70.5);
        expect(avg).toBeLessThanOrEqual(87.5);
        expect(club.formation).toBeTruthy();
        expect(club.defaultTactic).toBeTruthy();
        expect(club.topScorers.length).toBe(3);
      }
    }
  });
});

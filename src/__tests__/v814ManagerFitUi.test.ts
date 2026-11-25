import { describe, expect, it } from 'vitest';
import {
  evaluateManagerFitDetail,
  evaluateManagerTeamEffect,
  MANAGER_TRAIT_LIST,
  MANAGER_TRAITS,
} from '../data/managerTraits';
import type { ManagerTraitId } from '../types/game';
import type { Player, PlaystyleId, SubPosition } from '../types/player';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: overrides.id ?? 'p-test',
    name: overrides.name ?? '테스트 선수',
    nationality: overrides.nationality ?? '한국',
    nationalityCode: overrides.nationalityCode ?? 'KR',
    club: overrides.club ?? '테스트 FC',
    leagueId: overrides.leagueId ?? 'epl',
    position: overrides.position ?? 'MF',
    mainPositions: overrides.mainPositions ?? (['CM'] as SubPosition[]),
    secondaryPositions: overrides.secondaryPositions ?? ([] as SubPosition[]),
    ovr: overrides.ovr ?? 85,
    att: overrides.att ?? 82,
    mid: overrides.mid ?? 85,
    def: overrides.def ?? 80,
    stamina: overrides.stamina ?? 82,
    playstyles: overrides.playstyles ?? (['deep_playmaker'] as PlaystyleId[]),
    scoutNote: overrides.scoutNote ?? '테스트 노트',
    isLegend: overrides.isLegend ?? false,
    ...overrides,
  };
}

describe('v8.14 Manager Fit Detail (Single Source of Truth across all 14 traits)', () => {
  const PROGRESSIVE_TRAITS: ManagerTraitId[] = [
    'tiki_taka',
    'gegenpress_guru',
    'catenaccio',
    'wing_bomber',
    'direct_football',
    'defensive_architect',
    'midfield_maestro',
    'galactico_manager',
    'total_football',
    'set_piece_master',
  ];

  const SITUATIONAL_TRAITS: ManagerTraitId[] = [
    'big_game_hunter',
    'underdog_killer',
    'halftime_wizard',
    'super_sub',
  ];

  it('covers all 14 manager traits cleanly with fixed /11 denominator even mid-draft', () => {
    expect(PROGRESSIVE_TRAITS.length + SITUATIONAL_TRAITS.length).toBe(
      MANAGER_TRAIT_LIST.length,
    );

    const midDraftStarters: (Player | null)[] = [
      makePlayer({ id: 'p1', playstyles: ['deep_playmaker'], ovr: 92 }),
      makePlayer({ id: 'p2', playstyles: ['box_to_box'], ovr: 86 }),
      makePlayer({ id: 'p3', playstyles: ['stopper_cb'], ovr: 84 }),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ];

    for (const trait of MANAGER_TRAIT_LIST) {
      const detail = evaluateManagerFitDetail({
        traitId: trait.id,
        starters: midDraftStarters,
        tactic: 'balanced',
      });
      expect(detail).not.toBeNull();
      expect(detail!.totalSlots).toBe(11);
      expect(detail!.filledCount).toBe(3);

      const directEffect = evaluateManagerTeamEffect({
        traitId: trait.id,
        starters: midDraftStarters,
        tactic: 'balanced',
      });
      expect(detail!.effect).toEqual(directEffect);
    }
  });

  it('marks the 4 situational specialists as non-scaling with explicit non-scaling chip and empty milestones', () => {
    for (const traitId of SITUATIONAL_TRAITS) {
      const matchedStyle = MANAGER_TRAITS[traitId].synergyPlaystyles[0];
      const starters: (Player | null)[] = Array.from({ length: 11 }, (_, idx) =>
        makePlayer({
          id: `sit-${traitId}-${idx}`,
          stamina: 88,
          playstyles: [matchedStyle],
        }),
      );
      const detail = evaluateManagerFitDetail({
        traitId,
        starters,
        tactic: 'balanced',
      });
      expect(detail).not.toBeNull();
      expect(detail!.scalingMode).toBe('situational');
      expect(detail!.teamScalingMatchedCount).toBe(0);
      expect(detail!.milestones).toHaveLength(0);
      expect(detail!.nextMilestone).toBeNull();
      expect(detail!.situationalRule).not.toBeNull();
      expect(detail!.activeBoostChips[0]).toBe('팀 효과 인원 무관');
      // Personal ★+1 matching starters are still accurately counted out of 11
      expect(detail!.personalMatchedCount).toBe(11);
      expect(detail!.matchedCount).toBe(11);
    }
  });

  it('computes progressive scaling milestones and tactic synergy toggles accurately', () => {
    const starters: (Player | null)[] = [
      ...Array.from({ length: 6 }, (_, i) =>
        makePlayer({ id: `tt-${i}`, playstyles: ['deep_playmaker'] }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePlayer({ id: `non-${i}`, playstyles: ['poacher'] }),
      ),
    ];

    const balanced = evaluateManagerFitDetail({
      traitId: 'tiki_taka',
      starters,
      tactic: 'balanced',
    })!;
    const possession = evaluateManagerFitDetail({
      traitId: 'tiki_taka',
      starters,
      tactic: 'possession',
    })!;

    expect(balanced.scalingMode).toBe('progressive');
    expect(balanced.matchedCount).toBe(6);
    expect(balanced.milestones.map((m) => m.count)).toEqual([3, 6, 9, 11]);
    expect(balanced.milestones[0].reached).toBe(true);
    expect(balanced.milestones[1].reached).toBe(true);
    expect(balanced.milestones[2].reached).toBe(false);
    expect(balanced.nextMilestone?.targetCount).toBe(9);
    expect(balanced.nextMilestone?.remaining).toBe(3);

    expect(balanced.effect.isTacticSynergyActive).toBe(false);
    expect(possession.effect.isTacticSynergyActive).toBe(true);
    expect(possession.effect.baseAttDelta).toBeCloseTo(0.9, 2);
    expect(possession.effect.baseMidDelta).toBeGreaterThan(
      balanced.effect.baseMidDelta,
    );
    expect(possession.totalOvrDelta).toBeGreaterThan(balanced.totalOvrDelta);
  });

  it('distinguishes team scaling criteria vs personal +1 criteria for galactico_manager and total_football', () => {
    const galacticoStarters: (Player | null)[] = [
      makePlayer({ id: 'g1', ovr: 92, playstyles: ['poacher'] }), // team + personal
      makePlayer({ id: 'g2', ovr: 89, playstyles: ['poacher'] }), // personal only (88+)
      makePlayer({ id: 'g3', ovr: 84, playstyles: ['complete_forward'] }), // personal only (style)
      makePlayer({ id: 'g4', ovr: 82, playstyles: ['stopper_cb'] }), // neither
    ];
    const gDetail = evaluateManagerFitDetail({
      traitId: 'galactico_manager',
      starters: galacticoStarters,
    })!;
    expect(gDetail.hasSeparatePersonalCriteria).toBe(true);
    expect(gDetail.teamScalingMatchedCount).toBe(1);
    expect(gDetail.matchedCount).toBe(1);
    expect(gDetail.personalMatchedCount).toBe(3);
    expect(gDetail.effect.baseAttDelta).toBeCloseTo(0.35, 2);

    const totalStarters: (Player | null)[] = [
      makePlayer({
        id: 't1',
        mainPositions: ['CM', 'CAM'],
        secondaryPositions: ['LW'],
        playstyles: ['poacher'],
      }), // 3 positions -> team + personal
      makePlayer({
        id: 't2',
        mainPositions: ['CM'],
        secondaryPositions: [],
        playstyles: ['box_to_box'],
      }), // style only -> personal only
    ];
    const tDetail = evaluateManagerFitDetail({
      traitId: 'total_football',
      starters: totalStarters,
    })!;
    expect(tDetail.hasSeparatePersonalCriteria).toBe(true);
    expect(tDetail.teamScalingMatchedCount).toBe(1);
    expect(tDetail.matchedCount).toBe(1);
    expect(tDetail.personalMatchedCount).toBe(2);
    expect(tDetail.effect.baseAttDelta).toBeCloseTo(0.25, 2);
  });

  it('updates matchedCount immediately on starter swap / candidate preview', () => {
    const base: (Player | null)[] = [
      makePlayer({ id: 'w1', playstyles: ['classic_winger'] }),
      null,
    ];
    const preview: (Player | null)[] = [
      makePlayer({ id: 'w1', playstyles: ['classic_winger'] }),
      makePlayer({ id: 'w2', playstyles: ['attacking_wingback'] }),
    ];

    const dBase = evaluateManagerFitDetail({
      traitId: 'wing_bomber',
      starters: base,
      tactic: 'wingplay',
    })!;
    const dPreview = evaluateManagerFitDetail({
      traitId: 'wing_bomber',
      starters: preview,
      tactic: 'wingplay',
    })!;

    expect(dBase.matchedCount).toBe(1);
    expect(dPreview.matchedCount).toBe(2);
    expect(dPreview.effect.baseAttDelta).toBeGreaterThan(
      dBase.effect.baseAttDelta,
    );
  });
});

import { describe, expect, it } from 'vitest';
import tacticsGuideSrc from '../components/common/TacticsGuideModal.tsx?raw';
import draftScreenSrc from '../components/draft/DraftScreen.tsx?raw';
import attributeGuideSrc from '../components/guide/AttributeRoutesGuideContent.tsx?raw';
import {
  GUIDE_TAB_LABELS,
  openSoloTutorial,
  openSystemGuide,
} from '../components/guide/guideNavigation';
import injuryGuideSrc from '../components/guide/InjuryMoraleGuideContent.tsx?raw';
import {
  isSoloTutorialDismissed,
  setSoloTutorialDismissed,
  SOLO_TUTORIAL_STORAGE_KEY,
} from '../components/guide/SoloVisualTutorialModal';
import systemGuideSrc from '../components/guide/SystemGuideModal.tsx?raw';
import { FORMATIONS, FORMATION_LIST } from '../data/formations';
import { HISTORICAL_BENCHMARK_TEAMS } from '../data/historicalTeams';
import { ALL_MANAGER_EVENTS } from '../data/managerEvents';
import { MANAGER_TRAIT_LIST } from '../data/managerTraits';
import {
  COMPLEMENTARY_STYLE_PAIRS,
  ELITE_PAIR_MIN_OVR,
} from '../engine/chemistryEngine';
import {
  computeFullPlayerOvrBreakdown,
  SEVERITY_LABELS,
} from '../engine/conditionEngine';
import { ACTIVE_PLAYERS, LEGEND_PLAYERS } from '../engine/dataLoader';
import {
  DEFAULT_ROULETTE_LEGEND_RATE,
  TOP4_TRANSFER_LEGEND_RATE,
} from '../engine/draftEngine';
import { HOF_AUTO_INDUCTION_MIN_SCORE } from '../engine/legacyEngine';
import { MP_H2H_MAX_POINTS } from '../engine/mpLeagueScore';
import { evaluatePositionFit } from '../engine/positionEngine';
import { MAX_MATCH_SUBS, TACTIC_STAMINA_MULT } from '../engine/staminaEngine';
import {
  ATTEMPTS_PER_WINDOW,
  UCL_CHAMPION_LEGEND_RATE,
} from '../engine/transferEngine';

const GUIDE_SOURCES: [string, string][] = [
  ['SystemGuideModal.tsx', systemGuideSrc],
  ['InjuryMoraleGuideContent.tsx', injuryGuideSrc],
  ['AttributeRoutesGuideContent.tsx', attributeGuideSrc],
  ['TacticsGuideModal.tsx', tacticsGuideSrc],
  ['DraftScreen.tsx', draftScreenSrc],
];

describe('v8.10 Guidebook 100% Engine Sync, Visual Tutorial & Contextual UX', () => {
  it('eliminates all outdated legacy numbers and double-scroll traps across guide & help files', () => {
    const forbiddenLegacyPhrases = [
      '합산 최대 +3',
      '최대 2회 리롤',
      '6대 포메이션',
      '명예의 전당 14팀',
      '2,239명',
      '토탈 풋볼 시 -1',
      '토탈 풋볼 시 -3',
      '우세 +2.2',
      '약우위 +0.9',
      '잔여 경기수에 따라',
      '장기 부상 (Severe)',
    ];

    for (const [name, content] of GUIDE_SOURCES) {
      for (const phrase of forbiddenLegacyPhrases) {
        expect(
          content.includes(phrase),
          `${name} must not contain stale phrase "${phrase}"`,
        ).toBe(false);
      }
    }

    // SystemGuideModal must NOT contain nested max-h-56 overflow-y-auto double scroll
    expect(systemGuideSrc.includes('max-h-56 overflow-y-auto')).toBe(false);
    expect(systemGuideSrc.includes('break-keep')).toBe(true);

    // InjuryMoraleGuideContent must enforce whitespace-nowrap & keep-all for clean Korean layout
    expect(injuryGuideSrc.includes('break-keep')).toBe(true);
    expect(injuryGuideSrc.includes('whitespace-nowrap')).toBe(true);
    expect(injuryGuideSrc.includes('시너지 합산 최대 +4')).toBe(true);
  });

  it('matches all live engine constants referenced by the synchronized guidebook', () => {
    expect(FORMATION_LIST.length).toBe(9);
    expect(Object.keys(FORMATIONS).length).toBe(9);
    expect(MANAGER_TRAIT_LIST.length).toBe(14);
    expect(HISTORICAL_BENCHMARK_TEAMS.length).toBe(24);
    expect(COMPLEMENTARY_STYLE_PAIRS.length).toBe(21);
    expect(ELITE_PAIR_MIN_OVR).toBe(88);
    expect(DEFAULT_ROULETTE_LEGEND_RATE).toBe(0.025);
    expect(TOP4_TRANSFER_LEGEND_RATE).toBe(0.04);
    expect(UCL_CHAMPION_LEGEND_RATE).toBe(0.055);
    expect(ATTEMPTS_PER_WINDOW).toBe(3);
    expect(HOF_AUTO_INDUCTION_MIN_SCORE).toBe(5500);
    expect(MP_H2H_MAX_POINTS).toBe(1500);
    expect(MAX_MATCH_SUBS).toBe(5);
    expect(TACTIC_STAMINA_MULT.gegenpressing).toBe(1.35);
    expect(TACTIC_STAMINA_MULT.counter).toBe(0.9);
    expect(SEVERITY_LABELS.severe).toBe('치명적 중상');
    expect(ALL_MANAGER_EVENTS.length).toBe(72);
    expect(ACTIVE_PLAYERS.length + LEGEND_PLAYERS.length).toBe(2237);

    // Total Football exact penalties: 0 / -2 / -8 (GK remains -15)
    const testMid = {
      ovr: 85,
      mainPositions: ['CM' as const],
      secondaryPositions: ['CAM' as const],
    };
    expect(evaluatePositionFit(testMid, 'CAM', 'total_football').penalty).toBe(0);
    expect(evaluatePositionFit(testMid, 'CDM', 'total_football').penalty).toBe(-2);
    expect(evaluatePositionFit(testMid, 'ST', 'total_football').penalty).toBe(-8);
    expect(evaluatePositionFit(testMid, 'GK', 'total_football').penalty).toBe(-15);

    // Decoupled +3 neighbor synergy + +1 manager compatibility = +4 total
    const br = computeFullPlayerOvrBreakdown({
      baseOvr: 85,
      positionPenalty: 0,
      playerSynergyBonus: 3,
      managerBonus: 1,
      condition: null,
    });
    expect(br.synergyBonus).toBe(4);
    expect(br.finalEffectiveOvr).toBe(89);
    expect(br.summaryLine).toContain('시너지 +3 / 감독 +1');
  });

  it('safely handles visual tutorial storage helpers and guide navigation helpers in SSR/Node', () => {
    expect(SOLO_TUTORIAL_STORAGE_KEY).toBe('rtt_solo_tutorial_dismissed_v1');
    expect(isSoloTutorialDismissed()).toBe(false);
    expect(() => setSoloTutorialDismissed(true)).not.toThrow();
    expect(() => openSystemGuide('chemistry')).not.toThrow();
    expect(() => openSoloTutorial()).not.toThrow();
    expect(Object.keys(GUIDE_TAB_LABELS)).toEqual([
      'basics',
      'chemistry',
      'tactics',
      'season',
      'condition',
      'attributes',
    ]);
  });
});

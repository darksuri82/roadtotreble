import type {
  ManagerAvatarConfig,
  StaffCoachCategory,
  StaffCoachId,
  StaffCoachState,
} from '../types/game';
import type { TacticId } from '../types/league';
import type { Player } from '../types/player';

export interface StaffCoachProfile {
  id: StaffCoachId;
  name: string;
  roleTitle: string;
  category: StaffCoachCategory;
  categoryLabel: string;
  shortBadge: string;
  effectSummary: string;
  accentColor: string;
  tacticId?: TacticId;
  avatar: ManagerAvatarConfig;
  clubPrimaryColor: string;
  clubSecondaryColor: string;
}

export const STAFF_COACH_TACTIC_OVR_LIFT = 1.5;
export const STAFF_COACH_LINE_LIFT = 2.0;
export const STAFF_COACH_CHEM_LIFT = 8;
export const STAFF_COACH_MORALE_DEFENSE = 1;
export const STAFF_COACH_TACTIC_MATCHUP_MULT = 1.18; // +18% tactical zone advantage
export const STAFF_COACH_LATE_STAMINA_REDUCTION = 0.25; // -25% drain after 65'
export const STAFF_COACH_SUB_OVR_LIFT = 3.0;
export const STAFF_COACH_SUB_COMBINED_CAP = 4.0; // Cap when combined with super_sub manager
export const STAFF_COACH_DEV_MAX_BASE_OVR = 84;
export const STAFF_COACH_DEV_OVR_LIFT = 1.5;
export const STAFF_COACH_DEV_AWAKENING_MULT = 1.35; // +35% awakening probability

export const STAFF_COACHES: Record<StaffCoachId, StaffCoachProfile> = {
  // ── Category 1: Tactic Specialists (5 — 1:1 with unifiedTacticsEngine TacticId) ──
  tactic_possession: {
    id: 'tactic_possession',
    name: '하비에르 솔라',
    roleTitle: '점유율 빌드업 코치',
    category: 'tactic',
    categoryLabel: '전술 특화',
    shortBadge: '점유율 A·M·D +1.5',
    effectSummary: '점유율 전술 선택 중 팀 전체 A·M·D +1.5 상시 상승',
    accentColor: '#38bdf8',
    tacticId: 'possession',
    avatar: {
      gender: 'male',
      skinTone: 'warm',
      hairStyle: 'parted',
      hairColor: 'black',
      outfit: 'navy_coat',
    },
    clubPrimaryColor: '#0ea5e9',
    clubSecondaryColor: '#e0f2fe',
  },
  tactic_gegenpressing: {
    id: 'tactic_gegenpressing',
    name: '마르쿠스 크라우스',
    roleTitle: '전방 압박 코치',
    category: 'tactic',
    categoryLabel: '전술 특화',
    shortBadge: '압박 A·M·D +1.5',
    effectSummary: '게겐프레싱 전술 선택 중 팀 전체 A·M·D +1.5 상시 상승',
    accentColor: '#f97316',
    tacticId: 'gegenpressing',
    avatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'buzz',
      hairColor: 'blonde',
      outfit: 'team_tracksuit',
    },
    clubPrimaryColor: '#ea580c',
    clubSecondaryColor: '#ffedd5',
  },
  tactic_counter: {
    id: 'tactic_counter',
    name: '마테오 콘티',
    roleTitle: '로우블록 역습 코치',
    category: 'tactic',
    categoryLabel: '전술 특화',
    shortBadge: '역습 A·M·D +1.5',
    effectSummary: '선수비 후역습 전술 선택 중 팀 전체 A·M·D +1.5 상시 상승',
    accentColor: '#94a3b8',
    tacticId: 'counter',
    avatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'slick',
      hairColor: 'silver',
      outfit: 'classic_suit',
    },
    clubPrimaryColor: '#475569',
    clubSecondaryColor: '#f1f5f9',
  },
  tactic_wingplay: {
    id: 'tactic_wingplay',
    name: '루카스 페레이라',
    roleTitle: '측면 전개 코치',
    category: 'tactic',
    categoryLabel: '전술 특화',
    shortBadge: '측면 A·M·D +1.5',
    effectSummary: '측면 공략 전술 선택 중 팀 전체 A·M·D +1.5 상시 상승',
    accentColor: '#22c55e',
    tacticId: 'wingplay',
    avatar: {
      gender: 'male',
      skinTone: 'tan',
      hairStyle: 'fluffy',
      hairColor: 'brown',
      outfit: 'puffer_jacket',
    },
    clubPrimaryColor: '#16a34a',
    clubSecondaryColor: '#dcfce7',
  },
  tactic_balanced: {
    id: 'tactic_balanced',
    name: '토마스 린드',
    roleTitle: '밸런스 조직 코치',
    category: 'tactic',
    categoryLabel: '전술 특화',
    shortBadge: '밸런스 A·M·D +1.5',
    effectSummary: '밸런스 전술 선택 중 팀 전체 A·M·D +1.5 상시 상승',
    accentColor: '#a78bfa',
    tacticId: 'balanced',
    avatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'parted',
      hairColor: 'brown',
      outfit: 'casual_shirt',
    },
    clubPrimaryColor: '#7c3aed',
    clubSecondaryColor: '#ede9fe',
  },

  // ── Category 2: Line Focus Coaches (3 — Always-On) ─────────────────────────
  line_attack: {
    id: 'line_attack',
    name: '에두아르도 실바',
    roleTitle: '공격 전담 코치',
    category: 'line',
    categoryLabel: '라인 강화',
    shortBadge: '상시 A +2.0',
    effectSummary: '전술 무관 상시 팀 공격력(A) +2.0 강화',
    accentColor: '#fb7185',
    avatar: {
      gender: 'male',
      skinTone: 'tan',
      hairStyle: 'slick',
      hairColor: 'black',
      outfit: 'team_tracksuit',
    },
    clubPrimaryColor: '#e11d48',
    clubSecondaryColor: '#ffe4e6',
  },
  line_midfield: {
    id: 'line_midfield',
    name: '줄리앙 모로',
    roleTitle: '미드필드 전담 코치',
    category: 'line',
    categoryLabel: '라인 강화',
    shortBadge: '상시 M +2.0',
    effectSummary: '전술 무관 상시 팀 중원력(M) +2.0 강화',
    accentColor: '#34d399',
    avatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'fluffy',
      hairColor: 'brown',
      outfit: 'navy_coat',
    },
    clubPrimaryColor: '#059669',
    clubSecondaryColor: '#d1fae5',
  },
  line_defense: {
    id: 'line_defense',
    name: '안드레아 로시',
    roleTitle: '수비 전담 코치',
    category: 'line',
    categoryLabel: '라인 강화',
    shortBadge: '상시 D +2.0',
    effectSummary: '전술 무관 상시 팀 수비력(D) +2.0 강화',
    accentColor: '#60a5fa',
    avatar: {
      gender: 'male',
      skinTone: 'warm',
      hairStyle: 'bald',
      hairColor: 'silver',
      outfit: 'classic_suit',
    },
    clubPrimaryColor: '#2563eb',
    clubSecondaryColor: '#dbeafe',
  },

  // ── Category 3: System Utility Coaches (4 — Operations & Mastery) ──────────
  sys_tactical_mastery: {
    id: 'sys_tactical_mastery',
    name: '헨릭 반 데르 베르크',
    roleTitle: '전술 완성도 코치',
    category: 'system',
    categoryLabel: '시스템 보너스',
    shortBadge: '파훼 -45% · 상성 +18%',
    effectSummary: '반복 전술 파훼 누적 45% 완화 + 5구역 전술 상성 우위 18% 상시 강화',
    accentColor: '#2dd4bf',
    avatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'slick',
      hairColor: 'silver',
      outfit: 'navy_coat',
    },
    clubPrimaryColor: '#0d9488',
    clubSecondaryColor: '#ccfbf1',
  },
  sys_locker_room: {
    id: 'sys_locker_room',
    name: '클레르 뒤퐁',
    roleTitle: '라커룸 · 케미 코치',
    category: 'system',
    categoryLabel: '시스템 보너스',
    shortBadge: '팀 케미 +8 · 사기 방어',
    effectSummary: '팀 케미 상시 +8 상승(최대 100) + 패배 시 사기 하락 1단계 방어',
    accentColor: '#fbbf24',
    avatar: {
      gender: 'female',
      skinTone: 'peach',
      hairStyle: 'bob',
      hairColor: 'brown',
      outfit: 'female_blazer',
    },
    clubPrimaryColor: '#d97706',
    clubSecondaryColor: '#fef3c7',
  },
  sys_supersub_phys: {
    id: 'sys_supersub_phys',
    name: '다비데 페라리',
    roleTitle: '슈퍼서브 · 피지컬 코치',
    category: 'system',
    categoryLabel: '시스템 보너스',
    shortBadge: '65\'+ 체력 -25% · 교체 +3',
    effectSummary: '후반 65분 이후 팀 체력 소모 25% 완화 + 교체 벤치 선수 OVR 상시 +3.0',
    accentColor: '#f472b6',
    avatar: {
      gender: 'male',
      skinTone: 'warm',
      hairStyle: 'buzz',
      hairColor: 'black',
      outfit: 'team_tracksuit',
    },
    clubPrimaryColor: '#db2777',
    clubSecondaryColor: '#fce7f3',
  },
  sys_potential_dev: {
    id: 'sys_potential_dev',
    name: '엘레나 모랄레스',
    roleTitle: '잠재력 육성 코치',
    category: 'system',
    categoryLabel: '시스템 보너스',
    shortBadge: 'OVR≤84 +1.5 · 각성 +35%',
    effectSummary: '기본 OVR 84 이하 선수 상시 OVR +1.5 + 포텐 각성 확률 +35%(레전드 제외)',
    accentColor: '#fb923c',
    avatar: {
      gender: 'female',
      skinTone: 'warm',
      hairStyle: 'ponytail',
      hairColor: 'black',
      outfit: 'female_tracksuit',
    },
    clubPrimaryColor: '#ea580c',
    clubSecondaryColor: '#ffedd5',
  },
};

export const STAFF_COACH_LIST: StaffCoachProfile[] = Object.values(STAFF_COACHES);

const TACTIC_COACH_IDS: StaffCoachId[] = [
  'tactic_possession',
  'tactic_gegenpressing',
  'tactic_counter',
  'tactic_wingplay',
  'tactic_balanced',
];

const LINE_COACH_IDS: StaffCoachId[] = [
  'line_attack',
  'line_midfield',
  'line_defense',
];

const SYSTEM_COACH_IDS: StaffCoachId[] = [
  'sys_tactical_mastery',
  'sys_locker_room',
  'sys_supersub_phys',
  'sys_potential_dev',
];

export function createInitialStaffCoachState(): StaffCoachState {
  return {
    hiredCoachId: null,
    offeredCoachIds: [],
    pendingSelection: false,
    completed: false,
  };
}

/**
 * Draws 3 distinct coaches for the mid-season (Window 2) appointment modal:
 * 1 from Category 1 (Tactic Specialist — gently weighted toward current tactic),
 * 1 from Category 2 (Line Focus), and 1 from Category 3 (System Utility).
 */
export function rollMidSeasonStaffCoachOffers(params?: {
  activeTactic?: TacticId;
  rng?: () => number;
}): StaffCoachId[] {
  const rng = params?.rng ?? Math.random;
  const activeTactic = params?.activeTactic;

  let tacticPick: StaffCoachId;
  const matchingTacticCoach = activeTactic
    ? TACTIC_COACH_IDS.find((id) => STAFF_COACHES[id].tacticId === activeTactic)
    : undefined;
  if (matchingTacticCoach && rng() < 0.45) {
    tacticPick = matchingTacticCoach;
  } else {
    tacticPick =
      TACTIC_COACH_IDS[Math.floor(rng() * TACTIC_COACH_IDS.length)] ??
      TACTIC_COACH_IDS[0];
  }

  const linePick =
    LINE_COACH_IDS[Math.floor(rng() * LINE_COACH_IDS.length)] ??
    LINE_COACH_IDS[0];

  const sysPick =
    SYSTEM_COACH_IDS[Math.floor(rng() * SYSTEM_COACH_IDS.length)] ??
    SYSTEM_COACH_IDS[0];

  return [tacticPick, linePick, sysPick];
}

export interface StaffCoachActiveEffect {
  coach: StaffCoachProfile | null;
  isActiveNow: boolean;
  attDelta: number;
  midDelta: number;
  defDelta: number;
  chemBonus: number; // 0 or +8
  tacticalMatchupMultiplier: number; // 1.0 or 1.18
  moraleLossDefense: number; // 0 or 1
  lateStaminaDrainMult: number; // 1.0 or 0.75 (after 65')
  subOvrLiftOverride: number | null; // null or 3.0
  devLowOvrPlayerLift: number; // 0 or +1.5 for base OVR <= 84
  awakeningRateMultiplier: number; // 1.0 or 1.35
  statusChip: string;
}

/**
 * Single Source of Truth for an appointed Assistant Coach's live effects.
 * Used cleanly by `chemistryEngine`, `staminaEngine`, `conditionEngine`,
 * `awakeningEngine`, `matchEngine`, and UI badges with zero double-counting.
 */
export function evaluateStaffCoachEffect(
  coachId: StaffCoachId | null | undefined,
  activeTactic: TacticId = 'balanced',
): StaffCoachActiveEffect {
  const empty: StaffCoachActiveEffect = {
    coach: null,
    isActiveNow: false,
    attDelta: 0,
    midDelta: 0,
    defDelta: 0,
    chemBonus: 0,
    tacticalMatchupMultiplier: 1.0,
    moraleLossDefense: 0,
    lateStaminaDrainMult: 1.0,
    subOvrLiftOverride: null,
    devLowOvrPlayerLift: 0,
    awakeningRateMultiplier: 1.0,
    statusChip: '',
  };

  if (!coachId) return empty;
  const coach = STAFF_COACHES[coachId];
  if (!coach) return empty;

  if (coach.category === 'tactic') {
    const isMatch = coach.tacticId === activeTactic;
    return {
      ...empty,
      coach,
      isActiveNow: isMatch,
      attDelta: isMatch ? STAFF_COACH_TACTIC_OVR_LIFT : 0,
      midDelta: isMatch ? STAFF_COACH_TACTIC_OVR_LIFT : 0,
      defDelta: isMatch ? STAFF_COACH_TACTIC_OVR_LIFT : 0,
      statusChip: isMatch ? '발동 중 · A·M·D +1.5' : `대기 (${coach.shortBadge})`,
    };
  }

  if (coachId === 'line_attack') {
    return {
      ...empty,
      coach,
      isActiveNow: true,
      attDelta: STAFF_COACH_LINE_LIFT,
      statusChip: '상시 · A +2.0',
    };
  }
  if (coachId === 'line_midfield') {
    return {
      ...empty,
      coach,
      isActiveNow: true,
      midDelta: STAFF_COACH_LINE_LIFT,
      statusChip: '상시 · M +2.0',
    };
  }
  if (coachId === 'line_defense') {
    return {
      ...empty,
      coach,
      isActiveNow: true,
      defDelta: STAFF_COACH_LINE_LIFT,
      statusChip: '상시 · D +2.0',
    };
  }

  if (coachId === 'sys_tactical_mastery') {
    return {
      ...empty,
      coach,
      isActiveNow: true,
      tacticalMatchupMultiplier: STAFF_COACH_TACTIC_MATCHUP_MULT,
      statusChip: '파훼 -45% · 상성 +18%',
    };
  }
  if (coachId === 'sys_locker_room') {
    return {
      ...empty,
      coach,
      isActiveNow: true,
      chemBonus: STAFF_COACH_CHEM_LIFT,
      moraleLossDefense: STAFF_COACH_MORALE_DEFENSE,
      statusChip: '케미 +8 · 사기 방어',
    };
  }
  if (coachId === 'sys_supersub_phys') {
    return {
      ...empty,
      coach,
      isActiveNow: true,
      lateStaminaDrainMult: 1 - STAFF_COACH_LATE_STAMINA_REDUCTION,
      subOvrLiftOverride: STAFF_COACH_SUB_OVR_LIFT,
      statusChip: '65\'+ 체력 · 교체 +3.0',
    };
  }
  // sys_potential_dev
  return {
    ...empty,
    coach,
    isActiveNow: true,
    devLowOvrPlayerLift: STAFF_COACH_DEV_OVR_LIFT,
    awakeningRateMultiplier: STAFF_COACH_DEV_AWAKENING_MULT,
    statusChip: 'OVR≤84 +1.5 · 각성↑',
  };
}

/**
 * Helper to check if a player receives the Potential Development coach's always-on +1.5 OVR lift
 * (based on original/base OVR <= 84, excluding Legends).
 */
export function getDevCoachPlayerBonus(
  player: Pick<Player, 'ovr' | 'isLegend' | 'awakening'>,
  staffCoachId: StaffCoachId | null | undefined,
): number {
  if (staffCoachId !== 'sys_potential_dev') return 0;
  if (player.isLegend) return 0;
  const baseOvr = player.awakening?.originalOvr ?? player.ovr;
  return baseOvr <= STAFF_COACH_DEV_MAX_BASE_OVR ? STAFF_COACH_DEV_OVR_LIFT : 0;
}

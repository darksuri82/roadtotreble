import type { FormationId } from '../types/game';
import type { TacticId } from '../types/league';

export interface TacticMeta {
  id: TacticId;
  name: string;
  shortName: string;
  description: string;
  strongAgainst: string;
  weakAgainst: string;
  possessionMod: number; // % modifier
}

export const TACTICS: Record<TacticId, TacticMeta> = {
  possession: {
    id: 'possession',
    name: '점유율',
    shortName: '점유율',
    description: '짧은 패스와 빌드업으로 공을 소유하며 상대 수비 균열을 노립니다.',
    strongAgainst: '측면 공략 (강우위), 밸런스 (약우위)',
    weakAgainst: '게겐프레싱',
    possessionMod: 5.5,
  },
  gegenpressing: {
    id: 'gegenpressing',
    name: '게겐프레싱',
    shortName: '압박',
    description: '높은 라인에서 전방 압박으로 볼을 탈취해 즉시 공격으로 전환합니다.',
    strongAgainst: '점유율',
    weakAgainst: '선수비 후역습',
    possessionMod: 1.5,
  },
  counter: {
    id: 'counter',
    name: '선수비 후역습',
    shortName: '역습',
    description: '낮은 블록으로 공간을 잠근 뒤 빠른 뒷공간 침투로 일격을 가합니다.',
    strongAgainst: '게겐프레싱',
    weakAgainst: '측면 공략',
    possessionMod: -5.5,
  },
  wingplay: {
    id: 'wingplay',
    name: '측면 공략',
    shortName: '측면',
    description: '윙어와 윙백의 오버래핑·크로스로 밀집 수비를 측면에서 흔듭니다.',
    strongAgainst: '선수비 후역습',
    weakAgainst: '점유율',
    possessionMod: -0.5,
  },
  balanced: {
    id: 'balanced',
    name: '밸런스',
    shortName: '밸런스',
    description: '공수 간격을 안정적으로 유지하며 뚜렷한 약점을 노출하지 않는 기본형입니다.',
    strongAgainst: '없음 (안정적 무상성)',
    weakAgainst: '점유율 (약열세)',
    possessionMod: 0,
  },
};

export const TACTIC_LIST: TacticMeta[] = [
  TACTICS.possession,
  TACTICS.gegenpressing,
  TACTICS.counter,
  TACTICS.wingplay,
  TACTICS.balanced,
];

/**
 * Symmetric 5-tactic rock-paper-scissors matrix (in effective OVR points).
 * Strong advantage: +2.2, slight advantage: +0.9, neutral: 0.
 */
const TACTIC_MATRIX: Record<TacticId, Record<TacticId, number>> = {
  possession: {
    possession: 0,
    gegenpressing: -2.2,
    counter: 0,
    wingplay: 2.2,
    balanced: 0.9,
  },
  gegenpressing: {
    possession: 2.2,
    gegenpressing: 0,
    counter: -2.2,
    wingplay: 0,
    balanced: 0,
  },
  counter: {
    possession: 0,
    gegenpressing: 2.2,
    counter: 0,
    wingplay: -2.2,
    balanced: 0,
  },
  wingplay: {
    possession: -2.2,
    gegenpressing: 0,
    counter: 2.2,
    wingplay: 0,
    balanced: 0,
  },
  balanced: {
    possession: -0.9,
    gegenpressing: 0,
    counter: 0,
    wingplay: 0,
    balanced: 0,
  },
};

export interface MatchupEvaluation {
  delta: number; // positive = advantageous
  verdict: 'advantage' | 'slight_advantage' | 'neutral' | 'slight_disadvantage' | 'disadvantage';
  label: string;
}

export function evaluateTacticMatchup(
  myTactic: TacticId,
  oppTactic: TacticId,
): MatchupEvaluation {
  const delta = TACTIC_MATRIX[myTactic][oppTactic];
  if (delta >= 2.0) {
    return {
      delta,
      verdict: 'advantage',
      label: `${TACTICS[myTactic].name} > ${TACTICS[oppTactic].name} (상성 우위 +${delta.toFixed(1)})`,
    };
  }
  if (delta > 0) {
    return {
      delta,
      verdict: 'slight_advantage',
      label: `${TACTICS[myTactic].name} > ${TACTICS[oppTactic].name} (약우위 +${delta.toFixed(1)})`,
    };
  }
  if (delta <= -2.0) {
    return {
      delta,
      verdict: 'disadvantage',
      label: `${TACTICS[myTactic].name} < ${TACTICS[oppTactic].name} (상성 열세 ${delta.toFixed(1)})`,
    };
  }
  if (delta < 0) {
    return {
      delta,
      verdict: 'slight_disadvantage',
      label: `${TACTICS[myTactic].name} < ${TACTICS[oppTactic].name} (약열세 ${delta.toFixed(1)})`,
    };
  }
  return {
    delta: 0,
    verdict: 'neutral',
    label: '전술 상성 호각 (0.0)',
  };
}

/**
 * Symmetric 6-formation tactical matchup matrix (in effective OVR points).
 */
const FORMATION_MATRIX: Record<FormationId, Record<FormationId, number>> = {
  '4-3-3': {
    '4-3-3': 0,
    '4-4-2': 0.5,
    '4-2-3-1': 1.2,
    '3-5-2': 1.2,
    '3-4-3': 0,
    '3-4-2-1': -1.2,
  },
  '4-4-2': {
    '4-3-3': -0.5,
    '4-4-2': 0,
    '4-2-3-1': -1.4,
    '3-5-2': -1.4,
    '3-4-3': 1.4,
    '3-4-2-1': 1.3,
  },
  '4-2-3-1': {
    '4-3-3': -1.2,
    '4-4-2': 1.4,
    '4-2-3-1': 0,
    '3-5-2': 0,
    '3-4-3': 1.1,
    '3-4-2-1': 0,
  },
  '3-5-2': {
    '4-3-3': -1.2,
    '4-4-2': 1.4,
    '4-2-3-1': 0,
    '3-5-2': 0,
    '3-4-3': -1.4,
    '3-4-2-1': 1.3,
  },
  '3-4-3': {
    '4-3-3': 0,
    '4-4-2': -1.4,
    '4-2-3-1': -1.1,
    '3-5-2': 1.4,
    '3-4-3': 0,
    '3-4-2-1': -0.6,
  },
  '3-4-2-1': {
    '4-3-3': 1.2,
    '4-4-2': -1.3,
    '4-2-3-1': 0,
    '3-5-2': -1.3,
    '3-4-3': 0.6,
    '3-4-2-1': 0,
  },
};

export interface FormationMatchupResult extends MatchupEvaluation {
  possessionDelta: number;
}

export function evaluateFormationMatchup(
  myFormation: FormationId,
  oppFormation: FormationId,
): FormationMatchupResult {
  const delta = FORMATION_MATRIX[myFormation][oppFormation];

  // Subtle midfield possession modifier (e.g., 3-5-2 holds central numbers vs 4-3-3/4-4-2)
  let possessionDelta = 0;
  if (myFormation === '3-5-2' && (oppFormation === '4-3-3' || oppFormation === '4-4-2')) {
    possessionDelta = 3;
  } else if ((myFormation === '4-3-3' || myFormation === '4-4-2') && oppFormation === '3-5-2') {
    possessionDelta = -3;
  } else if (myFormation === '4-2-3-1' && oppFormation === '4-4-2') {
    possessionDelta = 3;
  } else if (myFormation === '4-4-2' && oppFormation === '4-2-3-1') {
    possessionDelta = -3;
  }

  if (delta >= 1.1) {
    return {
      delta,
      possessionDelta,
      verdict: 'advantage',
      label: `${myFormation} vs ${oppFormation} (포메이션 우세 +${delta.toFixed(1)})`,
    };
  }
  if (delta > 0) {
    return {
      delta,
      possessionDelta,
      verdict: 'slight_advantage',
      label: `${myFormation} vs ${oppFormation} (소폭 우세 +${delta.toFixed(1)})`,
    };
  }
  if (delta <= -1.1) {
    return {
      delta,
      possessionDelta,
      verdict: 'disadvantage',
      label: `${myFormation} vs ${oppFormation} (포메이션 취약 ${delta.toFixed(1)})`,
    };
  }
  if (delta < 0) {
    return {
      delta,
      possessionDelta,
      verdict: 'slight_disadvantage',
      label: `${myFormation} vs ${oppFormation} (소폭 열세 ${delta.toFixed(1)})`,
    };
  }
  return {
    delta: 0,
    possessionDelta,
    verdict: 'neutral',
    label: `${myFormation} vs ${oppFormation} (호각)`,
  };
}

export function getBestCounterTactic(oppTactic: TacticId): TacticId {
  switch (oppTactic) {
    case 'possession':
      return 'gegenpressing';
    case 'gegenpressing':
      return 'counter';
    case 'counter':
      return 'wingplay';
    case 'wingplay':
      return 'possession';
    case 'balanced':
    default:
      return 'possession';
  }
}

export function getBestCounterFormation(oppFormation: FormationId): FormationId {
  switch (oppFormation) {
    case '4-3-3':
      return '3-4-2-1';
    case '4-4-2':
      return '4-2-3-1';
    case '4-2-3-1':
      return '4-3-3';
    case '3-5-2':
      return '3-4-3';
    case '3-4-3':
      return '4-4-2';
    case '3-4-2-1':
      return '3-5-2';
  }
}

export function buildHalftimeTacticalHint(params: {
  userTactic: TacticId;
  oppTactic: TacticId;
  userFormation: FormationId;
  oppFormation: FormationId;
  userGoals: number;
  oppGoals: number;
  userXg: number;
  oppXg: number;
}): { hint: string; recommendedTactic: TacticId; recommendedFormation: FormationId } {
  const {
    userTactic,
    oppTactic,
    userFormation,
    oppFormation,
    userGoals,
    oppGoals,
    userXg,
    oppXg,
  } = params;

  const tMatch = evaluateTacticMatchup(userTactic, oppTactic);
  const fMatch = evaluateFormationMatchup(userFormation, oppFormation);
  const recommendedTactic = getBestCounterTactic(oppTactic);
  const recommendedFormation = getBestCounterFormation(oppFormation);

  if (tMatch.delta < 0) {
    return {
      hint: `상대의 [${TACTICS[oppTactic].name}] 전술에 우리 [${TACTICS[userTactic].name}] 전술이 밀리고 있습니다. 후반전에 [${TACTICS[recommendedTactic].name}]으로 전환하면 흐름을 뒤집을 수 있습니다!`,
      recommendedTactic,
      recommendedFormation,
    };
  }

  if (fMatch.delta < -0.8) {
    return {
      hint: `상대 ${oppFormation} 포메이션의 공간 공략에 노출되고 있습니다. ${recommendedFormation} 전환이나 벤치 투입으로 수비 간격을 조정해 보세요.`,
      recommendedTactic,
      recommendedFormation,
    };
  }

  if (userGoals < oppGoals && userXg >= oppXg - 0.15) {
    return {
      hint: `전반 경기력(xG ${userXg.toFixed(2)} vs ${oppXg.toFixed(2)})은 밀리지 않았으나 결정력이 아쉬웠습니다. 공격적인 전술(${TACTICS[recommendedTactic].name}) 또는 벤치 공격 자원 투입을 고려해 보세요.`,
      recommendedTactic,
      recommendedFormation,
    };
  }

  if (userGoals > oppGoals) {
    return {
      hint: `전반 리드를 잘 잡았습니다! 상대의 [${TACTICS[oppTactic].name}] 반격에 대비해 [${TACTICS[recommendedTactic].name}] 상성을 유지하거나 수비 안정을 다지세요.`,
      recommendedTactic,
      recommendedFormation,
    };
  }

  return {
    hint: `팽팽한 전반전이었습니다. 상대(${oppFormation} · ${TACTICS[oppTactic].name}) 상대로 [${TACTICS[recommendedTactic].name}] 전술이나 ${recommendedFormation} 포메이션으로 후반 승부수를 던져 보세요.`,
    recommendedTactic,
    recommendedFormation,
  };
}

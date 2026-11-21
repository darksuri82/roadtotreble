import { FORMATIONS } from '../data/formations';
import { PLAYSTYLES } from '../data/playstyles';
import type { FormationId, ManagerTraitId } from '../types/game';
import type { MatchEvent, TacticId } from '../types/league';
import type { Player, PlaystyleId } from '../types/player';
import { evaluatePositionFit } from './positionEngine';

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

/**
 * Playstyle matchup weights against each opponent tactic (authentic football principles):
 * - vs counter (로우블록): playmaker_10, deep_playmaker, poacher, complete_forward, inverted_winger
 * - vs gegenpressing (높은 라인·강압박): line_breaker, classic_winger, deep_playmaker, ball_playing_cb
 * - vs possession (티키타카): box_to_box, ball_winner, inverted_winger, line_breaker, classic_winger
 * - vs wingplay (측면 크로스): stopper_cb, ball_playing_cb, shot_stopper, sweeper_keeper, ball_winner
 * - vs balanced: all-around impact (complete_forward, box_to_box, playmaker_10)
 */
const STYLE_VS_OPP_TACTIC: Record<
  TacticId,
  Partial<Record<PlaystyleId, { att?: number; mid?: number; def?: number; label: string }>>
> = {
  counter: {
    playmaker_10: { att: 0.28, mid: 0.32, label: '밀집 수비 해체(플레이메이커)' },
    deep_playmaker: { mid: 0.28, att: 0.12, label: '로우블록 공략 배급(딥라잉)' },
    poacher: { att: 0.34, label: '박스 안 원터치 결정력(포처)' },
    complete_forward: { att: 0.30, label: '공중볼·타겟맨(완성형 FW)' },
    inverted_winger: { att: 0.28, mid: 0.12, label: '박스 밖 컷인·중거리(크랙)' },
    attacking_wingback: { att: 0.16, mid: 0.12, label: '측면 수적 우위(오버래핑)' },
  },
  gegenpressing: {
    line_breaker: { att: 0.38, label: '높은 라인 뒷공간 침투(라인브레이커)' },
    classic_winger: { att: 0.28, mid: 0.12, label: '측면 스피드 배후 돌파(클래식 윙어)' },
    deep_playmaker: { mid: 0.34, def: 0.16, label: '후방 탈압박 전환(딥라잉)' },
    ball_playing_cb: { def: 0.32, mid: 0.20, label: '압박 탈출 빌드업(빌드업 CB)' },
    sweeper_keeper: { def: 0.24, mid: 0.12, label: '압박 회피 롱킥(스위퍼 GK)' },
  },
  possession: {
    box_to_box: { mid: 0.34, def: 0.22, label: '왕성한 압박·활동량(박스투박스)' },
    ball_winner: { mid: 0.32, def: 0.30, label: '패스 길목 차단(볼위너)' },
    inverted_winger: { att: 0.28, label: '역습 한 방 크랙(인버티드 윙어)' },
    line_breaker: { att: 0.32, label: '점유율 배후 고속 역습(라인브레이커)' },
    classic_winger: { att: 0.24, label: '측면 역습 스피드스터(클래식 윙어)' },
  },
  wingplay: {
    stopper_cb: { def: 0.38, label: '제공권·대인방어 장악(파이터 CB)' },
    ball_playing_cb: { def: 0.22, label: '측면 커버·라인 조율(빌드업 CB)' },
    shot_stopper: { def: 0.36, label: '크로스·근거리 헤더 선방(선방형 GK)' },
    sweeper_keeper: { def: 0.28, label: '공중 크로스 장악력(스위퍼 GK)' },
    ball_winner: { def: 0.24, mid: 0.14, label: '측면 컷백·하프스페이스 차단(볼위너)' },
  },
  balanced: {
    complete_forward: { att: 0.20, label: '올라운드 공격(완성형 FW)' },
    box_to_box: { mid: 0.20, def: 0.10, label: '공수 밸런스(박스투박스)' },
    playmaker_10: { att: 0.16, mid: 0.18, label: '찬스 메이킹(플레이메이커)' },
  },
};

export interface PlayerStyleMatchupInfo {
  totalScore: number; // ~0 .. 1.2
  attScore: number;
  midScore: number;
  defScore: number;
  reasons: string[];
  isScoreStateFit: boolean;
}

export function getPlayerStyleMatchupScore(params: {
  player: Player;
  oppTactic: TacticId;
  scoreDiff?: number; // >0 leading, <0 chasing, 0 level
  isSecondHalf?: boolean;
}): PlayerStyleMatchupInfo {
  const { player, oppTactic, scoreDiff = 0, isSecondHalf = false } = params;
  const table = STYLE_VS_OPP_TACTIC[oppTactic];
  let attScore = 0;
  let midScore = 0;
  let defScore = 0;
  const reasons: string[] = [];
  let isScoreStateFit = false;

  for (const ps of player.playstyles) {
    const entry = table[ps];
    if (entry) {
      attScore += entry.att ?? 0;
      midScore += entry.mid ?? 0;
      defScore += entry.def ?? 0;
      reasons.push(entry.label);
    }
  }

  // Second-half score-state situational modifier
  if (isSecondHalf) {
    if (scoreDiff > 0) {
      // Protecting a lead: defensive solidity + high workrate shine
      if (
        player.playstyles.some((ps) =>
          ['stopper_cb', 'ball_winner', 'box_to_box', 'shot_stopper'].includes(ps),
        )
      ) {
        defScore += 0.24;
        midScore += 0.1;
        isScoreStateFit = true;
        reasons.push('리드 굳히기 수비·활동량 가산');
      }
      if ((player.stamina ?? 78) >= 84 && player.position !== 'GK') {
        defScore += 0.1;
        isScoreStateFit = true;
      }
    } else if (scoreDiff < 0) {
      // Chasing a goal: direct attackers, poachers, creators shine
      if (
        player.playstyles.some((ps) =>
          [
            'line_breaker',
            'poacher',
            'complete_forward',
            'inverted_winger',
            'playmaker_10',
          ].includes(ps),
        )
      ) {
        attScore += 0.28;
        midScore += 0.08;
        isScoreStateFit = true;
        reasons.push('추격전 공격 조커 가산');
      }
    }
  }

  return {
    totalScore: Math.round((attScore + midScore + defScore) * 100) / 100,
    attScore,
    midScore,
    defScore,
    reasons,
    isScoreStateFit,
  };
}

export interface PlaystyleTacticMatchupResult {
  attBonus: number;
  midBonus: number;
  defBonus: number;
  xgBonus: number;
  oppXgPenalty: number;
  matchedCount: number;
  highlights: string[];
}

/**
 * Aggregates starter playstyles against the opponent's tactic & live match score state.
 * Carefully bounded so tactical/style counters feel impactful without destabilizing 20-season calibration.
 */
export function evaluatePlaystyleTacticMatchup(params: {
  starters: Player[];
  oppTactic: TacticId;
  scoreDiff?: number;
  isSecondHalf?: boolean;
}): PlaystyleTacticMatchupResult {
  const { starters, oppTactic, scoreDiff = 0, isSecondHalf = false } = params;
  let attSum = 0;
  let midSum = 0;
  let defSum = 0;
  let matchedCount = 0;
  const highlightSet = new Set<string>();

  for (const player of starters) {
    const info = getPlayerStyleMatchupScore({
      player,
      oppTactic,
      scoreDiff,
      isSecondHalf,
    });
    if (info.totalScore > 0) {
      matchedCount += 1;
      attSum += info.attScore;
      midSum += info.midScore;
      defSum += info.defScore;
      for (const r of info.reasons) {
        if (highlightSet.size < 4) highlightSet.add(r);
      }
    }
  }

  // Center around a typical 11-player squad baseline (~0.72 per line) so random/mismatched
  // lineups stay neutral (~0) while intentional playstyle counters earn a meaningful tactical edge.
  const clampVal = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const attBonus = Math.round(clampVal((attSum - 0.72) * 0.65, -0.45, 1.1) * 100) / 100;
  const midBonus = Math.round(clampVal((midSum - 0.66) * 0.65, -0.45, 1.0) * 100) / 100;
  const defBonus = Math.round(clampVal((defSum - 0.66) * 0.68, -0.45, 1.1) * 100) / 100;

  let xgBonus = attSum >= 1.35 ? 0.08 : attSum >= 1.0 ? 0.04 : 0;
  let oppXgPenalty = defSum >= 1.25 ? 0.08 : defSum >= 0.92 ? 0.04 : 0;

  if (isSecondHalf && scoreDiff < 0 && attSum >= 0.95) {
    xgBonus += 0.05;
  } else if (isSecondHalf && scoreDiff > 0 && defSum >= 0.9) {
    oppXgPenalty += 0.05;
  }

  return {
    attBonus,
    midBonus,
    defBonus,
    xgBonus: Math.round(xgBonus * 100) / 100,
    oppXgPenalty: Math.round(oppXgPenalty * 100) / 100,
    matchedCount,
    highlights: Array.from(highlightSet),
  };
}

export interface HalftimeSubRecommendation {
  id: string;
  starterIndex: number;
  benchIndex: number;
  slotLabel: string;
  outPlayer: Player;
  inPlayer: Player;
  outStaminaPct: number;
  outFirstHalfRating: number;
  badge: string;
  reason: string;
  priorityScore: number;
}

function estimateFirstHalfStarterRating(
  player: Player,
  events: MatchEvent[],
  staminaPct: number,
  userGoals: number,
  oppGoals: number,
): number {
  let rating = 6.5;
  if (userGoals > oppGoals) rating += 0.25;
  else if (userGoals < oppGoals) rating -= 0.25;

  for (const ev of events) {
    if (ev.type === 'goal' && ev.scorerId === player.id) rating += 1.0;
    if (ev.type === 'goal' && ev.assistId === player.id) rating += 0.6;
    if (ev.type === 'save' && ev.scorerId === player.id) rating += 0.5;
    if (ev.type === 'yellow' && ev.scorerId === player.id) rating -= 0.35;
  }

  if (staminaPct < 62) rating -= 0.35;
  else if (staminaPct < 70) rating -= 0.15;

  return Math.round(Math.max(5.0, Math.min(9.5, rating)) * 10) / 10;
}

function buildCoachRecommendationReason(params: {
  outPlayer: Player;
  inPlayer: Player;
  outStaminaPct: number;
  outRating: number;
  oppTactic: TacticId;
  scoreDiff: number;
  styleReasons: string[];
}): { badge: string; reason: string } {
  const {
    outPlayer,
    inPlayer,
    outStaminaPct,
    outRating,
    oppTactic,
    scoreDiff,
    styleReasons,
  } = params;

  const inPrimaryStyle = inPlayer.playstyles[0]
    ? PLAYSTYLES[inPlayer.playstyles[0]]?.name
    : null;
  const fatigueNote =
    outStaminaPct <= 68
      ? `체력이 떨어진 ${outPlayer.name}(${outStaminaPct}%)`
      : outRating <= 6.2
        ? `전반 영향력이 아쉬웠던 ${outPlayer.name}(평점 ${outRating.toFixed(1)})`
        : `${outPlayer.name}(${outStaminaPct}%)`;

  if (
    oppTactic === 'gegenpressing' &&
    inPlayer.playstyles.some((ps) =>
      ['line_breaker', 'classic_winger', 'deep_playmaker', 'ball_playing_cb'].includes(ps),
    )
  ) {
    return {
      badge: '뒷공간·탈압박 상성',
      reason: `상대 게겐프레싱 라인이 높습니다. ${fatigueNote} 대신 ${inPrimaryStyle ?? '신선한'} ${inPlayer.name}을(를) 투입해 배후 공간과 탈압박을 노리세요.`,
    };
  }

  if (
    oppTactic === 'counter' &&
    inPlayer.playstyles.some((ps) =>
      ['playmaker_10', 'deep_playmaker', 'poacher', 'complete_forward', 'inverted_winger'].includes(ps),
    )
  ) {
    return {
      badge: '로우블록 해체',
      reason: `상대가 깊게 내려앉은 선수비 후역습입니다. ${fatigueNote} 대신 ${inPrimaryStyle ?? '공격형'} ${inPlayer.name}을(를) 투입해 좁은 공간과 박스 안을 공략하세요.`,
    };
  }

  if (
    oppTactic === 'possession' &&
    inPlayer.playstyles.some((ps) =>
      ['box_to_box', 'ball_winner', 'inverted_winger', 'line_breaker'].includes(ps),
    )
  ) {
    return {
      badge: '압박·역습 카운터',
      reason: `상대 점유율 축구를 끊어야 합니다. ${fatigueNote} 대신 ${inPrimaryStyle ?? '활동량 좋은'} ${inPlayer.name}을(를) 투입해 중원 압박과 역습 속도를 끌어올리세요.`,
    };
  }

  if (
    oppTactic === 'wingplay' &&
    inPlayer.playstyles.some((ps) =>
      ['stopper_cb', 'ball_playing_cb', 'ball_winner', 'shot_stopper'].includes(ps),
    )
  ) {
    return {
      badge: '측면·크로스 방어',
      reason: `상대 측면 공략과 크로스가 거셉니다. ${fatigueNote} 대신 ${inPrimaryStyle ?? '수비 안정형'} ${inPlayer.name}으로 공중볼과 대인 수비를 보강하세요.`,
    };
  }

  if (scoreDiff < 0) {
    return {
      badge: '후반 추격 조커',
      reason: `스코어를 뒤집어야 하는 추격 상황입니다! ${fatigueNote} 대신 신선한 ${inPrimaryStyle ?? '공격 조커'} ${inPlayer.name}(체력 100%)을 투입해 득점 찬스를 늘리세요.`,
    };
  }

  if (scoreDiff > 0) {
    return {
      badge: '리드 굳히기',
      reason: `전반 리드를 끝까지 지켜야 합니다. ${fatigueNote} 대신 활동량과 안정감이 좋은 ${inPlayer.name}(체력 100%)을 투입해 후반 실점을 차단하세요.`,
    };
  }

  const extra = styleReasons[0] ? ` (${styleReasons[0]})` : '';
  return {
    badge: '체력·활력 보강',
    reason: `후반 승부처를 앞두고 ${fatigueNote} 대신 체력 100%의 ${inPlayer.name}${extra}을(를) 투입하면 후반 경기력이 상승합니다.`,
  };
}

/**
 * Generates 1-2 actionable Halftime Assistant Coach substitution recommendations
 * based on opponent tactic, 1st-half score, live stamina, 1st-half rating, and bench style matchup.
 */
export function buildHalftimeCoachRecommendations(params: {
  starters: (Player | null)[];
  bench: (Player | null)[];
  formation: FormationId;
  oppTactic: TacticId;
  userGoals: number;
  oppGoals: number;
  staminaByPlayerId: Record<string, number>;
  firstHalfEvents: MatchEvent[];
  disabledBenchIds: Set<string>;
  managerTraitId: ManagerTraitId | null;
  maxRecommendations?: number;
}): HalftimeSubRecommendation[] {
  const {
    starters,
    bench,
    formation,
    oppTactic,
    userGoals,
    oppGoals,
    staminaByPlayerId,
    firstHalfEvents,
    disabledBenchIds,
    managerTraitId,
    maxRecommendations = 2,
  } = params;

  const slots = FORMATIONS[formation].slots;
  const scoreDiff = userGoals - oppGoals;

  interface CandidatePair {
    starterIndex: number;
    benchIndex: number;
    outPlayer: Player;
    inPlayer: Player;
    outStaminaPct: number;
    outRating: number;
    slotLabel: string;
    priorityScore: number;
    styleReasons: string[];
  }

  const candidates: CandidatePair[] = [];

  for (let sIdx = 0; sIdx < starters.length; sIdx += 1) {
    const outP = starters[sIdx];
    const slot = slots[sIdx];
    if (!outP || !slot) continue;
    // Normally avoid recommending GK swap unless GK is severely mismatched or fatigued
    const isGkSlot = slot.subPosition === 'GK';

    const outStaminaPct = staminaByPlayerId[outP.id] ?? 76;
    const outFit = evaluatePositionFit(outP, slot.subPosition, managerTraitId);
    const outRating = estimateFirstHalfStarterRating(
      outP,
      firstHalfEvents,
      outStaminaPct,
      userGoals,
      oppGoals,
    );
    const outMatch = getPlayerStyleMatchupScore({
      player: outP,
      oppTactic,
      scoreDiff,
      isSecondHalf: true,
    });

    for (let bIdx = 0; bIdx < bench.length; bIdx += 1) {
      const inP = bench[bIdx];
      if (!inP || disabledBenchIds.has(inP.id)) continue;
      if (isGkSlot && inP.position !== 'GK') continue;
      if (!isGkSlot && inP.position === 'GK') continue;

      const inFit = evaluatePositionFit(inP, slot.subPosition, managerTraitId);
      if (inFit.fit === 'severe') continue;

      const inMatch = getPlayerStyleMatchupScore({
        player: inP,
        oppTactic,
        scoreDiff,
        isSecondHalf: true,
      });

      const effectiveOvrDelta = inFit.effectiveOvr - outFit.effectiveOvr;
      // Don't recommend huge OVR downgrades unless starter is very tired & bench is a strong style counter
      if (effectiveOvrDelta < -7) continue;

      const staminaGain = Math.max(0, 100 - outStaminaPct);
      const fatigueUrgency =
        outStaminaPct < 62 ? 12 : outStaminaPct < 70 ? 7.5 : outStaminaPct < 76 ? 3.5 : 0.8;
      const ratingPenaltyBonus = outRating <= 6.2 ? 3.5 : outRating >= 7.6 ? -5.0 : 0;
      const styleDelta = (inMatch.totalScore - outMatch.totalScore) * 14;
      const scoreRoleBonus =
        scoreDiff < 0 && (slot.position === 'FW' || slot.position === 'MF')
          ? 2.8
          : scoreDiff > 0 && (slot.position === 'DF' || slot.position === 'MF')
            ? 2.4
            : 0;
      const gkDiscourage = isGkSlot ? -14 : 0;

      const priorityScore =
        effectiveOvrDelta * 1.45 +
        staminaGain * 0.22 +
        fatigueUrgency +
        ratingPenaltyBonus +
        styleDelta +
        scoreRoleBonus +
        gkDiscourage;

      if (priorityScore > 2.0) {
        candidates.push({
          starterIndex: sIdx,
          benchIndex: bIdx,
          outPlayer: outP,
          inPlayer: inP,
          outStaminaPct,
          outRating,
          slotLabel: slot.label,
          priorityScore,
          styleReasons: inMatch.reasons,
        });
      }
    }
  }

  candidates.sort((a, b) => b.priorityScore - a.priorityScore);

  const picked: HalftimeSubRecommendation[] = [];
  const usedStarters = new Set<number>();
  const usedBench = new Set<number>();

  for (const cand of candidates) {
    if (picked.length >= maxRecommendations) break;
    if (usedStarters.has(cand.starterIndex) || usedBench.has(cand.benchIndex)) continue;
    usedStarters.add(cand.starterIndex);
    usedBench.add(cand.benchIndex);

    const { badge, reason } = buildCoachRecommendationReason({
      outPlayer: cand.outPlayer,
      inPlayer: cand.inPlayer,
      outStaminaPct: cand.outStaminaPct,
      outRating: cand.outRating,
      oppTactic,
      scoreDiff,
      styleReasons: cand.styleReasons,
    });

    picked.push({
      id: `ht-rec-${cand.starterIndex}-${cand.benchIndex}`,
      starterIndex: cand.starterIndex,
      benchIndex: cand.benchIndex,
      slotLabel: cand.slotLabel,
      outPlayer: cand.outPlayer,
      inPlayer: cand.inPlayer,
      outStaminaPct: cand.outStaminaPct,
      outFirstHalfRating: cand.outRating,
      badge,
      reason,
      priorityScore: Math.round(cand.priorityScore * 10) / 10,
    });
  }

  return picked;
}

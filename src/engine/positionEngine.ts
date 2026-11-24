import type { ManagerTraitId } from '../types/game';
import type {
  Player,
  Position,
  PositionFitResult,
  SubPosition,
} from '../types/player';

const COMPATIBLE_PAIRS: Record<SubPosition, SubPosition[]> = {
  GK: [],
  LB: ['LWB'],
  LWB: ['LB'],
  RB: ['RWB'],
  RWB: ['RB'],
  CB: [],
  CDM: [],
  CM: [],
  CAM: [],
  LM: ['LW'],
  LW: ['LM'],
  RM: ['RW'],
  RW: ['RM'],
  ST: [],
};

export function getPrimaryPosition(
  player: Pick<Player, 'mainPositions'>,
): SubPosition {
  return player.mainPositions[0] ?? 'CM';
}

export function formatMainPositions(
  player: Pick<Player, 'mainPositions'>,
): string {
  return player.mainPositions.join(' · ');
}

export function getLineForSubPosition(sub: SubPosition): Position {
  if (sub === 'GK') return 'GK';
  if (
    sub === 'CB' ||
    sub === 'LB' ||
    sub === 'RB' ||
    sub === 'LWB' ||
    sub === 'RWB'
  ) {
    return 'DF';
  }
  if (
    sub === 'CDM' ||
    sub === 'CM' ||
    sub === 'CAM' ||
    sub === 'LM' ||
    sub === 'RM'
  ) {
    return 'MF';
  }
  return 'FW';
}

export function isCompatibleSubPosition(
  a: SubPosition,
  b: SubPosition,
): boolean {
  return COMPATIBLE_PAIRS[a]?.includes(b) ?? false;
}

/**
 * Evaluates a player's fit for a specific formation slot subPosition.
 * - Any position in `mainPositions`: 0 penalty (100%)
 * - `secondaryPositions` or compatible pair (LB<->LWB, RB<->RWB, LW<->LM, RW<->RM): -3 OVR (0 with Total Football)
 * - Same line out-of-position (e.g. CB->LB, CDM->CAM, ST->LW): -6 OVR (-2 with Total Football)
 * - Different line: -15 OVR (-8 with Total Football for outfielders; GK mismatch stays -15)
 */
export function evaluatePositionFit(
  player: Pick<Player, 'ovr' | 'mainPositions' | 'secondaryPositions'>,
  slotSubPosition: SubPosition,
  managerTraitId?: ManagerTraitId | null,
  _alternateSubPositions?: SubPosition[],
): PositionFitResult {
  void _alternateSubPositions;
  const isTotalFootball = managerTraitId === 'total_football';

  if (player.mainPositions.includes(slotSubPosition)) {
    return {
      fit: 'main',
      penalty: 0,
      effectiveOvr: player.ovr,
      label: '주포지션',
    };
  }

  const isSecondaryOrCompat =
    player.secondaryPositions.includes(slotSubPosition) ||
    player.mainPositions.some((mp) =>
      isCompatibleSubPosition(mp, slotSubPosition),
    ) ||
    player.secondaryPositions.some((sp) =>
      isCompatibleSubPosition(sp, slotSubPosition),
    );

  if (isSecondaryOrCompat) {
    const penalty = isTotalFootball ? 0 : -3;
    return {
      fit: isTotalFootball ? 'main' : 'secondary',
      penalty,
      effectiveOvr: Math.max(40, player.ovr + penalty),
      label: isTotalFootball ? '부포지션 (토탈풋볼 0)' : '부포지션',
    };
  }

  const targetLine = getLineForSubPosition(slotSubPosition);
  const sharesLine =
    targetLine !== 'GK' &&
    player.mainPositions.some((mp) => {
      const mpLine = getLineForSubPosition(mp);
      return mpLine !== 'GK' && mpLine === targetLine;
    });

  if (sharesLine) {
    const penalty = isTotalFootball ? -2 : -6;
    return {
      fit: 'out_of_pos',
      penalty,
      effectiveOvr: Math.max(40, player.ovr + penalty),
      label: isTotalFootball ? '동일 라인 (토탈풋볼 완화)' : '동일 라인 비적합',
    };
  }

  const isGkMismatch =
    slotSubPosition === 'GK' || player.mainPositions.includes('GK');
  const severePenalty = isTotalFootball && !isGkMismatch ? -8 : -15;
  return {
    fit: 'severe',
    penalty: severePenalty,
    effectiveOvr: Math.max(40, player.ovr + severePenalty),
    label: isTotalFootball && !isGkMismatch ? '타 라인 (토탈풋볼 완화)' : '포지션 불일치',
  };
}

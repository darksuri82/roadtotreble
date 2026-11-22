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
 * - `secondaryPositions` or compatible pair (LB<->LWB, RB<->RWB, LW<->LM, RW<->RM): -3 OVR (-1 with Total Football)
 * - Same line out-of-position (e.g. CB->LB, CDM->CAM, ST->LW): -6 OVR (-3 with Total Football)
 * - Different line or GK mismatch: -15 OVR
 */
export function evaluatePositionFit(
  player: Pick<Player, 'ovr' | 'mainPositions' | 'secondaryPositions'>,
  slotSubPosition: SubPosition,
  managerTraitId?: ManagerTraitId | null,
  alternateSubPositions?: SubPosition[],
): PositionFitResult {
  const isTotalFootball = managerTraitId === 'total_football';
  const acceptedMains: SubPosition[] = alternateSubPositions
    ? [slotSubPosition, ...alternateSubPositions]
    : [slotSubPosition];

  if (acceptedMains.some((sp) => player.mainPositions.includes(sp))) {
    return {
      fit: 'main',
      penalty: 0,
      effectiveOvr: player.ovr,
      label: '주포지션',
    };
  }

  const isSecondaryOrCompat = acceptedMains.some(
    (target) =>
      player.secondaryPositions.includes(target) ||
      player.mainPositions.some((mp) => isCompatibleSubPosition(mp, target)) ||
      player.secondaryPositions.some((sp) => isCompatibleSubPosition(sp, target)),
  );

  if (isSecondaryOrCompat) {
    const penalty = isTotalFootball ? -1 : -3;
    return {
      fit: 'secondary',
      penalty,
      effectiveOvr: Math.max(40, player.ovr + penalty),
      label: isTotalFootball ? '부포지션 (토탈풋볼 완화)' : '부포지션',
    };
  }

  const acceptedLines = new Set(
    acceptedMains.map((sp) => getLineForSubPosition(sp)),
  );
  const sharesLine =
    !acceptedLines.has('GK') &&
    player.mainPositions.some((mp) => {
      const mpLine = getLineForSubPosition(mp);
      return mpLine !== 'GK' && acceptedLines.has(mpLine);
    });

  if (sharesLine) {
    const penalty = isTotalFootball ? -3 : -6;
    return {
      fit: 'out_of_pos',
      penalty,
      effectiveOvr: Math.max(40, player.ovr + penalty),
      label: '동일 라인 비적합',
    };
  }

  return {
    fit: 'severe',
    penalty: -15,
    effectiveOvr: Math.max(40, player.ovr - 15),
    label: '포지션 불일치',
  };
}

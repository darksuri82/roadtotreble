import { FORMATIONS } from '../data/formations';
import type { FormationId } from '../types/game';
import type { TacticId } from '../types/league';

export interface TacticalVec2 {
  x: number;
  y: number;
}

export interface TacticalMovementInput {
  slotIndex: number;
  base: TacticalVec2;
  isHome: boolean;
  hasBall: boolean;
  tactic: TacticId;
  formation: FormationId;
  attackPhase: number; // 0=buildup, 1=midfield, 2=final-third, 3=box-probe
  ball: TacticalVec2;
  simClock: number;
}

/**
 * Computes realistic modern football off-ball tactical offsets for each player (slotIndex 0..10)
 * based on team tactic, possession state, attack phase, and ball position:
 * - possession: GK steps up, CDM drops between CBs, inverted fullbacks tuck into half-space,
 *   8s/wingers create passing triangles.
 * - gegenpressing: aggressive high defensive line + 3-man pressing trap toward ball when defending.
 * - counter: compact low defensive block when defending + rapid vertical runs into space on transition.
 * - wingplay: fullback touchline overlaps + far-post box runs + wide stretching.
 * - balanced: structured mid-block with adaptive half-space support.
 */
export function computeTacticalPlayerOffset(
  input: TacticalMovementInput,
): TacticalVec2 {
  const {
    slotIndex,
    base,
    isHome,
    hasBall,
    tactic,
    formation,
    attackPhase,
    ball,
    simClock,
  } = input;

  const dir = isHome ? 1 : -1; // +1 attacks right, -1 attacks left
  const slots = (FORMATIONS[formation] ?? FORMATIONS['4-3-3']).slots;
  const sub = slots[slotIndex]?.subPosition ?? 'CM';
  const isWideLeft = base.y < 0.35;
  const isWideRight = base.y > 0.65;
  const sideSign = isWideLeft ? -1 : isWideRight ? 1 : 0;

  let dx = 0;
  let dy = 0;

  // Goalkeeper positioning (sweeper behavior in possession / high press)
  if (slotIndex === 0) {
    if (hasBall && (tactic === 'possession' || tactic === 'gegenpressing')) {
      dx += dir * 0.032; // GK steps up to act as 3rd buildup option
    } else if (!hasBall && tactic === 'gegenpressing') {
      dx += dir * 0.024; // Sweeper keeper covers space behind high line
    }
    return { x: dx, y: dy };
  }

  const isCB = sub === 'CB';
  const isFB = sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB';
  const isCDM = sub === 'CDM';
  const isCM = sub === 'CM';
  const isCAM = sub === 'CAM';
  const isWinger = sub === 'LW' || sub === 'RW' || sub === 'LM' || sub === 'RM';
  const isST = sub === 'ST';

  if (hasBall) {
    // =========================================================================
    // IN-POSSESSION BUILDUP & OFF-THE-BALL ATTACKING STRUCTURE
    // =========================================================================
    if (tactic === 'possession') {
      // Tiki-taka: CBs split wide, CDM drops into pivot, FBs invert into half-spaces,
      // 8s/CAM occupy pockets between lines, false-9/ST drops slightly to link triangles
      if (isCB) {
        dx += dir * (attackPhase >= 1 ? 0.035 : -0.01);
        dy += (base.y < 0.5 ? -0.045 : 0.045);
      } else if (isCDM) {
        dx += dir * (attackPhase === 0 ? -0.03 : 0.02);
        dy += (ball.y - base.y) * 0.12;
      } else if (isFB) {
        // Inverted fullback tucking into central midfield half-space
        dx += dir * (attackPhase >= 1 ? 0.065 : 0.025);
        dy += -sideSign * 0.11;
      } else if (isCM || isCAM) {
        // Half-space pocket triangles
        dx += dir * (0.04 + Math.sin(simClock * 1.6 + slotIndex) * 0.025);
        dy += Math.cos(simClock * 1.3 + slotIndex) * 0.045;
      } else if (isWinger) {
        // Hold width to stretch the defense, then dart inward in final third
        dx += dir * (attackPhase >= 2 ? 0.055 : 0.025);
        dy += attackPhase >= 2 ? -sideSign * 0.05 : sideSign * 0.03;
      } else if (isST) {
        // False-9 drop to receive between lines during buildup, then attack box
        dx += dir * (attackPhase <= 1 ? -0.035 : 0.055);
        dy += Math.sin(simClock * 1.4) * 0.04;
      }
    } else if (tactic === 'wingplay') {
      // Aggressive fullback overlaps + wide touchline wingers + box crashers
      if (isFB) {
        dx += dir * (attackPhase >= 1 ? 0.11 : 0.045);
        dy += sideSign * 0.045; // Hug touchline on overlap
      } else if (isWinger) {
        // Winger stretches wide in phase 1, cuts into half-space as FB overlaps in phase 2+
        dx += dir * 0.065;
        dy += attackPhase >= 2 ? -sideSign * 0.065 : sideSign * 0.035;
      } else if (isST) {
        // Attack penalty spot / far-post for aerial crosses
        dx += dir * (attackPhase >= 2 ? 0.08 : 0.03);
        dy += Math.sin(simClock * 1.8 + slotIndex) * 0.05;
      } else if (isCM || isCAM) {
        dx += dir * (attackPhase >= 2 ? 0.055 : 0.02);
      }
    } else if (tactic === 'counter') {
      // Explosive vertical sprints into space behind opposition back line
      if (isST || isWinger) {
        dx += dir * (attackPhase >= 1 ? 0.105 : 0.055);
        dy += -sideSign * 0.03; // Diagonal channel run toward goal
      } else if (isCAM || isCM) {
        dx += dir * (attackPhase >= 1 ? 0.06 : 0.01);
      } else if (isCB || isFB) {
        // Rest defense stays cautious against counter-counters
        dx += -dir * 0.025;
      }
    } else if (tactic === 'gegenpressing') {
      // Push entire team high to compress the pitch & swarm second balls
      if (isCB || isFB) {
        dx += dir * 0.075;
      } else if (isCDM || isCM || isCAM) {
        dx += dir * 0.065;
        dy += (ball.y - base.y) * 0.15;
      } else {
        dx += dir * 0.075;
      }
    } else {
      // Balanced: clean positional support
      if (isFB && attackPhase >= 2) {
        dx += dir * 0.045;
      } else if (isST && attackPhase >= 2) {
        dx += dir * 0.04;
      }
    }
  } else {
    // =========================================================================
    // OUT-OF-POSSESSION DEFENSIVE ORGANIZATION
    // =========================================================================
    if (tactic === 'gegenpressing') {
      // High line + intense 3-man ball-oriented pressing trap
      const distToBall = Math.hypot(base.x - ball.x, base.y - ball.y);
      if (distToBall < 0.34) {
        // Trigger pressing trap toward ball carrier
        dx += (ball.x - base.x) * 0.28;
        dy += (ball.y - base.y) * 0.28;
      } else {
        // Push line high & shift horizontally toward ball side
        dx += dir * 0.055;
        dy += (ball.y - 0.5) * 0.16;
      }
    } else if (tactic === 'counter') {
      // Compact low 4-4-2 / 5-4-1 defensive block protecting central zones
      if (isST) {
        // Stay poised near halfway line as counter outlet
        dx += -dir * 0.035;
      } else {
        dx += -dir * 0.075;
        // Pinch tightly toward center (protect half-spaces & central corridor)
        dy += (0.5 - base.y) * 0.18 + (ball.y - 0.5) * 0.12;
      }
    } else if (tactic === 'possession') {
      // Mid-high counter-press block with horizontal compactness
      dx += dir * 0.015;
      dy += (ball.y - 0.5) * 0.14;
    } else if (tactic === 'wingplay') {
      // Mid-block forcing play wide while fullbacks guard flanks
      dx += -dir * 0.02;
      dy += (ball.y - 0.5) * 0.12;
    } else {
      // Balanced compact mid-block
      dx += -dir * 0.025;
      dy += (0.5 - base.y) * 0.08 + (ball.y - 0.5) * 0.10;
    }
  }

  return { x: dx, y: dy };
}

/**
 * Returns the next carrier index & tactical pass delay according to team tactic.
 */
export function pickTacticalPassNext(params: {
  tactic: TacticId;
  attackPhase: number;
  carrierIdx: number;
  activeBase: TacticalVec2[];
}): { nextCarrierIdx: number; passDelay: number } {
  const { tactic, attackPhase, carrierIdx, activeBase } = params;

  // Possession occasionally recycles through GK (slot 0) during deep buildup
  const pool =
    attackPhase === 0
      ? tactic === 'possession'
        ? [0, 1, 2, 3, 4, 5]
        : [1, 2, 3, 4]
      : attackPhase === 1
        ? [4, 5, 6, 7]
        : [7, 8, 9, 10];

  let chosen = pool[Math.floor(Math.random() * pool.length)];

  if (tactic === 'wingplay' && attackPhase >= 1) {
    const wideSorted = [...pool].sort(
      (a, b) =>
        Math.abs(activeBase[b].y - 0.5) - Math.abs(activeBase[a].y - 0.5),
    );
    chosen =
      Math.random() < 0.76
        ? wideSorted[0]
        : wideSorted[Math.min(1, wideSorted.length - 1)];
  } else if (tactic === 'possession') {
    // Prefer nearest triangular passing partner
    const cur = activeBase[carrierIdx] ?? { x: 0.5, y: 0.5 };
    const nearSorted = [...pool]
      .filter((idx) => idx !== carrierIdx)
      .sort(
        (a, b) =>
          Math.hypot(activeBase[a].x - cur.x, activeBase[a].y - cur.y) -
          Math.hypot(activeBase[b].x - cur.x, activeBase[b].y - cur.y),
      );
    if (nearSorted.length > 0) {
      chosen =
        Math.random() < 0.72
          ? nearSorted[0]
          : nearSorted[Math.min(1, nearSorted.length - 1)];
    }
  } else if (tactic === 'counter' && attackPhase >= 1) {
    // Launch direct vertical ball to most advanced runner
    const fwdSorted = [...pool].sort((a, b) => b - a);
    chosen = fwdSorted[Math.floor(Math.random() * Math.min(2, fwdSorted.length))];
  }

  if (chosen === carrierIdx) {
    chosen = pool[(pool.indexOf(chosen) + 1) % pool.length];
  }

  const passDelay =
    tactic === 'counter' || tactic === 'gegenpressing'
      ? 0.38
      : tactic === 'possession'
        ? 0.44 // Crisp tiki-taka tempo
        : 0.48;

  return { nextCarrierIdx: chosen, passDelay };
}

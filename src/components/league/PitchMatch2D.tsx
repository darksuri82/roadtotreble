import { useEffect, useRef } from 'react';
import { FORMATIONS } from '../../data/formations';
import {
  computeTacticalPlayerOffset,
  pickTacticalPassNext,
} from '../../engine/tacticalMovement';
import type { FormationId, ManagerTraitId } from '../../types/game';
import type {
  AttackRouteId,
  Club,
  HighlightOutcomeType,
  HighlightPatternId,
  MatchEvent,
  ShotAngleType,
  TacticId,
} from '../../types/league';

export interface DramaticHighlightPayload {
  key: string;
  event: MatchEvent;
  revealed: boolean;
}

interface PitchMatch2DProps {
  homeClub: Club;
  awayClub: Club;
  homeFormation: FormationId;
  awayFormation: FormationId;
  minute: number;
  phase: 'first_half' | 'halftime' | 'second_half';
  isFullTime: boolean;
  speed: 1 | 2 | 4;
  homePossession: number;
  homeShots?: number;
  awayShots?: number;
  homeXg?: number;
  awayXg?: number;
  homeTactic?: TacticId;
  awayTactic?: TacticId;
  homeManagerTraitId?: ManagerTraitId | null;
  awayManagerTraitId?: ManagerTraitId | null;
  dramaticEvent: DramaticHighlightPayload | null;
}

interface Vec2 {
  x: number;
  y: number;
}

interface ActiveSequence {
  key: string;
  pattern: HighlightPatternId;
  attackRoute?: AttackRouteId;
  dribbleBeatCount?: number;
  outcome: HighlightOutcomeType;
  isHomeAttack: boolean;
  flankSide: 1 | -1; // -1 = top flank, +1 = bottom flank
  startTime: number;
  durationMs: number;
  attackerIdx: number;
  passerIdx: number;
  targetY: number;
  shotAngle: ShotAngleType;
  pkDirection: 'left' | 'center' | 'right';
  reboundOrigin: 'save' | 'woodwork' | 'blocked';
  scorerName: string;
  assistName?: string;
  minute: number;
  teamShortName: string;
}

const PATTERN_BADGE_LABELS: Record<HighlightPatternId, string> = {
  wing_cross_header: '측면 크로스 & 헤더',
  cutback_finish: '엔드라인 컷백',
  through_ball_1v1: '스루패스 1대1 침투',
  cut_inside_curler: '컷인 감아차기',
  corner_kick: '코너킥 세트피스',
  direct_free_kick: '직접 프리킥',
  high_press_counter: '전방 압박 고속 역습',
  u_buildup_switch: 'U자 빌드업 · 반대전환',
  rebound_finish: '세컨찬스 리바운드',
  penalty_kick: '페널티킥 (PK)',
};

const ROUTE_BADGE_LABELS: Partial<Record<AttackRouteId, string>> = {
  solo_dribble: '원맨 드리블 쇼',
  long_range_cannon: '중거리 대포알 슛',
  tiki_taka_triangle: '티키타카 삼각 연계',
  low_block_counter: '선수비 후역습 롱볼',
};

const ALL_PATTERNS: HighlightPatternId[] = [
  'wing_cross_header',
  'cutback_finish',
  'through_ball_1v1',
  'cut_inside_curler',
  'corner_kick',
  'direct_free_kick',
  'high_press_counter',
  'u_buildup_switch',
  'rebound_finish',
  'penalty_kick',
];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return [148, 163, 184];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function colorDistance(hexA: string, hexB: string): number {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

function getContrastText(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0f172a' : '#f8fafc';
}

function buildHorizontalFormation(
  formationId: FormationId,
  isHome: boolean,
): Vec2[] {
  const slots = (FORMATIONS[formationId] ?? FORMATIONS['4-3-3']).slots;
  return slots.map((slot) => {
    const depth = Math.max(0, Math.min(1, (92 - slot.y) / 80));
    const nx = isHome ? 0.065 + depth * 0.42 : 0.935 - depth * 0.42;
    const ny = isHome
      ? 0.08 + (slot.x / 100) * 0.84
      : 0.92 - (slot.x / 100) * 0.84;
    return { x: nx, y: ny };
  });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function quadBezier(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

// Mirror x coordinate cleanly for home (attack right -> 1.0) vs away (attack left -> 0.0)
function atkX(isHome: boolean, homeCoord: number): number {
  return isHome ? homeCoord : 1 - homeCoord;
}

// Fixed slow-motion dramatic sequence length (ms), independent of 1x/2x/4x speed
export const DRAMATIC_REVEAL_MS = 1150;
export const DRAMATIC_TOTAL_MS = 2050;

export function PitchMatch2D({
  homeClub,
  awayClub,
  homeFormation,
  awayFormation,
  minute,
  phase,
  isFullTime,
  speed,
  homePossession,
  homeShots = 0,
  awayShots = 0,
  homeXg = 0,
  awayXg = 0,
  homeTactic = 'balanced',
  awayTactic = 'balanced',
  homeManagerTraitId = null,
  awayManagerTraitId = null,
  dramaticEvent,
}: PitchMatch2DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const propsRef = useRef({
    homeClub,
    awayClub,
    homeFormation,
    awayFormation,
    minute,
    phase,
    isFullTime,
    speed,
    homePossession,
    homeShots,
    awayShots,
    homeXg,
    awayXg,
    homeTactic,
    awayTactic,
    homeManagerTraitId,
    awayManagerTraitId,
  });

  useEffect(() => {
    propsRef.current = {
      homeClub,
      awayClub,
      homeFormation,
      awayFormation,
      minute,
      phase,
      isFullTime,
      speed,
      homePossession,
      homeShots,
      awayShots,
      homeXg,
      awayXg,
      homeTactic,
      awayTactic,
      homeManagerTraitId,
      awayManagerTraitId,
    };
  }, [
    homeClub,
    awayClub,
    homeFormation,
    awayFormation,
    minute,
    phase,
    isFullTime,
    speed,
    homePossession,
    homeShots,
    awayShots,
    homeXg,
    awayXg,
    homeTactic,
    awayTactic,
    homeManagerTraitId,
    awayManagerTraitId,
  ]);

  const sequenceRef = useRef<ActiveSequence | null>(null);
  const lastEventKeyRef = useRef<string | null>(null);

  // Trigger identical slow-motion dramatic choreography for all 7 patterns and 5 outcomes
  // so outcomes are NEVER spoiled before the ball hits the goal line!
  useEffect(() => {
    if (!dramaticEvent) return;
    if (lastEventKeyRef.current === dramaticEvent.key) return;
    lastEventKeyRef.current = dramaticEvent.key;

    const ev = dramaticEvent.event;
    // For 'save' events, ev.teamId is the defending GK's club -> attacking side is the opposite club
    const isHomeAttack =
      ev.type === 'save'
        ? ev.teamId !== homeClub.id
        : ev.teamId === homeClub.id;
    const seed =
      ev.minute * 19 + (isHomeAttack ? 5 : 13) + ev.description.length;

    const pattern: HighlightPatternId =
      ev.highlightPattern ?? ALL_PATTERNS[seed % ALL_PATTERNS.length];

    let outcome: HighlightOutcomeType;
    if (ev.highlightOutcome) {
      outcome = ev.highlightOutcome;
    } else if (ev.type === 'var_offside') {
      outcome = 'var_offside';
    } else if (ev.type === 'goal') {
      outcome = 'goal';
    } else if (ev.type === 'save') {
      outcome = 'save';
    } else {
      const rem = seed % 3;
      outcome = rem === 0 ? 'woodwork' : rem === 1 ? 'blocked' : 'near_miss';
    }

    const flankSide: 1 | -1 = seed % 2 === 0 ? -1 : 1;
    const shotAngle: ShotAngleType =
      ev.shotAngle ??
      (pattern === 'cut_inside_curler'
        ? 'far_post'
        : flankSide < 0
          ? 'acute_left'
          : 'acute_right');
    const pkDirection: 'left' | 'center' | 'right' =
      ev.pkDirection ??
      (seed % 3 === 0 ? 'left' : seed % 3 === 1 ? 'right' : 'center');
    const reboundOrigin: 'save' | 'woodwork' | 'blocked' =
      ev.reboundOrigin ??
      (seed % 3 === 0 ? 'save' : seed % 3 === 1 ? 'woodwork' : 'blocked');

    let targetY = 0.5;
    if (outcome === 'woodwork') {
      targetY = flankSide < 0 ? 0.405 : 0.595;
    } else if (pattern === 'penalty_kick') {
      targetY =
        pkDirection === 'left'
          ? 0.422
          : pkDirection === 'right'
            ? 0.578
            : 0.5;
    } else if (shotAngle === 'far_post') {
      targetY = flankSide < 0 ? 0.578 : 0.422;
    } else if (shotAngle === 'near_post') {
      targetY = flankSide < 0 ? 0.428 : 0.572;
    } else if (shotAngle === 'acute_left') {
      targetY = 0.435 + (seed % 3) * 0.015;
    } else if (shotAngle === 'acute_right') {
      targetY = 0.565 - (seed % 3) * 0.015;
    } else {
      targetY = 0.45 + ((seed % 5) / 4) * 0.1;
    }

    sequenceRef.current = {
      key: dramaticEvent.key,
      pattern,
      attackRoute: ev.attackRoute,
      dribbleBeatCount: ev.dribbleBeatCount,
      outcome,
      isHomeAttack,
      flankSide,
      startTime: performance.now(),
      durationMs: DRAMATIC_TOTAL_MS,
      attackerIdx: 8 + (seed % 3),
      passerIdx: 5 + (seed % 3),
      targetY,
      shotAngle,
      pkDirection,
      reboundOrigin,
      scorerName:
        ev.scorerName ??
        (isHomeAttack ? homeClub.shortName : awayClub.shortName),
      assistName: ev.assistName,
      minute: ev.minute,
      teamShortName: isHomeAttack ? homeClub.shortName : awayClub.shortName,
    };
  }, [dramaticEvent, homeClub.id, homeClub.shortName, awayClub.shortName]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let width = container.clientWidth || 640;
    let height = container.clientHeight || 240;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(300, Math.round(rect.width));
      height = Math.max(180, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const homePos: Vec2[] = buildHorizontalFormation(
      propsRef.current.homeFormation,
      true,
    );
    const awayPos: Vec2[] = buildHorizontalFormation(
      propsRef.current.awayFormation,
      false,
    );
    const ball: Vec2 = { x: 0.5, y: 0.5 };
    const ballTrail: { x: number; y: number; lift: number }[] = [];

    let animId = 0;
    let lastTs = performance.now();
    let simClock = 0;
    let possessionIsHome = true;
    let carrierIdx = 6;
    let attackPhase = 1; // 0=buildup(DEF), 1=midfield, 2=final-third(ATT/WING), 3=box probe
    let nextPassClock = 0.6;

    const drawPitch = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      padX: number,
      padY: number,
      goalRipple: { side: 'left' | 'right'; intensity: number } | null,
    ) => {
      const pw = w - padX * 2;
      const ph = h - padY * 2;

      ctx.fillStyle = '#0c3b27';
      ctx.fillRect(0, 0, w, h);

      const stripeCount = 10;
      const stripeW = pw / stripeCount;
      for (let i = 0; i < stripeCount; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? '#0f472f' : '#0c3f29';
        ctx.fillRect(padX + i * stripeW, padY, stripeW + 0.5, ph);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(padX, padY, pw, ph);

      const midX = padX + pw / 2;
      const midY = padY + ph / 2;
      ctx.beginPath();
      ctx.moveTo(midX, padY);
      ctx.lineTo(midX, padY + ph);
      ctx.stroke();

      const centerR = Math.min(pw, ph) * 0.16;
      ctx.beginPath();
      ctx.arc(midX, midY, centerR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(midX, midY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      const penW = pw * 0.155;
      const penH = ph * 0.56;
      const sixW = pw * 0.055;
      const sixH = ph * 0.26;

      ctx.strokeRect(padX, midY - penH / 2, penW, penH);
      ctx.strokeRect(padX, midY - sixH / 2, sixW, sixH);
      ctx.strokeRect(padX + pw - penW, midY - penH / 2, penW, penH);
      ctx.strokeRect(padX + pw - sixW, midY - sixH / 2, sixW, sixH);

      ctx.beginPath();
      ctx.arc(padX + penW * 0.72, midY, centerR * 0.75, -0.68, 0.68);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(
        padX + pw - penW * 0.72,
        midY,
        centerR * 0.75,
        Math.PI - 0.68,
        Math.PI + 0.68,
      );
      ctx.stroke();

      // Corner arcs
      const cornerR = 7;
      ctx.beginPath();
      ctx.arc(padX, padY, cornerR, 0, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(padX + pw, padY, cornerR, Math.PI / 2, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(padX, padY + ph, cornerR, -Math.PI / 2, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(padX + pw, padY + ph, cornerR, Math.PI, Math.PI * 1.5);
      ctx.stroke();

      const goalH = ph * 0.2;
      const goalD = Math.max(7, padX * 0.65);

      const drawGoalNet = (side: 'left' | 'right') => {
        const isRippling = goalRipple && goalRipple.side === side;
        const rippleOffset = isRippling
          ? Math.sin(goalRipple.intensity * Math.PI * 6) *
            4.5 *
            goalRipple.intensity
          : 0;

        ctx.save();
        ctx.strokeStyle = isRippling
          ? 'rgba(251, 191, 36, 0.95)'
          : 'rgba(255, 255, 255, 0.65)';
        ctx.fillStyle = isRippling
          ? 'rgba(251, 191, 36, 0.22)'
          : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = isRippling ? 2 : 1.4;

        const gx = side === 'left' ? padX - goalD - rippleOffset : padX + pw;
        const gw = goalD + Math.abs(rippleOffset);
        const gy = midY - goalH / 2;

        ctx.fillRect(gx, gy, gw, goalH);
        ctx.strokeRect(gx, gy, gw, goalH);

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.7;
        for (let r = 1; r <= 4; r += 1) {
          const ly = gy + (goalH * r) / 5;
          ctx.beginPath();
          ctx.moveTo(gx, ly);
          ctx.lineTo(gx + gw, ly);
          ctx.stroke();
        }
        ctx.restore();
      };

      drawGoalNet('left');
      drawGoalNet('right');
    };

    const renderFrame = (now: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const {
        homeClub: hClub,
        awayClub: aClub,
        homeFormation: hForm,
        awayFormation: aForm,
        phase: curPhase,
        isFullTime: curFT,
        speed: curSpeed,
        homePossession: curPoss,
      } = propsRef.current;

      const isLiveRunning =
        (curPhase === 'first_half' || curPhase === 'second_half') && !curFT;

      let seq = sequenceRef.current;
      let seqProg = 0;
      if (seq) {
        seqProg = (now - seq.startTime) / seq.durationMs;
        if (seqProg >= 1) {
          sequenceRef.current = null;
          seq = null;
        }
      }

      const revealPoint = DRAMATIC_REVEAL_MS / DRAMATIC_TOTAL_MS; // ~0.56
      const inSlowMo = Boolean(seq && seqProg < revealPoint + 0.03);
      const speedMult = inSlowMo
        ? 0.42
        : curSpeed === 4
          ? 2.1
          : curSpeed === 2
            ? 1.35
            : 0.9;
      if (isLiveRunning) {
        simClock += dt * speedMult;
      }

      const homeBase = buildHorizontalFormation(hForm, true);
      const awayBase = buildHorizontalFormation(aForm, false);

      let ballTargetX = 0.5;
      let ballTargetY = 0.5;
      let ballLift = 0; // 0 = ground, 1 = high aerial arc (scales ball & offsets ground shadow)
      let curvePath: { p0: Vec2; p1: Vec2; p2: Vec2; alpha: number; color: string } | null =
        null;
      let impactRing: { x: number; y: number; alpha: number; color: string } | null =
        null;
      let goalRipple: { side: 'left' | 'right'; intensity: number } | null = null;
      let goalBanner: {
        scorer: string;
        assist?: string;
        minute: number;
        teamShort: string;
        patternLabel: string;
        alpha: number;
      } | null = null;
      let varBanner: {
        scorer: string;
        minute: number;
        teamShort: string;
        alpha: number;
      } | null = null;
      let varOffsideLine: { x: number; alpha: number } | null = null;
      let topAlertPill: { text: string; color: string; border: string } | null =
        null;
      let pitchFlashAlpha = 0;

      // Custom per-player overrides during the 10 specialized highlight patterns
      const atkOverrides = new Map<number, Vec2>();
      const defOverrides = new Map<number, Vec2>();

      if (seq) {
        const isH = seq.isHomeAttack;
        const fl = seq.flankSide; // -1 (top) or +1 (bottom)
        const flankY = fl < 0 ? 0.11 : 0.89;
        const halfSpaceY = fl < 0 ? 0.27 : 0.73;
        const goalX = atkX(isH, 0.992);
        const preImpactX = atkX(isH, 0.945);
        const blockX = atkX(isH, 0.885);

        const patternLabel =
          (seq.attackRoute && ROUTE_BADGE_LABELS[seq.attackRoute]) ||
          PATTERN_BADGE_LABELS[seq.pattern];

        // Compute shot origin & trajectory according to the exact route / pattern
        let shotOrigin: Vec2 = { x: atkX(isH, 0.84), y: seq.targetY };
        let shotControl: Vec2 = { x: atkX(isH, 0.9), y: seq.targetY };

        if (seq.attackRoute === 'solo_dribble') {
          // Slalom solo dribble show weaving past 2~3 defenders into the box!
          const startPos: Vec2 = { x: atkX(isH, 0.56), y: fl < 0 ? 0.16 : 0.84 };
          const endPos: Vec2 = { x: atkX(isH, 0.865), y: fl < 0 ? 0.42 : 0.58 };
          const dtRun = Math.min(1, seqProg / 0.36);
          const zigzag = Math.sin(dtRun * Math.PI * 3.0) * 0.065 * fl;
          const curDribbler: Vec2 = {
            x: lerp(startPos.x, endPos.x, dtRun),
            y: Math.max(0.10, Math.min(0.90, lerp(startPos.y, endPos.y, dtRun) + zigzag)),
          };
          atkOverrides.set(seq.attackerIdx, curDribbler);
          // Defenders beaten & left lunging behind the dribbler
          defOverrides.set(1, {
            x: atkX(isH, lerp(0.64, 0.61, dtRun)),
            y: fl < 0 ? 0.22 : 0.78,
          });
          defOverrides.set(2, {
            x: atkX(isH, lerp(0.75, 0.73, dtRun)),
            y: fl < 0 ? 0.36 : 0.64,
          });
          defOverrides.set(3, {
            x: atkX(isH, lerp(0.83, 0.80, dtRun)),
            y: fl < 0 ? 0.48 : 0.52,
          });
          shotOrigin = endPos;
          shotControl = { x: atkX(isH, 0.915), y: seq.targetY };

          if (seqProg < 0.36) {
            ballTargetX = curDribbler.x + (isH ? 0.015 : -0.015);
            ballTargetY = curDribbler.y;
            curvePath = {
              p0: startPos,
              p1: { x: atkX(isH, 0.72), y: fl < 0 ? 0.38 : 0.62 },
              p2: endPos,
              alpha: 0.78,
              color: '#f59e0b',
            };
          }
        } else if (seq.attackRoute === 'long_range_cannon') {
          // Lay-off outside the penalty arc -> rising thunderbolt cannon from 24m!
          const layOffFrom: Vec2 = { x: atkX(isH, 0.78), y: halfSpaceY };
          const cannonSpot: Vec2 = { x: atkX(isH, 0.69), y: 0.50 + fl * 0.05 };
          atkOverrides.set(seq.passerIdx, layOffFrom);
          atkOverrides.set(seq.attackerIdx, {
            x: atkX(isH, lerp(0.63, 0.69, Math.min(1, seqProg / 0.26))),
            y: cannonSpot.y,
          });
          defOverrides.set(2, { x: atkX(isH, 0.80), y: 0.46 });
          defOverrides.set(3, { x: atkX(isH, 0.80), y: 0.54 });
          shotOrigin = cannonSpot;
          shotControl = { x: atkX(isH, 0.84), y: lerp(cannonSpot.y, seq.targetY, 0.55) };

          if (seqProg < 0.26) {
            const t = seqProg / 0.26;
            ballTargetX = lerp(layOffFrom.x, cannonSpot.x, t);
            ballTargetY = lerp(layOffFrom.y, cannonSpot.y, t);
            curvePath = {
              p0: layOffFrom,
              p1: { x: lerp(layOffFrom.x, cannonSpot.x, 0.5), y: lerp(layOffFrom.y, cannonSpot.y, 0.5) },
              p2: cannonSpot,
              alpha: 0.72,
              color: '#38bdf8',
            };
          }
        } else if (seq.attackRoute === 'tiki_taka_triangle') {
          // Rapid 3-player triangular one-two passing sequence slicing through the half-space!
          const nodeA: Vec2 = { x: atkX(isH, 0.60), y: 0.50 + fl * 0.08 };
          const nodeB: Vec2 = { x: atkX(isH, 0.73), y: halfSpaceY };
          const nodeC: Vec2 = { x: atkX(isH, 0.84), y: 0.50 + fl * 0.03 };
          atkOverrides.set(5, nodeA);
          atkOverrides.set(seq.passerIdx, nodeB);
          atkOverrides.set(seq.attackerIdx, {
            x: atkX(isH, lerp(0.75, 0.84, Math.min(1, seqProg / 0.34))),
            y: lerp(0.50 - fl * 0.08, nodeC.y, Math.min(1, seqProg / 0.34)),
          });
          defOverrides.set(2, { x: atkX(isH, 0.78), y: halfSpaceY + fl * 0.06 });
          defOverrides.set(3, { x: atkX(isH, 0.83), y: 0.50 - fl * 0.06 });
          shotOrigin = nodeC;
          shotControl = { x: atkX(isH, 0.90), y: seq.targetY };

          if (seqProg < 0.34) {
            if (seqProg < 0.16) {
              const t1 = seqProg / 0.16;
              ballTargetX = lerp(nodeA.x, nodeB.x, t1);
              ballTargetY = lerp(nodeA.y, nodeB.y, t1);
              curvePath = { p0: nodeA, p1: nodeB, p2: nodeC, alpha: 0.78, color: '#34d399' };
            } else {
              const t2 = (seqProg - 0.16) / 0.18;
              ballTargetX = lerp(nodeB.x, nodeC.x, t2);
              ballTargetY = lerp(nodeB.y, nodeC.y, t2);
              curvePath = { p0: nodeB, p1: { x: lerp(nodeB.x, nodeC.x, 0.5), y: lerp(nodeB.y, nodeC.y, 0.5) }, p2: nodeC, alpha: 0.88, color: '#34d399' };
            }
          }
        } else if (seq.attackRoute === 'low_block_counter') {
          // Deep own-half recovery -> towering diagonal long ball -> blistering counter sprint!
          const deepOrigin: Vec2 = { x: atkX(isH, 0.28), y: fl < 0 ? 0.64 : 0.36 };
          const sprintStart: Vec2 = { x: atkX(isH, 0.56), y: halfSpaceY };
          const sprintEnd: Vec2 = { x: atkX(isH, 0.855), y: seq.targetY };
          const sT = Math.min(1, seqProg / 0.34);
          atkOverrides.set(seq.passerIdx, deepOrigin);
          atkOverrides.set(seq.attackerIdx, {
            x: lerp(sprintStart.x, sprintEnd.x, sT),
            y: lerp(sprintStart.y, sprintEnd.y, sT),
          });
          defOverrides.set(2, { x: atkX(isH, lerp(0.58, 0.77, sT)), y: 0.44 });
          defOverrides.set(3, { x: atkX(isH, lerp(0.60, 0.79, sT)), y: 0.58 });
          shotOrigin = sprintEnd;
          shotControl = { x: atkX(isH, 0.91), y: seq.targetY };

          if (seqProg < 0.34) {
            const t = seqProg / 0.34;
            const ctrl: Vec2 = { x: atkX(isH, 0.58), y: 0.50 };
            const pt = quadBezier(deepOrigin, ctrl, sprintEnd, t);
            ballTargetX = pt.x;
            ballTargetY = pt.y;
            ballLift = Math.sin(t * Math.PI) * 1.15;
            curvePath = { p0: deepOrigin, p1: ctrl, p2: sprintEnd, alpha: 0.85, color: '#fbbf24' };
          }
        } else if (seq.pattern === 'wing_cross_header') {
          const wingerPos: Vec2 = {
            x: atkX(isH, lerp(0.68, 0.86, Math.min(1, seqProg * 3.4))),
            y: flankY,
          };
          const headerPos: Vec2 = {
            x: atkX(isH, lerp(0.79, 0.89, Math.min(1, seqProg * 2.8))),
            y: lerp(0.5 - fl * 0.12, seq.targetY, Math.min(1, seqProg * 3)),
          };
          atkOverrides.set(seq.passerIdx, wingerPos);
          atkOverrides.set(seq.attackerIdx, headerPos);
          defOverrides.set(2, { x: atkX(isH, 0.87), y: seq.targetY + fl * 0.04 });
          defOverrides.set(3, { x: atkX(isH, 0.89), y: 0.5 - fl * 0.08 });
          shotOrigin = headerPos;
          shotControl = { x: atkX(isH, 0.92), y: seq.targetY };

          if (seqProg < 0.30) {
            const t = seqProg / 0.30;
            const crossCtrl: Vec2 = {
              x: atkX(isH, 0.84),
              y: lerp(flankY, headerPos.y, 0.45),
            };
            const pt = quadBezier(wingerPos, crossCtrl, headerPos, t);
            ballTargetX = pt.x;
            ballTargetY = pt.y;
            ballLift = Math.sin(t * Math.PI) * 1.05; // High aerial cross parabola!
            curvePath = {
              p0: wingerPos,
              p1: crossCtrl,
              p2: headerPos,
              alpha: 0.72,
              color: '#bae6fd',
            };
          }
        } else if (seq.pattern === 'cutback_finish') {
          const bylineX = atkX(isH, lerp(0.75, 0.955, Math.min(1, seqProg * 3.8)));
          const bylineY = fl < 0 ? 0.17 : 0.83;
          const cutbackSpot: Vec2 = { x: atkX(isH, 0.855), y: 0.5 + fl * 0.03 };
          atkOverrides.set(seq.passerIdx, { x: bylineX, y: bylineY });
          atkOverrides.set(seq.attackerIdx, {
            x: atkX(isH, lerp(0.74, 0.855, Math.min(1, seqProg * 3.1))),
            y: cutbackSpot.y,
          });
          defOverrides.set(1, { x: atkX(isH, 0.93), y: bylineY + (fl < 0 ? 0.06 : -0.06) });
          defOverrides.set(2, { x: atkX(isH, 0.88), y: 0.48 });
          shotOrigin = cutbackSpot;
          shotControl = { x: atkX(isH, 0.91), y: seq.targetY };

          if (seqProg < 0.30) {
            const t = seqProg / 0.30;
            if (t < 0.5) {
              const td = t / 0.5;
              ballTargetX = atkX(isH, lerp(0.75, 0.955, td));
              ballTargetY = bylineY;
            } else {
              const tc = (t - 0.5) / 0.5;
              ballTargetX = lerp(atkX(isH, 0.955), cutbackSpot.x, tc);
              ballTargetY = lerp(bylineY, cutbackSpot.y, tc);
              curvePath = {
                p0: { x: atkX(isH, 0.955), y: bylineY },
                p1: { x: atkX(isH, 0.905), y: lerp(bylineY, cutbackSpot.y, 0.5) },
                p2: cutbackSpot,
                alpha: 0.78,
                color: '#fde047',
              };
            }
          }
        } else if (seq.pattern === 'through_ball_1v1') {
          const passerPos: Vec2 = { x: atkX(isH, 0.56), y: 0.52 };
          const runnerStart: Vec2 = { x: atkX(isH, 0.68), y: 0.48 };
          const runnerEnd: Vec2 = { x: atkX(isH, 0.84), y: seq.targetY };
          const runT = Math.min(1, seqProg * 2.8);
          const runnerCur: Vec2 = {
            x: lerp(runnerStart.x, runnerEnd.x, runT),
            y: lerp(runnerStart.y, runnerEnd.y, runT),
          };
          atkOverrides.set(seq.passerIdx, passerPos);
          atkOverrides.set(seq.attackerIdx, runnerCur);
          // Defenders split & chasing behind
          defOverrides.set(2, { x: atkX(isH, lerp(0.69, 0.79, runT)), y: 0.36 });
          defOverrides.set(3, { x: atkX(isH, lerp(0.69, 0.79, runT)), y: 0.64 });
          // GK rushes out slightly
          defOverrides.set(0, { x: atkX(isH, 0.915), y: seq.targetY });
          shotOrigin = runnerEnd;
          shotControl = { x: atkX(isH, 0.9), y: seq.targetY };

          if (seqProg < 0.30) {
            const t = seqProg / 0.30;
            ballTargetX = lerp(passerPos.x, runnerEnd.x, t);
            ballTargetY = lerp(passerPos.y, runnerEnd.y, t);
            curvePath = {
              p0: passerPos,
              p1: { x: lerp(passerPos.x, runnerEnd.x, 0.5), y: 0.5 },
              p2: runnerEnd,
              alpha: 0.85,
              color: '#34d399',
            };
          }
        } else if (seq.pattern === 'cut_inside_curler') {
          const cutStart: Vec2 = { x: atkX(isH, 0.66), y: flankY };
          const cutEnd: Vec2 = { x: atkX(isH, 0.78), y: halfSpaceY };
          const ct = Math.min(1, seqProg / 0.28);
          const curPos: Vec2 = {
            x: lerp(cutStart.x, cutEnd.x, ct),
            y: lerp(cutStart.y, cutEnd.y, ct),
          };
          atkOverrides.set(seq.attackerIdx, curPos);
          defOverrides.set(1, { x: atkX(isH, 0.81), y: halfSpaceY + fl * 0.08 });
          defOverrides.set(2, { x: atkX(isH, 0.84), y: 0.5 });
          shotOrigin = cutEnd;
          // Big bending curler arc toward far post!
          shotControl = {
            x: atkX(isH, 0.88),
            y: halfSpaceY - fl * 0.14,
          };

          if (seqProg < 0.28) {
            ballTargetX = curPos.x + (isH ? 0.015 : -0.015);
            ballTargetY = curPos.y;
          }
        } else if (seq.pattern === 'corner_kick') {
          const cornerPos: Vec2 = {
            x: atkX(isH, 0.985),
            y: fl < 0 ? 0.04 : 0.96,
          };
          const boxTarget: Vec2 = { x: atkX(isH, 0.895), y: seq.targetY };
          atkOverrides.set(seq.passerIdx, cornerPos);
          atkOverrides.set(seq.attackerIdx, {
            x: atkX(isH, lerp(0.84, 0.895, Math.min(1, seqProg * 3.2))),
            y: seq.targetY,
          });
          // Pack penalty box with attackers & defenders
          atkOverrides.set(2, { x: atkX(isH, 0.87), y: 0.40 });
          atkOverrides.set(3, { x: atkX(isH, 0.86), y: 0.60 });
          atkOverrides.set(7, { x: atkX(isH, 0.81), y: 0.50 });
          defOverrides.set(1, { x: atkX(isH, 0.91), y: 0.39 });
          defOverrides.set(2, { x: atkX(isH, 0.90), y: 0.50 });
          defOverrides.set(3, { x: atkX(isH, 0.91), y: 0.61 });
          defOverrides.set(4, { x: atkX(isH, 0.85), y: 0.45 });
          shotOrigin = boxTarget;
          shotControl = { x: atkX(isH, 0.93), y: seq.targetY };

          if (seqProg < 0.32) {
            const t = seqProg / 0.32;
            const ctrl: Vec2 = {
              x: atkX(isH, 0.92),
              y: lerp(cornerPos.y, boxTarget.y, 0.45),
            };
            const pt = quadBezier(cornerPos, ctrl, boxTarget, t);
            ballTargetX = pt.x;
            ballTargetY = pt.y;
            ballLift = Math.sin(t * Math.PI) * 1.15;
            curvePath = {
              p0: cornerPos,
              p1: ctrl,
              p2: boxTarget,
              alpha: 0.78,
              color: '#fbbf24',
            };
          }
        } else if (seq.pattern === 'direct_free_kick') {
          const fkSpot: Vec2 = {
            x: atkX(isH, 0.755),
            y: fl < 0 ? 0.38 : 0.62,
          };
          // Kicker run-up
          const runT = Math.min(1, seqProg / 0.25);
          atkOverrides.set(seq.attackerIdx, {
            x: fkSpot.x + (isH ? -0.045 * (1 - runT) : 0.045 * (1 - runT)),
            y: fkSpot.y + fl * 0.03 * (1 - runT),
          });
          // 4-player defensive wall lined up cleanly in front of the free kick!
          const wallX = atkX(isH, 0.835);
          const wallBaseY = lerp(fkSpot.y, 0.5, 0.35);
          defOverrides.set(4, { x: wallX, y: wallBaseY - 0.045 });
          defOverrides.set(5, { x: wallX, y: wallBaseY - 0.015 });
          defOverrides.set(6, { x: wallX, y: wallBaseY + 0.015 });
          defOverrides.set(7, { x: wallX, y: wallBaseY + 0.045 });
          // Remaining defenders watch the box
          defOverrides.set(2, { x: atkX(isH, 0.89), y: 0.36 });
          defOverrides.set(3, { x: atkX(isH, 0.89), y: 0.64 });

          shotOrigin = fkSpot;
          // Whipped curved trajectory bending over & around the wall into top corner!
          shotControl = {
            x: atkX(isH, 0.86),
            y: fkSpot.y + fl * 0.14,
          };

          if (seqProg < 0.25) {
            ballTargetX = fkSpot.x;
            ballTargetY = fkSpot.y;
          }
        } else if (seq.pattern === 'u_buildup_switch') {
          // 8) U-shape rear buildup (CB -> CDM -> opp CB) -> arcing diagonal switch pass to opposite flank!
          const cbStart: Vec2 = { x: atkX(isH, 0.34), y: fl < 0 ? 0.32 : 0.68 };
          const cdmPivot: Vec2 = { x: atkX(isH, 0.44), y: 0.50 };
          const cbSwitch: Vec2 = { x: atkX(isH, 0.42), y: fl < 0 ? 0.72 : 0.28 };
          const oppFlankY = fl < 0 ? 0.14 : 0.86;
          const wingerRecv: Vec2 = { x: atkX(isH, 0.78), y: oppFlankY };
          const cutAnglePos: Vec2 = {
            x: atkX(isH, 0.86),
            y: fl < 0 ? 0.28 : 0.72,
          };

          atkOverrides.set(2, cbStart);
          atkOverrides.set(5, cdmPivot);
          atkOverrides.set(3, cbSwitch);
          atkOverrides.set(seq.attackerIdx, {
            x: lerp(wingerRecv.x, cutAnglePos.x, Math.max(0, Math.min(1, (seqProg - 0.24) * 5))),
            y: lerp(wingerRecv.y, cutAnglePos.y, Math.max(0, Math.min(1, (seqProg - 0.24) * 5))),
          });
          defOverrides.set(1, { x: atkX(isH, 0.76), y: fl < 0 ? 0.65 : 0.35 }); // pulled to wrong side!
          defOverrides.set(4, { x: atkX(isH, lerp(0.78, 0.86, seqProg)), y: fl < 0 ? 0.34 : 0.66 });
          shotOrigin = cutAnglePos;
          shotControl = {
            x: atkX(isH, 0.91),
            y: lerp(cutAnglePos.y, seq.targetY, 0.42),
          };

          if (seqProg < 0.36) {
            if (seqProg < 0.11) {
              const t1 = seqProg / 0.11;
              ballTargetX = lerp(cbStart.x, cdmPivot.x, t1);
              ballTargetY = lerp(cbStart.y, cdmPivot.y, t1);
            } else if (seqProg < 0.20) {
              const t2 = (seqProg - 0.11) / 0.09;
              ballTargetX = lerp(cdmPivot.x, cbSwitch.x, t2);
              ballTargetY = lerp(cdmPivot.y, cbSwitch.y, t2);
              curvePath = {
                p0: cbStart,
                p1: cdmPivot,
                p2: cbSwitch,
                alpha: 0.7,
                color: '#38bdf8',
              };
            } else {
              const t3 = (seqProg - 0.20) / 0.16;
              const switchCtrl: Vec2 = {
                x: atkX(isH, 0.62),
                y: 0.50,
              };
              const pt = quadBezier(cbSwitch, switchCtrl, wingerRecv, t3);
              ballTargetX = pt.x;
              ballTargetY = pt.y;
              ballLift = Math.sin(t3 * Math.PI) * 1.25; // Towering diagonal switch!
              curvePath = {
                p0: cbSwitch,
                p1: switchCtrl,
                p2: wingerRecv,
                alpha: 0.88,
                color: '#38bdf8',
              };
            }
          }
        } else if (seq.pattern === 'rebound_finish') {
          // 9) Second-chance rebound: 1st shot parried/post/blocked -> loose ball -> 2nd attacker smashes it in!
          const firstShooterPos: Vec2 = {
            x: atkX(isH, 0.75),
            y: fl < 0 ? 0.34 : 0.66,
          };
          const deflectSpot: Vec2 =
            seq.reboundOrigin === 'woodwork'
              ? { x: atkX(isH, 0.98), y: fl < 0 ? 0.41 : 0.59 }
              : seq.reboundOrigin === 'blocked'
                ? { x: atkX(isH, 0.86), y: 0.50 + fl * 0.06 }
                : { x: atkX(isH, 0.94), y: 0.50 + fl * 0.05 };
          const reboundSpot: Vec2 = {
            x: atkX(isH, 0.875),
            y: 0.50 - fl * 0.07,
          };
          atkOverrides.set(seq.passerIdx, firstShooterPos);
          atkOverrides.set(seq.attackerIdx, {
            x: atkX(isH, lerp(0.76, 0.875, Math.min(1, seqProg / 0.34))),
            y: lerp(0.50 - fl * 0.16, reboundSpot.y, Math.min(1, seqProg / 0.34)),
          });
          defOverrides.set(2, { x: atkX(isH, 0.86), y: 0.50 + fl * 0.06 });
          defOverrides.set(3, { x: atkX(isH, 0.89), y: 0.50 - fl * 0.14 });
          shotOrigin = reboundSpot;
          shotControl = { x: atkX(isH, 0.92), y: seq.targetY };

          if (seqProg < 0.36) {
            if (seqProg < 0.20) {
              const t1 = seqProg / 0.20;
              ballTargetX = lerp(firstShooterPos.x, deflectSpot.x, t1);
              ballTargetY = lerp(firstShooterPos.y, deflectSpot.y, t1);
              ballLift = Math.sin(t1 * Math.PI) * 0.3;
              curvePath = {
                p0: firstShooterPos,
                p1: {
                  x: lerp(firstShooterPos.x, deflectSpot.x, 0.5),
                  y: lerp(firstShooterPos.y, deflectSpot.y, 0.5),
                },
                p2: deflectSpot,
                alpha: 0.72,
                color: '#f8fafc',
              };
            } else {
              const t2 = (seqProg - 0.20) / 0.16;
              ballTargetX = lerp(deflectSpot.x, reboundSpot.x, t2);
              ballTargetY = lerp(deflectSpot.y, reboundSpot.y, t2);
              ballLift = Math.sin(t2 * Math.PI) * 0.55;
              impactRing = {
                x: deflectSpot.x,
                y: deflectSpot.y,
                alpha: Math.max(0, 1 - t2),
                color:
                  seq.reboundOrigin === 'woodwork'
                    ? '#fb923c'
                    : seq.reboundOrigin === 'blocked'
                      ? '#fbbf24'
                      : '#38bdf8',
              };
            }
          }
        } else if (seq.pattern === 'penalty_kick') {
          // 10) Penalty Kick: everyone outside box arc, tense standoff, left/center/right strike + GK dive!
          const pkSpot: Vec2 = { x: atkX(isH, 0.885), y: 0.50 };
          const runT = Math.max(0, Math.min(1, (seqProg - 0.16) / 0.18));
          atkOverrides.set(seq.attackerIdx, {
            x: pkSpot.x + (isH ? -0.055 * (1 - runT) : 0.055 * (1 - runT)),
            y: 0.50 + 0.025 * (1 - runT),
          });
          // Line up other players outside the penalty box
          for (let k = 1; k < 11; k += 1) {
            if (k !== seq.attackerIdx) {
              atkOverrides.set(k, {
                x: atkX(isH, 0.79 - (k % 3) * 0.03),
                y: 0.24 + ((k * 7) % 10) * 0.055,
              });
            }
            defOverrides.set(k, {
              x: atkX(isH, 0.805 - (k % 2) * 0.02),
              y: 0.22 + ((k * 5) % 10) * 0.058,
            });
          }
          // GK on the goal line: dives to corner after shot is struck
          const gkDiveY =
            seqProg < 0.36
              ? 0.50
              : seq.outcome === 'save'
                ? seq.targetY
                : seq.pkDirection === 'center'
                  ? 0.435
                  : seq.targetY < 0.5
                    ? 0.565
                    : 0.435;
          defOverrides.set(0, { x: atkX(isH, 0.962), y: gkDiveY });

          shotOrigin = pkSpot;
          shotControl = {
            x: atkX(isH, 0.93),
            y: lerp(0.50, seq.targetY, 0.6),
          };
          if (seqProg < 0.35) {
            ballTargetX = pkSpot.x;
            ballTargetY = pkSpot.y;
          }
        } else {
          // 7) high_press_counter: midfield/high turnover + rapid 2-pass counter
          const stealPos: Vec2 = { x: atkX(isH, 0.54), y: halfSpaceY };
          const midRelay: Vec2 = { x: atkX(isH, 0.70), y: 0.5 };
          const finishPos: Vec2 = { x: atkX(isH, 0.85), y: seq.targetY };
          atkOverrides.set(seq.passerIdx, {
            x: lerp(stealPos.x, midRelay.x, Math.min(1, seqProg * 3.5)),
            y: lerp(stealPos.y, midRelay.y, Math.min(1, seqProg * 3.5)),
          });
          atkOverrides.set(seq.attackerIdx, {
            x: atkX(isH, lerp(0.62, 0.85, Math.min(1, seqProg * 3.1))),
            y: lerp(0.5 - fl * 0.14, seq.targetY, Math.min(1, seqProg * 3.1)),
          });
          // Defenders caught out & sprinting back
          defOverrides.set(5, { x: atkX(isH, 0.52), y: halfSpaceY });
          defOverrides.set(2, { x: atkX(isH, lerp(0.65, 0.80, seqProg)), y: 0.42 });
          defOverrides.set(3, { x: atkX(isH, lerp(0.67, 0.82, seqProg)), y: 0.60 });
          shotOrigin = finishPos;
          shotControl = { x: atkX(isH, 0.91), y: seq.targetY };

          if (seqProg < 0.30) {
            const t = seqProg / 0.30;
            if (t < 0.48) {
              const t1 = t / 0.48;
              ballTargetX = lerp(stealPos.x, midRelay.x, t1);
              ballTargetY = lerp(stealPos.y, midRelay.y, t1);
            } else {
              const t2 = (t - 0.48) / 0.52;
              ballTargetX = lerp(midRelay.x, finishPos.x, t2);
              ballTargetY = lerp(midRelay.y, finishPos.y, t2);
              curvePath = {
                p0: midRelay,
                p1: { x: lerp(midRelay.x, finishPos.x, 0.5), y: lerp(midRelay.y, finishPos.y, 0.5) },
                p2: finishPos,
                alpha: 0.82,
                color: '#f97316',
              };
            }
          }
        }

        const buildupEnd =
          seq.attackRoute === 'solo_dribble'
            ? 0.36
            : seq.attackRoute === 'tiki_taka_triangle' ||
                seq.attackRoute === 'low_block_counter'
              ? 0.34
              : seq.attackRoute === 'long_range_cannon'
                ? 0.26
                : seq.pattern === 'direct_free_kick'
                  ? 0.25
                  : seq.pattern === 'corner_kick'
                    ? 0.32
                    : seq.pattern === 'u_buildup_switch' || seq.pattern === 'rebound_finish'
                      ? 0.36
                      : seq.pattern === 'penalty_kick'
                        ? 0.35
                        : seq.pattern === 'cut_inside_curler'
                          ? 0.28
                          : 0.30;

        if (seqProg < buildupEnd) {
          topAlertPill = {
            text:
              seq.pattern === 'penalty_kick'
                ? `🎯 ${seq.teamShortName} · 페널티킥 대치! · SLOW-MO`
                : seq.pattern === 'rebound_finish' && seqProg >= 0.20
                  ? `⚡ 세컨찬스 리바운드 쇄도! · SLOW-MO`
                  : seq.attackRoute === 'solo_dribble'
                    ? `🔥 ${seq.teamShortName} · ${seq.scorerName} 원맨 드리블 쇼! · SLOW-MO`
                    : `🔥 ${seq.teamShortName} · ${patternLabel} · SLOW-MO`,
            color: '#fef08a',
            border: '#f59e0b',
          };
        } else if (seqProg < revealPoint) {
          // Phase 2: Slow-Mo Shot Flight (IDENTICAL golden curve until reveal point -> zero spoilers!)
          const t = (seqProg - buildupEnd) / (revealPoint - buildupEnd);
          const flightEndX = seq.outcome === 'blocked' ? blockX : preImpactX;
          const endY =
            seq.outcome === 'near_miss'
              ? lerp(seq.targetY, seq.targetY < 0.5 ? 0.35 : 0.65, t)
              : seq.targetY;
          const dest: Vec2 = { x: flightEndX, y: endY };
          const pt = quadBezier(shotOrigin, shotControl, dest, t);
          ballTargetX = pt.x;
          ballTargetY = pt.y;
          ballLift =
            seq.pattern === 'direct_free_kick' ||
            seq.pattern === 'cut_inside_curler' ||
            seq.attackRoute === 'long_range_cannon'
              ? Math.sin(t * Math.PI) * 0.95
              : seq.pattern === 'wing_cross_header' || seq.pattern === 'corner_kick'
                ? Math.sin(t * Math.PI) * 0.55
                : Math.sin(t * Math.PI) * 0.22;

          curvePath = {
            p0: shotOrigin,
            p1: shotControl,
            p2: dest,
            alpha: 0.92,
            color: '#fef08a',
          };
          topAlertPill = {
            text: `⚡ ${seq.teamShortName} · ${patternLabel} 슈팅! · SLOW-MO`,
            color: '#fef08a',
            border: '#f59e0b',
          };
        } else {
          // Phase 3: Outcome Reveal (6 varied outcomes including VAR Offside!)
          const t = (seqProg - revealPoint) / (1 - revealPoint);
          if (seq.outcome === 'goal') {
            ballTargetX = lerp(
              preImpactX,
              goalX + (isH ? 0.016 : -0.016),
              Math.min(1, t * 3.5),
            );
            ballTargetY = seq.targetY;
            goalRipple = {
              side: isH ? 'right' : 'left',
              intensity: Math.max(0, 1 - t),
            };
            pitchFlashAlpha = Math.max(0, (1 - t * 1.45) * 0.28);
            goalBanner = {
              scorer: seq.scorerName,
              assist: seq.assistName,
              minute: seq.minute,
              teamShort: seq.teamShortName,
              patternLabel,
              alpha: t < 0.82 ? 1 : Math.max(0, (1 - t) / 0.18),
            };
          } else if (seq.outcome === 'var_offside') {
            // Brief net ripple followed immediately by VAR Offside line + Disallowed banner!
            ballTargetX = lerp(
              preImpactX,
              goalX + (isH ? 0.015 : -0.015),
              Math.min(1, t * 4.0),
            );
            ballTargetY = seq.targetY;
            if (t < 0.26) {
              goalRipple = {
                side: isH ? 'right' : 'left',
                intensity: 0.7,
              };
              topAlertPill = {
                text: `📺 VAR 오프사이드 판독 중...`,
                color: '#e9d5ff',
                border: '#a855f7',
              };
            } else {
              varOffsideLine = {
                x: atkX(isH, 0.82),
                alpha: t < 0.88 ? 0.92 : Math.max(0, (1 - t) / 0.12),
              };
              varBanner = {
                scorer: seq.scorerName,
                minute: seq.minute,
                teamShort: seq.teamShortName,
                alpha: t < 0.86 ? 1 : Math.max(0, (1 - t) / 0.14),
              };
            }
          } else if (seq.outcome === 'save') {
            const gkX = preImpactX;
            ballTargetX = lerp(gkX, atkX(isH, 0.81), t);
            ballTargetY = lerp(
              seq.targetY,
              seq.targetY < 0.5 ? 0.20 : 0.80,
              t,
            );
            ballLift = Math.sin(t * Math.PI) * 0.45;
            impactRing = {
              x: gkX,
              y: seq.targetY,
              alpha: Math.max(0, 1 - t * 1.45),
              color: '#38bdf8',
            };
            topAlertPill = {
              text:
                seq.pattern === 'penalty_kick'
                  ? `🧤 PK 슈퍼 세이브!!`
                  : `🧤 슈퍼 세이브! (${patternLabel})`,
              color: '#7dd3fc',
              border: '#38bdf8',
            };
          } else if (seq.outcome === 'woodwork') {
            const postX = atkX(isH, 0.985);
            ballTargetX = lerp(postX, atkX(isH, 0.84), t);
            ballTargetY = lerp(
              seq.targetY,
              seq.targetY < 0.5 ? 0.26 : 0.74,
              t,
            );
            ballLift = Math.sin(t * Math.PI) * 0.75;
            impactRing = {
              x: postX,
              y: seq.targetY,
              alpha: Math.max(0, 1 - t * 1.35),
              color: '#fb923c',
            };
            topAlertPill = {
              text: `💥 골대 강타! (${patternLabel})`,
              color: '#fdba74',
              border: '#fb923c',
            };
          } else if (seq.outcome === 'blocked') {
            defOverrides.set(2, { x: blockX, y: seq.targetY });
            ballTargetX = lerp(blockX, atkX(isH, 0.76), t);
            ballTargetY = lerp(
              seq.targetY,
              seq.targetY < 0.5 ? 0.22 : 0.78,
              t,
            );
            ballLift = Math.sin(t * Math.PI) * 0.35;
            impactRing = {
              x: blockX,
              y: seq.targetY,
              alpha: Math.max(0, 1 - t * 1.4),
              color: '#fbbf24',
            };
            topAlertPill = {
              text: `🛡️ 수비수 육탄 방어! (${patternLabel})`,
              color: '#fde68a',
              border: '#f59e0b',
            };
          } else {
            ballTargetX = atkX(isH, 1.015);
            ballTargetY = seq.targetY < 0.5 ? 0.31 : 0.69;
            topAlertPill = {
              text:
                seq.pattern === 'penalty_kick'
                  ? `😱 페널티킥 실축!`
                  : `⚡ 간발의 빗나감! (${patternLabel})`,
              color: '#cbd5e1',
              border: '#64748b',
            };
          }
        }
      } else if (isLiveRunning) {
        const curHomeTactic = propsRef.current.homeTactic;
        const curAwayTactic = propsRef.current.awayTactic;
        const curHomeShots = propsRef.current.homeShots;
        const curAwayShots = propsRef.current.awayShots;
        const curHomeXg = propsRef.current.homeXg;
        const curAwayXg = propsRef.current.awayXg;

        const atkTactic = possessionIsHome ? curHomeTactic : curAwayTactic;
        if (simClock >= nextPassClock) {
          const baseDelay =
            atkTactic === 'counter' || atkTactic === 'gegenpressing'
              ? 0.42
              : atkTactic === 'possession'
                ? 0.56
                : 0.5;
          nextPassClock =
            simClock + baseDelay + Math.abs(Math.sin(simClock * 2.9)) * 0.42;

          // Keep realistic multi-pass chains weighted by possession + shot/xG pressure
          const shotShare =
            (curHomeShots + 1.5) / (curHomeShots + curAwayShots + 3);
          const xgShare = (curHomeXg + 0.3) / (curHomeXg + curAwayXg + 0.6);
          const homeHoldChance =
            (curPoss / 100) * 0.62 + shotShare * 0.2 + xgShare * 0.18;
          const ownKeepProb = possessionIsHome
            ? 0.58 + (homeHoldChance - 0.5) * 0.55
            : 0.58 + (0.5 - homeHoldChance) * 0.55;
          const keepCurrent =
            Math.random() < Math.max(0.28, Math.min(0.84, ownKeepProb));

          if (!keepCurrent) {
            possessionIsHome = !possessionIsHome;
            const newTactic = possessionIsHome ? curHomeTactic : curAwayTactic;
            // High press wins the ball higher up; counter wins it deeper
            attackPhase =
              newTactic === 'gegenpressing'
                ? 1
                : newTactic === 'counter'
                  ? 0
                  : Math.random() < 0.5
                    ? 0
                    : 1;
          } else {
            // Structured progression: buildup(0) -> midfield(1) -> final-third(2) -> probe/recycle(3)
            if (atkTactic === 'counter' && attackPhase === 0) {
              attackPhase = 2; // Direct vertical transition!
            } else if (attackPhase < 3) {
              const advanceProb =
                atkTactic === 'possession' ? 0.62 : 0.76;
              attackPhase =
                Math.random() < advanceProb
                  ? attackPhase + 1
                  : Math.max(0, attackPhase - 1);
            } else {
              // Recycle back to midfield/buildup after box probe
              attackPhase = atkTactic === 'possession' ? 1 : 0;
            }
          }

          const activeBase = possessionIsHome ? homeBase : awayBase;
          const activeTacticNow = possessionIsHome
            ? curHomeTactic
            : curAwayTactic;
          const activeMgrTraitNow = possessionIsHome
            ? propsRef.current.homeManagerTraitId
            : propsRef.current.awayManagerTraitId;
          const nextPass = pickTacticalPassNext({
            tactic: activeTacticNow,
            attackPhase,
            carrierIdx,
            activeBase,
            managerTraitId: activeMgrTraitNow,
          });
          carrierIdx = nextPass.nextCarrierIdx;
          nextPassClock =
            simClock + nextPass.passDelay + Math.abs(Math.sin(simClock * 2.9)) * 0.36;
        }
        const carrier = possessionIsHome
          ? homePos[carrierIdx]
          : awayPos[carrierIdx];
        const forwardProbe =
          attackPhase >= 2 ? (possessionIsHome ? 0.04 : -0.04) : 0;
        ballTargetX = Math.max(
          0.08,
          Math.min(
            0.92,
            carrier.x + (possessionIsHome ? 0.016 : -0.016) + forwardProbe,
          ),
        );
        ballTargetY = carrier.y;
      } else {
        ballTargetX = 0.5;
        ballTargetY = 0.5;
      }

      const ballLerp = seq
        ? inSlowMo
          ? 1 - Math.exp(-8.5 * dt)
          : 1 - Math.exp(-18 * dt)
        : 1 - Math.exp(-8.5 * dt * speedMult);
      ball.x = lerp(ball.x, ballTargetX, ballLerp);
      ball.y = lerp(ball.y, ballTargetY, ballLerp);

      ballTrail.push({ x: ball.x, y: ball.y, lift: ballLift });
      if (ballTrail.length > (inSlowMo ? 15 : 9)) ballTrail.shift();

      // Stat-coherent territorial shift: dominant possession + shots + xG visibly pins opponent back
      const liveShotShare =
        (propsRef.current.homeShots + 1.5) /
        (propsRef.current.homeShots + propsRef.current.awayShots + 3);
      const liveXgShare =
        (propsRef.current.homeXg + 0.3) /
        (propsRef.current.homeXg + propsRef.current.awayXg + 0.6);
      const territorialHome =
        (curPoss / 100) * 0.5 + liveShotShare * 0.25 + liveXgShare * 0.25;
      const territorialShiftX = (territorialHome - 0.5) * 0.26;
      const homeLineOffset =
        propsRef.current.homeTactic === 'gegenpressing' ||
        propsRef.current.homeManagerTraitId === 'gegenpress_guru'
          ? 0.04
          : propsRef.current.homeTactic === 'possession' ||
              propsRef.current.homeManagerTraitId === 'tiki_taka'
            ? 0.025
            : (propsRef.current.homeTactic === 'counter' ||
                  propsRef.current.homeManagerTraitId === 'catenaccio') &&
                !possessionIsHome
              ? -0.04
              : 0;
      const awayLineOffset =
        propsRef.current.awayTactic === 'gegenpressing' ||
        propsRef.current.awayManagerTraitId === 'gegenpress_guru'
          ? -0.04
          : propsRef.current.awayTactic === 'possession' ||
              propsRef.current.awayManagerTraitId === 'tiki_taka'
            ? -0.025
            : (propsRef.current.awayTactic === 'counter' ||
                  propsRef.current.awayManagerTraitId === 'catenaccio') &&
                possessionIsHome
              ? 0.04
              : 0;

      const ballShiftX = (ball.x - 0.5) * 0.34;
      const ballShiftY = (ball.y - 0.5) * 0.14;
      const playerLerp =
        1 - Math.exp(-(inSlowMo ? 5.2 : 5.5) * dt * (seq ? 1.15 : speedMult));

      for (let i = 0; i < 11; i += 1) {
        let hx = homeBase[i].x;
        let hy = homeBase[i].y;

        const homeTacOff = isLiveRunning
          ? computeTacticalPlayerOffset({
              slotIndex: i,
              base: homeBase[i],
              isHome: true,
              hasBall: possessionIsHome,
              tactic: propsRef.current.homeTactic,
              formation: hForm,
              attackPhase,
              ball,
              simClock,
              managerTraitId: propsRef.current.homeManagerTraitId,
            })
          : { x: 0, y: 0 };

        if (i === 0) {
          hx = Math.max(
            0.045,
            Math.min(0.14, 0.055 + Math.max(0, ball.x - 0.5) * 0.05 + homeTacOff.x),
          );
          hy = 0.5 + (ball.y - 0.5) * 0.28;
          if (seq && !seq.isHomeAttack && seqProg >= 0.42) {
            hy = seq.targetY;
          }
        } else {
          const lineFactor = i >= 8 ? 1.15 : i >= 5 ? 1.0 : 0.78;
          hx = Math.max(
            0.10,
            Math.min(
              0.91,
              hx +
                (ballShiftX + territorialShiftX * 0.65) * lineFactor +
                homeLineOffset +
                homeTacOff.x +
                Math.sin(simClock * 1.4 + i * 1.7) * 0.011,
            ),
          );
          hy = Math.max(
            0.06,
            Math.min(
              0.94,
              hy +
                ballShiftY +
                homeTacOff.y +
                Math.cos(simClock * 1.2 + i * 2.1) * 0.014,
            ),
          );
        }

        if (seq) {
          const ov = seq.isHomeAttack
            ? atkOverrides.get(i)
            : defOverrides.get(i);
          if (ov) {
            hx = ov.x;
            hy = ov.y;
          }
        }

        homePos[i].x = lerp(homePos[i].x, hx, playerLerp);
        homePos[i].y = lerp(homePos[i].y, hy, playerLerp);

        let ax = awayBase[i].x;
        let ay = awayBase[i].y;

        const awayTacOff = isLiveRunning
          ? computeTacticalPlayerOffset({
              slotIndex: i,
              base: awayBase[i],
              isHome: false,
              hasBall: !possessionIsHome,
              tactic: propsRef.current.awayTactic,
              formation: aForm,
              attackPhase,
              ball,
              simClock,
              managerTraitId: propsRef.current.awayManagerTraitId,
            })
          : { x: 0, y: 0 };

        if (i === 0) {
          ax = Math.max(
            0.86,
            Math.min(0.955, 0.945 - Math.max(0, 0.5 - ball.x) * 0.05 + awayTacOff.x),
          );
          ay = 0.5 + (ball.y - 0.5) * 0.28;
          if (seq && seq.isHomeAttack && seqProg >= 0.42) {
            ay = seq.targetY;
          }
        } else {
          const lineFactor = i >= 8 ? 1.15 : i >= 5 ? 1.0 : 0.78;
          ax = Math.max(
            0.09,
            Math.min(
              0.90,
              ax +
                (ballShiftX + territorialShiftX * 0.65) * lineFactor +
                awayLineOffset +
                awayTacOff.x +
                Math.cos(simClock * 1.3 + i * 1.9) * 0.011,
            ),
          );
          ay = Math.max(
            0.06,
            Math.min(
              0.94,
              ay +
                ballShiftY +
                awayTacOff.y +
                Math.sin(simClock * 1.1 + i * 2.3) * 0.014,
            ),
          );
        }

        if (seq) {
          const ov = !seq.isHomeAttack
            ? atkOverrides.get(i)
            : defOverrides.get(i);
          if (ov) {
            ax = ov.x;
            ay = ov.y;
          }
        }

        awayPos[i].x = lerp(awayPos[i].x, ax, playerLerp);
        awayPos[i].y = lerp(awayPos[i].y, ay, playerLerp);
      }

      const padX = Math.max(14, width * 0.032);
      const padY = Math.max(10, height * 0.05);
      const pw = width - padX * 2;
      const ph = height - padY * 2;
      const toPx = (pt: Vec2): Vec2 => ({
        x: padX + pt.x * pw,
        y: padY + pt.y * ph,
      });

      drawPitch(ctx, width, height, padX, padY, goalRipple);

      if (inSlowMo) {
        const bpV = toPx(ball);
        const grad = ctx.createRadialGradient(
          bpV.x,
          bpV.y,
          Math.min(pw, ph) * 0.18,
          bpV.x,
          bpV.y,
          Math.max(pw, ph) * 0.72,
        );
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(2, 6, 23, 0.42)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      if (pitchFlashAlpha > 0.01) {
        ctx.fillStyle = `rgba(251, 191, 36, ${pitchFlashAlpha})`;
        ctx.fillRect(padX, padY, pw, ph);
      }

      // Curved quadratic Bézier guide for crosses, curlers, free kicks, and cutbacks
      if (curvePath) {
        const p0 = toPx(curvePath.p0);
        const p1 = toPx(curvePath.p1);
        const p2 = toPx(curvePath.p2);
        ctx.save();
        ctx.strokeStyle = curvePath.color;
        ctx.globalAlpha = curvePath.alpha;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      }

      if (impactRing && impactRing.alpha > 0.02) {
        const ip = toPx({ x: impactRing.x, y: impactRing.y });
        ctx.save();
        ctx.strokeStyle = impactRing.color;
        ctx.globalAlpha = impactRing.alpha;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(ip.x, ip.y, 10 + (1 - impactRing.alpha) * 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const kitsClash = colorDistance(hClub.primaryColor, aClub.primaryColor) < 85;
      const homeFill = hClub.primaryColor;
      const homeStroke = hClub.secondaryColor || '#ffffff';
      const awayFill = kitsClash
        ? aClub.secondaryColor &&
          colorDistance(hClub.primaryColor, aClub.secondaryColor) > 85
          ? aClub.secondaryColor
          : '#f8fafc'
        : aClub.primaryColor;
      const awayStroke = kitsClash
        ? aClub.primaryColor
        : aClub.secondaryColor || '#0f172a';

      const markerR = Math.max(7.2, Math.min(10.5, width / 66));

      const drawPlayer = (
        pt: Vec2,
        num: number,
        fill: string,
        stroke: string,
        isGk: boolean,
      ) => {
        const px = toPx(pt);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(
          px.x,
          px.y + markerR * 0.85,
          markerR * 0.85,
          markerR * 0.4,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.fillStyle = isGk ? '#facc15' : fill;
        ctx.strokeStyle = isGk ? '#0f172a' : stroke;
        ctx.lineWidth = 1.9;
        ctx.beginPath();
        ctx.arc(px.x, px.y, markerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isGk ? '#0f172a' : getContrastText(fill);
        ctx.font = `700 ${Math.round(markerR * 1.02)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(num), px.x, px.y + 0.5);
      };

      for (let i = 0; i < 11; i += 1) {
        drawPlayer(homePos[i], i + 1, homeFill, homeStroke, i === 0);
        drawPlayer(awayPos[i], i + 1, awayFill, awayStroke, i === 0);
      }

      // Ball trail (with aerial height offset)
      for (let i = 0; i < ballTrail.length; i += 1) {
        const entry = ballTrail[i];
        const tp = toPx(entry);
        const alpha = ((i + 1) / ballTrail.length) * (inSlowMo ? 0.45 : 0.25);
        ctx.fillStyle = inSlowMo
          ? `rgba(254,240,138,${alpha})`
          : `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(
          tp.x,
          tp.y - entry.lift * 12,
          (inSlowMo ? 3.2 : 2.5) * (1 + entry.lift * 0.45),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      // Ball with genuine aerial height (detached ground shadow + larger radius at parabola apex)
      const bp = toPx(ball);
      const liftOffsetPx = ballLift * 14;
      const ballRadius = (inSlowMo ? 5.0 : 4.4) * (1 + ballLift * 0.65);

      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.18, 0.42 - ballLift * 0.16)})`;
      ctx.beginPath();
      ctx.ellipse(
        bp.x,
        bp.y + 4.5,
        4.6 + ballLift * 2.2,
        2.2 + ballLift * 0.8,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y - liftOffsetPx, ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (varOffsideLine && varOffsideLine.alpha > 0.02) {
        const vx = padX + varOffsideLine.x * pw;
        ctx.save();
        ctx.globalAlpha = varOffsideLine.alpha;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(vx, padY);
        ctx.lineTo(vx, padY + ph);
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(vx - 3, padY);
        ctx.lineTo(vx - 3, padY + ph);
        ctx.stroke();
        ctx.restore();
      }

      if (varBanner && varBanner.alpha > 0.02) {
        ctx.save();
        ctx.globalAlpha = varBanner.alpha;
        const bw = Math.min(width * 0.84, 340);
        const bh = 58;
        const bx = (width - bw) / 2;
        const by = (height - bh) / 2;

        ctx.fillStyle = 'rgba(24, 10, 38, 0.95)';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e9d5ff';
        ctx.font = '900 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `📺 VAR 판독 · ${varBanner.teamShort} ${varBanner.minute}'`,
          width / 2,
          by + 18,
        );

        ctx.fillStyle = '#fb7185';
        ctx.font = '900 13px system-ui, sans-serif';
        ctx.fillText(
          `🚩 오프사이드! ${varBanner.scorer} 득점 취소`,
          width / 2,
          by + 40,
        );
        ctx.restore();
      } else if (goalBanner && goalBanner.alpha > 0.02) {
        ctx.save();
        ctx.globalAlpha = goalBanner.alpha;
        const bw = Math.min(width * 0.82, 340);
        const bh = goalBanner.assist ? 62 : 52;
        const bx = (width - bw) / 2;
        const by = (height - bh) / 2;

        ctx.fillStyle = 'rgba(11, 16, 24, 0.94)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `⚽ GOAL! ${goalBanner.teamShort} · ${goalBanner.minute}' (${goalBanner.patternLabel})`,
          width / 2,
          by + 16,
        );

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.fillText(
          goalBanner.scorer,
          width / 2,
          by + (goalBanner.assist ? 35 : 37),
        );

        if (goalBanner.assist) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '600 10px system-ui, sans-serif';
          ctx.fillText(`도움: ${goalBanner.assist}`, width / 2, by + 51);
        }
        ctx.restore();
      } else if (topAlertPill) {
        ctx.save();
        const bw = Math.min(width * 0.8, 300);
        const bh = 28;
        const bx = (width - bw) / 2;
        const by = padY + 8;

        ctx.fillStyle = 'rgba(11, 16, 24, 0.92)';
        ctx.strokeStyle = topAlertPill.border;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 999);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = topAlertPill.color;
        ctx.font = '800 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(topAlertPill.text, width / 2, by + bh / 2 + 0.5);
        ctx.restore();
      }

      animId = window.requestAnimationFrame(renderFrame);
    };

    animId = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0b1018] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-3 py-1.5 text-[11px]">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border border-white/40"
            style={{ backgroundColor: homeClub.primaryColor }}
          />
          <span className="font-bold text-slate-200">{homeClub.shortName}</span>
          <span className="text-slate-600">→</span>
          <span className="text-slate-400 text-[10px]">
            2D 매치 엔진 (10종 전술·리바운드·PK·VAR + 슬로우모션)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-600">←</span>
          <span className="font-bold text-slate-200">{awayClub.shortName}</span>
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border border-white/40"
            style={{ backgroundColor: awayClub.primaryColor }}
          />
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-[200px] sm:h-[225px] lg:h-[245px] xl:h-[270px] max-h-[36vh]"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  );
}

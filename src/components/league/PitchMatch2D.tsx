import { useEffect, useRef } from 'react';
import { FORMATIONS } from '../../data/formations';
import type { FormationId } from '../../types/game';
import type {
  Club,
  HighlightOutcomeType,
  HighlightPatternId,
  MatchEvent,
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
  dramaticEvent: DramaticHighlightPayload | null;
}

interface Vec2 {
  x: number;
  y: number;
}

interface ActiveSequence {
  key: string;
  pattern: HighlightPatternId;
  outcome: HighlightOutcomeType;
  isHomeAttack: boolean;
  flankSide: 1 | -1; // -1 = top flank, +1 = bottom flank
  startTime: number;
  durationMs: number;
  attackerIdx: number;
  passerIdx: number;
  targetY: number;
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
};

const ALL_PATTERNS: HighlightPatternId[] = [
  'wing_cross_header',
  'cutback_finish',
  'through_ball_1v1',
  'cut_inside_curler',
  'corner_kick',
  'direct_free_kick',
  'high_press_counter',
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
    } else if (ev.type === 'goal') {
      outcome = 'goal';
    } else if (ev.type === 'save') {
      outcome = 'save';
    } else {
      const rem = seed % 3;
      outcome = rem === 0 ? 'woodwork' : rem === 1 ? 'blocked' : 'near_miss';
    }

    const flankSide: 1 | -1 = seed % 2 === 0 ? -1 : 1;

    sequenceRef.current = {
      key: dramaticEvent.key,
      pattern,
      outcome,
      isHomeAttack,
      flankSide,
      startTime: performance.now(),
      durationMs: DRAMATIC_TOTAL_MS,
      attackerIdx: 8 + (seed % 3),
      passerIdx: 5 + (seed % 3),
      targetY:
        outcome === 'woodwork'
          ? flankSide < 0
            ? 0.405
            : 0.595
          : pattern === 'direct_free_kick' || pattern === 'cut_inside_curler'
            ? flankSide < 0
              ? 0.57
              : 0.43
            : 0.43 + ((seed % 5) / 4) * 0.14,
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
      let topAlertPill: { text: string; color: string; border: string } | null =
        null;
      let pitchFlashAlpha = 0;

      // Custom per-player overrides during the 7 specialized highlight patterns
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

        const patternLabel = PATTERN_BADGE_LABELS[seq.pattern];

        // Compute shot origin & trajectory according to the exact pattern
        let shotOrigin: Vec2 = { x: atkX(isH, 0.84), y: seq.targetY };
        let shotControl: Vec2 = { x: atkX(isH, 0.9), y: seq.targetY };

        if (seq.pattern === 'wing_cross_header') {
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
          seq.pattern === 'direct_free_kick'
            ? 0.25
            : seq.pattern === 'corner_kick'
              ? 0.32
              : seq.pattern === 'cut_inside_curler'
                ? 0.28
                : 0.30;

        if (seqProg < buildupEnd) {
          topAlertPill = {
            text: `🔥 ${seq.teamShortName} · ${patternLabel} · SLOW-MO`,
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
            seq.pattern === 'cut_inside_curler'
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
          // Phase 3: Outcome Reveal (5 varied outcomes!)
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
              text: `🧤 슈퍼 세이브! (${patternLabel})`,
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
              text: `⚡ 간발의 빗나감! (${patternLabel})`,
              color: '#cbd5e1',
              border: '#64748b',
            };
          }
        }
      } else if (isLiveRunning) {
        if (simClock >= nextPassClock) {
          nextPassClock =
            simClock + 0.55 + Math.abs(Math.sin(simClock * 3.1)) * 0.55;
          const keepHome = Math.random() * 100 < curPoss;
          if (keepHome !== possessionIsHome) {
            possessionIsHome = keepHome;
            carrierIdx = 4 + Math.floor(Math.random() * 5);
          } else {
            const nextIdx = 1 + Math.floor(Math.random() * 10);
            carrierIdx = nextIdx === carrierIdx ? (nextIdx % 10) + 1 : nextIdx;
          }
        }
        const carrier = possessionIsHome
          ? homePos[carrierIdx]
          : awayPos[carrierIdx];
        ballTargetX = carrier.x + (possessionIsHome ? 0.015 : -0.015);
        ballTargetY = carrier.y;
      } else {
        ballTargetX = 0.5;
        ballTargetY = 0.5;
      }

      const ballLerp = seq
        ? inSlowMo
          ? 1 - Math.exp(-8.5 * dt)
          : 1 - Math.exp(-18 * dt)
        : 1 - Math.exp(-8 * dt * speedMult);
      ball.x = lerp(ball.x, ballTargetX, ballLerp);
      ball.y = lerp(ball.y, ballTargetY, ballLerp);

      ballTrail.push({ x: ball.x, y: ball.y, lift: ballLift });
      if (ballTrail.length > (inSlowMo ? 15 : 9)) ballTrail.shift();

      const ballShiftX = (ball.x - 0.5) * 0.34;
      const ballShiftY = (ball.y - 0.5) * 0.14;
      const playerLerp =
        1 - Math.exp(-(inSlowMo ? 5.2 : 5.5) * dt * (seq ? 1.15 : speedMult));

      for (let i = 0; i < 11; i += 1) {
        let hx = homeBase[i].x;
        let hy = homeBase[i].y;

        if (i === 0) {
          hx = 0.055 + Math.max(0, ball.x - 0.5) * 0.05;
          hy = 0.5 + (ball.y - 0.5) * 0.28;
          if (seq && !seq.isHomeAttack && seqProg >= 0.42) {
            hy = seq.targetY;
          }
        } else {
          const lineFactor = i >= 8 ? 1.15 : i >= 5 ? 1.0 : 0.78;
          hx = Math.max(
            0.12,
            Math.min(
              0.9,
              hx +
                ballShiftX * lineFactor +
                Math.sin(simClock * 1.4 + i * 1.7) * 0.014,
            ),
          );
          hy = Math.max(
            0.07,
            Math.min(
              0.93,
              hy + ballShiftY + Math.cos(simClock * 1.2 + i * 2.1) * 0.018,
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

        if (i === 0) {
          ax = 0.945 - Math.max(0, 0.5 - ball.x) * 0.05;
          ay = 0.5 + (ball.y - 0.5) * 0.28;
          if (seq && seq.isHomeAttack && seqProg >= 0.42) {
            ay = seq.targetY;
          }
        } else {
          const lineFactor = i >= 8 ? 1.15 : i >= 5 ? 1.0 : 0.78;
          ax = Math.max(
            0.1,
            Math.min(
              0.88,
              ax +
                ballShiftX * lineFactor +
                Math.cos(simClock * 1.3 + i * 1.9) * 0.014,
            ),
          );
          ay = Math.max(
            0.07,
            Math.min(
              0.93,
              ay + ballShiftY + Math.sin(simClock * 1.1 + i * 2.3) * 0.018,
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

      if (goalBanner && goalBanner.alpha > 0.02) {
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
            2D 매치 엔진 (7종 공격·세트피스 + 자동 슬로우모션)
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
        className="relative w-full h-[215px] sm:h-[250px]"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  );
}

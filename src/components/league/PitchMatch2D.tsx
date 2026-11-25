import { memo, useEffect, useRef, useState } from 'react';
import {
  createPitchSimState,
  FIXED_DT,
  MAX_FRAME_DELTA,
  stepPitchSim,
  syncPitchSimConfig,
  syncPitchSimTargetsOnly,
} from '../../engine/pitchSimEngine';
import type {
  PitchFinalTheme,
  PitchSimLiveMetrics,
  PitchSimState,
  PitchSimTeamInput,
  SimVec2,
  TacticalPhaseLabel,
} from '../../engine/pitchSimTypes';
import type { ChemistryResult, FormationId, ManagerTraitId } from '../../types/game';
import type {
  AttackRouteId,
  Club,
  HighlightPatternId,
  MatchEvent,
  TacticId,
} from '../../types/league';
import type { Player } from '../../types/player';

export interface DramaticHighlightPayload {
  key: string;
  event: MatchEvent;
  revealed: boolean;
}

/** Legacy compatibility constants (kept for external references) */
export const DRAMATIC_REVEAL_MS = 1150;
export const DRAMATIC_TOTAL_MS = 2050;

export interface PitchMatch2DProps {
  simSessionKey: string;
  simSeed: string;
  homeClub: Club;
  awayClub: Club;
  homeFormation: FormationId;
  awayFormation: FormationId;
  homeTactic: TacticId;
  awayTactic: TacticId;
  homeStarters: (Player | null)[];
  awayStarters: (Player | null)[];
  homeChemistry?: ChemistryResult | null;
  awayChemistry?: ChemistryResult | null;
  homeManagerTraitId?: ManagerTraitId | null;
  awayManagerTraitId?: ManagerTraitId | null;
  homeManagerOvr?: number;
  awayManagerOvr?: number;
  homeEnteredAtMinute?: Record<string, number>;
  awayEnteredAtMinute?: Record<string, number>;
  homeHalftimeAdjusted?: boolean;
  awayHalftimeAdjusted?: boolean;
  homeTacticalCounterSeverity?: number;
  awayTacticalCounterSeverity?: number;
  startMinute: number;
  endMinute: number;
  half: 1 | 2;
  phase: 'first_half' | 'halftime' | 'second_half';
  isFullTime: boolean;
  paused?: boolean;
  speed: 1 | 2 | 4;
  homePossession: number;
  homeShots?: number;
  awayShots?: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  homeXg?: number;
  awayXg?: number;
  initialLiveMetrics?: Partial<PitchSimLiveMetrics>;
  homeGoalsSoFar?: number;
  awayGoalsSoFar?: number;
  isBigMatch?: boolean;
  isKnockoutDecider?: boolean;
  aggHomeBeforeMatch?: number;
  aggAwayBeforeMatch?: number;
  finalTheme?: PitchFinalTheme;
  scheduledEvents: { key: string; event: MatchEvent }[];
  preHandledKeys?: string[];
  onMinuteChange?: (minute: number) => void;
  onEventReveal?: (eventKey: string) => void;
  onHighlightActiveChange?: (active: boolean) => void;
  onLiveMetricsChange?: (metrics: PitchSimLiveMetrics) => void;
  onHalfComplete?: () => void;
}

const PATTERN_BADGE_LABELS: Record<HighlightPatternId, string> = {
  wing_cross_header: '측면 크로스 & 헤더',
  cutback_finish: '엔드라인 컷백',
  through_ball_1v1: '스루패스 침투',
  cut_inside_curler: '컷인 감아차기',
  corner_kick: '코너킥',
  direct_free_kick: '직접 프리킥',
  high_press_counter: '전방 압박 역습',
  u_buildup_switch: '반대전환 빌드업',
  rebound_finish: '세컨볼 마무리',
  penalty_kick: '페널티킥',
};

const ROUTE_BADGE_LABELS: Partial<Record<AttackRouteId, string>> = {
  solo_dribble: '원맨 드리블 돌파',
  long_range_cannon: '중거리 슈팅',
  tiki_taka_triangle: '삼자 패스 연계',
  low_block_counter: '선수비 후역습',
};

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export const PitchMatch2D = memo(function PitchMatch2D({
  simSessionKey,
  simSeed,
  homeClub,
  awayClub,
  homeFormation,
  awayFormation,
  homeTactic,
  awayTactic,
  homeStarters,
  awayStarters,
  homeChemistry = null,
  awayChemistry = null,
  homeManagerTraitId = null,
  awayManagerTraitId = null,
  homeManagerOvr = 84,
  awayManagerOvr = 84,
  homeEnteredAtMinute,
  awayEnteredAtMinute,
  homeHalftimeAdjusted = false,
  awayHalftimeAdjusted = false,
  homeTacticalCounterSeverity = 0,
  awayTacticalCounterSeverity = 0,
  startMinute,
  endMinute,
  half,
  phase,
  isFullTime,
  paused = false,
  speed,
  homePossession,
  homeShots = 0,
  awayShots = 0,
  homeShotsOnTarget,
  awayShotsOnTarget,
  homeXg = 0,
  awayXg = 0,
  initialLiveMetrics,
  homeGoalsSoFar = 0,
  awayGoalsSoFar = 0,
  isBigMatch = false,
  isKnockoutDecider = false,
  aggHomeBeforeMatch = 0,
  aggAwayBeforeMatch = 0,
  finalTheme = 'none',
  scheduledEvents,
  preHandledKeys = [],
  onMinuteChange,
  onEventReveal,
  onHighlightActiveChange,
  onLiveMetricsChange,
  onHalfComplete,
}: PitchMatch2DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<PitchSimState | null>(null);
  const sessionKeyRef = useRef<string | null>(null);
  const accumulatorRef = useRef<number>(0);

  const [phaseBadge, setPhaseBadge] = useState<{
    label: TacticalPhaseLabel;
    isHome: boolean;
  }>({ label: '후방 빌드업', isHome: true });

  const callbacksRef = useRef({
    onMinuteChange,
    onEventReveal,
    onHighlightActiveChange,
    onLiveMetricsChange,
    onHalfComplete,
  });
  useEffect(() => {
    callbacksRef.current = {
      onMinuteChange,
      onEventReveal,
      onHighlightActiveChange,
      onLiveMetricsChange,
      onHalfComplete,
    };
  }, [
    onMinuteChange,
    onEventReveal,
    onHighlightActiveChange,
    onLiveMetricsChange,
    onHalfComplete,
  ]);

  const livePropsRef = useRef({
    homeClub,
    awayClub,
    phase,
    isFullTime,
    paused,
    speed,
    finalTheme,
  });
  useEffect(() => {
    livePropsRef.current = {
      homeClub,
      awayClub,
      phase,
      isFullTime,
      paused,
      speed,
      finalTheme,
    };
  }, [homeClub, awayClub, phase, isFullTime, paused, speed, finalTheme]);

  const targetsRef = useRef({
    homePossession,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homeXg,
    awayXg,
    initialLiveMetrics,
    homeGoalsSoFar,
    awayGoalsSoFar,
  });
  useEffect(() => {
    targetsRef.current = {
      homePossession,
      homeShots,
      awayShots,
      homeShotsOnTarget,
      awayShotsOnTarget,
      homeXg,
      awayXg,
      initialLiveMetrics,
      homeGoalsSoFar,
      awayGoalsSoFar,
    };
    if (simRef.current && sessionKeyRef.current === simSessionKey) {
      syncPitchSimTargetsOnly(simRef.current, {
        targetHomePossession: homePossession,
        homeShotsTarget: homeShots,
        awayShotsTarget: awayShots,
        homeShotsOnTargetTarget: homeShotsOnTarget,
        awayShotsOnTargetTarget: awayShotsOnTarget,
        homeXgTarget: homeXg,
        awayXgTarget: awayXg,
      });
    }
  }, [
    simSessionKey,
    homePossession,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homeXg,
    awayXg,
    initialLiveMetrics,
    homeGoalsSoFar,
    awayGoalsSoFar,
  ]);

  // Initialize or hot-sync structural simulation state ONLY when tactical/roster/session props change
  useEffect(() => {
    const homeTeamInput: PitchSimTeamInput = {
      formation: homeFormation,
      tactic: homeTactic,
      starters: homeStarters,
      chemistry: homeChemistry,
      managerTraitId: homeManagerTraitId,
      managerOvr: homeManagerOvr,
      enteredAtMinute: homeEnteredAtMinute,
      halftimeAdjusted: homeHalftimeAdjusted,
      tacticalCounterSeverity: homeTacticalCounterSeverity,
    };
    const awayTeamInput: PitchSimTeamInput = {
      formation: awayFormation,
      tactic: awayTactic,
      starters: awayStarters,
      chemistry: awayChemistry,
      managerTraitId: awayManagerTraitId,
      managerOvr: awayManagerOvr,
      enteredAtMinute: awayEnteredAtMinute,
      halftimeAdjusted: awayHalftimeAdjusted,
      tacticalCounterSeverity: awayTacticalCounterSeverity,
    };
    const t = targetsRef.current;

    if (sessionKeyRef.current !== simSessionKey || !simRef.current) {
      sessionKeyRef.current = simSessionKey;
      accumulatorRef.current = 0;
      simRef.current = createPitchSimState({
        seed: simSeed,
        homeTeamId: homeClub.id,
        awayTeamId: awayClub.id,
        home: homeTeamInput,
        away: awayTeamInput,
        startMinute,
        endMinute,
        half,
        targetHomePossession: t.homePossession,
        homeShotsTarget: t.homeShots,
        awayShotsTarget: t.awayShots,
        homeShotsOnTargetTarget: t.homeShotsOnTarget,
        awayShotsOnTargetTarget: t.awayShotsOnTarget,
        homeXgTarget: t.homeXg,
        awayXgTarget: t.awayXg,
        initialLiveMetrics: t.initialLiveMetrics,
        homeGoalsSoFar: t.homeGoalsSoFar,
        awayGoalsSoFar: t.awayGoalsSoFar,
        isBigMatch: isBigMatch || finalTheme !== 'none',
        isKnockoutDecider,
        aggHomeBeforeMatch,
        aggAwayBeforeMatch,
        events: scheduledEvents,
        preHandledKeys,
      });
    } else {
      syncPitchSimConfig(simRef.current, {
        home: homeTeamInput,
        away: awayTeamInput,
        targetHomePossession: t.homePossession,
        homeShotsTarget: t.homeShots,
        awayShotsTarget: t.awayShots,
        homeShotsOnTargetTarget: t.homeShotsOnTarget,
        awayShotsOnTargetTarget: t.awayShotsOnTarget,
        homeXgTarget: t.homeXg,
        awayXgTarget: t.awayXg,
        events: scheduledEvents,
      });
    }
  }, [
    simSessionKey,
    simSeed,
    homeClub.id,
    awayClub.id,
    homeFormation,
    awayFormation,
    homeTactic,
    awayTactic,
    homeStarters,
    awayStarters,
    homeChemistry,
    awayChemistry,
    homeManagerTraitId,
    awayManagerTraitId,
    homeManagerOvr,
    awayManagerOvr,
    homeEnteredAtMinute,
    awayEnteredAtMinute,
    homeHalftimeAdjusted,
    awayHalftimeAdjusted,
    homeTacticalCounterSeverity,
    awayTacticalCounterSeverity,
    startMinute,
    endMinute,
    half,
    isBigMatch,
    isKnockoutDecider,
    aggHomeBeforeMatch,
    aggAwayBeforeMatch,
    finalTheme,
    scheduledEvents,
    preHandledKeys,
  ]);

  // Fixed-Timestep Accumulator Loop + Crisp Tactical 2D Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let width = container.clientWidth || 640;
    let height = container.clientHeight || 250;
    let currentDpr = Math.min(window.devicePixelRatio || 1, 2);
    let pitchCacheCanvas: HTMLCanvasElement | null = null;
    let pitchCacheKey = '';

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(300, Math.round(rect.width));
      height = Math.max(190, Math.round(rect.height));
      currentDpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * currentDpr);
      canvas.height = Math.round(height * currentDpr);
      pitchCacheKey = '';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let animId = 0;
    let lastTs = performance.now();
    let activeLoopSession: string | null = null;
    let lastNotifiedMin = -1;
    let lastNotifiedHighlight = false;
    let lastCompletedSession: string | null = null;
    let lastBadgeLabel: TacticalPhaseLabel = '후방 빌드업';
    let lastBadgeHome = true;
    let lastMetricsSig = '';
    let lastMetricsEmitMs = 0;
    const emittedReveals = new Set<string>();

    const drawStaticPitchBase = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      padX: number,
      padY: number,
      theme: PitchFinalTheme,
    ) => {
      const pw = w - padX * 2;
      const ph = h - padY * 2;

      // Outer surround
      ctx.fillStyle =
        theme === 'ucl_final'
          ? '#081224'
          : theme === 'cup_final'
            ? '#0c1219'
            : '#0a1412';
      ctx.fillRect(0, 0, w, h);

      // Clean mowed grass stripes (FM 2D Classic restrained tone)
      const stripeCount = 12;
      const stripeW = pw / stripeCount;
      for (let i = 0; i < stripeCount; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? '#0f3d2b' : '#0d3626';
        ctx.fillRect(padX + i * stripeW, padY, stripeW + 0.5, ph);
      }

      // Subtle tactical third & half-space reference guides (very faint, broadcast analysis feel)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      for (const tx of [1 / 3, 2 / 3]) {
        ctx.beginPath();
        ctx.moveTo(padX + pw * tx, padY);
        ctx.lineTo(padX + pw * tx, padY + ph);
        ctx.stroke();
      }
      for (const ty of [0.22, 0.78]) {
        ctx.beginPath();
        ctx.moveTo(padX, padY + ph * ty);
        ctx.lineTo(padX + pw, padY + ph * ty);
        ctx.stroke();
      }
      ctx.restore();

      // Main pitch lines
      ctx.strokeStyle =
        theme !== 'none'
          ? 'rgba(248, 250, 252, 0.42)'
          : 'rgba(255, 255, 255, 0.34)';
      ctx.lineWidth = 1.3;
      ctx.strokeRect(padX, padY, pw, ph);

      const midX = padX + pw / 2;
      const midY = padY + ph / 2;
      ctx.beginPath();
      ctx.moveTo(midX, padY);
      ctx.lineTo(midX, padY + ph);
      ctx.stroke();

      const centerR = Math.min(pw, ph) * 0.165;
      ctx.beginPath();
      ctx.arc(midX, midY, centerR, 0, Math.PI * 2);
      ctx.stroke();

      // Restrained final center-circle gold hairline
      if (theme !== 'none') {
        ctx.save();
        ctx.strokeStyle =
          theme === 'ucl_final'
            ? 'rgba(251, 191, 36, 0.34)'
            : 'rgba(245, 158, 11, 0.30)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(midX, midY, centerR - 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.52)';
      ctx.beginPath();
      ctx.arc(midX, midY, 2.3, 0, Math.PI * 2);
      ctx.fill();

      const penW = pw * 0.155;
      const penH = ph * 0.56;
      const sixW = pw * 0.055;
      const sixH = ph * 0.26;

      ctx.strokeRect(padX, midY - penH / 2, penW, penH);
      ctx.strokeRect(padX, midY - sixH / 2, sixW, sixH);
      ctx.strokeRect(padX + pw - penW, midY - penH / 2, penW, penH);
      ctx.strokeRect(padX + pw - sixW, midY - sixH / 2, sixW, sixH);

      // Penalty spots
      ctx.beginPath();
      ctx.arc(padX + penW * 0.70, midY, 1.8, 0, Math.PI * 2);
      ctx.arc(padX + pw - penW * 0.70, midY, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Penalty arcs
      ctx.beginPath();
      ctx.arc(padX + penW * 0.70, midY, centerR * 0.72, -0.66, 0.66);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(
        padX + pw - penW * 0.70,
        midY,
        centerR * 0.72,
        Math.PI - 0.66,
        Math.PI + 0.66,
      );
      ctx.stroke();

      // Corner arcs
      const cornerR = 6.5;
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

      // Championship Final restrained gold corner brackets around surround
      if (theme !== 'none') {
        const bracketLen = 14;
        const inset = 4;
        ctx.save();
        ctx.strokeStyle =
          theme === 'ucl_final'
            ? 'rgba(251, 191, 36, 0.68)'
            : 'rgba(245, 158, 11, 0.62)';
        ctx.lineWidth = 1.6;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(inset, inset + bracketLen);
        ctx.lineTo(inset, inset);
        ctx.lineTo(inset + bracketLen, inset);
        // Top-right
        ctx.moveTo(w - inset - bracketLen, inset);
        ctx.lineTo(w - inset, inset);
        ctx.lineTo(w - inset, inset + bracketLen);
        // Bottom-left
        ctx.moveTo(inset, h - inset - bracketLen);
        ctx.lineTo(inset, h - inset);
        ctx.lineTo(inset + bracketLen, h - inset);
        // Bottom-right
        ctx.moveTo(w - inset - bracketLen, h - inset);
        ctx.lineTo(w - inset, h - inset);
        ctx.lineTo(w - inset, h - inset - bracketLen);
        ctx.stroke();
        ctx.restore();
      }

    };

    const drawPitchSurface = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      padX: number,
      padY: number,
      goalRipple: { side: 'left' | 'right'; intensity: number } | null,
      theme: PitchFinalTheme,
    ) => {
      const pw = w - padX * 2;
      const ph = h - padY * 2;
      const midY = padY + ph / 2;
      const nextCacheKey = `${w}x${h}@${currentDpr}:${theme}`;

      if (!pitchCacheCanvas || pitchCacheKey !== nextCacheKey) {
        if (!pitchCacheCanvas) {
          pitchCacheCanvas = document.createElement('canvas');
        }
        pitchCacheCanvas.width = Math.round(w * currentDpr);
        pitchCacheCanvas.height = Math.round(h * currentDpr);
        const cacheCtx = pitchCacheCanvas.getContext('2d');
        if (cacheCtx) {
          cacheCtx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
          drawStaticPitchBase(cacheCtx, w, h, padX, padY, theme);
          pitchCacheKey = nextCacheKey;
        }
      }

      if (pitchCacheCanvas && pitchCacheKey === nextCacheKey) {
        ctx.drawImage(pitchCacheCanvas, 0, 0, w, h);
      } else {
        drawStaticPitchBase(ctx, w, h, padX, padY, theme);
      }

      // Dynamic Goal Nets (only animated when goalRipple fires)
      const goalH = ph * 0.2;
      const goalD = Math.max(7, padX * 0.62);

      const drawGoalNet = (side: 'left' | 'right') => {
        const isRippling = goalRipple && goalRipple.side === side;
        const rippleOffset = isRippling
          ? Math.sin(goalRipple.intensity * Math.PI * 6) * 4 * goalRipple.intensity
          : 0;

        ctx.save();
        ctx.strokeStyle = isRippling
          ? 'rgba(251, 191, 36, 0.95)'
          : 'rgba(255, 255, 255, 0.62)';
        ctx.fillStyle = isRippling
          ? 'rgba(251, 191, 36, 0.22)'
          : 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = isRippling ? 2 : 1.3;

        const gx = side === 'left' ? padX - goalD - rippleOffset : padX + pw;
        const gw = goalD + Math.abs(rippleOffset);
        const gy = midY - goalH / 2;

        ctx.fillRect(gx, gy, gw, goalH);
        ctx.strokeRect(gx, gy, gw, goalH);

        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
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
      const sim = simRef.current;
      if (!ctx || !sim) {
        animId = window.requestAnimationFrame(renderFrame);
        return;
      }

      if (activeLoopSession !== sessionKeyRef.current) {
        activeLoopSession = sessionKeyRef.current;
        lastNotifiedMin = -1;
        lastNotifiedHighlight = false;
        lastMetricsSig = '';
        lastMetricsEmitMs = 0;
        emittedReveals.clear();
      }

      const rawDelta = Math.max(0, (now - lastTs) / 1000);
      lastTs = now;
      const frameDelta = Math.min(MAX_FRAME_DELTA, rawDelta);

      const {
        homeClub: hClub,
        awayClub: aClub,
        phase: curPhase,
        isFullTime: curFT,
        paused: curPaused,
        speed: curSpeed,
        finalTheme: curFinalTheme,
      } = livePropsRef.current;

      const isLiveRunning =
        (curPhase === 'first_half' || curPhase === 'second_half') &&
        !curFT &&
        !curPaused;

      // Glenn Fiedler Fixed-Timestep Accumulator:
      // 1x / 2x / 4x multiplies ONLY time accumulation -> ZERO skipped physics ticks!
      let revealedThisFrame = false;
      if (isLiveRunning && !sim.completed) {
        accumulatorRef.current += frameDelta * curSpeed;
        let safetySteps = 0;
        while (accumulatorRef.current >= FIXED_DT && !sim.completed && safetySteps < 20) {
          stepPitchSim(sim, FIXED_DT);
          accumulatorRef.current -= FIXED_DT;
          safetySteps += 1;

          // Emit exact-frame event reveals (zero spoilers before impact)
          if (sim.director && sim.director.revealed && !emittedReveals.has(sim.director.key)) {
            emittedReveals.add(sim.director.key);
            revealedThisFrame = true;
            callbacksRef.current.onEventReveal?.(sim.director.key);
          }
        }
        if (sim.completed) {
          accumulatorRef.current = 0;
        }
      }

      // Discrete React notifications (never 60fps!)
      const intMin = Math.min(sim.endMinute, Math.floor(sim.matchMinuteFloat));
      if (intMin !== lastNotifiedMin) {
        lastNotifiedMin = intMin;
        callbacksRef.current.onMinuteChange?.(intMin);
      }

      const highlightActive = Boolean(sim.director && !sim.director.revealed);
      if (highlightActive !== lastNotifiedHighlight) {
        lastNotifiedHighlight = highlightActive;
        callbacksRef.current.onHighlightActiveChange?.(highlightActive);
      }

      // Emit real-time 2D-synced match stats only when values change (throttled ≤2Hz, immediate on reveal/completion)
      const lm = sim.liveMetrics;
      const metricsSig = `${lm.homePossession}|${lm.homeShots}|${lm.awayShots}|${lm.homeShotsOnTarget}|${lm.awayShotsOnTarget}|${lm.homeSaves}|${lm.awaySaves}|${lm.homeXg.toFixed(2)}|${lm.awayXg.toFixed(2)}`;
      if (
        metricsSig !== lastMetricsSig &&
        (revealedThisFrame || sim.completed || now - lastMetricsEmitMs >= 450)
      ) {
        lastMetricsSig = metricsSig;
        lastMetricsEmitMs = now;
        callbacksRef.current.onLiveMetricsChange?.({ ...lm });
      }

      if (
        sim.tacticalLabel !== lastBadgeLabel ||
        sim.tacticalLabelTeamIsHome !== lastBadgeHome
      ) {
        lastBadgeLabel = sim.tacticalLabel;
        lastBadgeHome = sim.tacticalLabelTeamIsHome;
        setPhaseBadge({ label: sim.tacticalLabel, isHome: sim.tacticalLabelTeamIsHome });
      }

      if (sim.completed && lastCompletedSession !== sessionKeyRef.current) {
        lastCompletedSession = sessionKeyRef.current;
        callbacksRef.current.onLiveMetricsChange?.({ ...sim.liveMetrics });
        callbacksRef.current.onHalfComplete?.();
      }

      // Interpolation alpha for silky rendering at any display refresh rate
      const alpha = isLiveRunning && !sim.completed
        ? Math.max(0, Math.min(1, accumulatorRef.current / FIXED_DT))
        : 1;

      const padX = Math.max(14, width * 0.032);
      const padY = Math.max(10, height * 0.05);
      const pw = width - padX * 2;
      const ph = height - padY * 2;
      const toPx = (pt: SimVec2): SimVec2 => ({
        x: padX + pt.x * pw,
        y: padY + pt.y * ph,
      });

      drawPitchSurface(ctx, width, height, padX, padY, sim.goalRipple, curFinalTheme);

      // Subtle vignette only during active shot flight
      const inShotFlight = sim.director?.stage === 'shot_flight';
      if (inShotFlight) {
        const bx = lerp(sim.ball.prevX, sim.ball.x, alpha);
        const by = lerp(sim.ball.prevY, sim.ball.y, alpha);
        const bpV = toPx({ x: bx, y: by });
        const grad = ctx.createRadialGradient(
          bpV.x,
          bpV.y,
          Math.min(pw, ph) * 0.22,
          bpV.x,
          bpV.y,
          Math.max(pw, ph) * 0.78,
        );
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(2, 6, 23, 0.30)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      if (sim.pitchFlashAlpha > 0.01) {
        ctx.fillStyle = `rgba(251, 191, 36, ${sim.pitchFlashAlpha})`;
        ctx.fillRect(padX, padY, pw, ph);
      }

      // Restrained tactical run indicators (Third-Man Run & penetrating sprints)
      for (const ind of sim.runIndicators) {
        const p0 = toPx(ind.from);
        const p1 = toPx(ind.to);
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        ctx.save();
        ctx.strokeStyle = ind.color;
        ctx.globalAlpha = ind.alpha * 0.75;
        ctx.lineWidth = ind.isThirdMan ? 1.7 : 1.25;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        // Minimal arrowhead
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(
          p1.x - Math.cos(angle - 0.5) * 5.5,
          p1.y - Math.sin(angle - 0.5) * 5.5,
        );
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(
          p1.x - Math.cos(angle + 0.5) * 5.5,
          p1.y - Math.sin(angle + 0.5) * 5.5,
        );
        ctx.stroke();
        ctx.restore();
      }

      // Thin pass/shot curve arc guide
      if (sim.passArc && sim.passArc.alpha > 0.03) {
        const p0 = toPx(sim.passArc.p0);
        const p1 = toPx(sim.passArc.p1);
        const p2 = toPx(sim.passArc.p2);
        ctx.save();
        ctx.strokeStyle = sim.passArc.color;
        ctx.globalAlpha = sim.passArc.alpha;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      }

      if (sim.impactRing && sim.impactRing.alpha > 0.02) {
        const ip = toPx({ x: sim.impactRing.x, y: sim.impactRing.y });
        ctx.save();
        ctx.strokeStyle = sim.impactRing.color;
        ctx.globalAlpha = sim.impactRing.alpha;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(ip.x, ip.y, 9 + (1 - sim.impactRing.alpha) * 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Team kit contrast guard
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

      const markerR = Math.max(7.2, Math.min(10.2, width / 68));

      const drawPlayer = (
        agentIdx: number,
        isHome: boolean,
        fill: string,
        stroke: string,
      ) => {
        const agent = (isHome ? sim.homeAgents : sim.awayAgents)[agentIdx];
        const ix = lerp(agent.prevX, agent.x, alpha);
        const iy = lerp(agent.prevY, agent.y, alpha);
        const px = toPx({ x: ix, y: iy });
        const isGk = agentIdx === 0;
        const isCarrier =
          sim.ball.ownerTeamIsHome === isHome && sim.ball.ownerIdx === agentIdx;

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(
          px.x,
          px.y + markerR * 0.85,
          markerR * 0.84,
          markerR * 0.38,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        // Subtle carrier highlight ring
        if (isCarrier) {
          ctx.save();
          ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(px.x, px.y, markerR + 3.0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Player disc
        ctx.fillStyle = isGk ? '#facc15' : fill;
        ctx.strokeStyle = isGk ? '#0f172a' : stroke;
        ctx.lineWidth = 1.75;
        ctx.beginPath();
        ctx.arc(px.x, px.y, markerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Subtle stamina fatigue arc on outfielders below 65%
        if (!isGk && agent.staminaPct < 65) {
          ctx.save();
          ctx.strokeStyle =
            agent.staminaPct < 40
              ? 'rgba(244, 63, 94, 0.9)'
              : agent.staminaPct < 55
                ? 'rgba(251, 146, 60, 0.85)'
                : 'rgba(250, 204, 21, 0.78)';
          ctx.lineWidth = 1.6;
          const frac = Math.max(0.15, agent.staminaPct / 100);
          ctx.beginPath();
          ctx.arc(
            px.x,
            px.y,
            markerR + 1.8,
            Math.PI * 0.5 - Math.PI * frac * 0.6,
            Math.PI * 0.5 + Math.PI * frac * 0.6,
          );
          ctx.stroke();
          ctx.restore();
        }

        // Shirt number
        ctx.fillStyle = isGk ? '#0f172a' : getContrastText(fill);
        ctx.font = `700 ${Math.round(markerR * 1.0)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(agentIdx + 1), px.x, px.y + 0.5);
      };

      for (let i = 0; i < 11; i += 1) {
        drawPlayer(i, true, homeFill, homeStroke);
        drawPlayer(i, false, awayFill, awayStroke);
      }

      // Single Source of Truth ball coordinates (interpolated cleanly between physics ticks)
      const BALL_Z_LIFT_PX = 9;
      const bx = lerp(sim.ball.prevX, sim.ball.x, alpha);
      const by = lerp(sim.ball.prevY, sim.ball.y, alpha);
      const bz = lerp(sim.ball.prevZ, sim.ball.z, alpha);
      const bp = toPx({ x: bx, y: by });
      const liftOffsetPx = bz * BALL_Z_LIFT_PX;
      const ballRadius = (inShotFlight ? 4.5 : 4.1) * (1 + bz * 0.28);

      // Subtle tapering motion streak ONLY when ball is genuinely in flight (never overlapping white dots!)
      if (sim.ball.ownerIdx === null && sim.ball.trail.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        const pts = sim.ball.trail;
        for (let i = 1; i < pts.length; i += 1) {
          const prevPt = pts[i - 1];
          const curPt = pts[i];
          // Safety discontinuity guard: never draw streak across a scene/set-piece reset
          if (Math.hypot(curPt.x - prevPt.x, curPt.y - prevPt.y) > 0.14) {
            continue;
          }
          const p0 = toPx(prevPt);
          const p1 = toPx(curPt);
          const frac = i / pts.length;
          const tAlpha = frac * (inShotFlight ? 0.34 : 0.18);
          ctx.strokeStyle = inShotFlight
            ? `rgba(254, 240, 138, ${tAlpha})`
            : `rgba(248, 250, 252, ${tAlpha})`;
          ctx.lineWidth = (inShotFlight ? 2.8 : 2.0) * frac;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y - prevPt.z * BALL_Z_LIFT_PX);
          ctx.lineTo(p1.x, p1.y - curPt.z * BALL_Z_LIFT_PX);
          ctx.stroke();
        }
        // Connect last trail sample smoothly to interpolated ball center
        const lastPt = pts[pts.length - 1];
        if (Math.hypot(bx - lastPt.x, by - lastPt.y) <= 0.14) {
          const lp = toPx(lastPt);
          ctx.strokeStyle = inShotFlight
            ? 'rgba(254, 240, 138, 0.36)'
            : 'rgba(248, 250, 252, 0.20)';
          ctx.lineWidth = inShotFlight ? 2.8 : 2.0;
          ctx.beginPath();
          ctx.moveTo(lp.x, lp.y - lastPt.z * BALL_Z_LIFT_PX);
          ctx.lineTo(bp.x, bp.y - liftOffsetPx);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Grounded shadow (distinct soft ellipse below ball so it never reads as a second ball)
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.12, 0.30 - bz * 0.14)})`;
      ctx.beginPath();
      ctx.ellipse(
        bp.x,
        bp.y + 3.2,
        3.8 + bz * 1.1,
        1.7 + bz * 0.4,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Strictly ONE crisp football entity
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y - liftOffsetPx, ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Restrained Director outcome overlays (zero premature spoilers)
      const dirCue = sim.director;
      if (dirCue) {
        const patternLabel =
          ROUTE_BADGE_LABELS[dirCue.attackRoute] ||
          PATTERN_BADGE_LABELS[dirCue.pattern];
        const teamShort = dirCue.isHomeAttack ? hClub.shortName : aClub.shortName;

        if (dirCue.stage === 'reveal') {
          const t = Math.min(1, dirCue.stageTimer / Math.max(0.1, dirCue.stageDuration));
          const fadeAlpha = t < 0.82 ? 1 : Math.max(0, (1 - t) / 0.18);

          if (dirCue.outcome === 'goal') {
            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            const bw = Math.min(width * 0.80, 320);
            const bh = dirCue.event.assistName ? 58 : 48;
            const bLeft = (width - bw) / 2;
            const bTop = (height - bh) / 2;

            ctx.fillStyle = 'rgba(11, 16, 24, 0.94)';
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.roundRect(bLeft, bTop, bw, bh, 10);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#fbbf24';
            ctx.font = '800 12px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              `GOAL · ${teamShort} ${dirCue.event.minute}' (${patternLabel})`,
              width / 2,
              bTop + 15,
            );

            ctx.fillStyle = '#ffffff';
            ctx.font = '800 13px system-ui, sans-serif';
            ctx.fillText(
              dirCue.event.scorerName ?? teamShort,
              width / 2,
              bTop + (dirCue.event.assistName ? 33 : 34),
            );

            if (dirCue.event.assistName) {
              ctx.fillStyle = '#94a3b8';
              ctx.font = '600 10px system-ui, sans-serif';
              ctx.fillText(`도움: ${dirCue.event.assistName}`, width / 2, bTop + 48);
            }
            ctx.restore();
          } else if (dirCue.outcome === 'var_offside') {
            if (t >= 0.25) {
              const vx = padX + dirCue.varOffsideLineX * pw;
              ctx.save();
              ctx.globalAlpha = fadeAlpha * 0.9;
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 2;
              ctx.setLineDash([6, 4]);
              ctx.beginPath();
              ctx.moveTo(vx, padY);
              ctx.lineTo(vx, padY + ph);
              ctx.stroke();
              ctx.restore();

              ctx.save();
              ctx.globalAlpha = fadeAlpha;
              const bw = Math.min(width * 0.80, 320);
              const bh = 52;
              const bLeft = (width - bw) / 2;
              const bTop = (height - bh) / 2;

              ctx.fillStyle = 'rgba(20, 12, 34, 0.95)';
              ctx.strokeStyle = '#c084fc';
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.roundRect(bLeft, bTop, bw, bh, 10);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#e9d5ff';
              ctx.font = '800 11px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(
                `VAR 판독 · ${teamShort} ${dirCue.event.minute}'`,
                width / 2,
                bTop + 16,
              );
              ctx.fillStyle = '#fb7185';
              ctx.font = '800 12px system-ui, sans-serif';
              ctx.fillText(
                `오프사이드 · ${dirCue.event.scorerName ?? teamShort} 득점 취소`,
                width / 2,
                bTop + 36,
              );
              ctx.restore();
            }
          } else {
            const pillText =
              dirCue.outcome === 'save'
                ? dirCue.pattern === 'penalty_kick'
                  ? 'PK 슈퍼 세이브'
                  : `슈퍼 세이브 · ${patternLabel}`
                : dirCue.outcome === 'woodwork'
                  ? `골대 강타 · ${patternLabel}`
                  : dirCue.outcome === 'blocked'
                    ? `수비 육탄 블록 · ${patternLabel}`
                    : dirCue.pattern === 'penalty_kick'
                      ? 'PK 실축'
                      : `간발의 빗나감 · ${patternLabel}`;
            const pillBorder =
              dirCue.outcome === 'save'
                ? '#38bdf8'
                : dirCue.outcome === 'woodwork'
                  ? '#fb923c'
                  : dirCue.outcome === 'blocked'
                    ? '#f59e0b'
                    : '#64748b';
            const pillColor =
              dirCue.outcome === 'save'
                ? '#bae6fd'
                : dirCue.outcome === 'woodwork'
                  ? '#fed7aa'
                  : dirCue.outcome === 'blocked'
                    ? '#fde68a'
                    : '#cbd5e1';

            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            const bw = Math.min(width * 0.78, 270);
            const bh = 26;
            const bLeft = (width - bw) / 2;
            const bTop = padY + 7;
            ctx.fillStyle = 'rgba(11, 16, 24, 0.90)';
            ctx.strokeStyle = pillBorder;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.roundRect(bLeft, bTop, bw, bh, 999);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = pillColor;
            ctx.font = '700 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pillText, width / 2, bTop + bh / 2 + 0.5);
            ctx.restore();
          }
        } else if (dirCue.stage === 'set_piece_setup' || dirCue.stage === 'shot_flight') {
          ctx.save();
          const bw = Math.min(width * 0.76, 250);
          const bh = 24;
          const bLeft = (width - bw) / 2;
          const bTop = padY + 7;
          ctx.fillStyle = 'rgba(11, 16, 24, 0.88)';
          ctx.strokeStyle =
            dirCue.stage === 'set_piece_setup'
              ? 'rgba(56, 189, 248, 0.72)'
              : 'rgba(251, 191, 36, 0.75)';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.roundRect(bLeft, bTop, bw, bh, 999);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = dirCue.stage === 'set_piece_setup' ? '#bae6fd' : '#fef08a';
          ctx.font = '700 10.5px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${teamShort} · ${patternLabel}`, width / 2, bTop + bh / 2 + 0.5);
          ctx.restore();
        }
      }

      animId = window.requestAnimationFrame(renderFrame);
    };

    animId = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  const isUclFinal = finalTheme === 'ucl_final';
  const isCupFinal = finalTheme === 'cup_final';
  const isFinal = isUclFinal || isCupFinal;

  return (
    <div
      className={`rounded-xl overflow-hidden border ${
        isUclFinal
          ? 'border-amber-400/55 bg-[#081122] ring-1 ring-amber-400/20 shadow-[0_0_24px_rgba(251,191,36,0.12)]'
          : isCupFinal
            ? 'border-amber-400/45 bg-[#0b1018] ring-1 ring-amber-400/15 shadow-[0_0_20px_rgba(245,158,11,0.10)]'
            : 'border-slate-800 bg-[#0b1018]'
      }`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px] ${
          isUclFinal
            ? 'border-amber-400/25 bg-gradient-to-r from-[#0b1730] via-[#0e1d3b] to-[#0b1730]'
            : isCupFinal
              ? 'border-amber-400/20 bg-gradient-to-r from-[#13141a] via-[#191815] to-[#13141a]'
              : 'border-slate-800/80'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white/40"
            style={{ backgroundColor: homeClub.primaryColor }}
          />
          <span className="font-bold text-slate-200">{homeClub.shortName}</span>
          <span className="text-slate-600">→</span>
          {isFinal && (
            <span className="rounded border border-amber-400/45 bg-amber-500/15 px-1.5 py-px text-[9.5px] font-black tracking-wider text-amber-200">
              {isUclFinal ? 'UCL FINAL' : 'CUP FINAL'}
            </span>
          )}
        </div>

        {/* Restrained Live Tactical Phase Pill */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-[#0f1621] px-2.5 py-0.5 text-[10px] font-bold text-slate-200">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: phaseBadge.isHome
                ? homeClub.primaryColor
                : awayClub.primaryColor,
            }}
          />
          <span className="whitespace-nowrap">{phaseBadge.label}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-600">←</span>
          <span className="font-bold text-slate-200">{awayClub.shortName}</span>
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white/40"
            style={{ backgroundColor: awayClub.primaryColor }}
          />
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-[210px] sm:h-[240px] lg:h-[265px] xl:h-[290px] max-h-[38vh]"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  );
});

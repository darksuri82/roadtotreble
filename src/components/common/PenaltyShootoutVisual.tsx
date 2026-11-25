import { memo } from 'react';
import type { Club, PenaltyKickLog } from '../../types/league';

export interface PenaltyShootoutVisualProps {
  homeClub?: Club | null;
  awayClub?: Club | null;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  kicks: PenaltyKickLog[];
  revealedCount: number;
  winnerId?: string | null;
  myClubId?: string | null;
  inProgress: boolean;
  /** 'compact' for live auto-progress scoreboards/modals; 'broadcast' for full 2D UCL match screen */
  variant?: 'compact' | 'broadcast';
}

const PK_ANIM_CSS = `
@keyframes uclPkBallFlight {
  0% {
    transform: translate(0px, 0px) scale(1);
    opacity: 0.95;
  }
  58% {
    transform: translate(calc(var(--pk-dx) * 0.62), calc(var(--pk-dy) * 0.68 - 10px)) scale(0.84);
    opacity: 1;
  }
  100% {
    transform: translate(var(--pk-dx), var(--pk-dy)) scale(0.68);
    opacity: 1;
  }
}
@keyframes uclPkBallDeflect {
  0% {
    transform: translate(0px, 0px) scale(1);
    opacity: 0.95;
  }
  65% {
    transform: translate(var(--pk-dx), var(--pk-dy)) scale(0.72);
    opacity: 1;
  }
  100% {
    transform: translate(calc(var(--pk-dx) + var(--pk-rebound-x)), calc(var(--pk-dy) + var(--pk-rebound-y))) scale(0.64);
    opacity: 0.72;
  }
}
@keyframes uclPkKeeperDive {
  0% {
    transform: translate(0px, 0px) rotate(0deg);
  }
  30% {
    transform: translate(calc(var(--gk-dx) * 0.35), calc(var(--gk-dy) * 0.35)) rotate(calc(var(--gk-rot) * 0.5));
  }
  100% {
    transform: translate(var(--gk-dx), var(--gk-dy)) rotate(var(--gk-rot));
  }
}
@keyframes uclPkNetRipple {
  0% {
    opacity: 0;
    transform: scale(0.45);
  }
  42% {
    opacity: 0.85;
    transform: scale(1.12);
  }
  100% {
    opacity: 0;
    transform: scale(1.65);
  }
}
@keyframes uclPkPathDraw {
  0% {
    stroke-dashoffset: 160;
    opacity: 0.25;
  }
  70% {
    stroke-dashoffset: 0;
    opacity: 0.85;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 0.45;
  }
}
@keyframes uclPkBannerFade {
  0% {
    opacity: 0;
    transform: translateY(3px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

type ShotZone = 'tl' | 'tr' | 'bl' | 'br' | 'ct';

const ZONE_COORDS: Record<ShotZone, { x: number; y: number; side: -1 | 0 | 1 }> = {
  tl: { x: 112, y: 34, side: -1 },
  tr: { x: 248, y: 34, side: 1 },
  bl: { x: 116, y: 66, side: -1 },
  br: { x: 244, y: 66, side: 1 },
  ct: { x: 180, y: 36, side: 0 },
};

const SHOT_ZONES: readonly ShotZone[] = ['tl', 'tr', 'bl', 'br', 'ct'];

function hashKick(kick: PenaltyKickLog, idx: number): number {
  let h = (idx + 1) * 31 + kick.round * 17;
  const s = `${kick.teamId}:${kick.kickerName}`;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function resolveKickChoreography(kick: PenaltyKickLog, idx: number) {
  const h = hashKick(kick, idx);
  const zone = SHOT_ZONES[h % SHOT_ZONES.length];
  const target = ZONE_COORDS[zone];

  if (kick.scored) {
    // Keeper either dives opposite way or dives late/short to the same corner
    const oppositeDive = (h >> 3) % 3 !== 0;
    let gkSide: -1 | 0 | 1;
    if (target.side === 0) {
      gkSide = (h >> 2) % 2 === 0 ? -1 : 1;
    } else {
      gkSide = oppositeDive ? (target.side === -1 ? 1 : -1) : target.side;
    }
    const gkDx = gkSide * (oppositeDive ? 50 : 28);
    const gkDy = oppositeDive ? 8 : 11;
    const gkRot = gkSide * (oppositeDive ? 42 : 24);
    return {
      targetX: target.x,
      targetY: target.y,
      gkDx,
      gkDy,
      gkRot,
      missType: null as 'saved' | 'post' | null,
      reboundX: 0,
      reboundY: 0,
    };
  }

  // Miss: 68% GK save, 32% post/crossbar clip
  const isPostMiss = (h >> 4) % 3 === 0;
  if (isPostMiss) {
    const postX = target.side >= 0 ? 270 : 90;
    const postY = (h >> 5) % 2 === 0 ? 21 : 40;
    const gkSide: -1 | 1 = target.side >= 0 ? 1 : -1;
    return {
      targetX: postX,
      targetY: postY,
      gkDx: gkSide * 38,
      gkDy: 7,
      gkRot: gkSide * 32,
      missType: 'post' as const,
      reboundX: gkSide * 20,
      reboundY: -10,
    };
  }

  // Saved cleanly by diving keeper
  const saveZone: ShotZone = zone === 'ct' ? 'br' : zone;
  const st = ZONE_COORDS[saveZone];
  const saveX = st.side < 0 ? 124 : 236;
  const saveY = st.y > 50 ? 60 : 42;
  return {
    targetX: saveX,
    targetY: saveY,
    gkDx: st.side * 52,
    gkDy: st.y > 50 ? 10 : -2,
    gkRot: st.side * 46,
    missType: 'saved' as const,
    reboundX: st.side * 16,
    reboundY: 16,
  };
}

/**
 * Refined UEFA Champions League broadcast-style Penalty Shootout visual.
 * Renders a crisp dark-stadium SVG penalty spot / goalpost / diving keeper scene
 * paired with a clean kick-by-kick scoreboard. Scoped strictly to UCL competitions.
 */
export const PenaltyShootoutVisual = memo(function PenaltyShootoutVisual({
  homeClub,
  awayClub,
  homeTeamId,
  awayTeamId,
  homeScore,
  awayScore,
  kicks,
  revealedCount,
  winnerId,
  myClubId = null,
  inProgress,
  variant = 'compact',
}: PenaltyShootoutVisualProps) {
  const isBroadcast = variant === 'broadcast';
  const clampedRevealed = Math.min(kicks.length, Math.max(0, revealedCount));
  const shownKicks = kicks.slice(0, clampedRevealed);
  const latestKick = shownKicks.length > 0 ? shownKicks[shownKicks.length - 1] : null;
  const nextKick =
    inProgress && clampedRevealed < kicks.length ? kicks[clampedRevealed] : null;

  const homeKicks = shownKicks.filter((k) => k.teamId === homeTeamId);
  const awayKicks = shownKicks.filter((k) => k.teamId === awayTeamId);
  const slotCount = Math.max(
    5,
    homeKicks.length + (nextKick?.teamId === homeTeamId ? 1 : 0),
    awayKicks.length + (nextKick?.teamId === awayTeamId ? 1 : 0),
  );
  const isSuddenDeath = (nextKick?.round ?? latestKick?.round ?? 1) > 5;

  const activeTeamId = latestKick?.teamId ?? nextKick?.teamId ?? homeTeamId;
  const kickerIsHome = activeTeamId === homeTeamId;
  const kickerClub = kickerIsHome ? homeClub : awayClub;
  const keeperClub = kickerIsHome ? awayClub : homeClub;

  const kickerColor = kickerClub?.primaryColor ?? '#38bdf8';
  const kickerTrim = kickerClub?.secondaryColor ?? '#f8fafc';
  const keeperColor = keeperClub?.secondaryColor ?? '#f59e0b';
  const keeperTrim = keeperClub?.primaryColor ?? '#0f172a';

  const choreo = latestKick
    ? resolveKickChoreography(latestKick, shownKicks.length - 1)
    : null;
  const animKey = latestKick
    ? `${shownKicks.length}-${latestKick.round}-${latestKick.teamId}-${latestKick.kickerName}`
    : 'pk-idle';

  const spotX = 180;
  const spotY = 114;
  const winnerClub =
    !inProgress && winnerId
      ? winnerId === homeTeamId
        ? homeClub
        : awayClub
      : null;

  const liveHomePen = latestKick ? latestKick.homeScoreAfter : inProgress ? 0 : homeScore;
  const liveAwayPen = latestKick ? latestKick.awayScoreAfter : inProgress ? 0 : awayScore;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-sky-500/30 bg-[#070e1c] ${
        isBroadcast ? 'p-3.5 sm:p-4 space-y-3 shadow-2xl' : 'mt-2 p-2.5 space-y-2'
      }`}
    >
      <style>{PK_ANIM_CSS}</style>

      {/* Top Broadcast Strip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
          <span
            className={`font-black tracking-wider uppercase text-sky-200 ${
              isBroadcast ? 'text-xs' : 'text-[10px]'
            }`}
          >
            UCL 승부차기
          </span>
          {isSuddenDeath && (
            <span className="rounded border border-rose-400/45 bg-rose-500/15 px-1.5 py-px text-[9px] font-black text-rose-200">
              서든데스
            </span>
          )}
        </div>
        <div
          className={`flex items-center gap-1.5 font-mono font-black tabular-nums ${
            isBroadcast ? 'text-base text-white' : 'text-xs text-sky-100'
          }`}
        >
          <span className="text-[10px] font-bold tracking-widest text-sky-400/80">PK</span>
          <span>{liveHomePen}</span>
          <span className="text-slate-600">:</span>
          <span>{liveAwayPen}</span>
        </div>
      </div>

      {/* Sleek Dark-Stadium Goalpost & Penalty Spot SVG */}
      <div
        className={`relative overflow-hidden rounded-lg border border-slate-800/90 bg-[#050b16] ${
          isBroadcast ? 'mx-auto max-w-xl' : ''
        }`}
      >
        <svg
          viewBox="0 0 360 132"
          className={`block w-full select-none ${
            isBroadcast ? 'max-h-[210px]' : 'max-h-[118px]'
          }`}
          role="img"
          aria-label="UCL 승부차기 연출"
        >
          <defs>
            <linearGradient id={`pkSky-${variant}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#050b18" />
              <stop offset="100%" stopColor="#0c1b36" />
            </linearGradient>
            <radialGradient id={`pkFlood-${variant}`} cx="50%" cy="18%" r="58%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.16" />
              <stop offset="65%" stopColor="#1d4ed8" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#050b18" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`pkTurf-${variant}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a2720" />
              <stop offset="55%" stopColor="#0d3228" />
              <stop offset="100%" stopColor="#08201a" />
            </linearGradient>
            <pattern
              id={`pkNet-${variant}`}
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 8 0 L 0 0 0 8"
                fill="none"
                stroke="#cbd5e1"
                strokeOpacity="0.14"
                strokeWidth="0.65"
              />
            </pattern>
          </defs>

          {/* Night Stadium Backdrop + Soft Floodlight Wash */}
          <rect x="0" y="0" width="360" height="78" fill={`url(#pkSky-${variant})`} />
          <rect x="0" y="0" width="360" height="78" fill={`url(#pkFlood-${variant})`} />

          {/* Subtle Stadium Tier Hairlines */}
          <line x1="0" y1="44" x2="360" y2="44" stroke="#38bdf8" strokeOpacity="0.08" strokeWidth="1" />
          <line x1="0" y1="60" x2="360" y2="60" stroke="#38bdf8" strokeOpacity="0.10" strokeWidth="1" />
          <rect x="0" y="64" width="360" height="12" fill="#071126" opacity="0.85" />
          <line x1="0" y1="64" x2="360" y2="64" stroke="#38bdf8" strokeOpacity="0.22" strokeWidth="0.75" />

          {/* Dark Emerald Pitch & Perspective Box Lines */}
          <rect x="0" y="76" width="360" height="56" fill={`url(#pkTurf-${variant})`} />
          <line x1="0" y1="76" x2="360" y2="76" stroke="#e2e8f0" strokeOpacity="0.32" strokeWidth="1" />
          {/* 6-yard box perspective */}
          <polygon
            points="64,76 296,76 318,96 42,96"
            fill="none"
            stroke="#e2e8f0"
            strokeOpacity="0.18"
            strokeWidth="0.9"
          />
          {/* Subtle turf stripe */}
          <polygon points="88,76 272,76 294,132 66,132" fill="#10b981" fillOpacity="0.04" />

          {/* Goal Net Interior & Architectural Goal Frame */}
          <polygon
            points="92,22 268,22 260,76 100,76"
            fill="#040914"
            fillOpacity="0.58"
          />
          <polygon
            points="92,22 268,22 260,76 100,76"
            fill={`url(#pkNet-${variant})`}
          />
          {/* Inner net depth diagonals */}
          <line x1="92" y1="22" x2="100" y2="76" stroke="#94a3b8" strokeOpacity="0.22" strokeWidth="0.8" />
          <line x1="268" y1="22" x2="260" y2="76" stroke="#94a3b8" strokeOpacity="0.22" strokeWidth="0.8" />
          <line x1="100" y1="76" x2="260" y2="76" stroke="#cbd5e1" strokeOpacity="0.35" strokeWidth="0.9" />
          {/* Crisp Goalposts & Crossbar */}
          <path
            d="M 90 76 L 90 20 L 270 20 L 270 76"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Penalty Spot */}
          <ellipse cx={spotX} cy={spotY} rx="4.5" ry="2" fill="#e2e8f0" fillOpacity="0.72" />
          {!latestKick && inProgress && (
            <circle
              cx={spotX}
              cy={spotY}
              r="8"
              fill="none"
              stroke="#38bdf8"
              strokeOpacity="0.55"
              strokeWidth="1.2"
              className="animate-pulse"
            />
          )}

          {/* Goalkeeper (Clean Minimalist Broadcast Figure) */}
          <g
            key={`gk-${animKey}`}
            style={
              choreo
                ? ({
                    transformOrigin: '180px 64px',
                    '--gk-dx': `${choreo.gkDx}px`,
                    '--gk-dy': `${choreo.gkDy}px`,
                    '--gk-rot': `${choreo.gkRot}deg`,
                    animation: 'uclPkKeeperDive 0.46s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  } as React.CSSProperties)
                : undefined
            }
          >
            {/* Subtle turf shadow */}
            <ellipse cx="180" cy="75" rx="11" ry="2.6" fill="#000000" fillOpacity="0.45" />
            {/* Legs */}
            <path d="M 176 66 L 173 74 M 184 66 L 187 74" stroke="#cbd5e1" strokeWidth="2.4" strokeLinecap="round" />
            {/* Torso */}
            <rect
              x="173"
              y="52"
              width="14"
              height="15"
              rx="4"
              fill={keeperColor}
              stroke={keeperTrim}
              strokeWidth="1"
            />
            {/* Outstretched arms + gloves */}
            <path
              d="M 173 56 L 163 51 M 187 56 L 197 51"
              stroke={keeperColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <circle cx="162" cy="50.5" r="2.3" fill="#f8fafc" />
            <circle cx="198" cy="50.5" r="2.3" fill="#f8fafc" />
            {/* Head */}
            <circle cx="180" cy="46.5" r="4" fill="#e2e8f0" />
          </g>

          {/* Shot Arc Trail + Impact Ripple */}
          {latestKick && choreo && (
            <g key={`arc-${animKey}`}>
              <path
                d={`M ${spotX} ${spotY} Q ${(spotX + choreo.targetX) * 0.5} ${Math.min(spotY, choreo.targetY) - 14} ${choreo.targetX} ${choreo.targetY}`}
                fill="none"
                stroke={latestKick.scored ? '#34d399' : '#fb7185'}
                strokeWidth="1.7"
                strokeDasharray="4 4"
                style={{
                  strokeDasharray: '160',
                  animation: 'uclPkPathDraw 0.48s ease-out forwards',
                }}
              />
              <circle
                cx={choreo.targetX}
                cy={choreo.targetY}
                r={latestKick.scored ? 11 : 9}
                fill="none"
                stroke={latestKick.scored ? '#34d399' : '#fb7185'}
                strokeWidth="1.8"
                style={{
                  transformOrigin: `${choreo.targetX}px ${choreo.targetY}px`,
                  animation: 'uclPkNetRipple 0.55s ease-out forwards',
                }}
              />
            </g>
          )}

          {/* Ball */}
          <g
            key={`ball-${animKey}`}
            style={
              latestKick && choreo
                ? ({
                    '--pk-dx': `${choreo.targetX - spotX}px`,
                    '--pk-dy': `${choreo.targetY - spotY}px`,
                    '--pk-rebound-x': `${choreo.reboundX}px`,
                    '--pk-rebound-y': `${choreo.reboundY}px`,
                    animation: latestKick.scored
                      ? 'uclPkBallFlight 0.44s cubic-bezier(0.22, 1, 0.36, 1) forwards'
                      : 'uclPkBallDeflect 0.52s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  } as React.CSSProperties)
                : undefined
            }
          >
            <circle
              cx={spotX}
              cy={spotY - 2}
              r="4.2"
              fill="#f8fafc"
              stroke="#0f172a"
              strokeWidth="0.9"
            />
            <circle cx={spotX - 1} cy={spotY - 3} r="1.2" fill="#334155" />
          </g>

          {/* Kicker Silhouette Marker (foreground left-of-spot, clean jersey tone) */}
          <g opacity="0.92">
            <ellipse cx="159" cy="122" rx="7" ry="2" fill="#000000" fillOpacity="0.45" />
            <rect
              x="154"
              y="107"
              width="10"
              height="12"
              rx="3"
              fill={kickerColor}
              stroke={kickerTrim}
              strokeWidth="0.9"
            />
            <circle cx="159" cy="103" r="3.2" fill="#e2e8f0" />
          </g>
        </svg>

        {/* Minimalist Broadcast Corner Overlay Pill */}
        {latestKick && choreo ? (
          <div
            key={`pill-${animKey}`}
            style={{ animation: 'uclPkBannerFade 0.25s ease-out forwards' }}
            className={`absolute right-2 top-2 rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider backdrop-blur-sm ${
              latestKick.scored
                ? 'border-emerald-400/50 bg-emerald-950/80 text-emerald-200'
                : 'border-rose-400/50 bg-rose-950/80 text-rose-200'
            }`}
          >
            {latestKick.scored
              ? 'GOAL'
              : choreo.missType === 'post'
                ? 'POST'
                : 'SAVED'}
          </div>
        ) : nextKick ? (
          <div className="absolute right-2 top-2 rounded-md border border-sky-400/40 bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold text-sky-200 backdrop-blur-sm">
            READY · {nextKick.teamShortName}
          </div>
        ) : null}
      </div>

      {/* Kick-by-kick Broadcast Dot Board */}
      <div className={isBroadcast ? 'space-y-1.5' : 'space-y-1'}>
        {[
          {
            teamId: homeTeamId,
            label: isBroadcast
              ? (homeClub?.name ?? 'HOME')
              : (homeClub?.shortName ?? 'HOME'),
            color: homeClub?.primaryColor ?? '#38bdf8',
            kicks: homeKicks,
          },
          {
            teamId: awayTeamId,
            label: isBroadcast
              ? (awayClub?.name ?? 'AWAY')
              : (awayClub?.shortName ?? 'AWAY'),
            color: awayClub?.primaryColor ?? '#94a3b8',
            kicks: awayKicks,
          },
        ].map((row) => (
          <div
            key={row.teamId}
            className={`flex items-center justify-between gap-2 ${
              isBroadcast ? 'rounded-lg border border-slate-800/80 bg-[#0b1322] px-3 py-2' : 'text-[10px]'
            }`}
          >
            <div className={`flex items-center gap-1.5 min-w-0 ${isBroadcast ? 'w-32 sm:w-40' : 'w-12'} shrink-0`}>
              <span
                className="h-2.5 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span
                className={`truncate font-extrabold ${
                  isBroadcast ? 'text-xs' : 'text-[10px]'
                } ${row.teamId === myClubId ? 'text-emerald-300' : 'text-slate-200'}`}
              >
                {row.label}
              </span>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
              {Array.from({ length: slotCount }, (_, idx) => {
                const kick = row.kicks[idx];
                const isSteppingUp =
                  !kick &&
                  nextKick?.teamId === row.teamId &&
                  idx === row.kicks.length;
                const dotSize = isBroadcast ? 'h-6 w-6 text-[11px]' : 'h-4 w-4 text-[9px]';
                if (kick) {
                  return (
                    <span
                      key={idx}
                      title={`${kick.round}번 키커 ${kick.kickerName} (${kick.scored ? '성공' : '실축'})`}
                      className={`inline-flex ${dotSize} items-center justify-center rounded-full font-black ${
                        kick.scored
                          ? 'border border-emerald-300/60 bg-emerald-400/90 text-slate-950'
                          : 'border border-rose-400/50 bg-rose-500/25 text-rose-300'
                      }`}
                    >
                      {kick.scored ? '●' : '✕'}
                    </span>
                  );
                }
                return (
                  <span
                    key={idx}
                    className={`inline-flex ${dotSize} items-center justify-center rounded-full border ${
                      isSteppingUp
                        ? 'border-sky-400 bg-sky-400/20 text-sky-200 animate-pulse'
                        : 'border-slate-700/80 bg-slate-900/70 text-slate-600'
                    }`}
                  >
                    {isSteppingUp ? '·' : ''}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Latest Kicker Live Strip */}
      {latestKick && (
        <div
          key={`strip-${animKey}`}
          style={{ animation: 'uclPkBannerFade 0.25s ease-out forwards' }}
          className={`flex items-center justify-between gap-2 border-t border-slate-800/80 pt-1.5 font-bold ${
            isBroadcast ? 'text-xs' : 'text-[10px]'
          }`}
        >
          <span className="truncate text-slate-200">
            <span className="mr-1.5 font-mono text-sky-400/80">R{latestKick.round}</span>
            <span className="mr-1 text-slate-400">{latestKick.teamShortName}</span>
            {latestKick.kickerName}
          </span>
          <span
            className={`shrink-0 rounded border px-1.5 py-px font-black ${
              isBroadcast ? 'text-[11px]' : 'text-[9px]'
            } ${
              latestKick.scored
                ? 'border-emerald-400/45 bg-emerald-500/18 text-emerald-200'
                : 'border-rose-400/45 bg-rose-500/18 text-rose-200'
            }`}
          >
            {latestKick.scored ? '성공' : choreo?.missType === 'post' ? '골대 실축' : '선방 · 실축'}
          </span>
        </div>
      )}

      {/* Settled Winner Strip */}
      {!inProgress && winnerClub && (
        <div
          className={`rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-center font-extrabold text-emerald-200 ${
            isBroadcast ? 'text-xs' : 'text-[10px]'
          }`}
        >
          {winnerClub.name} 승부차기 승리 ({homeScore} : {awayScore})
        </div>
      )}
    </div>
  );
});

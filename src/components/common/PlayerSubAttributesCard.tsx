import { Radar } from 'lucide-react';
import {
  FIELD_ATTR_META,
  getEffectivePlayerAttributes,
  getPlayerArchetypeProfile,
  GK_ATTR_META,
} from '../../engine/attributeEngine';
import type { Player } from '../../types/player';

interface PlayerSubAttributesCardProps {
  player: Player;
  effectiveOvr?: number;
}

function statTextColor(val: number): string {
  if (val >= 92) return 'text-cyan-300';
  if (val >= 85) return 'text-emerald-300';
  if (val >= 76) return 'text-amber-300';
  return 'text-slate-400';
}

function statBarColor(val: number): string {
  if (val >= 92) return 'bg-cyan-400';
  if (val >= 85) return 'bg-emerald-400';
  if (val >= 76) return 'bg-amber-400';
  return 'bg-slate-500';
}

export function PlayerSubAttributesCard({
  player,
  effectiveOvr,
}: PlayerSubAttributesCardProps) {
  const attrs = getEffectivePlayerAttributes(player, effectiveOvr);
  const archetype = getPlayerArchetypeProfile(player);
  const isGk = player.position === 'GK' && Boolean(attrs.gk);

  const items: { key: string; label: string; value: number }[] =
    isGk && attrs.gk
      ? GK_ATTR_META.map((m) => ({
          key: m.shortLabel,
          label: m.fullLabel,
          value: attrs.gk![m.key],
        }))
      : FIELD_ATTR_META.map((m) => ({
          key: m.shortLabel,
          label: m.fullLabel,
          value: attrs[m.key],
        }));

  // Compact SVG polygon radar chart (40..99 scale)
  const size = 148;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 48;
  const count = items.length;

  const pointAt = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
    return {
      x: cx + Math.cos(angle) * maxR * ratio,
      y: cy + Math.sin(angle) * maxR * ratio,
    };
  };

  const gridLevels = [0.33, 0.66, 1.0];
  const dataPoints = items.map((it, idx) => {
    const norm = Math.max(0.15, Math.min(1, (it.value - 35) / 64));
    return pointAt(idx, norm);
  });
  const polygonStr = dataPoints
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
      {/* Header + Archetype Tag */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <Radar className="h-3.5 w-3.5 text-emerald-400" />
          <span>세부 능력치 프로필</span>
          {effectiveOvr !== undefined && effectiveOvr !== player.ovr && (
            <span className="text-[10px] font-semibold text-slate-400">
              (실효 OVR {effectiveOvr} 반영)
            </span>
          )}
        </div>
        <span
          className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${archetype.badgeClass}`}
        >
          {archetype.tag}
        </span>
      </div>

      {/* Radar Chart + Stat Bars */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[152px_1fr] items-center">
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800/80 bg-[#0e1520] py-1.5">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="overflow-visible"
            aria-label={`${player.name} 세부 능력치 레이더 차트`}
          >
            {/* Background web */}
            {gridLevels.map((lvl) => {
              const ring = items
                .map((_, idx) => {
                  const pt = pointAt(idx, lvl);
                  return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                })
                .join(' ');
              return (
                <polygon
                  key={lvl}
                  points={ring}
                  fill="none"
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Axis lines */}
            {items.map((it, idx) => {
              const end = pointAt(idx, 1);
              return (
                <line
                  key={it.key}
                  x1={cx}
                  y1={cy}
                  x2={end.x}
                  y2={end.y}
                  stroke="rgba(148,163,184,0.15)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Data polygon */}
            <polygon
              points={polygonStr}
              fill={
                player.isLegend
                  ? 'rgba(251, 191, 36, 0.24)'
                  : 'rgba(16, 185, 129, 0.24)'
              }
              stroke={player.isLegend ? '#fbbf24' : '#34d399'}
              strokeWidth="1.8"
            />

            {/* Data vertices */}
            {dataPoints.map((pt, idx) => (
              <circle
                key={items[idx].key}
                cx={pt.x}
                cy={pt.y}
                r="2.4"
                fill={player.isLegend ? '#fde68a' : '#6ee7b7'}
              />
            ))}

            {/* Axis labels */}
            {items.map((it, idx) => {
              const lbl = pointAt(idx, 1.25);
              return (
                <text
                  key={it.key}
                  x={lbl.x}
                  y={lbl.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#94a3b8"
                  fontSize="9"
                  fontWeight="700"
                >
                  {it.key}
                </text>
              );
            })}
          </svg>
        </div>

        <div className="space-y-1.5 tabular-nums">
          {items.map((it) => {
            const pct = Math.max(8, Math.min(100, ((it.value - 35) / 64) * 100));
            return (
              <div key={it.key} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="inline-block w-7 font-mono text-[10px] font-bold text-slate-400">
                      {it.key}
                    </span>
                    <span className="text-[10px] text-slate-400">{it.label}</span>
                  </span>
                  <span className={`font-display text-xs font-extrabold ${statTextColor(it.value)}`}>
                    {it.value}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                  <div
                    className={`h-full rounded-full ${statBarColor(it.value)}`}
                    style={{ width: `${pct.toFixed(0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Concise archetype trait summary */}
      <p className="text-[11px] leading-snug text-slate-400 border-t border-slate-800/80 pt-2">
        {archetype.description}
      </p>
    </div>
  );
}

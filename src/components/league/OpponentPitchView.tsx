import { useMemo } from 'react';
import { FORMATIONS } from '../../data/formations';
import { PLAYSTYLES } from '../../data/playstyles';
import { evaluatePositionFit } from '../../engine/positionEngine';
import type { Club } from '../../types/league';
import type { Player } from '../../types/player';
import { TACTICS } from '../../engine/tacticEngine';
import { PlayerNameButton } from '../common/PlayerNameButton';

interface OpponentPitchViewProps {
  opponent: Club;
  roster: Player[];
  onClickPlayerName?: (playerId: string) => void;
}

/**
 * Greedily assigns up to 11 opponent players to their best-fitting slots
 * in the opponent's formation so GK/DF/MF/FW sit in realistic tactical positions.
 */
function assignRosterToFormation(
  opponent: Club,
  roster: Player[],
): (Player | null)[] {
  const config = FORMATIONS[opponent.formation] ?? FORMATIONS['4-3-3'];
  const slots = config.slots;
  const assigned: (Player | null)[] = Array.from({ length: slots.length }, () => null);
  const usedIds = new Set<string>();

  // 1) Assign GK slot first
  const gkSlotIdx = slots.findIndex((s) => s.position === 'GK');
  if (gkSlotIdx >= 0) {
    const bestGk = [...roster]
      .filter((p) => p.position === 'GK')
      .sort((a, b) => b.ovr - a.ovr)[0];
    if (bestGk) {
      assigned[gkSlotIdx] = bestGk;
      usedIds.add(bestGk.id);
    }
  }

  // 2) Assign remaining outfield slots by best position fit + OVR
  const remainingSlots = slots
    .map((slot, idx) => ({ slot, idx }))
    .filter(({ idx }) => assigned[idx] === null);

  for (const { slot, idx } of remainingSlots) {
    let bestPlayer: Player | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const p of roster) {
      if (usedIds.has(p.id)) continue;
      if (p.position === 'GK' && slot.position !== 'GK') continue;
      const fit = evaluatePositionFit(p, slot.subPosition, null);
      const fitBonus =
        fit.fit === 'main' ? 18 : fit.fit === 'secondary' ? 8 : -8;
      const score = fit.effectiveOvr + fitBonus;
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = p;
      }
    }
    if (bestPlayer) {
      assigned[idx] = bestPlayer;
      usedIds.add(bestPlayer.id);
    }
  }

  return assigned;
}

function shortLastName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 7) return trimmed;
  const parts = trimmed.split(' ');
  const last = parts[parts.length - 1] ?? trimmed;
  return last.length <= 8 ? last : trimmed.slice(0, 7);
}

export function OpponentPitchView({
  opponent,
  roster,
  onClickPlayerName,
}: OpponentPitchViewProps) {
  const config = FORMATIONS[opponent.formation] ?? FORMATIONS['4-3-3'];
  const lineup = useMemo(
    () => assignRosterToFormation(opponent, roster),
    [opponent, roster],
  );

  const keyThreats = useMemo(
    () =>
      lineup
        .filter((p): p is Player => p !== null)
        .sort((a, b) => b.ovr - a.ovr)
        .slice(0, 3),
    [lineup],
  );

  return (
    <div className="space-y-2">
      {/* Pitch Header Strip */}
      <div className="flex items-center justify-between gap-2 px-1 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0 border border-white/25"
            style={{ backgroundColor: opponent.primaryColor }}
          />
          <span className="truncate font-extrabold text-white">
            {opponent.name} 예상 선발
          </span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 shrink-0">
            {opponent.formation}
          </span>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 shrink-0">
            {TACTICS[opponent.defaultTactic].shortName}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 shrink-0">
          이름 클릭 시 상세
        </span>
      </div>

      {/* Opponent Formation Pitch */}
      <div className="relative aspect-[4/4.3] w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#0f1b26] via-[#0c1a1c] to-[#0d1919]">
        {/* Crisp Minimal Pitch SVG Lines */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <rect
            x="4"
            y="4"
            width="92"
            height="92"
            rx="1.5"
            fill="none"
            stroke="rgba(148,163,184,0.16)"
            strokeWidth="0.5"
          />
          <line
            x1="4"
            y1="50"
            x2="96"
            y2="50"
            stroke="rgba(148,163,184,0.14)"
            strokeWidth="0.45"
          />
          <circle
            cx="50"
            cy="50"
            r="10.5"
            fill="none"
            stroke="rgba(148,163,184,0.14)"
            strokeWidth="0.45"
          />
          <rect
            x="24"
            y="4"
            width="52"
            height="14"
            fill="none"
            stroke="rgba(148,163,184,0.13)"
            strokeWidth="0.45"
          />
          <rect
            x="24"
            y="82"
            width="52"
            height="14"
            fill="none"
            stroke="rgba(148,163,184,0.13)"
            strokeWidth="0.45"
          />
        </svg>

        {/* Opponent 11 Player Nodes */}
        {config.slots.map((slot, idx) => {
          const player = lineup[idx];
          const primaryStyle = player?.playstyles[0]
            ? PLAYSTYLES[player.playstyles[0]]?.shortName
            : null;
          const isSuper = (player?.ovr ?? 0) >= 88;
          const isThreat = (player?.ovr ?? 0) >= 85;

          return (
            <div
              key={`opp-slot-${slot.index}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
            >
              <div
                className={`flex flex-col items-center rounded-xl px-1.5 py-1 min-w-[60px] max-w-[80px] text-center shadow-md ${
                  isSuper
                    ? 'border border-cyan-400/65 bg-[#0e1b29]/95'
                    : isThreat
                      ? 'border border-amber-400/45 bg-[#151821]/95'
                      : 'border border-slate-700/80 bg-[#0d141f]/95'
                }`}
              >
                <div className="flex items-center gap-1 leading-none">
                  <span
                    className={`font-display text-xs font-black tabular-nums ${
                      isSuper
                        ? 'text-cyan-300'
                        : isThreat
                          ? 'text-amber-300'
                          : 'text-slate-200'
                    }`}
                  >
                    {player?.ovr ?? '-'}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400">
                    {slot.label}
                  </span>
                </div>

                {player ? (
                  onClickPlayerName ? (
                    <PlayerNameButton
                      onClick={() => onClickPlayerName(player.id)}
                      title={`${player.name} (OVR ${player.ovr}) 세부 스탯`}
                      className="mt-0.5 max-w-[74px] text-[10px] font-bold text-white text-center leading-tight"
                    >
                      {shortLastName(player.name)}
                    </PlayerNameButton>
                  ) : (
                    <span className="mt-0.5 max-w-[74px] truncate text-[10px] font-bold text-white leading-tight">
                      {shortLastName(player.name)}
                    </span>
                  )
                ) : (
                  <span className="mt-0.5 text-[9px] text-slate-500">미정</span>
                )}

                {primaryStyle && (
                  <span className="mt-0.5 max-w-[74px] truncate rounded bg-slate-900/90 px-1 text-[8px] font-semibold text-slate-300 leading-tight">
                    {primaryStyle}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Compact Key Threats Strip */}
      {keyThreats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1 text-[10px]">
          <span className="font-bold text-rose-300 shrink-0">핵심 경계:</span>
          {keyThreats.map((p) => (
            <span
              key={`threat-${p.id}`}
              className="inline-flex items-center gap-1 rounded-md bg-[#0b1018] border border-slate-800 px-1.5 py-0.5 text-slate-200"
            >
              {onClickPlayerName ? (
                <PlayerNameButton
                  onClick={() => onClickPlayerName(p.id)}
                  className="font-bold text-slate-100"
                >
                  {p.name}
                </PlayerNameButton>
              ) : (
                <span className="font-bold">{p.name}</span>
              )}
              <span className="font-mono text-amber-300 font-bold">{p.ovr}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

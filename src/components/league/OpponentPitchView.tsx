import { useMemo, useState } from 'react';
import { getClubManager } from '../../data/aiManagers';
import { FORMATIONS } from '../../data/formations';
import {
  evaluateManagerTeamEffect,
  MANAGER_TRAITS,
} from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import { calculateChemistry } from '../../engine/chemistryEngine';
import {
  getInjuryTooltip,
  getMoraleLabel,
  getMoraleTier,
  isPlayerActivelyInjured,
  selectConditionAwareAiLineup,
} from '../../engine/conditionEngine';
import { getClubRealDepthPool } from '../../engine/dataLoader';
import { optimizeCurrentStartersForFormation } from '../../engine/lineupOptimizer';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type { ChemistryLineType, FormationId } from '../../types/game';
import type { Club } from '../../types/league';
import type { Player } from '../../types/player';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { PixelStatusIcon } from '../common/PixelStatusIcon';
import { PlayerNameButton } from '../common/PlayerNameButton';

interface OpponentPitchViewProps {
  opponent: Club;
  roster: Player[];
  onClickPlayerName?: (playerId: string) => void;
}

const LINE_COLORS: Record<ChemistryLineType, string> = {
  club: '#10b981', // Vivid Emerald
  nation: '#38bdf8', // Vivid Sky Blue
  style: '#f59e0b', // Vivid Gold
  elite: '#c084fc', // Vivid Violet
};

function shortFormationLabel(id: FormationId): string {
  if (id === '4-4-2-diamond') return '4-4-2◇';
  if (id === '3-5-2-dm') return '3-5-2 DM';
  return id;
}

/**
 * Aligns up to 11 opponent players to their true optimal formation slots:
 * - Curated Historical HOF teams already come in exact 11-slot formation order.
 * - Regular AI clubs & injury-adjusted squads use Hungarian + 2-opt optimal assignment
 *   so defenders never get pushed into ST or wingers into CDM.
 */
function assignRosterToFormation(
  opponent: Club,
  roster: Player[],
  managerTraitId: ReturnType<typeof getClubManager>['traitId'],
): (Player | null)[] {
  const config = FORMATIONS[opponent.formation] ?? FORMATIONS['4-3-3'];
  const xi = roster.slice(0, config.slots.length);

  // Curated HOF historical squads are already strictly ordered to match their formation slots
  if (opponent.id.startsWith('hist-') && xi.length === config.slots.length) {
    return xi;
  }

  return optimizeCurrentStartersForFormation(
    xi,
    opponent.formation,
    opponent.defaultTactic,
    managerTraitId,
  );
}

const OPP_SUFFIX_KEEP_FIRST = new Set([
  '주니오르',
  '주니어',
  '필류',
  '네투',
  '시니어',
]);

function shortLastName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 7) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (OPP_SUFFIX_KEEP_FIRST.has(last)) return parts[0];
    if (last.length >= 2 && last.length <= 8) return last;
  }
  return trimmed;
}

export function OpponentPitchView({
  opponent,
  roster,
  onClickPlayerName,
}: OpponentPitchViewProps) {
  const { state } = useGame();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const conditionMap = state.season?.playerConditions;
  const config = FORMATIONS[opponent.formation] ?? FORMATIONS['4-3-3'];
  const oppManager = useMemo(() => getClubManager(opponent), [opponent]);

  const { expectedStarters, injuredPlayers } = useMemo(() => {
    // Historical HOF dream match opponents have their fixed curated 11 starters (no season injuries)
    if (opponent.id.startsWith('hist-')) {
      return {
        expectedStarters: roster.slice(0, 11),
        injuredPlayers: [],
      };
    }

    const excludeIds = new Set<string>([
      ...state.starters.filter((p): p is Player => Boolean(p)).map((p) => p.id),
      ...state.bench.filter((p): p is Player => Boolean(p)).map((p) => p.id),
      ...(state.season?.departedPlayerIds ?? []),
    ]);
    const depthPool = getClubRealDepthPool(opponent.name, excludeIds);
    const res = selectConditionAwareAiLineup({
      baseRoster: roster,
      fullClubPool: depthPool,
      conditionMap,
    });
    return {
      expectedStarters: res.starters,
      injuredPlayers: res.injuredPlayers,
    };
  }, [
    opponent.id,
    opponent.name,
    roster,
    conditionMap,
    state.starters,
    state.bench,
    state.season?.departedPlayerIds,
  ]);

  const lineup = useMemo(
    () => assignRosterToFormation(opponent, expectedStarters, oppManager.traitId),
    [opponent, expectedStarters, oppManager.traitId],
  );

  // Apply the exact same 1-line=1-pt 2/4/8 synergy + decoupled +1 manager compatibility!
  const oppChemistry = useMemo(
    () =>
      calculateChemistry(
        opponent.formation,
        lineup,
        opponent.defaultTactic,
        oppManager.traitId,
        oppManager.ovr,
      ),
    [opponent.formation, lineup, opponent.defaultTactic, oppManager.traitId, oppManager.ovr],
  );

  const oppMgrEffect = useMemo(
    () =>
      evaluateManagerTeamEffect({
        traitId: oppManager.traitId,
        starters: lineup,
        tactic: opponent.defaultTactic,
      }),
    [oppManager.traitId, lineup, opponent.defaultTactic],
  );
  const oppTraitCfg = MANAGER_TRAITS[oppManager.traitId];

  const keyThreats = useMemo(() => {
    return lineup
      .map((p, idx) => {
        if (!p) return null;
        const syn = oppChemistry.slotSynergies[idx];
        return {
          player: p,
          displayOvr: syn ? syn.effectiveOvrWithSynergy : p.ovr,
          totalBonus: syn?.totalBonus ?? 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.displayOvr - a.displayOvr || b.player.ovr - a.player.ovr)
      .slice(0, 3);
  }, [lineup, oppChemistry.slotSynergies]);

  return (
    <div className="space-y-1.5">
      {/* Pitch Header Strip (includes formation + chemistry + opponent manager trait) */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 text-[11px] min-h-[22px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0 border border-white/25"
            style={{ backgroundColor: opponent.primaryColor }}
          />
          <span className="truncate font-bold text-slate-200">
            {opponent.name}
          </span>
          <span className="rounded border border-slate-700/80 bg-slate-900/90 px-1.5 py-0.5 font-display text-[10px] font-bold text-slate-200 shrink-0">
            {shortFormationLabel(opponent.formation)}
          </span>
          <span className="rounded border border-slate-700/70 bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 shrink-0">
            {TACTICS[opponent.defaultTactic].shortName}
          </span>
          <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300/90 tabular-nums shrink-0">
            케미 {oppChemistry.total} (
            {oppChemistry.chemistryOvrBonus >= 0 ? '+' : ''}
            {oppChemistry.chemistryOvrBonus.toFixed(1)})
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 shrink-0 tabular-nums"
          title={`${oppManager.name} (OVR ${oppManager.ovr} · ${oppTraitCfg?.name ?? ''} · ${oppMgrEffect.compactSummary})`}
        >
          <span className="hidden sm:inline">{oppManager.name}</span>
          <span className="text-amber-300/85">{oppManager.ovr}</span>
          {oppTraitCfg && (
            <span
              className="rounded px-1 py-px text-[9px] font-extrabold text-slate-950"
              style={{ backgroundColor: oppTraitCfg.badgeColor }}
            >
              {oppTraitCfg.name}
              {oppMgrEffect.targetCount > 0
                ? ` ${Math.min(oppMgrEffect.matchedCount, oppMgrEffect.targetCount)}/${oppMgrEffect.targetCount}`
                : ''}
            </span>
          )}
        </span>
      </div>

      {/* Opponent Formation Pitch with Vivid Hover-Highlighted Synergy Lines */}
      <div
        onPointerLeave={() => setHoveredIdx(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setHoveredIdx(null);
          }
        }}
        className="relative aspect-[4/3.15] sm:aspect-[4/3.3] w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#0e1923] via-[#0c171b] to-[#0b1517]"
      >
        {/* Crisp Minimal Pitch SVG Lines + 4-Color Parallel Chemistry Links */}
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
            stroke="rgba(148,163,184,0.12)"
            strokeWidth="0.5"
          />
          <line
            x1="4"
            y1="50"
            x2="96"
            y2="50"
            stroke="rgba(148,163,184,0.11)"
            strokeWidth="0.42"
          />
          <circle
            cx="50"
            cy="50"
            r="10.5"
            fill="none"
            stroke="rgba(148,163,184,0.11)"
            strokeWidth="0.42"
          />
          <rect
            x="24"
            y="4"
            width="52"
            height="14"
            fill="none"
            stroke="rgba(148,163,184,0.10)"
            strokeWidth="0.42"
          />
          <rect
            x="24"
            y="82"
            width="52"
            height="14"
            fill="none"
            stroke="rgba(148,163,184,0.10)"
            strokeWidth="0.42"
          />

          {/* 4-Pillar Player Synergy Parallel Lines */}
          {oppChemistry.links.map((link) => {
            const fromSlot = config.slots[link.fromIndex];
            const toSlot = config.slots[link.toIndex];
            if (!fromSlot || !toSlot) return null;

            const hasHover = hoveredIdx !== null;
            const isLinkFocused =
              hasHover &&
              (link.fromIndex === hoveredIdx || link.toIndex === hoveredIdx);

            const activeLines = link.activeLines;
            if (activeLines.length === 0) {
              return (
                <line
                  key={`opp-${link.fromIndex}-${link.toIndex}-none`}
                  x1={fromSlot.x}
                  y1={fromSlot.y}
                  x2={toSlot.x}
                  y2={toSlot.y}
                  stroke="rgba(148, 163, 184, 0.16)"
                  strokeOpacity={hasHover ? (isLinkFocused ? 0.35 : 0.08) : 0.16}
                  strokeWidth="0.45"
                  strokeDasharray="2 3"
                  strokeLinecap="round"
                />
              );
            }

            const dx = toSlot.x - fromSlot.x;
            const dy = toSlot.y - fromSlot.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const spacing =
              activeLines.length >= 4
                ? 0.8
                : activeLines.length === 3
                  ? 1.0
                  : 1.12;
            const centerOffset = ((activeLines.length - 1) * spacing) / 2;
            const baseWidth =
              activeLines.length >= 4
                ? 0.6
                : activeLines.length === 3
                  ? 0.7
                  : 0.82;
            const strokeOpacity = hasHover
              ? isLinkFocused
                ? 1
                : 0.38
              : 0.86;
            const strokeWidth = hasHover
              ? isLinkFocused
                ? baseWidth + 0.16
                : baseWidth * 0.85
              : baseWidth;

            return activeLines.map((lineType, lineIdx) => {
              const offset = lineIdx * spacing - centerOffset;
              return (
                <line
                  key={`opp-${link.fromIndex}-${link.toIndex}-${lineType}`}
                  x1={fromSlot.x + nx * offset}
                  y1={fromSlot.y + ny * offset}
                  x2={toSlot.x + nx * offset}
                  y2={toSlot.y + ny * offset}
                  stroke={LINE_COLORS[lineType]}
                  strokeOpacity={strokeOpacity}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
              );
            });
          })}
        </svg>

        {/* Opponent 11 Player Nodes */}
        {config.slots.map((slot, idx) => {
          const player = lineup[idx];
          const syn = oppChemistry.slotSynergies[idx];
          const displayOvr = syn
            ? syn.effectiveOvrWithSynergy
            : (player?.ovr ?? 0);
          const totalBonus = syn?.totalBonus ?? 0;
          const neighborBonus = syn?.neighborBonus ?? 0;
          const managerBonus = syn?.managerBonus ?? 0;
          const primaryStyle = player?.playstyles[0]
            ? PLAYSTYLES[player.playstyles[0]]?.shortName
            : null;
          const isLegendCard = Boolean(player?.isLegend);
          const isSuper = !isLegendCard && ((player?.ovr ?? 0) >= 91 || displayOvr >= 92);
          const isWorld = !isLegendCard && !isSuper && ((player?.ovr ?? 0) >= 87 || displayOvr >= 88);
          const synTooltip =
            player && syn
              ? [
                  `${player.name} (기본 ${player.ovr} → 실효 ${displayOvr})`,
                  ...(primaryStyle ? [primaryStyle] : []),
                  ...syn.reasons,
                ].join(' · ')
              : player
                ? `${player.name} (OVR ${player.ovr}${primaryStyle ? ` · ${primaryStyle}` : ''})`
                : undefined;

          return (
            <div
              key={`opp-slot-${slot.index}`}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') {
                  setHoveredIdx(idx);
                }
              }}
              onPointerLeave={() =>
                setHoveredIdx((prev) => (prev === idx ? null : prev))
              }
              onClick={(e) => {
                e.stopPropagation();
                setHoveredIdx((prev) => (prev === idx ? null : idx));
              }}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center cursor-pointer"
            >
              <div
                title={synTooltip}
                className={`flex flex-col items-center rounded-lg px-1.5 py-0.5 min-w-[54px] sm:min-w-[66px] max-w-[84px] sm:max-w-[94px] text-center shadow-md transition-colors ${
                  isLegendCard
                    ? 'bg-gradient-to-b from-amber-950/95 via-stone-900/95 to-amber-950/95 border border-amber-400/90 shadow-[0_0_10px_rgba(251,191,36,0.34)]'
                    : isSuper
                      ? 'bg-gradient-to-b from-cyan-950/95 via-slate-900/95 to-cyan-950/95 border border-cyan-400/85 shadow-[0_0_10px_rgba(34,211,238,0.28)]'
                      : isWorld
                        ? 'bg-gradient-to-b from-sky-950/90 via-[#0e1726]/95 to-sky-950/90 border border-sky-400/65 shadow-[0_0_8px_rgba(56,189,248,0.20)]'
                        : 'border border-slate-700/75 bg-[#0f1621]/95 hover:border-slate-500/80'
                }`}
              >
                <div className="flex items-center justify-center gap-0.5 leading-none tabular-nums">
                  <span
                    className={`font-display text-[11px] sm:text-xs font-bold ${
                      isLegendCard
                        ? 'text-amber-300'
                        : isSuper
                          ? 'text-cyan-200'
                          : isWorld
                            ? 'text-sky-200'
                            : 'text-slate-100'
                    }`}
                  >
                    {player ? displayOvr : '-'}
                  </span>
                  {totalBonus > 0 && (
                    <span
                      title={[
                        neighborBonus > 0
                          ? `연결 ${syn?.lineCount ?? 0}선 (+${neighborBonus})`
                          : null,
                        managerBonus > 0 ? `감독 궁합 (+${managerBonus})` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      className="rounded bg-emerald-950/80 border border-emerald-500/25 px-0.5 py-px text-[7.5px] sm:text-[8px] font-bold text-emerald-300/90 leading-none"
                    >
                      +{totalBonus}
                    </span>
                  )}
                  {managerBonus > 0 && (
                    <span
                      title={`감독 궁합 (+${managerBonus})`}
                      className="text-[8.5px] font-bold text-amber-300 leading-none drop-shadow-[0_0_2px_rgba(251,191,36,0.45)]"
                    >
                      ★
                    </span>
                  )}
                  {player && (
                    <CountryFlagSvg
                      code={player.nationalityCode}
                      nationality={player.nationality}
                      size="xs"
                    />
                  )}
                </div>

                {player ? (
                  <div className="mt-0.5 flex items-center justify-center gap-0.5 max-w-full">
                    {onClickPlayerName ? (
                      <PlayerNameButton
                        onClick={() => onClickPlayerName(player.id)}
                        title={synTooltip ?? `${player.name} 세부 스탯`}
                        className="max-w-[70px] sm:max-w-[84px] text-[8.5px] sm:text-[9.5px] font-semibold text-slate-200 text-center leading-tight"
                      >
                        {shortLastName(player.name)}
                      </PlayerNameButton>
                    ) : (
                      <span className="max-w-[70px] sm:max-w-[84px] truncate text-[8.5px] sm:text-[9.5px] font-semibold text-slate-200 leading-tight">
                        {shortLastName(player.name)}
                      </span>
                    )}
                    {(() => {
                      const cond = conditionMap?.[player.id];
                      if (!cond) return null;
                      const injured = isPlayerActivelyInjured(cond);
                      const mTier = getMoraleTier(cond.morale);
                      return (
                        <>
                          {injured && cond.injury && (
                            <PixelStatusIcon
                              variant="injury"
                              size={9}
                              title={getInjuryTooltip(cond.injury)}
                            />
                          )}
                          {mTier === 'ecstatic' && (
                            <PixelStatusIcon
                              variant="morale_high"
                              size={9}
                              title={`사기 ${getMoraleLabel(cond.morale)}`}
                            />
                          )}
                          {mTier === 'frozen' && (
                            <PixelStatusIcon
                              variant="morale_low"
                              size={9}
                              title={`사기 ${getMoraleLabel(cond.morale)}`}
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="mt-0.5 text-[8.5px] text-slate-500">미정</span>
                )}
              </div>
              <span className="mt-0.5 rounded bg-slate-950/80 px-1 text-[8px] font-medium text-slate-400">
                {slot.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Compact Key Threats Strip */}
      {keyThreats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1 text-[10px]">
          <span className="font-semibold text-slate-400 shrink-0">핵심 경계</span>
          {keyThreats.map(({ player: p, displayOvr, totalBonus }) => (
            <span
              key={`threat-${p.id}`}
              className="inline-flex items-center gap-1 rounded-md bg-[#0d131d] border border-slate-800 px-1.5 py-0.5 text-slate-200"
            >
              <CountryFlagSvg
                code={p.nationalityCode}
                nationality={p.nationality}
                size="xs"
              />
              {onClickPlayerName ? (
                <PlayerNameButton
                  onClick={() => onClickPlayerName(p.id)}
                  className="font-semibold text-slate-200"
                >
                  {p.name}
                </PlayerNameButton>
              ) : (
                <span className="font-semibold">{p.name}</span>
              )}
              <span className="font-mono text-amber-200/90 font-bold tabular-nums">
                {displayOvr}
              </span>
              {totalBonus > 0 && (
                <span className="text-[9px] font-bold text-emerald-300/85 tabular-nums">
                  +{totalBonus}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Opponent Real Injury Report */}
      {injuredPlayers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-950/20 px-2.5 py-1.5 text-[10px]">
          <span className="inline-flex items-center gap-1 font-bold text-rose-300 shrink-0">
            <PixelStatusIcon variant="injury" size={11} />
            상대 부상자:
          </span>
          {injuredPlayers.slice(0, 4).map(({ player: p, injury }) => (
            <span
              key={`opp-inj-${p.id}`}
              title={getInjuryTooltip(injury)}
              className="inline-flex items-center gap-1 rounded bg-slate-950/70 border border-rose-500/30 px-1.5 py-0.5 text-rose-200"
            >
              <CountryFlagSvg
                code={p.nationalityCode}
                nationality={p.nationality}
                size="xs"
              />
              <span className="font-bold">{p.name}</span>
              <span className="text-rose-300/80">
                ({injury.matchesRemaining}경기)
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

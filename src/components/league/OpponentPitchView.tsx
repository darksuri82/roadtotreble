import { useMemo } from 'react';
import { getClubManager } from '../../data/aiManagers';
import { FORMATIONS } from '../../data/formations';
import { MANAGER_TRAITS } from '../../data/managerTraits';
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
  club: '#10b981', // Emerald: Same Club / Former Clubs
  nation: '#38bdf8', // Sky Blue: Same Nationality
  style: '#f59e0b', // Gold: Complementary Playstyle Synergy
  elite: '#c084fc', // Violet: Elite Pair (88+ ↔ 88+)
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
  const { state } = useGame();
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

  // Apply the exact same v5.0 4-pillar player synergy + independent AI Manager OVR compatibility!
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
            {shortFormationLabel(opponent.formation)}
          </span>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 shrink-0">
            {TACTICS[opponent.defaultTactic].shortName}
          </span>
        </div>
        <span
          className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums"
          title={`${oppManager.name} (OVR ${oppManager.ovr} · ${MANAGER_TRAITS[oppManager.traitId]?.name ?? ''})`}
        >
          {oppManager.name}{' '}
          <span className="text-amber-300">{oppManager.ovr}</span>
        </span>
      </div>

      {/* Opponent Formation Pitch with 4-Pillar Synergy Lines & Boosted OVRs */}
      <div className="relative aspect-[4/4.3] w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#0f1b26] via-[#0c1a1c] to-[#0d1919]">
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

          {/* 4-Pillar Player Synergy Parallel Lines */}
          {oppChemistry.links.map((link) => {
            const fromSlot = config.slots[link.fromIndex];
            const toSlot = config.slots[link.toIndex];
            if (!fromSlot || !toSlot) return null;

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
                ? 0.82
                : activeLines.length === 3
                  ? 1.05
                  : 1.15;
            const centerOffset = ((activeLines.length - 1) * spacing) / 2;

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
                  strokeOpacity={0.88}
                  strokeWidth={
                    activeLines.length >= 4
                      ? '0.6'
                      : activeLines.length === 3
                        ? '0.7'
                        : '0.82'
                  }
                  strokeLinecap="round"
                />
              );
            });
          })}
        </svg>

        {/* Top-Left Chemistry Overlay (Mirrors Our PitchBoard) */}
        <div className="pointer-events-none absolute left-3 top-2.5 z-10 flex items-center gap-1.5">
          <span className="rounded bg-slate-950/85 px-2 py-0.5 font-display text-xs font-bold text-slate-100">
            {shortFormationLabel(opponent.formation)}
          </span>
          <span className="rounded bg-slate-950/85 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 tabular-nums">
            케미 {oppChemistry.total} (
            {oppChemistry.chemistryOvrBonus >= 0 ? '+' : ''}
            {oppChemistry.chemistryOvrBonus.toFixed(1)})
          </span>
        </div>

        {/* Opponent 11 Player Nodes */}
        {config.slots.map((slot, idx) => {
          const player = lineup[idx];
          const syn = oppChemistry.slotSynergies[idx];
          const displayOvr = syn
            ? syn.effectiveOvrWithSynergy
            : (player?.ovr ?? 0);
          const totalBonus = syn?.totalBonus ?? 0;
          const primaryStyle = player?.playstyles[0]
            ? PLAYSTYLES[player.playstyles[0]]?.shortName
            : null;
          const isSuper = displayOvr >= 90 || (player?.ovr ?? 0) >= 88;
          const isThreat = displayOvr >= 86 || (player?.ovr ?? 0) >= 85;
          const synTooltip =
            player && syn
              ? [
                  `${player.name} (기본 ${player.ovr} → 실효 ${displayOvr})`,
                  ...syn.reasons,
                ].join(' · ')
              : player
                ? `${player.name} (OVR ${player.ovr})`
                : undefined;

          return (
            <div
              key={`opp-slot-${slot.index}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
            >
              <div
                title={synTooltip}
                className={`flex flex-col items-center rounded-xl px-1.5 py-1 min-w-[64px] max-w-[84px] text-center shadow-md ${
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
                    {player ? displayOvr : '-'}
                  </span>
                  {totalBonus > 0 && (
                    <span className="rounded bg-emerald-500/25 px-1 py-0.2 text-[9px] font-black text-emerald-300 tabular-nums">
                      +{totalBonus}
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
                  <div className="mt-0.5 flex items-center gap-0.5">
                    {onClickPlayerName ? (
                      <PlayerNameButton
                        onClick={() => onClickPlayerName(player.id)}
                        title={synTooltip ?? `${player.name} 세부 스탯`}
                        className="max-w-[74px] text-[10px] font-bold text-white text-center leading-tight"
                      >
                        {shortLastName(player.name)}
                      </PlayerNameButton>
                    ) : (
                      <span className="max-w-[74px] truncate text-[10px] font-bold text-white leading-tight">
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
                              size={10}
                              title={getInjuryTooltip(cond.injury)}
                            />
                          )}
                          {mTier === 'ecstatic' && (
                            <PixelStatusIcon
                              variant="morale_high"
                              size={10}
                              title={`사기 ${getMoraleLabel(cond.morale)}`}
                            />
                          )}
                          {mTier === 'frozen' && (
                            <PixelStatusIcon
                              variant="morale_low"
                              size={10}
                              title={`사기 ${getMoraleLabel(cond.morale)}`}
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="mt-0.5 text-[9px] text-slate-500">미정</span>
                )}

                <div className="mt-0.5 flex items-center gap-1 leading-tight">
                  <span className="text-[8px] font-bold text-slate-400">
                    {slot.label}
                  </span>
                  {primaryStyle && (
                    <span className="max-w-[54px] truncate rounded bg-slate-900/90 px-1 text-[8px] font-semibold text-slate-300">
                      {primaryStyle}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compact Key Threats Strip */}
      {keyThreats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1 text-[10px]">
          <span className="font-bold text-rose-300 shrink-0">핵심 경계:</span>
          {keyThreats.map(({ player: p, displayOvr, totalBonus }) => (
            <span
              key={`threat-${p.id}`}
              className="inline-flex items-center gap-1 rounded-md bg-[#0b1018] border border-slate-800 px-1.5 py-0.5 text-slate-200"
            >
              <CountryFlagSvg
                code={p.nationalityCode}
                nationality={p.nationality}
                size="xs"
              />
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
              <span className="font-mono text-amber-300 font-bold tabular-nums">
                {displayOvr}
              </span>
              {totalBonus > 0 && (
                <span className="text-[9px] font-black text-emerald-400 tabular-nums">
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

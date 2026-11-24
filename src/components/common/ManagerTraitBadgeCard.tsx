import { Sparkles } from 'lucide-react';
import {
  evaluateManagerTeamEffect,
  MANAGER_TRAITS,
} from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type { ManagerAvatarConfig, ManagerTraitId } from '../../types/game';
import type { TacticId } from '../../types/league';
import type { Player } from '../../types/player';
import { PixelManagerAvatar } from './PixelManagerAvatar';

interface ManagerTraitBadgeCardProps {
  traitId: ManagerTraitId | null;
  managerName?: string;
  managerAvatar?: ManagerAvatarConfig;
  starters?: (Player | null)[];
  tactic?: TacticId;
  compact?: boolean;
}

export function ManagerTraitBadgeCard({
  traitId,
  managerName,
  managerAvatar,
  starters: startersProp,
  tactic: tacticProp,
  compact = false,
}: ManagerTraitBadgeCardProps) {
  const { state } = useGame();
  if (!traitId) return null;
  const trait = MANAGER_TRAITS[traitId];
  if (!trait) return null;

  const displayName = managerName ?? state.manager.name;
  const displayAvatar = managerAvatar ?? state.manager.avatar;
  const effectiveStarters = startersProp ?? state.starters;
  const effectiveTactic: TacticId =
    tacticProp ??
    state.season?.nextMatchTactic ??
    state.season?.defaultTactic ??
    state.defaultTactic;

  const teamEffect = evaluateManagerTeamEffect({
    traitId,
    starters: effectiveStarters,
    tactic: effectiveTactic,
  });

  const hasGauge = teamEffect.targetCount > 0;
  const gaugePct = hasGauge
    ? Math.min(100, Math.round(teamEffect.progressRatio * 100))
    : 0;
  const isMax = hasGauge && teamEffect.matchedCount >= teamEffect.targetCount;

  return (
    <div
      className={`rounded-xl border border-slate-800/90 bg-[#0e141d] ${
        compact ? 'p-2.5' : 'p-3.5'
      } space-y-2`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-[#131c28]">
            <PixelManagerAvatar
              avatar={displayAvatar}
              clubPrimaryColor={state.userClub.primaryColor}
              clubSecondaryColor={state.userClub.secondaryColor}
              size={28}
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate">
                {displayName}
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950"
                style={{ backgroundColor: trait.badgeColor }}
              >
                {trait.name}
              </span>
            </div>
            {teamEffect.compactSummary && (
              <div className="mt-0.5 text-[10.5px] font-bold text-violet-200 tabular-nums truncate">
                {teamEffect.compactSummary}
              </div>
            )}
          </div>
        </div>
        {trait.synergyTactic && (
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${
              teamEffect.isTacticSynergyActive
                ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5" />
            {TACTICS[trait.synergyTactic].shortName}
            {teamEffect.isTacticSynergyActive ? ' ★' : ''}
          </span>
        )}
      </div>

      {/* Live 1..8 (or 1..6) Progressive Philosophy Bar */}
      {hasGauge && (
        <div className="flex items-center gap-2 text-[10px] tabular-nums">
          <span className="text-slate-400 font-semibold shrink-0">
            철학{' '}
            <span className={isMax ? 'text-emerald-300 font-extrabold' : 'text-white font-bold'}>
              {Math.min(teamEffect.matchedCount, teamEffect.targetCount)}/{teamEffect.targetCount}
            </span>
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-900 border border-slate-800">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${gaugePct}%`,
                backgroundColor: isMax ? '#10b981' : trait.badgeColor,
              }}
            />
          </div>
          {isMax && (
            <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-1 py-px text-[8.5px] font-black text-emerald-300">
              MAX
            </span>
          )}
        </div>
      )}

      {!compact && (
        <p className="rounded-lg border border-slate-800/80 bg-[#090e15] px-2.5 py-1.5 text-[10.5px] leading-relaxed text-slate-300">
          {trait.effectSummary}
        </p>
      )}

      {trait.synergyPlaystyles && trait.synergyPlaystyles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          <span className="text-slate-500 font-semibold mr-0.5">궁합 ★+1:</span>
          {trait.synergyPlaystyles.map((psId) => {
            const ps = PLAYSTYLES[psId];
            if (!ps) return null;
            return (
              <span
                key={psId}
                className="rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 font-semibold text-violet-200"
              >
                {ps.shortName}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

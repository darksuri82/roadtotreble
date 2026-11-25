import { Sparkles } from 'lucide-react';
import {
  evaluateManagerFitDetail,
  MANAGER_TRAITS,
} from '../../data/managerTraits';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type {
  FormationId,
  ManagerAvatarConfig,
  ManagerTraitId,
} from '../../types/game';
import type { TacticId } from '../../types/league';
import type { Player } from '../../types/player';
import { ManagerFitBadge } from './ManagerFitBadge';
import { PixelManagerAvatar } from './PixelManagerAvatar';

interface ManagerTraitBadgeCardProps {
  traitId: ManagerTraitId | null;
  managerName?: string;
  managerAvatar?: ManagerAvatarConfig;
  starters?: (Player | null)[];
  tactic?: TacticId;
  formation?: FormationId;
  compact?: boolean;
}

export function ManagerTraitBadgeCard({
  traitId,
  managerName,
  managerAvatar,
  starters: startersProp,
  tactic: tacticProp,
  formation: formationProp,
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
  const effectiveFormation = formationProp ?? state.formation;

  const detail = evaluateManagerFitDetail({
    traitId,
    starters: effectiveStarters,
    tactic: effectiveTactic,
  });
  if (!detail) return null;

  const isProgressive = detail.scalingMode === 'progressive';
  const gaugePct = isProgressive
    ? Math.min(100, Math.round((detail.matchedCount / detail.totalSlots) * 100))
    : 0;
  const isMax = isProgressive && detail.matchedCount >= detail.totalSlots;

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
                className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950 whitespace-nowrap"
                style={{ backgroundColor: trait.badgeColor }}
              >
                {trait.name}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] tabular-nums">
              {isProgressive ? (
                <>
                  {detail.effect.compactSummary && (
                    <span className="font-semibold text-emerald-300/95 truncate">
                      {detail.effect.compactSummary}
                    </span>
                  )}
                  {detail.totalOvrDelta > 0 && (
                    <span className="rounded border border-emerald-500/30 bg-emerald-500/12 px-1 py-px text-[9.5px] font-bold text-emerald-200 whitespace-nowrap">
                      팀 OVR +{detail.totalOvrDelta.toFixed(1)}
                    </span>
                  )}
                </>
              ) : (
                <span className="font-semibold text-sky-300/95 truncate">
                  팀 효과 인원 무관 · {detail.situationalRule?.shortTrigger}
                </span>
              )}
            </div>
          </div>
        </div>
        {trait.synergyTactic && (
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
              detail.effect.isTacticSynergyActive
                ? 'border-emerald-400/50 bg-emerald-500/18 text-emerald-200'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5" />
            {TACTICS[trait.synergyTactic].shortName}
            {detail.effect.isTacticSynergyActive ? (
              <span className="text-amber-300">★</span>
            ) : (
              ''
            )}
          </span>
        )}
      </div>

      {/* Live Progressive Bar OR Situational Non-Scaling Strip */}
      {isProgressive ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="text-slate-400 font-semibold shrink-0 whitespace-nowrap">
              감독 궁합{' '}
              <span
                className={
                  isMax
                    ? 'text-emerald-300 font-extrabold'
                    : 'text-white font-bold'
                }
              >
                {detail.matchedCount}/{detail.totalSlots}
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
              <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-1 py-px text-[8.5px] font-black text-emerald-300 whitespace-nowrap">
                MAX
              </span>
            )}
          </div>
          <ManagerFitBadge
            traitId={traitId}
            starters={effectiveStarters}
            tactic={effectiveTactic}
            formation={effectiveFormation}
            variant="strip"
            showTraitName={false}
          />
        </div>
      ) : (
        <ManagerFitBadge
          traitId={traitId}
          starters={effectiveStarters}
          tactic={effectiveTactic}
          formation={effectiveFormation}
          variant="strip"
          showTraitName={false}
        />
      )}

      {!compact && (
        <p className="rounded-lg border border-slate-800/80 bg-[#090e15] px-2.5 py-1.5 text-[10.5px] leading-relaxed text-slate-300 break-keep">
          {trait.effectSummary}
        </p>
      )}

      {detail.criteriaLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          <span className="text-slate-400 font-semibold mr-0.5 whitespace-nowrap">
            <span className="text-amber-300 mr-0.5">★</span>
            {isProgressive ? '궁합 조건:' : '개인 +1 조건:'}
          </span>
          {detail.criteriaLabels.map((label) => (
            <span
              key={label}
              className="rounded-md border border-slate-700/80 bg-[#090e15] px-1.5 py-0.5 font-semibold text-slate-200 whitespace-nowrap"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


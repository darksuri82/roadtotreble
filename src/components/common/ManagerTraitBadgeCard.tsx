import { Sparkles } from 'lucide-react';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type { ManagerAvatarConfig, ManagerTraitId } from '../../types/game';
import { PixelManagerAvatar } from './PixelManagerAvatar';

interface ManagerTraitBadgeCardProps {
  traitId: ManagerTraitId | null;
  managerName?: string;
  managerAvatar?: ManagerAvatarConfig;
  compact?: boolean;
}

export function ManagerTraitBadgeCard({
  traitId,
  managerName,
  managerAvatar,
  compact = false,
}: ManagerTraitBadgeCardProps) {
  const { state } = useGame();
  if (!traitId) return null;
  const trait = MANAGER_TRAITS[traitId];
  if (!trait) return null;

  const displayName = managerName ?? state.manager.name;
  const displayAvatar = managerAvatar ?? state.manager.avatar;

  return (
    <div
      className={`rounded-xl border border-slate-800/90 bg-[#0e141d] ${
        compact ? 'p-3' : 'p-3.5'
      } space-y-2.5`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-[#131c28]">
            <PixelManagerAvatar
              avatar={displayAvatar}
              clubPrimaryColor={state.userClub.primaryColor}
              clubSecondaryColor={state.userClub.secondaryColor}
              size={30}
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate">
                {displayName} 감독
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950"
                style={{ backgroundColor: trait.badgeColor }}
              >
                {trait.name}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400 truncate">
              {trait.tagline}
            </p>
          </div>
        </div>
        {trait.synergyTactic && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            <Sparkles className="w-2.5 h-2.5" />
            {TACTICS[trait.synergyTactic].shortName}
          </span>
        )}
      </div>

      <p className="rounded-lg border border-slate-800/80 bg-[#090e15] px-2.5 py-2 text-[11px] leading-relaxed text-slate-300">
        {trait.effectSummary}
      </p>

      {trait.synergyPlaystyles && trait.synergyPlaystyles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          <span className="text-slate-500 font-semibold mr-0.5">시너지 스타일:</span>
          {trait.synergyPlaystyles.map((psId) => {
            const ps = PLAYSTYLES[psId];
            if (!ps) return null;
            return (
              <span
                key={psId}
                className="rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 font-semibold text-sky-200"
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

import { Award, Sparkles } from 'lucide-react';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import { TACTICS } from '../../engine/tacticEngine';
import type { ManagerTraitId } from '../../types/game';

interface ManagerTraitBadgeCardProps {
  traitId: ManagerTraitId | null;
  compact?: boolean;
}

export function ManagerTraitBadgeCard({
  traitId,
  compact = false,
}: ManagerTraitBadgeCardProps) {
  if (!traitId) return null;
  const trait = MANAGER_TRAITS[traitId];
  if (!trait) return null;

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-gradient-to-br from-[#0e1522] to-[#0b1018] ${
        compact ? 'p-3' : 'p-3.5'
      } space-y-2`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10"
            style={{ backgroundColor: `${trait.badgeColor}22`, color: trait.badgeColor }}
          >
            <Award className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                감독 강점
              </span>
              <span
                className="text-xs font-extrabold truncate"
                style={{ color: trait.badgeColor }}
              >
                {trait.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">{trait.tagline}</p>
          </div>
        </div>
        {trait.synergyTactic && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            <Sparkles className="w-2.5 h-2.5" />
            추천 전술: {TACTICS[trait.synergyTactic].shortName}
          </span>
        )}
      </div>

      <p className="rounded-lg border border-slate-800/80 bg-[#090e16] px-2.5 py-2 text-[11px] leading-relaxed text-slate-200">
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

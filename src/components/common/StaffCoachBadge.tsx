import {
  evaluateStaffCoachEffect,
  getStaffCoachById,
} from '../../engine/staffCoachEngine';
import type { StaffCoachId } from '../../types/game';
import type { TacticId } from '../../types/league';
import { PixelManagerAvatar } from './PixelManagerAvatar';

interface StaffCoachBadgeProps {
  coachId: StaffCoachId | null | undefined;
  activeTactic?: TacticId;
  compact?: boolean;
}

export function StaffCoachBadge({
  coachId,
  activeTactic,
  compact = false,
}: StaffCoachBadgeProps) {
  const coach = getStaffCoachById(coachId);
  if (!coach) return null;

  const effect = evaluateStaffCoachEffect(coach.id, activeTactic);
  const isTacticActive =
    coach.category !== 'tactic' || effect.tacticBonusActive;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border ${
        isTacticActive
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-white/10 bg-[#111822]'
      } ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'}`}
      title={`${coach.name} (${coach.title}) · ${coach.detailEffect}`}
    >
      <div className="flex h-6 w-5 shrink-0 items-center justify-center rounded bg-[#090d13] overflow-hidden border border-white/10">
        <PixelManagerAvatar avatar={coach.avatar} size={18} pose="default" />
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[11px] font-bold text-white whitespace-nowrap truncate max-w-[7.5rem]">
          {coach.name}
        </span>
        <span
          className={`text-[10px] font-bold whitespace-nowrap ${
            isTacticActive ? 'text-emerald-300' : 'text-slate-400'
          }`}
        >
          {isTacticActive ? coach.shortEffect : '전술 미적용'}
        </span>
      </div>
    </div>
  );
}

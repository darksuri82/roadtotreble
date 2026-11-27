import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useGame } from '../../store/GameContext';
import { JerseySvg } from './JerseySvg';
import { PixelManagerAvatar } from './PixelManagerAvatar';
import { ProfileCustomizerModal } from './ProfileCustomizerModal';

interface ActiveProfileChipProps {
  className?: string;
}

/**
 * Compact 1-line club & manager identity pill for setup screens.
 * Opens the shared ProfileCustomizerModal when clicked so users can
 * optionally adjust club/manager without cluttering the setup flow.
 */
export function ActiveProfileChip({ className = '' }: ActiveProfileChipProps) {
  const { state, applyUserProfile } = useGame();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group inline-flex items-center gap-2 rounded-xl border border-slate-800/90 bg-[#0d141f] px-2.5 py-1.5 text-left transition-colors hover:border-emerald-500/45 hover:bg-[#111b29] cursor-pointer max-w-full ${className}`}
        title="감독 · 구단 커스텀 수정"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex h-7 w-6 items-center justify-center rounded-md border border-slate-800 bg-[#090e15]">
            <PixelManagerAvatar
              avatar={state.manager.avatar}
              clubPrimaryColor={state.userClub.primaryColor}
              clubSecondaryColor={state.userClub.secondaryColor}
              size={20}
            />
          </div>
          <JerseySvg
            primaryColor={state.userClub.primaryColor}
            secondaryColor={state.userClub.secondaryColor}
            pattern={state.userClub.pattern}
            label={state.userClub.shortName}
            size={22}
          />
        </div>

        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-xs font-extrabold text-white max-w-[130px] sm:max-w-[180px]">
              {state.userClub.name}
            </span>
            <span className="rounded bg-slate-800 px-1 py-px font-mono text-[9.5px] font-bold text-emerald-300 shrink-0">
              {state.userClub.shortName}
            </span>
          </div>
          <div className="truncate text-[10px] text-slate-400">
            {state.manager.name} 감독
          </div>
        </div>

        <span className="ml-0.5 inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-[#121b28] px-1.5 py-1 text-[10px] font-bold text-slate-300 group-hover:border-emerald-400/50 group-hover:text-emerald-300 whitespace-nowrap shrink-0">
          <Pencil className="h-2.5 w-2.5 shrink-0" />
          수정
        </span>
      </button>

      {open && (
        <ProfileCustomizerModal
          initialNickname={state.manager.name}
          initialAvatar={state.manager.avatar}
          initialClubProfile={state.userClub}
          onApply={({ nickname, avatar, clubProfile }) =>
            applyUserProfile({
              clubProfile,
              managerName: nickname,
              managerAvatar: avatar,
            })
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

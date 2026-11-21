import { Sparkles, Trophy, X } from 'lucide-react';
import type { DomesticCupState } from '../../types/cup';
import type { ManagerAvatarConfig, UserClubProfile } from '../../types/game';
import type { Club, LeagueId } from '../../types/league';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { JerseySvg } from '../common/JerseySvg';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import {
  getDomesticCupTrophyVariant,
  PixelTrophySvg,
} from '../common/PixelTrophySvg';

interface CupChampionModalProps {
  cup: DomesticCupState;
  leagueId: LeagueId;
  userClub: UserClubProfile;
  managerName: string;
  managerAvatar: ManagerAvatarConfig;
  clubsById: Record<string, Club>;
  onClose: () => void;
}

export function CupChampionModal({
  cup,
  leagueId,
  userClub,
  managerName,
  managerAvatar,
  clubsById,
  onClose,
}: CupChampionModalProps) {
  const finalNode = cup.rounds.final[0];
  const finalResult = finalNode?.result;
  const oppId =
    finalNode?.homeTeamId === USER_CLUB_ID
      ? finalNode.awayTeamId
      : finalNode?.homeTeamId;
  const oppClub = oppId ? clubsById[oppId] : null;

  let finalScoreText = '';
  if (finalResult) {
    const isHome = finalResult.homeTeamId === USER_CLUB_ID;
    const ug = isHome ? finalResult.homeGoals : finalResult.awayGoals;
    const og = isHome ? finalResult.awayGoals : finalResult.homeGoals;
    const pen = finalResult.extraTime?.penalties;
    if (pen) {
      const up = isHome ? pen.homePenGoals : pen.awayPenGoals;
      const op = isHome ? pen.awayPenGoals : pen.homePenGoals;
      finalScoreText = `${ug} - ${og} (승부차기 ${up}-${op})`;
    } else if (finalResult.extraTime) {
      finalScoreText = `${ug} - ${og} (연장 승리)`;
    } else {
      finalScoreText = `${ug} - ${og}`;
    }
  }

  const trophyVariant = getDomesticCupTrophyVariant(leagueId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-amber-400/35 bg-gradient-to-b from-[#161e2b] via-[#111722] to-[#0c1119] p-6 text-center shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white cursor-pointer"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Subtle radial glow */}
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ backgroundColor: '#f59e0b' }}
        />

        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            CHAMPIONS · 트로피 획득
          </div>

          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {cup.meta.koreanName} 우승!
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {cup.meta.name} · 구단 역사에 빛나는 자국 컵 정상에 올랐습니다
          </p>

          {/* Center Pixel Trophy + Manager Avatar Showcase */}
          <div className="mt-6 flex items-end justify-center gap-5">
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-2.5">
                <PixelManagerAvatar
                  avatar={managerAvatar}
                  clubPrimaryColor={userClub.primaryColor}
                  clubSecondaryColor={userClub.secondaryColor}
                  size={64}
                />
              </div>
              <span className="mt-1.5 text-[11px] font-bold text-slate-300">
                {managerName} 감독
              </span>
            </div>

            <div className="relative flex flex-col items-center">
              <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-6 py-4 shadow-lg shadow-amber-500/10">
                <PixelTrophySvg variant={trophyVariant} size={96} animate />
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex h-[94px] w-[84px] items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/70 p-2.5">
                <JerseySvg
                  primaryColor={userClub.primaryColor}
                  secondaryColor={userClub.secondaryColor}
                  pattern={userClub.pattern}
                  label={userClub.shortName}
                  size={56}
                />
              </div>
              <span className="mt-1.5 max-w-[92px] truncate text-[11px] font-bold text-emerald-300">
                {userClub.name}
              </span>
            </div>
          </div>

          {/* Final Match Recap */}
          {oppClub && finalScoreText && (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/75 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                결승전 최종 스코어
              </div>
              <div className="mt-1 flex items-center justify-center gap-2 text-sm font-bold text-white">
                <span className="text-emerald-300">{userClub.shortName}</span>
                <span className="font-display text-lg text-amber-300">
                  {finalScoreText}
                </span>
                <span className="text-slate-300">{oppClub.name}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
          >
            <Trophy className="h-4 w-4" />
            우승 트로피 들어올리기
          </button>
        </div>
      </div>
    </div>
  );
}

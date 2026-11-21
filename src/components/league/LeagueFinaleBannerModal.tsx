import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Crown,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import type { UserClubProfile } from '../../types/game';
import type { Club, LeagueId, StandingRow } from '../../types/league';
import { JerseySvg } from '../common/JerseySvg';
import {
  getLeagueTrophyVariant,
  PixelTrophySvg,
} from '../common/PixelTrophySvg';

interface LeagueFinaleBannerModalProps {
  leagueId: LeagueId;
  leagueName: string;
  totalRounds: number;
  totalTeams: number;
  uclSpots: number;
  relegationSpots: number;
  userClub: UserClubProfile | Club;
  userStanding: StandingRow;
  finalRank: number;
  canEnterUcl?: boolean;
  onEnterUcl?: () => void;
  onClose: () => void;
}

export function getLeagueTrophyDisplayName(leagueId: LeagueId): string {
  switch (leagueId) {
    case 'epl':
      return '프리미어리그 크라운 트로피';
    case 'laliga':
      return '라리가 챔피언십 트로피';
    case 'seriea':
      return '세리에 A 스쿠데토 트로피';
    case 'bundesliga':
      return '분데스리가 마이스터샬레';
    case 'ligue1':
      return '리그 1 헥사고알 트로피';
  }
}

export function LeagueFinaleBannerModal({
  leagueId,
  leagueName,
  totalRounds,
  totalTeams,
  uclSpots,
  relegationSpots,
  userClub,
  userStanding,
  finalRank,
  canEnterUcl = false,
  onEnterUcl,
  onClose,
}: LeagueFinaleBannerModalProps) {
  const isChampion = finalRank === 1;
  const isUclSpot = finalRank >= 2 && finalRank <= uclSpots;
  const relegationStartRank = totalTeams - relegationSpots + 1;
  const isRelegated = finalRank >= relegationStartRank;

  const gd = userStanding.goalsFor - userStanding.goalsAgainst;
  const gdLabel = gd > 0 ? `+${gd}` : `${gd}`;
  const trophyName = getLeagueTrophyDisplayName(leagueId);

  const containerThemeCls = isChampion
    ? 'border-amber-400/75 bg-gradient-to-b from-amber-950/90 via-[#111822] to-[#0d131c] shadow-[0_0_55px_rgba(251,191,36,0.28)]'
    : isUclSpot
      ? 'border-sky-400/70 bg-gradient-to-b from-sky-950/85 via-[#111822] to-[#0d131c] shadow-[0_0_50px_rgba(56,189,248,0.24)]'
      : isRelegated
        ? 'border-rose-500/75 bg-gradient-to-b from-rose-950/90 via-[#141118] to-[#0d131c] shadow-[0_0_50px_rgba(244,63,94,0.25)]'
        : 'border-emerald-500/50 bg-gradient-to-b from-emerald-950/60 via-[#111822] to-[#0d131c] shadow-2xl';

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/88 p-3 sm:p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-3xl border-2 p-5 sm:p-6 text-center transition-all ${containerThemeCls}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Tag Pill */}
        <div className="flex items-center justify-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black tracking-wide ${
              isChampion
                ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
                : isUclSpot
                  ? 'border-sky-300/50 bg-sky-400/20 text-sky-200'
                  : isRelegated
                    ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
                    : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
            }`}
          >
            {isChampion ? (
              <>
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                {leagueName} {totalRounds}R 최종 우승!
              </>
            ) : isUclSpot ? (
              <>
                <Star className="w-3.5 h-3.5 fill-sky-300 text-sky-300" />
                {leagueName} {totalRounds}R 종료 · TOP {uclSpots}
              </>
            ) : isRelegated ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                {leagueName} {totalRounds}R 종료 · 하위 {relegationSpots}팀 강등권
              </>
            ) : (
              <>
                <Award className="w-3.5 h-3.5 text-emerald-300" />
                {leagueName} {totalRounds}R 정규 시즌 완주
              </>
            )}
          </span>
        </div>

        {/* Center Visual Icon / Pixel Trophy */}
        <div className="my-4 flex flex-col items-center justify-center">
          {isChampion ? (
            <div className="relative flex flex-col items-center">
              <div className="flex items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3.5 shadow-inner">
                <PixelTrophySvg
                  variant={getLeagueTrophyVariant(leagueId)}
                  size={84}
                  animate
                />
              </div>
              <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-200">
                <Sparkles className="w-3 h-3 text-amber-300" />
                {trophyName} 획득
              </span>
            </div>
          ) : isUclSpot ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-sky-400/45 bg-sky-500/15 shadow-inner">
              <Trophy className="h-10 w-10 text-sky-300" />
            </div>
          ) : isRelegated ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-rose-500/45 bg-rose-500/15 shadow-inner">
              <AlertTriangle className="h-10 w-10 text-rose-400" />
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80">
              <JerseySvg
                primaryColor={userClub.primaryColor}
                secondaryColor={userClub.secondaryColor}
                pattern={userClub.pattern}
                label={userClub.shortName}
                size={52}
              />
            </div>
          )}
        </div>

        {/* Headline Verdict */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-300">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: userClub.primaryColor }}
            />
            <span>{userClub.name}</span>
          </div>

          <h2
            className={`font-display text-2xl sm:text-3xl font-black tracking-tight ${
              isChampion
                ? 'text-amber-300'
                : isUclSpot
                  ? 'text-sky-300'
                  : isRelegated
                    ? 'text-rose-300'
                    : 'text-white'
            }`}
          >
            {isChampion
              ? `👑 ${leagueName} 챔피언! (최종 1위)`
              : isUclSpot
                ? `🏆 챔피언스리그 진출! (최종 ${finalRank}위)`
                : isRelegated
                  ? `🔻 강등! (최종 ${finalRank}위)`
                  : `${leagueName} 최종 ${finalRank}위`}
          </h2>

          <p className="text-xs text-slate-300 leading-relaxed">
            {isChampion
              ? `${totalRounds}라운드 대장정 끝에 정상을 차지하며 유럽 챔피언스리그 1시드(Pot 1) 자격을 획득했습니다!`
              : isUclSpot
                ? `치열한 상위권 경쟁을 뚫고 TOP ${uclSpots}에 안착하여 UEFA 챔피언스리그 본선 티켓을 거머쥐었습니다!`
                : isRelegated
                  ? `${leagueName} 잔류 마지노선(${relegationStartRank - 1}위)을 지키지 못하고 강등권(${relegationStartRank}~${totalTeams}위)으로 시즌을 마감했습니다.`
                  : `${totalRounds}라운드 정규 리그 일정을 모두 마쳤습니다. 아래에서 시즌 최종 성적을 확인하세요.`}
          </p>
        </div>

        {/* 4-Column Pure Regular League Summary Strip (Rank / Record / Points / GD) */}
        <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl border border-slate-800/90 bg-[#090e15]/90 p-3 text-center tabular-nums">
          <div>
            <div className="text-[10px] font-bold text-slate-400">최종 순위</div>
            <div
              className={`mt-0.5 font-display text-xl font-black ${
                isChampion
                  ? 'text-amber-300'
                  : isUclSpot
                    ? 'text-sky-300'
                    : isRelegated
                      ? 'text-rose-300'
                      : 'text-white'
              }`}
            >
              {finalRank}위
            </div>
            <div className="text-[9px] text-slate-500">/ {totalTeams}팀</div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400">최종 전적</div>
            <div className="mt-0.5 font-display text-base sm:text-lg font-extrabold text-white">
              {userStanding.won}승 {userStanding.drawn}무 {userStanding.lost}패
            </div>
            <div className="text-[9px] text-slate-500">
              {userStanding.played}경기
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400">정규 승점</div>
            <div className="mt-0.5 font-display text-xl font-black text-emerald-300">
              {userStanding.points}
            </div>
            <div className="text-[9px] text-slate-500">PTS</div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400">득실차</div>
            <div
              className={`mt-0.5 font-display text-xl font-black ${
                gd > 0
                  ? 'text-sky-300'
                  : gd < 0
                    ? 'text-rose-300'
                    : 'text-slate-200'
              }`}
            >
              {gdLabel}
            </div>
            <div className="text-[9px] text-slate-500">
              {userStanding.goalsFor}득 {userStanding.goalsAgainst}실
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          {canEnterUcl && onEnterUcl && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEnterUcl();
              }}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-sky-400 px-5 py-3 text-xs font-extrabold text-slate-950 hover:bg-sky-300 transition-colors cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              챔피언스리그(UCL) 바로 진입 →
            </button>
          )}
          <button
            id="close-league-finale-banner-btn"
            type="button"
            onClick={onClose}
            className={`inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-xs font-extrabold transition-colors cursor-pointer ${
              isChampion
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : canEnterUcl
                  ? 'border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:text-white'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            시즌 결과 및 상세 결산 보기
          </button>
        </div>
      </div>
    </div>
  );
}

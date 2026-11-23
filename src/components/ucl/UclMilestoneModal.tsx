import { Award, Crown, Sparkles, Star, Trophy, X } from 'lucide-react';
import { useMemo } from 'react';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { ManagerAvatarConfig, UserClubProfile } from '../../types/game';
import type { Club, LeagueId, PlayerSeasonStats } from '../../types/league';
import type { UclKnockoutTie, UclTournamentState } from '../../types/ucl';
import { JerseySvg } from '../common/JerseySvg';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import {
  getDomesticCupTrophyVariant,
  getLeagueTrophyVariant,
  PixelTrophySvg,
} from '../common/PixelTrophySvg';

export type UclMilestoneStage = 'r16' | 'qf' | 'sf' | 'final' | 'champion';

interface UclMilestoneModalProps {
  milestone: UclMilestoneStage;
  ucl: UclTournamentState;
  leagueId: LeagueId;
  userClub: UserClubProfile;
  managerName: string;
  managerAvatar: ManagerAvatarConfig;
  clubsById: Record<string, Club>;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  isTreble: boolean;
  onClose: () => void;
  onGoToSummary?: () => void;
}

const STAGE_META: Record<
  Exclude<UclMilestoneStage, 'champion'>,
  {
    badge: string;
    title: string;
    line: string;
    prevTieStage: 'playoff' | 'r16' | 'qf' | 'sf';
  }
> = {
  r16: {
    badge: 'ROUND OF 16',
    title: '챔피언스리그 16강 진출',
    line: '유럽 최강 16개 구단의 토너먼트 무대가 시작됩니다.',
    prevTieStage: 'playoff',
  },
  qf: {
    badge: 'QUARTER-FINALS',
    title: '챔피언스리그 8강 진출',
    line: '이제 빅이어까지 단 세 관문 남았습니다.',
    prevTieStage: 'r16',
  },
  sf: {
    badge: 'SEMI-FINALS',
    title: '챔피언스리그 4강 진출',
    line: '결승으로 향하는 마지막 두 경기가 기다립니다.',
    prevTieStage: 'qf',
  },
  final: {
    badge: 'THE FINAL',
    title: '챔피언스리그 결승 진출',
    line: '유럽 정상까지 단 한 경기, 결승 무대로 향합니다.',
    prevTieStage: 'sf',
  },
};

const CONFETTI_SPECS = [
  { left: '8%', delay: '0s', duration: '3.2s', color: '#fbbf24', size: 6 },
  { left: '16%', delay: '0.4s', duration: '2.9s', color: '#38bdf8', size: 5 },
  { left: '25%', delay: '0.9s', duration: '3.5s', color: '#fde68a', size: 7 },
  { left: '34%', delay: '0.2s', duration: '3.1s', color: '#34d399', size: 5 },
  { left: '44%', delay: '0.7s', duration: '3.4s', color: '#fbbf24', size: 6 },
  { left: '56%', delay: '0.3s', duration: '3.0s', color: '#7dd3fc', size: 6 },
  { left: '66%', delay: '0.8s', duration: '3.3s', color: '#fde047', size: 7 },
  { left: '75%', delay: '0.1s', duration: '2.8s', color: '#34d399', size: 5 },
  { left: '84%', delay: '0.6s', duration: '3.4s', color: '#fbbf24', size: 6 },
  { left: '92%', delay: '0.5s', duration: '3.1s', color: '#e2e8f0', size: 5 },
];

function findUserTie(
  ties: UclKnockoutTie[],
): UclKnockoutTie | null {
  return (
    ties.find(
      (t) => t.teamAId === USER_CLUB_ID || t.teamBId === USER_CLUB_ID,
    ) ?? null
  );
}

function formatTieSummary(
  tie: UclKnockoutTie,
  clubsById: Record<string, Club>,
  userShortName: string,
): { oppName: string; scoreText: string } {
  const isUserA = tie.teamAId === USER_CLUB_ID;
  const oppId = isUserA ? tie.teamBId : tie.teamAId;
  const oppClub = clubsById[oppId];
  const oppName = oppClub?.name ?? oppId;

  if (tie.stage === 'final' && tie.leg1) {
    const m = tie.leg1;
    const isHome = m.homeTeamId === USER_CLUB_ID;
    const ug = isHome ? m.homeGoals : m.awayGoals;
    const og = isHome ? m.awayGoals : m.homeGoals;
    const pen = m.extraTime?.penalties;
    if (pen) {
      const up = isHome ? pen.homePenGoals : pen.awayPenGoals;
      const op = isHome ? pen.awayPenGoals : pen.homePenGoals;
      return {
        oppName,
        scoreText: `${userShortName} ${ug} : ${og} ${oppClub?.shortName ?? oppName} (PK ${up}-${op})`,
      };
    }
    if (m.extraTime) {
      return {
        oppName,
        scoreText: `${userShortName} ${ug} : ${og} ${oppClub?.shortName ?? oppName} (연장 승)`,
      };
    }
    return {
      oppName,
      scoreText: `${userShortName} ${ug} : ${og} ${oppClub?.shortName ?? oppName}`,
    };
  }

  const uAgg = isUserA ? tie.aggTeamA : tie.aggTeamB;
  const oAgg = isUserA ? tie.aggTeamB : tie.aggTeamA;
  const deciderPen = tie.leg2?.extraTime?.penalties;
  if (deciderPen && tie.leg2) {
    const isHomeLeg2 = tie.leg2.homeTeamId === USER_CLUB_ID;
    const up = isHomeLeg2 ? deciderPen.homePenGoals : deciderPen.awayPenGoals;
    const op = isHomeLeg2 ? deciderPen.awayPenGoals : deciderPen.homePenGoals;
    return {
      oppName,
      scoreText: `합산 ${uAgg} : ${oAgg} (PK ${up}-${op})`,
    };
  }
  return {
    oppName,
    scoreText: `합산 ${uAgg} : ${oAgg}`,
  };
}

export function UclMilestoneModal({
  milestone,
  ucl,
  leagueId,
  userClub,
  managerName,
  managerAvatar,
  clubsById,
  uclPlayerStats,
  isTreble,
  onClose,
  onGoToSummary,
}: UclMilestoneModalProps) {
  useBodyScrollLock(true);
  const mvpPlayer = useMemo(() => {
    const mine = Object.values(uclPlayerStats).filter(
      (s) => s.isUserTeam && s.appearances > 0,
    );
    if (mine.length === 0) return null;
    return [...mine].sort((a, b) => {
      const scoreA = a.goals * 4 + a.assists * 3 + a.avgRating * 3.5 + a.momCount * 2;
      const scoreB = b.goals * 4 + b.assists * 3 + b.avgRating * 3.5 + b.momCount * 2;
      return scoreB - scoreA;
    })[0];
  }, [uclPlayerStats]);

  if (milestone === 'champion') {
    const finalTie = findUserTie(ucl.ties.final);
    const finalRecap = finalTie
      ? formatTieSummary(finalTie, clubsById, userClub.shortName)
      : null;
    const leagueTrophy = getLeagueTrophyVariant(leagueId);
    const cupTrophy = getDomesticCupTrophyVariant(leagueId);

    return (
      <div
        id="ucl-champion-celebration-modal"
        className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-3 sm:p-4"
      >
        <div
          className={`modal-panel modal-scroll relative w-full max-w-xl overflow-y-auto overflow-x-hidden rounded-3xl border p-5 sm:p-8 text-center shadow-2xl ${
            isTreble
              ? 'border-amber-400/60 bg-gradient-to-b from-[#1e1a10] via-[#121622] to-[#0a0f18]'
              : 'border-sky-400/45 bg-gradient-to-b from-[#111c30] via-[#0e1523] to-[#090e17]'
          }`}
        >
          {/* Floating Starlight / Confetti Particles */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {CONFETTI_SPECS.map((c, idx) => (
              <span
                key={`conf-${idx}`}
                className="ucl-confetti-piece absolute -top-3 rounded-xs opacity-75"
                style={{
                  left: c.left,
                  width: `${c.size}px`,
                  height: `${c.size * 1.4}px`,
                  backgroundColor: c.color,
                  animationDelay: c.delay,
                  animationDuration: c.duration,
                }}
              />
            ))}
          </div>

          {/* Radial Glow */}
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
            style={{ backgroundColor: isTreble ? '#f59e0b' : '#38bdf8' }}
          />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white cursor-pointer"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative space-y-5">
            {/* Top Honors Pill */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-[11px] font-bold tracking-wider text-sky-200">
                <Star className="h-3.5 w-3.5 fill-current text-amber-300" />
                UEFA CHAMPIONS LEAGUE WINNERS
              </span>
              {isTreble && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-500/20 px-3 py-1 text-[11px] font-black tracking-wider text-amber-200">
                  <Crown className="h-3.5 w-3.5 text-amber-300" />
                  TREBLE ACHIEVED · 트레블 달성
                </span>
              )}
            </div>

            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                {isTreble
                  ? `${userClub.name}, 역사적 트레블 완성!`
                  : `${userClub.name}, 유럽 정상 정복!`}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-300">
                {isTreble
                  ? '리그 · 자국 컵 · 챔피언스리그 3관왕을 모두 들어올렸습니다.'
                  : '빅이어 트로피를 들어올리며 유럽 최강 구단에 등극했습니다.'}
              </p>
            </div>

            {/* Grand Trophy Showcase */}
            {isTreble ? (
              <div className="flex items-end justify-center gap-3 sm:gap-5 pt-1">
                <div className="flex flex-col items-center">
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-500/8 p-3">
                    <PixelTrophySvg variant={leagueTrophy} size={64} animate />
                  </div>
                  <span className="mt-1.5 text-[10px] font-bold text-slate-400">
                    LEAGUE
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="rounded-3xl border border-amber-400/50 bg-gradient-to-b from-amber-500/18 to-sky-500/10 px-6 py-4 shadow-xl shadow-amber-950/50">
                    <PixelTrophySvg variant="ucl" size={116} animate />
                  </div>
                  <span className="mt-1.5 text-[11px] font-black text-amber-300">
                    BIG EARS
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-500/8 p-3">
                    <PixelTrophySvg variant={cupTrophy} size={64} animate />
                  </div>
                  <span className="mt-1.5 text-[10px] font-bold text-slate-400">
                    CUP
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-end justify-center gap-4 sm:gap-6 pt-1">
                <div className="flex flex-col items-center">
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-2.5">
                    <PixelManagerAvatar
                      avatar={managerAvatar}
                      clubPrimaryColor={userClub.primaryColor}
                      clubSecondaryColor={userClub.secondaryColor}
                      size={66}
                    />
                  </div>
                  <span className="mt-1.5 text-[11px] font-bold text-slate-300">
                    {managerName} 감독
                  </span>
                </div>

                <div className="rounded-3xl border border-sky-400/40 bg-gradient-to-b from-sky-500/16 to-amber-500/10 px-6 py-4 shadow-xl shadow-sky-950/50">
                  <PixelTrophySvg variant="ucl" size={120} animate />
                </div>

                <div className="flex flex-col items-center">
                  <div className="flex h-[94px] w-[84px] items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/75 p-2.5">
                    <JerseySvg
                      primaryColor={userClub.primaryColor}
                      secondaryColor={userClub.secondaryColor}
                      pattern={userClub.pattern}
                      label={userClub.shortName}
                      size={58}
                    />
                  </div>
                  <span className="mt-1.5 max-w-[92px] truncate text-[11px] font-bold text-sky-200">
                    {userClub.name}
                  </span>
                </div>
              </div>
            )}

            {/* Final Score & Tournament MVP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {finalRecap && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    결승전 결과 · vs {finalRecap.oppName}
                  </div>
                  <div className="mt-1 font-display text-lg font-bold text-amber-300 tabular-nums">
                    {finalRecap.scoreText}
                  </div>
                </div>
              )}

              {mvpPlayer && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    <Award className="h-3.5 w-3.5" />
                    대회 MVP
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-extrabold text-white">
                      {mvpPlayer.playerName}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-300 tabular-nums shrink-0">
                      {mvpPlayer.goals}골 {mvpPlayer.assists}도움 · ★
                      {mvpPlayer.avgRating.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action CTA */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              {onGoToSummary && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToSummary();
                  }}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black shadow-lg cursor-pointer transition-colors ${
                    isTreble
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      : 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  시즌 최종 결산 · 명예의 전당 확인 →
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                대회 기록 보기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Round Advancement Popup (R16 / QF / SF / Final)
  const meta = STAGE_META[milestone];
  const prevTie = findUserTie(ucl.ties[meta.prevTieStage]);
  const prevRecap = prevTie
    ? formatTieSummary(prevTie, clubsById, userClub.shortName)
    : null;
  const directR16FromLeaguePhase =
    milestone === 'r16' && !ucl.enteredViaPlayoff && !prevTie;

  return (
    <div
      id={`ucl-advance-modal-${milestone}`}
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
    >
      <div className="modal-panel modal-scroll relative w-full max-w-md overflow-y-auto overflow-x-hidden rounded-2xl border border-sky-400/40 bg-gradient-to-b from-[#111c2f] via-[#0e1522] to-[#0b1019] p-6 text-center shadow-2xl">
        <div
          className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: milestone === 'final' ? '#f59e0b' : '#38bdf8' }}
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-500/12 px-3 py-1 text-[10px] font-bold tracking-widest text-sky-300">
            <Star className="h-3 w-3 fill-current text-amber-300" />
            UCL · {meta.badge}
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/80">
              <JerseySvg
                primaryColor={userClub.primaryColor}
                secondaryColor={userClub.secondaryColor}
                pattern={userClub.pattern}
                label={userClub.shortName}
                size={42}
              />
            </div>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white">
              {meta.title}
            </h3>
          </div>

          {directR16FromLeaguePhase ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5 text-xs font-bold text-emerald-300 tabular-nums">
              스위스 리그 페이즈 {ucl.userLeaguePhaseRank ?? '-'}위 · 16강 직행 확정
            </div>
          ) : prevRecap ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5 space-y-0.5">
              <div className="text-[10px] font-semibold text-slate-400">
                vs {prevRecap.oppName}
              </div>
              <div className="font-display text-base font-bold text-amber-300 tabular-nums">
                {prevRecap.scoreText}
              </div>
            </div>
          ) : null}

          <p className="text-xs text-slate-300">{meta.line}</p>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-500/20 border border-sky-400/45 px-4 py-2.5 text-xs font-extrabold text-sky-100 hover:bg-sky-500/30 cursor-pointer transition-colors"
          >
            <Trophy className="h-3.5 w-3.5 text-amber-300" />
            다음 라운드 준비 →
          </button>
        </div>
      </div>
    </div>
  );
}

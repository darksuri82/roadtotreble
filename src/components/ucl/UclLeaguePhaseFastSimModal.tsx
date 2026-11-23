import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  FastForward,
  Minus,
  Pause,
  Play,
  SkipForward,
  Trophy,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { getUserRank } from '../../engine/standingsEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useGame } from '../../store/GameContext';
import type { Club, MatchResult } from '../../types/league';

type FastSimSpeed = 'fast' | 'ultra';

const FAST_SIM_INTERVAL_MS: Record<FastSimSpeed, number> = {
  fast: 380,
  ultra: 190,
};

interface UclLeaguePhaseFastSimModalProps {
  open: boolean;
  clubsById: Record<string, Club>;
  onSelectMatch?: (match: MatchResult) => void;
  onFinishAndOpenStandings: () => void;
  onClose: () => void;
}

export function UclLeaguePhaseFastSimModal({
  open,
  clubsById,
  onSelectMatch,
  onFinishAndOpenStandings,
  onClose,
}: UclLeaguePhaseFastSimModalProps) {
  if (!open) return null;
  return (
    <UclLeaguePhaseFastSimModalInner
      clubsById={clubsById}
      onSelectMatch={onSelectMatch}
      onFinishAndOpenStandings={onFinishAndOpenStandings}
      onClose={onClose}
    />
  );
}

function UclLeaguePhaseFastSimModalInner({
  clubsById,
  onSelectMatch,
  onFinishAndOpenStandings,
  onClose,
}: {
  clubsById: Record<string, Club>;
  onSelectMatch?: (match: MatchResult) => void;
  onFinishAndOpenStandings: () => void;
  onClose: () => void;
}) {
  useBodyScrollLock(true);
  const { state, simulateSingleMatchInstant, simulateUclLeaguePhaseToEnd } =
    useGame();

  const season = state.season;
  const ucl = season?.ucl ?? null;

  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<FastSimSpeed>('fast');

  // Snapshot initial round and rank when fast-sim modal opens
  const [sessionSnap] = useState(() => {
    if (!ucl) {
      return { startRound: 0, startRank: 1, startHistoryLen: 0 };
    }
    const startRank = getUserRank(ucl.standings, USER_CLUB_ID);
    return {
      startRound: ucl.leaguePhaseRound,
      startRank,
      startHistoryLen: season?.userUclMatchHistory.length ?? 0,
    };
  });

  const currentRound = ucl?.leaguePhaseRound ?? 8;
  const currentRank = ucl
    ? (ucl.userLeaguePhaseRank ?? getUserRank(ucl.standings, USER_CLUB_ID))
    : 1;

  const hasPendingInjury = Boolean(
    season?.pendingInjuryAlerts && season.pendingInjuryAlerts.length > 0,
  );

  const isTargetReached =
    !ucl || ucl.stage !== 'league_phase' || ucl.leaguePhaseRound >= 8;

  // Step 1 round at a time with smooth animation interval, auto-pausing if an injury alert pops up
  useEffect(() => {
    if (!ucl || paused || isTargetReached || hasPendingInjury) {
      return;
    }

    const timer = window.setTimeout(() => {
      simulateSingleMatchInstant();
    }, FAST_SIM_INTERVAL_MS[speed]);

    return () => window.clearTimeout(timer);
  }, [
    ucl,
    ucl?.leaguePhaseRound,
    paused,
    speed,
    isTargetReached,
    hasPendingInjury,
    simulateSingleMatchInstant,
  ]);

  if (!season || !ucl) return null;

  const { startRound, startRank, startHistoryLen } = sessionSnap;
  const rankDelta = startRank - currentRank;
  const totalSteps = Math.max(1, 8 - startRound);
  const doneSteps = Math.max(0, Math.min(8, currentRound) - startRound);
  const progressPct = isTargetReached
    ? 100
    : Math.min(100, Math.round((doneSteps / totalSteps) * 100));

  const sessionMatches = season.userUclMatchHistory
    .slice(startHistoryLen)
    .filter((m) => m.round <= 8)
    .reverse();

  let runWins = 0;
  let runDraws = 0;
  let runLosses = 0;
  for (const m of sessionMatches) {
    const isHome = m.homeTeamId === USER_CLUB_ID;
    const ug = isHome ? m.homeGoals : m.awayGoals;
    const og = isHome ? m.awayGoals : m.homeGoals;
    if (ug > og) runWins += 1;
    else if (ug === og) runDraws += 1;
    else runLosses += 1;
  }

  const userRow = ucl.standings.find((r) => r.teamId === USER_CLUB_ID);
  const topStandings = ucl.standings.slice(0, 8);
  const userInTop8 = topStandings.some((r) => r.teamId === USER_CLUB_ID);

  const zoneLabel =
    currentRank <= 8
      ? { text: '16강 직행권', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35' }
      : currentRank <= 24
        ? { text: '플레이오프권', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/35' }
        : { text: '탈락권', cls: 'text-rose-300 bg-rose-500/15 border-rose-500/35' };

  const handleInstantComplete = () => {
    simulateUclLeaguePhaseToEnd();
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-3 sm:p-5">
      <div className="modal-panel flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f1621] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0a0f17] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-black ${
                isTargetReached
                  ? 'bg-emerald-500 text-slate-950'
                  : paused
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-sky-500 text-slate-950'
              }`}
            >
              <FastForward className="w-3 h-3" />
              {isTargetReached
                ? '8R 완료'
                : paused
                  ? '일시정지'
                  : '고속 진행 중'}
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-white">
              UCL 스위스 리그 페이즈(8R) 고속 진행
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!isTargetReached && (
              <>
                <div className="flex items-center rounded-lg border border-slate-800 bg-[#111822] p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSpeed('fast')}
                    className={`rounded-md border px-2.5 py-1 font-bold cursor-pointer transition-colors ${
                      speed === 'fast'
                        ? 'bg-slate-800 text-white border-sky-400/50'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    빠르게
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeed('ultra')}
                    className={`rounded-md border px-2.5 py-1 font-bold cursor-pointer transition-colors ${
                      speed === 'ultra'
                        ? 'bg-slate-800 text-white border-sky-400/50'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    매우 빠르게
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-400/60 hover:text-amber-200 cursor-pointer"
                >
                  {paused ? (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      재개
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      일시정지
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleInstantComplete}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/25 cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  즉시 완료
                </button>
              </>
            )}

            {isTargetReached && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onFinishAndOpenStandings}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  36팀 최종 순위표 확인 →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Progress Bar + Live Rank Strip */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-white">
                  LEAGUE PHASE {Math.min(8, currentRound)} / 8R
                </span>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-extrabold ${zoneLabel.cls}`}
                >
                  {zoneLabel.text}
                </span>
              </div>
              <span className="font-display text-sm font-bold text-sky-400">
                {progressPct}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full rounded-full bg-sky-400 transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1 tabular-nums">
              <div className="rounded-lg bg-[#111822] px-3 py-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500">현재 순위 (36팀)</div>
                  <div className="font-display text-xl font-bold text-white">
                    {currentRank}위
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-bold ${
                    rankDelta > 0
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : rankDelta < 0
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {rankDelta > 0 ? (
                    <>
                      <ArrowUpRight className="w-3.5 h-3.5" />+{rankDelta}
                    </>
                  ) : rankDelta < 0 ? (
                    <>
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      {rankDelta}
                    </>
                  ) : (
                    <>
                      <Minus className="w-3 h-3" />0
                    </>
                  )}
                </span>
              </div>

              <div className="rounded-lg bg-[#111822] px-3 py-2">
                <div className="text-[10px] text-slate-500">승점 / 득실</div>
                <div className="font-display text-xl font-bold text-sky-300">
                  {userRow?.points ?? 0}점{' '}
                  <span className="text-xs text-slate-400">
                    ({(userRow?.goalDifference ?? 0) >= 0 ? '+' : ''}
                    {userRow?.goalDifference ?? 0})
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-[#111822] px-3 py-2">
                <div className="text-[10px] text-slate-500">구간 전적</div>
                <div className="font-display text-xl font-bold text-white">
                  <span className="text-emerald-300">{runWins}승</span>{' '}
                  <span className="text-slate-300">{runDraws}무</span>{' '}
                  <span className="text-rose-300">{runLosses}패</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Live Feed & Live Top 8 Standings */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {/* Match Results Feed */}
            <div className="md:col-span-7 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                  라운드별 경기 결과
                </span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {sessionMatches.length}경기 완료
                </span>
              </div>

              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {sessionMatches.length === 0 ? (
                  <p className="py-10 text-center text-xs text-slate-500">
                    시뮬레이션 준비 중...
                  </p>
                ) : (
                  sessionMatches.map((m, idx) => {
                    const isHome = m.homeTeamId === USER_CLUB_ID;
                    const opp =
                      clubsById[isHome ? m.awayTeamId : m.homeTeamId];
                    const ug = isHome ? m.homeGoals : m.awayGoals;
                    const og = isHome ? m.awayGoals : m.homeGoals;
                    const resTag = ug > og ? 'W' : ug < og ? 'L' : 'D';
                    const resCls =
                      resTag === 'W'
                        ? 'bg-emerald-500 text-slate-950'
                        : resTag === 'L'
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-600 text-white';

                    return (
                      <div
                        key={m.fixtureId}
                        onClick={() => onSelectMatch?.(m)}
                        className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs tabular-nums transition-all ${
                          onSelectMatch ? 'cursor-pointer hover:border-sky-400/45' : ''
                        } ${
                          idx === 0
                            ? 'border border-sky-500/40 bg-sky-500/10'
                            : 'bg-[#111822]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-7 shrink-0 font-display text-[11px] font-bold text-slate-500">
                            {m.round}R
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black ${resCls}`}
                          >
                            {resTag}
                          </span>
                          <span className="truncate font-semibold text-slate-200">
                            {isHome ? 'vs' : '@'} {opp?.name ?? '상대'}
                          </span>
                        </div>
                        <span className="font-display text-sm font-bold text-white shrink-0">
                          {ug} - {og}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Live Top 8 Direct R16 Standings + User Row */}
            <div className="md:col-span-5 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  실시간 16강 직행권 (TOP 8)
                </span>
                <button
                  type="button"
                  onClick={onFinishAndOpenStandings}
                  className="text-[11px] font-bold text-sky-400 hover:underline cursor-pointer"
                >
                  36팀 전체 팝업 →
                </button>
              </div>

              <div className="space-y-1 text-xs tabular-nums">
                {topStandings.map((row, idx) => (
                  <div
                    key={row.teamId}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                      row.isUser
                        ? 'border border-emerald-500/45 bg-emerald-500/15 font-bold text-emerald-200'
                        : 'bg-[#111822] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 text-center font-display font-bold text-emerald-400">
                        {idx + 1}
                      </span>
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: row.primaryColor }}
                      />
                      <span className="truncate">{row.teamName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400">
                        {row.goalDifference >= 0 ? '+' : ''}
                        {row.goalDifference}
                      </span>
                      <span className="font-display text-sm font-bold text-white">
                        {row.points}
                      </span>
                    </div>
                  </div>
                ))}

                {!userInTop8 && userRow && (
                  <>
                    <div className="py-0.5 text-center text-[10px] text-slate-600">
                      ···
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-2.5 py-2 font-bold text-emerald-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 text-center font-display font-bold text-emerald-300">
                          {currentRank}
                        </span>
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: userRow.primaryColor }}
                        />
                        <span className="truncate">{userRow.teamName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-emerald-200/80">
                          {userRow.goalDifference >= 0 ? '+' : ''}
                          {userRow.goalDifference}
                        </span>
                        <span className="font-display text-sm font-bold text-white">
                          {userRow.points}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer when complete */}
        {isTargetReached && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-800 bg-[#0a0f17] px-5 py-3">
            <span className="text-xs font-bold text-slate-300">
              스위스 리그 페이즈 8라운드가 모두 종료되었습니다.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                닫기
              </button>
              <button
                id="ucl-fastsim-open-standings-btn"
                type="button"
                onClick={onFinishAndOpenStandings}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
                36팀 최종 순위표 팝업 보기 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

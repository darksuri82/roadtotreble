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
import { useEffect, useMemo, useState } from 'react';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { getUserRank } from '../../engine/standingsEngine';
import { getNextTransferWindowRound } from '../../engine/transferEngine';
import { useGame } from '../../store/GameContext';
import type { Club } from '../../types/league';

export type FastSimMode = 'to_transfer' | 'to_season_end';

interface FastSimModalProps {
  mode: FastSimMode | null;
  clubsById: Record<string, Club>;
  onClose: () => void;
}

type FastSimSpeed = 'fast' | 'ultra';

const FAST_SIM_INTERVAL_MS: Record<FastSimSpeed, number> = {
  fast: 340,
  ultra: 180,
};

export function FastSimModal({ mode, clubsById, onClose }: FastSimModalProps) {
  if (!mode) return null;
  return (
    <FastSimModalInner
      key={mode}
      mode={mode}
      clubsById={clubsById}
      onClose={onClose}
    />
  );
}

function FastSimModalInner({
  mode,
  clubsById,
  onClose,
}: {
  mode: FastSimMode;
  clubsById: Record<string, Club>;
  onClose: () => void;
}) {
  const {
    state,
    simulateOneFastRound,
    simulateToNextTransfer,
    skipToSeasonEnd,
  } = useGame();

  const season = state.season;

  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<FastSimSpeed>('fast');

  // Snapshot initial round/rank once on modal open
  const [sessionSnap] = useState(() => {
    if (!season) {
      return { startRound: 0, startRank: 1, targetRound: 38 };
    }
    const startRank = getUserRank(season.standings, USER_CLUB_ID);
    const nextTransfer = getNextTransferWindowRound(
      season.currentRound,
      season.transferWindows,
      season.transferMarket.completedWindows,
    );
    return {
      startRound: season.currentRound,
      startRank,
      targetRound:
        mode === 'to_transfer' && nextTransfer !== null
          ? nextTransfer
          : season.totalRounds,
    };
  });

  const currentRank = season
    ? getUserRank(season.standings, USER_CLUB_ID)
    : 1;

  const isTargetReached = useMemo(() => {
    if (!season) return true;
    if (state.phase === 'season_end') return true;
    if (season.currentRound >= season.totalRounds) return true;
    if (mode === 'to_transfer' && season.transferMarket.isOpen) return true;
    return false;
  }, [mode, season, state.phase]);

  // Step 1 round at a time with smooth animation interval
  useEffect(() => {
    if (!season || paused || isTargetReached) return;

    const timer = window.setTimeout(() => {
      simulateOneFastRound(mode === 'to_transfer');
    }, FAST_SIM_INTERVAL_MS[speed]);

    return () => window.clearTimeout(timer);
  }, [
    mode,
    season,
    season?.currentRound,
    paused,
    speed,
    isTargetReached,
    simulateOneFastRound,
  ]);

  if (!season) return null;

  const { startRound, startRank, targetRound } = sessionSnap;
  const rankDelta = startRank - currentRank; // positive => climbed up
  const totalSteps = Math.max(1, targetRound - startRound);
  const doneSteps = Math.max(0, season.currentRound - startRound);
  const progressPct = Math.min(100, Math.round((doneSteps / totalSteps) * 100));

  const sessionMatches = season.userMatchHistory
    .filter((m) => m.round > startRound)
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

  const userRow = season.standings.find((r) => r.teamId === USER_CLUB_ID);

  // Show Top 6 + User row (if outside top 6)
  const topStandings = season.standings.slice(0, 6);
  const userInTop6 = topStandings.some((r) => r.teamId === USER_CLUB_ID);

  const handleInstantComplete = () => {
    if (mode === 'to_transfer') {
      simulateToNextTransfer();
    } else {
      skipToSeasonEnd();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-3 sm:p-5 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f1621] shadow-2xl">
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
                ? '도달 완료'
                : paused
                  ? '일시정지'
                  : '고속 진행 중'}
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-white">
              {mode === 'to_transfer'
                ? `이적시장(${targetRound}R)까지 고속 진행`
                : `시즌 종료(${season.totalRounds}R)까지 고속 진행`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!isTargetReached && (
              <>
                <div className="flex items-center rounded-lg border border-slate-800 bg-[#111822] p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSpeed('fast')}
                    className={`rounded-md px-2.5 py-1 font-bold cursor-pointer ${
                      speed === 'fast'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    빠르게
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeed('ultra')}
                    className={`rounded-md px-2.5 py-1 font-bold cursor-pointer ${
                      speed === 'ultra'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
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
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  즉시 완료
                </button>
              </>
            )}

            {isTargetReached && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {season.transferMarket.isOpen
                  ? '이적시장 입장 →'
                  : '확인 및 계속 →'}
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {/* Progress Bar + Live Rank Strip */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-white">
                  ROUND {season.currentRound} / {season.totalRounds}
                </span>
                <span className="text-slate-500">
                  (목표: {targetRound}R · {doneSteps}/{totalSteps}경기)
                </span>
              </div>
              <span className="font-display text-sm font-bold text-emerald-400">
                {progressPct}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1 tabular-nums">
              <div className="rounded-lg bg-[#111822] px-3 py-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500">현재 순위</div>
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
                <div className="font-display text-xl font-bold text-emerald-300">
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

          {/* 2-Column Live Feed & Live Top Standings */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {/* Match Results Feed */}
            <div className="md:col-span-7 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  라운드별 경기 결과
                </span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {sessionMatches.length}경기 완료
                </span>
              </div>

              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
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
                        className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs tabular-nums transition-all ${
                          idx === 0
                            ? 'border border-emerald-500/40 bg-emerald-500/10'
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

            {/* Live Top Standings */}
            <div className="md:col-span-5 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                실시간 상위권 순위표
              </div>

              <div className="space-y-1 text-xs tabular-nums">
                {topStandings.map((row, idx) => (
                  <div
                    key={row.teamId}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-2 ${
                      row.isUser
                        ? 'border border-emerald-500/45 bg-emerald-500/15 font-bold text-emerald-200'
                        : 'bg-[#111822] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-4 text-center font-display font-bold ${
                          idx < 4 ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
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

                {!userInTop6 && userRow && (
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
      </div>
    </div>
  );
}

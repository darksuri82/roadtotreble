import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  Crown,
  Globe,
  Lock,
  RefreshCw,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import { HIDDEN_ACHIEVEMENTS } from '../../data/achievements';
import { FORMATIONS } from '../../data/formations';
import {
  buildUnifiedLeaderboard,
  ERA_BEST_XI_DREAM_TEAMS,
  HISTORICAL_BENCHMARK_TEAMS,
} from '../../data/historicalTeams';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import {
  formatFfpScorePenaltyLabel,
  resolveFfpPenaltyTier,
} from '../../engine/budgetEngine';
import { calculateChemistry } from '../../engine/chemistryEngine';
import {
  getAchievementProgress,
  HOF_AUTO_INDUCTION_MIN_SCORE,
  HOF_RESET_NOTICE_TEXT,
  isHofEntryFullFiveLeagueEligible,
  reconstructHallOfFameSquad,
} from '../../engine/legacyEngine';
import { TACTICS } from '../../engine/tacticEngine';
import {
  resolveGlobalEntryTeamStory,
  resolveHofTeamStory,
} from '../../engine/teamStoryEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  fetchWeeklyDailyRankings,
  formatKstDateTabLabel,
  formatKstDisplayDate,
  GLOBAL_DAILY_TOP_LIMIT,
  GLOBAL_PAST_DAY_ARCHIVE_LIMIT,
  GLOBAL_WEEKLY_TOP_LIMIT,
  groupWeeklyDailyRankings,
  isHofEntryFromTodayKst,
  reconstructSquadFromGlobalRanking,
  validateDailyRankingEligibility,
  type WeeklyDailyRankingsBoard,
} from '../../services/globalRankingService';
import { type LegacyModalTab, useGame } from '../../store/GameContext';
import type {
  GlobalHofRankingEntry,
  HallOfFameEntry,
  HistoricalTeamEntry,
} from '../../types/legacy';
import type { Player } from '../../types/player';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { InfoHelpButton } from '../common/InfoHelpButton';
import { JerseySvg } from '../common/JerseySvg';
import { PitchBoard } from '../common/PitchBoard';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { PixelTrophySvg } from '../common/PixelTrophySvg';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { TeamIntroBanner, TeamStoryTab } from '../common/TeamStoryTab';

type HofFilterTab = 'all' | 'user' | 'historical' | 'era_xi';
type HofSortBy = 'score' | 'date';
type HofDetailSubTab = 'squad' | 'story' | 'history';
type GlobalDetailSubTab = 'squad' | 'story';
type HofHistoryFilter = 'all' | 'league' | 'cup' | 'ucl';

function formatShortDate(iso: string): string {
  const kst = formatKstDisplayDate(iso);
  if (kst) return kst;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function getMedalBadgeClass(rank: number): string {
  if (rank === 1) {
    return 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-slate-950 shadow-sm shadow-amber-500/30';
  }
  if (rank === 2) {
    return 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-950';
  }
  if (rank === 3) {
    return 'bg-gradient-to-br from-amber-600 via-orange-400 to-amber-700 text-slate-950';
  }
  return 'bg-slate-800 text-slate-200 border border-slate-700';
}

export function LegacyHubModal() {
  const { legacyModalOpen, legacyModalInitialTab } = useGame();
  if (!legacyModalOpen) return null;
  return (
    <LegacyHubModalContent
      key={legacyModalInitialTab}
      initialTab={legacyModalInitialTab}
    />
  );
}

function LegacyHubModalContent({
  initialTab,
}: {
  initialTab: LegacyModalTab;
}) {
  const {
    state,
    legacyState,
    setLegacyModalOpen,
    removeHallOfFameEntry,
    openDreamMatch,
    openDreamMatchWithGlobalOpponent,
    submitHallOfFameEntryToGlobal,
    globalRankingsVersion,
  } = useGame();
  useBodyScrollLock(true);

  const [tab, setTab] = useState<LegacyModalTab>(initialTab);
  const [hofFilter, setHofFilter] = useState<HofFilterTab>('all');
  const [sortBy, setSortBy] = useState<HofSortBy>('score');
  const [selectedEntry, setSelectedEntry] = useState<HallOfFameEntry | null>(
    null,
  );
  const [selectedHistorical, setSelectedHistorical] =
    useState<HistoricalTeamEntry | null>(null);
  const [selectedGlobal, setSelectedGlobal] =
    useState<GlobalHofRankingEntry | null>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<HofDetailSubTab>('squad');
  const [globalDetailSubTab, setGlobalDetailSubTab] =
    useState<GlobalDetailSubTab>('squad');
  const [historyFilter, setHistoryFilter] = useState<HofHistoryFilter>('all');
  const [achFilter, setAchFilter] = useState<'all' | 'unlocked' | 'locked'>(
    'all',
  );

  // Weekly KST Daily Rankings state (Today TOP 10 / Past Days TOP 3 / Weekly Monday 00:00 KST Reset)
  const [weeklyBoard, setWeeklyBoard] = useState<WeeklyDailyRankingsBoard>(() =>
    groupWeeklyDailyRankings([]),
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    () => groupWeeklyDailyRankings([]).todayKey,
  );
  const [globalLoading, setGlobalLoading] = useState<boolean>(
    isSupabaseConfigured,
  );
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [challengeNotice, setChallengeNotice] = useState<string | null>(null);
  const [submittingRunId, setSubmittingRunId] = useState<string | null>(null);
  const [manualSubmitMsgByRunId, setManualSubmitMsgByRunId] = useState<
    Record<string, { ok: boolean; text: string }>
  >({});

  const loadGlobalRankings = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setGlobalLoading(false);
      return;
    }
    setGlobalLoading(true);
    setGlobalError(null);
    const res = await fetchWeeklyDailyRankings();
    if (res.ok && res.weekly) {
      setWeeklyBoard(res.weekly);
      setSelectedDateKey((prev) =>
        prev === 'weekly' || res.weekly!.byDate[prev]
          ? prev
          : res.weekly!.todayKey,
      );
    } else {
      setGlobalError(res.error ?? '랭킹을 불러오지 못했습니다.');
    }
    setGlobalLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return;
    void fetchWeeklyDailyRankings().then((res) => {
      if (!active) return;
      if (res.ok && res.weekly) {
        setWeeklyBoard(res.weekly);
        setSelectedDateKey((prev) =>
          prev === 'weekly' || res.weekly!.byDate[prev]
            ? prev
            : res.weekly!.todayKey,
        );
        setGlobalError(null);
      } else {
        setGlobalError(res.error ?? '랭킹을 불러오지 못했습니다.');
      }
      setGlobalLoading(false);
    });
    return () => {
      active = false;
    };
  }, [globalRankingsVersion]);

  const isWeeklyView = selectedDateKey === 'weekly';
  const activeDailyBucket = isWeeklyView
    ? null
    : (weeklyBoard.byDate[selectedDateKey] ??
      weeklyBoard.byDate[weeklyBoard.todayKey] ??
      weeklyBoard.buckets[0]);
  const globalEntries = isWeeklyView
    ? weeklyBoard.weeklyEntries
    : (activeDailyBucket?.entries ?? []);
  const globalCutoff = isWeeklyView
    ? weeklyBoard.weeklyCutoffScore
    : (activeDailyBucket?.cutoffScore ?? null);
  const activeDailyLimit = isWeeklyView
    ? GLOBAL_WEEKLY_TOP_LIMIT
    : (activeDailyBucket?.limit ?? GLOBAL_DAILY_TOP_LIMIT);

  const localRunIds = useMemo(
    () => new Set(legacyState.hallOfFame.map((e) => e.runId ?? e.id)),
    [legacyState.hallOfFame],
  );

  const globalRankByRunId = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of weeklyBoard.todayEntries) map.set(g.runId, g.rank);
    return map;
  }, [weeklyBoard.todayEntries]);

  const hasPlayableChallengerSquad = useMemo(() => {
    const hasHof = legacyState.hallOfFame.length > 0;
    const hasOngoing =
      state.starters.filter((p): p is Player => p !== null).length === 11;
    return hasHof || hasOngoing;
  }, [legacyState.hallOfFame.length, state.starters]);

  const handleChallengeGlobalTeam = useCallback(
    (entry: GlobalHofRankingEntry) => {
      if (!hasPlayableChallengerSquad) {
        setChallengeNotice(
          '먼저 시즌을 시작하거나 명전 스쿼드를 등록해 주세요.',
        );
        return;
      }
      setChallengeNotice(null);
      openDreamMatchWithGlobalOpponent(entry);
    },
    [hasPlayableChallengerSquad, openDreamMatchWithGlobalOpponent],
  );

  const handleManualGlobalSubmit = useCallback(
    async (entry: HallOfFameEntry) => {
      const runId = (entry.runId ?? entry.id).trim();
      setSubmittingRunId(runId);
      const res = await submitHallOfFameEntryToGlobal(entry, {
        triggerCelebration: false,
      });
      setSubmittingRunId(null);
      if (!res.ok) {
        setManualSubmitMsgByRunId((prev) => ({
          ...prev,
          [runId]: { ok: false, text: res.error ?? '등록 실패' },
        }));
        return;
      }
      if (res.entered && res.rank !== null) {
        setManualSubmitMsgByRunId((prev) => ({
          ...prev,
          [runId]: {
            ok: true,
            text: res.alreadyExists
              ? `이미 오늘 #${res.rank}위 등록됨`
              : `오늘의 랭킹 #${res.rank}위 등재 완료!`,
          },
        }));
        void loadGlobalRankings();
      } else {
        setManualSubmitMsgByRunId((prev) => ({
          ...prev,
          [runId]: {
            ok: false,
            text:
              res.cutoffScore !== null
                ? `오늘 ${GLOBAL_DAILY_TOP_LIMIT}위 컷(${res.cutoffScore.toLocaleString()}점) 미달`
                : `오늘 TOP ${GLOBAL_DAILY_TOP_LIMIT} 진입 기준 미달`,
          },
        }));
      }
    },
    [submitHallOfFameEntryToGlobal, loadGlobalRankings],
  );

  const progress = useMemo(
    () => getAchievementProgress(legacyState),
    [legacyState],
  );

  const unifiedLeaderboard = useMemo(
    () =>
      hofFilter === 'era_xi'
        ? []
        : buildUnifiedLeaderboard({
            userEntries: legacyState.hallOfFame,
            filter: hofFilter,
            sortBy,
          }),
    [legacyState.hallOfFame, hofFilter, sortBy],
  );

  const filteredAchievements = useMemo(() => {
    return HIDDEN_ACHIEVEMENTS.filter((def) => {
      const isUnlocked = Boolean(legacyState.unlockedAchievements[def.id]);
      if (achFilter === 'unlocked') return isUnlocked;
      if (achFilter === 'locked') return !isUnlocked;
      return true;
    });
  }, [legacyState.unlockedAchievements, achFilter]);

  const historicalPitchData = useMemo(() => {
    if (!selectedHistorical || selectedHistorical.starters.length === 0) {
      return null;
    }
    const chem = calculateChemistry(
      selectedHistorical.formation,
      selectedHistorical.starters,
      selectedHistorical.defaultTactic,
      selectedHistorical.managerTraitId,
      selectedHistorical.managerRating,
    );
    const effectiveStarterOvr =
      selectedHistorical.teamAvgOvr +
      selectedHistorical.avgSynergyOvrBonus +
      chem.chemistryOvrBonus;
    return {
      chem,
      effectiveStarterOvr: Math.round(effectiveStarterOvr * 10) / 10,
    };
  }, [selectedHistorical]);

  const userEntryPitchData = useMemo(() => {
    if (!selectedEntry) return null;
    const hasSquadData =
      (selectedEntry.fullStarters && selectedEntry.fullStarters.length > 0) ||
      (selectedEntry.starters && selectedEntry.starters.length > 0);
    if (!hasSquadData) return null;

    const reconstructed = reconstructHallOfFameSquad(selectedEntry);
    if (reconstructed.starters.length === 0) return null;

    const mgrRating = selectedEntry.managerRating ?? 88;
    const chem = calculateChemistry(
      selectedEntry.formation,
      reconstructed.starters,
      selectedEntry.defaultTactic,
      selectedEntry.managerTraitId,
      mgrRating,
    );
    const slotSyns = Object.values(chem.slotSynergies);
    const avgSynBonus =
      slotSyns.length > 0
        ? slotSyns.reduce((sum, s) => sum + s.totalBonus, 0) / slotSyns.length
        : 0;
    const effectiveStarterOvr =
      selectedEntry.teamAvgOvr + avgSynBonus + chem.chemistryOvrBonus;
    const statsById = new Map(
      [...selectedEntry.starters, ...selectedEntry.bench].map((m) => [m.id, m]),
    );
    return {
      starters: reconstructed.starters,
      bench: reconstructed.bench.filter((p): p is Player => p !== null),
      chem,
      avgSynBonus: Math.round(avgSynBonus * 10) / 10,
      effectiveStarterOvr: Math.round(effectiveStarterOvr * 10) / 10,
      statsById,
    };
  }, [selectedEntry]);

  const globalPitchData = useMemo(() => {
    if (!selectedGlobal) return null;
    const { starters, bench } = reconstructSquadFromGlobalRanking(selectedGlobal);
    if (starters.length === 0) return null;
    const chem = calculateChemistry(
      selectedGlobal.formation,
      starters,
      selectedGlobal.defaultTactic,
      selectedGlobal.managerTraitId,
      selectedGlobal.managerRating,
    );
    const slotSyns = Object.values(chem.slotSynergies);
    const avgSynBonus =
      slotSyns.length > 0
        ? slotSyns.reduce((sum, s) => sum + s.totalBonus, 0) / slotSyns.length
        : 0;
    const effectiveStarterOvr =
      selectedGlobal.teamAvgOvr + avgSynBonus + chem.chemistryOvrBonus;
    const statsById = new Map(
      [
        ...(selectedGlobal.squadSnapshot?.starters ?? []),
        ...(selectedGlobal.squadSnapshot?.bench ?? []),
      ].map((m) => [m.id, m]),
    );
    return {
      starters,
      bench,
      chem,
      avgSynBonus: Math.round(avgSynBonus * 10) / 10,
      effectiveStarterOvr: Math.round(effectiveStarterOvr * 10) / 10,
      statsById,
    };
  }, [selectedGlobal]);

  const isViewingDetail = Boolean(selectedEntry || selectedHistorical);

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-5">
      <div className="modal-panel flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0e141d] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 bg-[#0a0f17] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/35 text-amber-300">
              <Crown className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white truncate">
                  Road To Treble 명예의 전당
                </h2>
                <InfoHelpButton
                  title="명예의 전당 & 일일 랭킹 기준"
                  align="left"
                  guideTab="legacy"
                  items={[
                    `자동 등재: 시즌 스코어 ${HOF_AUTO_INDUCTION_MIN_SCORE.toLocaleString()}+ (역대 강팀급) · S+ 등급 · UCL 우승 · 트레블 달성 시`,
                    '수동 등재: 기준 미만 시즌도 시즌 결산 화면의 [수동 등록] 버튼으로 직접 등재 가능',
                    `일일·주간 랭킹(KST): 당일 TOP ${GLOBAL_DAILY_TOP_LIMIT} · 주간(월~일) TOP ${GLOBAL_WEEKLY_TOP_LIMIT} · 지난 날짜 TOP ${GLOBAL_PAST_DAY_ARCHIVE_LIMIT} 아카이브 · 매주 월요일 00:00 초기화`,
                    '랭킹 공정성: 5대 리그 드래프트 풀을 모두 선택하고 오늘(KST) 완료한 시즌만 일일 랭킹에 제출 가능 (지난 기록 · 일부 리그 풀은 개인 명전만 가능)',
                  ]}
                />
              </div>
              <p className="text-[11px] text-slate-400 tabular-nums truncate">
                내 기록 {legacyState.hallOfFame.length} · 역대 강팀{' '}
                {HISTORICAL_BENCHMARK_TEAMS.length} · 업적{' '}
                <span className="font-bold text-amber-300">
                  {progress.unlocked}/{progress.total}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex rounded-xl border border-slate-800 bg-slate-950/80 p-1 gap-1">
              <button
                type="button"
                onClick={() => {
                  setTab('hof');
                  setSelectedEntry(null);
                  setSelectedHistorical(null);
                  setSelectedGlobal(null);
                  setChallengeNotice(null);
                }}
                className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  tab === 'hof'
                    ? 'bg-slate-800 text-white border border-emerald-500/45 shadow-sm'
                    : 'text-slate-400 border border-transparent hover:text-white'
                }`}
              >
                🏛️ 명예의 전당
              </button>
              <button
                id="legacy-tab-global-top15"
                type="button"
                onClick={() => {
                  setTab('global_top15');
                  setSelectedEntry(null);
                  setSelectedHistorical(null);
                  setSelectedGlobal(null);
                  setChallengeNotice(null);
                }}
                className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  tab === 'global_top15'
                    ? 'bg-slate-800 text-white border border-sky-400/50 shadow-sm'
                    : 'text-slate-400 border border-transparent hover:text-white'
                }`}
              >
                🌍 일일·주간 랭킹
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('achievements');
                  setSelectedEntry(null);
                  setSelectedHistorical(null);
                  setSelectedGlobal(null);
                  setChallengeNotice(null);
                }}
                className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  tab === 'achievements'
                    ? 'bg-slate-800 text-white border border-amber-400/45 shadow-sm'
                    : 'text-slate-400 border border-transparent hover:text-white'
                }`}
              >
                🔒 업적 ({progress.unlocked}/{progress.total})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setLegacyModalOpen(false)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer shrink-0"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          {tab === 'hof' && !isViewingDetail && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-800/90 bg-[#0b1018] px-3 py-1.5 text-[11px] text-slate-400 break-keep">
                {HOF_RESET_NOTICE_TEXT}
              </div>
              {/* Filter Tabs: All (User + Historical) | User Only | Historical Benchmark */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-1">
                  {(
                    [
                      [
                        'all',
                        `전체 랭킹 (${legacyState.hallOfFame.length + HISTORICAL_BENCHMARK_TEAMS.length})`,
                      ],
                      ['user', `유저 기록만 (${legacyState.hallOfFame.length})`],
                      [
                        'historical',
                        `역대 실제 강팀 (${HISTORICAL_BENCHMARK_TEAMS.length})`,
                      ],
                      [
                        'era_xi',
                        `년도별 베스트 11 (${ERA_BEST_XI_DREAM_TEAMS.length})`,
                      ],
                    ] as [HofFilterTab, string][]
                  ).map(([fid, label]) => (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => {
                        setHofFilter(fid);
                        if (fid !== 'user') setSortBy('score');
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                        hofFilter === fid
                          ? fid === 'era_xi'
                            ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-sm'
                            : 'bg-slate-800 text-white border border-slate-600/80 shadow-sm'
                          : 'text-slate-400 border border-transparent hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {hofFilter === 'user' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSortBy('score')}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        sortBy === 'score'
                          ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                          : 'border-slate-700 bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      최고 스코어순
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortBy('date')}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        sortBy === 'date'
                          ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                          : 'border-slate-700 bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      최신 플레이순
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400">
                {hofFilter === 'era_xi'
                  ? `1960s ~ 2010s 시대를 대표하는 올스타 베스트 11 (${ERA_BEST_XI_DREAM_TEAMS.length}팀)입니다. 각 시대 스쿼드를 피치에서 확인하고 2D 드림 매치로 바로 도전할 수 있습니다.`
                  : `모든 유저 팀과 실제 축구 역사 속 최강 ${HISTORICAL_BENCHMARK_TEAMS.length}팀은 5대 리그·시대별 리그 난이도가 반영된 동일한 공정 시즌 스코어 공식으로 순위를 겨룹니다.`}
              </p>

              {hofFilter === 'era_xi' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {ERA_BEST_XI_DREAM_TEAMS.map((eraTeam) => {
                    const dreamRec = legacyState.dreamMatchRecords?.[eraTeam.id];
                    const trait = MANAGER_TRAITS[eraTeam.managerTraitId];
                    return (
                      <div
                        key={eraTeam.id}
                        className="group relative flex flex-col justify-between rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#0f1722] via-[#101620] to-[#0c1118] p-4 transition hover:border-cyan-400/65"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/35 bg-slate-900">
                              <JerseySvg
                                primaryColor={eraTeam.userClub.primaryColor}
                                secondaryColor={eraTeam.userClub.secondaryColor}
                                pattern={eraTeam.userClub.pattern}
                                label={eraTeam.userClub.shortName}
                                size={34}
                              />
                              <span className="absolute -top-2 -left-2 flex h-5 min-w-[26px] items-center justify-center rounded-full bg-cyan-400 px-1 text-[9px] font-black text-slate-950">
                                {eraTeam.seasonLabel}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-sm font-black text-white">
                                  {eraTeam.displayName}
                                </span>
                                {dreamRec && dreamRec.wins > 0 && (
                                  <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                                    ⚔️ {dreamRec.wins}승 {dreamRec.losses}패
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-[11px] font-semibold text-cyan-200/90 truncate">
                                {eraTeam.nickname}
                              </div>
                              <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                                {eraTeam.managerName} (명장 {eraTeam.managerRating} · {trait.name}) · {eraTeam.formation} · 평균 OVR{' '}
                                <strong className="text-white">{eraTeam.teamAvgOvr}</strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="mt-2.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400 break-keep">
                          {eraTeam.summaryNote}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
                          <span className="text-[10px] text-slate-400">
                            선발 {eraTeam.starters.length}명 + 벤치 {eraTeam.bench.length}명 · 케미{' '}
                            <strong className="text-emerald-300">{eraTeam.chemistry}</strong>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedHistorical(eraTeam)}
                              className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                            >
                              스쿼드 보기
                            </button>
                            <button
                              type="button"
                              onClick={() => openDreamMatch(eraTeam.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-2.5 py-1 text-[11px] font-extrabold text-cyan-200 hover:bg-cyan-500/30 cursor-pointer"
                            >
                              <Swords className="h-3 w-3" />
                              드림 매치
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : unifiedLeaderboard.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-10 text-center">
                  <Trophy className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-sm font-bold text-slate-300">
                    아직 명예의 전당에 등재된 유저 시즌이 없습니다.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    시즌을 완료하면 역대 최강 {HISTORICAL_BENCHMARK_TEAMS.length}팀과 함께 동일한 스코어보드에 등재됩니다!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {unifiedLeaderboard.map((row, idx) => {
                    const rankNum = idx + 1;

                    if (row.source === 'historical' && row.historicalEntry) {
                      const h = row.historicalEntry;
                      const dreamRec = legacyState.dreamMatchRecords?.[h.id];
                      return (
                        <div
                          key={h.id}
                          className="group relative flex flex-col justify-between rounded-2xl border border-amber-500/25 bg-gradient-to-br from-[#171612] via-[#11151d] to-[#0d1118] p-4 transition hover:border-amber-400/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-slate-900">
                                <JerseySvg
                                  primaryColor={h.userClub.primaryColor}
                                  secondaryColor={h.userClub.secondaryColor}
                                  pattern={h.userClub.pattern}
                                  label={h.userClub.shortName}
                                  size={34}
                                />
                                <span
                                  className={`absolute -top-2 -left-2 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black ${
                                    rankNum <= 3
                                      ? 'bg-amber-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-200 border border-slate-700'
                                  }`}
                                >
                                  {rankNum}
                                </span>
                              </div>

                              <div className="hidden sm:flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90">
                                <PixelManagerAvatar
                                  avatar={h.managerAvatar}
                                  clubPrimaryColor={h.userClub.primaryColor}
                                  clubSecondaryColor={h.userClub.secondaryColor}
                                  size={30}
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300 border border-amber-500/35">
                                    🏛️ 역대 강팀
                                  </span>
                                  <h3 className="text-sm font-black text-white truncate">
                                    {h.displayName}
                                  </h3>
                                  {h.isTreble && (
                                    <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                                      👑 트레블
                                    </span>
                                  )}
                                  {dreamRec && dreamRec.wins > 0 && (
                                    <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                                      ⚔️ 격파 {dreamRec.wins}승 {dreamRec.losses}패
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-300 truncate">
                                  {h.managerName} (명장 {h.managerRating} · {MANAGER_TRAITS[h.managerTraitId].name}) · {h.nickname}
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                                  OVR {h.teamAvgOvr} · 케미 {h.chemistry} · {h.leagueKoreanName} {h.leaguePoints}점 ({h.leagueRecord}) · UCL {h.uclResultLabel}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold text-amber-400">
                                {h.seasonScore.grade} 등급
                              </div>
                              <div className="font-mono text-lg font-black text-white">
                                {h.seasonScore.totalScore.toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
                            <div className="flex flex-wrap gap-1">
                              {h.trophies.slice(0, 3).map((tr) => (
                                <span
                                  key={tr}
                                  className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200/90"
                                >
                                  🏆 {tr}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setSelectedHistorical(h)}
                                className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                              >
                                스쿼드 보기
                              </button>
                              <button
                                type="button"
                                onClick={() => openDreamMatch(h.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-black text-slate-950 hover:bg-amber-300 cursor-pointer"
                              >
                                <Swords className="h-3 w-3" />
                                <span>도전하기</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const entry = row.userEntry!;
                    const trait = entry.managerTraitId
                      ? MANAGER_TRAITS[entry.managerTraitId]
                      : null;

                    return (
                      <div
                        key={entry.id}
                        className="group relative flex flex-col justify-between rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-[#0e1b18] via-[#0f1620] to-[#0c1118] p-4 transition hover:border-emerald-400/70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-slate-900">
                              <JerseySvg
                                primaryColor={entry.userClub.primaryColor}
                                secondaryColor={entry.userClub.secondaryColor}
                                pattern={entry.userClub.pattern}
                                size={34}
                              />
                              <span
                                className={`absolute -top-2 -left-2 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black ${
                                  rankNum <= 3
                                    ? 'bg-emerald-400 text-slate-950'
                                    : 'bg-slate-800 text-emerald-300 border border-emerald-500/40'
                                }`}
                              >
                                {rankNum}
                              </span>
                            </div>

                            {entry.managerAvatar && (
                              <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90">
                                <PixelManagerAvatar
                                  avatar={entry.managerAvatar}
                                  clubPrimaryColor={entry.userClub.primaryColor}
                                  clubSecondaryColor={entry.userClub.secondaryColor}
                                  size={30}
                                />
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-300 border border-emerald-500/40">
                                  👤 MY TEAM
                                </span>
                                <h3 className="text-sm font-black text-white truncate">
                                  {entry.userClub.name}
                                </h3>
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                                  {entry.leagueKoreanName} {entry.finalLeagueRank}위
                                </span>
                                {entry.isTreble && (
                                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                                    👑 트레블
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums border ${
                                    isHofEntryFromTodayKst(entry)
                                      ? 'border-sky-400/40 bg-sky-500/15 text-sky-200'
                                      : 'border-slate-700/80 bg-slate-900/90 text-slate-300'
                                  }`}
                                  title="기록 완료 날짜 (KST)"
                                >
                                  <Calendar className="h-2.5 w-2.5 shrink-0" />
                                  <span>{formatShortDate(entry.completedAt)}</span>
                                  {isHofEntryFromTodayKst(entry) && (
                                    <span className="text-[9px] font-black text-sky-300">오늘</span>
                                  )}
                                </span>
                                {!isHofEntryFullFiveLeagueEligible(entry) && (
                                  <span
                                    className="rounded border border-rose-500/40 bg-rose-500/12 px-1.5 py-0.5 text-[9px] font-bold text-rose-300"
                                    title="5대 리그 드래프트 풀 전체 미선택 시즌 — 개인 명전만 가능, 일일 랭킹 제출 불가"
                                  >
                                    일부 리그 풀
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-300 truncate">
                                {entry.managerName ? `${entry.managerName} 감독 · ` : ''}
                                {entry.leagueRecord} ({entry.leaguePoints}점) · {entry.cupName}{' '}
                                {entry.cupResultLabel} · UCL {entry.uclResultLabel}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                                OVR {entry.teamAvgOvr} · 케미 {entry.chemistry}
                                {trait ? ` · ${trait.name}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold text-emerald-400">
                              {entry.seasonScore.grade} 등급
                            </div>
                            <div className="font-mono text-lg font-black text-white">
                              {entry.seasonScore.totalScore.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {(entry.trophies.length > 0 || entry.ballonDorIsUser) && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {entry.trophies.map((tr) => (
                              <span
                                key={tr}
                                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300"
                              >
                                🏆 {tr}
                              </span>
                            ))}
                            {entry.ballonDorIsUser && entry.ballonDorWinnerName && (
                              <span className="rounded-md border border-yellow-400/40 bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold text-yellow-200">
                                ⚽ 발롱도르: {entry.ballonDorWinnerName}
                              </span>
                            )}
                          </div>
                        )}

                        {(() => {
                          const entryRunId = (entry.runId ?? entry.id).trim();
                          const globalRank = globalRankByRunId.get(entryRunId);
                          const submitMsg = manualSubmitMsgByRunId[entryRunId];
                          const isSubmitting = submittingRunId === entryRunId;
                          const dailyEligibility = validateDailyRankingEligibility(entry);
                          return (
                            <div className="mt-3 space-y-2 border-t border-slate-800/80 pt-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="truncate text-[11px] text-slate-400">
                                  에이스: <strong className="text-slate-200">{entry.topScorerSummary}</strong>
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isSupabaseConfigured && (
                                    globalRank ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTab('global_top15');
                                          setSelectedEntry(null);
                                          setSelectedHistorical(null);
                                          setSelectedGlobal(null);
                                        }}
                                        className="inline-flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-500/15 px-2 py-1 text-[11px] font-bold text-sky-300 hover:bg-sky-500/25 cursor-pointer"
                                      >
                                        <Globe className="h-3 w-3" />
                                        <span>오늘 #{globalRank}</span>
                                      </button>
                                    ) : dailyEligibility.eligible ? (
                                      <button
                                        type="button"
                                        disabled={isSubmitting}
                                        onClick={() => void handleManualGlobalSubmit(entry)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/12 px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/22 disabled:opacity-50 cursor-pointer"
                                        title={`오늘(KST) 완료한 기록을 오늘의 일일 랭킹 TOP ${GLOBAL_DAILY_TOP_LIMIT}에 제출합니다`}
                                      >
                                        <Upload className="h-3 w-3" />
                                        <span>{isSubmitting ? '제출 중...' : '일일 랭킹 도전'}</span>
                                      </button>
                                    ) : (
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold whitespace-nowrap ${
                                          dailyEligibility.code === 'partial_pool'
                                            ? 'border-rose-500/35 bg-rose-500/10 text-rose-300'
                                            : 'border-slate-700/80 bg-slate-900/70 text-slate-500'
                                        }`}
                                        title={dailyEligibility.reason}
                                      >
                                        <Lock className="h-2.5 w-2.5 shrink-0" />
                                        <span>
                                          {dailyEligibility.code === 'partial_pool'
                                            ? '5대리그 미포함'
                                            : '지난 기록 · 제출 불가'}
                                        </span>
                                      </span>
                                    )
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDetailSubTab('squad');
                                      setHistoryFilter('all');
                                      setSelectedEntry(entry);
                                    }}
                                    className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                                  >
                                    상세 보기
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeHallOfFameEntry(entry.id)}
                                    className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
                                    title="기록 삭제"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              {submitMsg && (
                                <div
                                  className={`text-[11px] font-semibold ${
                                    submitMsg.ok ? 'text-emerald-300' : 'text-slate-400'
                                  }`}
                                >
                                  {submitMsg.text}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* HISTORICAL TEAM BENCHMARK DETAIL VIEW */}
          {tab === 'hof' && selectedHistorical && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedHistorical(null)}
                  className="text-xs font-bold text-amber-300 hover:underline cursor-pointer"
                >
                  ← 명예의 전당 랭킹으로 돌아가기
                </button>
                <button
                  type="button"
                  onClick={() => openDreamMatch(selectedHistorical.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-300 cursor-pointer shadow-md"
                >
                  <Swords className="h-4 w-4" />
                  <span>이 팀에 도전하기 (드림 매치)</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/35 bg-slate-950/85 p-5">
                <div className="flex items-center gap-4">
                  <JerseySvg
                    primaryColor={selectedHistorical.userClub.primaryColor}
                    secondaryColor={selectedHistorical.userClub.secondaryColor}
                    pattern={selectedHistorical.userClub.pattern}
                    label={selectedHistorical.userClub.shortName}
                    size={56}
                  />
                  <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-slate-900">
                    <PixelManagerAvatar
                      avatar={selectedHistorical.managerAvatar}
                      clubPrimaryColor={selectedHistorical.userClub.primaryColor}
                      clubSecondaryColor={selectedHistorical.userClub.secondaryColor}
                      size={44}
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-500/35">
                        🏛️ 역대 실제 강팀
                      </span>
                      <h3 className="text-xl font-black text-white">
                        {selectedHistorical.displayName}
                      </h3>
                      <span className="rounded-lg bg-amber-400/20 px-2 py-0.5 text-xs font-black text-amber-300">
                        {selectedHistorical.seasonScore.grade} (
                        {selectedHistorical.seasonScore.totalScore.toLocaleString()}점)
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-amber-200">
                      {selectedHistorical.managerName} 감독 (명장 지휘력 {selectedHistorical.managerRating} ·{' '}
                      {MANAGER_TRAITS[selectedHistorical.managerTraitId].name}) ·{' '}
                      {selectedHistorical.nickname}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {selectedHistorical.leagueKoreanName} {selectedHistorical.leagueTotalRounds}R{' '}
                      {selectedHistorical.isLeagueChampion
                        ? `${selectedHistorical.leaguePoints}점 우승`
                        : `${selectedHistorical.finalLeagueRank}위 (${selectedHistorical.leaguePoints}점)`}{' '}
                      ({selectedHistorical.leagueRecord},{' '}
                      {selectedHistorical.goalsFor}득점 {selectedHistorical.goalsAgainst}실점) ·{' '}
                      {selectedHistorical.cupName} {selectedHistorical.cupResultLabel} · UCL{' '}
                      {selectedHistorical.uclResultLabel}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-300 font-semibold">
                      팀 평균 OVR {selectedHistorical.teamAvgOvr} · 실전 케미{' '}
                      {selectedHistorical.chemistry} · 감독 시너지{' '}
                      {selectedHistorical.managerSynergyCount}명 (+
                      {selectedHistorical.avgSynergyOvrBonus.toFixed(1)} OVR)
                    </p>
                    <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                      {selectedHistorical.summaryNote} {selectedHistorical.managerStyleNote}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trophies */}
              <div className="flex flex-wrap gap-2">
                {selectedHistorical.trophies.map((tr) => (
                  <span
                    key={tr}
                    className="rounded-lg border border-amber-400/35 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200"
                  >
                    🏆 {tr}
                  </span>
                ))}
                {selectedHistorical.ballonDorWinnerName && (
                  <span className="rounded-lg border border-yellow-400/40 bg-yellow-500/15 px-3 py-1 text-xs font-bold text-yellow-200">
                    ⚽ 발롱도르: {selectedHistorical.ballonDorWinnerName}
                  </span>
                )}
              </div>

              {/* Same Fair Season Score Breakdown (8 Columns including Squad Craft & Manager Synergy) */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
                {[
                  { label: '리그 환산(PPG×38)', val: selectedHistorical.seasonScore.leagueConvertedScore },
                  {
                    label:
                      typeof selectedHistorical.seasonScore.leagueDifficultyFactor === 'number'
                        ? `리그 순위 (×${selectedHistorical.seasonScore.leagueDifficultyFactor.toFixed(2)})`
                        : '리그 순위',
                    val: selectedHistorical.seasonScore.leagueRankBonus,
                    sub:
                      typeof selectedHistorical.seasonScore.leagueStrengthAvg === 'number'
                        ? `${selectedHistorical.seasonScore.leagueStrengthEraLabel ?? '당시 리그'} ${selectedHistorical.seasonScore.leagueStrengthAvg.toFixed(1)}`
                        : undefined,
                  },
                  { label: '자국 컵', val: selectedHistorical.seasonScore.cupBonus },
                  { label: '챔피언스리그', val: selectedHistorical.seasonScore.uclBonus },
                  { label: '대업·대기록', val: selectedHistorical.seasonScore.honorsBonus },
                  { label: '스쿼드·감독 시너지', val: selectedHistorical.seasonScore.squadCraftBonus ?? 0 },
                  { label: '언더독 보너스', val: selectedHistorical.seasonScore.underdogBonus },
                  { label: '개인 수상 보너스', val: selectedHistorical.seasonScore.awardsBonus ?? 0 },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-center"
                  >
                    <div className="text-[10px] text-slate-400">{item.label}</div>
                    <div className="mt-1 font-mono text-sm font-black text-amber-300">
                      +{item.val.toLocaleString()}
                    </div>
                    {item.sub && (
                      <div className="mt-0.5 text-[9px] text-slate-500 tabular-nums truncate">
                        {item.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Detailed Breakdown Chips */}
              <div className="space-y-1.5">
                {selectedHistorical.seasonScore.honorsBonusDetails &&
                  selectedHistorical.seasonScore.honorsBonusDetails.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2 text-[11px] text-amber-200">
                      <span className="font-bold text-amber-300">역사적 대업 가산점:</span>
                      {selectedHistorical.seasonScore.honorsBonusDetails.map((d) => (
                        <span
                          key={d}
                          className="rounded-md bg-slate-950/70 px-2 py-0.5 font-semibold"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                {selectedHistorical.seasonScore.squadCraftDetails &&
                  selectedHistorical.seasonScore.squadCraftDetails.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-[11px] text-emerald-200">
                      <span className="font-bold text-emerald-300">전력·케미·명장 시너지:</span>
                      {selectedHistorical.seasonScore.squadCraftDetails.map((d) => (
                        <span
                          key={d}
                          className="rounded-md bg-slate-950/70 px-2 py-0.5 font-semibold"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                {selectedHistorical.seasonScore.awardsBonusDetails &&
                  selectedHistorical.seasonScore.awardsBonusDetails.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3.5 py-2 text-[11px] text-sky-200">
                      <span className="font-bold text-sky-300">당시 개인 수상 가산점:</span>
                      {selectedHistorical.seasonScore.awardsBonusDetails.map((d) => (
                        <span
                          key={d}
                          className="rounded-md bg-slate-950/70 px-2 py-0.5 font-semibold"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
              </div>

              {/* Full Prime Squad: Formation PitchBoard + Manager / Effective OVR / Bench */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 sm:p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs font-extrabold text-white">
                      {selectedHistorical.formation} ·{' '}
                      {TACTICS[selectedHistorical.defaultTactic].name}
                    </h4>
                    {historicalPitchData && (
                      <span className="rounded-md border border-emerald-400/35 bg-emerald-500/12 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-300 tabular-nums">
                        실효 OVR {historicalPitchData.effectiveStarterOvr.toFixed(1)}
                      </span>
                    )}
                    <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-300 tabular-nums">
                      기본 {selectedHistorical.teamAvgOvr.toFixed(1)} · 시너지 +
                      {selectedHistorical.avgSynergyOvrBonus.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
                  {/* Left: Formation Pitch */}
                  <div className="lg:col-span-7 mx-auto w-full max-w-[490px]">
                    {historicalPitchData && (
                      <PitchBoard
                        formation={selectedHistorical.formation}
                        starters={selectedHistorical.starters}
                        bench={selectedHistorical.bench}
                        chemistry={historicalPitchData.chem}
                        managerTraitId={selectedHistorical.managerTraitId}
                        conditionByPlayerId={{}}
                        showBench={false}
                        showChemBreakdown={true}
                        compact={true}
                        onSlotClick={(area, idx) => {
                          const p =
                            area === 'starter'
                              ? selectedHistorical.starters[idx]
                              : selectedHistorical.bench[idx];
                          if (p) setInspectedPlayer(p);
                        }}
                        onInspectPlayer={(p) => setInspectedPlayer(p)}
                      />
                    )}
                  </div>

                  {/* Right: Manager Profile + Bench Squad */}
                  <div className="lg:col-span-5 space-y-3">
                    {/* Manager Card */}
                    <div className="rounded-xl border border-amber-400/30 bg-slate-900/75 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-400/35 bg-slate-950">
                          <PixelManagerAvatar
                            avatar={selectedHistorical.managerAvatar}
                            clubPrimaryColor={
                              selectedHistorical.userClub.primaryColor
                            }
                            clubSecondaryColor={
                              selectedHistorical.userClub.secondaryColor
                            }
                            size={34}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-black text-white">
                              {selectedHistorical.managerName}
                            </span>
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] font-black text-amber-300 tabular-nums shrink-0">
                              OVR {selectedHistorical.managerRating}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-bold text-emerald-300">
                              {MANAGER_TRAITS[selectedHistorical.managerTraitId]
                                ?.name}
                            </span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono font-bold text-sky-300 tabular-nums">
                              궁합 {selectedHistorical.managerSynergyCount}/11
                            </span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono font-bold text-slate-300 tabular-nums">
                              케미 {selectedHistorical.chemistry}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bench Squad */}
                    {selectedHistorical.bench.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          벤치 스쿼드 ({selectedHistorical.bench.length})
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                          {selectedHistorical.bench.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setInspectedPlayer(p)}
                              className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 px-2.5 py-1.5 text-left text-xs transition hover:border-amber-400/50 hover:bg-slate-800/75 cursor-pointer touch-manipulation"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-8 shrink-0 rounded bg-slate-800 py-0.5 text-center font-mono text-[10px] font-bold text-slate-400">
                                  {p.mainPositions[0]}
                                </span>
                                <CountryFlagSvg
                                  code={p.nationalityCode}
                                  nationality={p.nationality}
                                  size="sm"
                                />
                                <span className="truncate font-bold text-slate-200">
                                  {p.name}
                                </span>
                              </div>
                              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-black text-amber-300 tabular-nums shrink-0">
                                {p.ovr}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'hof' && selectedEntry && (
            <div className="space-y-4">
              {(() => {
                const entryRunId = (selectedEntry.runId ?? selectedEntry.id).trim();
                const globalRank = globalRankByRunId.get(entryRunId);
                const submitMsg = manualSubmitMsgByRunId[entryRunId];
                const isSubmitting = submittingRunId === entryRunId;
                const dailyEligibility = validateDailyRankingEligibility(selectedEntry);
                return (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEntry(null)}
                      className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                    >
                      ← 명예의 전당 목록으로 돌아가기
                    </button>
                    {isSupabaseConfigured && (
                      <div className="flex items-center gap-2">
                        {submitMsg && (
                          <span
                            className={`text-[11px] font-semibold ${
                              submitMsg.ok ? 'text-emerald-300' : 'text-slate-400'
                            }`}
                          >
                            {submitMsg.text}
                          </span>
                        )}
                        {globalRank ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTab('global_top15');
                              setSelectedEntry(null);
                              setSelectedHistorical(null);
                              setSelectedGlobal(null);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 px-3 py-1.5 text-xs font-black text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            <span>오늘의 랭킹 · #{globalRank}위</span>
                          </button>
                        ) : dailyEligibility.eligible ? (
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void handleManualGlobalSubmit(selectedEntry)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 px-3 py-1.5 text-xs font-black text-sky-200 hover:bg-sky-500/25 disabled:opacity-50 cursor-pointer"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>
                              {isSubmitting
                                ? '제출 중...'
                                : `오늘 TOP ${GLOBAL_DAILY_TOP_LIMIT} 도전/등록`}
                            </span>
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold ${
                              dailyEligibility.code === 'partial_pool'
                                ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                                : 'border-slate-700 bg-slate-900/80 text-slate-400'
                            }`}
                            title={dailyEligibility.reason}
                          >
                            <Lock className="h-3 w-3 shrink-0" />
                            <span>
                              {dailyEligibility.code === 'partial_pool'
                                ? '5대 리그 풀 미포함 · 일일 랭킹 제출 불가'
                                : '지난 날짜 기록 · 오늘 일일 랭킹 제출 불가'}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-950/80 p-5">
                <div className="flex items-center gap-4">
                  <JerseySvg
                    primaryColor={selectedEntry.userClub.primaryColor}
                    secondaryColor={selectedEntry.userClub.secondaryColor}
                    pattern={selectedEntry.userClub.pattern}
                    size={54}
                  />
                  {selectedEntry.managerAvatar && (
                    <div className="flex h-16 w-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
                      <PixelManagerAvatar
                        avatar={selectedEntry.managerAvatar}
                        clubPrimaryColor={selectedEntry.userClub.primaryColor}
                        clubSecondaryColor={selectedEntry.userClub.secondaryColor}
                        size={42}
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black text-white">
                        {selectedEntry.userClub.name}
                      </h3>
                      {selectedEntry.managerName && (
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-emerald-300">
                          {selectedEntry.managerName} 감독
                        </span>
                      )}
                      <span className="rounded-lg bg-amber-400/20 px-2 py-0.5 text-xs font-black text-amber-300">
                        {selectedEntry.seasonScore.grade} ({selectedEntry.seasonScore.totalScore.toLocaleString()}점)
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      {selectedEntry.leagueKoreanName} {selectedEntry.finalLeagueRank}위 ({selectedEntry.leagueRecord} · {selectedEntry.leaguePoints}점) · {selectedEntry.cupName} {selectedEntry.cupResultLabel} · UCL {selectedEntry.uclResultLabel}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatShortDate(selectedEntry.completedAt)}
                      </span>
                      <span>포메이션 {selectedEntry.formation}</span>
                      <span>전술 {TACTICS[selectedEntry.defaultTactic].name}</span>
                      <span>평균 OVR {selectedEntry.teamAvgOvr}</span>
                      <span>케미 {selectedEntry.chemistry}</span>
                    </p>
                  </div>
                </div>

                {selectedEntry.ballonDorWinnerName && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3.5 py-2">
                    <PixelTrophySvg variant="ballon_dor" size={32} />
                    <div className="text-xs">
                      <div className="text-[10px] font-bold text-amber-300">
                        시즌 발롱도르
                      </div>
                      <div className="font-bold text-white">
                        {selectedEntry.ballonDorWinnerName}
                        {selectedEntry.ballonDorIsUser && (
                          <span className="ml-1 rounded bg-emerald-400 px-1 text-[9px] font-black text-slate-950">
                            MY
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {selectedEntry.ballonDorWinnerClub}
                        {selectedEntry.worldBestXiUserCount !== undefined &&
                          ` · 월베 우리팀 ${selectedEntry.worldBestXiUserCount}명`}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Score Breakdown (including Squad Craft & Individual Awards Bonus) */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
                {[
                  { label: '리그 환산(PPG×38)', val: selectedEntry.seasonScore.leagueConvertedScore },
                  {
                    label:
                      typeof selectedEntry.seasonScore.leagueDifficultyFactor === 'number'
                        ? `리그 순위 (×${selectedEntry.seasonScore.leagueDifficultyFactor.toFixed(2)})`
                        : '리그 순위',
                    val: selectedEntry.seasonScore.leagueRankBonus,
                    sub:
                      typeof selectedEntry.seasonScore.leagueStrengthAvg === 'number'
                        ? `리그 평균 ${selectedEntry.seasonScore.leagueStrengthAvg.toFixed(1)}`
                        : undefined,
                  },
                  { label: '자국 컵', val: selectedEntry.seasonScore.cupBonus },
                  { label: '챔피언스리그', val: selectedEntry.seasonScore.uclBonus },
                  { label: '대업·대기록', val: selectedEntry.seasonScore.honorsBonus },
                  { label: '스쿼드·감독 시너지', val: selectedEntry.seasonScore.squadCraftBonus ?? 0 },
                  { label: '언더독 보너스', val: selectedEntry.seasonScore.underdogBonus },
                  { label: '개인 수상 보너스', val: selectedEntry.seasonScore.awardsBonus ?? 0 },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-center"
                  >
                    <div className="text-[10px] text-slate-400">{item.label}</div>
                    <div className="mt-1 font-mono text-sm font-black text-emerald-300">
                      +{item.val.toLocaleString()}
                    </div>
                    {item.sub && (
                      <div className="mt-0.5 text-[9px] text-slate-500 tabular-nums">
                        {item.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedEntry.seasonScore.ffpPenaltyPoints &&
                selectedEntry.seasonScore.ffpPenaltyPoints > 0 && (() => {
                  const tier = resolveFfpPenaltyTier(
                    selectedEntry.seasonScore.ffpPenaltyPct,
                    selectedEntry.seasonScore.ffpTier,
                  );
                  const isTier1 = tier === 1;
                  return (
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-[11px] tabular-nums ${
                        isTier1
                          ? 'border-amber-400/35 bg-amber-500/10 text-amber-200'
                          : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
                      }`}
                    >
                      <span className={`font-bold ${isTier1 ? 'text-amber-300' : 'text-rose-300'}`}>
                        {formatFfpScorePenaltyLabel(
                          selectedEntry.seasonScore.ffpPenaltyPct,
                          selectedEntry.seasonScore.ffpTier,
                        )}
                      </span>
                      <span className={`font-mono font-black ${isTier1 ? 'text-amber-300' : 'text-rose-300'}`}>
                        -{selectedEntry.seasonScore.ffpPenaltyPoints.toLocaleString()}점
                      </span>
                    </div>
                  );
                })()}

              {selectedEntry.seasonScore.honorsBonusDetails &&
                selectedEntry.seasonScore.honorsBonusDetails.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2 text-[11px] text-amber-200">
                    <span className="font-bold text-amber-300">대업·대기록 내역:</span>
                    {selectedEntry.seasonScore.honorsBonusDetails.map((d) => (
                      <span
                        key={d}
                        className="rounded-md bg-slate-950/70 px-2 py-0.5 font-semibold"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}

              {selectedEntry.seasonScore.squadCraftDetails &&
                selectedEntry.seasonScore.squadCraftDetails.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-[11px] text-emerald-200">
                    <span className="font-bold text-emerald-300">전력·케미·감독 시너지:</span>
                    {selectedEntry.seasonScore.squadCraftDetails.map((d) => (
                      <span
                        key={d}
                        className="rounded-md bg-slate-950/70 px-2 py-0.5 font-semibold"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}

              {selectedEntry.seasonScore.awardsBonusDetails &&
                selectedEntry.seasonScore.awardsBonusDetails.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3.5 py-2 text-[11px] text-sky-200">
                    <span className="font-bold text-sky-300">개인 수상 내역:</span>
                    {selectedEntry.seasonScore.awardsBonusDetails.map((d) => (
                      <span
                        key={d}
                        className="rounded-md bg-slate-950/70 px-2 py-0.5 font-semibold"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}

              {/* Compact 1~2 Line Team Intro */}
              <TeamIntroBanner
                intro={resolveHofTeamStory(selectedEntry).intro}
                compact
              />

              {/* Detail Sub-Tabs: Squad vs Team Story vs Full Match History */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setDetailSubTab('squad')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    detailSubTab === 'squad'
                      ? 'bg-slate-800 text-white border-emerald-500/50'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  최종 16인 스쿼드
                </button>
                <button
                  type="button"
                  onClick={() => setDetailSubTab('story')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    detailSubTab === 'story'
                      ? 'bg-slate-800 text-amber-200 border-amber-400/50'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  팀 스토리
                </button>
                <button
                  type="button"
                  onClick={() => setDetailSubTab('history')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    detailSubTab === 'history'
                      ? 'bg-slate-800 text-white border-emerald-500/50'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  전체 경기 히스토리 ({selectedEntry.matchHistory?.length ?? 0}경기)
                </button>
              </div>

              {detailSubTab === 'story' ? (
                <TeamStoryTab
                  story={resolveHofTeamStory(selectedEntry)}
                  clubName={selectedEntry.userClub.name}
                  showIntroBanner={false}
                />
              ) : detailSubTab === 'squad' ? (
                userEntryPitchData ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 sm:p-4 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs font-extrabold text-white">
                          {selectedEntry.formation} ·{' '}
                          {TACTICS[selectedEntry.defaultTactic].name}
                        </h4>
                        <span className="rounded-md border border-emerald-400/35 bg-emerald-500/12 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-300 tabular-nums">
                          실효 OVR{' '}
                          {userEntryPitchData.effectiveStarterOvr.toFixed(1)}
                        </span>
                        <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-300 tabular-nums">
                          기본 {selectedEntry.teamAvgOvr.toFixed(1)} · 시너지 +
                          {userEntryPitchData.avgSynBonus.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
                      {/* Left: Formation Pitch */}
                      <div className="lg:col-span-7 mx-auto w-full max-w-[490px]">
                        <PitchBoard
                          formation={selectedEntry.formation}
                          starters={userEntryPitchData.starters}
                          bench={userEntryPitchData.bench}
                          chemistry={userEntryPitchData.chem}
                          managerTraitId={selectedEntry.managerTraitId}
                          conditionByPlayerId={{}}
                          showBench={false}
                          showChemBreakdown={true}
                          compact={true}
                          onSlotClick={(area, idx) => {
                            const p =
                              area === 'starter'
                                ? userEntryPitchData.starters[idx]
                                : userEntryPitchData.bench[idx];
                            if (p) setInspectedPlayer(p);
                          }}
                          onInspectPlayer={(p) => setInspectedPlayer(p)}
                        />
                      </div>

                      {/* Right: Manager Profile + Bench Squad */}
                      <div className="lg:col-span-5 space-y-3">
                        <div className="rounded-xl border border-emerald-400/25 bg-slate-900/75 p-3">
                          <div className="flex items-center gap-3">
                            {selectedEntry.managerAvatar && (
                              <div className="flex h-12 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
                                <PixelManagerAvatar
                                  avatar={selectedEntry.managerAvatar}
                                  clubPrimaryColor={
                                    selectedEntry.userClub.primaryColor
                                  }
                                  clubSecondaryColor={
                                    selectedEntry.userClub.secondaryColor
                                  }
                                  size={34}
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-xs font-black text-white">
                                  {selectedEntry.managerName ?? '감독'}
                                </span>
                                {typeof selectedEntry.managerRating ===
                                  'number' && (
                                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] font-black text-amber-300 tabular-nums shrink-0">
                                    OVR {selectedEntry.managerRating}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                                {selectedEntry.managerTraitId && (
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-bold text-emerald-300">
                                    {
                                      MANAGER_TRAITS[
                                        selectedEntry.managerTraitId
                                      ]?.name
                                    }
                                  </span>
                                )}
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono font-bold text-slate-300 tabular-nums">
                                  케미 {userEntryPitchData.chem.total}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {userEntryPitchData.bench.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              벤치 스쿼드 ({userEntryPitchData.bench.length})
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                              {userEntryPitchData.bench.map((p) => {
                                const st = userEntryPitchData.statsById.get(
                                  p.id,
                                );
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setInspectedPlayer(p)}
                                    className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 px-2.5 py-1.5 text-left text-xs transition hover:border-emerald-400/50 hover:bg-slate-800/75 cursor-pointer touch-manipulation"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-8 shrink-0 rounded bg-slate-800 py-0.5 text-center font-mono text-[10px] font-bold text-slate-400">
                                        {p.mainPositions[0]}
                                      </span>
                                      <CountryFlagSvg
                                        code={p.nationalityCode}
                                        nationality={p.nationality}
                                        size="sm"
                                      />
                                      <span className="truncate font-bold text-slate-200">
                                        {p.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {st && (st.goals > 0 || st.assists > 0) && (
                                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                                          {st.goals}G {st.assists}A
                                        </span>
                                      )}
                                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-black text-amber-300 tabular-nums">
                                        {p.ovr}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-center text-xs text-slate-400">
                    구버전 명예의 전당 기록으로 스쿼드 포메이션 정보가 없습니다.
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-extrabold text-slate-300">
                      시즌 전체 경기 로그
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          ['all', '전체'],
                          ['league', '리그'],
                          ['cup', '자국 컵'],
                          ['ucl', '챔피언스리그'],
                        ] as [HofHistoryFilter, string][]
                      ).map(([fid, flabel]) => (
                        <button
                          key={fid}
                          type="button"
                          onClick={() => setHistoryFilter(fid)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                            historyFilter === fid
                              ? 'bg-slate-800 text-white border-sky-400/50'
                              : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                          }`}
                        >
                          {flabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!selectedEntry.matchHistory || selectedEntry.matchHistory.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      이전 버전에서 저장된 시즌으로 경기별 상세 로그가 없습니다.
                    </p>
                  ) : (
                    <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                      {selectedEntry.matchHistory
                        .filter(
                          (m) =>
                            historyFilter === 'all' ||
                            m.competition === historyFilter,
                        )
                        .map((m, idx) => (
                          <div
                            key={`${m.label}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  m.competition === 'ucl'
                                    ? 'bg-sky-500/20 text-sky-300'
                                    : m.competition === 'cup'
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {m.label}
                              </span>
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black ${
                                  m.outcome === 'W'
                                    ? 'bg-emerald-500 text-slate-950'
                                    : m.outcome === 'L'
                                      ? 'bg-rose-500 text-white'
                                      : 'bg-slate-600 text-white'
                                }`}
                              >
                                {m.outcome}
                              </span>
                              <span className="truncate font-semibold text-white">
                                {m.isHome ? 'vs' : '@'} {m.opponentName}
                              </span>
                              {m.scorers.length > 0 && (
                                <span className="hidden sm:inline truncate text-[11px] text-slate-400">
                                  ⚽ {m.scorers.join(', ')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 font-mono font-bold text-white shrink-0">
                              <span>
                                {m.userGoals} - {m.oppGoals}
                              </span>
                              {m.note && (
                                <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-200">
                                  {m.note}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'global_top15' && !selectedGlobal && (
            <div className="space-y-4">
              {/* Weekly + Daily KST Ranking Policy Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/90 bg-[#0b1018] px-3.5 py-2 text-[11px] text-slate-400 break-keep">
                <span>
                  <strong className="text-sky-300">KST 일일·주간 랭킹</strong> · 당일{' '}
                  <strong className="text-slate-200">
                    TOP {GLOBAL_DAILY_TOP_LIMIT}
                  </strong>{' '}
                  · 주간(월~일){' '}
                  <strong className="text-amber-300">
                    TOP {GLOBAL_WEEKLY_TOP_LIMIT}
                  </strong>{' '}
                  유지 · 지난 날짜{' '}
                  <strong className="text-slate-300">
                    TOP {GLOBAL_PAST_DAY_ARCHIVE_LIMIT}
                  </strong>{' '}
                  아카이브 · 매주 월요일 00:00 초기화
                </span>
                <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">
                  {weeklyBoard.weekStartKey.slice(5).replace('-', '.')} (월) ~{' '}
                  {weeklyBoard.weekEndKey.slice(5).replace('-', '.')} (일)
                </span>
              </div>

              {/* Weekly TOP 10 + Daily Date Tabs (Weekly TOP 10 | Today -> Earlier Days of This Week) */}
              <div
                role="tablist"
                aria-label="주간 및 이번 주 일일 랭킹 선택"
                className="flex items-center gap-1.5 overflow-x-auto pb-1"
              >
                <button
                  id="legacy-ranking-tab-weekly"
                  type="button"
                  role="tab"
                  aria-selected={isWeeklyView}
                  onClick={() => setSelectedDateKey('weekly')}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                    isWeeklyView
                      ? 'border-amber-400/70 bg-amber-500/20 text-amber-200 shadow-sm shadow-amber-500/15'
                      : 'border-amber-500/25 bg-[#12110b] text-amber-300/85 hover:border-amber-400/50 hover:text-amber-200'
                  }`}
                >
                  <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>주간 TOP {GLOBAL_WEEKLY_TOP_LIMIT}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-black tabular-nums ${
                      isWeeklyView
                        ? 'bg-amber-400/25 text-amber-100'
                        : 'bg-slate-900/90 text-amber-300/75'
                    }`}
                  >
                    {weeklyBoard.weeklyEntries.length}/{GLOBAL_WEEKLY_TOP_LIMIT}
                  </span>
                </button>

                <span
                  className="h-5 w-px shrink-0 bg-slate-800/90 mx-0.5"
                  aria-hidden="true"
                />

                {weeklyBoard.buckets.map((bucket) => {
                  const isActive =
                    !isWeeklyView &&
                    (activeDailyBucket?.dateKey ?? weeklyBoard.todayKey) ===
                      bucket.dateKey;
                  const count = bucket.entries.length;
                  return (
                    <button
                      key={bucket.dateKey}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setSelectedDateKey(bucket.dateKey)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                        isActive
                          ? bucket.isToday
                            ? 'border-sky-400/60 bg-sky-500/18 text-sky-200 shadow-sm shadow-sky-500/15'
                            : 'border-emerald-400/50 bg-emerald-500/14 text-emerald-200'
                          : 'border-slate-800 bg-[#0a0f17] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span>{bucket.label}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-black tabular-nums ${
                          isActive
                            ? bucket.isToday
                              ? 'bg-sky-400/20 text-sky-200'
                              : 'bg-emerald-400/20 text-emerald-200'
                            : 'bg-slate-900 text-slate-500'
                        }`}
                      >
                        {bucket.isToday
                          ? `${count}/${bucket.limit}`
                          : `TOP ${bucket.limit}${count > 0 ? ` · ${count}` : ''}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Top Bar: Active Board Status + Cutoff + Refresh */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-800 bg-[#090e15] px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-black whitespace-nowrap ${
                      isWeeklyView
                        ? 'border-amber-400/45 bg-amber-500/18 text-amber-200'
                        : activeDailyBucket?.isToday
                          ? 'border-sky-400/35 bg-sky-500/15 text-sky-300'
                          : 'border-emerald-400/35 bg-emerald-500/12 text-emerald-300'
                    }`}
                  >
                    {isWeeklyView ? (
                      <Trophy className="h-3.5 w-3.5 text-amber-300" />
                    ) : (
                      <Globe className="h-3.5 w-3.5" />
                    )}
                    {isWeeklyView
                      ? `이번 주 주간 랭킹 TOP ${GLOBAL_WEEKLY_TOP_LIMIT} (월~일)`
                      : activeDailyBucket?.isToday
                        ? `오늘의 일일 랭킹 TOP ${activeDailyLimit}`
                        : `${activeDailyBucket?.label ?? selectedDateKey} TOP ${activeDailyLimit} 아카이브`}
                  </span>
                  <span className="font-mono text-[11px] text-slate-300 tabular-nums">
                    {globalEntries.length} / {activeDailyLimit}
                  </span>
                  {(isWeeklyView || activeDailyBucket?.isToday) &&
                    globalEntries.length >= activeDailyLimit &&
                    globalCutoff !== null && (
                      <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-[11px] text-amber-300 tabular-nums">
                        {isWeeklyView ? '주간 ' : ''}
                        {activeDailyLimit}위 컷 {globalCutoff.toLocaleString()}{' '}
                        PTS
                      </span>
                    )}
                </div>
                {isSupabaseConfigured && (
                  <button
                    type="button"
                    disabled={globalLoading}
                    onClick={() => void loadGlobalRankings()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:border-sky-400/50 hover:text-white disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${globalLoading ? 'animate-spin' : ''}`}
                    />
                    <span>새로고침</span>
                  </button>
                )}
              </div>

              {/* Missing Challenger Squad Notice */}
              {challengeNotice && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/45 bg-amber-500/12 px-3.5 py-2.5 text-xs font-bold text-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
                    <span>{challengeNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChallengeNotice(null)}
                    className="rounded p-1 text-amber-300/80 hover:text-white cursor-pointer"
                    aria-label="안내 닫기"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {!isSupabaseConfigured ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-10 text-center space-y-2">
                  <Globe className="mx-auto h-9 w-9 text-slate-600" />
                  <p className="text-sm font-bold text-slate-300">
                    일일·주간 랭킹 서버가 연결되어 있지 않습니다.
                  </p>
                  <p className="text-xs text-slate-500">
                    로컬 명예의 전당과 싱글플레이는 정상적으로 이용할 수 있습니다.
                  </p>
                </div>
              ) : globalLoading && globalEntries.length === 0 ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 5 }, (_, idx) => (
                    <div
                      key={idx}
                      className="h-20 animate-pulse rounded-2xl border border-slate-800/80 bg-slate-900/60"
                    />
                  ))}
                </div>
              ) : globalError ? (
                <div className="rounded-2xl border border-rose-500/35 bg-rose-950/20 p-8 text-center space-y-3">
                  <p className="text-sm font-bold text-rose-200">
                    랭킹을 불러오지 못했습니다.
                  </p>
                  <p className="text-xs text-slate-400">{globalError}</p>
                  <button
                    type="button"
                    onClick={() => void loadGlobalRankings()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>다시 시도</span>
                  </button>
                </div>
              ) : globalEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-10 text-center space-y-2">
                  <Trophy className="mx-auto h-10 w-10 text-slate-600" />
                  <p className="text-sm font-bold text-slate-300">
                    {isWeeklyView
                      ? `이번 주 주간 랭킹 TOP ${GLOBAL_WEEKLY_TOP_LIMIT}에 아직 기록이 없습니다.`
                      : activeDailyBucket?.isToday
                        ? `오늘의 일일 랭킹 TOP ${activeDailyLimit}에 아직 기록이 없습니다.`
                        : `${activeDailyBucket?.label ?? selectedDateKey}에 보존된 TOP ${activeDailyLimit} 기록이 없습니다.`}
                  </p>
                  <p className="text-xs text-slate-500 break-keep">
                    {isWeeklyView
                      ? '월요일 00:00 ~ 일요일 23:59(KST) 동안 5대 리그 전체 풀 싱글플레이 시즌을 완료하면 주간 TOP 10에 도전할 수 있습니다.'
                      : activeDailyBucket?.isToday
                        ? '싱글플레이 시즌을 완주해 명예의 전당에 등록하면 오늘의 첫 번째 랭커가 될 수 있습니다.'
                        : '매주 월요일 00:00(KST) 주간 초기화 이후 일별 상위 3팀(주간 TOP 10 포함)이 이 날짜에 아카이브됩니다.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {globalEntries.map((entry) => {
                    const isMine = localRunIds.has(entry.runId);
                    const dreamRec =
                      legacyState.dreamMatchRecords?.[`global:${entry.runId}`];
                    const trait = entry.managerTraitId
                      ? MANAGER_TRAITS[entry.managerTraitId]
                      : null;
                    const rankBorderClass =
                      entry.rank === 1
                        ? 'border-amber-400/50 bg-gradient-to-r from-[#1a160c] via-[#111622] to-[#0d121a]'
                        : entry.rank === 2
                          ? 'border-slate-400/40 bg-gradient-to-r from-[#161a22] via-[#101621] to-[#0d121a]'
                          : entry.rank === 3
                            ? 'border-amber-600/45 bg-gradient-to-r from-[#19130e] via-[#101621] to-[#0d121a]'
                            : isMine
                              ? 'border-emerald-500/40 bg-gradient-to-r from-[#0e1b18] via-[#0f1620] to-[#0c1118]'
                              : 'border-slate-800/90 bg-[#0d131c] hover:border-slate-700';

                    return (
                      <div
                        key={entry.id}
                        className={`rounded-2xl border p-3.5 sm:p-4 transition ${rankBorderClass}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          {/* Left: Rank + Jersey + Avatar + Team Meta */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setGlobalDetailSubTab('squad');
                              setSelectedGlobal(entry);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setGlobalDetailSubTab('squad');
                                setSelectedGlobal(entry);
                              }
                            }}
                            className="flex items-start sm:items-center gap-3 min-w-0 flex-1 cursor-pointer text-left"
                          >
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-black tabular-nums ${getMedalBadgeClass(entry.rank)}`}
                            >
                              {entry.rank <= 3
                                ? entry.rank === 1
                                  ? '🥇'
                                  : entry.rank === 2
                                    ? '🥈'
                                    : '🥉'
                                : `#${entry.rank}`}
                            </div>

                            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900">
                              <JerseySvg
                                primaryColor={entry.clubProfile.primaryColor}
                                secondaryColor={entry.clubProfile.secondaryColor}
                                pattern={entry.clubProfile.pattern}
                                label={entry.clubProfile.shortName}
                                size={32}
                              />
                              {entry.rank <= 3 && (
                                <span className="absolute -top-1.5 -left-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-950 border border-amber-400/60 px-1 font-mono text-[9px] font-black text-amber-300">
                                  {entry.rank}
                                </span>
                              )}
                            </div>

                            <div className="hidden sm:flex h-11 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90">
                              <PixelManagerAvatar
                                avatar={entry.managerAvatar}
                                clubPrimaryColor={entry.clubProfile.primaryColor}
                                clubSecondaryColor={
                                  entry.clubProfile.secondaryColor
                                }
                                size={28}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="text-sm font-black text-white truncate">
                                  {entry.clubProfile.name}
                                </h3>
                                <span className="text-[11px] font-semibold text-slate-300 truncate">
                                  {entry.managerName}
                                </span>
                                {isWeeklyView && entry.rankingDate && (
                                  <span className="rounded bg-sky-500/15 border border-sky-400/30 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-200 whitespace-nowrap">
                                    {formatKstDateTabLabel(
                                      entry.rankingDate,
                                      weeklyBoard.todayKey,
                                    )}
                                  </span>
                                )}
                                {isMine && (
                                  <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                                    MY
                                  </span>
                                )}
                                {entry.isTreble && (
                                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
                                    👑 트레블
                                  </span>
                                )}
                                {dreamRec && dreamRec.wins > 0 && (
                                  <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                                    ⚔️ {dreamRec.wins}승 {dreamRec.losses}패
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 font-bold text-slate-200">
                                  {entry.formation}
                                </span>
                                <span>{TACTICS[entry.defaultTactic].name}</span>
                                <span>· OVR {entry.teamAvgOvr}</span>
                                <span>· 케미 {entry.chemistry}</span>
                                {trait && <span>· {trait.name}</span>}
                                <span className="hidden md:inline">
                                  · {formatShortDate(entry.achievedAt)}
                                </span>
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                {entry.trophies.slice(0, 3).map((tr) => (
                                  <span
                                    key={tr}
                                    className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-200"
                                  >
                                    🏆 {tr}
                                  </span>
                                ))}
                                {entry.topScorerSummary &&
                                  entry.topScorerSummary !== '-' && (
                                    <span className="rounded bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 truncate max-w-[180px]">
                                      ⭐ {entry.topScorerSummary}
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Score + Actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-slate-800/70 pt-2.5 sm:border-t-0 sm:pt-0 shrink-0">
                            <div className="text-left sm:text-right">
                              <div className="flex items-center sm:justify-end gap-1.5">
                                <span className="text-[10px] font-black text-amber-400">
                                  {entry.grade}
                                </span>
                                <span className="sm:hidden text-[10px] text-slate-500">
                                  {formatShortDate(entry.achievedAt)}
                                </span>
                              </div>
                              <div className="font-mono text-lg font-black text-white tabular-nums leading-tight">
                                {entry.seasonScore.toLocaleString()}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setGlobalDetailSubTab('squad');
                                  setSelectedGlobal(entry);
                                }}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-slate-500 hover:text-white cursor-pointer whitespace-nowrap"
                              >
                                스쿼드
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChallengeGlobalTeam(entry)}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1.5 text-xs font-black text-slate-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
                              >
                                <Swords className="h-3.5 w-3.5" />
                                <span>1대1 대결</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* DAILY RANKING TEAM DETAIL VIEW */}
          {tab === 'global_top15' && selectedGlobal && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGlobal(null);
                    setGlobalDetailSubTab('squad');
                    setChallengeNotice(null);
                  }}
                  className="text-xs font-bold text-sky-300 hover:underline cursor-pointer"
                >
                  ← 일일 랭킹으로 돌아가기
                </button>
                <button
                  type="button"
                  onClick={() => handleChallengeGlobalTeam(selectedGlobal)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-300 cursor-pointer shadow-md"
                >
                  <Swords className="h-4 w-4" />
                  <span>이 팀과 1대1 대결</span>
                </button>
              </div>

              {challengeNotice && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/45 bg-amber-500/12 px-3.5 py-2.5 text-xs font-bold text-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
                    <span>{challengeNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChallengeNotice(null)}
                    className="rounded p-1 text-amber-300/80 hover:text-white cursor-pointer"
                    aria-label="안내 닫기"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Hero Card */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-400/35 bg-slate-950/85 p-4 sm:p-5">
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-lg font-black tabular-nums ${getMedalBadgeClass(selectedGlobal.rank)}`}
                  >
                    #{selectedGlobal.rank}
                  </div>
                  <JerseySvg
                    primaryColor={selectedGlobal.clubProfile.primaryColor}
                    secondaryColor={selectedGlobal.clubProfile.secondaryColor}
                    pattern={selectedGlobal.clubProfile.pattern}
                    label={selectedGlobal.clubProfile.shortName}
                    size={50}
                  />
                  <div className="hidden sm:flex h-15 w-13 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
                    <PixelManagerAvatar
                      avatar={selectedGlobal.managerAvatar}
                      clubPrimaryColor={selectedGlobal.clubProfile.primaryColor}
                      clubSecondaryColor={
                        selectedGlobal.clubProfile.secondaryColor
                      }
                      size={40}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-black text-white truncate">
                        {selectedGlobal.clubProfile.name}
                      </h3>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-sky-300">
                        {selectedGlobal.managerName} 감독
                      </span>
                      <span className="rounded-lg bg-amber-400/20 px-2 py-0.5 text-xs font-black text-amber-300 tabular-nums">
                        {selectedGlobal.grade} (
                        {selectedGlobal.seasonScore.toLocaleString()}점)
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      {selectedGlobal.leagueKoreanName}{' '}
                      {selectedGlobal.finalLeagueRank}위 (
                      {selectedGlobal.leagueRecord} ·{' '}
                      {selectedGlobal.leaguePoints}점) ·{' '}
                      {selectedGlobal.cupName} {selectedGlobal.cupResultLabel} ·
                      UCL {selectedGlobal.uclResultLabel}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {selectedGlobal.rankingDate ??
                          formatShortDate(selectedGlobal.achievedAt)}
                      </span>
                      <span>포메이션 {selectedGlobal.formation}</span>
                      <span>
                        전술 {TACTICS[selectedGlobal.defaultTactic].name}
                      </span>
                      <span>평균 OVR {selectedGlobal.teamAvgOvr}</span>
                      <span>케미 {selectedGlobal.chemistry}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Trophies */}
              {(selectedGlobal.isTreble || selectedGlobal.trophies.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {selectedGlobal.isTreble && (
                    <span className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-black text-slate-950">
                      👑 트레블 달성
                    </span>
                  )}
                  {selectedGlobal.trophies.map((tr) => (
                    <span
                      key={tr}
                      className="rounded-lg border border-amber-400/35 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200"
                    >
                      🏆 {tr}
                    </span>
                  ))}
                </div>
              )}

              {/* 8-Column Score Breakdown */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {[
                  {
                    label: '리그 환산(PPG×38)',
                    val: selectedGlobal.scoreBreakdown.leagueConvertedScore,
                  },
                  {
                    label:
                      typeof selectedGlobal.scoreBreakdown.leagueDifficultyFactor === 'number'
                        ? `리그 순위 (×${selectedGlobal.scoreBreakdown.leagueDifficultyFactor.toFixed(2)})`
                        : '리그 순위',
                    val: selectedGlobal.scoreBreakdown.leagueRankBonus,
                    sub:
                      typeof selectedGlobal.scoreBreakdown.leagueStrengthAvg === 'number'
                        ? `리그 평균 ${selectedGlobal.scoreBreakdown.leagueStrengthAvg.toFixed(1)}`
                        : undefined,
                  },
                  {
                    label: '자국 컵',
                    val: selectedGlobal.scoreBreakdown.cupBonus,
                  },
                  {
                    label: '챔피언스리그',
                    val: selectedGlobal.scoreBreakdown.uclBonus,
                  },
                  {
                    label: '대업·대기록',
                    val: selectedGlobal.scoreBreakdown.honorsBonus,
                  },
                  {
                    label: '스쿼드·감독 시너지',
                    val: selectedGlobal.scoreBreakdown.squadCraftBonus ?? 0,
                  },
                  {
                    label: '언더독 보너스',
                    val: selectedGlobal.scoreBreakdown.underdogBonus,
                  },
                  {
                    label: '개인 수상 보너스',
                    val: selectedGlobal.scoreBreakdown.awardsBonus ?? 0,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-center"
                  >
                    <div className="text-[10px] text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-1 font-mono text-sm font-black text-sky-300 tabular-nums">
                      +{item.val.toLocaleString()}
                    </div>
                    {item.sub && (
                      <div className="mt-0.5 text-[9px] text-slate-500 tabular-nums">
                        {item.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedGlobal.scoreBreakdown.ffpPenaltyPoints &&
                selectedGlobal.scoreBreakdown.ffpPenaltyPoints > 0 && (() => {
                  const tier = resolveFfpPenaltyTier(
                    selectedGlobal.scoreBreakdown.ffpPenaltyPct,
                    selectedGlobal.scoreBreakdown.ffpTier,
                  );
                  const isTier1 = tier === 1;
                  return (
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-[11px] tabular-nums ${
                        isTier1
                          ? 'border-amber-400/35 bg-amber-500/10 text-amber-200'
                          : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
                      }`}
                    >
                      <span className={`font-bold ${isTier1 ? 'text-amber-300' : 'text-rose-300'}`}>
                        {formatFfpScorePenaltyLabel(
                          selectedGlobal.scoreBreakdown.ffpPenaltyPct,
                          selectedGlobal.scoreBreakdown.ffpTier,
                        )}
                      </span>
                      <span className={`font-mono font-black ${isTier1 ? 'text-amber-300' : 'text-rose-300'}`}>
                        -{selectedGlobal.scoreBreakdown.ffpPenaltyPoints.toLocaleString()}점
                      </span>
                    </div>
                  );
                })()}

              {/* Compact 1~2 Line Team Intro */}
              <TeamIntroBanner
                intro={resolveGlobalEntryTeamStory(selectedGlobal).intro}
                compact
              />

              {/* Sub-Tab Switcher: Squad vs Team Story */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setGlobalDetailSubTab('squad')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    globalDetailSubTab === 'squad'
                      ? 'border-sky-400/50 bg-sky-500/15 text-sky-200'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>스쿼드 · 포메이션</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalDetailSubTab('story')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    globalDetailSubTab === 'story'
                      ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>팀 스토리</span>
                </button>
              </div>

              {globalDetailSubTab === 'story' && (
                <TeamStoryTab
                  story={resolveGlobalEntryTeamStory(selectedGlobal)}
                  clubName={selectedGlobal.clubProfile.name}
                  showIntroBanner={false}
                />
              )}

              {/* Formation PitchBoard + Manager & Bench */}
              {globalDetailSubTab === 'squad' && globalPitchData && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 sm:p-4 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-extrabold text-white">
                        {selectedGlobal.formation} ·{' '}
                        {TACTICS[selectedGlobal.defaultTactic].name}
                      </h4>
                      <span className="rounded-md border border-emerald-400/35 bg-emerald-500/12 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-300 tabular-nums">
                        실효 OVR{' '}
                        {globalPitchData.effectiveStarterOvr.toFixed(1)}
                      </span>
                      <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-300 tabular-nums">
                        기본 {selectedGlobal.teamAvgOvr.toFixed(1)} · 시너지 +
                        {globalPitchData.avgSynBonus.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
                    <div className="lg:col-span-7 mx-auto w-full max-w-[490px]">
                      <PitchBoard
                        formation={selectedGlobal.formation}
                        starters={globalPitchData.starters}
                        bench={globalPitchData.bench}
                        chemistry={globalPitchData.chem}
                        managerTraitId={selectedGlobal.managerTraitId}
                        conditionByPlayerId={{}}
                        showBench={false}
                        showChemBreakdown={true}
                        compact={true}
                        onSlotClick={(area, idx) => {
                          const p =
                            area === 'starter'
                              ? globalPitchData.starters[idx]
                              : globalPitchData.bench[idx];
                          if (p) setInspectedPlayer(p);
                        }}
                        onInspectPlayer={(p) => setInspectedPlayer(p)}
                      />
                    </div>

                    <div className="lg:col-span-5 space-y-3">
                      <div className="rounded-xl border border-sky-400/25 bg-slate-900/75 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
                            <PixelManagerAvatar
                              avatar={selectedGlobal.managerAvatar}
                              clubPrimaryColor={
                                selectedGlobal.clubProfile.primaryColor
                              }
                              clubSecondaryColor={
                                selectedGlobal.clubProfile.secondaryColor
                              }
                              size={34}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-black text-white">
                                {selectedGlobal.managerName}
                              </span>
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] font-black text-amber-300 tabular-nums shrink-0">
                                OVR {selectedGlobal.managerRating}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                              {selectedGlobal.managerTraitId && (
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-bold text-emerald-300">
                                  {
                                    MANAGER_TRAITS[
                                      selectedGlobal.managerTraitId
                                    ]?.name
                                  }
                                </span>
                              )}
                              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono font-bold text-slate-300 tabular-nums">
                                케미 {globalPitchData.chem.total}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {globalPitchData.bench.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            벤치 스쿼드 ({globalPitchData.bench.length})
                          </div>
                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                            {globalPitchData.bench.map((p) => {
                              const st = globalPitchData.statsById.get(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setInspectedPlayer(p)}
                                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 px-2.5 py-1.5 text-left text-xs transition hover:border-sky-400/50 hover:bg-slate-800/75 cursor-pointer touch-manipulation"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-8 shrink-0 rounded bg-slate-800 py-0.5 text-center font-mono text-[10px] font-bold text-slate-400">
                                      {p.mainPositions[0]}
                                    </span>
                                    <CountryFlagSvg
                                      code={p.nationalityCode}
                                      nationality={p.nationality}
                                      size="sm"
                                    />
                                    <span className="truncate font-bold text-slate-200">
                                      {p.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {st &&
                                      ((st.goals ?? 0) > 0 ||
                                        (st.assists ?? 0) > 0) && (
                                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                                          {st.goals ?? 0}G {st.assists ?? 0}A
                                        </span>
                                      )}
                                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-black text-amber-300 tabular-nums">
                                      {p.ovr}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'achievements' && (
            <div className="space-y-4">
              {/* Progress Bar & Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-amber-300">
                      히든 레거시 도감 진행도
                    </span>
                    <span className="font-mono text-white">
                      {progress.unlocked} / {progress.total} (
                      {Math.round((progress.unlocked / progress.total) * 100)}%)
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-500"
                      style={{
                        width: `${(progress.unlocked / progress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {(
                    [
                      ['all', '전체 (24)'],
                      ['unlocked', `해금됨 (${progress.unlocked})`],
                      ['locked', `미해금 (${progress.total - progress.unlocked})`],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAchFilter(val)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        achFilter === val
                          ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                          : 'border-slate-700 bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAchievements.map((def) => {
                  const record = legacyState.unlockedAchievements[def.id];
                  const isUnlocked = Boolean(record);

                  return (
                    <div
                      key={def.id}
                      className={`rounded-2xl border p-4 transition ${
                        isUnlocked
                          ? 'border-amber-400/45 bg-gradient-to-br from-amber-950/35 via-slate-900 to-slate-950 shadow-md shadow-amber-950/20'
                          : 'border-slate-800/90 bg-slate-950/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            isUnlocked
                              ? 'bg-amber-400/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          #{String(def.index).padStart(2, '0')} · {def.categoryLabel}
                        </span>
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
                            <Sparkles className="h-3 w-3" />
                            해금 완료
                          </span>
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-slate-500" />
                        )}
                      </div>

                      {isUnlocked ? (
                        <div className="mt-2.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-sm font-black text-white">
                            <Award className="h-4 w-4 shrink-0 text-amber-400" />
                            {def.title}
                          </div>
                          <p className="text-[11px] font-semibold text-emerald-300">
                            {def.conditionText}
                          </p>
                          <p className="text-[11px] leading-relaxed text-slate-400">
                            {def.motif}
                          </p>
                          <div className="border-t border-slate-800/80 pt-1.5 text-[10px] text-slate-500">
                            달성: {record.clubName} ({formatShortDate(record.unlockedAt)})
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2.5 space-y-1.5">
                          <div className="font-mono text-sm font-black tracking-widest text-slate-500">
                            ???
                          </div>
                          <p className="text-xs font-medium text-slate-300">
                            힌트: &ldquo;{def.hint}&rdquo;
                          </p>
                          <p className="text-[10px] text-slate-500">
                            조건을 달성하면 히든 레거시와 역사적 모티브가 공개됩니다.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {inspectedPlayer && (() => {
        const activePitch = historicalPitchData
          ? {
              formation: selectedHistorical!.formation,
              starters: selectedHistorical!.starters,
              slotSynergies: historicalPitchData.chem.slotSynergies,
              managerTraitId: selectedHistorical!.managerTraitId,
              managerRating: selectedHistorical!.managerRating,
            }
          : userEntryPitchData && selectedEntry
            ? {
                formation: selectedEntry.formation,
                starters: userEntryPitchData.starters,
                slotSynergies: userEntryPitchData.chem.slotSynergies,
                managerTraitId: selectedEntry.managerTraitId,
                managerRating: selectedEntry.managerRating,
              }
            : globalPitchData && selectedGlobal
              ? {
                  formation: selectedGlobal.formation,
                  starters: globalPitchData.starters,
                  slotSynergies: globalPitchData.chem.slotSynergies,
                  managerTraitId: selectedGlobal.managerTraitId,
                  managerRating: selectedGlobal.managerRating,
                }
              : null;
        const starterIdx = activePitch
          ? activePitch.starters.findIndex((p) => p?.id === inspectedPlayer.id)
          : -1;
        const slotSubPos =
          activePitch && starterIdx >= 0
            ? FORMATIONS[activePitch.formation]?.slots[starterIdx]?.subPosition
            : undefined;
        const slotSyn = activePitch
          ? (Object.values(activePitch.slotSynergies).find(
              (s) => s.playerId === inspectedPlayer.id,
            ) ?? null)
          : null;
        return (
          <PlayerDetailModal
            player={inspectedPlayer}
            slotSubPosition={slotSubPos}
            slotSynergy={slotSyn}
            managerTraitId={activePitch?.managerTraitId ?? null}
            managerRating={activePitch?.managerRating}
            ignoreSeasonCondition
            onClose={() => setInspectedPlayer(null)}
          />
        );
      })()}
    </div>
  );
}

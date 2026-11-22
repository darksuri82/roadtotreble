import { useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  Crown,
  Lock,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { HIDDEN_ACHIEVEMENTS } from '../../data/achievements';
import {
  buildUnifiedLeaderboard,
  HISTORICAL_BENCHMARK_TEAMS,
} from '../../data/historicalTeams';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { getAchievementProgress } from '../../engine/legacyEngine';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type {
  HallOfFameEntry,
  HistoricalTeamEntry,
} from '../../types/legacy';
import type { Player } from '../../types/player';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { JerseySvg } from '../common/JerseySvg';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { PixelTrophySvg } from '../common/PixelTrophySvg';
import { PlayerDetailModal } from '../common/PlayerDetailModal';

type LegacyTab = 'hof' | 'achievements';
type HofFilterTab = 'all' | 'user' | 'historical';
type HofSortBy = 'score' | 'date';
type HofDetailSubTab = 'squad' | 'history';
type HofHistoryFilter = 'all' | 'league' | 'cup' | 'ucl';

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return iso.slice(0, 10);
  }
}

export function LegacyHubModal() {
  const {
    legacyState,
    legacyModalOpen,
    setLegacyModalOpen,
    removeHallOfFameEntry,
    openDreamMatch,
  } = useGame();

  const [tab, setTab] = useState<LegacyTab>('hof');
  const [hofFilter, setHofFilter] = useState<HofFilterTab>('all');
  const [sortBy, setSortBy] = useState<HofSortBy>('score');
  const [selectedEntry, setSelectedEntry] = useState<HallOfFameEntry | null>(
    null,
  );
  const [selectedHistorical, setSelectedHistorical] =
    useState<HistoricalTeamEntry | null>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<HofDetailSubTab>('squad');
  const [historyFilter, setHistoryFilter] = useState<HofHistoryFilter>('all');
  const [achFilter, setAchFilter] = useState<'all' | 'unlocked' | 'locked'>(
    'all',
  );

  const progress = useMemo(
    () => getAchievementProgress(legacyState),
    [legacyState],
  );

  const unifiedLeaderboard = useMemo(
    () =>
      buildUnifiedLeaderboard({
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

  if (!legacyModalOpen) return null;

  const isViewingDetail = Boolean(selectedEntry || selectedHistorical);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">
                PITCH MANAGER 레거시 &amp; 명예의 전당
              </h2>
              <p className="text-xs text-slate-400">
                유저 기록 {legacyState.hallOfFame.length}시즌 · 역대 강팀{' '}
                {HISTORICAL_BENCHMARK_TEAMS.length}팀 · 히든 도전과제{' '}
                <span className="font-bold text-amber-300">
                  {progress.unlocked} / {progress.total}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('hof');
                  setSelectedEntry(null);
                  setSelectedHistorical(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  tab === 'hof'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🏛️ 명예의 전당 ({legacyState.hallOfFame.length + HISTORICAL_BENCHMARK_TEAMS.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('achievements');
                  setSelectedEntry(null);
                  setSelectedHistorical(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  tab === 'achievements'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🔒 히든 도전과제 ({progress.unlocked}/{progress.total})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setLegacyModalOpen(false)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'hof' && !isViewingDetail && (
            <div className="space-y-4">
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
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
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
                모든 유저 팀과 실제 축구 역사 속 최강 14팀은 완전히 동일한 공정 시즌 스코어 공식(34R/38R PPG×38 + 우승/대업/언더독/개인수상 보너스)으로 순위를 겨룹니다.
              </p>

              {unifiedLeaderboard.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-10 text-center">
                  <Trophy className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-sm font-bold text-slate-300">
                    아직 명예의 전당에 등재된 유저 시즌이 없습니다.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    시즌을 완료하면 역대 최강 14팀과 함께 동일한 스코어보드에 등재됩니다!
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
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-300 truncate">
                                {entry.managerName ? `${entry.managerName} 감독 · ` : ''}
                                {entry.leagueRecord} ({entry.leaguePoints}점) · {entry.cupName}{' '}
                                {entry.cupResultLabel} · UCL {entry.uclResultLabel}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-500 truncate">
                                {formatShortDate(entry.completedAt)} · OVR {entry.teamAvgOvr} · 케미{' '}
                                {entry.chemistry}
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

                        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                          <span className="truncate text-[11px] text-slate-400">
                            에이스: <strong className="text-slate-200">{entry.topScorerSummary}</strong>
                          </span>
                          <div className="flex items-center gap-1.5">
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
                      {selectedHistorical.leaguePoints}점 우승 ({selectedHistorical.leagueRecord},{' '}
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
                  { label: '리그 순위', val: selectedHistorical.seasonScore.leagueRankBonus },
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

              {/* Full Prime Squad: 11 Starters + 6 Bench (Click any player for 7+5 sub-attributes radar!) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold text-white">
                    풀스쿼드 — 선발 {selectedHistorical.starters.length}명 + 핵심 벤치{' '}
                    {selectedHistorical.bench.length}명 ({selectedHistorical.formation} ·{' '}
                    {TACTICS[selectedHistorical.defaultTactic].name})
                  </h4>
                  <span className="text-[11px] text-amber-300">
                    선수 클릭 시 7대 세부 능력치 &amp; 레이더 차트 확인
                  </span>
                </div>

                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    선발 베스트 11 (STARTING XI)
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedHistorical.starters.map((p, idx) => {
                      const slotLabel =
                        selectedHistorical.bestXi[idx]?.position ??
                        p.mainPositions[0];
                      const note = selectedHistorical.bestXi[idx]?.note;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setInspectedPlayer(p)}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/75 px-3 py-2 text-left text-xs transition hover:border-amber-400/55 hover:bg-slate-800/80 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-9 shrink-0 rounded bg-slate-800 py-0.5 text-center font-mono text-[10px] font-bold text-amber-300">
                              {slotLabel}
                            </span>
                            <CountryFlagSvg
                              code={p.nationalityCode}
                              nationality={p.nationality}
                              size="sm"
                            />
                            <span className="truncate font-bold text-white">
                              {p.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {note && (
                              <span className="hidden xl:inline rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                {note}
                              </span>
                            )}
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-black text-amber-300">
                              {p.ovr}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedHistorical.bench.length > 0 && (
                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      핵심 벤치 ({selectedHistorical.bench.length}명)
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {selectedHistorical.bench.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setInspectedPlayer(p)}
                          className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/45 px-3 py-2 text-left text-xs transition hover:border-amber-400/50 hover:bg-slate-800/70 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-9 shrink-0 rounded bg-slate-800/80 py-0.5 text-center font-mono text-[10px] font-bold text-slate-400">
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
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-300">
                            {p.ovr}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'hof' && selectedEntry && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                ← 명예의 전당 목록으로 돌아가기
              </button>

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
                  { label: '리그 순위', val: selectedEntry.seasonScore.leagueRankBonus },
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
                  </div>
                ))}
              </div>

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

              {/* Detail Sub-Tabs: Squad vs Full Match History */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setDetailSubTab('squad')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${
                    detailSubTab === 'squad'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800/70 text-slate-300 hover:text-white'
                  }`}
                >
                  최종 16인 스쿼드
                </button>
                <button
                  type="button"
                  onClick={() => setDetailSubTab('history')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${
                    detailSubTab === 'history'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800/70 text-slate-300 hover:text-white'
                  }`}
                >
                  전체 경기 히스토리 ({selectedEntry.matchHistory?.length ?? 0}경기)
                </button>
              </div>

              {detailSubTab === 'squad' ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <h4 className="mb-3 text-xs font-extrabold text-slate-300">
                    최종 등록 스쿼드 (선발 11명 + 벤치 5명 · 시즌 통합 스탯)
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {[...selectedEntry.starters, ...selectedEntry.bench].map(
                      (m, idx) => (
                        <div
                          key={m.id}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                            m.isLegend
                              ? 'border-amber-500/40 bg-amber-950/25'
                              : idx < 11
                                ? 'border-slate-800 bg-slate-900/70'
                                : 'border-slate-800/60 bg-slate-900/35'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500">
                                {idx < 11 ? 'XI' : 'SUB'}
                              </span>
                              <span className="truncate font-bold text-white">
                                {m.name}
                              </span>
                              <span className="rounded bg-slate-800 px-1 text-[10px] font-bold text-amber-300">
                                {m.ovr}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {m.mainPositions.join('/')}
                            </div>
                          </div>
                          <div className="text-right font-mono text-[11px] text-slate-300">
                            <div>
                              {m.goals}G {m.assists}A
                            </div>
                            <div className="text-[10px] text-emerald-400">
                              평점 {m.avgRating > 0 ? m.avgRating.toFixed(2) : '-'}
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
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
                          className={`rounded-md px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                            historyFilter === fid
                              ? 'bg-sky-400 text-slate-950'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
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

      {inspectedPlayer && (
        <PlayerDetailModal
          player={inspectedPlayer}
          managerTraitId={selectedHistorical?.managerTraitId ?? null}
          onClose={() => setInspectedPlayer(null)}
        />
      )}
    </div>
  );
}

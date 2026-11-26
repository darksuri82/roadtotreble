import {
  Award,
  Crown,
  Flame,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserCheck,
  Zap,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  evaluateManagerTeamEffect,
  MANAGER_TRAITS,
} from '../../data/managerTraits';
import {
  FFP_TIER1_CHEM_PENALTY,
  FFP_TIER1_SCORE_PENALTY_PCT,
  FFP_TIER1_WINDOW1_MAX_ATTEMPTS,
  FFP_TIER2_CHEM_PENALTY,
  FFP_TIER2_SCORE_PENALTY_PCT,
  FFP_TIER2_WINDOW2_MAX_ATTEMPTS,
} from '../../engine/budgetEngine';
import {
  calculateChemistry,
  calculateTeamRatings,
} from '../../engine/chemistryEngine';
import { STAFF_COACHES } from '../../engine/staffCoachEngine';
import { TACTICS } from '../../engine/tacticEngine';
import type {
  FormationId,
  ManagerAvatarConfig,
  ManagerTraitId,
  SeasonBudgetState,
  StaffCoachId,
  UserClubProfile,
} from '../../types/game';
import type {
  PlayerSeasonStats,
  StandingRow,
  TacticId,
} from '../../types/league';
import type { Player, SubPosition } from '../../types/player';
import { JerseySvg } from './JerseySvg';
import { PitchBoard } from './PitchBoard';
import { PixelManagerAvatar } from './PixelManagerAvatar';

export interface TeamArchiveHonorBadge {
  label: string;
  tone?: 'gold' | 'emerald' | 'sky' | 'rose' | 'slate';
}

export interface TeamSeasonArchiveTabProps {
  /** Milestone subtitle (e.g. "정규리그 종료 시점 스쿼드" vs "UCL 포함 통합 최종 스쿼드") */
  milestoneLabel: string;
  club: Pick<
    UserClubProfile,
    'name' | 'shortName' | 'primaryColor' | 'secondaryColor' | 'pattern'
  >;
  managerName: string;
  managerAvatar?: ManagerAvatarConfig;
  managerTraitId: ManagerTraitId | null;
  staffCoachId?: StaffCoachId | null;
  budgetState?: SeasonBudgetState | null;
  formation: FormationId;
  tactic: TacticId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  leagueName: string;
  leagueRank?: number;
  standingRow?: StandingRow | null;
  cupResultLabel?: string | null;
  uclResultLabel?: string | null;
  seasonScore?: { totalScore: number; grade: string } | null;
  honors?: TeamArchiveHonorBadge[];
  /** Season stats rows belonging to this team's players (league or merged league+cup+ucl) */
  teamStats: PlayerSeasonStats[];
  onInspectPlayer?: (player: Player, slotSubPosition?: SubPosition) => void;
  onInspectStats?: (stats: PlayerSeasonStats) => void;
}

function honorToneClass(tone: TeamArchiveHonorBadge['tone']): string {
  switch (tone) {
    case 'gold':
      return 'border-amber-400/50 bg-amber-500/15 text-amber-200';
    case 'emerald':
      return 'border-emerald-500/40 bg-emerald-500/12 text-emerald-200';
    case 'sky':
      return 'border-sky-400/40 bg-sky-500/12 text-sky-200';
    case 'rose':
      return 'border-rose-500/40 bg-rose-500/12 text-rose-200';
    default:
      return 'border-slate-700 bg-slate-800/80 text-slate-200';
  }
}

export function TeamSeasonArchiveTab({
  milestoneLabel,
  club,
  managerName,
  managerAvatar,
  managerTraitId,
  staffCoachId = null,
  budgetState = null,
  formation,
  tactic,
  starters,
  bench,
  leagueName,
  leagueRank,
  standingRow,
  cupResultLabel,
  uclResultLabel,
  seasonScore,
  honors = [],
  teamStats,
  onInspectPlayer,
  onInspectStats,
}: TeamSeasonArchiveTabProps) {
  const filledStarters = useMemo(
    () => starters.filter((p): p is Player => p !== null),
    [starters],
  );
  const allSquadPlayers = useMemo(
    () =>
      [...starters, ...bench].filter((p): p is Player => p !== null),
    [starters, bench],
  );

  const ffpChemPenalty = budgetState ? budgetState.chemPenalty : 0;

  const chemistry = useMemo(
    () =>
      calculateChemistry(
        formation,
        filledStarters,
        tactic,
        managerTraitId,
        undefined,
        {
          ffpChemPenalty,
          staffCoachId,
        },
      ),
    [formation, filledStarters, tactic, managerTraitId, ffpChemPenalty, staffCoachId],
  );

  const ratings = useMemo(
    () =>
      calculateTeamRatings(
        formation,
        filledStarters,
        chemistry.total,
        managerTraitId,
        chemistry.slotSynergies,
        tactic,
        staffCoachId,
      ),
    [formation, filledStarters, chemistry, managerTraitId, tactic, staffCoachId],
  );

  const managerEffect = useMemo(
    () =>
      managerTraitId
        ? evaluateManagerTeamEffect({
            traitId: managerTraitId,
            starters: filledStarters,
            tactic,
          })
        : null,
    [managerTraitId, filledStarters, tactic],
  );

  const managerTrait = managerTraitId ? MANAGER_TRAITS[managerTraitId] : null;
  const staffCoach = staffCoachId ? STAFF_COACHES[staffCoachId] : null;
  const tacticName = TACTICS[tactic]?.name ?? tactic;

  const awakenedList = useMemo(
    () =>
      allSquadPlayers
        .filter((p) => Boolean(p.awakening))
        .sort((a, b) => (b.awakening?.ovrGain ?? 0) - (a.awakening?.ovrGain ?? 0)),
    [allSquadPlayers],
  );

  const topScorer = useMemo(() => {
    const sorted = [...teamStats]
      .filter((s) => s.goals > 0)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.avgRating - a.avgRating);
    return sorted[0] ?? null;
  }, [teamStats]);

  const topAssister = useMemo(() => {
    const sorted = [...teamStats]
      .filter((s) => s.assists > 0)
      .sort((a, b) => b.assists - a.assists || b.goals - a.goals || b.avgRating - a.avgRating);
    return sorted[0] ?? null;
  }, [teamStats]);

  const topRated = useMemo(() => {
    const qualified = teamStats.filter((s) => s.appearances >= 3);
    const pool = qualified.length > 0 ? qualified : teamStats.filter((s) => s.appearances > 0);
    const sorted = [...pool].sort(
      (a, b) => b.avgRating - a.avgRating || b.goals + b.assists - (a.goals + a.assists),
    );
    return sorted[0] ?? null;
  }, [teamStats]);

  const ffpBadge = useMemo(() => {
    if (!budgetState) return null;
    if (budgetState.ffpTier === 2) {
      return {
        label: `FFP 2단계 (+${budgetState.excessPct}%)`,
        sub: `1·3차 동결/2차 ${FFP_TIER2_WINDOW2_MAX_ATTEMPTS}회 · 케미 -${FFP_TIER2_CHEM_PENALTY} · 점수 -${FFP_TIER2_SCORE_PENALTY_PCT}%`,
        cls: 'border-rose-500/45 bg-rose-500/15 text-rose-200',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
      };
    }
    if (budgetState.ffpTier === 1) {
      return {
        label: `FFP 1단계 (+${budgetState.excessPct}%)`,
        sub: `1·2·3차 각 ${FFP_TIER1_WINDOW1_MAX_ATTEMPTS}회 · 케미 -${FFP_TIER1_CHEM_PENALTY} · 점수 -${FFP_TIER1_SCORE_PENALTY_PCT}%`,
        cls: 'border-amber-400/45 bg-amber-500/15 text-amber-200',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-300 shrink-0" />,
      };
    }
    return {
      label: `예산 준수 (€${budgetState.initialSpentM}M / €${budgetState.capM}M)`,
      sub: `잔여 자금 €${budgetState.transferCashM}M`,
      cls: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
    };
  }, [budgetState]);

  return (
    <div className="space-y-4">
      {/* 1) Club, Manager, Staff Coach & FFP Header Card */}
      <section className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <JerseySvg
              primaryColor={club.primaryColor}
              secondaryColor={club.secondaryColor}
              pattern={club.pattern}
              label={club.shortName}
              size={48}
              className="shrink-0"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black text-emerald-300 whitespace-nowrap">
                  {milestoneLabel}
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-200 whitespace-nowrap">
                  {formation} · {tacticName}
                </span>
              </div>
              <h2 className="mt-1 truncate text-base sm:text-xl font-black text-white">
                {club.name}
              </h2>
            </div>
          </div>

          {/* Effective Team Ratings Summary */}
          <div className="flex flex-wrap items-center gap-2 tabular-nums">
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#090e15] px-3 py-2 text-xs">
              <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-400">ATT</span>
              <strong className="font-display text-sm text-white">
                {ratings.effectiveAtt.toFixed(1)}
              </strong>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">MID</span>
              <strong className="font-display text-sm text-white">
                {ratings.effectiveMid.toFixed(1)}
              </strong>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">DEF</span>
              <strong className="font-display text-sm text-white">
                {ratings.effectiveDef.toFixed(1)}
              </strong>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-extrabold text-emerald-200 whitespace-nowrap">
              케미 {chemistry.total}
            </div>
          </div>
        </div>

        {/* Coaching Staff & FFP Row */}
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {/* Head Manager */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-800/90 bg-[#090e15] p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-[#111824]">
              <PixelManagerAvatar
                avatar={managerAvatar}
                clubPrimaryColor={club.primaryColor}
                clubSecondaryColor={club.secondaryColor}
                size={40}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-emerald-400 whitespace-nowrap">
                  감독
                </span>
                {managerEffect && managerEffect.targetCount > 0 && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-px text-[9.5px] font-black text-amber-300 tabular-nums whitespace-nowrap">
                    ★ {Math.min(managerEffect.matchedCount, managerEffect.targetCount)}/
                    {managerEffect.targetCount}
                  </span>
                )}
              </div>
              <div className="truncate text-xs font-extrabold text-white">
                {managerName}
              </div>
              <div className="truncate text-[11px] text-slate-400">
                {managerTrait ? managerTrait.name : '특성 없음'}
              </div>
            </div>
          </div>

          {/* Hired Assistant Staff Coach */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-800/90 bg-[#090e15] p-3">
            {staffCoach ? (
              <>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-[#111824]">
                  <PixelManagerAvatar
                    avatar={staffCoach.avatar}
                    clubPrimaryColor={staffCoach.clubPrimaryColor}
                    clubSecondaryColor={staffCoach.clubSecondaryColor}
                    size={40}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-sky-300 whitespace-nowrap">
                      수석 코치 · {staffCoach.categoryLabel}
                    </span>
                  </div>
                  <div className="truncate text-xs font-extrabold text-white">
                    {staffCoach.name} ({staffCoach.roleTitle})
                  </div>
                  <div className="truncate text-[11px] text-emerald-300/90">
                    {staffCoach.shortBadge}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2.5 text-slate-500">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60">
                  <UserCheck className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500">수석 코치</div>
                  <div className="text-xs font-semibold text-slate-400">미선임</div>
                </div>
              </div>
            )}
          </div>

          {/* FFP / Budget Status */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-800/90 bg-[#090e15] p-3">
            {ffpBadge ? (
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  {ffpBadge.icon}
                  <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                    재정 · FFP 상태
                  </span>
                </div>
                <div
                  className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap tabular-nums ${ffpBadge.cls}`}
                >
                  {ffpBadge.label}
                </div>
                <div className="truncate text-[10.5px] text-slate-400">
                  {ffpBadge.sub}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-500">재정 · FFP 상태</div>
                <div className="text-xs font-semibold text-slate-400">기록 없음</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2) Formation Pitch View (Left) + Record / Leaders / Awakened / Honors (Right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        {/* Left: Read-Only PitchBoard with Starting XI + Bench */}
        <div className="lg:col-span-7">
          <PitchBoard
            formation={formation}
            starters={starters}
            bench={bench}
            chemistry={chemistry}
            managerTraitId={managerTraitId}
            staffCoachId={staffCoachId}
            showStaffCoachBadge={false}
            showManagerFitStrip
            tactic={tactic}
            showBench
            showChemLegend
            compact
            headerLabel={`${club.shortName} 최종 스쿼드 (${formation})`}
            onInspectPlayer={onInspectPlayer}
          />
        </div>

        {/* Right: Season Record, Leaders, Awakened Players & Honors */}
        <div className="lg:col-span-5 space-y-4">
          {/* Season Record Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-white">
                <Trophy className="w-4 h-4 text-amber-400" />
                시즌 성적 요약
              </h3>
              {seasonScore && (
                <span className="rounded-md border border-amber-400/40 bg-amber-500/12 px-2 py-0.5 text-[11px] font-black text-amber-200 tabular-nums whitespace-nowrap">
                  {seasonScore.totalScore.toLocaleString()} PTS · {seasonScore.grade}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
              <div className="rounded-xl border border-slate-800/90 bg-[#090e15] p-3">
                <div className="text-[10.5px] text-slate-400">{leagueName}</div>
                <div className="mt-0.5 font-display text-xl font-black text-white">
                  {leagueRank ? `${leagueRank}위` : '-'}
                </div>
                {standingRow && (
                  <div className="mt-0.5 text-[11px] font-semibold text-emerald-300">
                    {standingRow.points}점 ({standingRow.won}승 {standingRow.drawn}무{' '}
                    {standingRow.lost}패)
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800/90 bg-[#090e15] p-3">
                <div className="text-[10.5px] text-slate-400">득점 · 실점 · 득실</div>
                {standingRow ? (
                  <>
                    <div className="mt-0.5 font-display text-xl font-black text-white">
                      {standingRow.goalDifference >= 0
                        ? `+${standingRow.goalDifference}`
                        : standingRow.goalDifference}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      {standingRow.goalsFor}득점 · {standingRow.goalsAgainst}실점
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-slate-500">-</div>
                )}
              </div>

              {cupResultLabel && (
                <div className="rounded-xl border border-slate-800/90 bg-[#090e15] p-2.5">
                  <div className="text-[10px] text-slate-400">자국 컵</div>
                  <div className="mt-0.5 text-xs font-extrabold text-amber-200 truncate">
                    {cupResultLabel}
                  </div>
                </div>
              )}

              {uclResultLabel && (
                <div className="rounded-xl border border-slate-800/90 bg-[#090e15] p-2.5">
                  <div className="text-[10px] text-slate-400">챔피언스리그</div>
                  <div className="mt-0.5 text-xs font-extrabold text-sky-200 truncate">
                    {uclResultLabel}
                  </div>
                </div>
              )}
            </div>

            {honors.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                  <Award className="w-3.5 h-3.5 text-amber-300" />
                  획득 트로피 · 주요 명예
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {honors.map((h) => (
                    <span
                      key={h.label}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${honorToneClass(h.tone)}`}
                    >
                      {h.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Team Leaders Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-white">
              <Star className="w-4 h-4 text-emerald-400" />
              팀 내 주요 부문 리더
            </h3>
            <div className="space-y-2 text-xs tabular-nums">
              {[
                {
                  title: '팀 최다 득점',
                  stat: topScorer,
                  value: topScorer ? `${topScorer.goals}골` : '-',
                  sub: topScorer ? `${topScorer.appearances}경기 · ${topScorer.assists}도움` : '',
                  accent: 'text-emerald-300',
                },
                {
                  title: '팀 최다 도움',
                  stat: topAssister,
                  value: topAssister ? `${topAssister.assists}도움` : '-',
                  sub: topAssister ? `${topAssister.appearances}경기 · ${topAssister.goals}골` : '',
                  accent: 'text-sky-300',
                },
                {
                  title: '팀 최고 평점',
                  stat: topRated,
                  value: topRated ? topRated.avgRating.toFixed(2) : '-',
                  sub: topRated ? `${topRated.appearances}경기 · MOM ${topRated.momCount}회` : '',
                  accent: 'text-amber-300',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/90 bg-[#090e15] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-400">
                      {item.title}
                    </div>
                    {item.stat ? (
                      <button
                        type="button"
                        onClick={() => onInspectStats?.(item.stat!)}
                        className="truncate text-left text-xs font-extrabold text-white hover:text-emerald-300 transition cursor-pointer"
                      >
                        {item.stat.playerName}
                      </button>
                    ) : (
                      <div className="text-xs text-slate-500">-</div>
                    )}
                    {item.sub && (
                      <div className="text-[10px] text-slate-500">{item.sub}</div>
                    )}
                  </div>
                  <span
                    className={`font-display text-lg font-black shrink-0 ${item.accent}`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Awakened Players Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-white">
                <Flame className="w-4 h-4 text-rose-400" />
                시즌 포텐 각성 선수
              </h3>
              <span className="rounded bg-rose-500/15 border border-rose-500/35 px-1.5 py-0.5 text-[10px] font-black text-rose-200 tabular-nums whitespace-nowrap">
                {awakenedList.length}명
              </span>
            </div>

            {awakenedList.length > 0 ? (
              <div className="space-y-2">
                {awakenedList.map((p) => {
                  const awk = p.awakening!;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onInspectPlayer?.(p)}
                      className="card-awakened-ember flex w-full items-center justify-between gap-2 rounded-xl bg-[#10131d] px-3 py-2 text-left transition hover:brightness-110 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-black text-white">
                            {p.name}
                          </span>
                          <span className="rounded bg-slate-800 px-1.5 py-px text-[9.5px] font-bold text-slate-300">
                            {p.mainPositions[0] ?? p.position}
                          </span>
                        </div>
                        <div className="text-[10px] text-rose-200/80">
                          {awk.competition === 'ucl'
                            ? 'UCL'
                            : awk.competition === 'cup'
                              ? '컵'
                              : `${awk.round}R`}{' '}
                          영구 포텐 폭발
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                        <span className="text-[11px] font-bold text-slate-400 line-through">
                          {awk.originalOvr}
                        </span>
                        <span className="font-display text-base font-black text-white">
                          {p.ovr}
                        </span>
                        <span className="rounded bg-rose-500/25 border border-rose-400/50 px-1.5 py-0.5 text-[10px] font-black text-rose-200">
                          +{awk.ovrGain}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-[#090e15] px-3 py-2.5 text-xs text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>이번 시즌에는 영구 포텐 각성이 발생하지 않았습니다.</span>
              </div>
            )}
          </div>

          {allSquadPlayers.some((p) => p.isLegend) && (
            <div className="flex items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-200">
              <span className="inline-flex items-center gap-1.5 font-bold">
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                소속 레전드 선수
              </span>
              <span className="font-semibold text-amber-100 truncate max-w-[60%] text-right">
                {allSquadPlayers
                  .filter((p) => p.isLegend)
                  .map((p) => `${p.name}(${p.ovr})`)
                  .join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

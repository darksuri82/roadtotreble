import { Radio, Swords } from 'lucide-react';
import { useMemo, useState } from 'react';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import type { Club } from '../../types/league';
import type {
  UclKnockoutStage,
  UclKnockoutTie,
  UclTournamentState,
} from '../../types/ucl';
import { JerseySvg } from '../common/JerseySvg';
import { PixelTrophySvg } from '../common/PixelTrophySvg';

export interface LiveTieOverlay {
  /** Live goals scored by Team A (higher seed) in the currently streaming leg */
  liveGoalsA: number;
  /** Live goals scored by Team B (lower seed) in the currently streaming leg */
  liveGoalsB: number;
  /** Clock or phase badge text (e.g. "64'", "연장전", "PK 4-3", "FT") */
  clockLabel: string;
  /** True while match is streaming (blocks winner highlight & loser dimming) */
  isLive: boolean;
  /** True if both teams in this tie are human participants */
  isH2H?: boolean;
  penaltyScoreA?: number;
  penaltyScoreB?: number;
}

export interface UclBracketParticipant {
  clubId: string;
  nickname: string;
  isMe?: boolean;
}

export interface UclBracketTreeProps {
  ucl: Pick<
    UclTournamentState,
    'stage' | 'knockoutLeg' | 'ties' | 'championTeamId'
  >;
  clubsById: Record<string, Club>;
  myClubId?: string | null;
  participants?: UclBracketParticipant[];
  liveTieOverlays?: Record<string, LiveTieOverlay>;
  hideChampion?: boolean;
  onSelectTie?: (tie: UclKnockoutTie) => void;
}

const SLOT_H = 78;
const TOTAL_H = SLOT_H * 8; // 624px

const KO_STAGES: { id: UclKnockoutStage; label: string }[] = [
  { id: 'playoff', label: 'PO' },
  { id: 'r16', label: '16강' },
  { id: 'qf', label: '8강' },
  { id: 'sf', label: '4강' },
  { id: 'final', label: '결승' },
];

function isKoStage(stage: string): stage is UclKnockoutStage {
  return (
    stage === 'playoff' ||
    stage === 'r16' ||
    stage === 'qf' ||
    stage === 'sf' ||
    stage === 'final'
  );
}

function formatLegScores(
  tie: UclKnockoutTie,
  teamSide: 'A' | 'B',
  overlay?: LiveTieOverlay,
): string {
  if (tie.stage === 'final') {
    if (overlay) {
      return String(teamSide === 'A' ? overlay.liveGoalsA : overlay.liveGoalsB);
    }
    if (!tie.leg1) return '-';
    return String(teamSide === 'A' ? tie.leg1.homeGoals : tie.leg1.awayGoals);
  }
  const leg1Score = tie.leg1
    ? teamSide === 'A'
      ? tie.leg1.awayGoals
      : tie.leg1.homeGoals
    : null;
  const leg2Score = tie.leg2
    ? teamSide === 'A'
      ? tie.leg2.homeGoals
      : tie.leg2.awayGoals
    : null;

  if (overlay) {
    const liveVal = teamSide === 'A' ? overlay.liveGoalsA : overlay.liveGoalsB;
    if (leg1Score === null) return `${liveVal}`;
    return `${leg1Score}·${liveVal}`;
  }
  if (leg1Score === null && leg2Score === null) return '-';
  if (leg2Score === null) return `${leg1Score}`;
  return `${leg1Score}·${leg2Score}`;
}

function TieCard({
  tie,
  clubsById,
  placeholderLabel,
  myClubId,
  participantByClub,
  overlay,
  fullWidth = false,
  onSelectTie,
}: {
  tie?: UclKnockoutTie;
  clubsById: Record<string, Club>;
  placeholderLabel: string;
  myClubId: string | null;
  participantByClub: Map<string, UclBracketParticipant>;
  overlay?: LiveTieOverlay;
  fullWidth?: boolean;
  onSelectTie?: (tie: UclKnockoutTie) => void;
}) {
  const widthCls = fullWidth ? 'w-full' : 'w-[186px] sm:w-[206px]';

  if (!tie) {
    return (
      <div
        className={`flex h-[58px] ${widthCls} items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-2.5 text-[10px] sm:text-[11px] font-medium text-slate-600`}
      >
        {placeholderLabel}
      </div>
    );
  }

  const clubA = clubsById[tie.teamAId];
  const clubB = clubsById[tie.teamBId];
  const pA = participantByClub.get(tie.teamAId);
  const pB = participantByClub.get(tie.teamBId);
  const aIsMe = Boolean(myClubId && tie.teamAId === myClubId) || Boolean(pA?.isMe);
  const bIsMe = Boolean(myClubId && tie.teamBId === myClubId) || Boolean(pB?.isMe);
  const involvesMe = aIsMe || bIsMe;
  const involvesAnyHuman = Boolean(involvesMe || pA || pB);
  const isFriendH2H = Boolean(overlay?.isH2H || (pA && pB));

  // Spoiler guard: while streaming live, NEVER reveal winner/loser state!
  const isLive = Boolean(overlay?.isLive);
  const settledWinnerId = isLive ? null : tie.winnerId;
  const aWon = settledWinnerId === tie.teamAId;
  const bWon = settledWinnerId === tie.teamBId;
  const hasPlayed = Boolean(tie.leg1 || tie.leg2 || overlay);
  const clickable = Boolean(!isLive && (tie.leg1 || tie.leg2) && onSelectTie);

  const displayAggA = overlay
    ? tie.stage === 'final' || !tie.leg1
      ? overlay.liveGoalsA
      : tie.aggTeamA + overlay.liveGoalsA
    : tie.aggTeamA;
  const displayAggB = overlay
    ? tie.stage === 'final' || !tie.leg1
      ? overlay.liveGoalsB
      : tie.aggTeamB + overlay.liveGoalsB
    : tie.aggTeamB;

  const badge = isLive
    ? null
    : overlay?.penaltyScoreA !== undefined && overlay?.penaltyScoreB !== undefined
      ? `PK ${overlay.penaltyScoreA}-${overlay.penaltyScoreB}`
      : tie.decidedBy === 'penalties' &&
          tie.penaltyScoreA !== undefined &&
          tie.penaltyScoreB !== undefined
        ? `PK ${tie.penaltyScoreA}-${tie.penaltyScoreB}`
        : tie.decidedBy === 'et'
          ? 'AET'
          : tie.leg1 && !tie.leg2 && tie.stage !== 'final'
            ? '1차전'
            : null;

  const renderRow = (
    club: Club | undefined,
    teamId: string,
    side: 'A' | 'B',
    isMe: boolean,
    participant: UclBracketParticipant | undefined,
    won: boolean,
    agg: number,
  ) => {
    const lost = Boolean(settledWinnerId && !won);
    return (
      <div
        className={`flex items-center justify-between gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-[11px] transition-opacity ${
          won
            ? 'bg-slate-800/70 font-bold text-white'
            : lost
              ? 'opacity-45 text-slate-500'
              : 'text-slate-200'
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {club ? (
            <JerseySvg
              primaryColor={club.primaryColor}
              secondaryColor={club.secondaryColor}
              pattern={club.pattern}
              size={15}
            />
          ) : (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-600" />
          )}
          <span
            className={`truncate ${
              isMe
                ? 'font-extrabold text-emerald-300'
                : participant
                  ? 'font-bold text-sky-200'
                  : won
                    ? 'font-bold text-white'
                    : lost
                      ? 'text-slate-500'
                      : 'text-slate-200'
            }`}
          >
            {club?.name ?? teamId}
          </span>
          {isMe ? (
            <span className="shrink-0 rounded bg-emerald-400 px-1 py-px text-[7px] font-black text-slate-950">
              MY
            </span>
          ) : participant ? (
            <span className="shrink-0 rounded border border-sky-400/35 bg-sky-500/15 px-1 py-px text-[7px] font-bold text-sky-200">
              {Array.from(participant.nickname.trim()).slice(0, 3).join('')}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 font-mono tabular-nums">
          {tie.stage !== 'final' && (tie.leg1 || overlay) && (
            <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
              ({formatLegScores(tie, side, overlay)})
            </span>
          )}
          <span
            className={`min-w-[20px] sm:min-w-[22px] rounded px-1 py-0.5 text-center text-[11px] sm:text-xs font-black border ${
              isLive
                ? 'border-rose-400/60 bg-rose-500/15 text-white'
                : won
                  ? 'border-amber-400/55 bg-amber-500/18 text-amber-200'
                  : 'border-slate-700/80 bg-slate-950/90 text-slate-200'
            }`}
          >
            {hasPlayed ? agg : '-'}
          </span>
        </div>
      </div>
    );
  };

  const inner = (
    <>
      {isLive && (
        <div className="flex items-center justify-between gap-1 border-b border-rose-500/30 bg-rose-950/45 px-2 py-0.5 text-[9px] font-black text-rose-200">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
            LIVE {overlay?.clockLabel}
          </span>
          {isFriendH2H && (
            <span className="inline-flex items-center gap-0.5 text-amber-300">
              <Swords className="h-2.5 w-2.5" />
              H2H
            </span>
          )}
        </div>
      )}
      {!isLive && isFriendH2H && (
        <div className="flex items-center justify-end border-b border-amber-500/20 bg-amber-500/8 px-2 py-px text-[8px] font-black text-amber-300">
          <span className="inline-flex items-center gap-0.5">
            <Swords className="h-2.5 w-2.5" />
            친구 맞대결
          </span>
        </div>
      )}

      {renderRow(clubA, tie.teamAId, 'A', aIsMe, pA, aWon, displayAggA)}

      <div className="relative h-px bg-slate-800/90">
        {badge && (
          <span className="absolute right-2 -top-2 rounded bg-slate-950/95 px-1.5 py-px text-[9px] font-bold text-sky-300 ring-1 ring-slate-700/80">
            {badge}
          </span>
        )}
      </div>

      {renderRow(clubB, tie.teamBId, 'B', bIsMe, pB, bWon, displayAggB)}
    </>
  );

  const cls = `${widthCls} overflow-hidden rounded-xl border text-left transition-colors touch-manipulation ${
    isLive
      ? 'border-rose-400/70 bg-[#151220] shadow-md shadow-rose-500/15'
      : involvesMe
        ? 'border-emerald-500/55 bg-[#101e1c] shadow-sm shadow-emerald-500/10'
        : involvesAnyHuman
          ? 'border-sky-400/45 bg-[#0e1a2d]'
          : 'border-slate-800 bg-[#121923]'
  } ${clickable ? 'hover:border-sky-400/75 cursor-pointer' : ''}`;

  if (clickable && onSelectTie) {
    return (
      <button
        type="button"
        onClick={() => onSelectTie(tie)}
        title="클릭하여 경기 상세 리포트 보기"
        className={cls}
      >
        {inner}
      </button>
    );
  }

  return <div className={cls}>{inner}</div>;
}

/** Orthogonal SVG connector column linking `fromCount` ties (8->4, 4->2, 2->1). */
function BracketConnectorSvg({
  fromCount,
  active,
  width = 30,
}: {
  fromCount: 8 | 4 | 2;
  active?: boolean;
  width?: number;
}) {
  const toCount = fromCount / 2;
  const fromStep = TOTAL_H / fromCount;
  const toStep = TOTAL_H / toCount;
  const midX = width / 2;

  const paths: string[] = [];
  for (let i = 0; i < toCount; i += 1) {
    const yTop = (i * 2 + 0.5) * fromStep;
    const yBot = (i * 2 + 1.5) * fromStep;
    const yMid = (i + 0.5) * toStep;
    paths.push(`M 0 ${yTop} H ${midX} V ${yBot} H 0`);
    paths.push(`M ${midX} ${yMid} H ${width}`);
  }

  return (
    <svg
      width={width}
      height={TOTAL_H}
      viewBox={`0 0 ${width} ${TOTAL_H}`}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      {paths.map((d, idx) => (
        <path
          key={idx}
          d={d}
          fill="none"
          stroke={active ? 'rgba(56, 189, 248, 0.55)' : 'rgba(148, 163, 184, 0.3)'}
          strokeWidth={active ? 1.8 : 1.5}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ))}
    </svg>
  );
}

export function UclBracketTree({
  ucl,
  clubsById,
  myClubId = USER_CLUB_ID,
  participants,
  liveTieOverlays,
  hideChampion = false,
  onSelectTie,
}: UclBracketTreeProps) {
  const defaultMobileStage: UclKnockoutStage = isKoStage(ucl.stage)
    ? ucl.stage
    : ucl.ties.final.length > 0
      ? 'final'
      : ucl.ties.sf.length > 0
        ? 'sf'
        : ucl.ties.qf.length > 0
          ? 'qf'
          : ucl.ties.r16.length > 0
            ? 'r16'
            : 'playoff';

  const [mobileStageChoice, setMobileStageChoice] =
    useState<UclKnockoutStage | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<'round' | 'tree'>('round');

  const activeMobileStage = mobileStageChoice ?? defaultMobileStage;

  const participantByClub = useMemo(() => {
    const map = new Map<string, UclBracketParticipant>();
    for (const p of participants ?? []) {
      map.set(p.clubId, p);
    }
    return map;
  }, [participants]);

  const playoffTies = ucl.ties.playoff ?? [];
  const r16Ties = ucl.ties.r16 ?? [];
  const qfTies = ucl.ties.qf ?? [];
  const sfTies = ucl.ties.sf ?? [];
  const finalTie = ucl.ties.final?.[0];

  const anyLive = useMemo(
    () => Boolean(liveTieOverlays && Object.values(liveTieOverlays).some((o) => o.isLive)),
    [liveTieOverlays],
  );
  const championClub =
    !hideChampion && !anyLive && ucl.championTeamId
      ? clubsById[ucl.championTeamId]
      : null;
  const championIsMe = Boolean(
    championClub && myClubId && ucl.championTeamId === myClubId,
  );

  const stageHeader = (stageId: UclKnockoutStage, title: string) => {
    const isCurrent = ucl.stage === stageId;
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span
          className={
            isCurrent
              ? 'text-sky-200 font-black'
              : stageId === 'final'
                ? 'text-amber-300'
                : 'text-slate-400'
          }
        >
          {title}
        </span>
        {isCurrent && (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/45 bg-sky-500/20 px-1.5 py-px text-[9px] font-extrabold text-sky-200">
            {anyLive && <Radio className="h-2.5 w-2.5 text-rose-400 animate-pulse" />}
            {stageId === 'final' ? '진행 중' : `${ucl.knockoutLeg}차전`}
          </span>
        )}
      </div>
    );
  };

  const mobileStageTies = ucl.ties[activeMobileStage] ?? [];
  const mobileExpectedCount =
    activeMobileStage === 'playoff' || activeMobileStage === 'r16'
      ? 8
      : activeMobileStage === 'qf'
        ? 4
        : activeMobileStage === 'sf'
          ? 2
          : 1;

  return (
    <div className="space-y-3">
      {/* Mobile (<md) Quick Round Switcher + Full Tree Toggle */}
      <div className="md:hidden space-y-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="grid flex-1 grid-cols-5 gap-1 rounded-xl border border-sky-500/25 bg-[#08101f] p-1">
            {KO_STAGES.map((st) => {
              const active = mobileViewMode === 'round' && activeMobileStage === st.id;
              const isCurrent = ucl.stage === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setMobileViewMode('round');
                    setMobileStageChoice(st.id);
                  }}
                  className={`relative rounded-lg px-1 py-1.5 text-[10px] font-extrabold transition-colors cursor-pointer touch-manipulation ${
                    active
                      ? 'bg-sky-500/25 text-sky-100 border border-sky-400/50'
                      : isCurrent
                        ? 'text-sky-300 border border-sky-500/25'
                        : 'text-slate-400 border border-transparent'
                  }`}
                >
                  {st.label}
                  {isCurrent && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() =>
              setMobileViewMode((m) => (m === 'round' ? 'tree' : 'round'))
            }
            className={`shrink-0 rounded-xl border px-2.5 py-2 text-[10px] font-extrabold cursor-pointer touch-manipulation ${
              mobileViewMode === 'tree'
                ? 'border-amber-400/55 bg-amber-500/18 text-amber-200'
                : 'border-slate-700 bg-[#0d1422] text-slate-300'
            }`}
          >
            {mobileViewMode === 'tree' ? '라운드별' : '전체 트리'}
          </button>
        </div>

        {mobileViewMode === 'round' && (
          <div className="rounded-2xl border border-sky-500/25 bg-[#0b1324] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-sky-200">
                  {KO_STAGES.find((s) => s.id === activeMobileStage)?.label} 대진
                </span>
                {ucl.stage === activeMobileStage && (
                  <span className="rounded border border-sky-400/40 bg-sky-500/18 px-1.5 py-0.5 text-[9px] font-black text-sky-200">
                    {activeMobileStage === 'final'
                      ? '결승 진행'
                      : `${ucl.knockoutLeg}차전`}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold text-slate-500">
                (1차·2차) · 합산
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {Array.from({ length: mobileExpectedCount }, (_, idx) => {
                const tie = mobileStageTies[idx];
                return (
                  <TieCard
                    key={`m-${activeMobileStage}-${idx}`}
                    tie={tie}
                    clubsById={clubsById}
                    placeholderLabel={`${KO_STAGES.find((s) => s.id === activeMobileStage)?.label} #${idx + 1}`}
                    myClubId={myClubId}
                    participantByClub={participantByClub}
                    overlay={tie ? liveTieOverlays?.[tie.id] : undefined}
                    fullWidth
                    onSelectTie={onSelectTie}
                  />
                );
              })}
            </div>

            {activeMobileStage === 'final' && championClub && (
              <div className="flex items-center justify-center gap-2.5 rounded-xl border border-amber-400/45 bg-amber-500/12 p-3">
                <PixelTrophySvg variant="ucl" size={34} animate />
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-amber-300">
                    UEFA WINNER
                  </div>
                  <div
                    className={`text-sm font-black ${
                      championIsMe ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {championClub.name}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop (md+) & Mobile Full-Tree View */}
      <div className={mobileViewMode === 'tree' ? 'block space-y-3' : 'hidden md:block space-y-3'}>
        {/* Playoff Round Strip */}
        {(playoffTies.length > 0 || ucl.stage === 'playoff') && (
          <div
            className={`rounded-2xl border p-3.5 ${
              ucl.stage === 'playoff'
                ? 'border-sky-400/45 bg-[#0c162b]'
                : 'border-slate-800/90 bg-[#0e1520]'
            }`}
          >
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-extrabold tracking-wide text-sky-200">
                  16강 플레이오프 (9~24위)
                </h4>
                {ucl.stage === 'playoff' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/45 bg-sky-500/20 px-2 py-0.5 text-[10px] font-black text-sky-200">
                    {anyLive && <Radio className="h-2.5 w-2.5 text-rose-400 animate-pulse" />}
                    진행 중 · {ucl.knockoutLeg}차전
                  </span>
                )}
              </div>
              <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                (1차전·2차전) 합산 AGG
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, idx) => {
                const tie = playoffTies[idx];
                return (
                  <div key={`po-${idx}`} className="flex justify-center">
                    <TieCard
                      tie={tie}
                      clubsById={clubsById}
                      placeholderLabel={`플레이오프 #${idx + 1}`}
                      myClubId={myClubId}
                      participantByClub={participantByClub}
                      overlay={tie ? liveTieOverlays?.[tie.id] : undefined}
                      onSelectTie={onSelectTie}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Authentic Orthogonal Knockout Tree: R16 -> QF -> SF -> FINAL -> CHAMPION */}
        <div className="rounded-2xl border border-sky-500/25 bg-[#0b1324] p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-extrabold tracking-wide text-amber-300">
                UEFA 챔피언스리그 토너먼트 대진표 (16강 → 결승)
              </h4>
              {anyLive && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/45 bg-rose-500/15 px-2 py-0.5 text-[10px] font-black text-rose-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500">
              {onSelectTie ? '종료 경기 클릭 시 상세 리포트' : '(1차전·2차전) 합산 AGG'}
            </span>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="inline-flex min-w-[1060px] flex-col">
              {/* Column Headers */}
              <div className="mb-3 flex items-center text-center text-[11px] font-bold uppercase tracking-wider">
                <div className="w-[206px]">{stageHeader('r16', '16강')}</div>
                <div className="w-[30px]" />
                <div className="w-[206px]">{stageHeader('qf', '8강')}</div>
                <div className="w-[30px]" />
                <div className="w-[206px]">{stageHeader('sf', '4강')}</div>
                <div className="w-[30px]" />
                <div className="w-[206px]">{stageHeader('final', '결승전')}</div>
                <div className="w-[24px]" />
                <div className="w-[144px] text-amber-300">CHAMPION</div>
              </div>

              {/* Tree Grid */}
              <div className="flex items-center" style={{ height: TOTAL_H }}>
                {/* R16 (8 ties) */}
                <div className="flex h-full w-[206px] flex-col justify-around">
                  {Array.from({ length: 8 }, (_, idx) => {
                    const tie = r16Ties[idx];
                    return (
                      <div
                        key={`r16-${idx}`}
                        className="flex items-center justify-center"
                        style={{ height: TOTAL_H / 8 }}
                      >
                        <TieCard
                          tie={tie}
                          clubsById={clubsById}
                          placeholderLabel={`16강 #${idx + 1}`}
                          myClubId={myClubId}
                          participantByClub={participantByClub}
                          overlay={tie ? liveTieOverlays?.[tie.id] : undefined}
                          onSelectTie={onSelectTie}
                        />
                      </div>
                    );
                  })}
                </div>

                <BracketConnectorSvg fromCount={8} active={ucl.stage === 'r16'} />

                {/* QF (4 ties) */}
                <div className="flex h-full w-[206px] flex-col justify-around">
                  {Array.from({ length: 4 }, (_, idx) => {
                    const tie = qfTies[idx];
                    return (
                      <div
                        key={`qf-${idx}`}
                        className="flex items-center justify-center"
                        style={{ height: TOTAL_H / 4 }}
                      >
                        <TieCard
                          tie={tie}
                          clubsById={clubsById}
                          placeholderLabel={`8강 #${idx + 1}`}
                          myClubId={myClubId}
                          participantByClub={participantByClub}
                          overlay={tie ? liveTieOverlays?.[tie.id] : undefined}
                          onSelectTie={onSelectTie}
                        />
                      </div>
                    );
                  })}
                </div>

                <BracketConnectorSvg fromCount={4} active={ucl.stage === 'qf'} />

                {/* SF (2 ties) */}
                <div className="flex h-full w-[206px] flex-col justify-around">
                  {Array.from({ length: 2 }, (_, idx) => {
                    const tie = sfTies[idx];
                    return (
                      <div
                        key={`sf-${idx}`}
                        className="flex items-center justify-center"
                        style={{ height: TOTAL_H / 2 }}
                      >
                        <TieCard
                          tie={tie}
                          clubsById={clubsById}
                          placeholderLabel={`4강 #${idx + 1}`}
                          myClubId={myClubId}
                          participantByClub={participantByClub}
                          overlay={tie ? liveTieOverlays?.[tie.id] : undefined}
                          onSelectTie={onSelectTie}
                        />
                      </div>
                    );
                  })}
                </div>

                <BracketConnectorSvg fromCount={2} active={ucl.stage === 'sf'} />

                {/* FINAL (1 tie) */}
                <div className="flex h-full w-[206px] items-center justify-center">
                  <TieCard
                    tie={finalTie}
                    clubsById={clubsById}
                    placeholderLabel="UCL 결승전 (단판)"
                    myClubId={myClubId}
                    participantByClub={participantByClub}
                    overlay={finalTie ? liveTieOverlays?.[finalTie.id] : undefined}
                    onSelectTie={onSelectTie}
                  />
                </div>

                {/* Straight connector to Champion */}
                <svg
                  width={24}
                  height={TOTAL_H}
                  viewBox={`0 0 24 ${TOTAL_H}`}
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <line
                    x1={0}
                    y1={TOTAL_H / 2}
                    x2={24}
                    y2={TOTAL_H / 2}
                    stroke={
                      championClub
                        ? 'rgba(251, 191, 36, 0.7)'
                        : 'rgba(148, 163, 184, 0.3)'
                    }
                    strokeWidth={2}
                  />
                </svg>

                {/* Champion Trophy Card */}
                <div className="flex h-full w-[144px] items-center justify-center">
                  <div
                    className={`flex w-full flex-col items-center rounded-2xl border p-3.5 text-center ${
                      championIsMe
                        ? 'border-amber-400/60 bg-amber-500/12 shadow-lg shadow-amber-500/15'
                        : championClub
                          ? 'border-sky-400/40 bg-slate-900/90'
                          : 'border-dashed border-slate-800 bg-slate-900/40'
                    }`}
                  >
                    <PixelTrophySvg
                      variant="ucl"
                      size={50}
                      animate={Boolean(championClub)}
                    />
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      UEFA WINNER
                    </div>
                    <div
                      className={`mt-1 text-xs font-bold ${
                        championIsMe
                          ? 'text-emerald-300'
                          : championClub
                            ? 'text-white'
                            : 'text-slate-500'
                      }`}
                    >
                      {championClub ? championClub.name : '미정'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

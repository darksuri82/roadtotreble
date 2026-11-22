import type { Club } from '../../types/league';
import type { UclKnockoutTie, UclTournamentState } from '../../types/ucl';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { PixelTrophySvg } from '../common/PixelTrophySvg';

interface UclBracketTreeProps {
  ucl: UclTournamentState;
  clubsById: Record<string, Club>;
  onSelectTie?: (tie: UclKnockoutTie) => void;
}

const SLOT_H = 74; // Base vertical slot height for 8-tie columns (R16 & Playoff)
const TOTAL_H = SLOT_H * 8; // 592px

function formatLegScores(tie: UclKnockoutTie, teamSide: 'A' | 'B'): string {
  if (tie.stage === 'final') {
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
  if (leg1Score === null && leg2Score === null) return '-';
  if (leg2Score === null) return `${leg1Score}`;
  return `${leg1Score}·${leg2Score}`;
}

function TieCard({
  tie,
  clubsById,
  placeholderLabel,
  onSelectTie,
}: {
  tie?: UclKnockoutTie;
  clubsById: Record<string, Club>;
  placeholderLabel: string;
  onSelectTie?: (tie: UclKnockoutTie) => void;
}) {
  if (!tie) {
    return (
      <div className="flex h-[54px] w-[172px] sm:h-[58px] sm:w-[200px] items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-2.5 text-[10px] sm:text-[11px] font-medium text-slate-600">
        {placeholderLabel}
      </div>
    );
  }

  const clubA = clubsById[tie.teamAId];
  const clubB = clubsById[tie.teamBId];
  const aIsUser = tie.teamAId === USER_CLUB_ID;
  const bIsUser = tie.teamBId === USER_CLUB_ID;
  const aWon = tie.winnerId === tie.teamAId;
  const bWon = tie.winnerId === tie.teamBId;
  const hasPlayed = Boolean(tie.leg1 || tie.leg2);
  const involvesUser = aIsUser || bIsUser;
  const clickable = Boolean(hasPlayed && onSelectTie);

  const badge =
    tie.decidedBy === 'penalties' &&
    tie.penaltyScoreA !== undefined &&
    tie.penaltyScoreB !== undefined
      ? `PK ${tie.penaltyScoreA}-${tie.penaltyScoreB}`
      : tie.decidedBy === 'et'
        ? '연장'
        : tie.leg1 && !tie.leg2 && tie.stage !== 'final'
          ? '1차전'
          : null;

  const inner = (
    <>
      {/* Team A Row */}
      <div
        className={`flex items-center justify-between gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-[11px] ${
          aWon ? 'bg-slate-800/60 font-bold text-white' : 'text-slate-300'
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0 rounded-full border border-white/15"
            style={{ backgroundColor: clubA?.primaryColor ?? '#64748b' }}
          />
          <span
            className={`truncate ${
              aIsUser
                ? 'font-bold text-emerald-300'
                : aWon
                  ? 'text-white'
                  : tie.winnerId
                    ? 'text-slate-500'
                    : 'text-slate-200'
            }`}
          >
            {clubA?.name ?? 'TBD'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 font-mono tabular-nums">
          {tie.stage !== 'final' && tie.leg1 && (
            <span className="text-[9px] sm:text-[10px] font-semibold text-slate-300">
              ({formatLegScores(tie, 'A')})
            </span>
          )}
          <span
            className={`min-w-[20px] sm:min-w-[22px] rounded px-1 py-0.5 text-center text-[11px] sm:text-xs font-black border ${
              aWon
                ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                : 'border-slate-700/80 bg-slate-950/90 text-slate-200'
            }`}
          >
            {hasPlayed ? tie.aggTeamA : '-'}
          </span>
        </div>
      </div>

      {/* Divider + Optional PK/ET badge */}
      <div className="relative h-px bg-slate-800/90">
        {badge && (
          <span className="absolute right-2 -top-2 rounded bg-slate-950/95 px-1.5 py-px text-[9px] font-bold text-sky-300 ring-1 ring-slate-700/80">
            {badge}
          </span>
        )}
      </div>

      {/* Team B Row */}
      <div
        className={`flex items-center justify-between gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-[11px] ${
          bWon ? 'bg-slate-800/60 font-bold text-white' : 'text-slate-300'
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0 rounded-full border border-white/15"
            style={{ backgroundColor: clubB?.primaryColor ?? '#64748b' }}
          />
          <span
            className={`truncate ${
              bIsUser
                ? 'font-bold text-emerald-300'
                : bWon
                  ? 'text-white'
                  : tie.winnerId
                    ? 'text-slate-500'
                    : 'text-slate-200'
            }`}
          >
            {clubB?.name ?? 'TBD'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 font-mono tabular-nums">
          {tie.stage !== 'final' && tie.leg1 && (
            <span className="text-[9px] sm:text-[10px] font-semibold text-slate-300">
              ({formatLegScores(tie, 'B')})
            </span>
          )}
          <span
            className={`min-w-[20px] sm:min-w-[22px] rounded px-1 py-0.5 text-center text-[11px] sm:text-xs font-black border ${
              bWon
                ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                : 'border-slate-700/80 bg-slate-950/90 text-slate-200'
            }`}
          >
            {hasPlayed ? tie.aggTeamB : '-'}
          </span>
        </div>
      </div>
    </>
  );

  const cls = `w-[172px] sm:w-[200px] overflow-hidden rounded-xl border text-left transition-colors touch-manipulation ${
    involvesUser
      ? 'border-emerald-500/55 bg-[#101e1c] shadow-sm shadow-emerald-500/10'
      : 'border-slate-800 bg-[#121923]'
  } ${clickable ? 'hover:border-sky-400/75 cursor-pointer' : ''}`;

  if (clickable && onSelectTie) {
    return (
      <button
        type="button"
        onClick={() => onSelectTie(tie)}
        title="클릭하여 1·2차전 경기 상세 리포트 보기"
        className={cls}
      >
        {inner}
      </button>
    );
  }

  return <div className={cls}>{inner}</div>;
}

/**
 * Orthogonal SVG connector column linking `fromCount` ties (8->4, 4->2, 2->1)
 * cleanly with right-angle bracket elbows.
 */
function BracketConnectorSvg({
  fromCount,
  width = 34,
}: {
  fromCount: 8 | 4 | 2;
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
    // Upper feeder -> elbow -> lower feeder + outgoing horizontal stem
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
          stroke="rgba(148, 163, 184, 0.34)"
          strokeWidth={1.6}
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
  onSelectTie,
}: UclBracketTreeProps) {
  const playoffTies = ucl.ties.playoff;
  const r16Ties = ucl.ties.r16;
  const qfTies = ucl.ties.qf;
  const sfTies = ucl.ties.sf;
  const finalTie = ucl.ties.final[0];
  const championClub = ucl.championTeamId
    ? clubsById[ucl.championTeamId]
    : null;
  const userWonUcl = ucl.championTeamId === USER_CLUB_ID;

  return (
    <div className="space-y-4">
      {/* Playoff Qualification Round Strip (separate feeder into R16 against Top-8 seeds) */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0e1520] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">
              16강 플레이오프 (9~24위)
            </h4>
            <p className="text-[11px] text-slate-400">
              플레이오프 승자 8팀이 리그 페이즈 1~8위 시드 팀과 16강에서 격돌합니다
              {onSelectTie ? ' · 종료된 경기 클릭 시 상세 리포트' : ''}
            </p>
          </div>
          <span className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-slate-400">
            홈&어웨이 합산 스코어 · (1차전·2차전)
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, idx) => (
            <div key={`po-${idx}`} className="flex justify-center">
              <TieCard
                tie={playoffTies[idx]}
                clubsById={clubsById}
                placeholderLabel={`플레이오프 #${idx + 1}`}
                onSelectTie={onSelectTie}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main Authentic Orthogonal Knockout Tree: R16 -> QF -> SF -> FINAL -> BIG EARS */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d141f] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
            UEFA 챔피언스리그 토너먼트 대진표 (16강 → 결승)
          </h4>
          <span className="text-[11px] text-slate-500">
            ← 가로 스크롤 · 종료된 경기 클릭 시 1·2차전 상세 리포트 →
          </span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-flex min-w-[1040px] flex-col">
            {/* Column Headers */}
            <div className="mb-3 flex items-center text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <div className="w-[188px]">16강</div>
              <div className="w-[34px]" />
              <div className="w-[188px]">8강</div>
              <div className="w-[34px]" />
              <div className="w-[188px]">4강</div>
              <div className="w-[34px]" />
              <div className="w-[188px] text-amber-300">결승전</div>
              <div className="w-[26px]" />
              <div className="w-[160px] text-amber-300">CHAMPION</div>
            </div>

            {/* Tree Grid */}
            <div className="flex items-center" style={{ height: TOTAL_H }}>
              {/* R16 (8 ties) */}
              <div className="flex h-full w-[188px] flex-col justify-around">
                {Array.from({ length: 8 }, (_, idx) => (
                  <div
                    key={`r16-${idx}`}
                    className="flex items-center justify-center"
                    style={{ height: TOTAL_H / 8 }}
                  >
                    <TieCard
                      tie={r16Ties[idx]}
                      clubsById={clubsById}
                      placeholderLabel={`16강 #${idx + 1}`}
                      onSelectTie={onSelectTie}
                    />
                  </div>
                ))}
              </div>

              <BracketConnectorSvg fromCount={8} />

              {/* QF (4 ties) */}
              <div className="flex h-full w-[188px] flex-col justify-around">
                {Array.from({ length: 4 }, (_, idx) => (
                  <div
                    key={`qf-${idx}`}
                    className="flex items-center justify-center"
                    style={{ height: TOTAL_H / 4 }}
                  >
                    <TieCard
                      tie={qfTies[idx]}
                      clubsById={clubsById}
                      placeholderLabel={`8강 #${idx + 1}`}
                      onSelectTie={onSelectTie}
                    />
                  </div>
                ))}
              </div>

              <BracketConnectorSvg fromCount={4} />

              {/* SF (2 ties) */}
              <div className="flex h-full w-[188px] flex-col justify-around">
                {Array.from({ length: 2 }, (_, idx) => (
                  <div
                    key={`sf-${idx}`}
                    className="flex items-center justify-center"
                    style={{ height: TOTAL_H / 2 }}
                  >
                    <TieCard
                      tie={sfTies[idx]}
                      clubsById={clubsById}
                      placeholderLabel={`4강 #${idx + 1}`}
                      onSelectTie={onSelectTie}
                    />
                  </div>
                ))}
              </div>

              <BracketConnectorSvg fromCount={2} />

              {/* FINAL (1 tie) */}
              <div className="flex h-full w-[188px] items-center justify-center">
                <TieCard
                  tie={finalTie}
                  clubsById={clubsById}
                  placeholderLabel="UCL 결승전 (단판)"
                  onSelectTie={onSelectTie}
                />
              </div>

              {/* Straight connector to Champion */}
              <svg
                width={26}
                height={TOTAL_H}
                viewBox={`0 0 26 ${TOTAL_H}`}
                className="shrink-0"
                aria-hidden="true"
              >
                <line
                  x1={0}
                  y1={TOTAL_H / 2}
                  x2={26}
                  y2={TOTAL_H / 2}
                  stroke={
                    championClub
                      ? 'rgba(251, 191, 36, 0.7)'
                      : 'rgba(148, 163, 184, 0.34)'
                  }
                  strokeWidth={2}
                />
              </svg>

              {/* Champion Big Ears Trophy Card */}
              <div className="flex h-full w-[160px] items-center justify-center">
                <div
                  className={`flex w-full flex-col items-center rounded-2xl border p-4 text-center ${
                    userWonUcl
                      ? 'border-amber-400/60 bg-amber-500/12 shadow-lg shadow-amber-500/15'
                      : championClub
                        ? 'border-sky-400/40 bg-slate-900/90'
                        : 'border-dashed border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <PixelTrophySvg
                    variant="ucl"
                    size={56}
                    animate={Boolean(championClub)}
                  />
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    UEFA WINNER
                  </div>
                  <div
                    className={`mt-1 text-xs font-bold ${
                      userWonUcl
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
  );
}

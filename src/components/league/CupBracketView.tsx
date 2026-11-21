import { Trophy } from 'lucide-react';
import { CUP_STAGE_LABELS } from '../../engine/cupEngine';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import type { CupMatchNode, DomesticCupState } from '../../types/cup';
import type { Club, LeagueId, MatchResult } from '../../types/league';
import {
  getDomesticCupTrophyVariant,
  PixelTrophySvg,
} from '../common/PixelTrophySvg';

interface CupBracketViewProps {
  cup: DomesticCupState;
  clubs: Club[];
  leagueId?: LeagueId;
  onSelectMatch?: (match: MatchResult) => void;
}

const SLOT_H = 74;
const TOTAL_H = SLOT_H * 8; // 592px

function CupNodeCard({
  node,
  clubsById,
  placeholderLabel,
  onSelectMatch,
}: {
  node?: CupMatchNode;
  clubsById: Record<string, Club>;
  placeholderLabel: string;
  onSelectMatch?: (match: MatchResult) => void;
}) {
  if (!node) {
    return (
      <div className="flex h-[58px] w-[188px] items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-3 text-[11px] font-medium text-slate-600">
        {placeholderLabel}
      </div>
    );
  }

  const home = clubsById[node.homeTeamId];
  const away = clubsById[node.awayTeamId];
  const homeIsUser = node.homeTeamId === USER_CLUB_ID;
  const awayIsUser = node.awayTeamId === USER_CLUB_ID;
  const involvesUser = homeIsUser || awayIsUser;
  const homeWon = node.played && node.winnerId === node.homeTeamId;
  const awayWon = node.played && node.winnerId === node.awayTeamId;
  const et = node.result?.extraTime;
  const clickable = Boolean(node.played && node.result && onSelectMatch);

  const badge =
    node.played && et
      ? et.penalties
        ? `PK ${et.penalties.homePenGoals}-${et.penalties.awayPenGoals}`
        : '연장'
      : null;

  const content = (
    <>
      {/* Home Row */}
      <div
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-[11px] ${
          homeWon ? 'bg-slate-800/60 font-bold text-white' : 'text-slate-300'
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/15"
            style={{ backgroundColor: home?.primaryColor ?? '#64748b' }}
          />
          <span
            className={`truncate ${
              homeIsUser
                ? 'font-bold text-emerald-300'
                : homeWon
                  ? 'text-white'
                  : node.played
                    ? 'text-slate-500'
                    : 'text-slate-200'
            }`}
          >
            {home?.name ?? node.homeTeamId}
          </span>
        </div>
        <span
          className={`w-4 shrink-0 text-right font-mono text-xs font-bold tabular-nums ${
            homeWon ? 'text-amber-300' : 'text-slate-300'
          }`}
        >
          {node.played && node.result ? node.result.homeGoals : '-'}
        </span>
      </div>

      {/* Divider + Optional PK/ET badge */}
      <div className="relative h-px bg-slate-800/90">
        {badge && (
          <span className="absolute right-2 -top-2 rounded bg-slate-950/95 px-1.5 py-px text-[9px] font-bold text-amber-300 ring-1 ring-slate-700/80">
            {badge}
          </span>
        )}
      </div>

      {/* Away Row */}
      <div
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-[11px] ${
          awayWon ? 'bg-slate-800/60 font-bold text-white' : 'text-slate-300'
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/15"
            style={{ backgroundColor: away?.primaryColor ?? '#64748b' }}
          />
          <span
            className={`truncate ${
              awayIsUser
                ? 'font-bold text-emerald-300'
                : awayWon
                  ? 'text-white'
                  : node.played
                    ? 'text-slate-500'
                    : 'text-slate-200'
            }`}
          >
            {away?.name ?? node.awayTeamId}
          </span>
        </div>
        <span
          className={`w-4 shrink-0 text-right font-mono text-xs font-bold tabular-nums ${
            awayWon ? 'text-amber-300' : 'text-slate-300'
          }`}
        >
          {node.played && node.result ? node.result.awayGoals : '-'}
        </span>
      </div>
    </>
  );

  const boxClass = `w-[188px] overflow-hidden rounded-xl border text-left transition ${
    involvesUser
      ? 'border-emerald-500/55 bg-[#101e1c] shadow-sm shadow-emerald-500/10'
      : 'border-slate-800 bg-[#121923]'
  } ${clickable ? 'hover:border-amber-400/70 hover:brightness-110 cursor-pointer' : ''}`;

  if (clickable && node.result && onSelectMatch) {
    return (
      <button
        type="button"
        onClick={() => onSelectMatch(node.result!)}
        title="클릭하여 경기 상세 리포트 보기"
        className={boxClass}
      >
        {content}
      </button>
    );
  }

  return <div className={boxClass}>{content}</div>;
}

function CupConnectorSvg({
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
          stroke="rgba(148, 163, 184, 0.36)"
          strokeWidth={1.6}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ))}
    </svg>
  );
}

export function CupBracketView({
  cup,
  clubs,
  leagueId,
  onSelectMatch,
}: CupBracketViewProps) {
  const clubsById: Record<string, Club> = Object.fromEntries(
    clubs.map((c) => [c.id, c]),
  );
  const champion = cup.championTeamId ? clubsById[cup.championTeamId] : null;
  const userWonCup = cup.championTeamId === USER_CLUB_ID;
  const trophyVariant = getDomesticCupTrophyVariant(leagueId ?? cup.meta.leagueId);

  const r16 = cup.rounds.r16;
  const qf = cup.rounds.qf;
  const sf = cup.rounds.sf;
  const finalMatch = cup.rounds.final[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15"
            style={{ backgroundColor: `${cup.meta.accentColor}22` }}
          >
            <Trophy className="h-5 w-5" style={{ color: cup.meta.accentColor }} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">
              {cup.meta.koreanName}{' '}
              <span className="text-xs font-semibold text-slate-400">
                ({cup.meta.name})
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              16팀 단판 토너먼트 · 트리거: {cup.triggerRounds.map((r) => `${r}R`).join(' · ')}
              {onSelectMatch ? ' · 종료된 경기 클릭 시 상세 리포트' : ''}
            </p>
          </div>
        </div>

        {champion ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300">
            <Trophy className="h-4 w-4 text-amber-400" />
            우승: {champion.name}
          </div>
        ) : cup.userEliminatedAt ? (
          <span className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300">
            우리 팀 {CUP_STAGE_LABELS[cup.userEliminatedAt]} 탈락
          </span>
        ) : (
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            생존 중 · 현재 {CUP_STAGE_LABELS[cup.currentStage]}
          </span>
        )}
      </div>

      {/* Authentic Orthogonal Left-to-Right Knockout Bracket Tree */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d141f] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
            {cup.meta.koreanName} 토너먼트 대진표 (16강 → 결승)
          </h4>
          <span className="text-[11px] text-slate-500">
            ← 가로 스크롤 · 종료된 경기 클릭 시 스코어·득점자·xG·MOM 확인 →
          </span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-flex min-w-[1040px] flex-col">
            {/* Column Headers */}
            <div className="mb-3 flex items-center text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <div className="w-[188px]">
                16강 ({cup.triggerRounds[0]}R)
                {cup.pendingStage === 'r16' && (
                  <span className="ml-1 rounded bg-amber-500/20 px-1 text-[9px] text-amber-300">
                    대기
                  </span>
                )}
              </div>
              <div className="w-[34px]" />
              <div className="w-[188px]">
                8강 ({cup.triggerRounds[1]}R)
                {cup.pendingStage === 'qf' && (
                  <span className="ml-1 rounded bg-amber-500/20 px-1 text-[9px] text-amber-300">
                    대기
                  </span>
                )}
              </div>
              <div className="w-[34px]" />
              <div className="w-[188px]">
                4강 ({cup.triggerRounds[2]}R)
                {cup.pendingStage === 'sf' && (
                  <span className="ml-1 rounded bg-amber-500/20 px-1 text-[9px] text-amber-300">
                    대기
                  </span>
                )}
              </div>
              <div className="w-[34px]" />
              <div className="w-[188px] text-amber-300">
                결승전 ({cup.triggerRounds[3]}R)
              </div>
              <div className="w-[26px]" />
              <div className="w-[160px] text-amber-300">CHAMPION</div>
            </div>

            {/* Tree Grid */}
            <div className="flex items-center" style={{ height: TOTAL_H }}>
              {/* R16 (8 matches) */}
              <div className="flex h-full w-[188px] flex-col justify-around">
                {Array.from({ length: 8 }, (_, idx) => (
                  <div
                    key={`cup-r16-${idx}`}
                    className="flex items-center justify-center"
                    style={{ height: TOTAL_H / 8 }}
                  >
                    <CupNodeCard
                      node={r16[idx]}
                      clubsById={clubsById}
                      placeholderLabel={`16강 #${idx + 1}`}
                      onSelectMatch={onSelectMatch}
                    />
                  </div>
                ))}
              </div>

              <CupConnectorSvg fromCount={8} />

              {/* QF (4 matches) */}
              <div className="flex h-full w-[188px] flex-col justify-around">
                {Array.from({ length: 4 }, (_, idx) => (
                  <div
                    key={`cup-qf-${idx}`}
                    className="flex items-center justify-center"
                    style={{ height: TOTAL_H / 4 }}
                  >
                    <CupNodeCard
                      node={qf[idx]}
                      clubsById={clubsById}
                      placeholderLabel={`8강 #${idx + 1}`}
                      onSelectMatch={onSelectMatch}
                    />
                  </div>
                ))}
              </div>

              <CupConnectorSvg fromCount={4} />

              {/* SF (2 matches) */}
              <div className="flex h-full w-[188px] flex-col justify-around">
                {Array.from({ length: 2 }, (_, idx) => (
                  <div
                    key={`cup-sf-${idx}`}
                    className="flex items-center justify-center"
                    style={{ height: TOTAL_H / 2 }}
                  >
                    <CupNodeCard
                      node={sf[idx]}
                      clubsById={clubsById}
                      placeholderLabel={`4강 #${idx + 1}`}
                      onSelectMatch={onSelectMatch}
                    />
                  </div>
                ))}
              </div>

              <CupConnectorSvg fromCount={2} />

              {/* FINAL (1 match) */}
              <div className="flex h-full w-[188px] items-center justify-center">
                <CupNodeCard
                  node={finalMatch}
                  clubsById={clubsById}
                  placeholderLabel={`${cup.meta.koreanName} 결승`}
                  onSelectMatch={onSelectMatch}
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
                    champion
                      ? 'rgba(251, 191, 36, 0.7)'
                      : 'rgba(148, 163, 184, 0.36)'
                  }
                  strokeWidth={2}
                />
              </svg>

              {/* Champion Trophy Card */}
              <div className="flex h-full w-[160px] items-center justify-center">
                <div
                  className={`flex w-full flex-col items-center rounded-2xl border p-4 text-center ${
                    userWonCup
                      ? 'border-amber-400/60 bg-amber-500/12 shadow-lg shadow-amber-500/15'
                      : champion
                        ? 'border-emerald-400/40 bg-slate-900/90'
                        : 'border-dashed border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <PixelTrophySvg
                    variant={trophyVariant}
                    size={54}
                    animate={Boolean(champion)}
                  />
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    CUP WINNER
                  </div>
                  <div
                    className={`mt-1 text-xs font-bold ${
                      userWonCup
                        ? 'text-emerald-300'
                        : champion
                          ? 'text-white'
                          : 'text-slate-500'
                    }`}
                  >
                    {champion ? champion.name : '미정'}
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

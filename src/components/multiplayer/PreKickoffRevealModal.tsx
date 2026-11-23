import {
  Check,
  Crown,
  Diamond,
  Loader2,
  Play,
  Swords,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATIONS } from '../../data/formations';
import { ModalBodyLock } from '../../hooks/useBodyScrollLock';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import {
  calculateChemistry,
  calculateTeamRatings,
} from '../../engine/chemistryEngine';
import { evaluatePositionFit } from '../../engine/positionEngine';
import { TACTICS } from '../../engine/tacticEngine';
import {
  evaluateTeamTacticalProfile,
  evaluateUnifiedTacticalMatchup,
} from '../../engine/unifiedTacticsEngine';
import type {
  ChemistryLineType,
  ChemistryResult,
  FormationId,
  ManagerTraitId,
} from '../../types/game';
import { DEFAULT_MANAGER_AVATAR } from '../../types/game';
import type {
  MpRoomPlayerRow,
  MpTacticSubmission,
} from '../../types/multiplayer';
import { getCardTier } from '../../types/player';
import type { Player, SubPosition } from '../../types/player';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { JerseySvg } from '../common/JerseySvg';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { UnifiedTacticsStrip } from '../common/UnifiedTacticsStrip';

function shortFormationLabel(id: FormationId): string {
  if (id === '4-4-2-diamond') return '4-4-2◇';
  if (id === '3-5-2-dm') return '3-5-2 DM';
  return id;
}

const SYNERGY_LINE_COLORS: Record<
  ChemistryLineType,
  { stroke: string; glow: string }
> = {
  club: {
    stroke: '#10b981',
    glow: 'rgba(16, 185, 129, 0.55)',
  },
  nation: {
    stroke: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.55)',
  },
  style: {
    stroke: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.55)',
  },
  elite: {
    stroke: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.52)',
  },
};

const SUFFIX_KEEP_FIRST = new Set([
  '주니오르',
  '주니어',
  '필류',
  '네투',
  '시니어',
]);

function shortPlayerName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 7) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (SUFFIX_KEEP_FIRST.has(last)) return parts[0];
    if (last.length >= 2 && last.length <= 8) return last;
  }
  return trimmed;
}

function RevealFormationPitch({
  formation,
  starters,
  chemistry,
  managerTraitId,
  onInspectPlayer,
}: {
  formation: FormationId;
  starters: Player[];
  chemistry: ChemistryResult;
  managerTraitId: ManagerTraitId;
  onInspectPlayer?: (player: Player, slotSubPosition?: SubPosition) => void;
}) {
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const config = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];

  return (
    <div
      onPointerLeave={() => setFocusedIdx(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setFocusedIdx(null);
        }
      }}
      className="pitch-surface relative aspect-[4/3.95] w-full overflow-hidden rounded-xl border border-slate-800/90"
    >
      {/* Pitch SVG Markings + 4-Color Parallel Synergy Lines */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="1.5"
          fill="none"
          stroke="rgba(255,255,255,0.11)"
          strokeWidth="0.5"
        />
        <line
          x1="4"
          y1="50"
          x2="96"
          y2="50"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="0.42"
        />
        <circle
          cx="50"
          cy="50"
          r="10.5"
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="0.42"
        />
        <rect
          x="24"
          y="4"
          width="52"
          height="14"
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth="0.42"
        />
        <rect
          x="24"
          y="82"
          width="52"
          height="14"
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth="0.42"
        />

        {chemistry.links.map((link) => {
          const fromSlot = config.slots[link.fromIndex];
          const toSlot = config.slots[link.toIndex];
          if (!fromSlot || !toSlot) return null;

          const isLinkFocused =
            focusedIdx !== null &&
            (link.fromIndex === focusedIdx || link.toIndex === focusedIdx);
          const hasAnyFocus = focusedIdx !== null;
          const activeLines = link.activeLines;

          if (activeLines.length === 0) {
            return (
              <line
                key={`${link.fromIndex}-${link.toIndex}-none`}
                x1={fromSlot.x}
                y1={fromSlot.y}
                x2={toSlot.x}
                y2={toSlot.y}
                stroke="rgba(148, 163, 184, 0.16)"
                strokeOpacity={
                  hasAnyFocus ? (isLinkFocused ? 0.35 : 0.08) : 0.16
                }
                strokeWidth="0.45"
                strokeDasharray="2 3"
                strokeLinecap="round"
              />
            );
          }

          const dx = toSlot.x - fromSlot.x;
          const dy = toSlot.y - fromSlot.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const spacing =
            activeLines.length >= 4
              ? 0.8
              : activeLines.length === 3
                ? 1.0
                : 1.12;
          const centerOffset = ((activeLines.length - 1) * spacing) / 2;
          const baseWidth =
            activeLines.length >= 4
              ? 0.6
              : activeLines.length === 3
                ? 0.7
                : 0.82;
          const strokeWidth = isLinkFocused ? baseWidth * 1.3 : baseWidth;
          const lineOpacity = hasAnyFocus ? (isLinkFocused ? 1 : 0.3) : 0.9;

          return (
            <g key={`${link.fromIndex}-${link.toIndex}-active`}>
              {activeLines.map((lineType, idx) => {
                const offset = idx * spacing - centerOffset;
                const ox = nx * offset;
                const oy = ny * offset;
                const style = SYNERGY_LINE_COLORS[lineType];
                return (
                  <g key={`${link.fromIndex}-${link.toIndex}-${lineType}`}>
                    <line
                      x1={fromSlot.x + ox}
                      y1={fromSlot.y + oy}
                      x2={toSlot.x + ox}
                      y2={toSlot.y + oy}
                      stroke={style.glow}
                      strokeOpacity={
                        hasAnyFocus ? (isLinkFocused ? 0.9 : 0.15) : 0.55
                      }
                      strokeWidth={strokeWidth * 2.1}
                      strokeLinecap="round"
                    />
                    <line
                      x1={fromSlot.x + ox}
                      y1={fromSlot.y + oy}
                      x2={toSlot.x + ox}
                      y2={toSlot.y + oy}
                      stroke={style.stroke}
                      strokeOpacity={lineOpacity}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* 11 Starter Pitch Nodes */}
      {config.slots.map((slot) => {
        const player = starters[slot.index] ?? null;
        const tier = player ? getCardTier(player) : null;
        const isLegend = tier === 'legend';
        const isSuperstar = tier === 'superstar';
        const isWorldclass = tier === 'worldclass';

        const fit = player
          ? evaluatePositionFit(player, slot.subPosition, managerTraitId)
          : null;
        const hasPenalty = Boolean(fit && fit.penalty < 0);
        const slotSyn = player
          ? chemistry.slotSynergies?.[slot.index]
          : undefined;
        const synBonus = slotSyn?.totalBonus ?? 0;

        const penaltyTagCls =
          fit?.fit === 'secondary'
            ? 'border border-amber-400/45 bg-[#231a0d]/95 text-amber-200'
            : 'border border-rose-500/60 bg-[#2b1117]/95 text-rose-200';

        return (
          <div
            key={slot.index}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') {
                setFocusedIdx(slot.index);
              }
            }}
            onPointerLeave={() =>
              setFocusedIdx((prev) => (prev === slot.index ? null : prev))
            }
            onClick={(e) => {
              e.stopPropagation();
              setFocusedIdx((prev) =>
                prev === slot.index ? null : slot.index,
              );
              if (player && onInspectPlayer) {
                onInspectPlayer(player, slot.subPosition);
              }
            }}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            className="group absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center select-none cursor-pointer"
          >
            <div
              className={`relative flex flex-col items-center justify-center rounded-lg px-1.5 py-0.5 min-w-[50px] sm:min-w-[60px] max-w-[82px] text-center shadow-md transition-colors ${
                isLegend
                  ? 'bg-gradient-to-b from-amber-950/95 via-stone-900/95 to-amber-950/95 border border-amber-400/90 shadow-[0_0_10px_rgba(251,191,36,0.34)]'
                  : isSuperstar
                    ? 'bg-gradient-to-b from-cyan-950/95 via-slate-900/95 to-cyan-950/95 border border-cyan-400/85 shadow-[0_0_10px_rgba(34,211,238,0.28)]'
                    : isWorldclass
                      ? 'bg-gradient-to-b from-sky-950/90 via-[#0e1726]/95 to-sky-950/90 border border-sky-400/65 shadow-[0_0_8px_rgba(56,189,248,0.20)]'
                      : 'bg-[#0f1621]/95 border border-slate-700/75 hover:border-slate-500/80'
              }`}
            >
              {isLegend ? (
                <Crown className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 text-amber-300 drop-shadow" />
              ) : isSuperstar ? (
                <Diamond className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 text-cyan-300 drop-shadow" />
              ) : null}

              {hasPenalty && fit && (
                <span
                  className={`absolute -top-2 -left-1.5 rounded px-1 text-[7.5px] font-bold leading-tight ${penaltyTagCls}`}
                >
                  {fit.penalty}
                </span>
              )}

              <div className="flex items-center justify-center gap-0.5 leading-none tabular-nums">
                <span
                  className={`font-display text-[10.5px] sm:text-xs font-bold ${
                    hasPenalty
                      ? fit?.fit === 'secondary'
                        ? 'text-amber-300'
                        : 'text-rose-300'
                      : isLegend
                        ? 'text-amber-300'
                        : isSuperstar
                          ? 'text-cyan-200'
                          : isWorldclass
                            ? 'text-sky-200'
                            : 'text-slate-100'
                  }`}
                >
                  {fit ? fit.effectiveOvr : (player?.ovr ?? '-')}
                </span>
                {synBonus > 0 && (
                  <span className="rounded bg-emerald-950/80 border border-emerald-500/25 px-0.5 py-px text-[7px] font-bold text-emerald-300/90 leading-none">
                    +{synBonus}
                  </span>
                )}
                {player && (
                  <CountryFlagSvg
                    code={player.nationalityCode}
                    nationality={player.nationality}
                    size="xs"
                  />
                )}
              </div>

              <span className="mt-0.5 max-w-[72px] truncate text-[8.5px] sm:text-[9px] font-semibold text-slate-200 leading-tight">
                {player ? shortPlayerName(player.name) : slot.label}
              </span>
            </div>

            <span className="mt-0.5 rounded bg-slate-950/85 px-1 py-0.2 text-[7.5px] font-bold tracking-wider text-slate-400">
              {slot.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface PreKickoffRevealModalProps {
  roomCode: string;
  matchNumber: number;
  isHost: boolean;
  hostRow: MpRoomPlayerRow;
  guestRow: MpRoomPlayerRow;
  hostSub: MpTacticSubmission;
  guestSub: MpTacticSubmission;
  hostTraitId: ManagerTraitId;
  guestTraitId: ManagerTraitId;
  busy: boolean;
  errorMsg: string | null;
  onToggleReady: (nextReady: boolean) => void;
  onHostKickoff: () => void;
  onInspectPlayer?: (player: Player, slotSubPosition?: SubPosition) => void;
}

export function PreKickoffRevealModal({
  roomCode,
  matchNumber,
  isHost,
  hostRow,
  guestRow,
  hostSub,
  guestSub,
  hostTraitId,
  guestTraitId,
  busy,
  errorMsg,
  onToggleReady,
  onHostKickoff,
  onInspectPlayer,
}: PreKickoffRevealModalProps) {
  const hostStats = useMemo(() => {
    const chem = calculateChemistry(
      hostSub.formation,
      hostSub.starters,
      hostSub.tactic,
      hostTraitId,
    );
    const ratings = calculateTeamRatings(
      hostSub.formation,
      hostSub.starters,
      chem.total,
      hostTraitId,
      chem.slotSynergies,
    );
    const fit = evaluateTeamTacticalProfile({
      starters: hostSub.starters,
      formation: hostSub.formation,
      tactic: hostSub.tactic,
      managerTraitId: hostTraitId,
      managerOvr: 86,
    }).tacticalFit;
    return { chem, ratings, fit };
  }, [hostSub, hostTraitId]);

  const guestStats = useMemo(() => {
    const chem = calculateChemistry(
      guestSub.formation,
      guestSub.starters,
      guestSub.tactic,
      guestTraitId,
    );
    const ratings = calculateTeamRatings(
      guestSub.formation,
      guestSub.starters,
      chem.total,
      guestTraitId,
      chem.slotSynergies,
    );
    const fit = evaluateTeamTacticalProfile({
      starters: guestSub.starters,
      formation: guestSub.formation,
      tactic: guestSub.tactic,
      managerTraitId: guestTraitId,
      managerOvr: 86,
    }).tacticalFit;
    return { chem, ratings, fit };
  }, [guestSub, guestTraitId]);

  const myMatchup = useMemo(() => {
    const mySub = isHost ? hostSub : guestSub;
    const oppSub = isHost ? guestSub : hostSub;
    const myTrait = isHost ? hostTraitId : guestTraitId;
    const oppTrait = isHost ? guestTraitId : hostTraitId;
    return evaluateUnifiedTacticalMatchup(
      {
        starters: mySub.starters,
        formation: mySub.formation,
        tactic: mySub.tactic,
        managerTraitId: myTrait,
        managerOvr: 86,
      },
      {
        starters: oppSub.starters,
        formation: oppSub.formation,
        tactic: oppSub.tactic,
        managerTraitId: oppTrait,
        managerOvr: 86,
      },
    );
  }, [isHost, hostSub, guestSub, hostTraitId, guestTraitId]);

  const myRow = isHost ? hostRow : guestRow;
  const bothReady = Boolean(hostRow.is_ready && guestRow.is_ready);

  const cards = [
    {
      roleLabel: 'HOME · 방장',
      row: hostRow,
      sub: hostSub,
      traitId: hostTraitId,
      stats: hostStats,
      isMe: isHost,
      isHostCard: true,
    },
    {
      roleLabel: 'AWAY · 도전자',
      row: guestRow,
      sub: guestSub,
      traitId: guestTraitId,
      stats: guestStats,
      isMe: !isHost,
      isHostCard: false,
    },
  ];

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-2 sm:p-4">
      <ModalBodyLock />
      <div className="modal-panel flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131c] shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0a0f17] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-extrabold text-emerald-300">
              <Swords className="w-3.5 h-3.5" />
              최종 포메이션 · 전술 공개 · 매치 #{matchNumber}
            </span>
            <span className="font-mono text-xs text-slate-400">#{roomCode}</span>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            선수 클릭 시 상세 능력치 확인 · 1x 동기화 중계
          </span>
        </div>

        {/* Scrollable Comparison Body */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 px-3.5 py-2 text-xs font-bold text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Side-by-Side Formation Pitches */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {cards.map(
              ({ roleLabel, row, sub, traitId, stats, isMe, isHostCard }) => (
                <div
                  key={row.player_id}
                  className={`rounded-xl border p-3 space-y-2.5 ${
                    isMe
                      ? 'border-emerald-500/40 bg-[#0f1924]'
                      : 'border-slate-800 bg-[#0b1018]'
                  }`}
                >
                  {/* Card Top: Role & Ready Status */}
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-400">
                      {isHostCard && (
                        <Crown className="w-3 h-3 text-amber-400" />
                      )}
                      {roleLabel}
                      {isMe && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                          나
                        </span>
                      )}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                        row.is_ready
                          ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      {row.is_ready ? <Check className="w-3 h-3" /> : null}
                      {row.is_ready ? '준비 완료' : '대기 중'}
                    </span>
                  </div>

                  {/* Club, Manager, Final Formation & Tactic */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-10 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#111822] shrink-0">
                        <PixelManagerAvatar
                          avatar={row.avatar_json ?? DEFAULT_MANAGER_AVATAR}
                          clubPrimaryColor={row.club_profile.primaryColor}
                          clubSecondaryColor={row.club_profile.secondaryColor}
                          size={28}
                        />
                      </div>
                      <JerseySvg
                        primaryColor={row.club_profile.primaryColor}
                        secondaryColor={row.club_profile.secondaryColor}
                        pattern={row.club_profile.pattern}
                        label={row.club_profile.shortName}
                        size={30}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-white">
                          {row.club_profile.name}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">
                          {row.nickname} · {MANAGER_TRAITS[traitId]?.name ?? ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-black text-sky-300">
                        {shortFormationLabel(sub.formation)}
                      </div>
                      <div className="text-xs font-extrabold text-amber-300">
                        {TACTICS[sub.tactic].shortName}
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics Strip */}
                  <div className="grid grid-cols-5 gap-1 text-center tabular-nums">
                    <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1">
                      <div className="text-[9px] text-slate-500">ATT</div>
                      <div className="font-display text-xs font-bold text-white">
                        {Math.round(
                          stats.ratings.effectiveAtt || stats.ratings.att,
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1">
                      <div className="text-[9px] text-slate-500">MID</div>
                      <div className="font-display text-xs font-bold text-white">
                        {Math.round(
                          stats.ratings.effectiveMid || stats.ratings.mid,
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1">
                      <div className="text-[9px] text-slate-500">DEF</div>
                      <div className="font-display text-xs font-bold text-white">
                        {Math.round(
                          stats.ratings.effectiveDef || stats.ratings.def,
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1">
                      <div className="text-[9px] text-slate-500">케미</div>
                      <div className="font-display text-xs font-bold text-sky-300">
                        {stats.chem.total}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1">
                      <div className="text-[9px] text-slate-500">완성도</div>
                      <div className="font-display text-xs font-bold text-emerald-300">
                        {stats.fit}%
                      </div>
                    </div>
                  </div>

                  {/* Visual Formation Pitch View (Replaces text list!) */}
                  <RevealFormationPitch
                    formation={sub.formation}
                    starters={sub.starters}
                    chemistry={stats.chem}
                    managerTraitId={traitId}
                    onInspectPlayer={onInspectPlayer}
                  />
                </div>
              ),
            )}
          </div>

          {/* Real 5-Zone Tactical Matchup Strip (from MY perspective) */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-300">
              최종 전술 상성 비교 (내 팀 기준)
            </div>
            <UnifiedTacticsStrip matchup={myMatchup} />
          </div>
        </div>

        {/* Footer: Dual Ready + Host Kickoff Button */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-800 bg-[#0a0f17] px-4 py-3">
          <div className="flex items-center gap-2 text-xs">
            <button
              id="mp-reveal-ready-btn"
              type="button"
              disabled={busy}
              onClick={() => onToggleReady(!myRow.is_ready)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50 ${
                myRow.is_ready
                  ? 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'border border-emerald-400/50 bg-emerald-500/18 text-emerald-200 hover:bg-emerald-500/28'
              }`}
            >
              <Check className="w-4 h-4" />
              {myRow.is_ready ? '준비 취소' : '경기 준비 완료'}
            </button>
          </div>

          {isHost ? (
            <button
              id="mp-reveal-kickoff-btn"
              type="button"
              disabled={busy || !bothReady}
              onClick={onHostKickoff}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              {bothReady ? '경기 시작 · 킥오프' : '양측 준비 완료 대기 중...'}
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-[#111822] px-4 py-2.5 text-xs font-bold text-slate-300">
              {bothReady ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  방장의 경기 시작 대기 중...
                </>
              ) : (
                '양측 모두 준비 완료를 눌러주세요'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { Check, Eye, FastForward, Loader2, Play, Star, Swords } from 'lucide-react';
import { useMemo, useState } from 'react';
import { calculateChemistry } from '../../../engine/chemistryEngine';
import {
  optimizeBestLineup,
  optimizeCurrentStartersForFormation,
  remapStartersForFormation,
} from '../../../engine/lineupOptimizer';
import {
  buildMpH2HClubs,
  mpH2HDoneKey,
  mpH2HPreMatchKey,
  mpH2HPreSkipKey,
  mpH2HSkipKey,
} from '../../../engine/mpLeagueH2H';
import { ModalBodyLock } from '../../../hooks/useBodyScrollLock';
import type { FormationId, ManagerRouletteState } from '../../../types/game';
import type { Club, LiveHalftimeState, TacticId } from '../../../types/league';
import type { MpH2HLive, MpLeagueHuman } from '../../../types/mpLeague';
import type {
  MpMatchPhase,
  MpMatchState,
  MpRoomPlayerRow,
  MpTacticBarrierPhase,
  MpTacticSubmission,
} from '../../../types/multiplayer';
import type { Player, SubPosition } from '../../../types/player';
import { JerseySvg } from '../../common/JerseySvg';
import type { SlotRef } from '../../common/PitchBoard';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { PlayerDetailModal } from '../../common/PlayerDetailModal';
import { LiveMatchBroadcast } from '../../league/LiveMatchBroadcast';
import type { LiveMatchBroadcastOverride } from '../../league/LiveMatchBroadcast';
import { MatchDayTacticsRoom } from '../../league/MatchDayTacticsRoom';

interface MpLeagueH2HViewProps {
  h2h: MpH2HLive;
  seasonKey: string;
  humans: MpLeagueHuman[];
  players: MpRoomPlayerRow[];
  myClubId: string | null;
  ackKeys: string[];
  onSubmitBarrier: (submission: MpTacticSubmission) => Promise<void>;
  onClearBarrier: () => Promise<void>;
  onAck: (key: string) => void;
}

interface EditState {
  key: string;
  formation: FormationId;
  tactic: TacticId;
  starters: (Player | null)[];
  bench: (Player | null)[];
}

function sideOfMatch(match: MpMatchState, isHome: boolean) {
  return {
    formation: isHome ? match.hostFormation : match.guestFormation,
    tactic: isHome ? match.hostTactic : match.guestTactic,
    starters: isHome ? match.hostStarters : match.guestStarters,
    bench: isHome ? match.hostBench : match.guestBench,
    traitId: isHome ? match.hostManagerTraitId : match.guestManagerTraitId,
    halftimeSubs: isHome ? match.hostHalftimeSubIds : match.guestHalftimeSubIds,
  };
}

function ManagerFace({ human, sub }: { human: MpLeagueHuman; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="flex items-end gap-1.5">
        <PixelManagerAvatar
          avatar={human.avatar}
          clubPrimaryColor={human.profile.primaryColor}
          clubSecondaryColor={human.profile.secondaryColor}
          size={46}
        />
        <JerseySvg
          primaryColor={human.profile.primaryColor}
          secondaryColor={human.profile.secondaryColor}
          pattern={human.profile.pattern}
          label={human.profile.shortName}
          size={30}
        />
      </div>
      <div className="max-w-[130px] truncate text-sm font-extrabold text-white">
        {human.nickname}
      </div>
      {sub && <div className="text-[11px] font-bold text-slate-400">{sub}</div>}
    </div>
  );
}

export function MpLeagueH2HView(props: MpLeagueH2HViewProps) {
  // Local tactics / phase state must restart for every new friend match
  return <MpLeagueH2HInner key={props.h2h.spec.key} {...props} />;
}

function MpLeagueH2HInner({
  h2h,
  seasonKey,
  humans,
  players,
  myClubId,
  ackKeys,
  onSubmitBarrier,
  onClearBarrier,
  onAck,
}: MpLeagueH2HViewProps) {
  const { spec, match } = h2h;
  const homeHuman = humans.find((h) => h.clubId === spec.homeClubId) ?? null;
  const awayHuman = humans.find((h) => h.clubId === spec.awayClubId) ?? null;
  const isParticipant = myClubId === spec.homeClubId || myClubId === spec.awayClubId;
  // Spectators watch from the home bench
  const viewIsHome = isParticipant ? myClubId === spec.homeClubId : true;
  const viewHuman = viewIsHome ? homeHuman : awayHuman;
  const oppHuman = viewIsHome ? awayHuman : homeHuman;
  const rowOf = (human: MpLeagueHuman | null) =>
    players.find((p) => p.player_id === human?.playerId) ?? null;
  const viewRow = rowOf(viewHuman);
  const oppRow = rowOf(oppHuman);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [localPhase, setLocalPhase] = useState<{
    remote: string;
    phase: MpMatchPhase;
  } | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);

  const remotePhaseKey = match ? `${match.matchId}:${match.phase}` : 'pre';
  const effectivePhase: MpMatchPhase | null = match
    ? localPhase && localPhase.remote === remotePhaseKey
      ? localPhase.phase
      : match.phase
    : null;

  const basePayload = viewRow?.league_payload ?? null;
  const base: Omit<EditState, 'key'> | null = match
    ? (() => {
        const s = sideOfMatch(match, viewIsHome);
        return {
          formation: s.formation,
          tactic: s.tactic,
          starters: [...s.starters],
          bench: [...s.bench],
        };
      })()
    : basePayload
      ? {
          formation: basePayload.formation,
          tactic: basePayload.tactic,
          starters: [...basePayload.starters],
          bench: [...basePayload.bench],
        }
      : null;

  const current: EditState | null =
    edit && edit.key === remotePhaseKey
      ? edit
      : base
        ? { key: remotePhaseKey, ...base }
        : null;

  const traitId =
    (match ? sideOfMatch(match, viewIsHome).traitId : null) ??
    viewHuman?.managerTraitId ??
    'big_game_hunter';

  const chemistry = useMemo(
    () =>
      calculateChemistry(
        current?.formation ?? '4-3-3',
        current?.starters ?? [],
        current?.tactic ?? 'balanced',
        traitId,
      ),
    [current?.formation, current?.starters, current?.tactic, traitId],
  );

  const clubsById = useMemo<Record<string, Club>>(
    () => (match ? buildMpH2HClubs(humans, match) : {}),
    [humans, match],
  );

  if (!homeHuman || !awayHuman || !viewHuman || !oppHuman || !current) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
        <div className="text-sm font-bold text-slate-300">맞대결 준비 중</div>
      </div>
    );
  }

  const patch = (changes: Partial<EditState>) => {
    setEdit({ ...current, ...changes, key: remotePhaseKey });
  };

  const handleSwap = (from: SlotRef, to: SlotRef) => {
    if (from.area === to.area && from.index === to.index) return;
    const nextS = [...current.starters];
    const nextB = [...current.bench];
    const pA = from.area === 'starter' ? nextS[from.index] : nextB[from.index];
    const pB = to.area === 'starter' ? nextS[to.index] : nextB[to.index];
    if (from.area === 'starter') nextS[from.index] = pB;
    else nextB[from.index] = pB;
    if (to.area === 'starter') nextS[to.index] = pA;
    else nextB[to.index] = pA;
    patch({ starters: nextS, bench: nextB });
  };

  const handleFormation = (next: FormationId) => {
    patch({
      formation: next,
      starters: remapStartersForFormation(current.starters, current.formation, next, traitId),
    });
  };

  const submitBarrier = async (
    phase: MpTacticBarrierPhase,
    barrierKey: string,
    tactic: TacticId,
    subIds: string[] = [],
  ) => {
    const starters = current.starters.filter((p): p is Player => p !== null);
    const bench = current.bench.filter((p): p is Player => p !== null);
    if (starters.length < 11) return;
    setSubmittingKey(barrierKey);
    await onSubmitBarrier({
      phase,
      barrierKey,
      formation: current.formation,
      tactic,
      starters,
      bench,
      subPlayerIds: subIds,
      submittedAt: new Date().toISOString(),
    });
  };

  const spectatorBadge = !isParticipant && (
    <div className="fixed top-2 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-sky-400/45 bg-slate-950/95 px-3.5 py-1 text-[11px] font-bold text-sky-300 shadow-lg flex items-center gap-1.5">
      <Eye className="w-3.5 h-3.5" />
      관전 중
    </div>
  );

  // ── Pre-match ──────────────────────────────────────────────────────────────
  if (!match) {
    const preKey = mpH2HPreMatchKey(spec, seasonKey);
    const preSkipKey = mpH2HPreSkipKey(spec, seasonKey);
    const lockedOf = (row: MpRoomPlayerRow | null) =>
      row?.tactic_submission?.barrierKey === preKey;
    const preSkipOf = (row: MpRoomPlayerRow | null) =>
      Boolean(row?.activity?.ackKeys?.includes(preSkipKey));
    const myLocked = isParticipant && (submittingKey === preKey || lockedOf(viewRow));
    const oppLocked = lockedOf(oppRow);
    const myPreSkip = isParticipant && ackKeys.includes(preSkipKey);
    const oppPreSkip = isParticipant && preSkipOf(oppRow);

    if (!isParticipant) {
      const homeRow = rowOf(homeHuman);
      const awayRow = rowOf(awayHuman);
      return (
        <div className="mx-auto max-w-xl px-3 py-10 sm:py-14 space-y-4">
          {spectatorBadge}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-5 space-y-4">
            <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-sky-300">
              <Swords className="w-3.5 h-3.5" />
              {spec.label}
            </div>
            <div className="flex items-center justify-around gap-3">
              <ManagerFace
                human={homeHuman}
                sub={
                  preSkipOf(homeRow)
                    ? '스킵 요청'
                    : lockedOf(homeRow)
                      ? '전술 확정'
                      : '전술 수정 중'
                }
              />
              <span className="text-lg font-black text-slate-500">VS</span>
              <ManagerFace
                human={awayHuman}
                sub={
                  preSkipOf(awayRow)
                    ? '스킵 요청'
                    : lockedOf(awayRow)
                      ? '전술 확정'
                      : '전술 수정 중'
                }
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              킥오프 대기
            </div>
          </div>
        </div>
      );
    }

    const oppPayload = oppRow?.league_payload;
    const oppStarters = oppPayload?.starters ?? [];
    const oppClub: Club = {
      id: oppHuman.clubId,
      name: oppHuman.profile.name,
      shortName: oppHuman.profile.shortName,
      primaryColor: oppHuman.profile.primaryColor,
      secondaryColor: oppHuman.profile.secondaryColor,
      pattern: oppHuman.profile.pattern,
      formation: oppPayload?.formation ?? '4-3-3',
      defaultTactic: oppPayload?.tactic ?? 'balanced',
      att: Math.round(
        oppStarters.reduce((s, p) => s + p.att, 0) / Math.max(1, oppStarters.length),
      ),
      mid: Math.round(
        oppStarters.reduce((s, p) => s + p.mid, 0) / Math.max(1, oppStarters.length),
      ),
      def: Math.round(
        oppStarters.reduce((s, p) => s + p.def, 0) / Math.max(1, oppStarters.length),
      ),
      topScorers: [
        oppStarters[10]?.name ?? '에이스',
        oppStarters[9]?.name ?? '공격수',
        oppStarters[8]?.name ?? '미드필더',
      ],
    };

    return (
      <div className="mx-auto max-w-6xl px-2.5 py-3 sm:px-4 sm:py-5 space-y-3">
        <MatchDayTacticsRoom
          opponent={oppClub}
          opponentRoster={oppStarters}
          opponentSubtitle={`${oppHuman.nickname} 감독`}
          opponentManagerOverride={{
            name: oppHuman.nickname,
            ovr: 86,
            traitId: oppHuman.managerTraitId,
          }}
          isHome={viewIsHome}
          headerBadge={spec.label}
          headerAccent={spec.ctx === 'league' ? 'league' : spec.ctx === 'cup' ? 'cup' : 'ucl'}
          activeTactic={current.tactic}
          defaultTactic={basePayload?.tactic ?? current.tactic}
          formation={current.formation}
          starters={current.starters}
          bench={current.bench}
          chemistry={chemistry}
          managerTraitId={traitId}
          locked={myLocked}
          blindOpponentStatus={myLocked && oppLocked ? null : oppLocked ? 'locked' : 'editing'}
          firstLegBanner={
            spec.ctx === 'ucl_ko' && spec.aggHomeBefore !== undefined
              ? {
                  stageLabel: spec.label,
                  homeName: homeHuman.profile.name,
                  awayName: awayHuman.profile.name,
                  homeLeg1Goals: spec.aggHomeBefore ?? 0,
                  awayLeg1Goals: spec.aggAwayBefore ?? 0,
                  isUserHomeLeg2: viewIsHome,
                }
              : null
          }
          onSelectTactic={(t) => patch({ tactic: t })}
          onChangeFormation={handleFormation}
          onSwapSquad={handleSwap}
          onAutoOptimize={() => {
            const opt = optimizeBestLineup(
              current.starters,
              current.bench,
              current.formation,
              current.tactic,
              traitId,
            );
            patch({ starters: opt.starters, bench: opt.bench });
          }}
          onInspectPlayer={(player, slotSubPosition) =>
            setInspected({ player, slotSubPosition })
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <span
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                oppPreSkip
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                  : oppLocked
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-800 bg-[#0b1018] text-slate-400'
              }`}
            >
              {oppPreSkip ? (
                <FastForward className="w-3.5 h-3.5" />
              ) : oppLocked ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              )}
              {oppHuman.nickname}:{' '}
              {oppPreSkip ? '스킵 요청 중' : oppLocked ? '전술 확정' : '전술 수정 중'}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                id="mpl-pre-h2h-skip-btn"
                type="button"
                disabled={myPreSkip}
                onClick={() => onAck(preSkipKey)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-extrabold transition-colors ${
                  myPreSkip
                    ? 'border-slate-700 bg-slate-900 text-slate-400'
                    : oppPreSkip
                      ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 cursor-pointer'
                      : 'border-slate-700 bg-[#111822] text-slate-200 hover:border-sky-400/60 hover:text-sky-200 cursor-pointer'
                }`}
              >
                <FastForward className="w-3.5 h-3.5" />
                {myPreSkip
                  ? '상대 스킵 동의 대기'
                  : oppPreSkip
                    ? '상대 스킵 요청 · 동의'
                    : '스킵 요청'}
              </button>

              {myLocked ? (
                <>
                  {!oppLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubmittingKey(null);
                        void onClearBarrier();
                      }}
                      className="rounded-xl border border-slate-700 bg-[#111822] px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
                    >
                      전술 수정
                    </button>
                  )}
                  <div className="inline-flex items-center gap-2 rounded-xl border border-sky-400/45 bg-sky-500/15 px-5 py-2.5 text-sm font-extrabold text-sky-200">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    킥오프 대기
                  </div>
                </>
              ) : (
                <button
                  id="mpl-lock-h2h-btn"
                  type="button"
                  onClick={() => void submitBarrier('pre_match', preKey, current.tactic)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  전술 확정
                </button>
              )}
            </div>
          </div>
        </MatchDayTacticsRoom>
        {inspected && (
          <PlayerDetailModal
            player={inspected.player}
            slotSubPosition={inspected.slotSubPosition}
            onClose={() => setInspected(null)}
          />
        )}
      </div>
    );
  }

  // ── Live synced broadcast (participants play, everyone else spectates) ─────
  const doneKey = mpH2HDoneKey(match.matchId);
  const skipKey = mpH2HSkipKey(match.matchId);
  const skipOf = (human: MpLeagueHuman | null) =>
    Boolean(rowOf(human)?.activity?.ackKeys?.includes(skipKey));
  const mySkip = isParticipant && ackKeys.includes(skipKey);
  const oppSkip = isParticipant && skipOf(oppHuman);
  const bothSkip = isParticipant
    ? mySkip && oppSkip
    : skipOf(homeHuman) && skipOf(awayHuman);
  const myDoneAcked = ackKeys.includes(doneKey);
  const showResultPopup =
    closed || effectivePhase === 'finished' || bothSkip || myDoneAcked;

  if (showResultPopup || !effectivePhase) {
    const res = match.finalResult;
    const goalEvents = res
      ? (() => {
          const hasEt = res.events.some((e) => e.minute > 90);
          const all = hasEt ? res.events : [...res.events, ...(res.extraTime?.etEvents ?? [])];
          return all.filter((e) => e.type === 'goal').sort((a, b) => a.minute - b.minute);
        })()
      : [];
    const pendingConfirmNames = humans
      .filter((h) => !rowOf(h)?.activity?.ackKeys?.includes(doneKey))
      .map((h) => h.nickname);
    const aggHome =
      spec.ctx === 'ucl_ko' && spec.aggHomeBefore !== undefined && res
        ? spec.aggHomeBefore + res.homeGoals
        : null;
    const aggAway =
      spec.ctx === 'ucl_ko' && spec.aggAwayBefore !== undefined && res
        ? spec.aggAwayBefore + res.awayGoals
        : null;

    return (
      <div className="modal-backdrop fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/90 p-3 sm:p-5">
        <ModalBodyLock />
        <div className="modal-panel flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#0d131c] shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-[#0a0f17] px-5 py-3.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="rounded bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 text-[10px] font-extrabold text-sky-200">
                맞대결 결과
              </span>
              <span className="truncate text-xs sm:text-sm font-extrabold text-white">
                {spec.label}
              </span>
            </div>
            {!isParticipant && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                <Eye className="w-3 h-3" />
                관전
              </span>
            )}
          </div>

          <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
            {!res ? (
              <div className="flex flex-col items-center gap-2.5 py-8 text-xs font-bold text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                경기 결과 산출 중...
              </div>
            ) : (
              <>
                {/* Scoreboard */}
                <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-4">
                  <div className="flex items-center justify-around gap-3">
                    <ManagerFace human={homeHuman} sub={homeHuman.profile.shortName} />
                    <div className="text-center">
                      <div className="font-mono text-3xl sm:text-4xl font-black text-white tabular-nums">
                        {res.homeGoals}
                        <span className="mx-1.5 text-slate-600">:</span>
                        {res.awayGoals}
                      </div>
                      {res.extraTime?.penalties && (
                        <div className="mt-1 text-[11px] font-extrabold text-amber-300 tabular-nums">
                          PK {res.extraTime.penalties.homePenGoals}–
                          {res.extraTime.penalties.awayPenGoals}
                        </div>
                      )}
                      {!res.extraTime?.penalties && res.extraTime && (
                        <div className="mt-1 text-[10px] font-bold text-sky-300">
                          연장 종료 (AET)
                        </div>
                      )}
                      {aggHome !== null && aggAway !== null && (
                        <div className="mt-1 text-[10px] font-bold text-slate-400 tabular-nums">
                          합산 {aggHome} : {aggAway}
                        </div>
                      )}
                    </div>
                    <ManagerFace human={awayHuman} sub={awayHuman.profile.shortName} />
                  </div>
                </div>

                {/* Goal & Assist list */}
                <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400">득점 기록</div>
                  {goalEvents.length === 0 ? (
                    <div className="text-xs text-slate-500">득점 없이 종료되었습니다.</div>
                  ) : (
                    <div className="space-y-1">
                      {goalEvents.map((ev, idx) => {
                        const isHomeGoal = ev.teamId === spec.homeClubId;
                        const scorerClub = isHomeGoal
                          ? homeHuman.profile.shortName
                          : awayHuman.profile.shortName;
                        return (
                          <div
                            key={`${ev.minute}-${idx}`}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="w-7 font-mono font-bold text-slate-500 tabular-nums">
                              {ev.minute}&apos;
                            </span>
                            <span
                              className={`rounded px-1.5 py-px text-[10px] font-extrabold ${
                                isHomeGoal
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-sky-500/15 text-sky-300'
                              }`}
                            >
                              {scorerClub}
                            </span>
                            <span className="font-bold text-white">
                              ⚽ {ev.scorerName ?? '득점'}
                            </span>
                            {ev.assistName && (
                              <span className="text-[11px] text-slate-400">
                                ({ev.assistName})
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Match Stats */}
                <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                  <div className="rounded-lg bg-[#0b1018] p-2">
                    <div className="text-[10px] text-slate-500">점유율</div>
                    <div className="font-mono text-xs sm:text-sm font-bold text-white">
                      {Math.round(res.homePossession)}:{100 - Math.round(res.homePossession)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#0b1018] p-2">
                    <div className="text-[10px] text-slate-500">xG</div>
                    <div className="font-mono text-xs sm:text-sm font-bold text-emerald-300">
                      {res.homeXg.toFixed(1)}:{res.awayXg.toFixed(1)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#0b1018] p-2">
                    <div className="text-[10px] text-slate-500">슈팅</div>
                    <div className="font-mono text-xs sm:text-sm font-bold text-white">
                      {res.homeShots}:{res.awayShots}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#0b1018] p-2">
                    <div className="text-[10px] text-slate-500">유효슈팅</div>
                    <div className="font-mono text-xs sm:text-sm font-bold text-sky-300">
                      {res.homeShotsOnTarget}:{res.awayShotsOnTarget}
                    </div>
                  </div>
                </div>

                {/* MOM */}
                {res.momPlayerName && (
                  <div className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-950/20 px-3 py-2 text-xs font-bold text-amber-200">
                    <Star className="w-3.5 h-3.5 text-amber-300 fill-current" />
                    MOM: {res.momPlayerName} ({res.momRating.toFixed(1)})
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#0a0f17] px-5 py-3">
            <div className="text-[11px] font-bold text-slate-400">
              {pendingConfirmNames.length > 0
                ? `확인 대기: ${pendingConfirmNames.join(', ')}`
                : '전원 확인 완료'}
            </div>
            {res && !myDoneAcked ? (
              <button
                id="mpl-h2h-result-confirm-btn"
                type="button"
                onClick={() => onAck(doneKey)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2 text-xs sm:text-sm font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                확인
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                {pendingConfirmNames.length > 0 ? '다른 감독 확인 대기 중' : '다음 단계 이동 중'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const side = sideOfMatch(match, viewIsHome);
  const barrierKeyFor = (phase: MpMatchPhase): string | null => {
    if (phase === 'halftime') return `halftime:${match.matchId}`;
    if (phase === 'extra_time_break') return `extra_time_break:${match.matchId}`;
    if (phase === 'extra_time_ht') return `extra_time_ht:${match.matchId}`;
    return null;
  };
  const currentBarrierKey = barrierKeyFor(effectivePhase);
  const submittedCurrent = Boolean(
    currentBarrierKey &&
      (submittingKey === currentBarrierKey ||
        viewRow?.tactic_submission?.barrierKey === currentBarrierKey),
  );
  const waitingLabel = !isParticipant
    ? currentBarrierKey
      ? '관전 중 · 양 팀 전술 확정 대기'
      : null
    : submittedCurrent
      ? `${oppHuman.nickname} 감독 전술 확정 대기 중...`
      : null;

  const adaptedHalftime: LiveHalftimeState = {
    ...match.liveHalftime,
    isUserHome: viewIsHome,
    userTacticAtKickoff: side.tactic,
    userFormationAtKickoff: side.formation,
    halftimeSubsMade: side.halftimeSubs.length,
    phase: effectivePhase,
  };
  const managerState: ManagerRouletteState = {
    name: viewHuman.nickname,
    avatar: viewHuman.avatar,
    traitId,
    rerollsRemaining: 0,
    hasSpun: true,
  };
  const goLocal = (phase: MpMatchPhase) => setLocalPhase({ remote: remotePhaseKey, phase });

  const homeBarrierLocked = Boolean(
    currentBarrierKey &&
      rowOf(homeHuman)?.tactic_submission?.barrierKey === currentBarrierKey,
  );
  const awayBarrierLocked = Boolean(
    currentBarrierKey &&
      rowOf(awayHuman)?.tactic_submission?.barrierKey === currentBarrierKey,
  );

  const override: LiveMatchBroadcastOverride = {
    state: {
      formation: current.formation,
      defaultTactic: current.tactic,
      starters: current.starters,
      bench: current.bench,
      manager: managerState,
      userClub: viewHuman.profile,
      season: { liveHalftime: adaptedHalftime, allPlayerStats: {} },
    },
    myTeamId: viewHuman.clubId,
    opponentRoster: viewIsHome ? match.guestStarters : match.hostStarters,
    opponentManagerOverride: {
      name: oppHuman.nickname,
      ovr: 86,
      traitId: viewIsHome ? match.guestManagerTraitId : match.hostManagerTraitId,
    },
    isSpectator: !isParticipant,
    spectatorStatus: !isParticipant
      ? {
          homeName: homeHuman.nickname,
          awayName: awayHuman.nickname,
          homeLocked: homeBarrierLocked,
          awayLocked: awayBarrierLocked,
        }
      : undefined,
    disableInstantFinish: true,
    disableLiveSub: true,
    lockSpeed: spec.speed,
    waitingForOpponentLabel: waitingLabel,
    commitButtonLabel: isParticipant ? '결과 확인 →' : '관전 종료 →',
    chemistry,
    changeFormation: (f) => {
      if (isParticipant) handleFormation(f);
    },
    optimizeHalftimeStarters: (tacticOverride) => {
      if (!isParticipant) return;
      patch({
        starters: optimizeCurrentStartersForFormation(
          current.starters,
          current.formation,
          tacticOverride ?? current.tactic,
          traitId,
        ),
      });
    },
    swapSquadPositions: (from, to) => {
      if (isParticipant) handleSwap(from, to);
    },
    enterHalftimeLocker: () => goLocal('halftime'),
    startSecondHalfBroadcast: ({ secondHalfTactic, subPlayerIds = [] }) => {
      if (!isParticipant) return;
      patch({ tactic: secondHalfTactic });
      void submitBarrier(
        'halftime',
        `halftime:${match.matchId}`,
        secondHalfTactic,
        subPlayerIds,
      );
    },
    applySecondHalfLiveSub: () => {
      // Subs are only made at the synced breaks in friend matches
    },
    enterExtraTimeBreak: () => goLocal('extra_time_break'),
    startExtraTimeBroadcast: (params) => {
      if (!isParticipant) return;
      const next = params?.etTactic ?? current.tactic;
      patch({ tactic: next });
      void submitBarrier('extra_time_break', `extra_time_break:${match.matchId}`, next);
    },
    enterEtHalftimeLocker: () => goLocal('extra_time_ht'),
    startEtSecondHalfBroadcast: (params) => {
      if (!isParticipant) return;
      const next = params?.etTactic ?? current.tactic;
      patch({ tactic: next });
      void submitBarrier('extra_time_ht', `extra_time_ht:${match.matchId}`, next);
    },
    enterPenaltyShootout: () => goLocal('penalties'),
    commitLiveMatch: () => {
      // Open the H2H Match Result Popup; doneKey is sent when the user clicks [확인]
      setClosed(true);
    },
  };

  return (
    <div className="relative">
      {spectatorBadge}
      {isParticipant && (
        <button
          id="mpl-h2h-skip-btn"
          type="button"
          disabled={mySkip}
          onClick={() => onAck(skipKey)}
          className={`fixed bottom-3 right-3 z-[70] inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-extrabold shadow-lg ${
            mySkip
              ? 'border-slate-700 bg-slate-950/95 text-slate-400'
              : oppSkip
                ? 'border-amber-400/60 bg-slate-950/95 text-amber-200 hover:bg-amber-500/15 cursor-pointer'
                : 'border-slate-700 bg-slate-950/95 text-slate-200 hover:border-slate-500 cursor-pointer'
          }`}
        >
          <FastForward className="w-3.5 h-3.5" />
          {mySkip ? '상대 스킵 동의 대기' : oppSkip ? '상대 스킵 요청 · 동의' : '스킵 요청'}
        </button>
      )}
      <LiveMatchBroadcast clubsById={clubsById} override={override} />
    </div>
  );
}

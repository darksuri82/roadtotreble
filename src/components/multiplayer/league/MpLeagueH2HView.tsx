import { Check, Eye, Loader2, Play, Swords } from 'lucide-react';
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
} from '../../../engine/mpLeagueH2H';
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
    const lockedOf = (row: MpRoomPlayerRow | null) =>
      row?.tactic_submission?.barrierKey === preKey;
    const myLocked = isParticipant && (submittingKey === preKey || lockedOf(viewRow));
    const oppLocked = lockedOf(oppRow);

    if (!isParticipant) {
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
                sub={lockedOf(rowOf(homeHuman)) ? '전술 확정' : '전술 수정 중'}
              />
              <span className="text-lg font-black text-slate-500">VS</span>
              <ManagerFace
                human={awayHuman}
                sub={lockedOf(rowOf(awayHuman)) ? '전술 확정' : '전술 수정 중'}
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
                oppLocked
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-800 bg-[#0b1018] text-slate-400'
              }`}
            >
              {oppLocked ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              )}
              {oppHuman.nickname}: {oppLocked ? '전술 확정' : '전술 수정 중'}
            </span>
            {myLocked ? (
              <div className="flex flex-wrap items-center gap-2">
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
              </div>
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
  const finished = closed || ackKeys.includes(doneKey);

  if (finished || !effectivePhase || effectivePhase === 'finished') {
    const res = match.finalResult;
    return (
      <div className="mx-auto max-w-xl px-3 py-10 sm:py-14">
        <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-5 space-y-4">
          <div className="text-center text-xs font-extrabold text-sky-300">{spec.label}</div>
          <div className="flex items-center justify-around gap-3">
            <ManagerFace human={homeHuman} />
            <div className="text-center">
              <div className="font-mono text-3xl font-black text-white tabular-nums">
                {res ? `${res.homeGoals} : ${res.awayGoals}` : '-'}
              </div>
              {res?.extraTime?.penalties && (
                <div className="text-[11px] font-bold text-amber-300 tabular-nums">
                  PK {res.extraTime.penalties.homePenGoals}–
                  {res.extraTime.penalties.awayPenGoals}
                </div>
              )}
            </div>
            <ManagerFace human={awayHuman} />
          </div>
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            결과 반영 중
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
      setClosed(true);
      if (isParticipant) onAck(doneKey);
    },
  };

  return (
    <div className="relative">
      {spectatorBadge}
      <LiveMatchBroadcast clubsById={clubsById} override={override} />
    </div>
  );
}

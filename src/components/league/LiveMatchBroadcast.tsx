import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Compass,
  FastForward,
  Lightbulb,
  Pause,
  Play,
  Radio,
  Sparkles,
  Star,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FORMATION_LIST, FORMATIONS } from '../../data/formations';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import { calculateChemistry } from '../../engine/chemistryEngine';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import {
  computePlayerStaminaPct,
  getPlayerStaminaStat,
  getStaminaPenalty,
  MAX_MATCH_SUBS,
} from '../../engine/staminaEngine';
import {
  buildHalftimeCoachRecommendations,
  evaluateFormationMatchup,
  evaluateTacticMatchup,
  TACTIC_LIST,
  TACTICS,
} from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type { Club, TacticId } from '../../types/league';
import type { Player, SubPosition } from '../../types/player';
import { ClubTag } from '../common/ClubTag';
import { JerseySvg } from '../common/JerseySvg';
import { PitchBoard } from '../common/PitchBoard';
import type { SlotRef } from '../common/PitchBoard';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import {
  DRAMATIC_REVEAL_MS,
  DRAMATIC_TOTAL_MS,
  PitchMatch2D,
} from './PitchMatch2D';
import type { DramaticHighlightPayload } from './PitchMatch2D';

interface LiveMatchBroadcastProps {
  clubsById: Record<string, Club>;
}

type BroadcastSpeed = 1 | 2 | 4;

const SPEED_MS: Record<BroadcastSpeed, number> = {
  1: 165,
  2: 85,
  4: 38,
};

function makeEventKey(
  ev: { minute: number; half: 1 | 2; type: string; teamId: string; description: string },
  idx: number,
): string {
  return `${ev.half}-${ev.minute}-${ev.type}-${ev.teamId}-${idx}`;
}

function getStaminaBarColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-400';
  if (pct >= 55) return 'bg-yellow-400';
  if (pct >= 40) return 'bg-orange-400';
  return 'bg-rose-500';
}

function getStaminaTextColor(pct: number): string {
  if (pct >= 70) return 'text-emerald-300';
  if (pct >= 55) return 'text-yellow-300';
  if (pct >= 40) return 'text-orange-300';
  return 'text-rose-400';
}

export function LiveMatchBroadcast({ clubsById }: LiveMatchBroadcastProps) {
  const {
    state,
    chemistry,
    changeFormation,
    optimizeHalftimeStarters,
    swapSquadPositions,
    enterHalftimeLocker,
    startSecondHalfBroadcast,
    applySecondHalfLiveSub,
    enterExtraTimeBreak,
    startExtraTimeBroadcast,
    enterPenaltyShootout,
    commitLiveMatch,
  } = useGame();

  const halftime = state.season?.liveHalftime ?? null;

  const [speed, setSpeed] = useState<BroadcastSpeed>(2);
  const [minute, setMinute] = useState<number>(0);
  const [selectedTactic, setSelectedTactic] = useState<TacticId>(
    halftime?.userTacticAtKickoff ?? state.defaultTactic,
  );
  const [swapPick, setSwapPick] = useState<SlotRef | null>(null);
  const [subbedInIds, setSubbedInIds] = useState<string[]>([]);
  const [pendingHtSubConfirm, setPendingHtSubConfirm] = useState<{
    from: SlotRef;
    to: SlotRef;
    outPlayer: Player;
    inPlayer: Player;
    slotLabel: string;
  } | null>(null);
  const [htNotice, setHtNotice] = useState<string | null>(null);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);

  // Live 2nd-half pause & manual PitchBoard substitution overlay state
  const [liveSubOpen, setLiveSubOpen] = useState(false);
  const [liveSubPick, setLiveSubPick] = useState<SlotRef | null>(null);
  const [draftStarters, setDraftStarters] = useState<(Player | null)[]>([]);
  const [draftBench, setDraftBench] = useState<(Player | null)[]>([]);
  const [pendingLiveSubs, setPendingLiveSubs] = useState<
    {
      outPlayerId: string;
      outPlayerName: string;
      inPlayerId: string;
      inPlayerName: string;
    }[]
  >([]);

  // Extra Time 6th sub selection & Penalty Shootout sequential reveal
  const [etSubPick, setEtSubPick] = useState<SlotRef | null>(null);
  const [selectedEtSub, setSelectedEtSub] = useState<{
    starterIndex: number;
    benchIndex: number;
  } | null>(null);
  const [revealedPenKicks, setRevealedPenKicks] = useState<number>(0);

  // Spoiler-free dramatic slow-motion state for goals, saves, and decisive chances
  const [dramaticEvent, setDramaticEvent] =
    useState<DramaticHighlightPayload | null>(null);
  const [handledHighlightKeys, setHandledHighlightKeys] = useState<string[]>(
    [],
  );

  // Snapshot 1st-half starters once per fixture so starts vs subAppearances are exact
  const firstHalfStartersRef = useRef<Player[]>([]);
  const lastFixtureIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (halftime && lastFixtureIdRef.current !== halftime.fixtureId) {
      lastFixtureIdRef.current = halftime.fixtureId;
      firstHalfStartersRef.current = state.starters.filter(
        (p): p is Player => p !== null,
      );
    }
  }, [halftime, state.starters]);

  const phase = halftime?.phase ?? null;

  // Reset clock & dramatic state when phase changes across match stages
  useEffect(() => {
    if (phase === 'first_half') {
      setMinute(0);
      setSubbedInIds([]);
      setSwapPick(null);
      setLiveSubOpen(false);
      setLiveSubPick(null);
      setPendingLiveSubs([]);
      setEtSubPick(null);
      setSelectedEtSub(null);
      setRevealedPenKicks(0);
      setDramaticEvent(null);
      setHandledHighlightKeys([]);
      if (halftime) setSelectedTactic(halftime.userTacticAtKickoff);
    } else if (phase === 'halftime') {
      setMinute(45);
      setLiveSubOpen(false);
      setDramaticEvent(null);
    } else if (phase === 'second_half') {
      setMinute(46);
      setLiveSubOpen(false);
      setLiveSubPick(null);
      setPendingLiveSubs([]);
      setDramaticEvent(null);
    } else if (phase === 'extra_time_break') {
      setMinute(90);
      setLiveSubOpen(false);
      setEtSubPick(null);
      setSelectedEtSub(null);
      setDramaticEvent(null);
    } else if (phase === 'extra_time') {
      setMinute(91);
      setDramaticEvent(null);
    } else if (phase === 'penalties') {
      setMinute(120);
      setDramaticEvent(null);
      setRevealedPenKicks(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, halftime?.fixtureId]);

  const allMatchEvents = useMemo(() => {
    if (!halftime) return [];
    if (
      (phase === 'second_half' ||
        phase === 'extra_time_break' ||
        phase === 'extra_time' ||
        phase === 'penalties') &&
      halftime.fullMatchResult
    ) {
      return halftime.fullMatchResult.events;
    }
    return halftime.firstHalfEvents;
  }, [halftime, phase]);

  const indexedEvents = useMemo(
    () =>
      allMatchEvents.map((ev, idx) => ({
        ev,
        key: makeEventKey(ev, idx),
      })),
    [allMatchEvents],
  );

  // Manage timed reveal + smooth return to normal speed during dramatic slow-motion
  useEffect(() => {
    if (!dramaticEvent) return;
    const currentKey = dramaticEvent.key;

    const revealTimer = window.setTimeout(() => {
      setDramaticEvent((prev) =>
        prev && prev.key === currentKey ? { ...prev, revealed: true } : prev,
      );
    }, DRAMATIC_REVEAL_MS);

    const endTimer = window.setTimeout(() => {
      setDramaticEvent((prev) =>
        prev && prev.key === currentKey ? null : prev,
      );
    }, DRAMATIC_TOTAL_MS);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(endTimer);
    };
    // Trigger once per distinct dramatic highlight key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dramaticEvent?.key]);

  // Progressive match clock ticker (1st half 0'->45', 2nd half 46'->90', Extra Time 91'->120')
  useEffect(() => {
    if (!halftime) return;
    if (
      phase !== 'first_half' &&
      phase !== 'second_half' &&
      phase !== 'extra_time'
    ) {
      return;
    }
    if (dramaticEvent || liveSubOpen) return;

    const targetEnd =
      phase === 'first_half' ? 45 : phase === 'second_half' ? 90 : 120;

    // Check if there is an unhandled highlight event at the current minute first
    const unhandledNow = indexedEvents.find(
      ({ ev, key }) =>
        ev.minute === minute &&
        !(phase === 'first_half' && ev.half === 2) &&
        (ev.type === 'goal' ||
          ev.type === 'save' ||
          ev.type === 'chance' ||
          ev.type === 'var_offside') &&
        !handledHighlightKeys.includes(key),
    );
    if (unhandledNow) {
      const triggerTimer = window.setTimeout(() => {
        setHandledHighlightKeys((prev) => [...prev, unhandledNow.key]);
        setDramaticEvent({
          key: unhandledNow.key,
          event: unhandledNow.ev,
          revealed: false,
        });
      }, 40);
      return () => window.clearTimeout(triggerTimer);
    }

    if (minute >= targetEnd) {
      if (phase === 'first_half') {
        const pauseTimer = window.setTimeout(() => {
          enterHalftimeLocker();
        }, 420);
        return () => window.clearTimeout(pauseTimer);
      }
      if (
        phase === 'second_half' &&
        halftime.isKnockoutDecider &&
        halftime.fullMatchResult
      ) {
        const h90 =
          halftime.fullMatchResult.homeGoals90 ??
          halftime.fullMatchResult.homeGoals;
        const a90 =
          halftime.fullMatchResult.awayGoals90 ??
          halftime.fullMatchResult.awayGoals;
        const aggH = (halftime.aggHomeBeforeMatch ?? 0) + h90;
        const aggA = (halftime.aggAwayBeforeMatch ?? 0) + a90;
        if (aggH === aggA) {
          const etTimer = window.setTimeout(() => {
            enterExtraTimeBreak();
          }, 520);
          return () => window.clearTimeout(etTimer);
        }
      }
      if (
        phase === 'extra_time' &&
        halftime.fullMatchResult?.extraTime?.penalties
      ) {
        const pkTimer = window.setTimeout(() => {
          enterPenaltyShootout();
        }, 560);
        return () => window.clearTimeout(pkTimer);
      }
      return;
    }

    const tickDelay =
      phase === 'extra_time' ? Math.max(55, SPEED_MS[speed] * 0.9) : SPEED_MS[speed];
    const timer = window.setTimeout(() => {
      const nextMin = Math.min(targetEnd, minute + 1);
      const nextHighlight = indexedEvents.find(
        ({ ev, key }) =>
          ev.minute === nextMin &&
          !(phase === 'first_half' && ev.half === 2) &&
          (ev.type === 'goal' ||
            ev.type === 'save' ||
            ev.type === 'chance' ||
            ev.type === 'var_offside') &&
          !handledHighlightKeys.includes(key),
      );
      setMinute(nextMin);
      if (nextHighlight) {
        setHandledHighlightKeys((prev) => [...prev, nextHighlight.key]);
        setDramaticEvent({
          key: nextHighlight.key,
          event: nextHighlight.ev,
          revealed: false,
        });
      }
    }, tickDelay);

    return () => window.clearTimeout(timer);
  }, [
    halftime,
    phase,
    minute,
    speed,
    dramaticEvent,
    liveSubOpen,
    indexedEvents,
    handledHighlightKeys,
    enterHalftimeLocker,
    enterExtraTimeBreak,
    enterPenaltyShootout,
  ]);

  // Sequential Penalty Shootout kicker reveal ticker
  const totalPenKicks =
    halftime?.fullMatchResult?.extraTime?.penalties?.kicks.length ?? 0;
  useEffect(() => {
    if (phase !== 'penalties' || totalPenKicks === 0) return;
    if (revealedPenKicks >= totalPenKicks) return;
    const timer = window.setTimeout(() => {
      setRevealedPenKicks((c) => Math.min(totalPenKicks, c + 1));
    }, 680);
    return () => window.clearTimeout(timer);
  }, [phase, revealedPenKicks, totalPenKicks]);

  // Visible events exclude any currently unrevealed slow-motion highlight (zero spoilers!)
  const visibleEvents = useMemo(
    () =>
      indexedEvents
        .filter(({ ev, key }) => {
          if (phase === 'first_half' && ev.half === 2) return false;
          if (ev.minute > minute) return false;
          if (
            ev.minute === minute &&
            (ev.type === 'goal' ||
              ev.type === 'save' ||
              ev.type === 'chance' ||
              ev.type === 'var_offside')
          ) {
            if (dramaticEvent && dramaticEvent.key === key && !dramaticEvent.revealed) {
              return false;
            }
            if (!handledHighlightKeys.includes(key)) {
              return false;
            }
          }
          return true;
        })
        .map(({ ev }) => ev),
    [indexedEvents, phase, minute, dramaticEvent, handledHighlightKeys],
  );

  if (!halftime) return null;

  const home = clubsById[halftime.homeTeamId];
  const away = clubsById[halftime.awayTeamId];
  if (!home || !away) return null;

  const fullResult = halftime.fullMatchResult;
  const needsExtraTimeAt90 = Boolean(
    halftime.isKnockoutDecider &&
      fullResult &&
      (halftime.aggHomeBeforeMatch ?? 0) +
        (fullResult.homeGoals90 ?? fullResult.homeGoals) ===
        (halftime.aggAwayBeforeMatch ?? 0) +
          (fullResult.awayGoals90 ?? fullResult.awayGoals),
  );
  const penaltiesData = fullResult?.extraTime?.penalties ?? null;
  const isPenaltiesDone =
    phase === 'penalties' &&
    penaltiesData !== null &&
    revealedPenKicks >= penaltiesData.kicks.length;
  const isExtraTimeDone =
    phase === 'extra_time' &&
    minute >= 120 &&
    !dramaticEvent &&
    !penaltiesData;
  const isSecondHalfDone =
    (phase === 'second_half' &&
      minute >= 90 &&
      !dramaticEvent &&
      !needsExtraTimeAt90) ||
    isExtraTimeDone ||
    isPenaltiesDone;

  // Live Score derived strictly from revealed goal events up to current clock minute
  const liveHomeGoals = visibleEvents.filter(
    (e) => e.type === 'goal' && e.teamId === home.id,
  ).length;
  const liveAwayGoals = visibleEvents.filter(
    (e) => e.type === 'goal' && e.teamId === away.id,
  ).length;

  // Progressive stats interpolation matching exact HT (45') and FT (90') totals
  const computeLiveMetric = (htVal: number, ftVal: number): number => {
    if (phase === 'first_half') {
      return htVal * Math.min(1, minute / 45);
    }
    if (phase === 'halftime') {
      return htVal;
    }
    const secondProgress = Math.max(0, Math.min(1, (minute - 45) / 45));
    return htVal + (ftVal - htVal) * secondProgress;
  };

  const liveHomeXg = computeLiveMetric(
    halftime.homeXg,
    fullResult?.homeXg ?? halftime.homeXg,
  );
  const liveAwayXg = computeLiveMetric(
    halftime.awayXg,
    fullResult?.awayXg ?? halftime.awayXg,
  );
  const liveHomeShots = Math.max(
    liveHomeGoals,
    Math.round(
      computeLiveMetric(
        halftime.homeShots,
        fullResult?.homeShots ?? halftime.homeShots,
      ),
    ),
  );
  const liveAwayShots = Math.max(
    liveAwayGoals,
    Math.round(
      computeLiveMetric(
        halftime.awayShots,
        fullResult?.awayShots ?? halftime.awayShots,
      ),
    ),
  );
  const liveHomeSot = Math.min(
    liveHomeShots,
    Math.max(
      liveHomeGoals,
      Math.round(
        computeLiveMetric(
          halftime.homeShotsOnTarget,
          fullResult?.homeShotsOnTarget ?? halftime.homeShotsOnTarget,
        ),
      ),
    ),
  );
  const liveAwaySot = Math.min(
    liveAwayShots,
    Math.max(
      liveAwayGoals,
      Math.round(
        computeLiveMetric(
          halftime.awayShotsOnTarget,
          fullResult?.awayShotsOnTarget ?? halftime.awayShotsOnTarget,
        ),
      ),
    ),
  );

  const targetPoss =
    phase === 'second_half' && fullResult
      ? fullResult.homePossession
      : halftime.homePossession;
  const liveHomePoss =
    minute === 0
      ? 50
      : Math.round(
          50 +
            (targetPoss - 50) * Math.min(1, minute / 20) +
            (phase === 'halftime' || isSecondHalfDone
              ? 0
              : Math.sin(minute * 0.45) * 1.5),
        );

  const oppTactic = halftime.isUserHome ? halftime.awayTactic : halftime.homeTactic;
  const oppFormation = halftime.isUserHome
    ? halftime.awayFormation
    : halftime.homeFormation;
  const tacticMatch = evaluateTacticMatchup(selectedTactic, oppTactic);
  const formMatch = evaluateFormationMatchup(state.formation, oppFormation);
  const isWizard = state.manager.traitId === 'halftime_wizard';
  const activeTrait = state.manager.traitId
    ? MANAGER_TRAITS[state.manager.traitId]
    : null;

  const liveHomeFormation = fullResult?.homeFormation ?? halftime.homeFormation;
  const liveAwayFormation = fullResult?.awayFormation ?? halftime.awayFormation;

  const userActiveTactic: TacticId =
    phase === 'first_half'
      ? halftime.userTacticAtKickoff
      : phase === 'halftime'
        ? selectedTactic
        : halftime.isUserHome
          ? fullResult?.homeTactic ?? selectedTactic
          : fullResult?.awayTactic ?? selectedTactic;

  const formationSlots = (FORMATIONS[state.formation] ?? FORMATIONS['4-3-3']).slots;

  // Compute live stamina % for each of the 11 user starters at current clock minute
  const enteredAtMap = new Map<string, number>();
  for (const id of subbedInIds) enteredAtMap.set(id, 45);
  for (const rec of halftime.liveSubs ?? []) {
    enteredAtMap.set(rec.inPlayerId, rec.minute);
  }
  const subbedOutIdSet = new Set(
    (halftime.liveSubs ?? []).map((r) => r.outPlayerId),
  );

  const starterStaminaRows = state.starters.map((player, idx) => {
    const slot = formationSlots[idx];
    if (!player) {
      return {
        index: idx,
        slotLabel: slot?.label ?? `S${idx + 1}`,
        subPosition: slot?.subPosition ?? ('CM' as SubPosition),
        player: null as Player | null,
        staminaPct: 100,
        penalty: getStaminaPenalty(100),
        isFreshSub: false,
      };
    }
    const enterMin = enteredAtMap.get(player.id) ?? 0;
    const minsOnPitch = Math.max(0, minute - enterMin);
    const staminaPct = computePlayerStaminaPct({
      staminaStat: getPlayerStaminaStat(player),
      subPosition: slot?.subPosition ?? 'CM',
      tactic: userActiveTactic,
      minutesPlayed: minsOnPitch,
    });
    return {
      index: idx,
      slotLabel: slot?.label ?? `S${idx + 1}`,
      subPosition: slot?.subPosition ?? ('CM' as SubPosition),
      player,
      staminaPct,
      penalty: getStaminaPenalty(staminaPct),
      isFreshSub: enterMin >= 45,
    };
  });

  const staminaByPlayerId: Record<string, number> = {};
  for (const row of starterStaminaRows) {
    if (row.player) staminaByPlayerId[row.player.id] = row.staminaPct;
  }
  for (const bp of state.bench) {
    if (!bp) continue;
    if (subbedOutIdSet.has(bp.id)) {
      const rec = (halftime.liveSubs ?? []).find((r) => r.outPlayerId === bp.id);
      const subMin = rec?.minute ?? 45;
      staminaByPlayerId[bp.id] = computePlayerStaminaPct({
        staminaStat: getPlayerStaminaStat(bp),
        subPosition: formationSlots[rec?.slotIndex ?? 5]?.subPosition ?? 'CM',
        tactic: userActiveTactic,
        minutesPlayed: subMin,
      });
    } else {
      staminaByPlayerId[bp.id] = 100;
    }
  }

  const subsUsed = halftime.halftimeSubsMade;
  const subsRemaining = Math.max(0, MAX_MATCH_SUBS - subsUsed);

  const coachRecommendations =
    phase === 'halftime' && subsRemaining > 0
      ? buildHalftimeCoachRecommendations({
          starters: state.starters,
          bench: state.bench,
          formation: state.formation,
          oppTactic,
          userGoals: halftime.isUserHome ? halftime.homeGoals : halftime.awayGoals,
          oppGoals: halftime.isUserHome ? halftime.awayGoals : halftime.homeGoals,
          staminaByPlayerId,
          firstHalfEvents: halftime.firstHalfEvents,
          disabledBenchIds: subbedOutIdSet,
          managerTraitId: state.manager.traitId,
          maxRecommendations: 2,
        })
      : [];

  const performHalftimeSwap = (from: SlotRef, to: SlotRef) => {
    if (from.area === 'bench' && to.area === 'bench') return;

    const isBenchSub = from.area !== to.area;
    if (!isBenchSub) {
      // Starter <-> Starter free positional swap (zero substitution count used)
      const pA = state.starters[from.index];
      const pB = state.starters[to.index];
      if (!pA || !pB) return;
      swapSquadPositions(from, to);
      setHtNotice(
        `선발 위치 변경: ${pA.name} ↔ ${pB.name} (교체 횟수 차감 없음)`,
      );
      return;
    }

    if (subsUsed >= MAX_MATCH_SUBS) return;
    const starterIdx = from.area === 'starter' ? from.index : to.index;
    const benchIdx = from.area === 'bench' ? from.index : to.index;
    const outPlayer = state.starters[starterIdx];
    const inPlayer = state.bench[benchIdx];
    if (!outPlayer || !inPlayer || subbedOutIdSet.has(inPlayer.id)) return;

    const slotLabel = formationSlots[starterIdx]?.label ?? `#${starterIdx + 1}`;
    setPendingHtSubConfirm({
      from: { area: 'starter', index: starterIdx },
      to: { area: 'bench', index: benchIdx },
      outPlayer,
      inPlayer,
      slotLabel,
    });
  };

  const confirmPendingHalftimeSub = () => {
    if (!pendingHtSubConfirm) return;
    const { from, to, outPlayer, inPlayer } = pendingHtSubConfirm;
    if (subsUsed >= MAX_MATCH_SUBS) {
      setPendingHtSubConfirm(null);
      return;
    }
    if (!subbedInIds.includes(inPlayer.id)) {
      setSubbedInIds((prev) => [...prev, inPlayer.id]);
    }
    swapSquadPositions(from, to);
    setHtNotice(`교체 완료: OUT ${outPlayer.name} → IN ${inPlayer.name}`);
    setPendingHtSubConfirm(null);
  };

  const handleApplyCoachRecommendation = (
    starterIndex: number,
    benchIndex: number,
  ) => {
    if (subsUsed >= MAX_MATCH_SUBS) return;
    const outPlayer = state.starters[starterIndex];
    const inPlayer = state.bench[benchIndex];
    if (!outPlayer || !inPlayer || subbedOutIdSet.has(inPlayer.id)) return;
    const slotLabel = formationSlots[starterIndex]?.label ?? `#${starterIndex + 1}`;
    setPendingHtSubConfirm({
      from: { area: 'starter', index: starterIndex },
      to: { area: 'bench', index: benchIndex },
      outPlayer,
      inPlayer,
      slotLabel,
    });
  };

  const handleHalftimeQuickBestXi = () => {
    setSwapPick(null);
    optimizeHalftimeStarters(selectedTactic);
    setHtNotice(
      `현재 선발 11명을 ${state.formation} 최적 포지션으로 자동 재배치했습니다.`,
    );
  };

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clicked =
      area === 'starter' ? state.starters[index] : state.bench[index];
    if (!clicked) return;
    if (area === 'bench' && subbedOutIdSet.has(clicked.id)) return;

    if (!swapPick) {
      setSwapPick({ area, index });
      return;
    }
    if (swapPick.area === area && swapPick.index === index) {
      setSwapPick(null);
      return;
    }
    performHalftimeSwap(swapPick, { area, index });
    setSwapPick(null);
  };

  const handleInstantFinish = () => {
    setDramaticEvent(null);
    setLiveSubOpen(false);
    setPendingHtSubConfirm(null);
    if (phase === 'second_half') {
      setMinute(90);
      commitLiveMatch();
    } else {
      commitLiveMatch(selectedTactic);
    }
  };

  const handleStartSecondHalf = () => {
    setPendingHtSubConfirm(null);
    setHtNotice(null);
    startSecondHalfBroadcast({
      secondHalfTactic: selectedTactic,
      subPlayerIds: subbedInIds,
      firstHalfStarters: firstHalfStartersRef.current,
    });
  };

  const handleOpenLiveSub = () => {
    if (phase !== 'second_half' || isSecondHalfDone) return;
    setDramaticEvent(null);
    setPendingLiveSubs([]);
    setLiveSubPick(null);
    setDraftStarters([...state.starters]);
    setDraftBench([...state.bench]);
    setLiveSubOpen(true);
  };

  // Disabled bench IDs inside the 2nd-half pause preview (already subbed off earlier OR in current draft queue)
  const draftDisabledBenchIds = new Set<string>(subbedOutIdSet);
  for (const s of pendingLiveSubs) {
    draftDisabledBenchIds.add(s.outPlayerId);
  }

  const hasDraftLineupChanges =
    liveSubOpen &&
    draftStarters.some((p, idx) => p?.id !== state.starters[idx]?.id);

  const performDraftLiveSubSwap = (from: SlotRef, to: SlotRef) => {
    if (from.area === to.area && from.index === to.index) return;

    // 1) Starter <-> Starter free positional swap (zero substitution count used!)
    if (from.area === 'starter' && to.area === 'starter') {
      const pA = draftStarters[from.index];
      const pB = draftStarters[to.index];
      if (!pA || !pB) return;
      const nextS = [...draftStarters];
      nextS[from.index] = pB;
      nextS[to.index] = pA;
      setDraftStarters(nextS);
      return;
    }

    // 2) Ignore bench <-> bench swaps
    if (from.area === 'bench' && to.area === 'bench') return;

    // 3) Starter <-> Bench substitution
    const starterIdx = from.area === 'starter' ? from.index : to.index;
    const benchIdx = from.area === 'bench' ? from.index : to.index;
    const outP = draftStarters[starterIdx];
    const inP = draftBench[benchIdx];
    if (!outP || !inP) return;
    if (draftDisabledBenchIds.has(inP.id)) return;
    if (pendingLiveSubs.length >= subsRemaining) return;
    // Prevent chaining a second bench sub onto a player just brought in during this same pause
    if (pendingLiveSubs.some((s) => s.inPlayerId === outP.id)) return;

    const nextS = [...draftStarters];
    const nextB = [...draftBench];
    nextS[starterIdx] = inP;
    nextB[benchIdx] = outP;
    setDraftStarters(nextS);
    setDraftBench(nextB);
    setPendingLiveSubs((prev) => [
      ...prev,
      {
        outPlayerId: outP.id,
        outPlayerName: outP.name,
        inPlayerId: inP.id,
        inPlayerName: inP.name,
      },
    ]);
  };

  const handleDraftSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clicked =
      area === 'starter' ? draftStarters[index] : draftBench[index];
    if (!clicked) return;
    if (area === 'bench' && draftDisabledBenchIds.has(clicked.id)) return;

    if (!liveSubPick) {
      setLiveSubPick({ area, index });
      return;
    }
    if (liveSubPick.area === area && liveSubPick.index === index) {
      setLiveSubPick(null);
      return;
    }
    if (liveSubPick.area === 'bench' && area === 'bench') {
      // Clicking another bench player switches selection cleanly
      setLiveSubPick({ area, index });
      return;
    }
    // Starter <-> Starter OR Starter <-> Bench executes immediately in draft preview
    performDraftLiveSubSwap(liveSubPick, { area, index });
    setLiveSubPick(null);
  };

  const handleRemovePendingSub = (idxToRemove: number) => {
    const target = pendingLiveSubs[idxToRemove];
    if (!target) return;
    const nextS = [...draftStarters];
    const nextB = [...draftBench];
    const inIdx = nextS.findIndex((p) => p?.id === target.inPlayerId);
    const outIdx = nextB.findIndex((p) => p?.id === target.outPlayerId);
    if (inIdx >= 0 && outIdx >= 0) {
      const tmp = nextS[inIdx];
      nextS[inIdx] = nextB[outIdx];
      nextB[outIdx] = tmp;
    }
    setDraftStarters(nextS);
    setDraftBench(nextB);
    setPendingLiveSubs((prev) => prev.filter((_, i) => i !== idxToRemove));
    setLiveSubPick(null);
  };

  const handleConfirmLiveSubs = () => {
    if (pendingLiveSubs.length === 0 && !hasDraftLineupChanges) {
      setLiveSubOpen(false);
      return;
    }
    const newInIds = pendingLiveSubs.map((s) => s.inPlayerId);
    if (newInIds.length > 0) {
      setSubbedInIds((prev) => Array.from(new Set([...prev, ...newInIds])));
    }

    applySecondHalfLiveSub({
      minute,
      subs: pendingLiveSubs.map((s) => ({
        outPlayerId: s.outPlayerId,
        inPlayerId: s.inPlayerId,
      })),
      nextStarters: draftStarters,
      nextBench: draftBench,
      firstHalfStarters: firstHalfStartersRef.current,
      halftimeSubIds: subbedInIds,
    });
    setPendingLiveSubs([]);
    setLiveSubPick(null);
    setLiveSubOpen(false);
  };

  const draftChemistry = liveSubOpen
    ? calculateChemistry(
        state.formation,
        draftStarters,
        userActiveTactic,
        state.manager.traitId,
      )
    : chemistry;

  const allStats = state.season?.allPlayerStats ?? {};
  const competitionTitle =
    halftime.competitionLabel || `ROUND ${halftime.round}`;
  const isTwoLegSecond =
    halftime.aggHomeBeforeMatch !== undefined &&
    halftime.aggAwayBeforeMatch !== undefined;
  const liveAggHome = (halftime.aggHomeBeforeMatch ?? 0) + liveHomeGoals;
  const liveAggAway = (halftime.aggAwayBeforeMatch ?? 0) + liveAwayGoals;

  const canMakeEtExtraSub = subsUsed < MAX_MATCH_SUBS + 1;

  const handleEtSlotClick = (area: 'starter' | 'bench', index: number) => {
    if (!canMakeEtExtraSub) return;
    const clicked =
      area === 'starter' ? state.starters[index] : state.bench[index];
    if (!clicked) return;
    if (area === 'bench' && subbedOutIdSet.has(clicked.id)) return;

    if (!etSubPick) {
      setEtSubPick({ area, index });
      return;
    }
    if (etSubPick.area === area && etSubPick.index === index) {
      setEtSubPick(null);
      return;
    }
    if (etSubPick.area === area) {
      setEtSubPick({ area, index });
      return;
    }
    const starterIndex = etSubPick.area === 'starter' ? etSubPick.index : index;
    const benchIndex = etSubPick.area === 'bench' ? etSubPick.index : index;
    setSelectedEtSub({ starterIndex, benchIndex });
    setEtSubPick(null);
  };

  const handleStartExtraTime = () => {
    startExtraTimeBroadcast({
      extraSub: selectedEtSub ?? undefined,
      firstHalfStarters: firstHalfStartersRef.current,
      halftimeSubIds: subbedInIds,
    });
  };

  const pitchPhase: 'first_half' | 'halftime' | 'second_half' =
    phase === 'first_half'
      ? 'first_half'
      : phase === 'halftime'
        ? 'halftime'
        : 'second_half';

  const revealedKicks = penaltiesData
    ? penaltiesData.kicks.slice(0, revealedPenKicks)
    : [];
  const homePenKicks = revealedKicks.filter((k) => k.teamId === home.id);
  const awayPenKicks = revealedKicks.filter((k) => k.teamId === away.id);
  const livePenHomeScore =
    revealedKicks[revealedKicks.length - 1]?.homeScoreAfter ?? 0;
  const livePenAwayScore =
    revealedKicks[revealedKicks.length - 1]?.awayScoreAfter ?? 0;
  const latestPenKick = revealedKicks[revealedKicks.length - 1] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 p-2 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f1621] shadow-2xl">
        {/* Top Broadcast Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0a0f17] px-3.5 sm:px-5 py-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-black tracking-wide ${
                phase === 'halftime' || phase === 'extra_time_break'
                  ? 'bg-amber-400 text-slate-950'
                  : phase === 'penalties'
                    ? 'bg-purple-400 text-slate-950'
                    : liveSubOpen
                      ? 'bg-sky-400 text-slate-950'
                      : isSecondHalfDone
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-rose-500 text-white'
              }`}
            >
              {phase === 'halftime' ? (
                'HALF TIME'
              ) : phase === 'extra_time_break' ? (
                'EXTRA TIME'
              ) : phase === 'penalties' ? (
                'PENALTIES'
              ) : liveSubOpen ? (
                <>
                  <Pause className="w-3 h-3" />
                  PAUSED
                </>
              ) : isSecondHalfDone ? (
                'FULL TIME'
              ) : (
                <>
                  <Radio className="w-3 h-3 animate-pulse" />
                  LIVE
                </>
              )}
            </span>
            <span className="font-display text-sm font-bold text-white tabular-nums">
              {competitionTitle} · {minute}&apos;
            </span>
            {dramaticEvent && !dramaticEvent.revealed && (
              <span className="rounded bg-amber-400/20 border border-amber-400/50 px-2 py-0.5 text-[10px] font-black text-amber-300 animate-pulse">
                SLOW-MO · 결정적 찬스
              </span>
            )}
          </div>

          {/* Speed Controls + Live Sub + Instant Finish */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(phase === 'first_half' ||
              phase === 'second_half' ||
              phase === 'extra_time') &&
              !isSecondHalfDone && (
                <div className="flex items-center rounded-lg border border-slate-800 bg-[#111822] p-0.5 text-[11px]">
                  {([1, 2, 4] as BroadcastSpeed[]).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSpeed(spd)}
                      className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                        speed === spd
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              )}

            {phase === 'second_half' && !isSecondHalfDone && (
              <button
                type="button"
                onClick={handleOpenLiveSub}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/60 bg-sky-500/15 px-2.5 py-1.5 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                {subsRemaining > 0
                  ? `선수 교체 · 위치 (${subsUsed}/${MAX_MATCH_SUBS})`
                  : `포지션 변경 (${subsUsed}/${MAX_MATCH_SUBS})`}
              </button>
            )}

            {phase === 'first_half' && (
              <button
                type="button"
                onClick={() => {
                  setDramaticEvent(null);
                  setMinute(45);
                  enterHalftimeLocker();
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
              >
                하프타임으로
              </button>
            )}

            {phase === 'penalties' && !isPenaltiesDone && penaltiesData && (
              <button
                type="button"
                onClick={() => setRevealedPenKicks(penaltiesData.kicks.length)}
                className="rounded-lg border border-purple-400/50 bg-purple-500/15 px-2.5 py-1.5 text-xs font-bold text-purple-200 hover:bg-purple-500/25 cursor-pointer"
              >
                승부차기 결과 바로 보기
              </button>
            )}

            {!isSecondHalfDone && phase !== 'penalties' && (
              <button
                id="instant-match-result-btn"
                type="button"
                onClick={handleInstantFinish}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-emerald-400/60 hover:text-emerald-300 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                즉시 결과 보기
              </button>
            )}

            {isSecondHalfDone && (
              <button
                id="commit-live-match-btn"
                type="button"
                onClick={() => commitLiveMatch()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                경기 종료 · 결과 확정 →
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-3 sm:p-4 space-y-3">
          {/* Compact Live Scoreboard & Stats Strip */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] px-3.5 py-2.5 space-y-2">
            <div className="grid grid-cols-3 items-center text-center gap-2">
              <div className="flex items-center justify-end gap-2.5 text-right">
                <div className="min-w-0">
                  <div
                    className={`truncate text-xs sm:text-sm font-bold ${
                      home.isUser ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {home.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {liveHomeFormation} ·{' '}
                    {TACTICS[fullResult?.homeTactic ?? halftime.homeTactic].shortName}
                  </div>
                </div>
                <JerseySvg
                  primaryColor={home.primaryColor}
                  secondaryColor={home.secondaryColor}
                  pattern={home.pattern}
                  label={home.shortName}
                  size={34}
                />
              </div>

              <div className="flex flex-col items-center">
                <div className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-white tabular-nums leading-none">
                  {liveHomeGoals} <span className="text-slate-600">:</span>{' '}
                  {liveAwayGoals}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="font-display text-xs font-bold text-emerald-400 tabular-nums">
                    {phase === 'halftime'
                      ? "45' HT"
                      : phase === 'extra_time_break'
                        ? "90' 연장 대기"
                        : phase === 'penalties'
                          ? isPenaltiesDone
                            ? 'PK 종료'
                            : '승부차기 진행 중'
                          : isSecondHalfDone
                            ? minute > 90
                              ? "120' AET"
                              : "90' FT"
                            : `${minute}'`}
                  </span>
                  {isTwoLegSecond && (
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 tabular-nums">
                      합산 {liveAggHome}:{liveAggAway}
                    </span>
                  )}
                  {phase === 'penalties' && (
                    <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-black text-purple-200 tabular-nums">
                      PK {livePenHomeScore}:{livePenAwayScore}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-start gap-2.5 text-left">
                <JerseySvg
                  primaryColor={away.primaryColor}
                  secondaryColor={away.secondaryColor}
                  pattern={away.pattern}
                  label={away.shortName}
                  size={34}
                />
                <div className="min-w-0">
                  <div
                    className={`truncate text-xs sm:text-sm font-bold ${
                      away.isUser ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {away.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {liveAwayFormation} ·{' '}
                    {TACTICS[fullResult?.awayTactic ?? halftime.awayTactic].shortName}
                  </div>
                </div>
              </div>
            </div>

            {/* Match Clock Progress Bar */}
            <div className="relative h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  minute > 90 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, (minute / (minute > 90 ? 120 : 90)) * 100)}%`,
                }}
              />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />
            </div>

            {/* Compact Live Match Stats */}
            <div className="grid grid-cols-4 gap-1.5 text-center tabular-nums">
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#111822] px-2 py-1">
                <span className="text-[10px] text-slate-500">점유율</span>
                <span className="font-display text-xs font-bold text-white">
                  {liveHomePoss}% : {100 - liveHomePoss}%
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#111822] px-2 py-1">
                <span className="text-[10px] text-slate-500">xG</span>
                <span className="font-display text-xs font-bold text-emerald-300">
                  {liveHomeXg.toFixed(2)} : {liveAwayXg.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#111822] px-2 py-1">
                <span className="text-[10px] text-slate-500">슈팅</span>
                <span className="font-display text-xs font-bold text-white">
                  {liveHomeShots} : {liveAwayShots}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#111822] px-2 py-1">
                <span className="text-[10px] text-slate-500">유효슈팅</span>
                <span className="font-display text-xs font-bold text-sky-300">
                  {liveHomeSot} : {liveAwaySot}
                </span>
              </div>
            </div>
          </div>

          {/* EXTRA TIME BREAK PANEL (90' Draw in Knockout Decider — 1 Extra Sub Allowed!) */}
          {phase === 'extra_time_break' && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-950/15 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-amber-300">
                    ⏱️ 90분 종료 동점! 연장전 (30분) 돌입
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-300">
                    현재 체력 소모가 그대로 이어지며, 연장전 특별 규정으로{' '}
                    <strong className="text-sky-300">추가 교체 1장 (최대 6명)</strong>이 허용됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartExtraTime}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg hover:bg-amber-300 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {selectedEtSub ? '교체 적용 후 연장전 킥오프 →' : '연장전 (91\'~120\') 킥오프 →'}
                </button>
              </div>

              {canMakeEtExtraSub && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-200">
                      연장전 추가 교체 선택 (선택 사항 · 선발 ↔ 벤치 클릭)
                    </span>
                    {selectedEtSub && (
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-sky-500/20 px-2.5 py-1 font-bold text-sky-200">
                          예약: OUT {state.starters[selectedEtSub.starterIndex]?.name} → IN{' '}
                          {state.bench[selectedEtSub.benchIndex]?.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedEtSub(null)}
                          className="text-slate-400 hover:text-white underline"
                        >
                          취소
                        </button>
                      </div>
                    )}
                  </div>
                  <PitchBoard
                    formation={state.formation}
                    starters={state.starters}
                    bench={state.bench}
                    chemistry={chemistry}
                    managerTraitId={state.manager.traitId}
                    selectedSlot={etSubPick}
                    onSlotClick={handleEtSlotClick}
                    onInspectPlayer={(player, slotSubPosition) =>
                      setInspected({ player, slotSubPosition })
                    }
                    staminaByPlayerId={staminaByPlayerId}
                    disabledBenchIds={subbedOutIdSet}
                    compact
                  />
                </div>
              )}
            </div>
          )}

          {/* PENALTY SHOOTOUT INTERACTIVE PANEL */}
          {phase === 'penalties' && penaltiesData && (
            <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-950/30 via-[#0b1018] to-[#0b1018] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-purple-200">
                    🎯 운명의 승부차기 (Penalty Shootout)
                  </h3>
                  <p className="text-xs text-slate-400">
                    키커의 결정력과 골키퍼 선방 능력에 따라 매 킥의 승부가 갈립니다.
                  </p>
                </div>
                {isPenaltiesDone && (
                  <div className="rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-3.5 py-1.5 text-sm font-black text-emerald-300">
                    🏆{' '}
                    {penaltiesData.winnerTeamId === home.id
                      ? home.name
                      : away.name}{' '}
                    승부차기 승리 ({penaltiesData.homePenGoals} -{' '}
                    {penaltiesData.awayPenGoals})!
                  </div>
                )}
              </div>

              {/* Team-by-team Kick Circles */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { club: home, kicks: homePenKicks, score: livePenHomeScore },
                  { club: away, kicks: awayPenKicks, score: livePenAwayScore },
                ].map(({ club, kicks, score }) => (
                  <div
                    key={club.id}
                    className={`rounded-xl border p-3.5 ${
                      club.isUser
                        ? 'border-emerald-500/50 bg-emerald-950/20'
                        : 'border-slate-800 bg-slate-900/70'
                    }`}
                  >
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-white">
                        {club.name}
                      </span>
                      <span className="font-display text-2xl font-black text-white tabular-nums">
                        {score}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(
                        { length: Math.max(5, kicks.length) },
                        (_, idx) => {
                          const k = kicks[idx];
                          if (!k) {
                            return (
                              <div
                                key={`${club.id}-slot-${idx}`}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-xs font-bold text-slate-600"
                              >
                                {idx + 1}
                              </div>
                            );
                          }
                          return (
                            <div
                              key={`${club.id}-kick-${idx}`}
                              title={`${k.round}번 키커 ${k.kickerName}: ${k.scored ? '성공' : '실축'}`}
                              className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black shadow ${
                                k.scored
                                  ? 'border-emerald-400 bg-emerald-500/25 text-emerald-300'
                                  : 'border-rose-400 bg-rose-500/25 text-rose-300'
                              }`}
                            >
                              {k.scored ? '⚽' : '❌'}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Latest Kicker Broadcast Ticker */}
              {latestPenKick && (
                <div
                  className={`rounded-xl border px-4 py-3 text-center text-sm font-bold ${
                    latestPenKick.scored
                      ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                      : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                  }`}
                >
                  [{latestPenKick.round}라운드 · {latestPenKick.teamShortName}]{' '}
                  <span className="text-white">{latestPenKick.kickerName}</span> —{' '}
                  {latestPenKick.scored
                    ? '⚽ 침착하게 골망을 흔듭니다!'
                    : '❌ 실축! 골키퍼가 막아냅니다!'}
                </div>
              )}

              {/* Scrollable Kick Log */}
              <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs space-y-1">
                {[...revealedKicks].reverse().map((k, idx) => (
                  <div
                    key={`pk-log-${k.round}-${k.teamId}-${idx}`}
                    className="flex items-center justify-between border-b border-slate-800/50 pb-1 last:border-0"
                  >
                    <span className="text-slate-300">
                      <span className="font-mono text-slate-500 mr-1.5">
                        #{k.round}
                      </span>
                      <span className="font-bold text-slate-200">
                        [{k.teamShortName}] {k.kickerName}
                      </span>
                    </span>
                    <span
                      className={`font-bold ${
                        k.scored ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {k.scored ? '⚽ 성공' : '❌ 실축'} ({k.homeScoreAfter}-
                      {k.awayScoreAfter})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FULL-TIME MOM BANNER */}
          {isSecondHalfDone && fullResult && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/35 bg-amber-950/20 px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs">
                <Star className="w-4 h-4 text-amber-300 fill-current" />
                <span className="font-bold text-amber-200">
                  경기 최우수 선수 (MOM): {fullResult.momPlayerName} ({fullResult.momRating.toFixed(1)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => commitLiveMatch()}
                className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                라운드 결과 확정 →
              </button>
            </div>
          )}

          {/* LIVE 2-COLUMN DESKTOP LAYOUT: Left (2D Pitch + Stamina) / Right (Live Commentary) */}
          {(phase === 'first_half' ||
            phase === 'second_half' ||
            phase === 'extra_time') && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-start">
              <div className="lg:col-span-8 space-y-2.5">
                <PitchMatch2D
                  homeClub={home}
                  awayClub={away}
                  homeFormation={liveHomeFormation}
                  awayFormation={liveAwayFormation}
                  minute={minute}
                  phase={pitchPhase}
                  isFullTime={isSecondHalfDone}
                  speed={speed}
                  homePossession={liveHomePoss}
                  dramaticEvent={dramaticEvent}
                />

                {/* Compact Live Starter Stamina Strip */}
                <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-2.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      선발 실시간 체력 (STA · {TACTICS[userActiveTactic].shortName})
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>70%↑ 정상</span>
                      <span className="text-yellow-300">55~69% -1.5</span>
                      <span className="text-orange-300">40~54% -3.5</span>
                      <span className="text-rose-400">40%↓ -6.0</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 tabular-nums">
                    {starterStaminaRows.map((row) => {
                      if (!row.player) return null;
                      return (
                        <div
                          key={`live-stam-${row.index}`}
                          className={`rounded-lg border px-2 py-1 ${
                            row.staminaPct < 40
                              ? 'border-rose-500/45 bg-rose-950/20'
                              : row.staminaPct < 55
                                ? 'border-orange-500/35 bg-orange-950/15'
                                : 'border-slate-800 bg-[#111822]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span className="font-bold text-slate-400">
                              {row.slotLabel}
                            </span>
                            <span
                              className={`font-extrabold ${getStaminaTextColor(row.staminaPct)}`}
                            >
                              {row.staminaPct}%
                            </span>
                          </div>
                          <div className="truncate text-[10px] font-bold text-slate-100">
                            {row.player.name}
                            {row.isFreshSub && (
                              <span className="ml-1 text-[9px] font-black text-sky-300">
                                IN
                              </span>
                            )}
                          </div>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                            <div
                              className={`h-full rounded-full transition-all duration-200 ${getStaminaBarColor(row.staminaPct)}`}
                              style={{ width: `${row.staminaPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Commentary Timeline (fits alongside 2D pitch on laptop/PC!) */}
              <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-[#0b1018] p-3 flex flex-col">
                <div className="mb-2 flex items-center justify-between text-xs shrink-0">
                  <span className="font-bold text-slate-200">실시간 문자 중계</span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {visibleEvents.length}개 이벤트
                  </span>
                </div>
                <div className="max-h-56 lg:max-h-[405px] space-y-1.5 overflow-y-auto pr-1 text-xs">
                  {[...visibleEvents].reverse().map((ev, idx) => {
                    const evClub = clubsById[ev.teamId];
                    return (
                      <div
                        key={`${ev.minute}-${ev.type}-${idx}`}
                        className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${
                          ev.type === 'goal'
                            ? ev.teamId === USER_CLUB_ID
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-100 font-semibold'
                              : 'bg-rose-500/12 border border-rose-500/25 text-rose-100 font-semibold'
                            : ev.type === 'var_offside'
                              ? 'bg-purple-500/15 border border-purple-400/40 text-purple-100 font-semibold'
                              : ev.type === 'save'
                                ? 'bg-sky-500/10 text-sky-200'
                                : ev.type === 'yellow'
                                  ? 'bg-amber-500/10 text-amber-200'
                                  : ev.type === 'sub'
                                    ? 'bg-sky-950/60 border border-sky-500/30 text-sky-200 font-semibold'
                                    : 'bg-[#111822]/70 text-slate-400'
                        }`}
                      >
                        <span className="w-7 shrink-0 font-display text-[11px] font-bold text-slate-400 tabular-nums">
                          {ev.minute}&apos;
                        </span>
                        <div className="flex flex-wrap items-center gap-1 min-w-0">
                          {evClub &&
                            ev.type !== 'halftime' &&
                            ev.type !== 'fulltime' &&
                            ev.type !== 'kickoff' && (
                              <ClubTag
                                shortName={evClub.shortName}
                                primaryColor={evClub.primaryColor}
                                isUserTeam={evClub.id === USER_CLUB_ID}
                              />
                            )}
                          <span className="leading-snug text-[11px]">
                            {ev.description}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* HALFTIME LOCKER ROOM PANEL (auto-shown at 45') */}
          {phase === 'halftime' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#111822]">
                      <PixelManagerAvatar
                        avatar={state.manager.avatar}
                        clubPrimaryColor={state.userClub.primaryColor}
                        clubSecondaryColor={state.userClub.secondaryColor}
                        size={28}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">
                        {state.manager.name} 감독 · 하프타임 라커룸
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        전술 수정 · 선발 스왑 · 후반 교체 지시
                      </p>
                    </div>
                  </div>
                  {isWizard && activeTrait && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      <Sparkles className="w-3 h-3" />
                      {activeTrait.name} 1.5x
                    </span>
                  )}
                </div>

                {/* Assistant Coach Tactical Analysis + Recommended Subs */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Lightbulb className="w-3.5 h-3.5" />
                      수석코치 전반 분석 & 추천 교체
                    </div>
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                      상대: {TACTICS[oppTactic].shortName} · {oppFormation}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {halftime.tacticalHint}
                  </p>

                  {coachRecommendations.length > 0 ? (
                    <div className="space-y-2 pt-1 border-t border-amber-500/20">
                      {coachRecommendations.map((rec) => {
                        const inStyle = rec.inPlayer.playstyles[0]
                          ? PLAYSTYLES[rec.inPlayer.playstyles[0]]?.shortName
                          : null;
                        return (
                          <div
                            key={rec.id}
                            className="rounded-lg border border-slate-700/80 bg-[#0b1018]/90 p-2.5 space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-200">
                                  {rec.badge}
                                </span>
                                <span className="font-bold text-rose-300 line-through">
                                  {rec.outPlayer.name} ({rec.outStaminaPct}%)
                                </span>
                                <span className="text-slate-500">→</span>
                                <span className="font-extrabold text-emerald-300">
                                  {rec.inPlayer.name} ({rec.inPlayer.ovr})
                                </span>
                                {inStyle && (
                                  <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1 py-0.5 text-[9px] font-bold text-emerald-200">
                                    {inStyle}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={subsRemaining <= 0}
                                onClick={() =>
                                  handleApplyCoachRecommendation(
                                    rec.starterIndex,
                                    rec.benchIndex,
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[10px] font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
                              >
                                <UserCheck className="w-3 h-3" />
                                추천 적용
                              </button>
                            </div>
                            <p className="text-[11px] leading-relaxed text-slate-300">
                              {rec.reason}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pt-1 border-t border-amber-500/20 text-[11px] text-slate-400">
                      {subsRemaining <= 0
                        ? '이미 교체 카드 5장을 모두 사용했습니다. 전술과 포메이션 조정으로 후반을 준비하세요.'
                        : '현재 선발 11명의 체력과 상성이 양호합니다. 후반 흐름을 보며 60분 이후 교체를 활용해도 좋습니다.'}
                    </div>
                  )}
                </div>

                {/* Tactic & Formation Controls */}
                <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-white">
                      <Compass className="w-3.5 h-3.5 text-emerald-400" />
                      후반전 전술 (상대: {TACTICS[oppTactic].shortName})
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        tacticMatch.delta > 0
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : tacticMatch.delta < 0
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {tacticMatch.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {TACTIC_LIST.map((t) => {
                      const active = selectedTactic === t.id;
                      const isRec = halftime.recommendedTactic === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTactic(t.id)}
                          className={`relative rounded-lg py-2 text-xs font-bold cursor-pointer ${
                            active
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-[#111822] text-slate-300 border border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          {t.shortName}
                          {isRec && !active && (
                            <span className="absolute -top-1.5 right-0.5 rounded bg-amber-400 px-1 text-[8px] font-black text-slate-950">
                              추천
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                      <span className="font-bold text-white">
                        후반 포메이션 (상대: {oppFormation})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            formMatch.delta > 0
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : formMatch.delta < 0
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {formMatch.label}
                        </span>
                        <button
                          type="button"
                          onClick={handleHalftimeQuickBestXi}
                          title="현재 그라운드의 선발 11명(교체 아웃 선수 제외)을 선택한 포메이션에 맞춰 최적 포지션으로 자동 재배치합니다"
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                        >
                          <Wand2 className="w-3 h-3" />
                          빠른 선발
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {FORMATION_LIST.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => changeFormation(f.id)}
                          className={`rounded-lg py-1.5 text-[11px] font-bold cursor-pointer ${
                            state.formation === f.id
                              ? 'bg-sky-400 text-slate-950'
                              : 'bg-[#111822] text-slate-300 border border-slate-800'
                          }`}
                        >
                          {f.id}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {htNotice && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/20 px-3 py-2 text-[11px] font-semibold text-emerald-200">
                    <span>✓ {htNotice}</span>
                    <button
                      type="button"
                      onClick={() => setHtNotice(null)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] px-3 py-2 text-[11px] text-slate-400">
                  💡 <strong className="text-sky-300">선발 ↔ 선발</strong> 클릭/드래그는 교체 차감 없이 즉시 위치 변경되며,{' '}
                  <strong className="text-emerald-300">선발 ↔ 벤치</strong> 교체는 실수 방지를 위해 확인창을 거칩니다. 경기 종료 후 원래 선발로 자동 복원됩니다.
                </div>

                <button
                  id="start-second-half-btn"
                  type="button"
                  onClick={handleStartSecondHalf}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  후반전 46&apos; → 90&apos; 중계 시작
                </button>
              </div>

              <div className="lg:col-span-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                    선수 교체 ({subsUsed} / {MAX_MATCH_SUBS}명) · 선발끼리 자유 스왑 가능
                  </span>
                  {swapPick && (
                    <button
                      type="button"
                      onClick={() => setSwapPick(null)}
                      className="text-amber-300 hover:underline cursor-pointer"
                    >
                      취소
                    </button>
                  )}
                </div>
                <PitchBoard
                  formation={state.formation}
                  starters={state.starters}
                  bench={state.bench}
                  chemistry={chemistry}
                  managerTraitId={state.manager.traitId}
                  selectedSlot={swapPick}
                  staminaByPlayerId={staminaByPlayerId}
                  disabledBenchIds={subbedOutIdSet}
                  onSlotClick={handleSlotClick}
                  onSlotSwap={performHalftimeSwap}
                  onInspectPlayer={(player, slotSubPosition) =>
                    setInspected({ player, slotSubPosition })
                  }
                  showBench
                  showChemBreakdown={false}
                  compact
                />
              </div>
            </div>
          )}

          {/* Commentary fallback for extra_time_break / penalties phases */}
          {(phase === 'extra_time_break' || phase === 'penalties') && (
            <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">경기 주요 기록</span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {visibleEvents.length}개 이벤트
                </span>
              </div>
              <div className="max-h-36 space-y-1 overflow-y-auto pr-1 text-xs">
                {[...visibleEvents].reverse().map((ev, idx) => {
                  const evClub = clubsById[ev.teamId];
                  return (
                    <div
                      key={`${ev.minute}-${ev.type}-${idx}`}
                      className="flex items-start gap-2 rounded-lg bg-[#111822]/70 px-2.5 py-1.5 text-[11px] text-slate-300"
                    >
                      <span className="w-7 shrink-0 font-display font-bold text-slate-500 tabular-nums">
                        {ev.minute}&apos;
                      </span>
                      {evClub && ev.type !== 'halftime' && ev.type !== 'fulltime' && ev.type !== 'kickoff' && (
                        <ClubTag
                          shortName={evClub.shortName}
                          primaryColor={evClub.primaryColor}
                          isUserTeam={evClub.id === USER_CLUB_ID}
                        />
                      )}
                      <span>{ev.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Halftime Bench Substitution Safety Confirmation Modal */}
      {pendingHtSubConfirm && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/45 bg-[#101824] p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h4 className="text-sm font-black text-white">
                  선수 교체를 확정할까요?
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  <strong className="text-rose-300">
                    {pendingHtSubConfirm.outPlayer.name}
                  </strong>{' '}
                  선수를 빼고{' '}
                  <strong className="text-emerald-300">
                    {pendingHtSubConfirm.inPlayer.name}
                  </strong>{' '}
                  선수를 투입합니다.
                </p>
                <p className="mt-1 text-[11px] font-semibold text-amber-300/90">
                  교체 아웃된 선수는 이번 경기에 다시 출전할 수 없습니다. (교체 {subsUsed + 1}/{MAX_MATCH_SUBS})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-2.5">
                <div className="text-[10px] font-bold text-rose-300">
                  OUT · {pendingHtSubConfirm.slotLabel}
                </div>
                <div className="mt-0.5 font-extrabold text-white truncate">
                  {pendingHtSubConfirm.outPlayer.name}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 tabular-nums">
                  OVR {pendingHtSubConfirm.outPlayer.ovr} · 체력{' '}
                  {staminaByPlayerId[pendingHtSubConfirm.outPlayer.id] ?? 75}%
                </div>
              </div>
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-2.5">
                <div className="text-[10px] font-bold text-emerald-300">
                  IN · 벤치 투입
                </div>
                <div className="mt-0.5 font-extrabold text-white truncate">
                  {pendingHtSubConfirm.inPlayer.name}
                </div>
                <div className="mt-1 text-[11px] text-emerald-200/90 tabular-nums">
                  OVR {pendingHtSubConfirm.inPlayer.ovr} · 체력 100%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingHtSubConfirm(null)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                취소
              </button>
              <button
                id="confirm-halftime-sub-btn"
                type="button"
                onClick={confirmPendingHalftimeSub}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                교체 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live 2nd-Half Substitution Pause Overlay (Full Formation PitchBoard + Live Stamina Bars!) */}
      {liveSubOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/88 p-3 sm:p-5 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-sky-500/45 bg-[#0f1621] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#0a0f17] px-5 py-3.5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-sky-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
                    {minute}&apos; 일시정지
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    남은 교체 기회 {subsRemaining - pendingLiveSubs.length} / {MAX_MATCH_SUBS}명
                  </span>
                </div>
                <h3 className="mt-1 text-sm font-extrabold text-white">
                  선발끼리 클릭·드래그로 위치 변경 (교체 차감 없음) · 벤치와 교체
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingLiveSubs([]);
                  setLiveSubPick(null);
                  setLiveSubOpen(false);
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-5 space-y-3">
              {/* Stamina Legend + Auto-restore notice */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0b1018] px-3 py-2 text-[10px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-300 font-bold">70%↑ 정상</span>
                  <span className="text-yellow-300">55~69% -1.5</span>
                  <span className="text-orange-300">40~54% -3.5</span>
                  <span className="text-rose-400 font-bold">40%↓ -6.0</span>
                </div>
                <span>선발끼리 자유 스왑 가능 · 경기 종료 후 원래 라인업 복원</span>
              </div>

              {(pendingLiveSubs.length > 0 || hasDraftLineupChanges) && (
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-emerald-300">
                    <span>
                      {pendingLiveSubs.length > 0
                        ? `대기 중인 교체 (${pendingLiveSubs.length}명)`
                        : '선발 포지션 위치 변경 대기 중'}
                    </span>
                    {hasDraftLineupChanges && pendingLiveSubs.length === 0 && (
                      <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-200">
                        교체 횟수 차감 없음
                      </span>
                    )}
                  </div>
                  {pendingLiveSubs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pendingLiveSubs.map((sub, idx) => (
                        <span
                          key={`${sub.outPlayerId}-${sub.inPlayerId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-[#0b1018] px-2.5 py-1 text-xs"
                        >
                          <span className="text-rose-300 line-through">
                            {sub.outPlayerName}
                          </span>
                          <span className="text-slate-500">→</span>
                          <span className="font-bold text-emerald-300">
                            {sub.inPlayerName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePendingSub(idx)}
                            className="ml-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <PitchBoard
                formation={state.formation}
                starters={draftStarters}
                bench={draftBench}
                chemistry={draftChemistry}
                managerTraitId={state.manager.traitId}
                selectedSlot={liveSubPick}
                staminaByPlayerId={staminaByPlayerId}
                disabledBenchIds={draftDisabledBenchIds}
                onSlotClick={handleDraftSlotClick}
                onSlotSwap={performDraftLiveSubSwap}
                onInspectPlayer={(player, slotSubPosition) =>
                  setInspected({ player, slotSubPosition })
                }
                showBench
                showChemBreakdown={false}
                compact
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-[#0a0f17] px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setPendingLiveSubs([]);
                  setLiveSubPick(null);
                  setLiveSubOpen(false);
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                취소 · 경기 재개
              </button>
              <button
                type="button"
                disabled={pendingLiveSubs.length === 0 && !hasDraftLineupChanges}
                onClick={handleConfirmLiveSubs}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {pendingLiveSubs.length > 0
                  ? `교체 확정 (${pendingLiveSubs.length}명) · 경기 재개`
                  : '포지션 변경 적용 · 경기 재개'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PlayerDetailModal
        player={inspected?.player ?? null}
        slotSubPosition={inspected?.slotSubPosition}
        managerTraitId={state.manager.traitId}
        seasonStats={
          inspected ? allStats[`user::${inspected.player.id}`] ?? null : null
        }
        onClose={() => setInspected(null)}
      />
    </div>
  );
}

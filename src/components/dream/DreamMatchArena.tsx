import {
  ArrowLeft,
  ArrowRight,
  Crown,
  Dices,
  FastForward,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { BENCH_SLOTS, FORMATION_LIST, FORMATIONS } from '../../data/formations';
import {
  buildHistoricalClubForMatch,
  getHistoricalTeamById,
  HISTORICAL_BENCHMARK_TEAMS,
} from '../../data/historicalTeams';
import {
  MANAGER_TRAIT_LIST,
  MANAGER_TRAITS,
} from '../../data/managerTraits';
import { calculateChemistry, calculateTeamRatings } from '../../engine/chemistryEngine';
import { LEAGUES } from '../../engine/dataLoader';
import {
  DEFAULT_ROULETTE_LEGEND_RATE,
  spinClubRoulette,
} from '../../engine/draftEngine';
import { reconstructHallOfFameSquad } from '../../engine/legacyEngine';
import {
  optimizeBestLineup,
  optimizeCurrentStartersForFormation,
  remapStartersForFormation,
} from '../../engine/lineupOptimizer';
import {
  resimulateRemainingSecondHalf,
  simulateExtraTimeAndPenalties,
  simulateExtraTimeFirstHalf,
  simulateExtraTimeSecondHalfAndPenalties,
  simulateFirstHalf,
  simulateMatch,
  simulateSecondHalf,
  USER_CLUB_ID,
} from '../../engine/matchEngine';
import { TACTIC_LIST, TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type {
  DraftState,
  FormationId,
  ManagerRouletteState,
  ManagerTraitId,
  UserClubProfile,
} from '../../types/game';
import { DEFAULT_MANAGER_AVATAR, DEFAULT_MANAGER_NAME } from '../../types/game';
import type {
  Club,
  Fixture,
  LeagueId,
  LiveHalftimeState,
  LiveSubRecord,
  MatchResult,
  TacticId,
} from '../../types/league';
import type { HallOfFameEntry, HistoricalTeamEntry } from '../../types/legacy';
import type { Player, SubPosition } from '../../types/player';
import { JerseySvg } from '../common/JerseySvg';
import { MatchDetailModal } from '../common/MatchDetailModal';
import { PitchBoard } from '../common/PitchBoard';
import type { SlotRef } from '../common/PitchBoard';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { RouletteReelsView } from '../draft/RouletteReelsView';
import { LiveMatchBroadcast } from '../league/LiveMatchBroadcast';
import type { LiveMatchBroadcastOverride } from '../league/LiveMatchBroadcast';
import { MatchDayTacticsRoom } from '../league/MatchDayTacticsRoom';
import { MatchReportPanel } from '../league/MatchReportPanel';

type DreamStage =
  | 'select_opponent'
  | 'select_challenger'
  | 'draft_setup'
  | 'draft'
  | 'tactics_room'
  | 'result';

function createEmptyDraft(): DraftState {
  return {
    currentSlotType: 'starter',
    currentSlotIndex: 0,
    hasSpun: false,
    reels: [],
    completed: false,
  };
}

export function DreamMatchArena() {
  const {
    state,
    legacyState,
    dreamMatchInitialOpponentId,
    closeDreamMatch,
    recordDreamMatchOutcome,
  } = useGame();

  const initialOpponent = dreamMatchInitialOpponentId
    ? getHistoricalTeamById(dreamMatchInitialOpponentId)
    : null;

  const [stage, setStage] = useState<DreamStage>(
    initialOpponent ? 'select_challenger' : 'select_opponent',
  );
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>(
    initialOpponent?.id ?? HISTORICAL_BENCHMARK_TEAMS[0].id,
  );
  const [knockoutRules, setKnockoutRules] = useState<boolean>(true);
  const [challengerSourceLabel, setChallengerSourceLabel] =
    useState<string>('즉석 드림 드래프트');

  // Challenger team state (completely isolated from regular season state)
  const [userClub, setUserClub] = useState<UserClubProfile>(() => ({
    name: state.userClub.name || '드림 챌린저스 FC',
    shortName: state.userClub.shortName || 'DRM',
    primaryColor: state.userClub.primaryColor || '#10b981',
    secondaryColor: state.userClub.secondaryColor || '#f8fafc',
    pattern: state.userClub.pattern || 'solid',
  }));
  const [manager, setManager] = useState<ManagerRouletteState>(() => ({
    name: state.manager.name || DEFAULT_MANAGER_NAME,
    avatar: state.manager.avatar ?? DEFAULT_MANAGER_AVATAR,
    traitId: state.manager.traitId ?? 'big_game_hunter',
    rerollsRemaining: 0,
    hasSpun: true,
  }));
  const [formation, setFormation] = useState<FormationId>(state.formation || '4-3-3');
  const [defaultTactic, setDefaultTactic] = useState<TacticId>(
    state.defaultTactic || 'balanced',
  );
  const [activeTactic, setActiveTactic] = useState<TacticId>(
    state.defaultTactic || 'balanced',
  );
  const [draftLeaguePool, setDraftLeaguePool] = useState<LeagueId[]>([
    'epl',
    'laliga',
    'seriea',
    'bundesliga',
    'ligue1',
  ]);
  const [starters, setStarters] = useState<(Player | null)[]>(
    Array.from({ length: 11 }, () => null),
  );
  const [bench, setBench] = useState<(Player | null)[]>(
    Array.from({ length: 5 }, () => null),
  );
  const [draft, setDraft] = useState<DraftState>(createEmptyDraft);
  const [previewCandidate, setPreviewCandidate] = useState<Player | null>(null);
  const [draftSelectedSlot, setDraftSelectedSlot] = useState<SlotRef | null>(null);

  // Live broadcast & match result state
  const [liveHalftime, setLiveHalftime] = useState<LiveHalftimeState | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [detailMatch, setDetailMatch] = useState<MatchResult | null>(null);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);
  const [legacyFallbackNotice, setLegacyFallbackNotice] = useState<boolean>(false);

  // Backup pre-match lineup so after match ends, starting XI is restored cleanly for rematch
  const preMatchLineupRef = useRef<{
    starters: (Player | null)[];
    bench: (Player | null)[];
    formation: FormationId;
  } | null>(null);

  const selectedOpponent: HistoricalTeamEntry = useMemo(
    () =>
      getHistoricalTeamById(selectedOpponentId) ?? HISTORICAL_BENCHMARK_TEAMS[0],
    [selectedOpponentId],
  );

  const oppMatchBundle = useMemo(
    () => buildHistoricalClubForMatch(selectedOpponent),
    [selectedOpponent],
  );

  const filledStarters = useMemo(
    () => starters.filter((p): p is Player => p !== null),
    [starters],
  );
  const filledBench = useMemo(
    () => bench.filter((p): p is Player => p !== null),
    [bench],
  );

  const chemistry = useMemo(
    () =>
      calculateChemistry(formation, starters, activeTactic, manager.traitId),
    [formation, starters, activeTactic, manager.traitId],
  );

  const ratings = useMemo(
    () =>
      calculateTeamRatings(
        formation,
        filledStarters,
        chemistry.total,
        manager.traitId,
        chemistry.slotSynergies,
        activeTactic,
      ),
    [formation, filledStarters, chemistry, manager.traitId, activeTactic],
  );

  const userMatchClub: Club = useMemo(
    () => ({
      id: USER_CLUB_ID,
      name: userClub.name,
      shortName: userClub.shortName,
      primaryColor: userClub.primaryColor,
      secondaryColor: userClub.secondaryColor,
      pattern: userClub.pattern,
      formation,
      defaultTactic: activeTactic,
      att: Math.round(ratings.effectiveAtt || 80),
      mid: Math.round(ratings.effectiveMid || 80),
      def: Math.round(ratings.effectiveDef || 80),
      topScorers: [
        filledStarters[10]?.name ?? filledStarters[9]?.name ?? '에이스',
        filledStarters[9]?.name ?? filledStarters[8]?.name ?? '공격수',
        filledStarters[8]?.name ?? filledStarters[7]?.name ?? '미드필더',
      ],
      isUser: true,
    }),
    [userClub, formation, activeTactic, ratings, filledStarters],
  );

  const clubsById = useMemo<Record<string, Club>>(
    () => ({
      [USER_CLUB_ID]: userMatchClub,
      [oppMatchBundle.club.id]: oppMatchBundle.club,
    }),
    [userMatchClub, oppMatchBundle.club],
  );

  const allPlayerLookup = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of filledStarters) map.set(p.id, p);
    for (const p of filledBench) map.set(p.id, p);
    for (const p of oppMatchBundle.fullRoster) map.set(p.id, p);
    return map;
  }, [filledStarters, filledBench, oppMatchBundle.fullRoster]);

  // Swap squad slots helper
  const handleSwapSquad = useCallback(
    (from: SlotRef, to: SlotRef) => {
      if (from.area === to.area && from.index === to.index) return;
      const nextStarters = [...starters];
      const nextBench = [...bench];
      const pA =
        from.area === 'starter'
          ? nextStarters[from.index]
          : nextBench[from.index];
      const pB =
        to.area === 'starter' ? nextStarters[to.index] : nextBench[to.index];
      if (from.area === 'starter') nextStarters[from.index] = pB;
      else nextBench[from.index] = pB;
      if (to.area === 'starter') nextStarters[to.index] = pA;
      else nextBench[to.index] = pA;
      setStarters(nextStarters);
      setBench(nextBench);

      const isBenchSub = from.area !== to.area;
      if (isBenchSub) {
        const starterIdx = from.area === 'starter' ? from.index : to.index;
        const benchIdx = from.area === 'bench' ? from.index : to.index;
        const outP = starters[starterIdx];
        const inP = bench[benchIdx];
        if (outP && inP) {
          setLiveHalftime((prev) => {
            if (!prev) return prev;
            const livePhase = prev.phase;
            if (
              livePhase !== 'halftime' &&
              livePhase !== 'extra_time_break' &&
              livePhase !== 'extra_time_ht'
            ) {
              return prev;
            }
            const subMinute =
              livePhase === 'halftime'
                ? 45
                : livePhase === 'extra_time_break'
                  ? 90
                  : 105;
            const prevSubs = prev.liveSubs ?? [];
            return {
              ...prev,
              halftimeSubsMade: prev.halftimeSubsMade + 1,
              liveSubs: [
                ...prevSubs,
                {
                  minute: subMinute,
                  outPlayerId: outP.id,
                  outPlayerName: outP.name,
                  inPlayerId: inP.id,
                  inPlayerName: inP.name,
                  slotIndex: starterIdx,
                },
              ],
            };
          });
        }
      }
    },
    [starters, bench],
  );

  const handleChangeFormation = useCallback(
    (nextForm: FormationId) => {
      setFormation((prevForm) => {
        setStarters((prev) =>
          remapStartersForFormation(prev, prevForm, nextForm, manager.traitId),
        );
        return nextForm;
      });
    },
    [manager.traitId],
  );

  const handleAutoOptimize = useCallback(() => {
    const opt = optimizeBestLineup(
      starters,
      bench,
      formation,
      activeTactic,
      manager.traitId,
    );
    setStarters(opt.starters);
    setBench(opt.bench);
  }, [starters, bench, formation, activeTactic, manager.traitId]);

  const handleOptimizeHalftimeStarters = useCallback(
    (tacticOverride?: TacticId) => {
      setStarters((prev) =>
        optimizeCurrentStartersForFormation(
          prev,
          formation,
          tacticOverride ?? activeTactic,
          manager.traitId,
        ),
      );
    },
    [formation, manager.traitId, activeTactic],
  );

  // =========================================================================
  // Mode A: Load My Hall of Fame Team
  // =========================================================================
  const handleSelectHofTeam = (entry: HallOfFameEntry) => {
    const { starters: loadedStarters, bench: loadedBench, usedLegacyFallback } =
      reconstructHallOfFameSquad(entry);
    setUserClub({ ...entry.userClub });
    setManager({
      name: entry.managerName || DEFAULT_MANAGER_NAME,
      avatar: entry.managerAvatar ?? DEFAULT_MANAGER_AVATAR,
      traitId: entry.managerTraitId,
      rerollsRemaining: 0,
      hasSpun: true,
    });
    setFormation(entry.formation);
    setDefaultTactic(entry.defaultTactic);
    setActiveTactic(entry.defaultTactic);
    setStarters(loadedStarters);
    setBench(loadedBench);
    setLegacyFallbackNotice(usedLegacyFallback);
    setChallengerSourceLabel(
      `내 명전 팀 · ${entry.userClub.name} (${entry.seasonScore.totalScore.toLocaleString()}점)`,
    );
    setMatchResult(null);
    setStage('tactics_room');
  };

  // =========================================================================
  // Mode B: Instant Dream Draft
  // =========================================================================
  const handleStartInstantDraft = () => {
    setStarters(Array.from({ length: 11 }, () => null));
    setBench(Array.from({ length: 5 }, () => null));
    setDraft(createEmptyDraft());
    setPreviewCandidate(null);
    setDraftSelectedSlot(null);
    setLegacyFallbackNotice(false);
    setActiveTactic(defaultTactic);
    setChallengerSourceLabel('즉석 드림 드래프트');
    setStage('draft');
  };

  const handleSpinDreamDraft = () => {
    const formCfg = FORMATIONS[formation];
    const isStarter = draft.currentSlotType === 'starter';
    const slot = isStarter
      ? formCfg.slots[draft.currentSlotIndex]
      : BENCH_SLOTS[draft.currentSlotIndex];
    if (!slot) return;
    const pickedIds = new Set<string>();
    for (const p of starters) if (p) pickedIds.add(p.id);
    for (const p of bench) if (p) pickedIds.add(p.id);
    const reels = spinClubRoulette(slot.subPosition, slot.position, pickedIds, {
      legendRate: DEFAULT_ROULETTE_LEGEND_RATE + 0.015, // Slight Dream Match icon flavor (4.0%)
      allowedLeagueIds: draftLeaguePool,
    });
    setPreviewCandidate(null);
    setDraft((prev) => ({ ...prev, hasSpun: true, reels }));
  };

  const handlePickDreamPlayer = (player: Player) => {
    const nextStarters = [...starters];
    const nextBench = [...bench];
    if (draft.currentSlotType === 'starter') {
      nextStarters[draft.currentSlotIndex] = player;
    } else {
      nextBench[draft.currentSlotIndex] = player;
    }
    setStarters(nextStarters);
    setBench(nextBench);
    setPreviewCandidate(null);

    if (draft.currentSlotType === 'starter') {
      if (draft.currentSlotIndex < 10) {
        setDraft({
          currentSlotType: 'starter',
          currentSlotIndex: draft.currentSlotIndex + 1,
          hasSpun: false,
          reels: [],
          completed: false,
        });
      } else {
        setDraft({
          currentSlotType: 'bench',
          currentSlotIndex: 0,
          hasSpun: false,
          reels: [],
          completed: false,
        });
      }
    } else if (draft.currentSlotIndex < 4) {
      setDraft({
        currentSlotType: 'bench',
        currentSlotIndex: draft.currentSlotIndex + 1,
        hasSpun: false,
        reels: [],
        completed: false,
      });
    } else {
      setDraft({
        currentSlotType: 'bench',
        currentSlotIndex: 4,
        hasSpun: false,
        reels: [],
        completed: true,
      });
      setStage('tactics_room');
    }
  };

  const handleAutoCompleteDreamDraft = () => {
    const formCfg = FORMATIONS[formation];
    const nextStarters = [...starters];
    const nextBench = [...bench];
    const pickedIds = new Set<string>();
    for (const p of nextStarters) if (p) pickedIds.add(p.id);
    for (const p of nextBench) if (p) pickedIds.add(p.id);

    for (let i = 0; i < 11; i += 1) {
      if (nextStarters[i]) continue;
      const slot = formCfg.slots[i];
      const reels = spinClubRoulette(slot.subPosition, slot.position, pickedIds, {
        legendRate: DEFAULT_ROULETTE_LEGEND_RATE + 0.015,
        allowedLeagueIds: draftLeaguePool,
      });
      const allCands = reels.flatMap((r) => r.candidates);
      const best = [...allCands].sort((a, b) => b.ovr - a.ovr)[0];
      if (best) {
        nextStarters[i] = best;
        pickedIds.add(best.id);
      }
    }
    for (let i = 0; i < 5; i += 1) {
      if (nextBench[i]) continue;
      const slot = BENCH_SLOTS[i];
      const reels = spinClubRoulette(slot.subPosition, slot.position, pickedIds, {
        legendRate: DEFAULT_ROULETTE_LEGEND_RATE + 0.015,
        allowedLeagueIds: draftLeaguePool,
      });
      const allCands = reels.flatMap((r) => r.candidates);
      const best = [...allCands].sort((a, b) => b.ovr - a.ovr)[0];
      if (best) {
        nextBench[i] = best;
        pickedIds.add(best.id);
      }
    }
    setStarters(nextStarters);
    setBench(nextBench);
    setPreviewCandidate(null);
    setDraft({
      currentSlotType: 'bench',
      currentSlotIndex: 4,
      hasSpun: false,
      reels: [],
      completed: true,
    });
    setStage('tactics_room');
  };

  // =========================================================================
  // Match Engine Helpers (Instant Sim + Full 2D Live Broadcast w/ ET & PK)
  // =========================================================================
  const buildUserContext = useCallback(
    (overrides?: {
      tactic?: TacticId;
      halftimeAdjusted?: boolean;
      halftimeSubsMade?: number;
      halftimeSubIds?: string[];
      firstHalfStarters?: Player[];
      liveSubs?: LiveSubRecord[];
      allowAutoSubs?: boolean;
    }) => {
      const tacticToUse = overrides?.tactic ?? activeTactic;
      const currentStarters = starters.filter((p): p is Player => p !== null);
      const currentBench = bench.filter((p): p is Player => p !== null);
      const curChem = calculateChemistry(
        formation,
        currentStarters,
        tacticToUse,
        manager.traitId,
      );
      const curRatings = calculateTeamRatings(
        formation,
        currentStarters,
        curChem.total,
        manager.traitId,
        curChem.slotSynergies,
        tacticToUse,
      );
      return {
        userClubId: USER_CLUB_ID,
        formation,
        tactic: tacticToUse,
        starters: currentStarters,
        bench: currentBench,
        chemistry: curChem.total,
        ratings: curRatings,
        slotSynergies: curChem.slotSynergies,
        managerTraitId: manager.traitId,
        halftimeAdjusted: overrides?.halftimeAdjusted ?? false,
        halftimeSubsMade: overrides?.halftimeSubsMade ?? 0,
        halftimeSubIds: overrides?.halftimeSubIds ?? [],
        firstHalfStarters: overrides?.firstHalfStarters,
        liveSubs: overrides?.liveSubs ?? [],
        allowAutoSubs: overrides?.allowAutoSubs ?? true,
        opponentRank: 1,
      };
    },
    [activeTactic, starters, bench, formation, manager.traitId],
  );

  const [etSubIds, setEtSubIds] = useState<string[]>([]);

  const finalizeDreamResult = useCallback(
    (result: MatchResult) => {
      // Restore pre-match starting XI after live substitutions
      if (preMatchLineupRef.current) {
        setStarters(preMatchLineupRef.current.starters);
        setBench(preMatchLineupRef.current.bench);
        setFormation(preMatchLineupRef.current.formation);
        preMatchLineupRef.current = null;
      }
      setEtSubIds([]);
      setLiveHalftime(null);
      setMatchResult(result);
      setStage('result');

      const ug = result.homeGoals;
      const og = result.awayGoals;
      let outcome: 'W' | 'D' | 'L' = ug > og ? 'W' : ug < og ? 'L' : 'D';
      let scoreLabel = `${ug}-${og}`;
      if (result.extraTime?.penalties) {
        const wonPk = result.extraTime.penalties.winnerTeamId === USER_CLUB_ID;
        outcome = wonPk ? 'W' : 'L';
        scoreLabel = `${ug}-${og} (PK ${result.extraTime.penalties.homePenGoals}-${result.extraTime.penalties.awayPenGoals})`;
      } else if (result.extraTime) {
        scoreLabel = `${ug}-${og} (연장)`;
      }

      recordDreamMatchOutcome({
        historicalTeamId: selectedOpponent.id,
        outcome,
        scoreLabel,
      });
    },
    [recordDreamMatchOutcome, selectedOpponent.id],
  );

  const handleStartLiveDreamMatch = () => {
    preMatchLineupRef.current = {
      starters: [...starters],
      bench: [...bench],
      formation,
    };
    setEtSubIds([]);
    const fixture: Fixture = {
      id: `dream-${selectedOpponent.id}-${Date.now()}`,
      round: 1,
      homeTeamId: USER_CLUB_ID,
      awayTeamId: oppMatchBundle.club.id,
      played: false,
    };
    const ht = simulateFirstHalf({
      fixture,
      homeClub: userMatchClub,
      awayClub: oppMatchBundle.club,
      homeRoster: filledStarters,
      awayRoster: oppMatchBundle.starters,
      userContext: buildUserContext({ tactic: activeTactic }),
    });
    setLiveHalftime({
      ...ht,
      competition: 'ucl',
      competitionLabel: `드림 매치 · vs ${selectedOpponent.displayName}`,
      isKnockoutDecider: knockoutRules,
      phase: 'first_half',
    });
  };

  const handleSimulateInstantDreamMatch = () => {
    const fixture: Fixture = {
      id: `dream-${selectedOpponent.id}-${Date.now()}`,
      round: 1,
      homeTeamId: USER_CLUB_ID,
      awayTeamId: oppMatchBundle.club.id,
      played: false,
    };
    let result = simulateMatch(
      fixture,
      userMatchClub,
      oppMatchBundle.club,
      filledStarters,
      oppMatchBundle.starters,
      buildUserContext({ tactic: activeTactic, allowAutoSubs: true }),
    );
    result = {
      ...result,
      competition: 'ucl',
      competitionLabel: `드림 매치 · vs ${selectedOpponent.displayName}`,
    };
    if (knockoutRules && result.homeGoals === result.awayGoals) {
      result = simulateExtraTimeAndPenalties({
        baseResult: result,
        homeClub: userMatchClub,
        awayClub: oppMatchBundle.club,
        homeRoster: filledStarters,
        awayRoster: oppMatchBundle.starters,
        userContext: buildUserContext({ tactic: activeTactic }),
      });
    }
    finalizeDreamResult(result);
  };

  // LiveMatchBroadcast Override Adapter
  const liveOverride: LiveMatchBroadcastOverride | undefined = useMemo(() => {
    if (!liveHalftime) return undefined;
    return {
      state: {
        formation,
        defaultTactic,
        starters,
        bench,
        manager,
        userClub,
        season: {
          liveHalftime,
          allPlayerStats: {},
        },
      },
      simSeed: liveHalftime.fixtureId,
      opponentRoster: oppMatchBundle?.starters ?? [],
      opponentManagerOverride: {
        name: selectedOpponent.managerName,
        ovr: selectedOpponent.managerRating,
        traitId: selectedOpponent.managerTraitId,
      },
      chemistry,
      changeFormation: handleChangeFormation,
      optimizeHalftimeStarters: handleOptimizeHalftimeStarters,
      swapSquadPositions: handleSwapSquad,
      enterHalftimeLocker: () => {
        setLiveHalftime((prev) => (prev ? { ...prev, phase: 'halftime' } : prev));
      },
      startSecondHalfBroadcast: ({
        secondHalfTactic,
        subPlayerIds = [],
        firstHalfStarters,
      }) => {
        setActiveTactic(secondHalfTactic);
        const htAdjusted =
          secondHalfTactic !== liveHalftime.userTacticAtKickoff ||
          subPlayerIds.length > 0;
        const totalHtSubs = Math.max(
          liveHalftime.halftimeSubsMade,
          subPlayerIds.length,
        );
        const fullResult = simulateSecondHalf({
          halftime: {
            ...liveHalftime,
            halftimeSubsMade: totalHtSubs,
          },
          homeClub: userMatchClub,
          awayClub: oppMatchBundle.club,
          homeRoster: filledStarters,
          awayRoster: oppMatchBundle.fullRoster,
          userContext: buildUserContext({
            tactic: secondHalfTactic,
            halftimeAdjusted: htAdjusted,
            halftimeSubsMade: totalHtSubs,
            halftimeSubIds: subPlayerIds,
            firstHalfStarters,
            liveSubs: liveHalftime.liveSubs,
            allowAutoSubs: false,
          }),
        });
        setLiveHalftime((prev) =>
          prev
            ? {
                ...prev,
                phase: 'second_half',
                halftimeSubsMade: Math.max(
                  prev.halftimeSubsMade,
                  subPlayerIds.length,
                ),
                homeTactic: fullResult.homeTactic,
                awayTactic: fullResult.awayTactic,
                homeFormation: fullResult.homeFormation,
                awayFormation: fullResult.awayFormation,
                aiHalftimeAdjustment: fullResult.aiHalftimeAdjustment,
                fullMatchResult: {
                  ...fullResult,
                  competition: 'ucl',
                  competitionLabel: prev.competitionLabel,
                },
              }
            : prev,
        );
      },
      applySecondHalfLiveSub: ({
        minute,
        subs,
        nextStarters,
        nextBench,
        firstHalfStarters,
        halftimeSubIds,
      }) => {
        if (!liveHalftime.fullMatchResult) return;
        const updatedStarters = nextStarters ?? starters;
        const updatedBench = nextBench ?? bench;
        setStarters(updatedStarters);
        setBench(updatedBench);

        const newRecords: LiveSubRecord[] = subs.map((s) => {
          const outP =
            allPlayerLookup.get(s.outPlayerId ?? '') ??
            (typeof s.starterIndex === 'number' ? starters[s.starterIndex] : null);
          const inP =
            allPlayerLookup.get(s.inPlayerId ?? '') ??
            (typeof s.benchIndex === 'number' ? bench[s.benchIndex] : null);
          return {
            minute,
            outPlayerId: s.outPlayerId ?? outP?.id ?? '',
            outPlayerName: outP?.name ?? '교체 아웃',
            inPlayerId: s.inPlayerId ?? inP?.id ?? '',
            inPlayerName: inP?.name ?? '교체 인',
            slotIndex: s.starterIndex ?? 0,
          };
        });
        const allSubsSoFar = [...(liveHalftime.liveSubs ?? []), ...newRecords];
        const filledNextStarters = updatedStarters.filter(
          (p): p is Player => p !== null,
        );
        const filledNextBench = updatedBench.filter(
          (p): p is Player => p !== null,
        );
        const subTactic = liveHalftime.homeTactic ?? activeTactic;
        const curChem = calculateChemistry(
          formation,
          filledNextStarters,
          subTactic,
          manager.traitId,
        );
        const curRatings = calculateTeamRatings(
          formation,
          filledNextStarters,
          curChem.total,
          manager.traitId,
          curChem.slotSynergies,
          subTactic,
        );

        const resim = resimulateRemainingSecondHalf({
          halftime: liveHalftime,
          currentResult: liveHalftime.fullMatchResult,
          fromMinute: minute,
          newSubs: newRecords,
          allSubsSoFar,
          homeClub: userMatchClub,
          awayClub: oppMatchBundle.club,
          homeRoster: filledNextStarters,
          awayRoster: oppMatchBundle.starters,
          userContext: {
            userClubId: USER_CLUB_ID,
            formation,
            tactic: subTactic,
            starters: filledNextStarters,
            bench: filledNextBench,
            chemistry: curChem.total,
            ratings: curRatings,
            slotSynergies: curChem.slotSynergies,
            managerTraitId: manager.traitId,
            halftimeAdjusted: true,
            halftimeSubsMade: liveHalftime.halftimeSubsMade + newRecords.length,
            halftimeSubIds,
            firstHalfStarters,
            liveSubs: allSubsSoFar,
            allowAutoSubs: false,
            opponentRank: 1,
          },
        });
        setLiveHalftime((prev) =>
          prev
            ? {
                ...prev,
                halftimeSubsMade: prev.halftimeSubsMade + newRecords.length,
                liveSubs: allSubsSoFar,
                fullMatchResult: {
                  ...resim,
                  competition: 'ucl',
                  competitionLabel: prev.competitionLabel,
                },
              }
            : prev,
        );
      },
      enterExtraTimeBreak: () => {
        setLiveHalftime((prev) =>
          prev ? { ...prev, phase: 'extra_time_break' } : prev,
        );
      },
      startExtraTimeBroadcast: (params) => {
        if (!liveHalftime.fullMatchResult) return;
        const etTactic = params?.etTactic ?? activeTactic;
        setActiveTactic(etTactic);
        const nextEtSubIds = [...etSubIds];
        const nextStarters = [...starters];
        const nextBench = [...bench];
        if (params?.extraSub) {
          const { starterIndex, benchIndex } = params.extraSub;
          const outP = nextStarters[starterIndex];
          const inP = nextBench[benchIndex];
          if (outP && inP) {
            nextStarters[starterIndex] = inP;
            nextBench[benchIndex] = outP;
            nextEtSubIds.push(inP.id);
            setStarters(nextStarters);
            setBench(nextBench);
            setEtSubIds(nextEtSubIds);
          }
        }
        const activeXI = nextStarters.filter((p): p is Player => p !== null);
        const et1Res = simulateExtraTimeFirstHalf({
          baseResult: liveHalftime.fullMatchResult,
          homeClub: userMatchClub,
          awayClub: oppMatchBundle.club,
          homeRoster: activeXI,
          awayRoster: oppMatchBundle.starters,
          userContext: {
            ...buildUserContext({
              tactic: etTactic,
              halftimeAdjusted: true,
              halftimeSubIds: params?.halftimeSubIds ?? [],
              firstHalfStarters: params?.firstHalfStarters,
              liveSubs: liveHalftime.liveSubs ?? [],
              allowAutoSubs: false,
            }),
            starters: activeXI,
          },
          extraTimeSubIds: nextEtSubIds,
        });
        setLiveHalftime((prev) =>
          prev
            ? {
                ...prev,
                phase: 'extra_time',
                homeTactic: etTactic,
                etFirstHalfResult: {
                  ...et1Res,
                  competition: 'ucl',
                  competitionLabel: prev.competitionLabel,
                },
              }
            : prev,
        );
      },
      enterEtHalftimeLocker: () => {
        setLiveHalftime((prev) =>
          prev ? { ...prev, phase: 'extra_time_ht' } : prev,
        );
      },
      startEtSecondHalfBroadcast: (params) => {
        const et1Base =
          liveHalftime.etFirstHalfResult ?? liveHalftime.fullMatchResult;
        if (!et1Base) return;
        const etTactic = params?.etTactic ?? activeTactic;
        setActiveTactic(etTactic);
        const et2Res = simulateExtraTimeSecondHalfAndPenalties({
          et1Result: et1Base,
          homeClub: userMatchClub,
          awayClub: oppMatchBundle.club,
          homeRoster: filledStarters,
          awayRoster: oppMatchBundle.starters,
          userContext: buildUserContext({
            tactic: etTactic,
            halftimeAdjusted: true,
            halftimeSubIds: params?.halftimeSubIds ?? [],
            firstHalfStarters: params?.firstHalfStarters,
            liveSubs: liveHalftime.liveSubs ?? [],
            allowAutoSubs: false,
          }),
          extraTimeSubIds: etSubIds,
        });
        setLiveHalftime((prev) =>
          prev
            ? {
                ...prev,
                phase: 'extra_time_2',
                homeTactic: etTactic,
                fullMatchResult: {
                  ...et2Res,
                  competition: 'ucl',
                  competitionLabel: prev.competitionLabel,
                },
              }
            : prev,
        );
      },
      enterPenaltyShootout: () => {
        setLiveHalftime((prev) =>
          prev ? { ...prev, phase: 'penalties' } : prev,
        );
      },
      commitLiveMatch: (secondHalfTacticOverride) => {
        let finalRes =
          liveHalftime.fullMatchResult ?? liveHalftime.etFirstHalfResult;
        if (!finalRes) {
          const tacticToUse = secondHalfTacticOverride ?? activeTactic;
          finalRes = simulateSecondHalf({
            halftime: liveHalftime,
            homeClub: userMatchClub,
            awayClub: oppMatchBundle.club,
            homeRoster: filledStarters,
            awayRoster: oppMatchBundle.starters,
            userContext: buildUserContext({
              tactic: tacticToUse,
              allowAutoSubs: true,
            }),
          });
          if (knockoutRules && finalRes.homeGoals === finalRes.awayGoals) {
            finalRes = simulateExtraTimeAndPenalties({
              baseResult: finalRes,
              homeClub: userMatchClub,
              awayClub: oppMatchBundle.club,
              homeRoster: filledStarters,
              awayRoster: oppMatchBundle.starters,
              userContext: buildUserContext({ tactic: tacticToUse }),
            });
          }
        }
        finalizeDreamResult({
          ...finalRes,
          competition: 'ucl',
          competitionLabel: liveHalftime.competitionLabel,
        });
      },
    };
  }, [
    liveHalftime,
    formation,
    defaultTactic,
    starters,
    bench,
    manager,
    userClub,
    chemistry,
    activeTactic,
    etSubIds,
    allPlayerLookup,
    userMatchClub,
    oppMatchBundle,
    filledStarters,
    knockoutRules,
    handleChangeFormation,
    handleOptimizeHalftimeStarters,
    handleSwapSquad,
    buildUserContext,
    finalizeDreamResult,
  ]);

  const dreamRecords = legacyState.dreamMatchRecords ?? {};

  // Draft preview calculations
  const draftCurrentSlot =
    draft.currentSlotType === 'starter'
      ? FORMATIONS[formation].slots[draft.currentSlotIndex]
      : BENCH_SLOTS[draft.currentSlotIndex];
  const draftCompletedCount = filledStarters.length + filledBench.length;
  const draftDisplayedStarters = useMemo(() => {
    if (!previewCandidate || draft.currentSlotType !== 'starter') return starters;
    const next = [...starters];
    next[draft.currentSlotIndex] = previewCandidate;
    return next;
  }, [previewCandidate, draft.currentSlotType, draft.currentSlotIndex, starters]);
  const draftDisplayedBench = useMemo(() => {
    if (!previewCandidate || draft.currentSlotType !== 'bench') return bench;
    const next = [...bench];
    next[draft.currentSlotIndex] = previewCandidate;
    return next;
  }, [previewCandidate, draft.currentSlotType, draft.currentSlotIndex, bench]);
  const draftPreviewChem = useMemo(
    () =>
      calculateChemistry(
        formation,
        draftDisplayedStarters,
        defaultTactic,
        manager.traitId,
      ),
    [formation, draftDisplayedStarters, defaultTactic, manager.traitId],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-5 space-y-5">
      {/* Top Dream Match Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-[#17130d] via-[#111824] to-[#0d131d] px-4 py-3.5 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-md">
            <Swords className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white">
                드림 매치 · 명예의 전당 챌린지
              </h1>
              <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/35">
                역대 최강 14팀 도전
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              진행 중인 시즌 세이브는 안전하게 보존됩니다 · 내 명전 팀 또는 즉석 드래프트로 전설의 팀에 도전하세요
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stage !== 'select_opponent' && (
            <button
              type="button"
              onClick={() => {
                setLiveHalftime(null);
                setMatchResult(null);
                setStage('select_opponent');
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
            >
              상대 변경
            </button>
          )}
          <button
            type="button"
            onClick={closeDreamMatch}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>나가기</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* STEP 1: Select Historical Legend Opponent (14 Teams)              */}
      {/* ================================================================= */}
      {stage === 'select_opponent' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                1단계 · 도전할 역대 최강팀 선택
              </h2>
              <p className="text-xs text-slate-400">
                모든 역대 강팀은 실제 전성기 선발 11명 + 핵심 벤치 6명(17인 풀스쿼드)과 명장 전술·세부 능력치로 구현되어 있습니다.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {HISTORICAL_BENCHMARK_TEAMS.map((team, idx) => {
              const rec = dreamRecords[team.id];
              const trait = MANAGER_TRAITS[team.managerTraitId];
              return (
                <div
                  key={team.id}
                  className="flex flex-col justify-between rounded-2xl border border-amber-500/25 bg-gradient-to-br from-[#161512] via-[#101620] to-[#0c1118] p-4 transition hover:border-amber-400/65"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-slate-900">
                        <JerseySvg
                          primaryColor={team.userClub.primaryColor}
                          secondaryColor={team.userClub.secondaryColor}
                          pattern={team.userClub.pattern}
                          label={team.userClub.shortName}
                          size={34}
                        />
                        <span className="absolute -top-2 -left-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950">
                          {idx + 1}
                        </span>
                      </div>

                      <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90">
                        <PixelManagerAvatar
                          avatar={team.managerAvatar}
                          clubPrimaryColor={team.userClub.primaryColor}
                          clubSecondaryColor={team.userClub.secondaryColor}
                          size={30}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-black text-white truncate">
                            {team.displayName}
                          </h3>
                          {team.isTreble && (
                            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
                              👑 트레블
                            </span>
                          )}
                          {rec && rec.wins > 0 && (
                            <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                              ⚔️ 격파 {rec.wins}승 {rec.losses}패
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-amber-200/90 truncate">
                          {team.managerName} (명장 {team.managerRating} · {trait.name})
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                          {team.formation} · {TACTICS[team.defaultTactic].name} · 평균 OVR{' '}
                          <strong className="text-white">{team.teamAvgOvr}</strong> · 케미{' '}
                          <strong className="text-emerald-300">{team.chemistry}</strong> · 17인 풀스쿼드
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-bold text-amber-400">
                        {team.seasonScore.grade}
                      </div>
                      <div className="font-mono text-sm font-black text-white">
                        {team.seasonScore.totalScore.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Key Stars Preview */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
                    <div className="flex flex-wrap gap-1">
                      {[...team.starters]
                        .sort((a, b) => b.ovr - a.ovr)
                        .slice(0, 3)
                        .map((star) => (
                          <button
                            key={star.id}
                            type="button"
                            onClick={() => setInspected({ player: star })}
                            className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
                          >
                            {star.name} <span className="text-amber-300">{star.ovr}</span>
                          </button>
                        ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOpponentId(team.id);
                        setStage('select_challenger');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-amber-300 cursor-pointer shrink-0"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      <span>도전하기</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2: Select Challenger Mode (A: My HOF Team / B: Instant Draft)*/}
      {/* ================================================================= */}
      {stage === 'select_challenger' && (
        <div className="space-y-4">
          {/* Selected Opponent Summary Banner */}
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-[#18140d] via-[#111723] to-[#0d121c] p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <JerseySvg
                primaryColor={selectedOpponent.userClub.primaryColor}
                secondaryColor={selectedOpponent.userClub.secondaryColor}
                pattern={selectedOpponent.userClub.pattern}
                label={selectedOpponent.userClub.shortName}
                size={48}
              />
              <div className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-slate-900">
                <PixelManagerAvatar
                  avatar={selectedOpponent.managerAvatar}
                  clubPrimaryColor={selectedOpponent.userClub.primaryColor}
                  clubSecondaryColor={selectedOpponent.userClub.secondaryColor}
                  size={36}
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
                    상대 역대 강팀
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-white">
                    {selectedOpponent.displayName}
                  </h2>
                </div>
                <p className="text-xs text-amber-200 mt-0.5">
                  {selectedOpponent.managerName} 감독 (지휘력 {selectedOpponent.managerRating} ·{' '}
                  {MANAGER_TRAITS[selectedOpponent.managerTraitId].name}) ·{' '}
                  {selectedOpponent.formation} · {TACTICS[selectedOpponent.defaultTactic].name}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  평균 OVR {selectedOpponent.teamAvgOvr} · 팀 케미 {selectedOpponent.chemistry} · 감독 시너지{' '}
                  {selectedOpponent.managerSynergyCount}명 (+{selectedOpponent.avgSynergyOvrBonus.toFixed(1)} OVR)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStage('select_opponent')}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              다른 상대 고르기
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Option A: Load My Hall of Fame Team */}
            <div className="rounded-2xl border border-emerald-500/35 bg-[#0e1520] p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                    방식 A · 내 명예의 전당 팀
                  </span>
                  <h3 className="mt-1.5 text-base font-black text-white">
                    과거 내가 완성한 명전 팀 불러오기
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    시즌을 마쳐 명예의 전당에 등재한 내 스쿼드·감독·전술을 그대로 불러와 역대 최강팀과 진검승부를 펼칩니다.
                  </p>
                </div>
                <Crown className="h-6 w-6 text-emerald-400 shrink-0" />
              </div>

              {legacyState.hallOfFame.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-center space-y-2">
                  <Trophy className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="text-xs font-bold text-slate-300">
                    아직 명예의 전당에 등록된 내 팀 기록이 없습니다.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    정규 시즌을 완주하거나, 우측의 [즉석 드림 드래프트]로 바로 도전해 보세요!
                  </p>
                </div>
              ) : (
                <div className="max-h-[340px] overflow-y-auto space-y-2.5 pr-1">
                  {legacyState.hallOfFame.map((entry) => {
                    const hasFull =
                      Array.isArray(entry.fullStarters) &&
                      entry.fullStarters.length >= 11;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3 hover:border-emerald-400/55 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <JerseySvg
                            primaryColor={entry.userClub.primaryColor}
                            secondaryColor={entry.userClub.secondaryColor}
                            pattern={entry.userClub.pattern}
                            label={entry.userClub.shortName}
                            size={30}
                          />
                          {entry.managerAvatar && (
                            <PixelManagerAvatar
                              avatar={entry.managerAvatar}
                              clubPrimaryColor={entry.userClub.primaryColor}
                              clubSecondaryColor={entry.userClub.secondaryColor}
                              size={26}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-black text-white">
                                {entry.userClub.name}
                              </span>
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.2 font-mono text-[10px] font-black text-amber-300">
                                {entry.seasonScore.grade} {entry.seasonScore.totalScore.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">
                              {entry.formation} · {TACTICS[entry.defaultTactic].name} · OVR {entry.teamAvgOvr} · 케미 {entry.chemistry}
                              {!hasFull && ' · 구버전 자동 복원'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectHofTeam(entry)}
                          className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
                        >
                          출전
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Option B: Instant Dream Draft */}
            <div className="flex flex-col justify-between rounded-2xl border border-sky-500/35 bg-[#0e1520] p-5 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-black text-sky-300">
                      방식 B · 즉석 드림 드래프트
                    </span>
                    <h3 className="mt-1.5 text-base font-black text-white">
                      지금 바로 16인 드래프트로 도전 팀 구성
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      포메이션·전술·감독 강점을 고르고 16인 룰렛 드래프트로 {selectedOpponent.displayName}에 맞설 맞춤형 드림팀을 즉석 결성합니다.
                    </p>
                  </div>
                  <Dices className="h-6 w-6 text-sky-400 shrink-0" />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>드림 매치 전용 레전드 ICON 출현 확률 상향 (4.0%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>임시 배치 시너지 프리뷰 · 포지션 자유 스왑 · 원클릭 자동완성 지원</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                    <span>현재 커스터마이징된 내 감독({manager.name}) 아바타 그대로 출전</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStage('draft_setup')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-sky-400 cursor-pointer"
              >
                <Dices className="h-4 w-4" />
                <span>즉석 드림 드래프트 설정하기</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2B-1: Quick 1-Screen Draft Setup                             */}
      {/* ================================================================= */}
      {stage === 'draft_setup' && (
        <div className="rounded-2xl border border-slate-800 bg-[#0e1520] p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-black text-white">
                즉석 드림 드래프트 빠른 설정
              </h2>
              <p className="text-xs text-slate-400">
                상대: <strong className="text-amber-300">{selectedOpponent.displayName}</strong> ({selectedOpponent.formation} · {TACTICS[selectedOpponent.defaultTactic].name})
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStage('select_challenger')}
              className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
            >
              ← 방식 선택으로
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Club Name & League Pool */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  도전 팀명
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={userClub.name}
                  onChange={(e) =>
                    setUserClub((prev) => ({
                      ...prev,
                      name: e.target.value || '드림 챌린저스',
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="text-xs font-bold text-slate-300 mb-1.5">
                  드래프트 풀 리그 선택 (최소 1개)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LEAGUES.map((lg) => {
                    const active = draftLeaguePool.includes(lg.id);
                    return (
                      <button
                        key={lg.id}
                        type="button"
                        onClick={() => {
                          if (active && draftLeaguePool.length <= 1) return;
                          setDraftLeaguePool((prev) =>
                            active
                              ? prev.filter((id) => id !== lg.id)
                              : [...prev, lg.id],
                          );
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
                          active
                            ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                            : 'border-slate-700 bg-slate-900 text-slate-400'
                        }`}
                      >
                        {lg.koreanName}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Formation & Default Tactic */}
            <div className="space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-300 mb-1.5">
                  포메이션
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {FORMATION_LIST.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormation(f.id)}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-bold cursor-pointer ${
                        formation === f.id
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {f.id}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-300 mb-1.5">
                  기본 전술
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TACTIC_LIST.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDefaultTactic(t.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
                        defaultTactic === t.id
                          ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                          : 'border-slate-700 bg-slate-950 text-slate-300'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Manager Trait Picker (14 traits) */}
          <div>
            <div className="text-xs font-bold text-slate-300 mb-2">
              감독 강점 선택 ({manager.name} 감독)
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {MANAGER_TRAIT_LIST.map((tr) => {
                const selected = manager.traitId === tr.id;
                return (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() =>
                      setManager((prev) => ({
                        ...prev,
                        traitId: tr.id as ManagerTraitId,
                      }))
                    }
                    className={`rounded-xl border p-2.5 text-left transition cursor-pointer ${
                      selected
                        ? 'border-amber-400 bg-amber-500/15'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-white truncate">
                      {tr.name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 line-clamp-2">
                      {tr.tagline}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleStartInstantDraft}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              <Dices className="h-4 w-4" />
              <span>16인 드림 드래프트 시작</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2B-2: Instant 16-Player Dream Draft                          */}
      {/* ================================================================= */}
      {stage === 'draft' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0e1520] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-black text-sky-300">
                드림 드래프트 {draftCompletedCount} / 16
              </span>
              <span className="text-xs text-slate-300">
                현재 픽:{' '}
                <strong className="text-white">
                  {draft.currentSlotType === 'starter' ? '선발' : '벤치'}{' '}
                  {draftCurrentSlot?.label}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoCompleteDreamDraft}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/45 bg-amber-500/15 px-3 py-1.5 text-xs font-extrabold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
              >
                <FastForward className="h-3.5 w-3.5" />
                <span>나머지 자동 완성</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <PitchBoard
                formation={formation}
                starters={draftDisplayedStarters}
                bench={draftDisplayedBench}
                chemistry={draftPreviewChem}
                managerTraitId={manager.traitId}
                activeSlot={
                  draftCurrentSlot
                    ? {
                        area: draft.currentSlotType,
                        index: draft.currentSlotIndex,
                      }
                    : null
                }
                previewSlot={
                  previewCandidate
                    ? {
                        area: draft.currentSlotType,
                        index: draft.currentSlotIndex,
                      }
                    : null
                }
                selectedSlot={draftSelectedSlot}
                onSlotClick={(area, index) => {
                  const ref: SlotRef = { area, index };
                  if (!draftSelectedSlot) {
                    setDraftSelectedSlot(ref);
                  } else {
                    handleSwapSquad(draftSelectedSlot, ref);
                    setDraftSelectedSlot(null);
                  }
                }}
                onSlotSwap={handleSwapSquad}
                onInspectPlayer={(p, sub) =>
                  setInspected({ player: p, slotSubPosition: sub })
                }
                draftBenchHints
                compact
              />
            </div>

            <div className="lg:col-span-7">
              <RouletteReelsView
                hasSpun={draft.hasSpun}
                reels={draft.reels}
                legendRatePercent={4.0}
                targetSubPosition={draftCurrentSlot?.subPosition ?? 'CM'}
                managerTraitId={manager.traitId}
                allowedLeagueIds={draftLeaguePool}
                previewCandidate={previewCandidate}
                onSelectPreviewCandidate={setPreviewCandidate}
                previewSlotSynergy={
                  previewCandidate && draft.currentSlotType === 'starter'
                    ? (draftPreviewChem.slotSynergies[draft.currentSlotIndex] ??
                      null)
                    : null
                }
                previewChemDelta={
                  previewCandidate ? draftPreviewChem.total - chemistry.total : 0
                }
                onSpin={handleSpinDreamDraft}
                onPickPlayer={handlePickDreamPlayer}
                pickActionLabel={`${draftCurrentSlot?.label ?? ''} 영입 확정`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 3: Pre-Match Day Tactics Room (Same Engine & Split Pitch!)   */}
      {/* ================================================================= */}
      {stage === 'tactics_room' && (
        <div className="space-y-4">
          {legacyFallbackNotice && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-2.5 text-xs text-amber-200">
              ℹ️ 구버전에서 저장된 명예의 전당 기록을 감지해 당시 선수 명단·OVR·포지션에 맞춰 세부 능력치와 풀스쿼드를 자동 복원했습니다.
            </div>
          )}

          {/* Opponent Legendary Manager & Match Rules Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0e1520] px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                {challengerSourceLabel}
              </span>
              <span className="text-xs text-slate-400 truncate">
                상대 명장:{' '}
                <strong className="text-amber-300">
                  {selectedOpponent.managerName} ({selectedOpponent.managerRating} ·{' '}
                  {MANAGER_TRAITS[selectedOpponent.managerTraitId].name})
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setKnockoutRules((v) => !v)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                  knockoutRules
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                {knockoutRules
                  ? '🏆 결승 규칙: 무승부 시 연장·승부차기 ON'
                  : '⏱️ 친선 규칙: 90분 무승부 종료'}
              </button>
              <button
                type="button"
                onClick={() => setStage('select_challenger')}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                도전 팀 변경
              </button>
            </div>
          </div>

          <MatchDayTacticsRoom
            opponent={oppMatchBundle.club}
            opponentRoster={oppMatchBundle.fullRoster}
            opponentSubtitle={`${selectedOpponent.managerName} 감독 (지휘력 ${selectedOpponent.managerRating}) · ${selectedOpponent.nickname}`}
            isHome
            headerBadge={`DREAM MATCH · vs ${selectedOpponent.seasonLabel}`}
            headerAccent="ucl"
            activeTactic={activeTactic}
            defaultTactic={defaultTactic}
            formation={formation}
            starters={starters}
            bench={bench}
            chemistry={chemistry}
            managerTraitId={manager.traitId}
            onSelectTactic={setActiveTactic}
            onChangeFormation={handleChangeFormation}
            onSwapSquad={handleSwapSquad}
            onAutoOptimize={handleAutoOptimize}
            onInspectPlayer={(p, sub) =>
              setInspected({ player: p, slotSubPosition: sub })
            }
            onClickOpponentPlayerName={(playerId) => {
              const found = allPlayerLookup.get(playerId);
              if (found) setInspected({ player: found });
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartLiveDreamMatch}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs sm:text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>2D 실시간 중계 시작</span>
              </button>
              <button
                type="button"
                onClick={handleSimulateInstantDreamMatch}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
              >
                <Zap className="h-4 w-4" />
                <span>빠른 시뮬레이션</span>
              </button>
            </div>
          </MatchDayTacticsRoom>

          {/* Opponent Full Bench Preview Strip */}
          <div className="rounded-2xl border border-slate-800 bg-[#0e1520] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-amber-300">
                {selectedOpponent.displayName} 핵심 벤치 ({oppMatchBundle.bench.length}명 · 클릭 시 세부 능력치 열람)
              </h4>
              <span className="text-[11px] text-slate-400">
                선발 11 + 벤치 {oppMatchBundle.bench.length} = 총 {oppMatchBundle.fullRoster.length}인 풀스쿼드
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {oppMatchBundle.bench.map((bp) => (
                <button
                  key={bp.id}
                  type="button"
                  onClick={() => setInspected({ player: bp })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
                >
                  <span className="rounded bg-slate-800 px-1 py-0.2 font-mono text-[10px] font-bold text-slate-400">
                    {bp.mainPositions[0]}
                  </span>
                  <span className="font-bold">{bp.name}</span>
                  <span className="font-mono font-black text-amber-300">
                    {bp.ovr}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 5: Dream Match Post-Match Result & Detailed Report           */}
      {/* ================================================================= */}
      {stage === 'result' && matchResult && (
        <div className="space-y-4">
          {(() => {
            const ug = matchResult.homeGoals;
            const og = matchResult.awayGoals;
            const won = matchResult.extraTime?.penalties
              ? matchResult.extraTime.penalties.winnerTeamId === USER_CLUB_ID
              : ug > og;
            const draw = !matchResult.extraTime?.penalties && ug === og;
            return (
              <div
                className={`rounded-2xl border p-5 text-center space-y-2 ${
                  won
                    ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-950/60 via-[#0f1724] to-[#0b1018]'
                    : draw
                      ? 'border-amber-400/40 bg-gradient-to-br from-amber-950/40 via-[#0f1724] to-[#0b1018]'
                      : 'border-rose-500/40 bg-gradient-to-br from-rose-950/50 via-[#0f1724] to-[#0b1018]'
                }`}
              >
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  DREAM MATCH FULL TIME
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {won
                    ? `🏆 전설 격파! ${selectedOpponent.displayName}을(를) 꺾었습니다!`
                    : draw
                      ? `🤝 ${selectedOpponent.displayName}과(와) 대등한 무승부!`
                      : `⚔️ ${selectedOpponent.displayName}의 벽은 높았습니다`}
                </h2>
                <p className="text-xs text-slate-300">
                  {userClub.name} {ug} - {og} {selectedOpponent.displayName}
                  {matchResult.extraTime?.penalties &&
                    ` (승부차기 ${matchResult.extraTime.penalties.homePenGoals}-${matchResult.extraTime.penalties.awayPenGoals})`}
                  {!matchResult.extraTime?.penalties &&
                    matchResult.extraTime &&
                    ' (연장 승부)'}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMatchResult(null);
                      setStage('tactics_room');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>전술 수정 후 재도전</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMatchResult(null);
                      setStage('select_opponent');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/45 bg-amber-500/15 px-4 py-2 text-xs font-extrabold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                  >
                    <Swords className="h-3.5 w-3.5" />
                    <span>다른 역대 강팀 도전</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMatchResult(null);
                      setStage('draft_setup');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 px-4 py-2 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>새 드래프트로 도전</span>
                  </button>
                </div>
              </div>
            );
          })()}

          <MatchReportPanel
            match={matchResult}
            clubsById={clubsById}
            onSelectPlayer={(playerId) => {
              const p = allPlayerLookup.get(playerId);
              if (p) setInspected({ player: p });
            }}
            onOpenDetail={(m) => setDetailMatch(m)}
          />
        </div>
      )}

      {/* Full 2D Live Broadcast Overlay (reusing 100% of main game engine & UI!) */}
      {liveHalftime && liveOverride && (
        <LiveMatchBroadcast clubsById={clubsById} override={liveOverride} />
      )}

      {/* Match Detail Modal */}
      {detailMatch && (
        <MatchDetailModal
          match={detailMatch}
          clubsById={clubsById}
          onSelectPlayer={(playerId) => {
            const p = allPlayerLookup.get(playerId);
            if (p) setInspected({ player: p });
          }}
          onClose={() => setDetailMatch(null)}
        />
      )}

      {/* Player Detail Modal (works for BOTH user squad & all 17 historical players!) */}
      {inspected && (
        <PlayerDetailModal
          player={inspected.player}
          slotSubPosition={inspected.slotSubPosition}
          managerTraitId={manager.traitId}
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  );
}

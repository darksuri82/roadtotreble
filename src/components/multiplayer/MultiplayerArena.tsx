import {
  Check,
  Crown,
  Dices,
  Loader2,
  LogOut,
  MessageSquareQuote,
  Play,
  RotateCcw,
  Swords,
  Trophy,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateChemistry, calculateTeamRatings } from '../../engine/chemistryEngine';
import {
  optimizeBestLineup,
  optimizeCurrentStartersForFormation,
  remapStartersForFormation,
} from '../../engine/lineupOptimizer';
import {
  simulateExtraTimeFirstHalf,
  simulateExtraTimeSecondHalfAndPenalties,
  simulateFirstHalf,
  simulateSecondHalf,
} from '../../engine/matchEngine';
import type { UserMatchContext } from '../../engine/matchEngine';
import {
  clearLocalMpDraft,
  clearMyTacticBarrier,
  clearRoomCodeFromUrl,
  createRoom,
  fetchRoomSnapshot,
  getOrCreateMpPlayerId,
  joinRoomByCode,
  leaveRoom,
  loadActiveRoomCode,
  MP_GUEST_TEAM_ID,
  MP_HOST_TEAM_ID,
  publishMatchState,
  resetRoomForSameTeamRematch,
  startBlindDraft,
  submitBlindDraftLineup,
  submitTacticBarrier,
  subscribeToRoom,
  updateDraftProgress,
  updatePlayerProfile,
  updatePlayerReady,
  updateRoomSettings,
  updateRoomStatus,
} from '../../services/multiplayerService';
import { createPreSeasonLive } from '../../engine/mpLeagueDraft';
import { startMpLeagueRoom } from '../../services/mpLeagueService';
import { useGame } from '../../store/GameContext';
import type {
  FormationId,
  ManagerAvatarConfig,
  ManagerRouletteState,
  ManagerTraitId,
  UserClubProfile,
} from '../../types/game';
import { DEFAULT_MANAGER_AVATAR, DEFAULT_MANAGER_NAME } from '../../types/game';
import type {
  Club,
  Fixture,
  LiveHalftimeState,
  MatchResult,
  TacticId,
} from '../../types/league';
import {
  isMpFinishedStatus,
  isMpLiveMatchStatus,
  isMpTacticsStatus,
} from '../../types/multiplayer';
import type {
  MpLineupPayload,
  MpMatchPhase,
  MpMatchState,
  MpRoomMode,
  MpRoomSettings,
  MpRoomSnapshot,
  MpTacticBarrierPhase,
} from '../../types/multiplayer';
import { normalizeMpLeagueSettings } from '../../types/mpLeague';
import type { Player, SubPosition } from '../../types/player';
import { MatchDetailModal } from '../common/MatchDetailModal';
import type { SlotRef } from '../common/PitchBoard';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { LiveMatchBroadcast } from '../league/LiveMatchBroadcast';
import type { LiveMatchBroadcastOverride } from '../league/LiveMatchBroadcast';
import { MatchDayTacticsRoom } from '../league/MatchDayTacticsRoom';
import { MatchReportPanel } from '../league/MatchReportPanel';
import { MpLeagueRoot } from './league/MpLeagueRoot';
import { MpPostMatchManagerPopup } from './MpPostMatchManagerPopup';
import { MultiplayerBlindDraft } from './MultiplayerBlindDraft';
import { MultiplayerLobby } from './MultiplayerLobby';
import { PreKickoffRevealModal } from './PreKickoffRevealModal';

function buildClubFromLineup(params: {
  id: string;
  profile: UserClubProfile;
  formation: FormationId;
  tactic: TacticId;
  starters: Player[];
  managerTraitId: ManagerTraitId;
  isUser: boolean;
}): Club {
  const { id, profile, formation, tactic, starters, managerTraitId, isUser } = params;
  const chem = calculateChemistry(formation, starters, tactic, managerTraitId);
  const ratings = calculateTeamRatings(
    formation,
    starters,
    chem.total,
    managerTraitId,
    chem.slotSynergies,
  );
  return {
    id,
    name: profile.name || 'FC 드림',
    shortName: profile.shortName || 'DRM',
    primaryColor: profile.primaryColor || '#10b981',
    secondaryColor: profile.secondaryColor || '#f8fafc',
    pattern: profile.pattern || 'solid',
    formation,
    defaultTactic: tactic,
    att: Math.round(ratings.effectiveAtt || ratings.att || 80),
    mid: Math.round(ratings.effectiveMid || ratings.mid || 80),
    def: Math.round(ratings.effectiveDef || ratings.def || 80),
    topScorers: [
      starters[10]?.name ?? starters[9]?.name ?? '에이스',
      starters[9]?.name ?? starters[8]?.name ?? '공격수',
      starters[8]?.name ?? starters[7]?.name ?? '미드필더',
    ],
    isUser,
  };
}

function buildHumanMatchContext(params: {
  clubId: string;
  formation: FormationId;
  tactic: TacticId;
  starters: Player[];
  bench: Player[];
  managerTraitId: ManagerTraitId;
  halftimeAdjusted?: boolean;
  halftimeSubsMade?: number;
  halftimeSubIds?: string[];
  firstHalfStarters?: Player[];
}): UserMatchContext {
  const chem = calculateChemistry(
    params.formation,
    params.starters,
    params.tactic,
    params.managerTraitId,
  );
  const ratings = calculateTeamRatings(
    params.formation,
    params.starters,
    chem.total,
    params.managerTraitId,
    chem.slotSynergies,
  );
  return {
    userClubId: params.clubId,
    formation: params.formation,
    tactic: params.tactic,
    starters: params.starters,
    bench: params.bench,
    chemistry: chem.total,
    ratings,
    slotSynergies: chem.slotSynergies,
    managerTraitId: params.managerTraitId,
    halftimeAdjusted: params.halftimeAdjusted ?? false,
    halftimeSubsMade: params.halftimeSubsMade ?? 0,
    halftimeSubIds: params.halftimeSubIds ?? [],
    firstHalfStarters: params.firstHalfStarters,
    liveSubs: [],
    allowAutoSubs: false,
    opponentRank: 1,
    competition: 'ucl',
  };
}

function diffSubstitutions(
  beforeStarters: Player[],
  afterStarters: Player[],
): { outPlayerName: string; inPlayerName: string; inPlayerId: string }[] {
  const beforeIds = new Set(beforeStarters.map((p) => p.id));
  const afterIds = new Set(afterStarters.map((p) => p.id));
  const outPlayers = beforeStarters.filter((p) => !afterIds.has(p.id));
  const inPlayers = afterStarters.filter((p) => !beforeIds.has(p.id));
  const count = Math.min(outPlayers.length, inPlayers.length);
  const subs: { outPlayerName: string; inPlayerName: string; inPlayerId: string }[] =
    [];
  for (let i = 0; i < count; i += 1) {
    subs.push({
      outPlayerName: outPlayers[i].name,
      inPlayerName: inPlayers[i].name,
      inPlayerId: inPlayers[i].id,
    });
  }
  return subs;
}

function isSameRoomSnapshot(a: MpRoomSnapshot | null, b: MpRoomSnapshot): boolean {
  if (!a) return false;
  if (a.room.id !== b.room.id || a.room.updated_at !== b.room.updated_at) return false;
  if (a.players.length !== b.players.length) return false;
  return a.players.every((p, i) => {
    const q = b.players[i];
    return p.id === q.id && p.updated_at === q.updated_at;
  });
}

export function MultiplayerArena() {
  const {
    state,
    updateClubProfile,
    updateManagerProfile,
    multiplayerInitialRoomCode,
    closeMultiplayer,
  } = useGame();

  const [playerId] = useState<string>(() => getOrCreateMpPlayerId());
  const [nickname, setNickname] = useState<string>(
    () => state.manager.name || DEFAULT_MANAGER_NAME,
  );
  const [snapshot, setSnapshot] = useState<MpRoomSnapshot | null>(null);
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'reconnecting'
  >('connecting');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedReconnectCode, setSavedReconnectCode] = useState<string | null>(() =>
    loadActiveRoomCode(),
  );

  // Local editable squad state for Tactics Room & Live Halftime / ET Locker
  const [myFormation, setMyFormation] = useState<FormationId>('4-3-3');
  const [myTactic, setMyTactic] = useState<TacticId>('possession');
  const [myStarters, setMyStarters] = useState<(Player | null)[]>(
    Array.from({ length: 11 }, () => null),
  );
  const [myBench, setMyBench] = useState<(Player | null)[]>(
    Array.from({ length: 5 }, () => null),
  );
  const [localPhaseOverride, setLocalPhaseOverride] = useState<MpMatchPhase | null>(
    null,
  );
  const [localCommittedMatchId, setLocalCommittedMatchId] = useState<string | null>(
    null,
  );
  const [dismissedPostMatchPopupId, setDismissedPostMatchPopupId] = useState<
    string | null
  >(null);
  const [submittingBarrier, setSubmittingBarrier] = useState<string | null>(null);
  const [detailMatch, setDetailMatch] = useState<MatchResult | null>(null);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);

  const syncedSquadKeyRef = useRef<string | null>(null);
  const lastRemoteMatchPhaseRef = useRef<string | null>(null);
  const transitionGuardRef = useRef<Set<string>>(new Set());
  const autoJoinedRef = useRef(false);

  const handleNicknameChange = (next: string) => {
    setNickname(next);
    if (next.trim()) {
      updateManagerProfile({ name: next.trim() });
    }
  };

  // Join room handler
  const handleJoinRoom = useCallback(
    async (code: string) => {
      setBusy(true);
      setErrorMsg(null);
      const res = await joinRoomByCode({
        code,
        playerId,
        nickname: nickname.trim() || state.manager.name || DEFAULT_MANAGER_NAME,
        avatar: state.manager.avatar ?? DEFAULT_MANAGER_AVATAR,
        clubProfile: state.userClub,
      });
      setBusy(false);
      if (res.error || !res.data) {
        setErrorMsg(res.error ?? '방 참가에 실패했습니다.');
        return;
      }
      setSnapshot(res.data);
      setSavedReconnectCode(res.data.room.code);
      clearRoomCodeFromUrl();
    },
    [playerId, nickname, state.manager.name, state.manager.avatar, state.userClub],
  );

  // Auto-join when opened via invite link (?room=XXXXXX)
  useEffect(() => {
    if (
      multiplayerInitialRoomCode &&
      !snapshot &&
      !autoJoinedRef.current
    ) {
      autoJoinedRef.current = true;
      void handleJoinRoom(multiplayerInitialRoomCode);
    }
  }, [multiplayerInitialRoomCode, snapshot, handleJoinRoom]);

  // Subscribe to Supabase Realtime + Presence when inside a room
  const activeRoomId = snapshot?.room.id ?? null;
  useEffect(() => {
    if (!activeRoomId) return;
    const unsubscribe = subscribeToRoom({
      roomId: activeRoomId,
      playerId,
      nickname: nickname.trim() || DEFAULT_MANAGER_NAME,
      onSnapshot: (nextSnap) => {
        // The 2s safety poll returns identical rows most of the time: keep the same object so nothing re-renders
        setSnapshot((prev) => (isSameRoomSnapshot(prev, nextSnap) ? prev : nextSnap));
      },
      onPresenceChange: (ids) => {
        setOnlinePlayerIds(ids);
      },
      onConnectionStatus: (status) => {
        setConnectionStatus(status);
      },
    });
    return unsubscribe;
  }, [activeRoomId, playerId, nickname]);

  const room = snapshot?.room ?? null;
  const players = snapshot?.players ?? [];
  const isHost = Boolean(room && room.host_player_id === playerId);
  const hostRow = useMemo(
    () =>
      players.find((p) => p.player_id === room?.host_player_id) ??
      players.find((p) => p.seat === 0) ??
      null,
    [players, room?.host_player_id],
  );
  const guestRow = useMemo(
    () => players.find((p) => p.player_id !== hostRow?.player_id) ?? null,
    [players, hostRow?.player_id],
  );
  const myRow = isHost ? hostRow : guestRow;
  const oppRow = isHost ? guestRow : hostRow;
  const myTeamId = isHost ? MP_HOST_TEAM_ID : MP_GUEST_TEAM_ID;
  const oppTeamId = isHost ? MP_GUEST_TEAM_ID : MP_HOST_TEAM_ID;
  const opponentOnline = Boolean(oppRow && onlinePlayerIds.includes(oppRow.player_id));

  const matchState: MpMatchState | null =
    room?.match_state && room.match_state.matchId ? room.match_state : null;
  const seriesWins = room?.match_state?.seriesWins ?? {
    host: 0,
    guest: 0,
    draws: 0,
  };
  const isMatchFinishedNow = Boolean(
    matchState?.finalResult &&
      (isMpFinishedStatus(room?.status) ||
        matchState.phase === 'finished' ||
        localCommittedMatchId === matchState.matchId),
  );
  const isMatchLiveNow = Boolean(
    room &&
      matchState?.matchId &&
      room.status !== 'lobby' &&
      room.status !== 'drafting' &&
      !isMatchFinishedNow &&
      (isMpLiveMatchStatus(room.status) || matchState.phase !== 'finished'),
  );

  // Sync local editable tactics lineup when entering tactics or reconnecting mid-match
  useEffect(() => {
    if (!room || !myRow) return;
    const matchNum = room.settings.matchNumber ?? 1;
    const draftGen = room.settings.draftGeneration ?? 1;

    if (isMpTacticsStatus(room.status) && !isMatchLiveNow && !isMatchFinishedNow && myRow.lineup_payload) {
      const key = `tactics:${room.id}:${draftGen}:${matchNum}`;
      if (syncedSquadKeyRef.current !== key) {
        syncedSquadKeyRef.current = key;
        setMyFormation(myRow.lineup_payload.formation);
        setMyTactic(myRow.lineup_payload.defaultTactic);
        setMyStarters([...myRow.lineup_payload.starters]);
        setMyBench([...myRow.lineup_payload.bench]);
        setLocalPhaseOverride(null);
        setLocalCommittedMatchId(null);
        setSubmittingBarrier(null);
      }
    } else if (isMatchLiveNow && matchState) {
      const key = `live:${matchState.matchId}:${matchState.phase}`;
      if (syncedSquadKeyRef.current !== key) {
        syncedSquadKeyRef.current = key;
        setMyFormation(isHost ? matchState.hostFormation : matchState.guestFormation);
        setMyTactic(isHost ? matchState.hostTactic : matchState.guestTactic);
        setMyStarters([
          ...(isHost ? matchState.hostStarters : matchState.guestStarters),
        ]);
        setMyBench([...(isHost ? matchState.hostBench : matchState.guestBench)]);
      }
    }
  }, [room, myRow, isHost, matchState, isMatchLiveNow, isMatchFinishedNow]);

  // When Host advances authoritative matchState.phase, clear local phase override so both clients sync!
  useEffect(() => {
    if (!matchState) {
      lastRemoteMatchPhaseRef.current = null;
      return;
    }
    const remoteKey = `${matchState.matchId}:${matchState.phase}`;
    if (lastRemoteMatchPhaseRef.current !== remoteKey) {
      lastRemoteMatchPhaseRef.current = remoteKey;
      setLocalPhaseOverride(null);
      setSubmittingBarrier(null);
    }
  }, [matchState]);

  // =========================================================================
  // HOST AUTHORITATIVE ORCHESTRATION EFFECTS (Zero AI Override, 100% Synced)
  // =========================================================================

  // 1) Both finished blind draft -> advance room to 'tactics' (THE REVEAL!)
  useEffect(() => {
    if (!isHost || !room || room.status !== 'drafting') return;
    if (
      hostRow?.draft_completed &&
      guestRow?.draft_completed &&
      hostRow.lineup_payload &&
      guestRow.lineup_payload
    ) {
      const guardKey = `draft-done:${room.id}:${room.settings.draftGeneration ?? 1}`;
      if (transitionGuardRef.current.has(guardKey)) return;
      transitionGuardRef.current.add(guardKey);
      void (async () => {
        const res = await updateRoomStatus(room.id, 'tactics');
        if (res.error) {
          transitionGuardRef.current.delete(guardKey);
          setErrorMsg(res.error);
          return;
        }
        const snap = await fetchRoomSnapshot(room.id);
        if (snap.data) setSnapshot(snap.data);
      })();
    }
  }, [isHost, room, hostRow, guestRow]);

  // 2) Host starts kickoff explicitly from PreKickoffRevealModal once BOTH players confirmed tactics & clicked Ready
  const handleHostKickoffMatch = useCallback(async () => {
    if (!isHost || !room || !isMpTacticsStatus(room.status) || isMatchLiveNow) return;
    if (!hostRow?.lineup_payload || !guestRow?.lineup_payload) return;
    if (!hostRow.is_ready || !guestRow.is_ready) return;

    const matchNumber = room.settings.matchNumber ?? 1;
    const preMatchKey = `pre_match:${room.settings.draftGeneration ?? 1}:${matchNumber}`;
    const hSub = hostRow.tactic_submission;
    const gSub = guestRow.tactic_submission;

    if (
      hSub?.phase !== 'pre_match' ||
      hSub.barrierKey !== preMatchKey ||
      gSub?.phase !== 'pre_match' ||
      gSub.barrierKey !== preMatchKey
    ) {
      return;
    }

    const guardKey = `kickoff:${room.id}:${preMatchKey}`;
    if (transitionGuardRef.current.has(guardKey)) return;
    transitionGuardRef.current.add(guardKey);
    setBusy(true);
    setErrorMsg(null);

    try {
      const hostTrait = hostRow.lineup_payload.managerTraitId;
      const guestTrait = guestRow.lineup_payload.managerTraitId;

      const hostClub = buildClubFromLineup({
        id: MP_HOST_TEAM_ID,
        profile: hostRow.club_profile,
        formation: hSub.formation,
        tactic: hSub.tactic,
        starters: hSub.starters,
        managerTraitId: hostTrait,
        isUser: true,
      });
      const guestClub = buildClubFromLineup({
        id: MP_GUEST_TEAM_ID,
        profile: guestRow.club_profile,
        formation: gSub.formation,
        tactic: gSub.tactic,
        starters: gSub.starters,
        managerTraitId: guestTrait,
        isUser: false,
      });

      const hostCtx = buildHumanMatchContext({
        clubId: MP_HOST_TEAM_ID,
        formation: hSub.formation,
        tactic: hSub.tactic,
        starters: hSub.starters,
        bench: hSub.bench,
        managerTraitId: hostTrait,
      });
      const guestCtx = buildHumanMatchContext({
        clubId: MP_GUEST_TEAM_ID,
        formation: gSub.formation,
        tactic: gSub.tactic,
        starters: gSub.starters,
        bench: gSub.bench,
        managerTraitId: guestTrait,
      });

      const matchId = `mp-${room.code}-m${matchNumber}-${Date.now()}`;
      const fixture: Fixture = {
        id: matchId,
        round: matchNumber,
        homeTeamId: MP_HOST_TEAM_ID,
        awayTeamId: MP_GUEST_TEAM_ID,
        played: false,
      };

      const ht = simulateFirstHalf({
        fixture,
        homeClub: hostClub,
        awayClub: guestClub,
        homeRoster: hSub.starters,
        awayRoster: gSub.starters,
        userContext: hostCtx,
        opponentUserContext: guestCtx,
      });

      const liveHalftime: LiveHalftimeState = {
        ...ht,
        competition: 'ucl',
        competitionLabel: `1대1 블라인드 대전 · #${matchNumber}`,
        isKnockoutDecider: room.settings.knockoutRules,
        phase: 'first_half',
      };

      const nextMatchState: MpMatchState = {
        matchId,
        matchNumber,
        phase: 'first_half',
        hostTeamId: MP_HOST_TEAM_ID,
        guestTeamId: MP_GUEST_TEAM_ID,
        hostFormation: hSub.formation,
        guestFormation: gSub.formation,
        hostTactic: hSub.tactic,
        guestTactic: gSub.tactic,
        hostManagerTraitId: hostTrait,
        guestManagerTraitId: guestTrait,
        hostStarters: hSub.starters,
        hostBench: hSub.bench,
        guestStarters: gSub.starters,
        guestBench: gSub.bench,
        hostFirstHalfStarters: hSub.starters,
        guestFirstHalfStarters: gSub.starters,
        hostHalftimeSubIds: [],
        guestHalftimeSubIds: [],
        hostEtSubIds: [],
        guestEtSubIds: [],
        liveHalftime,
        finalResult: null,
        seriesWins,
        updatedAt: new Date().toISOString(),
      };

      const res = await publishMatchState(room.id, 'live_match', nextMatchState);
      if (res.error) {
        transitionGuardRef.current.delete(guardKey);
        setErrorMsg(res.error);
        return;
      }
      setErrorMsg(null);
      const snap = await fetchRoomSnapshot(room.id);
      if (snap.data) setSnapshot(snap.data);
    } catch (err) {
      transitionGuardRef.current.delete(guardKey);
      setErrorMsg(
        err instanceof Error ? err.message : '경기 시작 처리 중 오류가 발생했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }, [isHost, room, hostRow, guestRow, seriesWins, isMatchLiveNow]);

  // 3) Both submitted Halftime tactics -> Host runs simulateSecondHalf with BOTH real human choices!
  useEffect(() => {
    if (!isHost || !room || !isMatchLiveNow || !matchState) return;
    if (matchState.phase !== 'first_half') return;
    if (!hostRow || !guestRow) return;

    const barrierKey = `halftime:${matchState.matchId}`;
    const hSub = hostRow.tactic_submission;
    const gSub = guestRow.tactic_submission;

    if (
      hSub?.phase === 'halftime' &&
      hSub.barrierKey === barrierKey &&
      gSub?.phase === 'halftime' &&
      gSub.barrierKey === barrierKey
    ) {
      const guardKey = `ht-run:${barrierKey}`;
      if (transitionGuardRef.current.has(guardKey)) return;
      transitionGuardRef.current.add(guardKey);

      const hostSubsDiff = diffSubstitutions(
        matchState.hostFirstHalfStarters,
        hSub.starters,
      );
      const guestSubsDiff = diffSubstitutions(
        matchState.guestFirstHalfStarters,
        gSub.starters,
      );

      const hostClub = buildClubFromLineup({
        id: MP_HOST_TEAM_ID,
        profile: hostRow.club_profile,
        formation: hSub.formation,
        tactic: hSub.tactic,
        starters: hSub.starters,
        managerTraitId: matchState.hostManagerTraitId,
        isUser: true,
      });
      const guestClub = buildClubFromLineup({
        id: MP_GUEST_TEAM_ID,
        profile: guestRow.club_profile,
        formation: gSub.formation,
        tactic: gSub.tactic,
        starters: gSub.starters,
        managerTraitId: matchState.guestManagerTraitId,
        isUser: false,
      });

      const hostHtAdjusted =
        hSub.tactic !== matchState.hostTactic ||
        hSub.formation !== matchState.hostFormation ||
        hostSubsDiff.length > 0;
      const guestHtAdjusted =
        gSub.tactic !== matchState.guestTactic ||
        gSub.formation !== matchState.guestFormation ||
        guestSubsDiff.length > 0;

      const hostCtx = buildHumanMatchContext({
        clubId: MP_HOST_TEAM_ID,
        formation: hSub.formation,
        tactic: hSub.tactic,
        starters: hSub.starters,
        bench: hSub.bench,
        managerTraitId: matchState.hostManagerTraitId,
        halftimeAdjusted: hostHtAdjusted,
        halftimeSubsMade: hostSubsDiff.length,
        halftimeSubIds: hostSubsDiff.map((s) => s.inPlayerId),
        firstHalfStarters: matchState.hostFirstHalfStarters,
      });
      const guestCtx = buildHumanMatchContext({
        clubId: MP_GUEST_TEAM_ID,
        formation: gSub.formation,
        tactic: gSub.tactic,
        starters: gSub.starters,
        bench: gSub.bench,
        managerTraitId: matchState.guestManagerTraitId,
        halftimeAdjusted: guestHtAdjusted,
        halftimeSubsMade: guestSubsDiff.length,
        halftimeSubIds: guestSubsDiff.map((s) => s.inPlayerId),
        firstHalfStarters: matchState.guestFirstHalfStarters,
      });

      const fullResult = simulateSecondHalf({
        halftime: {
          ...matchState.liveHalftime,
          halftimeSubsMade: hostSubsDiff.length,
        },
        homeClub: hostClub,
        awayClub: guestClub,
        homeRoster: hSub.starters,
        awayRoster: gSub.starters,
        userContext: hostCtx,
        opponentUserContext: guestCtx,
        opponentHalftimeSubs: guestSubsDiff.map((s) => ({
          outPlayerName: s.outPlayerName,
          inPlayerName: s.inPlayerName,
        })),
      });

      const labeledResult: MatchResult = {
        ...fullResult,
        competition: 'ucl',
        competitionLabel: matchState.liveHalftime.competitionLabel,
      };

      const nextState: MpMatchState = {
        ...matchState,
        phase: 'second_half',
        hostFormation: hSub.formation,
        guestFormation: gSub.formation,
        hostTactic: hSub.tactic,
        guestTactic: gSub.tactic,
        hostStarters: hSub.starters,
        hostBench: hSub.bench,
        guestStarters: gSub.starters,
        guestBench: gSub.bench,
        hostHalftimeSubIds: hostSubsDiff.map((s) => s.inPlayerId),
        guestHalftimeSubIds: guestSubsDiff.map((s) => s.inPlayerId),
        liveHalftime: {
          ...matchState.liveHalftime,
          phase: 'second_half',
          halftimeSubsMade: hostSubsDiff.length,
          homeTactic: labeledResult.homeTactic,
          awayTactic: labeledResult.awayTactic,
          homeFormation: labeledResult.homeFormation,
          awayFormation: labeledResult.awayFormation,
          fullMatchResult: labeledResult,
        },
        finalResult: labeledResult,
        updatedAt: new Date().toISOString(),
      };

      void (async () => {
        const res = await publishMatchState(room.id, 'live_match', nextState);
        if (res.error) {
          transitionGuardRef.current.delete(guardKey);
          setErrorMsg(res.error);
          return;
        }
        const snap = await fetchRoomSnapshot(room.id);
        if (snap.data) setSnapshot(snap.data);
      })();
    }
  }, [isHost, room, matchState, hostRow, guestRow, isMatchLiveNow]);

  // 4) Both submitted Extra Time 1st Half tactics (90' tied under knockoutRules)
  useEffect(() => {
    if (!isHost || !room || !isMatchLiveNow || !matchState) return;
    if (matchState.phase !== 'second_half' || !matchState.liveHalftime.fullMatchResult) {
      return;
    }
    if (!hostRow || !guestRow) return;

    const barrierKey = `extra_time_break:${matchState.matchId}`;
    const hSub = hostRow.tactic_submission;
    const gSub = guestRow.tactic_submission;

    if (
      hSub?.phase === 'extra_time_break' &&
      hSub.barrierKey === barrierKey &&
      gSub?.phase === 'extra_time_break' &&
      gSub.barrierKey === barrierKey
    ) {
      const guardKey = `et1-run:${barrierKey}`;
      if (transitionGuardRef.current.has(guardKey)) return;
      transitionGuardRef.current.add(guardKey);

      const hostEtSubs = diffSubstitutions(matchState.hostStarters, hSub.starters).map(
        (s) => s.inPlayerId,
      );
      const guestEtSubs = diffSubstitutions(matchState.guestStarters, gSub.starters).map(
        (s) => s.inPlayerId,
      );

      const hostClub = buildClubFromLineup({
        id: MP_HOST_TEAM_ID,
        profile: hostRow.club_profile,
        formation: hSub.formation,
        tactic: hSub.tactic,
        starters: hSub.starters,
        managerTraitId: matchState.hostManagerTraitId,
        isUser: true,
      });
      const guestClub = buildClubFromLineup({
        id: MP_GUEST_TEAM_ID,
        profile: guestRow.club_profile,
        formation: gSub.formation,
        tactic: gSub.tactic,
        starters: gSub.starters,
        managerTraitId: matchState.guestManagerTraitId,
        isUser: false,
      });

      const hostCtx = buildHumanMatchContext({
        clubId: MP_HOST_TEAM_ID,
        formation: hSub.formation,
        tactic: hSub.tactic,
        starters: hSub.starters,
        bench: hSub.bench,
        managerTraitId: matchState.hostManagerTraitId,
        halftimeAdjusted: true,
        halftimeSubsMade: matchState.hostHalftimeSubIds.length + hostEtSubs.length,
        halftimeSubIds: matchState.hostHalftimeSubIds,
        firstHalfStarters: matchState.hostFirstHalfStarters,
      });
      const guestCtx = buildHumanMatchContext({
        clubId: MP_GUEST_TEAM_ID,
        formation: gSub.formation,
        tactic: gSub.tactic,
        starters: gSub.starters,
        bench: gSub.bench,
        managerTraitId: matchState.guestManagerTraitId,
        halftimeAdjusted: true,
        halftimeSubsMade: matchState.guestHalftimeSubIds.length + guestEtSubs.length,
        halftimeSubIds: matchState.guestHalftimeSubIds,
        firstHalfStarters: matchState.guestFirstHalfStarters,
      });

      const et1Result = simulateExtraTimeFirstHalf({
        baseResult: matchState.liveHalftime.fullMatchResult,
        homeClub: hostClub,
        awayClub: guestClub,
        homeRoster: hSub.starters,
        awayRoster: gSub.starters,
        userContext: hostCtx,
        opponentUserContext: guestCtx,
        extraTimeSubIds: hostEtSubs,
        opponentExtraTimeSubIds: guestEtSubs,
      });

      const nextState: MpMatchState = {
        ...matchState,
        phase: 'extra_time',
        hostFormation: hSub.formation,
        guestFormation: gSub.formation,
        hostTactic: hSub.tactic,
        guestTactic: gSub.tactic,
        hostStarters: hSub.starters,
        hostBench: hSub.bench,
        guestStarters: gSub.starters,
        guestBench: gSub.bench,
        hostEtSubIds: [...matchState.hostEtSubIds, ...hostEtSubs],
        guestEtSubIds: [...matchState.guestEtSubIds, ...guestEtSubs],
        liveHalftime: {
          ...matchState.liveHalftime,
          phase: 'extra_time',
          homeTactic: et1Result.homeTactic,
          awayTactic: et1Result.awayTactic,
          homeFormation: et1Result.homeFormation,
          awayFormation: et1Result.awayFormation,
          fullMatchResult: et1Result,
        },
        finalResult: et1Result,
        updatedAt: new Date().toISOString(),
      };

      void (async () => {
        const res = await publishMatchState(room.id, 'live_match', nextState);
        if (res.error) {
          transitionGuardRef.current.delete(guardKey);
          setErrorMsg(res.error);
          return;
        }
        const snap = await fetchRoomSnapshot(room.id);
        if (snap.data) setSnapshot(snap.data);
      })();
    }
  }, [isHost, room, matchState, hostRow, guestRow, isMatchLiveNow]);

  // 5) Both submitted Extra Time 2nd Half tactics (105' ET Halftime) -> computes ET2 + PK!
  useEffect(() => {
    if (!isHost || !room || !isMatchLiveNow || !matchState) return;
    if (matchState.phase !== 'extra_time' || !matchState.liveHalftime.fullMatchResult) {
      return;
    }
    if (!hostRow || !guestRow) return;

    const barrierKey = `extra_time_ht:${matchState.matchId}`;
    const hSub = hostRow.tactic_submission;
    const gSub = guestRow.tactic_submission;

    if (
      hSub?.phase === 'extra_time_ht' &&
      hSub.barrierKey === barrierKey &&
      gSub?.phase === 'extra_time_ht' &&
      gSub.barrierKey === barrierKey
    ) {
      const guardKey = `et2-run:${barrierKey}`;
      if (transitionGuardRef.current.has(guardKey)) return;
      transitionGuardRef.current.add(guardKey);

      const hostEt2Subs = diffSubstitutions(matchState.hostStarters, hSub.starters).map(
        (s) => s.inPlayerId,
      );
      const guestEt2Subs = diffSubstitutions(matchState.guestStarters, gSub.starters).map(
        (s) => s.inPlayerId,
      );
      const allHostEtSubs = [...matchState.hostEtSubIds, ...hostEt2Subs];
      const allGuestEtSubs = [...matchState.guestEtSubIds, ...guestEt2Subs];

      const hostClub = buildClubFromLineup({
        id: MP_HOST_TEAM_ID,
        profile: hostRow.club_profile,
        formation: hSub.formation,
        tactic: hSub.tactic,
        starters: hSub.starters,
        managerTraitId: matchState.hostManagerTraitId,
        isUser: true,
      });
      const guestClub = buildClubFromLineup({
        id: MP_GUEST_TEAM_ID,
        profile: guestRow.club_profile,
        formation: gSub.formation,
        tactic: gSub.tactic,
        starters: gSub.starters,
        managerTraitId: matchState.guestManagerTraitId,
        isUser: false,
      });

      const hostCtx = buildHumanMatchContext({
        clubId: MP_HOST_TEAM_ID,
        formation: hSub.formation,
        tactic: hSub.tactic,
        starters: hSub.starters,
        bench: hSub.bench,
        managerTraitId: matchState.hostManagerTraitId,
        halftimeAdjusted: true,
        halftimeSubsMade: matchState.hostHalftimeSubIds.length + allHostEtSubs.length,
        halftimeSubIds: matchState.hostHalftimeSubIds,
        firstHalfStarters: matchState.hostFirstHalfStarters,
      });
      const guestCtx = buildHumanMatchContext({
        clubId: MP_GUEST_TEAM_ID,
        formation: gSub.formation,
        tactic: gSub.tactic,
        starters: gSub.starters,
        bench: gSub.bench,
        managerTraitId: matchState.guestManagerTraitId,
        halftimeAdjusted: true,
        halftimeSubsMade: matchState.guestHalftimeSubIds.length + allGuestEtSubs.length,
        halftimeSubIds: matchState.guestHalftimeSubIds,
        firstHalfStarters: matchState.guestFirstHalfStarters,
      });

      const et2Result = simulateExtraTimeSecondHalfAndPenalties({
        et1Result: matchState.liveHalftime.fullMatchResult,
        homeClub: hostClub,
        awayClub: guestClub,
        homeRoster: hSub.starters,
        awayRoster: gSub.starters,
        userContext: hostCtx,
        opponentUserContext: guestCtx,
        extraTimeSubIds: allHostEtSubs,
        opponentExtraTimeSubIds: allGuestEtSubs,
      });

      const nextState: MpMatchState = {
        ...matchState,
        phase: 'extra_time_2',
        hostFormation: hSub.formation,
        guestFormation: gSub.formation,
        hostTactic: hSub.tactic,
        guestTactic: gSub.tactic,
        hostStarters: hSub.starters,
        hostBench: hSub.bench,
        guestStarters: gSub.starters,
        guestBench: gSub.bench,
        hostEtSubIds: allHostEtSubs,
        guestEtSubIds: allGuestEtSubs,
        liveHalftime: {
          ...matchState.liveHalftime,
          phase: 'extra_time_2',
          homeTactic: et2Result.homeTactic,
          awayTactic: et2Result.awayTactic,
          homeFormation: et2Result.homeFormation,
          awayFormation: et2Result.awayFormation,
          fullMatchResult: et2Result,
        },
        finalResult: et2Result,
        updatedAt: new Date().toISOString(),
      };

      void (async () => {
        const res = await publishMatchState(room.id, 'live_match', nextState);
        if (res.error) {
          transitionGuardRef.current.delete(guardKey);
          setErrorMsg(res.error);
          return;
        }
        const snap = await fetchRoomSnapshot(room.id);
        if (snap.data) setSnapshot(snap.data);
      })();
    }
  }, [isHost, room, matchState, hostRow, guestRow, isMatchLiveNow]);

  // =========================================================================
  // LOBBY & REMATCH ACTION HANDLERS
  // =========================================================================

  const handleCreateRoom = async (mode: MpRoomMode, settings: MpRoomSettings) => {
    setBusy(true);
    setErrorMsg(null);
    const res = await createRoom({
      playerId,
      nickname: nickname.trim() || state.manager.name || DEFAULT_MANAGER_NAME,
      avatar: state.manager.avatar ?? DEFAULT_MANAGER_AVATAR,
      clubProfile: state.userClub,
      mode,
      settings,
    });
    setBusy(false);
    if (res.error || !res.data) {
      setErrorMsg(res.error ?? '방 생성 실패');
      return;
    }
    setSnapshot(res.data);
    setSavedReconnectCode(res.data.room.code);
  };

  const handleUpdateSettings = async (settings: MpRoomSettings) => {
    if (!room) return;
    await updateRoomSettings(room.id, settings);
  };

  const handleUpdateCustomProfile = async (payload: {
    nickname: string;
    avatar: ManagerAvatarConfig;
    clubProfile: UserClubProfile;
  }) => {
    setNickname(payload.nickname);
    updateManagerProfile({
      name: payload.nickname,
      avatar: payload.avatar,
    });
    updateClubProfile(payload.clubProfile);
    if (room) {
      const res = await updatePlayerProfile({
        roomId: room.id,
        playerId,
        nickname: payload.nickname,
        avatar: payload.avatar,
        clubProfile: payload.clubProfile,
      });
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        const snap = await fetchRoomSnapshot(room.id);
        if (snap.data) setSnapshot(snap.data);
      }
    }
  };

  const handleToggleReady = async (nextReady: boolean) => {
    if (!room) return;
    setBusy(true);
    const res = await updatePlayerReady(room.id, playerId, nextReady);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      const snap = await fetchRoomSnapshot(room.id);
      if (snap.data) setSnapshot(snap.data);
    }
    setBusy(false);
  };

  const handleStartDraft = async () => {
    if (!room) return;
    setBusy(true);
    setErrorMsg(null);
    transitionGuardRef.current.clear();
    if (room.mode === 'multi_league') {
      const leagueSettings = normalizeMpLeagueSettings(room.settings.league);
      const nextGeneration = (room.settings.draftGeneration ?? 1) + 1;
      const res = await startMpLeagueRoom({
        roomId: room.id,
        settings: { ...room.settings, league: leagueSettings },
        draftGeneration: nextGeneration,
        live: createPreSeasonLive({
          seasonKey: `s${Date.now().toString(36)}`,
          settings: leagueSettings,
          stage: 'setup',
          draft: null,
          rev: 1,
        }),
      });
      setBusy(false);
      if (res.error) setErrorMsg(res.error);
      else {
        const snap = await fetchRoomSnapshot(room.id);
        if (snap.data) setSnapshot(snap.data);
      }
      return;
    }
    clearLocalMpDraft(room.code, playerId);
    const res = await startBlindDraft(room.id, room.settings);
    setBusy(false);
    if (res.error) setErrorMsg(res.error);
  };

  const handleLeaveRoom = async () => {
    if (room) {
      clearLocalMpDraft(room.code, playerId);
      await leaveRoom(room.id, playerId);
    }
    setSnapshot(null);
    setSavedReconnectCode(null);
    setErrorMsg(null);
    setLocalPhaseOverride(null);
    setLocalCommittedMatchId(null);
    syncedSquadKeyRef.current = null;
    transitionGuardRef.current.clear();
  };

  const handleSameTeamRematch = async () => {
    if (!room || !isHost) return;
    setBusy(true);
    transitionGuardRef.current.clear();
    await resetRoomForSameTeamRematch(room.id, room.settings, seriesWins);
    setLocalCommittedMatchId(null);
    setLocalPhaseOverride(null);
    setBusy(false);
  };

  const handleNewDraftRematch = async () => {
    if (!room || !isHost) return;
    setBusy(true);
    transitionGuardRef.current.clear();
    clearLocalMpDraft(room.code, playerId);
    await startBlindDraft(room.id, room.settings);
    setLocalCommittedMatchId(null);
    setLocalPhaseOverride(null);
    setBusy(false);
  };

  // =========================================================================
  // LOCAL TACTICS & SQUAD EDITING HELPERS
  // =========================================================================

  const myManagerTraitId: ManagerTraitId =
    myRow?.lineup_payload?.managerTraitId ??
    (isHost ? matchState?.hostManagerTraitId : matchState?.guestManagerTraitId) ??
    'big_game_hunter';

  const myChemistry = useMemo(
    () => calculateChemistry(myFormation, myStarters, myTactic, myManagerTraitId),
    [myFormation, myStarters, myTactic, myManagerTraitId],
  );

  const handleSwapMySquad = useCallback(
    (from: SlotRef, to: SlotRef) => {
      if (from.area === to.area && from.index === to.index) return;
      const nextS = [...myStarters];
      const nextB = [...myBench];
      const pA = from.area === 'starter' ? nextS[from.index] : nextB[from.index];
      const pB = to.area === 'starter' ? nextS[to.index] : nextB[to.index];
      if (from.area === 'starter') nextS[from.index] = pB;
      else nextB[from.index] = pB;
      if (to.area === 'starter') nextS[to.index] = pA;
      else nextB[to.index] = pA;
      setMyStarters(nextS);
      setMyBench(nextB);
    },
    [myStarters, myBench],
  );

  const handleChangeMyFormation = useCallback(
    (nextForm: FormationId) => {
      setMyFormation((prevForm) => {
        setMyStarters((prev) =>
          remapStartersForFormation(prev, prevForm, nextForm, myManagerTraitId),
        );
        return nextForm;
      });
    },
    [myManagerTraitId],
  );

  const handleAutoOptimizeMySquad = useCallback(() => {
    const opt = optimizeBestLineup(
      myStarters,
      myBench,
      myFormation,
      myTactic,
      myManagerTraitId,
    );
    setMyStarters(opt.starters);
    setMyBench(opt.bench);
  }, [myStarters, myBench, myFormation, myTactic, myManagerTraitId]);

  const handleOptimizeMyHalftimeStarters = useCallback(
    (tacticOverride?: TacticId) => {
      setMyStarters((prev) =>
        optimizeCurrentStartersForFormation(
          prev,
          myFormation,
          tacticOverride ?? myTactic,
          myManagerTraitId,
        ),
      );
    },
    [myFormation, myTactic, myManagerTraitId],
  );

  const submitMyBarrier = useCallback(
    async (
      phase: MpTacticBarrierPhase,
      barrierKey: string,
      tacticToSubmit: TacticId,
      subIds: string[] = [],
    ) => {
      if (!room) return;
      const cleanStarters = myStarters.filter((p): p is Player => p !== null);
      const cleanBench = myBench.filter((p): p is Player => p !== null);
      if (cleanStarters.length < 11) return;
      setErrorMsg(null);
      setSubmittingBarrier(barrierKey);
      const res = await submitTacticBarrier(room.id, playerId, {
        phase,
        barrierKey,
        formation: myFormation,
        tactic: tacticToSubmit,
        starters: cleanStarters,
        bench: cleanBench,
        subPlayerIds: subIds,
        submittedAt: new Date().toISOString(),
      });
      if (res.error) {
        setSubmittingBarrier(null);
        setErrorMsg(res.error);
        return;
      }
      const snap = await fetchRoomSnapshot(room.id);
      if (snap.data) setSnapshot(snap.data);
    },
    [room, playerId, myFormation, myStarters, myBench],
  );

  const handleCancelPreMatchBarrier = useCallback(async () => {
    if (!room) return;
    setErrorMsg(null);
    const res = await clearMyTacticBarrier(room.id, playerId);
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    setSubmittingBarrier(null);
    const snap = await fetchRoomSnapshot(room.id);
    if (snap.data) setSnapshot(snap.data);
  }, [room, playerId]);

  // =========================================================================
  // SHARED CLUBS & PLAYER LOOKUP FOR BROADCAST & REPORT
  // =========================================================================

  const clubsById = useMemo<Record<string, Club>>(() => {
    const map: Record<string, Club> = {};
    if (!hostRow || !guestRow) return map;
    const hPayload = hostRow.lineup_payload;
    const gPayload = guestRow.lineup_payload;

    const matchNum = room?.settings.matchNumber ?? 1;
    const preMatchKey = `pre_match:${room?.settings.draftGeneration ?? 1}:${matchNum}`;
    const hPreSub =
      hostRow.tactic_submission?.barrierKey === preMatchKey
        ? hostRow.tactic_submission
        : null;
    const gPreSub =
      guestRow.tactic_submission?.barrierKey === preMatchKey
        ? guestRow.tactic_submission
        : null;
    const bothPreLocked = Boolean(hPreSub && gPreSub);

    const hStarters =
      matchState?.hostStarters ??
      (bothPreLocked ? hPreSub?.starters : undefined) ??
      hPayload?.starters ??
      [];
    const gStarters =
      matchState?.guestStarters ??
      (bothPreLocked ? gPreSub?.starters : undefined) ??
      gPayload?.starters ??
      [];
    const hForm =
      matchState?.hostFormation ??
      (bothPreLocked ? hPreSub?.formation : undefined) ??
      hPayload?.formation ??
      '4-3-3';
    const gForm =
      matchState?.guestFormation ??
      (bothPreLocked ? gPreSub?.formation : undefined) ??
      gPayload?.formation ??
      '4-3-3';
    const hTac =
      matchState?.hostTactic ??
      (bothPreLocked ? hPreSub?.tactic : undefined) ??
      hPayload?.defaultTactic ??
      'balanced';
    const gTac =
      matchState?.guestTactic ??
      (bothPreLocked ? gPreSub?.tactic : undefined) ??
      gPayload?.defaultTactic ??
      'balanced';
    const hTrait =
      matchState?.hostManagerTraitId ?? hPayload?.managerTraitId ?? 'big_game_hunter';
    const gTrait =
      matchState?.guestManagerTraitId ?? gPayload?.managerTraitId ?? 'big_game_hunter';

    map[MP_HOST_TEAM_ID] = buildClubFromLineup({
      id: MP_HOST_TEAM_ID,
      profile: hostRow.club_profile,
      formation: hForm,
      tactic: hTac,
      starters: hStarters,
      managerTraitId: hTrait,
      isUser: isHost,
    });
    map[MP_GUEST_TEAM_ID] = buildClubFromLineup({
      id: MP_GUEST_TEAM_ID,
      profile: guestRow.club_profile,
      formation: gForm,
      tactic: gTac,
      starters: gStarters,
      managerTraitId: gTrait,
      isUser: !isHost,
    });
    return map;
  }, [hostRow, guestRow, room?.settings.draftGeneration, room?.settings.matchNumber, matchState, isHost]);

  const allPlayerLookup = useMemo(() => {
    const map = new Map<string, Player>();
    const add = (list?: (Player | null)[]) => {
      if (!list) return;
      for (const p of list) if (p) map.set(p.id, p);
    };
    add(myStarters);
    add(myBench);
    add(hostRow?.lineup_payload?.starters);
    add(hostRow?.lineup_payload?.bench);
    add(guestRow?.lineup_payload?.starters);
    add(guestRow?.lineup_payload?.bench);
    add(matchState?.hostStarters);
    add(matchState?.hostBench);
    add(matchState?.guestStarters);
    add(matchState?.guestBench);
    return map;
  }, [myStarters, myBench, hostRow, guestRow, matchState]);

  // =========================================================================
  // LIVE BROADCAST OVERRIDE ADAPTER (Both Host & Guest!)
  // =========================================================================

  const effectiveLivePhase: MpMatchPhase | null = matchState
    ? localPhaseOverride ?? matchState.phase
    : null;

  const currentBarrierKey = useMemo(() => {
    if (!matchState || !effectiveLivePhase) return null;
    if (effectiveLivePhase === 'halftime') return `halftime:${matchState.matchId}`;
    if (effectiveLivePhase === 'extra_time_break') {
      return `extra_time_break:${matchState.matchId}`;
    }
    if (effectiveLivePhase === 'extra_time_ht') {
      return `extra_time_ht:${matchState.matchId}`;
    }
    return null;
  }, [matchState, effectiveLivePhase]);

  const hasSubmittedCurrentLiveBarrier = Boolean(
    currentBarrierKey &&
      (submittingBarrier === currentBarrierKey ||
        myRow?.tactic_submission?.barrierKey === currentBarrierKey),
  );

  const waitingForOpponentLabel = useMemo(() => {
    if (!hasSubmittedCurrentLiveBarrier || !effectiveLivePhase) return null;
    const oppName = oppRow?.nickname ?? '상대';
    if (effectiveLivePhase === 'halftime') {
      return `${oppName} 감독의 후반 전술 확정 대기 중...`;
    }
    if (effectiveLivePhase === 'extra_time_break') {
      return `${oppName} 감독의 연장 전반 전술 대기 중...`;
    }
    if (effectiveLivePhase === 'extra_time_ht') {
      return `${oppName} 감독의 연장 후반 전술 대기 중...`;
    }
    return null;
  }, [hasSubmittedCurrentLiveBarrier, effectiveLivePhase, oppRow?.nickname]);

  const handleCommitMatch = useCallback(() => {
    if (!room || !matchState?.finalResult) return;
    setLocalCommittedMatchId(matchState.matchId);

    // Host records final series tally and marks room status 'finished' ONCE
    if (isHost && !isMpFinishedStatus(room.status) && matchState.phase !== 'finished') {
      const guardKey = `finish:${matchState.matchId}`;
      if (!transitionGuardRef.current.has(guardKey)) {
        transitionGuardRef.current.add(guardKey);
        const res = matchState.finalResult;
        const nextSeries = { ...seriesWins };
        if (res.extraTime?.penalties) {
          if (res.extraTime.penalties.winnerTeamId === MP_HOST_TEAM_ID) {
            nextSeries.host += 1;
          } else {
            nextSeries.guest += 1;
          }
        } else if (res.homeGoals > res.awayGoals) {
          nextSeries.host += 1;
        } else if (res.awayGoals > res.homeGoals) {
          nextSeries.guest += 1;
        } else {
          nextSeries.draws += 1;
        }
        void (async () => {
          await publishMatchState(room.id, 'finished', {
            ...matchState,
            phase: 'finished',
            seriesWins: nextSeries,
            updatedAt: new Date().toISOString(),
          });
          const snap = await fetchRoomSnapshot(room.id);
          if (snap.data) setSnapshot(snap.data);
        })();
      }
    }
  }, [room, matchState, isHost, seriesWins]);

  const liveOverride: LiveMatchBroadcastOverride | undefined = useMemo(() => {
    if (!room || !matchState || !myRow || !oppRow || !effectiveLivePhase) {
      return undefined;
    }
    if (
      !isMatchLiveNow ||
      localCommittedMatchId === matchState.matchId ||
      effectiveLivePhase === 'finished'
    ) {
      return undefined;
    }

    const adaptedLiveHalftime: LiveHalftimeState = {
      ...matchState.liveHalftime,
      isUserHome: isHost,
      userTacticAtKickoff: isHost ? matchState.hostTactic : matchState.guestTactic,
      userFormationAtKickoff: isHost
        ? matchState.hostFormation
        : matchState.guestFormation,
      halftimeSubsMade: isHost
        ? matchState.hostHalftimeSubIds.length
        : matchState.guestHalftimeSubIds.length,
      phase: effectiveLivePhase,
    };

    const myManagerState: ManagerRouletteState = {
      name: myRow.nickname,
      avatar: myRow.avatar_json ?? DEFAULT_MANAGER_AVATAR,
      traitId: myManagerTraitId,
      rerollsRemaining: 0,
      hasSpun: true,
    };

    return {
      state: {
        formation: myFormation,
        defaultTactic: myTactic,
        starters: myStarters,
        bench: myBench,
        manager: myManagerState,
        userClub: myRow.club_profile,
        season: {
          liveHalftime: adaptedLiveHalftime,
          allPlayerStats: {},
        },
      },
      myTeamId,
      opponentRoster: isHost ? matchState.guestStarters : matchState.hostStarters,
      opponentManagerOverride: {
        name: oppRow.nickname,
        ovr: 86,
        traitId: isHost
          ? matchState.guestManagerTraitId
          : matchState.hostManagerTraitId,
      },
      disableInstantFinish: true,
      disableLiveSub: true,
      lockSpeed: 1,
      waitingForOpponentLabel,
      commitButtonLabel: '경기 리포트 보기 →',
      chemistry: myChemistry,
      changeFormation: handleChangeMyFormation,
      optimizeHalftimeStarters: handleOptimizeMyHalftimeStarters,
      swapSquadPositions: handleSwapMySquad,
      enterHalftimeLocker: () => {
        setLocalPhaseOverride('halftime');
      },
      startSecondHalfBroadcast: ({ secondHalfTactic, subPlayerIds = [] }) => {
        setMyTactic(secondHalfTactic);
        void submitMyBarrier(
          'halftime',
          `halftime:${matchState.matchId}`,
          secondHalfTactic,
          subPlayerIds,
        );
      },
      applySecondHalfLiveSub: () => {
        // Disabled during synced 1v1 PvP broadcast (subs handled at Halftime & ET Break)
      },
      enterExtraTimeBreak: () => {
        setLocalPhaseOverride('extra_time_break');
      },
      startExtraTimeBroadcast: (params) => {
        const nextTac = params?.etTactic ?? myTactic;
        setMyTactic(nextTac);
        void submitMyBarrier(
          'extra_time_break',
          `extra_time_break:${matchState.matchId}`,
          nextTac,
          [],
        );
      },
      enterEtHalftimeLocker: () => {
        setLocalPhaseOverride('extra_time_ht');
      },
      startEtSecondHalfBroadcast: (params) => {
        const nextTac = params?.etTactic ?? myTactic;
        setMyTactic(nextTac);
        void submitMyBarrier(
          'extra_time_ht',
          `extra_time_ht:${matchState.matchId}`,
          nextTac,
          [],
        );
      },
      enterPenaltyShootout: () => {
        setLocalPhaseOverride('penalties');
      },
      commitLiveMatch: handleCommitMatch,
    };
  }, [
    room,
    matchState,
    myRow,
    oppRow,
    effectiveLivePhase,
    isMatchLiveNow,
    localCommittedMatchId,
    isHost,
    myManagerTraitId,
    myFormation,
    myTactic,
    myStarters,
    myBench,
    myTeamId,
    waitingForOpponentLabel,
    myChemistry,
    handleChangeMyFormation,
    handleOptimizeMyHalftimeStarters,
    handleSwapMySquad,
    submitMyBarrier,
    handleCommitMatch,
  ]);

  // =========================================================================
  // RENDER BY ROOM STAGE
  // =========================================================================

  // 1) Entry or Lobby
  if (!snapshot || !room || room.status === 'lobby') {
    return (
      <MultiplayerLobby
        playerId={playerId}
        nickname={nickname}
        onChangeNickname={handleNicknameChange}
        avatar={state.manager.avatar ?? DEFAULT_MANAGER_AVATAR}
        clubProfile={state.userClub}
        snapshot={snapshot}
        onlinePlayerIds={onlinePlayerIds}
        connectionStatus={connectionStatus}
        busy={busy}
        errorMsg={errorMsg}
        savedReconnectCode={savedReconnectCode}
        initialJoinCode={multiplayerInitialRoomCode ?? ''}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onUpdateSettings={handleUpdateSettings}
        onUpdateCustomProfile={(payload) => void handleUpdateCustomProfile(payload)}
        onToggleReady={handleToggleReady}
        onStartDraft={handleStartDraft}
        onLeaveRoom={handleLeaveRoom}
        onCloseMultiplayer={closeMultiplayer}
      />
    );
  }

  // v8.0 Multi league (2~4 friends): fully separate screen flow, 1v1 logic below is untouched
  if (room.mode === 'multi_league') {
    return (
      <MpLeagueRoot
        snapshot={snapshot}
        playerId={playerId}
        onlinePlayerIds={onlinePlayerIds}
        connectionStatus={connectionStatus}
        onLeaveRoom={() => {
          // Keep my seat so I can reconnect with the saved room code mid-season
          setSnapshot(null);
          setErrorMsg(null);
        }}
      />
    );
  }

  // 2) Mutually Private Blind Draft
  if (room.status === 'drafting') {
    return (
      <MultiplayerBlindDraft
        snapshot={snapshot}
        playerId={playerId}
        opponent={oppRow}
        opponentOnline={opponentOnline}
        onProgressUpdate={(progress) => {
          void updateDraftProgress(room.id, playerId, progress);
        }}
        onSubmitCompletedLineup={async (payload: MpLineupPayload) => {
          const res = await submitBlindDraftLineup(room.id, playerId, payload);
          if (res.error) {
            setErrorMsg(res.error);
            return;
          }
          const snap = await fetchRoomSnapshot(room.id);
          if (snap.data) setSnapshot(snap.data);
        }}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  // 3) Pre-Match Reveal & Tactics Room
  if (
    !isMatchLiveNow &&
    !isMatchFinishedNow &&
    isMpTacticsStatus(room.status) &&
    myRow?.lineup_payload &&
    oppRow?.lineup_payload
  ) {
    const matchNumber = room.settings.matchNumber ?? 1;
    const preMatchKey = `pre_match:${room.settings.draftGeneration ?? 1}:${matchNumber}`;
    const myLocked =
      submittingBarrier === preMatchKey ||
      myRow.tactic_submission?.barrierKey === preMatchKey;
    const oppLocked = oppRow.tactic_submission?.barrierKey === preMatchKey;
    const bothLocked = myLocked && oppLocked;
    const oppClub = clubsById[oppTeamId];
    const displayedOppRoster =
      bothLocked && oppRow.tactic_submission?.starters?.length === 11
        ? oppRow.tactic_submission.starters
        : oppRow.lineup_payload.starters;

    return (
      <div className="mx-auto max-w-6xl px-2.5 py-3 sm:px-4 sm:py-5 space-y-3">
        {/* Top Connection & Reveal Header */}
        <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-extrabold text-sky-300">
              <Swords className="w-3.5 h-3.5" />
              라인업 공개 · 매치 #{matchNumber}
            </span>
            <span className="font-mono text-xs text-slate-400">#{room.code}</span>
            <span
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                opponentOnline
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-amber-500/15 text-amber-300'
              }`}
            >
              {opponentOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {opponentOnline ? `${oppRow.nickname} 접속 중` : `${oppRow.nickname} 재접속 대기`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLeaveRoom}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#111822] px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-300 cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            나가기
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 px-3.5 py-2 text-xs font-bold text-rose-200">
            {errorMsg}
          </div>
        )}

        {oppClub && (
          <MatchDayTacticsRoom
            opponent={oppClub}
            opponentRoster={displayedOppRoster}
            opponentSubtitle={`${oppRow.nickname} 감독`}
            opponentManagerOverride={{
              name: oppRow.nickname,
              ovr: 86,
              traitId: oppRow.lineup_payload.managerTraitId,
            }}
            isHome={isHost}
            headerBadge={`1대1 블라인드 대전 · 매치 #${matchNumber}`}
            headerAccent="ucl"
            activeTactic={myTactic}
            defaultTactic={myRow.lineup_payload.defaultTactic}
            formation={myFormation}
            starters={myStarters}
            bench={myBench}
            chemistry={myChemistry}
            managerTraitId={myManagerTraitId}
            locked={myLocked}
            blindOpponentStatus={bothLocked ? null : oppLocked ? 'locked' : 'editing'}
            onSelectTactic={setMyTactic}
            onChangeFormation={handleChangeMyFormation}
            onSwapSquad={handleSwapMySquad}
            onAutoOptimize={handleAutoOptimizeMySquad}
            onInspectPlayer={(player, slotSubPosition) =>
              setInspected({ player, slotSubPosition })
            }
            onClickOpponentPlayerName={(pid) => {
              const p = allPlayerLookup.get(pid);
              if (p) setInspected({ player: p });
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold ${
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
                  {oppRow.nickname}:{' '}
                  {oppLocked ? '전술 확정 (공개 대기)' : '전술·포메이션 수정 중...'}
                </span>
              </div>

              {myLocked ? (
                <div className="flex flex-wrap items-center gap-2">
                  {!oppLocked && (
                    <button
                      type="button"
                      onClick={() => void handleCancelPreMatchBarrier()}
                      className="rounded-xl border border-slate-700 bg-[#111822] px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
                    >
                      전술 수정
                    </button>
                  )}
                  <div className="inline-flex items-center gap-2 rounded-xl border border-sky-400/45 bg-sky-500/15 px-5 py-2.5 text-sm font-extrabold text-sky-200">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {bothLocked ? '최종 전술 공개 중...' : '상대 전술 확정 대기 중...'}
                  </div>
                </div>
              ) : (
                <button
                  id="mp-lock-prematch-btn"
                  type="button"
                  onClick={() =>
                    void submitMyBarrier('pre_match', preMatchKey, myTactic, [])
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  전술 확정
                </button>
              )}
            </div>
          </MatchDayTacticsRoom>
        )}

        {bothLocked &&
          hostRow?.tactic_submission?.barrierKey === preMatchKey &&
          guestRow?.tactic_submission?.barrierKey === preMatchKey &&
          hostRow.lineup_payload &&
          guestRow.lineup_payload && (
            <PreKickoffRevealModal
              roomCode={room.code}
              matchNumber={matchNumber}
              isHost={isHost}
              hostRow={hostRow}
              guestRow={guestRow}
              hostSub={hostRow.tactic_submission}
              guestSub={guestRow.tactic_submission}
              hostTraitId={hostRow.lineup_payload.managerTraitId}
              guestTraitId={guestRow.lineup_payload.managerTraitId}
              busy={busy}
              errorMsg={errorMsg}
              onToggleReady={(nextReady) => void handleToggleReady(nextReady)}
              onHostKickoff={() => void handleHostKickoffMatch()}
              onInspectPlayer={(player, slotSubPosition) =>
                setInspected({ player, slotSubPosition })
              }
            />
          )}

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

  // 4) Synchronized 2D Live Broadcast
  if (liveOverride) {
    return (
      <div className="relative">
        {!opponentOnline && oppRow && (
          <div className="fixed top-2 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-amber-400/50 bg-slate-950/95 px-3.5 py-1 text-[11px] font-bold text-amber-300 shadow-lg flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5" />
            {oppRow.nickname} 연결 끊김 · 재접속 대기 중
          </div>
        )}
        <LiveMatchBroadcast clubsById={clubsById} override={liveOverride} />
      </div>
    );
  }

  // 5) Post-Match Report & Rematch Hub
  const finalResult = matchState?.finalResult ?? null;
  if (finalResult && hostRow && guestRow && myRow && oppRow) {
    const myGoals = isHost ? finalResult.homeGoals : finalResult.awayGoals;
    const oppGoals = isHost ? finalResult.awayGoals : finalResult.homeGoals;
    const outcome = finalResult.extraTime?.penalties
      ? finalResult.extraTime.penalties.winnerTeamId === myTeamId
        ? 'WIN'
        : 'LOSS'
      : myGoals > oppGoals
        ? 'WIN'
        : myGoals < oppGoals
          ? 'LOSS'
          : 'DRAW';

    const currentMatchId = matchState?.matchId ?? 'mp-match-1';
    const showPostMatchPopup = dismissedPostMatchPopupId !== currentMatchId;
    const seriesSummaryText = `상대 전적 · ${hostRow.nickname} ${seriesWins.host}승 ${
      seriesWins.draws > 0 ? `${seriesWins.draws}무 ` : ''
    }${seriesWins.guest}승 ${guestRow.nickname}`;

    return (
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-5 sm:py-6 space-y-4">
        {showPostMatchPopup && (
          <MpPostMatchManagerPopup
            matchId={currentMatchId}
            outcome={outcome}
            myRow={myRow}
            oppRow={oppRow}
            myGoals={myGoals}
            oppGoals={oppGoals}
            finalResult={finalResult}
            seriesSummaryText={seriesSummaryText}
            onClose={() => setDismissedPostMatchPopupId(currentMatchId)}
          />
        )}

        {/* Result Banner + Series Scoreboard */}
        <div
          className={`rounded-2xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 ${
            outcome === 'WIN'
              ? 'border-emerald-500/45 bg-emerald-950/20'
              : outcome === 'LOSS'
                ? 'border-rose-500/40 bg-rose-950/15'
                : 'border-amber-500/40 bg-amber-950/15'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                outcome === 'WIN'
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                  : outcome === 'LOSS'
                    ? 'border-rose-400/45 bg-rose-500/15 text-rose-300'
                    : 'border-amber-400/45 bg-amber-500/15 text-amber-300'
              }`}
            >
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-extrabold text-white">
                {outcome === 'WIN'
                  ? '1대1 대전 승리!'
                  : outcome === 'LOSS'
                    ? '1대1 대전 패배'
                    : '무승부'}
              </div>
              <div className="text-xs font-bold text-slate-400 tabular-nums">
                {seriesSummaryText}
              </div>
            </div>
          </div>

          {/* Rematch Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDismissedPostMatchPopupId(null)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#111822] px-3 py-2.5 text-xs font-bold text-slate-200 hover:border-slate-500 cursor-pointer"
            >
              <MessageSquareQuote className="w-3.5 h-3.5 text-amber-300" />
              {outcome === 'WIN'
                ? '승장 연출 보기'
                : outcome === 'LOSS'
                  ? '상대 도발 보기'
                  : '감독 연출 보기'}
            </button>
            {isHost ? (
              <>
                <button
                  id="mp-rematch-same-btn"
                  type="button"
                  disabled={busy}
                  onClick={handleSameTeamRematch}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  같은 팀으로 재대결
                </button>
                <button
                  id="mp-rematch-draft-btn"
                  type="button"
                  disabled={busy}
                  onClick={handleNewDraftRematch}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/45 bg-amber-500/15 px-4 py-2.5 text-xs font-extrabold text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5" />
                  새 드래프트로 1대1
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#111822] px-3.5 py-2 text-xs font-bold text-slate-300">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                방장의 재대결 선택 대기 중
              </span>
            )}
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#111822] px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:border-rose-500/40 hover:text-rose-200 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              방 나가기
            </button>
          </div>
        </div>

        {/* Full Match Report */}
        <MatchReportPanel
          match={finalResult}
          clubsById={clubsById}
          myTeamId={myTeamId}
          onOpenDetail={setDetailMatch}
          onSelectPlayer={(pid) => {
            const p = allPlayerLookup.get(pid);
            if (p) setInspected({ player: p });
          }}
        />

        {detailMatch && (
          <MatchDetailModal
            match={detailMatch}
            clubsById={clubsById}
            onClose={() => setDetailMatch(null)}
            onSelectPlayer={(pid) => {
              const p = allPlayerLookup.get(pid);
              if (p) setInspected({ player: p });
            }}
          />
        )}

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

  // Fallback transitional loading state
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
      <div className="text-sm font-bold text-slate-300">방 상태 동기화 중...</div>
      <button
        type="button"
        onClick={handleLeaveRoom}
        className="rounded-lg border border-slate-700 bg-[#111822] px-4 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
      >
        로비로 돌아가기
      </button>
    </div>
  );
}

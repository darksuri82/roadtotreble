import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearMyTacticBarrier,
  submitTacticBarrier,
} from '../../../services/multiplayerService';
import {
  enqueueLeagueAction,
  fetchLeagueBundle,
  subscribeToLeague,
  updateLeagueActivity,
  updateLeaguePayload,
} from '../../../services/mpLeagueService';
import type { LeagueId } from '../../../types/league';
import type {
  MpLeagueActionKind,
  MpLeagueActivity,
  MpLeagueLive,
  MpLeagueLockReason,
  MpLeaguePickRow,
  MpLeagueSquadPayload,
  MpSquadInput,
} from '../../../types/mpLeague';
import type { MpRoomSnapshot, MpTacticSubmission } from '../../../types/multiplayer';
import { MpLeagueDashboard } from './MpLeagueDashboard';
import { MpLeagueFinalBoard } from './MpLeagueFinalBoard';
import { MpLeagueH2HView } from './MpLeagueH2HView';
import { MpLeaguePodiumPopup } from './MpLeaguePodiumPopup';
import { MpLeagueSnakeDraft } from './MpLeagueSnakeDraft';
import { useMpLeagueHost } from './useMpLeagueHost';

const LEAGUE_LABEL: Record<LeagueId, string> = {
  epl: 'EPL',
  laliga: '라리가',
  seriea: '세리에A',
  bundesliga: '분데스리가',
  ligue1: '리그1',
};

interface MpLeagueRootProps {
  snapshot: MpRoomSnapshot;
  playerId: string;
  onlinePlayerIds: string[];
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
  onLeaveRoom: () => void;
}

export function MpLeagueRoot({
  snapshot,
  playerId,
  onlinePlayerIds,
  connectionStatus,
  onLeaveRoom,
}: MpLeagueRootProps) {
  const { room, players } = snapshot;
  const isHost = room.host_player_id === playerId;
  const draftGeneration = room.settings.draftGeneration ?? 1;
  const myRow = players.find((p) => p.player_id === playerId) ?? null;

  const [live, setLive] = useState<MpLeagueLive | null>(null);
  const [picks, setPicks] = useState<MpLeaguePickRow[]>([]);
  const [changeCounter, setChangeCounter] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activity, setActivity] = useState<MpLeagueActivity>(
    () => myRow?.activity ?? {},
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [dismissedResolutionKey, setDismissedResolutionKey] = useState<string | null>(null);
  const [busyRev, setBusyRev] = useState<number | null>(null);
  const [answeredEventId, setAnsweredEventId] = useState<string | null>(null);
  const [podiumSeenKey, setPodiumSeenKey] = useState<string | null>(null);
  const [podiumOpen, setPodiumOpen] = useState(false);
  const activityRef = useRef<MpLeagueActivity>(activity);

  // Realtime: public league state + snake draft picks
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      const res = await fetchLeagueBundle(room.id, draftGeneration);
      if (disposed) return;
      if (res.data) {
        setLive(res.data.live);
        setPicks(res.data.picks);
        setErrorMsg(null);
      } else if (res.error) {
        setErrorMsg(res.error);
      }
      setChangeCounter((c) => c + 1);
    };
    const unsubscribe = subscribeToLeague({
      roomId: room.id,
      onChange: () => {
        void refresh();
      },
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [room.id, draftGeneration]);

  const host = useMpLeagueHost({
    enabled: isHost,
    room,
    players,
    onlinePlayerIds,
    live,
    picks,
    changeCounter,
  });

  const writeActivity = useCallback(
    (next: MpLeagueActivity) => {
      activityRef.current = next;
      setActivity(next);
      void updateLeagueActivity(room.id, playerId, next);
    },
    [room.id, playerId],
  );

  const ack = useCallback(
    (key: string) => {
      const prev = activityRef.current;
      if (prev.ackKeys?.includes(key)) return;
      writeActivity({ ...prev, ackKeys: [...(prev.ackKeys ?? []), key].slice(-10) });
    },
    [writeActivity],
  );

  const myHuman = live?.humans.find((h) => h.playerId === playerId) ?? null;
  const myClubId = myHuman?.clubId ?? null;
  const mine = myClubId && live ? live.byClub[myClubId] ?? null : null;

  const mySquad = useMemo<MpSquadInput | null>(() => {
    const p = myRow?.league_payload;
    if (!p || p.starters?.length !== 11 || p.bench?.length !== 5) return null;
    return {
      managerTraitId: p.managerTraitId,
      formation: p.formation,
      tactic: p.tactic,
      starters: p.starters,
      bench: p.bench,
    };
  }, [myRow?.league_payload]);

  const savePayload = useCallback(
    async (payload: MpLeagueSquadPayload) => {
      const res = await updateLeaguePayload(room.id, playerId, payload);
      if (res.error) setErrorMsg(res.error);
    },
    [room.id, playerId],
  );

  const saveSquad = useCallback(
    (next: MpSquadInput) => {
      void savePayload({
        ...next,
        setupReady: true,
        rev: (myRow?.league_payload?.rev ?? 0) + 1,
        by: 'player',
      });
    },
    [savePayload, myRow?.league_payload?.rev],
  );

  // Global pause lock: any of these screens on my side stops the auto-advance for everyone
  const resolutionKey = mine?.resolution
    ? `${mine.resolution.eventTitle}:${mine.resolution.chosenLabel}`
    : null;
  const interviewOpen = Boolean(
    mine?.event || (resolutionKey && resolutionKey !== dismissedResolutionKey),
  );
  const injuryOpen = Boolean(mine && mine.alerts.length > 0);
  const inSeason = live?.stage === 'league' || live?.stage === 'ucl';
  const desiredLock: MpLeagueLockReason | null = !inSeason
    ? null
    : editorOpen
      ? 'tactics'
      : interviewOpen
        ? 'interview'
        : injuryOpen
          ? 'injury'
          : null;

  useEffect(() => {
    const currentReason = activityRef.current.lock?.reason ?? null;
    if (currentReason === desiredLock) return;
    const t = window.setTimeout(() => {
      writeActivity({
        ...activityRef.current,
        lock: desiredLock
          ? { reason: desiredLock, since: new Date().toISOString() }
          : null,
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [desiredLock, writeActivity]);

  const sendAction = useCallback(
    async (kind: MpLeagueActionKind, payload: Record<string, unknown>) => {
      setBusyRev(live?.rev ?? 0);
      const res = await enqueueLeagueAction({ roomId: room.id, playerId, kind, payload });
      if (res.error) {
        setErrorMsg(res.error);
        setBusyRev(null);
      }
    },
    [room.id, playerId, live?.rev],
  );

  // Leaving the screen must never keep the whole room paused
  useEffect(() => {
    return () => {
      if (activityRef.current.lock) {
        void updateLeagueActivity(room.id, playerId, {
          ...activityRef.current,
          lock: null,
        });
      }
    };
  }, [room.id, playerId]);

  // Safety: never leave the trade buttons disabled if the host answer got lost
  useEffect(() => {
    if (busyRev === null) return;
    const t = window.setTimeout(() => setBusyRev(null), 8000);
    return () => window.clearTimeout(t);
  }, [busyRev]);

  const actionBusy = busyRev !== null && live !== null && busyRev === live.rev;

  const finalKey = live?.stage === 'final' ? live.seasonKey : null;
  useEffect(() => {
    if (!finalKey || podiumSeenKey === finalKey) return;
    const t = window.setTimeout(() => {
      setPodiumSeenKey(finalKey);
      setPodiumOpen(true);
    }, 600);
    return () => window.clearTimeout(t);
  }, [finalKey, podiumSeenKey]);

  if (!live) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
        <div className="text-sm font-bold text-slate-300">멀티 리그 동기화 중</div>
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 px-3.5 py-2 text-xs font-bold text-rose-200">
            {errorMsg}
          </div>
        )}
        <button
          type="button"
          onClick={onLeaveRoom}
          className="rounded-lg border border-slate-700 bg-[#111822] px-4 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
        >
          로비로 돌아가기
        </button>
      </div>
    );
  }

  if (live.stage === 'setup' || live.stage === 'draft') {
    return (
      <>
        {(errorMsg || host.hostError) && (
          <div className="mx-auto mt-3 max-w-6xl px-2.5 sm:px-4">
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 px-3.5 py-2 text-xs font-bold text-rose-200">
              {errorMsg ?? host.hostError}
            </div>
          </div>
        )}
        <MpLeagueSnakeDraft
          room={room}
          players={players}
          playerId={playerId}
          live={live}
          picks={picks}
          onlinePlayerIds={onlinePlayerIds}
          onSavePayload={savePayload}
          onLeaveRoom={onLeaveRoom}
        />
      </>
    );
  }

  if (live.stage === 'final' && live.final) {
    const showPodium = podiumOpen && live.final.rows.length >= 3;
    return (
      <>
        <MpLeagueFinalBoard
          final={live.final}
          humans={live.humans}
          myClubId={myClubId}
          leagueLabel={LEAGUE_LABEL[live.leagueId]}
          onOpenPodium={
            live.final.rows.length >= 3 ? () => setPodiumOpen(true) : undefined
          }
          onLeaveRoom={onLeaveRoom}
        />
        {showPodium && (
          <MpLeaguePodiumPopup
            rows={live.final.rows}
            humans={live.humans}
            onClose={() => setPodiumOpen(false)}
          />
        )}
      </>
    );
  }

  if (live.h2h) {
    return (
      <MpLeagueH2HView
        h2h={live.h2h}
        seasonKey={live.seasonKey}
        humans={live.humans}
        players={players}
        myClubId={myClubId}
        ackKeys={activity.ackKeys ?? []}
        onSubmitBarrier={async (submission: MpTacticSubmission) => {
          const res = await submitTacticBarrier(room.id, playerId, submission);
          if (res.error) setErrorMsg(res.error);
          else if (submission.phase === 'pre_match' && mySquad) {
            saveSquad({
              ...mySquad,
              formation: submission.formation,
              tactic: submission.tactic,
              starters: submission.starters,
              bench: submission.bench,
            });
          }
        }}
        onClearBarrier={async () => {
          await clearMyTacticBarrier(room.id, playerId);
        }}
        onAck={ack}
      />
    );
  }

  return (
    <MpLeagueDashboard
      roomCode={room.code}
      live={live}
      players={players}
      playerId={playerId}
      isHost={isHost}
      onlinePlayerIds={onlinePlayerIds}
      connectionStatus={connectionStatus}
      mySquad={mySquad}
      ackKeys={activity.ackKeys ?? []}
      actionBusy={actionBusy}
      editorOpen={editorOpen}
      dismissedResolutionKey={dismissedResolutionKey}
      hostMissing={host.hostMissing}
      errorMsg={errorMsg ?? host.hostError}
      onOpenEditor={() => setEditorOpen(true)}
      onCloseEditor={() => setEditorOpen(false)}
      onSaveSquad={(next) => {
        saveSquad(next);
        setEditorOpen(false);
      }}
      onAck={ack}
      hiddenEventId={answeredEventId}
      onEventChoice={(choiceId) => {
        // Hide the question right away so one answer is sent exactly once
        setAnsweredEventId(mine?.event?.templateId ?? null);
        void sendAction('event_choice', { choiceId });
      }}
      onDismissResolution={setDismissedResolutionKey}
      onInjuryAck={() => void sendAction('injury_ack', {})}
      onTradeAccept={(offerId) => void sendAction('trade_accept', { offerId })}
      onTradeReject={(offerId) => void sendAction('trade_reject', { offerId })}
      onTradeCounter={(offerId, sendPlayerId) =>
        void sendAction('trade_counter', { offerId, sendPlayerId })
      }
      onSetAutoMs={host.setAutoMs}
      onForceResume={host.forceResume}
      onLeaveRoom={onLeaveRoom}
    />
  );
}

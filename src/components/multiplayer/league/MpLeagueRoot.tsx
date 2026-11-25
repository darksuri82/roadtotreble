import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyAwakeningToPlayer } from '../../../engine/awakeningEngine';
import {
  clearMyTacticBarrier,
  submitTacticBarrier,
} from '../../../services/multiplayerService';
import {
  broadcastLeagueEvent,
  enqueueLeagueAction,
  fetchLeagueBundle,
  fetchLeagueLiveOnly,
  fetchLeaguePicks,
  fetchLeagueRev,
  subscribeToLeague,
  updateLeagueActivity,
  updateLeaguePayload,
} from '../../../services/mpLeagueService';
import type { LeagueId } from '../../../types/league';
import type {
  MpLeagueActionKind,
  MpLeagueActivity,
  MpLeagueBroadcastEvent,
  MpLeagueLive,
  MpLeagueLockReason,
  MpLeaguePickRow,
  MpLeagueSquadPayload,
  MpSquadInput,
} from '../../../types/mpLeague';
import type { MpRoomSnapshot, MpTacticSubmission } from '../../../types/multiplayer';
import { MpLeagueDashboard } from './MpLeagueDashboard';
import { MpLeagueDuelResultPopup } from './MpLeagueDuelResultPopup';
import { MpLeagueFinalBoard } from './MpLeagueFinalBoard';
import { MpLeagueH2HView } from './MpLeagueH2HView';
import { MpLeaguePodiumPopup } from './MpLeaguePodiumPopup';
import { MpLeagueSnakeDraft } from './MpLeagueSnakeDraft';
import { hasPlayableTickerMatches, isMpTickerPlayed } from './MpLiveTicker';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activity, setActivity] = useState<MpLeagueActivity>(
    () => myRow?.activity ?? {},
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [dismissedResolutionKey, setDismissedResolutionKey] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [answeredEventKey, setAnsweredEventKey] = useState<string | null>(null);
  const [podiumSeenKey, setPodiumSeenKey] = useState<string | null>(null);
  const [podiumOpen, setPodiumOpen] = useState(false);
  const [optimisticAcks, setOptimisticAcks] = useState<Record<string, string[]>>({});
  const optimisticAckByPlayerRef = useRef<Record<string, string[]>>({});
  const optimisticLockByPlayerRef = useRef<Record<string, MpLeagueActivity['lock'] | undefined>>({});
  const activityRef = useRef<MpLeagueActivity>(activity);
  const changeRef = useRef(0);
  const revRef = useRef<number | null>(null);
  const lastLiveAppliedAtRef = useRef(0);
  const stageRef = useRef<MpLeagueLive['stage'] | null>(null);
  const hostWakeRef = useRef<(() => void) | null>(null);

  const recordOptimisticAck = useCallback((pid: string, key: string) => {
    const prev = optimisticAckByPlayerRef.current[pid] ?? [];
    if (prev.includes(key)) return;
    const nextList = [...prev, key].slice(-12);
    optimisticAckByPlayerRef.current = {
      ...optimisticAckByPlayerRef.current,
      [pid]: nextList,
    };
    setOptimisticAcks((map) => {
      const cur = map[pid] ?? [];
      if (cur.includes(key)) return map;
      return { ...map, [pid]: [...cur, key].slice(-12) };
    });
  }, []);

  const wakeHostLocally = useCallback(() => {
    if (!hostWakeRef.current) return;
    changeRef.current += 1;
    hostWakeRef.current();
  }, []);

  const applyLive = useCallback((nextLive: MpLeagueLive | null) => {
    if (!nextLive) return;
    if (revRef.current !== null && nextLive.rev < revRef.current) return;
    if (revRef.current === nextLive.rev) return;
    revRef.current = nextLive.rev;
    lastLiveAppliedAtRef.current = Date.now();
    stageRef.current = nextLive.stage;
    setLive(nextLive);
    setErrorMsg(null);
  }, []);

  // Realtime: Broadcast fast-sync (1-RTT live fetch) + postgres_changes & visibility/poll fallback.
  useEffect(() => {
    let disposed = false;
    let running = false;
    let queued = false;
    let queuedForce = false;

    const refresh = async (forceLiveFetch = false) => {
      if (running) {
        queued = true;
        if (forceLiveFetch) queuedForce = true;
        return;
      }
      const stage = stageRef.current;
      const inDraft = stage === null || stage === 'setup' || stage === 'draft';
      // Skip redundant postgres_changes probe right after Broadcast already applied a fresh rev
      if (!forceLiveFetch && !inDraft && Date.now() - lastLiveAppliedAtRef.current < 350) {
        return;
      }
      running = true;
      try {
        changeRef.current += 1;

        // Fast path: Broadcast notified us of a newer rev during active season → skip rev probe & picks table!
        if (forceLiveFetch && !inDraft) {
          const res = await fetchLeagueLiveOnly(room.id);
          if (disposed) return;
          if (res.data) {
            applyLive(res.data);
          } else if (res.error) {
            setErrorMsg(res.error);
          }
          return;
        }

        const rev = await fetchLeagueRev(room.id);
        if (disposed) return;
        if (rev === null || rev !== revRef.current || inDraft) {
          if (rev !== null && rev === revRef.current && inDraft) {
            const nextPicks = await fetchLeaguePicks(room.id, draftGeneration);
            if (!disposed && nextPicks) {
              setPicks((prev) => (prev.length === nextPicks.length ? prev : nextPicks));
            }
          } else if (!inDraft) {
            const res = await fetchLeagueLiveOnly(room.id);
            if (disposed) return;
            if (res.data) {
              applyLive(res.data);
            } else if (res.error) {
              setErrorMsg(res.error);
            }
          } else {
            const res = await fetchLeagueBundle(room.id, draftGeneration);
            if (disposed) return;
            if (res.data) {
              if (res.data.live) applyLive(res.data.live);
              const nextPicks = res.data.picks;
              setPicks((prev) => (prev.length === nextPicks.length ? prev : nextPicks));
              setErrorMsg(null);
            } else if (res.error) {
              setErrorMsg(res.error);
            }
          }
        }
      } finally {
        running = false;
        if (queued && !disposed) {
          const nextForce = queuedForce;
          queued = false;
          queuedForce = false;
          void refresh(nextForce);
        }
      }
    };

    const handleBroadcast = (ev: MpLeagueBroadcastEvent) => {
      if (disposed) return;
      if (ev.type === 'live_updated') {
        if (revRef.current === null || ev.rev > revRef.current) {
          void refresh(true);
        }
        return;
      }
      if (ev.type === 'player_signal') {
        if (ev.ackKey) {
          recordOptimisticAck(ev.playerId, ev.ackKey);
        }
        if ('lock' in ev) {
          optimisticLockByPlayerRef.current = {
            ...optimisticLockByPlayerRef.current,
            [ev.playerId]: ev.lock ?? null,
          };
        }
        changeRef.current += 1;
        hostWakeRef.current?.();
        if (ev.reason === 'pick') {
          void refresh(false);
        }
      }
    };

    const unsubscribe = subscribeToLeague({
      roomId: room.id,
      onChange: () => {
        void refresh(false);
      },
      onBroadcast: handleBroadcast,
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [room.id, draftGeneration, applyLive, recordOptimisticAck]);

  const host = useMpLeagueHost({
    enabled: isHost,
    room,
    players,
    onlinePlayerIds,
    live,
    picks,
    changeRef,
    optimisticAckByPlayerRef,
    optimisticLockByPlayerRef,
    onHostLiveCommitted: applyLive,
  });

  useEffect(() => {
    hostWakeRef.current = isHost ? host.wakeNow : null;
    return () => {
      hostWakeRef.current = null;
    };
  }, [isHost, host.wakeNow]);

  const writeActivity = useCallback(
    (next: MpLeagueActivity, meta?: { ackKey?: string; lockChanged?: boolean }) => {
      activityRef.current = next;
      setActivity(next);
      if (meta?.ackKey) {
        recordOptimisticAck(playerId, meta.ackKey);
      }
      if (meta?.lockChanged) {
        optimisticLockByPlayerRef.current = {
          ...optimisticLockByPlayerRef.current,
          [playerId]: next.lock ?? null,
        };
      }
      // Broadcast IMMEDIATELY (0ms) so host & peers see Ready/Unlock before Postgres round-trip finishes
      if (meta?.ackKey || meta?.lockChanged) {
        broadcastLeagueEvent(room.id, {
          type: 'player_signal',
          playerId,
          reason: 'activity',
          ackKey: meta.ackKey,
          ...(meta.lockChanged ? { lock: next.lock ?? null } : {}),
        });
        wakeHostLocally();
      }
      void updateLeagueActivity(room.id, playerId, next).then(() => {
        if (!meta?.ackKey && !meta?.lockChanged) {
          broadcastLeagueEvent(room.id, {
            type: 'player_signal',
            playerId,
            reason: 'activity',
          });
          wakeHostLocally();
        }
      });
    },
    [room.id, playerId, wakeHostLocally, recordOptimisticAck],
  );

  const ack = useCallback(
    (key: string) => {
      const prev = activityRef.current;
      if (prev.ackKeys?.includes(key)) return;
      writeActivity(
        { ...prev, ackKeys: [...(prev.ackKeys ?? []), key].slice(-10) },
        { ackKey: key },
      );
    },
    [writeActivity],
  );

  const myHuman = live?.humans.find((h) => h.playerId === playerId) ?? null;
  const myClubId = myHuman?.clubId ?? null;
  const mine = myClubId && live ? live.byClub[myClubId] ?? null : null;

  const [optimisticSquad, setOptimisticSquad] = useState<{
    rev: number;
    squad: MpSquadInput;
  } | null>(null);

  const remotePayload = myRow?.league_payload ?? null;
  const remoteRev = remotePayload?.rev ?? 0;

  const mySquad = useMemo<MpSquadInput | null>(() => {
    const base: MpSquadInput | null =
      optimisticSquad && optimisticSquad.rev > remoteRev
        ? optimisticSquad.squad
        : remotePayload &&
            remotePayload.starters?.length === 11 &&
            remotePayload.bench?.length === 5
          ? {
              managerTraitId: remotePayload.managerTraitId,
              formation: remotePayload.formation,
              tactic: remotePayload.tactic,
              starters: remotePayload.starters,
              bench: remotePayload.bench,
            }
          : null;
    if (!base) return null;
    const awakened = mine?.awakenedPlayers;
    if (!awakened || Object.keys(awakened).length === 0) return base;
    return {
      ...base,
      starters: base.starters.map((p) => {
        const rec = awakened[p.id];
        return rec ? applyAwakeningToPlayer(p, rec) : p;
      }),
      bench: base.bench.map((p) => {
        const rec = awakened[p.id];
        return rec ? applyAwakeningToPlayer(p, rec) : p;
      }),
    };
  }, [optimisticSquad, remotePayload, remoteRev, mine?.awakenedPlayers]);

  const savePayload = useCallback(
    async (payload: MpLeagueSquadPayload) => {
      const res = await updateLeaguePayload(room.id, playerId, payload);
      if (res.error) setErrorMsg(res.error);
      else {
        broadcastLeagueEvent(room.id, {
          type: 'player_signal',
          playerId,
          reason: 'squad',
        });
        wakeHostLocally();
      }
    },
    [room.id, playerId, wakeHostLocally],
  );

  const saveSquad = useCallback(
    (next: MpSquadInput) => {
      const nextRev = Math.max(remoteRev, optimisticSquad?.rev ?? 0) + 1;
      setOptimisticSquad({ rev: nextRev, squad: next });
      void savePayload({
        ...next,
        setupReady: true,
        rev: nextRev,
        by: 'player',
      });
    },
    [savePayload, remoteRev, optimisticSquad?.rev],
  );

  const [tickerDoneKey, setTickerDoneKey] = useState<string | null>(null);

  // Global pause lock: only engage interview/injury locks once the live scoreboard has finished replaying
  const tickerKey = live?.ticker?.key ?? null;
  const tickerHasPlayable = hasPlayableTickerMatches(live?.ticker);
  const tickerPlaying = Boolean(
    tickerHasPlayable &&
      tickerDoneKey !== tickerKey &&
      !isMpTickerPlayed(tickerKey),
  );

  // Sync React state whenever a ticker is already marked played or has no playable matches (prevents stale UI gating)
  useEffect(() => {
    if (!tickerKey || tickerDoneKey === tickerKey) return;
    if (!tickerHasPlayable || isMpTickerPlayed(tickerKey)) {
      const t = window.setTimeout(() => setTickerDoneKey(tickerKey), 0);
      return () => window.clearTimeout(t);
    }
  }, [tickerKey, tickerDoneKey, tickerHasPlayable]);

  const transferActiveNow = Boolean(
    live?.flow.kind === 'transfer' && mine && mine.offers.length > 0,
  );
  const summaryActiveNow = Boolean(
    live?.flow.kind === 'summary' && live?.summary !== null,
  );
  const resolutionKey = mine?.resolution
    ? `${mine.resolution.eventTitle}:${mine.resolution.chosenLabel}`
    : null;
  const interviewOpen = Boolean(
    !tickerPlaying &&
      !transferActiveNow &&
      !summaryActiveNow &&
      (mine?.event || (resolutionKey && resolutionKey !== dismissedResolutionKey)),
  );
  const injuryOpen = Boolean(
    !tickerPlaying &&
      !transferActiveNow &&
      !summaryActiveNow &&
      !mine?.event &&
      mine &&
      mine.alerts.length > 0,
  );

  const isUclKnockoutConsent = Boolean(
    live?.stage === 'ucl' &&
      live.flow.kind === 'consent' &&
      live.ucl &&
      live.ucl.stage !== 'league_phase' &&
      live.ucl.stage !== 'special_transfer' &&
      live.ucl.stage !== 'completed',
  );

  // Close the tactics modal automatically if a room-wide transfer, interview, summary, or UCL knockout preview opens underneath
  useEffect(() => {
    if (!editorOpen || tickerPlaying) return;
    if (
      transferActiveNow ||
      live?.flow.kind === 'event' ||
      summaryActiveNow ||
      isUclKnockoutConsent
    ) {
      const t = window.setTimeout(() => setEditorOpen(false), 0);
      return () => window.clearTimeout(t);
    }
  }, [
    editorOpen,
    tickerPlaying,
    transferActiveNow,
    live?.flow.kind,
    summaryActiveNow,
    isUclKnockoutConsent,
  ]);

  // Defensive fallback: if a player ever received 0 transfer offers, auto-ack so they never look stranded
  // (wait if mid-season staff coach selection is still pending!)
  const emptyTransferKey =
    !tickerPlaying &&
    live?.flow.kind === 'transfer' &&
    mine &&
    mine.offers.length === 0 &&
    !mine.staffCoach?.pendingSelection
      ? live.flow.key
      : null;
  useEffect(() => {
    if (!emptyTransferKey) return;
    const t = window.setTimeout(() => ack(emptyTransferKey), 0);
    return () => window.clearTimeout(t);
  }, [emptyTransferKey, ack]);

  const [tacticSavedScope, setTacticSavedScope] = useState<string | null>(null);

  const currentRoundScope = live
    ? `${live.stage}:${live.round}:${live.ucl?.stage ?? ''}:${live.ucl?.leaguePhaseRound ?? 0}:${live.ucl?.knockoutLeg ?? 0}`
    : '';

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
      writeActivity(
        {
          ...activityRef.current,
          lock: desiredLock
            ? { reason: desiredLock, since: new Date().toISOString() }
            : null,
        },
        { lockChanged: true },
      );
    }, 0);
    return () => window.clearTimeout(t);
  }, [desiredLock, writeActivity]);

  const sendAction = useCallback(
    async (kind: MpLeagueActionKind, payload: Record<string, unknown>) => {
      setPendingActionId('sending');
      const res = await enqueueLeagueAction({ roomId: room.id, playerId, kind, payload });
      if (res.error || !res.data) {
        setErrorMsg(res.error ?? '요청 전송 실패');
        setPendingActionId(null);
        if (kind === 'event_choice') setAnsweredEventKey(null);
      } else {
        setPendingActionId(res.data);
        broadcastLeagueEvent(room.id, {
          type: 'player_signal',
          playerId,
          reason: 'action',
        });
        wakeHostLocally();
      }
    },
    [room.id, playerId, wakeHostLocally],
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

  const actionResolved = Boolean(
    pendingActionId &&
      pendingActionId !== 'sending' &&
      live?.handledActionIds?.includes(pendingActionId),
  );

  // Clear pendingActionId immediately once acknowledged by host, or after 6s safety timeout
  useEffect(() => {
    if (!pendingActionId) return;
    const t = window.setTimeout(
      () => setPendingActionId(null),
      actionResolved ? 0 : 6000,
    );
    return () => window.clearTimeout(t);
  }, [pendingActionId, actionResolved]);

  const actionBusy = Boolean(pendingActionId && !actionResolved);

  const finalKey = live?.stage === 'final' && !tickerPlaying ? live.seasonKey : null;
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
          ackKeys={activity.ackKeys ?? []}
          onSavePayload={savePayload}
          onSetRoll={(roll) => writeActivity({ ...activityRef.current, roll })}
          onAck={ack}
          onLeaveRoom={onLeaveRoom}
        />
      </>
    );
  }

  if (live.stage === 'final' && live.final && !tickerPlaying) {
    const showPodium = podiumOpen && live.final.rows.length >= 3;
    const showDuel = podiumOpen && live.final.rows.length === 2;
    const finalClubsById: Record<string, (typeof live.clubs)[number]> = {};
    for (const c of live.ucl?.clubs ?? []) finalClubsById[c.id] = c;
    for (const c of live.clubs) finalClubsById[c.id] = c;
    const finalSquads: Record<string, MpSquadInput> = {};
    for (const h of live.humans) {
      const p = players.find((r) => r.player_id === h.playerId)?.league_payload;
      if (p && p.starters?.length === 11) {
        finalSquads[h.clubId] = {
          managerTraitId: p.managerTraitId,
          formation: p.formation,
          tactic: p.tactic,
          starters: p.starters,
          bench: p.bench,
        };
      }
    }
    return (
      <>
        <MpLeagueFinalBoard
          final={live.final}
          humans={live.humans}
          myClubId={myClubId}
          leagueLabel={LEAGUE_LABEL[live.leagueId]}
          leagueId={live.leagueId}
          standings={live.standings}
          clubsById={finalClubsById}
          cup={live.cup}
          ucl={live.ucl}
          squads={finalSquads}
          onOpenPodium={
            live.final.rows.length >= 2 ? () => setPodiumOpen(true) : undefined
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
        {showDuel && (
          <MpLeagueDuelResultPopup
            rows={live.final.rows}
            humans={live.humans}
            myClubId={myClubId}
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
          else {
            broadcastLeagueEvent(room.id, {
              type: 'player_signal',
              playerId,
              reason: 'activity',
            });
            wakeHostLocally();
            if (submission.phase === 'pre_match' && mySquad) {
              saveSquad({
                ...mySquad,
                formation: submission.formation,
                tactic: submission.tactic,
                starters: submission.starters,
                bench: submission.bench,
              });
            }
          }
        }}
        onClearBarrier={async () => {
          await clearMyTacticBarrier(room.id, playerId);
        }}
        onAck={ack}
      />
    );
  }

  const activeEventScopeKey =
    live.flow.kind === 'event' && mine?.event
      ? `${live.flow.key}:${mine.event.templateId}`
      : mine?.event
        ? `r${live.round}:${mine.event.templateId}`
        : null;

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
      optimisticAcks={optimisticAcks}
      actionBusy={actionBusy}
      editorOpen={editorOpen}
      dismissedResolutionKey={dismissedResolutionKey}
      tickerDoneKey={tickerDoneKey}
      onTickerDoneKey={setTickerDoneKey}
      hostMissing={host.hostMissing}
      errorMsg={errorMsg ?? host.hostError}
      tacticSavedNotice={Boolean(
        tacticSavedScope && tacticSavedScope === currentRoundScope,
      )}
      onOpenEditor={() => setEditorOpen(true)}
      onCloseEditor={() => setEditorOpen(false)}
      onSaveSquad={(next) => {
        const changed =
          !mySquad ||
          mySquad.formation !== next.formation ||
          mySquad.tactic !== next.tactic ||
          mySquad.starters.map((p) => p.id).join(',') !==
            next.starters.map((p) => p.id).join(',') ||
          mySquad.bench.map((p) => p.id).join(',') !==
            next.bench.map((p) => p.id).join(',');
        saveSquad(next);
        setEditorOpen(false);
        if (changed) {
          setTacticSavedScope(currentRoundScope);
        }
      }}
      onAck={ack}
      hiddenEventKey={answeredEventKey}
      activeEventKey={activeEventScopeKey}
      onEventChoice={(choiceId) => {
        // Hide the question right away so one answer is sent exactly once
        setAnsweredEventKey(activeEventScopeKey);
        void sendAction('event_choice', { choiceId });
      }}
      onDismissResolution={setDismissedResolutionKey}
      onInjuryAck={() => void sendAction('injury_ack', {})}
      onTradeAccept={(offerId) => void sendAction('trade_accept', { offerId })}
      onTradeReject={(offerId) => void sendAction('trade_reject', { offerId })}
      onTradeCounter={(payload) =>
        void sendAction('trade_counter', {
          offerId: payload.offerId,
          sendPlayerId: payload.sendPlayerId,
          userSentPlayerIds: payload.userSentPlayerIds,
          aiTargetPlayerIds: payload.aiTargetPlayerIds,
          aiFillerPlayerIds: payload.aiFillerPlayerIds,
          cashOfferM: payload.cashOfferM,
        })
      }
      onHireStaffCoach={(coachId) => void sendAction('coach_hire', { coachId })}
      onSkipStaffCoach={() => void sendAction('coach_skip', {})}
      onDismissAdaptationAlert={() => void sendAction('adaptation_dismiss', {})}
      onDismissAwakeningAlert={() => void sendAction('awakening_dismiss', {})}
      onSetAutoMs={host.setAutoMs}
      onForceResume={host.forceResume}
      onLeaveRoom={onLeaveRoom}
    />
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildAutoPick,
  collectTakenIds,
  createPreSeasonLive,
  draftRoundOf,
  findNextOpenDraftSlot,
  rebuildSquadFromPicks,
  rollCandidates,
  roundSpinnerId,
  shuffleDraftOrder,
  snakePickerId,
  spinSharedRoll,
  totalSnakePicks,
} from '../../../engine/mpLeagueDraft';
import {
  acknowledgeMpLeagueInjuries,
  buildMpLeagueLive,
  closeMpLeagueSummary,
  closeMpLeagueTransferWindow,
  completeMpLeagueH2H,
  createMpLeagueSeason,
  dismissMpLeagueAdaptationAlert,
  dismissMpLeagueAwakeningAlert,
  dismissMpLeagueFfpOpeningNotice,
  endMpLeagueCast,
  getMpCastDurationMs,
  getMpTickerExtraPkMs,
  grantMpLeagueConsent,
  hireMpLeagueStaffCoach,
  mpHumanClubId,
  rejectMpLeagueOffer,
  resolveMpLeagueEvent,
  runMpLeague,
  skipMpLeagueStaffCoach,
  submitMpLeagueTrade,
} from '../../../engine/mpLeagueEngine';
import type { StaffCoachId } from '../../../types/game';
import type { MpH2HSideInput } from '../../../engine/mpLeagueH2H';
import {
  extraTimeFirstHalfMpH2H,
  extraTimeSecondHalfMpH2H,
  kickoffMpH2H,
  mpH2HDoneKey,
  mpH2HNeedsExtraTime,
  mpH2HPreMatchKey,
  mpH2HPreSkipKey,
  mpH2HSkipKey,
  resolveMpH2HFullInstant,
  secondHalfMpH2H,
} from '../../../engine/mpLeagueH2H';
import { DEFAULT_MP_LEAGUE_POOL } from '../../../services/multiplayerService';
import {
  broadcastLeagueEvent,
  completeLeagueAction,
  fetchPendingLeagueActions,
  insertLeaguePick,
  loadHostLeagueState,
  publishLeagueLive,
  saveHostLeagueState,
  updateLeagueActivity,
  updateLeaguePayload,
  updateRoomLeagueSettings,
} from '../../../services/mpLeagueService';
import type {
  MpLeagueActivity,
  MpLeagueHostState,
  MpLeagueHuman,
  MpLeagueLive,
  MpLeaguePickRow,
  MpSquadInput,
} from '../../../types/mpLeague';
import { normalizeMpLeagueSettings } from '../../../types/mpLeague';
import type {
  MpMatchState,
  MpRoomPlayerRow,
  MpRoomRow,
  MpTacticSubmission,
} from '../../../types/multiplayer';
import type { Player } from '../../../types/player';

const TICK_MS = 400;
const DRAFT_HOST_GRACE_MS = 5000;
const DRAFT_SQUAD_WAIT_MS = 6000;
const PRE_MATCH_TIMEOUT_MS = 90_000;
const BARRIER_TIMEOUT_MS = 150_000;
const OFFLINE_TIMEOUT_MS = 12_000;
const TRANSFER_OFFLINE_MS = 20_000;

interface HostInputs {
  enabled: boolean;
  room: MpRoomRow;
  players: MpRoomPlayerRow[];
  onlinePlayerIds: string[];
  live: MpLeagueLive | null;
  picks: MpLeaguePickRow[];
  /** Bumped (without re-rendering) whenever a league table changed */
  changeRef: { current: number };
  /** Broadcast-delivered ack keys per playerId (allows 0ms transition before Postgres Changes arrives) */
  optimisticAckByPlayerRef?: { current: Record<string, string[]> };
  /** Broadcast-delivered lock hints per playerId */
  optimisticLockByPlayerRef?: { current: Record<string, MpLeagueActivity['lock'] | undefined> };
  /** Called immediately after the host publishes a new live state so host UI updates in lockstep with Broadcast. */
  onHostLiveCommitted?: (live: MpLeagueLive) => void;
}

export interface MpLeagueHostApi {
  /** Host browser could not find its saved season (opened on another device / cleared storage) */
  hostMissing: boolean;
  hostError: string | null;
  forceResume: () => void;
  setAutoMs: (ms: number) => void;
  /** Wakes up the host tick loop immediately upon receiving a guest Broadcast signal. */
  wakeNow: () => void;
}

function payloadToSquad(row: MpRoomPlayerRow | undefined): MpSquadInput | null {
  const p = row?.league_payload;
  if (!p || p.starters?.length !== 11 || p.bench?.length !== 5) return null;
  return {
    managerTraitId: p.managerTraitId,
    formation: p.formation,
    tactic: p.tactic,
    starters: p.starters,
    bench: p.bench,
  };
}

function sameRoster(a: MpSquadInput, b: MpSquadInput): boolean {
  const ids = (s: MpSquadInput) =>
    [...s.starters, ...s.bench].map((p) => p.id).sort().join('|');
  return ids(a) === ids(b);
}

function lockKey(row: MpRoomPlayerRow): string | null {
  const lock = row.activity?.lock;
  return lock ? `${row.player_id}:${lock.reason}:${lock.since}` : null;
}

/**
 * Host-authoritative driver of a multi league room. Runs only in the host's browser:
 * snake draft safety picks, slow auto-advance, global pause lock, friend matches, interviews,
 * transfer requests, UCL consent and multicast pacing.
 */
export function useMpLeagueHost(inputs: HostInputs): MpLeagueHostApi {
  const latest = useRef<HostInputs>(inputs);
  const hostRef = useRef<MpLeagueHostState | null>(null);
  const busyRef = useRef(false);
  const loadTriedRef = useRef<string | null>(null);
  const nextAutoAtRef = useRef(0);
  const castUntilRef = useRef(0);
  const ignoredLocksRef = useRef<Set<string>>(new Set());
  const turnSeenRef = useRef<{ pickNo: number; at: number }>({ pickNo: -1, at: 0 });
  const draftDoneAtRef = useRef(0);
  const handledActionsRef = useRef<Set<string>>(new Set());
  const lastActionCounterRef = useRef(-1);
  const flowSinceRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const publishedRevRef = useRef(0);
  const rewriteAtRef = useRef<Record<string, number>>({});
  const pendingAutoMsRef = useRef<number | null>(null);

  const [hostMissing, setHostMissing] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);

  useEffect(() => {
    latest.current = inputs;
  });

  const forceResume = useCallback(() => {
    const p = latest.current;
    for (const row of p.players) {
      const key = lockKey(row);
      if (key) ignoredLocksRef.current.add(key);
    }
  }, []);

  const wakeTickRef = useRef<(() => void) | null>(null);

  const setAutoMs = useCallback((ms: number) => {
    pendingAutoMsRef.current = ms;
    wakeTickRef.current?.();
  }, []);

  const wakeNow = useCallback(() => {
    wakeTickRef.current?.();
  }, []);

  useEffect(() => {
    if (!inputs.enabled) return;

    const commit = async (
      next: MpLeagueHostState,
      squads: Record<string, MpSquadInput>,
      roomId: string,
    ) => {
      const stamped: MpLeagueHostState = {
        ...next,
        squads,
        rev: Math.max(next.rev, hostRef.current?.rev ?? 0, publishedRevRef.current) + 1,
      };
      hostRef.current = stamped;
      publishedRevRef.current = stamped.rev;
      void saveHostLeagueState(stamped);
      const nextLive = buildMpLeagueLive(stamped, squads);
      const res = await publishLeagueLive(roomId, nextLive);
      setHostError(res.error);
      if (!res.error) {
        broadcastLeagueEvent(roomId, {
          type: 'live_updated',
          rev: nextLive.rev,
          stage: nextLive.stage,
          flowKind: nextLive.flow.kind,
          flowKey: 'key' in nextLive.flow ? nextLive.flow.key : undefined,
        });
        latest.current.onHostLiveCommitted?.(nextLive);
      }
    };

    const resolveSquads = async (
      st: MpLeagueHostState,
      p: HostInputs,
    ): Promise<Record<string, MpSquadInput>> => {
      const squads: Record<string, MpSquadInput> = {};
      for (const human of st.humans) {
        const row = p.players.find((r) => r.player_id === human.playerId);
        const known = st.squads[human.clubId];
        const fromRow = payloadToSquad(row);
        if (fromRow && known && sameRoster(fromRow, known)) {
          squads[human.clubId] = fromRow;
          continue;
        }
        squads[human.clubId] = known;
        // A stale client write replaced the roster (e.g. right after a trade): restore the valid one
        const lastRewrite = rewriteAtRef.current[human.clubId] ?? 0;
        if (row && known && Date.now() - lastRewrite > 4000) {
          rewriteAtRef.current[human.clubId] = Date.now();
          await updateLeaguePayload(p.room.id, human.playerId, {
            ...known,
            rev: (row.league_payload?.rev ?? 0) + 1,
            by: 'host',
          });
        }
      }
      return squads;
    };

    const handleSetup = async (p: HostInputs, live: MpLeagueLive) => {
      if (p.players.length < 2) return;
      if (!p.players.every((r) => r.league_payload?.setupReady)) return;
      const settings = normalizeMpLeagueSettings(p.room.settings.league);
      const order = shuffleDraftOrder(p.players.map((r) => r.player_id));
      const nextLive = createPreSeasonLive({
        seasonKey: live.seasonKey,
        settings,
        stage: 'draft',
        draft: {
          generation: p.room.settings.draftGeneration ?? 1,
          order,
          turnSec: settings.turnSec,
          totalPicks: totalSnakePicks(order.length),
        },
        rev: Math.max(live.rev, publishedRevRef.current) + 1,
      });
      publishedRevRef.current = nextLive.rev;
      const res = await publishLeagueLive(p.room.id, nextLive);
      setHostError(res.error);
      if (!res.error) {
        broadcastLeagueEvent(p.room.id, {
          type: 'live_updated',
          rev: nextLive.rev,
          stage: nextLive.stage,
          flowKind: nextLive.flow.kind,
        });
        latest.current.onHostLiveCommitted?.(nextLive);
      }
    };

    const handleDraft = async (p: HostInputs, live: MpLeagueLive) => {
      const draft = live.draft;
      if (!draft) return;
      const pool = p.room.settings.draftLeaguePool?.length
        ? p.room.settings.draftLeaguePool
        : DEFAULT_MP_LEAGUE_POOL;
      const pickNo = p.picks.length;

      if (pickNo < draft.totalPicks) {
        draftDoneAtRef.current = 0;
        if (turnSeenRef.current.pickNo !== pickNo) {
          turnSeenRef.current = { pickNo, at: Date.now() };
          return;
        }
        const waited = Date.now() - turnSeenRef.current.at;
        const autoKey = `draft-auto:${draft.generation}`;
        const allAuto = p.players.every((r) => r.activity?.ackKeys?.includes(autoKey));
        const grace = allAuto ? 6000 : draft.turnSec * 1000 + DRAFT_HOST_GRACE_MS;
        if (waited < grace) return;
        const pickerId = snakePickerId(pickNo, draft.order);
        if (!pickerId) return;
        const takenIds = collectTakenIds(p.picks);
        const round = draftRoundOf(pickNo, draft.order.length);
        const spinnerId = roundSpinnerId(round, draft.order);
        const spinnerRow = p.players.find((r) => r.player_id === spinnerId);
        let roll = spinnerRow?.activity?.roll ?? null;
        if (!roll || roll.generation !== draft.generation || roll.round !== round) {
          // The round's first picker never spun: the host spins the shared roulette for them
          if (!spinnerRow || !spinnerId) return;
          const sBoard = rebuildSquadFromPicks(p.picks, spinnerId);
          const sFormation = spinnerRow.league_payload?.formation ?? '4-3-3';
          const slot = findNextOpenDraftSlot(sFormation, sBoard.starters, sBoard.bench);
          roll = {
            generation: draft.generation,
            round,
            subPosition: slot?.subPosition ?? 'CM',
            label: slot?.label ?? '',
            reels: spinSharedRoll({
              formation: sFormation,
              starters: sBoard.starters,
              bench: sBoard.bench,
              takenIds,
              allowedLeagueIds: pool,
              playerCount: draft.order.length,
            }),
          };
          await updateLeagueActivity(p.room.id, spinnerId, {
            ...spinnerRow.activity,
            roll,
          });
        }
        const row = p.players.find((r) => r.player_id === pickerId);
        const board = rebuildSquadFromPicks(p.picks, pickerId);
        const pick = buildAutoPick({
          formation: row?.league_payload?.formation ?? '4-3-3',
          starters: board.starters,
          bench: board.bench,
          takenIds,
          allowedLeagueIds: pool,
          shownCandidates: rollCandidates(roll.reels, takenIds),
        });
        if (!pick) return;
        await insertLeaguePick({
          roomId: p.room.id,
          draftGeneration: draft.generation,
          pickNo,
          pickerId,
          pick,
        });
        turnSeenRef.current = { pickNo: -1, at: 0 };
        return;
      }

      // All picks are in: collect every manager's final 11 + 5 and open the shared season
      if (draftDoneAtRef.current === 0) draftDoneAtRef.current = Date.now();
      const forceBuild = Date.now() - draftDoneAtRef.current > DRAFT_SQUAD_WAIT_MS;
      const humans: MpLeagueHuman[] = [];
      const squads: Record<string, MpSquadInput> = {};
      for (let i = 0; i < draft.order.length; i += 1) {
        const pid = draft.order[i];
        const row = p.players.find((r) => r.player_id === pid);
        if (!row) continue;
        const clubId = mpHumanClubId(i);
        const board = rebuildSquadFromPicks(p.picks, pid);
        const fromPicks: MpSquadInput = {
          managerTraitId: row.league_payload?.managerTraitId ?? 'big_game_hunter',
          formation: row.league_payload?.formation ?? '4-3-3',
          tactic: row.league_payload?.tactic ?? 'balanced',
          starters: board.starters.filter((x): x is Player => x !== null),
          bench: board.bench.filter((x): x is Player => x !== null),
        };
        const uploaded = payloadToSquad(row);
        if (uploaded && sameRoster(uploaded, fromPicks)) {
          squads[clubId] = uploaded;
        } else if (forceBuild) {
          squads[clubId] = fromPicks;
          await updateLeaguePayload(p.room.id, pid, {
            ...fromPicks,
            setupReady: true,
            rev: (row.league_payload?.rev ?? 0) + 1,
            by: 'host',
          });
        } else {
          return;
        }
        humans.push({
          playerId: pid,
          clubId,
          nickname: row.nickname,
          avatar: row.avatar_json,
          profile: row.club_profile,
          managerTraitId: squads[clubId].managerTraitId,
        });
      }
      if (humans.length < 2) return;

      const season = createMpLeagueSeason({
        roomId: p.room.id,
        seasonKey: live.seasonKey,
        settings: normalizeMpLeagueSettings(p.room.settings.league),
        draftLeaguePool: pool,
        humans,
        squads,
      });
      nextAutoAtRef.current = Date.now() + 2500;
      await commit(season, squads, p.room.id);
    };

    const fallbackSide = (
      st: MpLeagueHostState,
      squads: Record<string, MpSquadInput>,
      clubId: string,
      match: MpMatchState | null,
    ): MpH2HSideInput | null => {
      const human = st.humans.find((h) => h.clubId === clubId);
      if (!human) return null;
      const teamMorale = st.perHuman[clubId]?.events.teamMorale ?? 0;
      if (match) {
        const isHome = match.hostTeamId === clubId;
        return {
          human,
          formation: isHome ? match.hostFormation : match.guestFormation,
          tactic: isHome ? match.hostTactic : match.guestTactic,
          starters: isHome ? match.hostStarters : match.guestStarters,
          bench: isHome ? match.hostBench : match.guestBench,
          teamMorale,
        };
      }
      const squad = squads[clubId];
      if (!squad) return null;
      return {
        human,
        formation: squad.formation,
        tactic: squad.tactic,
        starters: squad.starters,
        bench: squad.bench,
        teamMorale,
      };
    };

    const sideFromBarrier = (
      st: MpLeagueHostState,
      squads: Record<string, MpSquadInput>,
      p: HostInputs,
      clubId: string,
      barrierKey: string,
      match: MpMatchState | null,
      timedOut: boolean,
    ): MpH2HSideInput | null => {
      const human = st.humans.find((h) => h.clubId === clubId);
      if (!human) return null;
      const row = p.players.find((r) => r.player_id === human.playerId);
      const sub: MpTacticSubmission | null | undefined = row?.tactic_submission;
      if (sub && sub.barrierKey === barrierKey && sub.starters?.length === 11) {
        return {
          human,
          formation: sub.formation,
          tactic: sub.tactic,
          starters: sub.starters,
          bench: sub.bench,
          teamMorale: st.perHuman[clubId]?.events.teamMorale ?? 0,
        };
      }
      const offline = !p.onlinePlayerIds.includes(human.playerId);
      if (timedOut || (offline && Date.now() - flowSinceRef.current.at > OFFLINE_TIMEOUT_MS)) {
        return fallbackSide(st, squads, clubId, match);
      }
      return null;
    };

    const handleH2H = async (
      st: MpLeagueHostState,
      squads: Record<string, MpSquadInput>,
      p: HostInputs,
    ) => {
      const live = st.h2hLive;
      if (!live) return;
      const { spec, match } = live;
      const sinceKey = `${spec.key}:${match?.phase ?? 'pre'}`;
      if (flowSinceRef.current.key !== sinceKey) {
        flowSinceRef.current = { key: sinceKey, at: Date.now() };
      }
      const waited = Date.now() - flowSinceRef.current.at;

      const publishMatch = async (nextMatch: MpMatchState) => {
        await commit({ ...st, h2hLive: { ...live, match: nextMatch } }, squads, p.room.id);
      };

      const hasAck = (playerId: string | undefined, key: string): boolean => {
        if (!playerId) return false;
        const row = p.players.find((r) => r.player_id === playerId);
        if (row?.activity?.ackKeys?.includes(key)) return true;
        return Boolean(p.optimisticAckByPlayerRef?.current[playerId]?.includes(key));
      };

      if (!match) {
        const key = mpH2HPreMatchKey(spec, st.seasonKey);
        const preSkipKey = mpH2HPreSkipKey(spec, st.seasonKey);
        const bothPreSkip = [spec.homeClubId, spec.awayClubId].every((clubId) => {
          const human = st.humans.find((h) => h.clubId === clubId);
          return hasAck(human?.playerId, preSkipKey);
        });
        if (bothPreSkip) {
          const home =
            sideFromBarrier(st, squads, p, spec.homeClubId, key, null, true) ??
            fallbackSide(st, squads, spec.homeClubId, null);
          const away =
            sideFromBarrier(st, squads, p, spec.awayClubId, key, null, true) ??
            fallbackSide(st, squads, spec.awayClubId, null);
          if (!home || !away) return;
          const finishedMatch = resolveMpH2HFullInstant({
            spec,
            seasonKey: st.seasonKey,
            home,
            away,
            conditions: st.conditions,
          });
          await publishMatch(finishedMatch);
          return;
        }

        const timedOut = waited > PRE_MATCH_TIMEOUT_MS;
        const home = sideFromBarrier(st, squads, p, spec.homeClubId, key, null, timedOut);
        const away = sideFromBarrier(st, squads, p, spec.awayClubId, key, null, timedOut);
        if (!home || !away) return;
        await publishMatch(
          kickoffMpH2H({
            spec,
            seasonKey: st.seasonKey,
            home,
            away,
            conditions: st.conditions,
          }),
        );
        return;
      }

      // Both managers agreed to skip mid-match: compute full result and publish `finished` so everyone sees the Result Popup
      if (match.phase !== 'finished') {
        const skipKey = mpH2HSkipKey(match.matchId);
        const bothSkip = [spec.homeClubId, spec.awayClubId].every((clubId) => {
          const human = st.humans.find((h) => h.clubId === clubId);
          return hasAck(human?.playerId, skipKey);
        });
        if (bothSkip) {
          const home = fallbackSide(st, squads, spec.homeClubId, match);
          const away = fallbackSide(st, squads, spec.awayClubId, match);
          if (!home || !away) return;
          const finishedMatch = resolveMpH2HFullInstant({
            spec,
            seasonKey: st.seasonKey,
            home,
            away,
            conditions: st.conditions,
            existingMatch: match,
          });
          await publishMatch(finishedMatch);
          return;
        }
      }

      const timedOut = waited > BARRIER_TIMEOUT_MS;
      const sides = (barrierKey: string) => {
        const home = sideFromBarrier(
          st, squads, p, spec.homeClubId, barrierKey, match, timedOut,
        );
        const away = sideFromBarrier(
          st, squads, p, spec.awayClubId, barrierKey, match, timedOut,
        );
        return home && away ? { home, away } : null;
      };

      const finishIfAcked = async () => {
        const doneKey = mpH2HDoneKey(match.matchId);
        // Every online manager (participants + spectators) clicks [확인] on the Result Popup before advancing
        const acked = st.humans.every((human) => {
          const row = p.players.find((r) => r.player_id === human.playerId);
          if (!row) return true;
          if (hasAck(human.playerId, doneKey)) return true;
          return (
            !p.onlinePlayerIds.includes(human.playerId) && waited > OFFLINE_TIMEOUT_MS
          );
        });
        if (!acked && !timedOut) return;
        if (!match.finalResult) return;
        let next = completeMpLeagueH2H(st, match.finalResult);
        if (next.flow.kind === 'auto') next = runMpLeague(next, { squads });
        nextAutoAtRef.current =
          next.flow.kind === 'consent'
            ? 0
            : Date.now() + st.settings.autoMs + getMpTickerExtraPkMs(next.ticker?.matches);
        if (next.flow.kind === 'cast') {
          castUntilRef.current = Date.now() + getMpCastDurationMs(next);
        }
        await commit(next, squads, p.room.id);
      };

      if (match.phase === 'first_half') {
        const s = sides(`halftime:${match.matchId}`);
        if (!s) return;
        await publishMatch(
          secondHalfMpH2H({ spec, match, ...s, conditions: st.conditions }),
        );
      } else if (match.phase === 'second_half') {
        if (mpH2HNeedsExtraTime(spec, match)) {
          const s = sides(`extra_time_break:${match.matchId}`);
          if (!s) return;
          await publishMatch(
            extraTimeFirstHalfMpH2H({ spec, match, ...s, conditions: st.conditions }),
          );
        } else {
          await finishIfAcked();
        }
      } else if (match.phase === 'extra_time') {
        const s = sides(`extra_time_ht:${match.matchId}`);
        if (!s) return;
        await publishMatch(
          extraTimeSecondHalfMpH2H({ spec, match, ...s, conditions: st.conditions }),
        );
      } else {
        await finishIfAcked();
      }
    };

    const handleActions = async (
      st: MpLeagueHostState,
      squads: Record<string, MpSquadInput>,
      p: HostInputs,
    ): Promise<boolean> => {
      if (lastActionCounterRef.current === p.changeRef.current) return false;
      lastActionCounterRef.current = p.changeRef.current;
      const rows = await fetchPendingLeagueActions(p.room.id);
      let current = st;
      let nextSquads = squads;
      let changed = false;
      const batchHandledIds: string[] = [];
      const completionTasks: Promise<unknown>[] = [];
      const squadUpdates = new Map<string, { playerId: string; squad: MpSquadInput }>();

      for (const action of rows) {
        if (handledActionsRef.current.has(action.id)) continue;
        handledActionsRef.current.add(action.id);
        const human = current.humans.find((h) => h.playerId === action.player_id);
        if (!human) {
          completionTasks.push(completeLeagueAction(action.id, { ok: false }));
          continue;
        }
        const env = { squads: nextSquads };
        if (action.kind === 'event_choice') {
          current = resolveMpLeagueEvent(
            current,
            env,
            human.clubId,
            String(action.payload.choiceId ?? ''),
          );
        } else if (action.kind === 'injury_ack') {
          current = acknowledgeMpLeagueInjuries(current, human.clubId);
        } else if (action.kind === 'trade_reject') {
          current = rejectMpLeagueOffer(
            current,
            human.clubId,
            String(action.payload.offerId ?? ''),
          );
        } else if (action.kind === 'trade_accept' || action.kind === 'trade_counter') {
          const toIdList = (val: unknown): string[] | undefined =>
            Array.isArray(val) ? val.map(String).filter(Boolean) : undefined;
          const outcome = submitMpLeagueTrade({
            state: current,
            env,
            clubId: human.clubId,
            offerId: String(action.payload.offerId ?? ''),
            sendPlayerId:
              action.kind === 'trade_counter' && typeof action.payload.sendPlayerId === 'string'
                ? action.payload.sendPlayerId
                : undefined,
            userSentPlayerIds:
              action.kind === 'trade_counter'
                ? toIdList(action.payload.userSentPlayerIds)
                : undefined,
            aiTargetPlayerIds:
              action.kind === 'trade_counter'
                ? toIdList(action.payload.aiTargetPlayerIds)
                : undefined,
            aiFillerPlayerIds:
              action.kind === 'trade_counter'
                ? toIdList(action.payload.aiFillerPlayerIds)
                : undefined,
            cashOfferM:
              action.kind === 'trade_counter' &&
              typeof action.payload.cashOfferM === 'number'
                ? action.payload.cashOfferM
                : undefined,
          });
          current = outcome.state;
          if (outcome.squad) {
            nextSquads = { ...nextSquads, [human.clubId]: outcome.squad };
            rewriteAtRef.current[human.clubId] = Date.now();
            squadUpdates.set(human.clubId, {
              playerId: human.playerId,
              squad: outcome.squad,
            });
          }
        } else if (action.kind === 'coach_hire') {
          const coachId = String(action.payload.coachId ?? '') as StaffCoachId;
          if (coachId) {
            current = hireMpLeagueStaffCoach(current, human.clubId, coachId);
          }
        } else if (action.kind === 'coach_skip') {
          current = skipMpLeagueStaffCoach(current, human.clubId);
        } else if (action.kind === 'ffp_notice_dismiss') {
          current = dismissMpLeagueFfpOpeningNotice(current, human.clubId);
        } else if (action.kind === 'adaptation_dismiss') {
          current = dismissMpLeagueAdaptationAlert(current, human.clubId);
        } else if (action.kind === 'awakening_dismiss') {
          current = dismissMpLeagueAwakeningAlert(current, human.clubId);
        }
        completionTasks.push(completeLeagueAction(action.id, { ok: true }));
        batchHandledIds.push(action.id);
        changed = true;
      }

      if (squadUpdates.size > 0) {
        for (const [, entry] of squadUpdates) {
          const row = p.players.find((r) => r.player_id === entry.playerId);
          completionTasks.push(
            updateLeaguePayload(p.room.id, entry.playerId, {
              ...entry.squad,
              setupReady: true,
              rev: (row?.league_payload?.rev ?? 0) + 1,
              by: 'host',
            }),
          );
        }
      }
      if (completionTasks.length > 0) {
        await Promise.all(completionTasks);
      }
      if (changed) {
        if (current.flow.kind === 'auto' && st.flow.kind !== 'auto') {
          nextAutoAtRef.current = Date.now() + st.settings.autoMs;
        }
        current = {
          ...current,
          handledActionIds: [
            ...(current.handledActionIds ?? []),
            ...batchHandledIds,
          ].slice(-24),
        };
        await commit(current, nextSquads, p.room.id);
      }
      return changed;
    };

    const handleSeason = async (p: HostInputs, live: MpLeagueLive) => {
      if (!hostRef.current || hostRef.current.seasonKey !== live.seasonKey) {
        const loadKey = `${p.room.id}:${live.seasonKey}`;
        if (loadTriedRef.current === loadKey) return;
        loadTriedRef.current = loadKey;
        const loaded = await loadHostLeagueState(p.room.id, live.seasonKey);
        if (!loaded) {
          setHostMissing(true);
          return;
        }
        hostRef.current = loaded;
        publishedRevRef.current = Math.max(loaded.rev, live.rev);
        nextAutoAtRef.current = Date.now() + 2000;
        if (loaded.flow.kind === 'cast') castUntilRef.current = Date.now() + 3000;
      }
      let st = hostRef.current;
      if (!st) return;

      if (pendingAutoMsRef.current !== null) {
        const ms = pendingAutoMsRef.current;
        pendingAutoMsRef.current = null;
        const settings = normalizeMpLeagueSettings({ ...st.settings, autoMs: ms });
        st = { ...st, settings };
        hostRef.current = st;
        await updateRoomLeagueSettings(p.room.id, { ...p.room.settings, league: settings });
        await commit(st, st.squads, p.room.id);
        return;
      }

      const squads = await resolveSquads(st, p);
      if (await handleActions(st, squads, p)) return;

      const flow = st.flow;
      const flowKey = `${flow.kind}:${'key' in flow ? flow.key : ''}`;
      if (flow.kind !== 'h2h' && flowSinceRef.current.key !== flowKey) {
        flowSinceRef.current = { key: flowKey, at: Date.now() };
      }
      const waited = Date.now() - flowSinceRef.current.at;
      const humanRow = (clubId: string) => {
        const human = st?.humans.find((h) => h.clubId === clubId);
        return p.players.find((r) => r.player_id === human?.playerId);
      };
      const ackedByPlayerId = (pid: string, key: string) => {
        const row = p.players.find((r) => r.player_id === pid);
        if (row?.activity?.ackKeys?.includes(key)) return true;
        return Boolean(p.optimisticAckByPlayerRef?.current[pid]?.includes(key));
      };
      const ackedOrGone = (clubId: string, key: string, offlineMs: number) => {
        const row = humanRow(clubId);
        if (!row) return true;
        if (ackedByPlayerId(row.player_id, key)) return true;
        return !p.onlinePlayerIds.includes(row.player_id) && waited > offlineMs;
      };

      if (flow.kind === 'h2h') {
        await handleH2H(st, squads, p);
        return;
      }

      if (flow.kind === 'auto') {
        const locked = p.players.some((row) => {
          const optMap = p.optimisticLockByPlayerRef?.current;
          const hasOpt = Boolean(optMap && row.player_id in optMap);
          const effectiveLock = hasOpt ? optMap?.[row.player_id] : row.activity?.lock;
          if (!effectiveLock) return false;
          const key = `${row.player_id}:${effectiveLock.reason}:${effectiveLock.since}`;
          return !ignoredLocksRef.current.has(key);
        });
        if (locked) {
          nextAutoAtRef.current = Math.max(nextAutoAtRef.current, Date.now() + 300);
          return;
        }
        if (Date.now() < nextAutoAtRef.current) return;
        const next = runMpLeague(st, { squads });
        nextAutoAtRef.current =
          next.flow.kind === 'consent'
            ? 0
            : Date.now() + st.settings.autoMs + getMpTickerExtraPkMs(next.ticker?.matches);
        if (next === st) return;
        if (next.flow.kind === 'cast') {
          castUntilRef.current = Date.now() + getMpCastDurationMs(next);
        }
        await commit(next, squads, p.room.id);
        return;
      }

      if (flow.kind === 'event') {
        // A friend who dropped out must not freeze the interview round: answer with the first option
        let next = st;
        for (const h of st.humans) {
          const ev = next.perHuman[h.clubId]?.events.activeEvent;
          if (!ev) continue;
          const row = humanRow(h.clubId);
          const offline = !row || !p.onlinePlayerIds.includes(row.player_id);
          if (offline && waited > TRANSFER_OFFLINE_MS && ev.choices[0]) {
            next = resolveMpLeagueEvent(next, { squads }, h.clubId, ev.choices[0].id);
          }
        }
        if (next !== st) {
          nextAutoAtRef.current = Date.now() + st.settings.autoMs;
          await commit(next, squads, p.room.id);
        }
        return;
      }

      if (flow.kind === 'transfer') {
        let nextSt = st;
        const allDone = nextSt.humans.every((h) => {
          const hs = nextSt.perHuman[h.clubId];
          if (hs?.staffCoach?.pendingSelection) {
            const row = humanRow(h.clubId);
            const offline = !row || !p.onlinePlayerIds.includes(row.player_id);
            if (offline && waited > TRANSFER_OFFLINE_MS) {
              nextSt = skipMpLeagueStaffCoach(nextSt, h.clubId);
            } else {
              return false;
            }
          }
          const latestHs = nextSt.perHuman[h.clubId];
          const noPending = !latestHs || latestHs.offers.every((o) => o.status !== 'pending');
          if (noPending && latestHs && latestHs.offers.length === 0) return true;
          return ackedOrGone(h.clubId, flow.key, TRANSFER_OFFLINE_MS);
        });
        if (!allDone) {
          if (nextSt !== st) {
            await commit(nextSt, squads, p.room.id);
          }
          return;
        }
        nextAutoAtRef.current = Date.now() + st.settings.autoMs;
        await commit(closeMpLeagueTransferWindow(nextSt), squads, p.room.id);
        return;
      }

      if (flow.kind === 'summary') {
        const all = st.humans.every((h) =>
          ackedOrGone(h.clubId, flow.key, TRANSFER_OFFLINE_MS),
        );
        if (!all) return;
        const afterSummary = closeMpLeagueSummary(st);
        nextAutoAtRef.current = afterSummary.flow.kind === 'consent' ? 0 : Date.now() + 400;
        await commit(afterSummary, squads, p.room.id);
        return;
      }

      if (flow.kind === 'consent') {
        let ready = false;
        if (flow.allEliminated) {
          // Softlock guard: when 0 survivors remain, host clicks [남은 토너먼트 진행] to finalize
          ready = ackedByPlayerId(p.room.host_player_id, flow.key);
        } else {
          const requiredIds =
            flow.requiredClubIds && flow.requiredClubIds.length > 0
              ? flow.requiredClubIds
              : st.humans.map((h) => h.clubId);
          ready = requiredIds.every((clubId) =>
            ackedOrGone(clubId, flow.key, TRANSFER_OFFLINE_MS),
          );
        }
        if (!ready) return;
        const next = runMpLeague(grantMpLeagueConsent(st), { squads });
        nextAutoAtRef.current =
          next.flow.kind === 'consent'
            ? 0
            : Date.now() + st.settings.autoMs + getMpTickerExtraPkMs(next.ticker?.matches);
        if (next.flow.kind === 'cast') {
          castUntilRef.current = Date.now() + getMpCastDurationMs(next);
        }
        await commit(next, squads, p.room.id);
        return;
      }

      if (flow.kind === 'cast') {
        if (Date.now() < castUntilRef.current) return;
        const ended = endMpLeagueCast(st);
        nextAutoAtRef.current = ended.flow.kind === 'consent' ? 0 : Date.now() + 600;
        await commit(ended, squads, p.room.id);
      }
    };

    let pendingWake = false;
    let disposed = false;

    const tick = async () => {
      if (disposed) return;
      if (busyRef.current) {
        pendingWake = true;
        return;
      }
      const p = latest.current;
      if (!p.enabled || !p.live) return;
      // Wait until our own last publish has come back before acting on the public state
      if (p.live.rev < publishedRevRef.current && p.live.stage !== 'league' && p.live.stage !== 'ucl') {
        return;
      }
      busyRef.current = true;
      try {
        if (p.live.stage === 'setup') await handleSetup(p, p.live);
        else if (p.live.stage === 'draft') await handleDraft(p, p.live);
        else if (p.live.stage !== 'final' || hostRef.current?.flow.kind !== 'done') {
          await handleSeason(p, p.live);
        }
      } catch (err) {
        setHostError(err instanceof Error ? err.message : '방장 진행 처리 중 오류');
      } finally {
        busyRef.current = false;
        if (pendingWake && !disposed) {
          pendingWake = false;
          void tick();
        }
      }
    };

    wakeTickRef.current = () => {
      void tick();
    };
    const interval = window.setInterval(() => {
      void tick();
    }, TICK_MS);
    return () => {
      disposed = true;
      wakeTickRef.current = null;
      window.clearInterval(interval);
    };
  }, [inputs.enabled]);

  return { hostMissing, hostError, forceResume, setAutoMs, wakeNow };
}

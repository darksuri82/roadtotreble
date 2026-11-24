import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient';
import type {
  MpLeagueActionKind,
  MpLeagueActionRow,
  MpLeagueActivity,
  MpLeagueBroadcastEvent,
  MpLeagueHostState,
  MpLeagueLive,
  MpLeaguePickJson,
  MpLeaguePickRow,
  MpLeagueSquadPayload,
} from '../types/mpLeague';
import type { MpRoomSettings } from '../types/multiplayer';

export interface MpLeagueResult<T> {
  data: T | null;
  error: string | null;
}

const SQL_HINT =
  '멀티 리그용 Supabase SQL(v8.0)이 아직 적용되지 않았습니다. supabase/schema.sql의 v8.0 구간을 실행해 주세요.';

function describeError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'object') {
    const code = String((err as { code?: unknown }).code ?? '');
    const msg = String((err as { message?: unknown }).message ?? '');
    if (
      code === '42P01' ||
      code === '42703' ||
      code === 'PGRST204' ||
      code === 'PGRST205' ||
      (msg.includes('does not exist') && msg.includes('mp_league')) ||
      msg.includes('league_payload') ||
      msg.includes('activity')
    ) {
      return SQL_HINT;
    }
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return '네트워크 연결을 확인해 주세요.';
    }
    if (msg) return msg;
  }
  return fallback;
}

export interface MpLeagueBundle {
  live: MpLeagueLive | null;
  picks: MpLeaguePickRow[];
}

export async function fetchLeagueBundle(
  roomId: string,
  draftGeneration: number,
): Promise<MpLeagueResult<MpLeagueBundle>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  try {
    const [liveRes, picksRes] = await Promise.all([
      client.from('mp_league_state').select('live').eq('room_id', roomId).maybeSingle(),
      client
        .from('mp_league_picks')
        .select('*')
        .eq('room_id', roomId)
        .eq('draft_generation', draftGeneration)
        .order('pick_no', { ascending: true }),
    ]);
    if (liveRes.error) {
      return { data: null, error: describeError(liveRes.error, '리그 상태 조회 실패') };
    }
    if (picksRes.error) {
      return { data: null, error: describeError(picksRes.error, '드래프트 조회 실패') };
    }
    return {
      data: {
        live: (liveRes.data?.live as MpLeagueLive | null) ?? null,
        picks: (picksRes.data ?? []) as MpLeaguePickRow[],
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: describeError(err, '리그 상태 조회 중 오류') };
  }
}

/** Fast 1-RTT live-only fetch used during active league / UCL stages (skips draft picks table). */
export async function fetchLeagueLiveOnly(
  roomId: string,
): Promise<MpLeagueResult<MpLeagueLive | null>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  try {
    const { data, error } = await client
      .from('mp_league_state')
      .select('live')
      .eq('room_id', roomId)
      .maybeSingle();
    if (error) {
      return { data: null, error: describeError(error, '리그 상태 조회 실패') };
    }
    return {
      data: (data?.live as MpLeagueLive | null) ?? null,
      error: null,
    };
  } catch (err) {
    return { data: null, error: describeError(err, '리그 상태 조회 중 오류') };
  }
}

/** Cheap change probe: only the revision number of the public state (no big JSON download). */
export async function fetchLeagueRev(roomId: string): Promise<number | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('mp_league_state')
      .select('rev:live->rev')
      .eq('room_id', roomId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { rev?: unknown; live?: { rev?: unknown } };
    const rev = Number(row.rev ?? row.live?.rev);
    return Number.isFinite(rev) ? rev : null;
  } catch {
    return null;
  }
}

export async function fetchLeaguePicks(
  roomId: string,
  draftGeneration: number,
): Promise<MpLeaguePickRow[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('mp_league_picks')
    .select('*')
    .eq('room_id', roomId)
    .eq('draft_generation', draftGeneration)
    .order('pick_no', { ascending: true });
  if (error || !data) return null;
  return data as MpLeaguePickRow[];
}

export async function publishLeagueLive(
  roomId: string,
  live: MpLeagueLive,
): Promise<MpLeagueResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  const { error } = await client
    .from('mp_league_state')
    .upsert({ room_id: roomId, live }, { onConflict: 'room_id' });
  if (error) return { data: null, error: describeError(error, '리그 상태 발행 실패') };
  return { data: true, error: null };
}

/**
 * Host opens a brand-new multi league run: wipes previous picks / squads, bumps the draft generation
 * and moves the room out of the lobby into the manager-setup stage.
 */
export async function startMpLeagueRoom(params: {
  roomId: string;
  settings: MpRoomSettings;
  live: MpLeagueLive;
  draftGeneration: number;
}): Promise<MpLeagueResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  const { roomId, settings, live, draftGeneration } = params;

  const reset = await client
    .from('mp_room_players')
    .update({
      is_ready: false,
      draft_progress: 0,
      draft_completed: false,
      lineup_payload: null,
      tactic_submission: null,
      league_payload: null,
      activity: null,
    })
    .eq('room_id', roomId);
  if (reset.error) {
    return { data: null, error: describeError(reset.error, '참가자 초기화 실패') };
  }

  const wipe = await client.from('mp_league_picks').delete().eq('room_id', roomId);
  if (wipe.error) {
    return { data: null, error: describeError(wipe.error, '드래프트 초기화 실패') };
  }
  await client.from('mp_league_actions').delete().eq('room_id', roomId);

  const pub = await publishLeagueLive(roomId, live);
  if (pub.error) return pub;

  const roomRes = await client
    .from('mp_rooms')
    .update({
      status: 'drafting',
      settings: { ...settings, draftGeneration },
      match_state: null,
    })
    .eq('id', roomId);
  if (roomRes.error) {
    return { data: null, error: describeError(roomRes.error, '멀티 리그 시작 실패') };
  }
  return { data: true, error: null };
}

export type InsertPickOutcome = 'ok' | 'conflict' | 'error';

/** Inserts one public pick. The DB rejects the same player or the same pick number twice. */
export async function insertLeaguePick(params: {
  roomId: string;
  draftGeneration: number;
  pickNo: number;
  pickerId: string;
  pick: MpLeaguePickJson;
}): Promise<{ outcome: InsertPickOutcome; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) return { outcome: 'error', error: 'Supabase 미연결' };
  const { error } = await client.from('mp_league_picks').insert({
    room_id: params.roomId,
    draft_generation: params.draftGeneration,
    pick_no: params.pickNo,
    player_ref: params.pick.player.id,
    picker_id: params.pickerId,
    player_json: params.pick,
  });
  if (!error) return { outcome: 'ok', error: null };
  if (error.code === '23505') return { outcome: 'conflict', error: null };
  return { outcome: 'error', error: describeError(error, '픽 저장 실패') };
}

export async function updateLeaguePayload(
  roomId: string,
  playerId: string,
  payload: MpLeagueSquadPayload,
): Promise<MpLeagueResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  const { error } = await client
    .from('mp_room_players')
    .update({ league_payload: payload })
    .eq('room_id', roomId)
    .eq('player_id', playerId);
  if (error) return { data: null, error: describeError(error, '스쿼드 저장 실패') };
  return { data: true, error: null };
}

export async function updateLeagueActivity(
  roomId: string,
  playerId: string,
  activity: MpLeagueActivity,
): Promise<MpLeagueResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  const { error } = await client
    .from('mp_room_players')
    .update({ activity })
    .eq('room_id', roomId)
    .eq('player_id', playerId);
  if (error) return { data: null, error: describeError(error, '상태 전송 실패') };
  return { data: true, error: null };
}

export async function updateRoomLeagueSettings(
  roomId: string,
  settings: MpRoomSettings,
): Promise<MpLeagueResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  const { error } = await client.from('mp_rooms').update({ settings }).eq('id', roomId);
  if (error) return { data: null, error: describeError(error, '설정 저장 실패') };
  return { data: true, error: null };
}

export async function markLeagueRoomFinished(roomId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  for (const status of ['finished', 'completed', 'ended']) {
    const { error } = await client.from('mp_rooms').update({ status }).eq('id', roomId);
    if (!error || error.code !== '23514') return;
  }
}

/** Friend → host request (interview answer, injury ack, trade accept / reject / counter). */
export async function enqueueLeagueAction(params: {
  roomId: string;
  playerId: string;
  kind: MpLeagueActionKind;
  payload: Record<string, unknown>;
}): Promise<MpLeagueResult<string>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  const { data, error } = await client
    .from('mp_league_actions')
    .insert({
      room_id: params.roomId,
      player_id: params.playerId,
      kind: params.kind,
      payload: params.payload,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !data) {
    return { data: null, error: describeError(error, '요청 전송 실패') };
  }
  return { data: String(data.id), error: null };
}

export async function fetchPendingLeagueActions(
  roomId: string,
): Promise<MpLeagueActionRow[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('mp_league_actions')
    .select('*')
    .eq('room_id', roomId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as MpLeagueActionRow[];
}

export async function completeLeagueAction(
  actionId: string,
  result: Record<string, unknown>,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client
    .from('mp_league_actions')
    .update({ status: 'done', result })
    .eq('id', actionId);
}

const activeLeagueChannels = new Map<string, RealtimeChannel>();

/**
 * Sends a tiny Realtime Broadcast wake-up signal over the already-subscribed room channel.
 * DB persistence + postgres_changes + safety poll remain the authoritative fallback.
 */
export function broadcastLeagueEvent(
  roomId: string,
  event: MpLeagueBroadcastEvent,
): void {
  const ch = activeLeagueChannels.get(roomId);
  if (!ch) return;
  try {
    void ch.send({
      type: 'broadcast',
      event: 'mp_sync',
      payload: event,
    });
  } catch {
    // Non-fatal: postgres_changes + safety poll will still deliver state
  }
}

/** Realtime subscription (Broadcast fast-path + postgres_changes + visibility/safety poll fallback). */
export function subscribeToLeague(params: {
  roomId: string;
  onChange: () => void;
  onBroadcast?: (event: MpLeagueBroadcastEvent) => void;
}): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const { roomId, onChange, onBroadcast } = params;
  let disposed = false;
  let timer: number | null = null;

  const schedule = (delayMs = 50) => {
    if (disposed) return;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      if (!disposed) onChange();
    }, delayMs);
  };

  const channel: RealtimeChannel = client
    .channel(`mp-league:${roomId}`, {
      config: { broadcast: { self: false, ack: false } },
    })
    .on('broadcast', { event: 'mp_sync' }, ({ payload }) => {
      if (disposed) return;
      const ev = payload as MpLeagueBroadcastEvent | null;
      if (ev && typeof ev === 'object' && 'type' in ev && onBroadcast) {
        onBroadcast(ev);
      } else {
        schedule(0);
      }
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mp_league_state', filter: `room_id=eq.${roomId}` },
      () => schedule(30),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mp_league_picks', filter: `room_id=eq.${roomId}` },
      () => schedule(40),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mp_league_actions', filter: `room_id=eq.${roomId}` },
      () => schedule(30),
    )
    .subscribe((status) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        activeLeagueChannels.set(roomId, channel);
        schedule(0);
      }
    });

  const handleVisibility = () => {
    if (!disposed && document.visibilityState === 'visible') {
      schedule(0);
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  const poll = window.setInterval(() => {
    if (!disposed && document.visibilityState === 'visible') schedule(0);
  }, 2500);

  return () => {
    disposed = true;
    if (activeLeagueChannels.get(roomId) === channel) {
      activeLeagueChannels.delete(roomId);
    }
    if (timer !== null) window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.clearInterval(poll);
    void client.removeChannel(channel);
  };
}

// ── Host-private season state (IndexedDB on the host's browser) ──────────────

const DB_NAME = 'rtt_mp_league_host_v1';
const STORE = 'seasons';

function openHostDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function hostStateKey(roomId: string, seasonKey: string): string {
  return `${roomId}:${seasonKey}`;
}

export async function saveHostLeagueState(state: MpLeagueHostState): Promise<void> {
  const db = await openHostDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(state, hostStateKey(state.roomId, state.seasonKey));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

export async function loadHostLeagueState(
  roomId: string,
  seasonKey: string,
): Promise<MpLeagueHostState | null> {
  const db = await openHostDb();
  if (!db) return null;
  const result = await new Promise<MpLeagueHostState | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(hostStateKey(roomId, seasonKey));
      req.onsuccess = () => resolve((req.result as MpLeagueHostState | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  db.close();
  return result;
}

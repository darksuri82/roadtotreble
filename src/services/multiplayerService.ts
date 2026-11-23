import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import type { ManagerAvatarConfig, UserClubProfile } from '../types/game';
import type { LeagueId } from '../types/league';
import type {
  LocalBlindDraftCache,
  MpLineupPayload,
  MpMatchState,
  MpRoomMode,
  MpRoomPlayerRow,
  MpRoomRow,
  MpRoomSettings,
  MpRoomSnapshot,
  MpRoomStatus,
  MpTacticSubmission,
} from '../types/multiplayer';

export const MP_HOST_TEAM_ID = 'mp-host';
export const MP_GUEST_TEAM_ID = 'mp-guest';

const PLAYER_ID_KEY = 'rtt_mp_player_id_v1';
const LAST_ROOM_CODE_KEY = 'rtt_mp_last_room_code_v1';
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const DEFAULT_MP_LEAGUE_POOL: LeagueId[] = [
  'epl',
  'laliga',
  'seriea',
  'bundesliga',
  'ligue1',
];

export interface MpServiceResult<T> {
  data: T | null;
  error: string | null;
}

export function getOrCreateMpPlayerId(): string {
  if (typeof window === 'undefined') {
    return `mp-server-${Math.random().toString(36).slice(2, 10)}`;
  }
  try {
    const existing = window.localStorage.getItem(PLAYER_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(PLAYER_ID_KEY, generated);
    return generated;
  } catch {
    return `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function saveActiveRoomCode(code: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!code) {
      window.localStorage.removeItem(LAST_ROOM_CODE_KEY);
    } else {
      window.localStorage.setItem(LAST_ROOM_CODE_KEY, sanitizeRoomCode(code));
    }
  } catch {
    // ignore storage quota failures
  }
}

export function loadActiveRoomCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(LAST_ROOM_CODE_KEY);
    return saved && saved.length === 6 ? saved : null;
  } catch {
    return null;
  }
}

export function sanitizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

export function generateRoomCode(rng: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

export function buildInviteUrl(roomCode: string): string {
  const clean = sanitizeRoomCode(roomCode);
  if (typeof window === 'undefined') return `?room=${clean}`;
  const url = new URL(window.location.href);
  url.searchParams.set('room', clean);
  return url.toString();
}

export function extractRoomCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('room');
    if (!raw) return null;
    const clean = sanitizeRoomCode(raw);
    return clean.length === 6 ? clean : null;
  } catch {
    return null;
  }
}

export function clearRoomCodeFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('room')) {
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    // ignore
  }
}

/**
 * Pure privacy-preserving payload builder for in-progress blind draft updates.
 * Guarantees NO player picks or manager trait are ever serialized before draft completion.
 */
export function buildDraftProgressPayload(
  progress: number,
  completed = false,
): { draft_progress: number; draft_completed: boolean } {
  const clamped = Math.max(0, Math.min(16, Math.round(progress)));
  return {
    draft_progress: clamped,
    draft_completed: completed,
  };
}

function localDraftStorageKey(roomCode: string, playerId: string): string {
  return `rtt_mp_draft_${sanitizeRoomCode(roomCode)}_${playerId}`;
}

export function saveLocalMpDraft(cache: LocalBlindDraftCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      localDraftStorageKey(cache.roomCode, cache.playerId),
      JSON.stringify(cache),
    );
  } catch {
    // ignore
  }
}

export function loadLocalMpDraft(
  roomCode: string,
  playerId: string,
  expectedGeneration: number,
): LocalBlindDraftCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(
      localDraftStorageKey(roomCode, playerId),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalBlindDraftCache;
    if (parsed.draftGeneration !== expectedGeneration) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalMpDraft(roomCode: string, playerId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(localDraftStorageKey(roomCode, playerId));
  } catch {
    // ignore
  }
}

function normalizeError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message?: unknown }).message ?? '');
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return '네트워크 연결을 확인해 주세요.';
    }
    if (msg.includes('relation') && msg.includes('does not exist')) {
      return 'Supabase 테이블(mp_rooms)이 아직 생성되지 않았습니다.';
    }
    if (msg) return msg;
  }
  return fallback;
}

export async function fetchRoomSnapshot(
  roomId: string,
): Promise<MpServiceResult<MpRoomSnapshot>> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured) {
    return { data: null, error: 'Supabase 환경변수가 설정되지 않았습니다.' };
  }
  try {
    const [roomRes, playersRes] = await Promise.all([
      client.from('mp_rooms').select('*').eq('id', roomId).single(),
      client
        .from('mp_room_players')
        .select('*')
        .eq('room_id', roomId)
        .order('seat', { ascending: true }),
    ]);

    if (roomRes.error || !roomRes.data) {
      return {
        data: null,
        error: normalizeError(roomRes.error, '방을 찾을 수 없습니다.'),
      };
    }
    if (playersRes.error) {
      return {
        data: null,
        error: normalizeError(playersRes.error, '참가자 정보를 불러오지 못했습니다.'),
      };
    }
    return {
      data: {
        room: roomRes.data as MpRoomRow,
        players: (playersRes.data ?? []) as MpRoomPlayerRow[],
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: normalizeError(err, '방 조회 중 오류가 발생했습니다.') };
  }
}

export async function fetchRoomSnapshotByCode(
  code: string,
): Promise<MpServiceResult<MpRoomSnapshot>> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured) {
    return { data: null, error: 'Supabase 환경변수가 설정되지 않았습니다.' };
  }
  const clean = sanitizeRoomCode(code);
  if (clean.length !== 6) {
    return { data: null, error: '6자리 초대 코드를 입력해 주세요.' };
  }
  try {
    const { data: roomData, error: roomErr } = await client
      .from('mp_rooms')
      .select('*')
      .eq('code', clean)
      .maybeSingle();

    if (roomErr) {
      return { data: null, error: normalizeError(roomErr, '방 조회 실패') };
    }
    if (!roomData) {
      return { data: null, error: '존재하지 않는 초대 코드입니다.' };
    }
    const { data: playersData, error: playersErr } = await client
      .from('mp_room_players')
      .select('*')
      .eq('room_id', roomData.id)
      .order('seat', { ascending: true });

    if (playersErr) {
      return {
        data: null,
        error: normalizeError(playersErr, '참가자 조회 실패'),
      };
    }
    return {
      data: {
        room: roomData as MpRoomRow,
        players: (playersData ?? []) as MpRoomPlayerRow[],
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: normalizeError(err, '방 조회 중 오류가 발생했습니다.') };
  }
}

export async function createRoom(params: {
  playerId: string;
  nickname: string;
  avatar: ManagerAvatarConfig;
  clubProfile: UserClubProfile;
  mode?: MpRoomMode;
  settings?: Partial<MpRoomSettings>;
}): Promise<MpServiceResult<MpRoomSnapshot>> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured) {
    return { data: null, error: 'Supabase 환경변수가 설정되지 않았습니다.' };
  }

  const settings: MpRoomSettings = {
    draftLeaguePool: params.settings?.draftLeaguePool?.length
      ? params.settings.draftLeaguePool
      : [...DEFAULT_MP_LEAGUE_POOL],
    knockoutRules: params.settings?.knockoutRules ?? true,
    draftGeneration: 1,
    matchNumber: 1,
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateRoomCode();
    try {
      const insertRoomPayload: Record<string, unknown> = {
        code,
        status: 'lobby',
        host_player_id: params.playerId,
        settings,
        match_state: null,
      };
      // Only pass explicit mode for non-default modes; for 1v1, let DB column DEFAULT satisfy any mode CHECK constraint.
      if (params.mode === 'multi_league') {
        insertRoomPayload.mode = 'multi_league';
      }

      const { data: roomData, error: roomErr } = await client
        .from('mp_rooms')
        .insert(insertRoomPayload)
        .select('*')
        .single();

      if (roomErr) {
        if (roomErr.code === '23505') continue; // duplicate code collision
        return { data: null, error: normalizeError(roomErr, '방 생성에 실패했습니다.') };
      }

      const basePlayerPayload = {
        room_id: roomData.id,
        player_id: params.playerId,
        nickname: params.nickname.trim() || '감독',
        avatar_json: params.avatar,
        club_profile: params.clubProfile,
        is_ready: false,
        draft_progress: 0,
        draft_completed: false,
        lineup_payload: null,
        tactic_submission: null,
      };

      let playerRes = await client
        .from('mp_room_players')
        .insert({ ...basePlayerPayload, seat: 0 })
        .select('*')
        .single();

      if (playerRes.error?.code === '23514') {
        playerRes = await client
          .from('mp_room_players')
          .insert({ ...basePlayerPayload, seat: 1 })
          .select('*')
          .single();
      }

      if (playerRes.error || !playerRes.data) {
        return {
          data: null,
          error: normalizeError(playerRes.error, '방장 등록에 실패했습니다.'),
        };
      }

      saveActiveRoomCode(code);
      return {
        data: {
          room: roomData as MpRoomRow,
          players: [playerRes.data as MpRoomPlayerRow],
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: normalizeError(err, '방 생성 중 오류가 발생했습니다.') };
    }
  }

  return { data: null, error: '초대 코드 생성에 실패했습니다. 다시 시도해 주세요.' };
}

export async function joinRoomByCode(params: {
  code: string;
  playerId: string;
  nickname: string;
  avatar: ManagerAvatarConfig;
  clubProfile: UserClubProfile;
}): Promise<MpServiceResult<MpRoomSnapshot>> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured) {
    return { data: null, error: 'Supabase 환경변수가 설정되지 않았습니다.' };
  }

  const snapRes = await fetchRoomSnapshotByCode(params.code);
  if (snapRes.error || !snapRes.data) return snapRes;

  const { room, players } = snapRes.data;
  const existingMe = players.find((p) => p.player_id === params.playerId);

  if (existingMe) {
    // Rejoin existing seat seamlessly (works across refresh in lobby / draft / tactics / live_match!)
    if (room.status === 'lobby') {
      await client
        .from('mp_room_players')
        .update({
          nickname: params.nickname.trim() || existingMe.nickname,
          avatar_json: params.avatar,
          club_profile: params.clubProfile,
        })
        .eq('id', existingMe.id);
    }
    saveActiveRoomCode(room.code);
    return fetchRoomSnapshot(room.id);
  }

  if (room.status !== 'lobby') {
    return { data: null, error: '이미 경기가 진행 중인 방입니다.' };
  }

  const maxPlayers = room.mode === 'multi_league' ? 8 : 2;
  if (players.length >= maxPlayers) {
    return { data: null, error: '방 인원이 가득 찼습니다.' };
  }

  const usedSeats = new Set(players.map((p) => p.seat));
  const minSeat = players.some((p) => p.seat === 0) ? 0 : 1;
  let nextSeat = minSeat + 1;
  while (usedSeats.has(nextSeat)) nextSeat += 1;

  try {
    const baseJoinPayload = {
      room_id: room.id,
      player_id: params.playerId,
      nickname: params.nickname.trim() || '도전자',
      avatar_json: params.avatar,
      club_profile: params.clubProfile,
      is_ready: false,
      draft_progress: 0,
      draft_completed: false,
      lineup_payload: null,
      tactic_submission: null,
    };

    let { error: insertErr } = await client
      .from('mp_room_players')
      .insert({ ...baseJoinPayload, seat: nextSeat });

    if (insertErr?.code === '23514') {
      const altSeat = nextSeat === 1 ? 2 : 1;
      const retry = await client
        .from('mp_room_players')
        .insert({ ...baseJoinPayload, seat: altSeat });
      insertErr = retry.error;
    }

    if (insertErr) {
      return { data: null, error: normalizeError(insertErr, '방 참가에 실패했습니다.') };
    }

    saveActiveRoomCode(room.code);
    return fetchRoomSnapshot(room.id);
  } catch (err) {
    return { data: null, error: normalizeError(err, '방 참가 중 오류가 발생했습니다.') };
  }
}

export async function updateRoomSettings(
  roomId: string,
  settings: MpRoomSettings,
): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  const { error } = await client
    .from('mp_rooms')
    .update({ settings })
    .eq('id', roomId);
  if (error) return { data: null, error: normalizeError(error, '방 설정 저장 실패') };
  return { data: true, error: null };
}

export async function updatePlayerReady(
  roomId: string,
  playerId: string,
  isReady: boolean,
): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  const { error } = await client
    .from('mp_room_players')
    .update({ is_ready: isReady })
    .eq('room_id', roomId)
    .eq('player_id', playerId);
  if (error) return { data: null, error: normalizeError(error, '준비 상태 변경 실패') };
  return { data: true, error: null };
}

export async function updatePlayerProfile(params: {
  roomId: string;
  playerId: string;
  nickname: string;
  avatar: ManagerAvatarConfig;
  clubProfile: UserClubProfile;
}): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };
  const { error } = await client
    .from('mp_room_players')
    .update({
      nickname: params.nickname.trim() || '감독',
      avatar_json: params.avatar,
      club_profile: params.clubProfile,
    })
    .eq('room_id', params.roomId)
    .eq('player_id', params.playerId);
  if (error) {
    return {
      data: null,
      error: normalizeError(error, '감독·구단 프로필 동기화 실패'),
    };
  }
  return { data: true, error: null };
}

export async function startBlindDraft(
  roomId: string,
  currentSettings: MpRoomSettings,
): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };

  const nextSettings: MpRoomSettings = {
    ...currentSettings,
    draftGeneration: (currentSettings.draftGeneration ?? 1) + 1,
  };

  const resetPlayers = await client
    .from('mp_room_players')
    .update({
      is_ready: false,
      draft_progress: 0,
      draft_completed: false,
      lineup_payload: null,
      tactic_submission: null,
    })
    .eq('room_id', roomId);

  if (resetPlayers.error) {
    return { data: null, error: normalizeError(resetPlayers.error, '드래프트 초기화 실패') };
  }

  const updateRoom = await client
    .from('mp_rooms')
    .update({
      status: 'drafting',
      settings: nextSettings,
      match_state: null,
    })
    .eq('id', roomId);

  if (updateRoom.error) {
    return { data: null, error: normalizeError(updateRoom.error, '드래프트 시작 실패') };
  }
  return { data: true, error: null };
}

export async function updateDraftProgress(
  roomId: string,
  playerId: string,
  progress: number,
): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };

  const safePayload = buildDraftProgressPayload(progress, false);
  const { error } = await client
    .from('mp_room_players')
    .update(safePayload)
    .eq('room_id', roomId)
    .eq('player_id', playerId);
  if (error) return { data: null, error: normalizeError(error, '진행률 업데이트 실패') };
  return { data: true, error: null };
}

export async function submitBlindDraftLineup(
  roomId: string,
  playerId: string,
  lineup: MpLineupPayload,
): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };

  const { error } = await client
    .from('mp_room_players')
    .update({
      draft_progress: 16,
      draft_completed: true,
      lineup_payload: lineup,
      tactic_submission: null,
    })
    .eq('room_id', roomId)
    .eq('player_id', playerId);

  if (error) return { data: null, error: normalizeError(error, '스쿼드 제출 실패') };
  return { data: true, error: null };
}

function getStatusCandidates(status: MpRoomStatus): MpRoomStatus[] {
  if (
    status === 'live_match' ||
    status === 'live' ||
    status === 'playing' ||
    status === 'match' ||
    status === 'in_match' ||
    status === 'in_progress' ||
    status === 'first_half' ||
    status === 'simulating'
  ) {
    return [
      'live_match',
      'live',
      'playing',
      'match',
      'in_match',
      'in_progress',
      'first_half',
      'simulating',
    ];
  }
  if (status === 'tactics' || status === 'pre_match') {
    return ['tactics', 'pre_match'];
  }
  if (status === 'finished' || status === 'completed' || status === 'ended') {
    return ['finished', 'completed', 'ended'];
  }
  return [status];
}

export async function updateRoomStatus(
  roomId: string,
  status: MpRoomStatus,
): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };

  const candidates = getStatusCandidates(status);
  let lastErr: unknown = null;
  for (const candidate of candidates) {
    const { error } = await client
      .from('mp_rooms')
      .update({ status: candidate })
      .eq('id', roomId);
    if (!error) return { data: true, error: null };
    lastErr = error;
    if (error.code !== '23514') break;
  }
  return { data: null, error: normalizeError(lastErr, '방 상태 변경 실패') };
}

export async function submitTacticBarrier(
  roomId: string,
  playerId: string,
  submission: MpTacticSubmission,
): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };

  const { error } = await client
    .from('mp_room_players')
    .update({ tactic_submission: submission })
    .eq('room_id', roomId)
    .eq('player_id', playerId);
  if (error) return { data: null, error: normalizeError(error, '전술 확정 전송 실패') };
  return { data: true, error: null };
}

export async function clearMyTacticBarrier(
  roomId: string,
  playerId: string,
): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };

  const { error } = await client
    .from('mp_room_players')
    .update({ tactic_submission: null })
    .eq('room_id', roomId)
    .eq('player_id', playerId);
  if (error) return { data: null, error: normalizeError(error, '전술 확정 해제 실패') };
  return { data: true, error: null };
}

export async function publishMatchState(
  roomId: string,
  status: MpRoomStatus,
  matchState: MpMatchState,
): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };

  const candidates = getStatusCandidates(status);
  let lastErr: unknown = null;
  let hitCheckConstraint = false;

  for (const candidate of candidates) {
    const { error } = await client
      .from('mp_rooms')
      .update({
        status: candidate,
        match_state: matchState,
      })
      .eq('id', roomId);
    if (!error) return { data: true, error: null };
    lastErr = error;
    if (error.code === '23514') {
      hitCheckConstraint = true;
      continue;
    }
    break;
  }

  // Ultimate resilience: if DB has a custom status CHECK constraint, still persist match_state so both clients launch & sync!
  if (hitCheckConstraint) {
    const { error: stateOnlyErr } = await client
      .from('mp_rooms')
      .update({ match_state: matchState })
      .eq('id', roomId);
    if (!stateOnlyErr) return { data: true, error: null };
    lastErr = stateOnlyErr;
  }

  return { data: null, error: normalizeError(lastErr, '경기 상태 동기화 실패') };
}

export async function resetRoomForSameTeamRematch(
  roomId: string,
  currentSettings: MpRoomSettings,
  prevSeriesWins?: { host: number; guest: number; draws: number },
): Promise<MpServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase 미연결' };

  const nextSettings: MpRoomSettings = {
    ...currentSettings,
    matchNumber: (currentSettings.matchNumber ?? 1) + 1,
  };

  await client
    .from('mp_room_players')
    .update({ tactic_submission: null, is_ready: false })
    .eq('room_id', roomId);

  const candidates = getStatusCandidates('tactics');
  let lastErr: unknown = null;
  for (const candidate of candidates) {
    const { error } = await client
      .from('mp_rooms')
      .update({
        status: candidate,
        settings: nextSettings,
        match_state: prevSeriesWins
          ? ({
              seriesWins: prevSeriesWins,
            } as unknown as MpMatchState)
          : null,
      })
      .eq('id', roomId);
    if (!error) return { data: true, error: null };
    lastErr = error;
    if (error.code !== '23514') break;
  }

  return { data: null, error: normalizeError(lastErr, '재대결 준비 실패') };
}

export async function leaveRoom(
  roomId: string,
  playerId: string,
): Promise<void> {
  saveActiveRoomCode(null);
  clearRoomCodeFromUrl();
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client
      .from('mp_room_players')
      .delete()
      .eq('room_id', roomId)
      .eq('player_id', playerId);
  } catch {
    // ignore cleanup error
  }
}

export function subscribeToRoom(params: {
  roomId: string;
  playerId: string;
  nickname: string;
  onSnapshot: (snapshot: MpRoomSnapshot) => void;
  onPresenceChange: (onlinePlayerIds: string[]) => void;
  onConnectionStatus?: (status: 'connecting' | 'connected' | 'reconnecting') => void;
}): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const { roomId, playerId, nickname, onSnapshot, onPresenceChange, onConnectionStatus } =
    params;

  let disposed = false;
  let refreshTimer: number | null = null;

  const scheduleRefresh = () => {
    if (disposed) return;
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(async () => {
      if (disposed) return;
      const res = await fetchRoomSnapshot(roomId);
      if (!disposed && res.data) {
        onSnapshot(res.data);
      }
    }, 60);
  };

  onConnectionStatus?.('connecting');

  const channel: RealtimeChannel = client
    .channel(`mp-room:${roomId}`, {
      config: {
        presence: { key: playerId },
      },
    })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mp_rooms',
        filter: `id=eq.${roomId}`,
      },
      () => {
        scheduleRefresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mp_room_players',
        filter: `room_id=eq.${roomId}`,
      },
      () => {
        scheduleRefresh();
      },
    )
    .on('presence', { event: 'sync' }, () => {
      if (disposed) return;
      const state = channel.presenceState();
      const onlineIds = Object.keys(state);
      onPresenceChange(onlineIds);
    })
    .subscribe(async (status) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        onConnectionStatus?.('connected');
        await channel.track({
          playerId,
          nickname,
          onlineAt: new Date().toISOString(),
        });
        scheduleRefresh();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onConnectionStatus?.('reconnecting');
      }
    });

  // Periodic safety poll (every 2s) in case a mobile tab was backgrounded & missed a realtime packet
  const pollInterval = window.setInterval(() => {
    if (!disposed && document.visibilityState === 'visible') {
      scheduleRefresh();
    }
  }, 2000);

  return () => {
    disposed = true;
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    window.clearInterval(pollInterval);
    void client.removeChannel(channel);
  };
}

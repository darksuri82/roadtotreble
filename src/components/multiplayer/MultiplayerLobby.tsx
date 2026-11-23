import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Palette,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Swords,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useState } from 'react';
import { LEAGUES } from '../../engine/dataLoader';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  buildInviteUrl,
  DEFAULT_MP_LEAGUE_POOL,
  sanitizeRoomCode,
} from '../../services/multiplayerService';
import type { ManagerAvatarConfig, UserClubProfile } from '../../types/game';
import type { LeagueId } from '../../types/league';
import type {
  MpRoomMode,
  MpRoomSettings,
  MpRoomSnapshot,
} from '../../types/multiplayer';
import { JerseySvg } from '../common/JerseySvg';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { MpProfileCustomizerModal } from './MpProfileCustomizerModal';

const LEAGUE_OPTIONS: { id: LeagueId; shortLabel: string; count: number }[] =
  LEAGUES.map((l) => ({
    id: l.id,
    shortLabel:
      l.id === 'epl'
        ? 'EPL'
        : l.id === 'laliga'
          ? '라리가'
          : l.id === 'seriea'
            ? '세리에A'
            : l.id === 'bundesliga'
              ? '분데스리가'
              : '리그1',
    count: l.clubs.length,
  }));

interface MultiplayerLobbyProps {
  playerId: string;
  nickname: string;
  onChangeNickname: (next: string) => void;
  avatar: ManagerAvatarConfig;
  clubProfile: UserClubProfile;
  snapshot: MpRoomSnapshot | null;
  onlinePlayerIds: string[];
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
  busy: boolean;
  errorMsg: string | null;
  savedReconnectCode: string | null;
  initialJoinCode: string;
  onCreateRoom: (mode: MpRoomMode, settings: MpRoomSettings) => void;
  onJoinRoom: (code: string) => void;
  onUpdateSettings: (settings: MpRoomSettings) => void;
  onUpdateCustomProfile?: (payload: {
    nickname: string;
    avatar: ManagerAvatarConfig;
    clubProfile: UserClubProfile;
  }) => void;
  onToggleReady: (nextReady: boolean) => void;
  onStartDraft: () => void;
  onLeaveRoom: () => void;
  onCloseMultiplayer: () => void;
}

export function MultiplayerLobby({
  playerId,
  nickname,
  onChangeNickname,
  avatar,
  clubProfile,
  snapshot,
  onlinePlayerIds,
  connectionStatus,
  busy,
  errorMsg,
  savedReconnectCode,
  initialJoinCode,
  onCreateRoom,
  onJoinRoom,
  onUpdateSettings,
  onUpdateCustomProfile,
  onToggleReady,
  onStartDraft,
  onLeaveRoom,
  onCloseMultiplayer,
}: MultiplayerLobbyProps) {
  const [selectedMode, setSelectedMode] = useState<MpRoomMode>('1v1_blind_draft');
  const [joinCode, setJoinCode] = useState<string>(sanitizeRoomCode(initialJoinCode));
  const [createPool, setCreatePool] = useState<LeagueId[]>([...DEFAULT_MP_LEAGUE_POOL]);
  const [createKnockout, setCreateKnockout] = useState<boolean>(true);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const [customizerOpen, setCustomizerOpen] = useState<boolean>(false);

  const toggleCreateLeague = (id: LeagueId) => {
    setCreatePool((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const handleCopy = async (type: 'code' | 'link', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 1800);
    } catch {
      // Fallback copy via prompt-free textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 1800);
    }
  };

  // Graceful fallback if Supabase env vars are missing
  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-6 sm:px-5 sm:py-10 space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onCloseMultiplayer}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#111822] px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            타이틀로
          </button>
          <span className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-400">
            MULTIPLAYER
          </span>
        </div>

        <div className="rounded-2xl border border-amber-500/35 bg-[#0e1520] p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-white">
              멀티플레이 서버가 아직 연결되지 않았습니다
            </h2>
            <p className="text-xs text-slate-400">
              배포 환경에 <code className="text-amber-300">VITE_SUPABASE_URL</code>과{' '}
              <code className="text-amber-300">VITE_SUPABASE_ANON_KEY</code>가 설정되면 바로 활성화됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseMultiplayer}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
          >
            싱글 플레이로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW A: Entry Screen (Create Room or Join Room)
  // =========================================================================
  if (!snapshot) {
    return (
      <div className="mx-auto max-w-4xl px-3 py-4 sm:px-5 sm:py-7 space-y-4">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCloseMultiplayer}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#111822] px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-slate-600 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            타이틀로
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-[11px] font-extrabold text-sky-300">
              <Users className="w-3.5 h-3.5" />
              멀티플레이 로비
            </span>
          </div>
        </div>

        {/* Saved Reconnect Banner (if player refreshed while in a room) */}
        {savedReconnectCode && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/20 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-200">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>진행 중이던 방이 있습니다</span>
              <span className="rounded bg-slate-950/80 px-2 py-0.5 font-mono text-emerald-300">
                {savedReconnectCode}
              </span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onJoinRoom(savedReconnectCode)}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
            >
              재접속
            </button>
          </div>
        )}

        {/* Mode Selector + Profile Bar */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-4 space-y-4">
          {/* Extensible Mode Switcher */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedMode('1v1_blind_draft')}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                selectedMode === '1v1_blind_draft'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                  : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Swords className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold truncate">
                    1대1 블라인드 대전
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    비공개 드래프트 · 실시간 중계
                  </div>
                </div>
              </div>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 shrink-0">
                LIVE
              </span>
            </button>

            <button
              type="button"
              disabled
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-[#0a0f17] px-3.5 py-3 text-left text-slate-500 cursor-not-allowed opacity-70"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Lock className="w-4 h-4 text-slate-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold truncate">
                    멀티 리그
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    2단계 업데이트 예정
                  </div>
                </div>
              </div>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 shrink-0">
                SOON
              </span>
            </button>
          </div>

          {/* Manager Profile Strip */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/80 bg-[#0b1018] px-3.5 py-2.5">
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex h-10 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#111822]">
                <PixelManagerAvatar
                  avatar={avatar}
                  clubPrimaryColor={clubProfile.primaryColor}
                  clubSecondaryColor={clubProfile.secondaryColor}
                  size={30}
                />
              </div>
              <JerseySvg
                primaryColor={clubProfile.primaryColor}
                secondaryColor={clubProfile.secondaryColor}
                pattern={clubProfile.pattern}
                label={clubProfile.shortName}
                size={30}
              />
            </div>

            <div className="flex-1 min-w-[160px]">
              <label
                htmlFor="mp-nickname-input"
                className="block text-[10px] font-bold text-slate-400 mb-1"
              >
                감독 닉네임 · {clubProfile.name} ({clubProfile.shortName})
              </label>
              <input
                id="mp-nickname-input"
                type="text"
                maxLength={14}
                value={nickname}
                onChange={(e) => onChangeNickname(e.target.value)}
                placeholder="감독 이름 입력"
                className="w-full rounded-lg border border-slate-700 bg-[#111822] px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-emerald-500/60"
              />
            </div>

            <button
              id="mp-open-customizer-btn"
              type="button"
              onClick={() => setCustomizerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/12 px-3 py-2 text-xs font-extrabold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer shrink-0"
            >
              <Palette className="h-3.5 w-3.5" />
              감독 · 구단 커스텀
            </button>
          </div>
        </div>

        {customizerOpen && (
          <MpProfileCustomizerModal
            initialNickname={nickname}
            initialAvatar={avatar}
            initialClubProfile={clubProfile}
            onApply={(payload) => {
              onChangeNickname(payload.nickname);
              onUpdateCustomProfile?.(payload);
            }}
            onClose={() => setCustomizerOpen(false)}
          />
        )}

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 px-3.5 py-2.5 text-xs font-bold text-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Two Action Cards: Create vs Join */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {/* Create Room */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-4 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  방 만들기
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  방장 전용 설정
                </span>
              </div>

              {/* Draft Pool Multi-select */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300">드래프트 풀</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {createPool.length}/5 리그
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LEAGUE_OPTIONS.map((lg) => {
                    const active = createPool.includes(lg.id);
                    return (
                      <button
                        key={lg.id}
                        type="button"
                        onClick={() => toggleCreateLeague(lg.id)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                          active
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                            : 'border-slate-800 bg-[#111822] text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {lg.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Knockout Rules Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-[#0b1018] px-3 py-2">
                <span className="text-[11px] font-bold text-slate-300">
                  90분 동점 시 연장 · 승부차기
                </span>
                <button
                  type="button"
                  onClick={() => setCreateKnockout((v) => !v)}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-extrabold transition-colors cursor-pointer ${
                    createKnockout
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {createKnockout ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <button
              id="mp-create-room-btn"
              type="button"
              disabled={busy || createPool.length === 0}
              onClick={() =>
                onCreateRoom(selectedMode, {
                  draftLeaguePool: createPool,
                  knockoutRules: createKnockout,
                  draftGeneration: 1,
                  matchNumber: 1,
                })
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              방 만들기
            </button>
          </div>

          {/* Join by Code */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-4 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-sky-400" />
                  초대 코드로 참가
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  6자리 코드
                </span>
              </div>

              <div className="space-y-2">
                <input
                  id="mp-join-code-input"
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(sanitizeRoomCode(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && joinCode.length === 6 && !busy) {
                      onJoinRoom(joinCode);
                    }
                  }}
                  placeholder="예: A7K9M2"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b1018] px-4 py-3 text-center font-mono text-xl font-black tracking-[0.28em] text-white uppercase outline-none focus:border-sky-400/60"
                />
              </div>
            </div>

            <button
              id="mp-join-room-btn"
              type="button"
              disabled={busy || joinCode.length !== 6}
              onClick={() => onJoinRoom(joinCode)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/45 bg-sky-500/15 py-3 text-sm font-extrabold text-sky-200 hover:bg-sky-500/25 disabled:opacity-45 cursor-pointer"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Swords className="w-4 h-4" />
              )}
              방 참가하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: Active Lobby Room
  // =========================================================================
  const { room, players } = snapshot;
  const isHost = room.host_player_id === playerId;
  const hostPlayer =
    players.find((p) => p.player_id === room.host_player_id) ?? players[0] ?? null;
  const guestPlayer = players.find((p) => p.player_id !== hostPlayer?.player_id) ?? null;
  const myPlayer = players.find((p) => p.player_id === playerId) ?? null;

  const inviteUrl = buildInviteUrl(room.code);
  const canStartDraft = Boolean(hostPlayer && guestPlayer && guestPlayer.is_ready);

  const handleToggleRoomLeague = (id: LeagueId) => {
    if (!isHost) return;
    const prev = room.settings.draftLeaguePool ?? DEFAULT_MP_LEAGUE_POOL;
    const next = prev.includes(id)
      ? prev.length > 1
        ? prev.filter((x) => x !== id)
        : prev
      : [...prev, id];
    onUpdateSettings({ ...room.settings, draftLeaguePool: next });
  };

  const handleToggleRoomKnockout = () => {
    if (!isHost) return;
    onUpdateSettings({
      ...room.settings,
      knockoutRules: !room.settings.knockoutRules,
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-5 sm:py-6 space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-extrabold text-emerald-300">
            <Swords className="w-3.5 h-3.5" />
            1대1 블라인드 대전 로비
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/10 text-emerald-300'
                : 'bg-amber-500/15 text-amber-300'
            }`}
          >
            {connectionStatus === 'connected' ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {connectionStatus === 'connected' ? '실시간' : '연결 중'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCustomizerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-3 py-1.5 text-xs font-extrabold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5" />
            감독 · 구단 커스텀
          </button>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#111822] px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-rose-500/40 hover:text-rose-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            방 나가기
          </button>
        </div>
      </div>

      {customizerOpen && (
        <MpProfileCustomizerModal
          initialNickname={myPlayer?.nickname ?? nickname}
          initialAvatar={myPlayer?.avatar_json ?? avatar}
          initialClubProfile={myPlayer?.club_profile ?? clubProfile}
          onApply={(payload) => {
            onChangeNickname(payload.nickname);
            onUpdateCustomProfile?.(payload);
          }}
          onClose={() => setCustomizerOpen(false)}
        />
      )}

      {/* Invite Code & 1-Click Share Bar */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            초대 코드
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black tracking-[0.25em] text-white">
            {room.code}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopy('code', room.code)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#111822] px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-slate-500 cursor-pointer"
          >
            {copiedType === 'code' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            {copiedType === 'code' ? '코드 복사됨' : '코드 복사'}
          </button>
          <button
            type="button"
            onClick={() => handleCopy('link', inviteUrl)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 px-3.5 py-2 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
          >
            {copiedType === 'link' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
            {copiedType === 'link' ? '링크 복사됨' : '초대 링크 복사'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 px-3.5 py-2.5 text-xs font-bold text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* 2-Seat Player Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { label: 'HOME · 방장', player: hostPlayer, isHostSeat: true },
          { label: 'AWAY · 도전자', player: guestPlayer, isHostSeat: false },
        ].map(({ label, player, isHostSeat }) => {
          const isOnline = player ? onlinePlayerIds.includes(player.player_id) : false;
          const isMe = player?.player_id === playerId;
          return (
            <div
              key={label}
              className={`rounded-2xl border p-4 space-y-3 ${
                isMe
                  ? 'border-emerald-500/40 bg-[#0e1722]'
                  : 'border-slate-800/90 bg-[#0d131c]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1 font-bold text-slate-400">
                  {isHostSeat && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                  {label}
                  {isMe && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                      나
                    </span>
                  )}
                </span>
                {player && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                      isOnline ? 'text-emerald-300' : 'text-slate-500'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    />
                    {isOnline ? '접속 중' : '오프라인'}
                  </span>
                )}
              </div>

              {player ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-11 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#111822] shrink-0">
                      <PixelManagerAvatar
                        avatar={player.avatar_json}
                        clubPrimaryColor={player.club_profile.primaryColor}
                        clubSecondaryColor={player.club_profile.secondaryColor}
                        size={32}
                      />
                    </div>
                    <JerseySvg
                      primaryColor={player.club_profile.primaryColor}
                      secondaryColor={player.club_profile.secondaryColor}
                      pattern={player.club_profile.pattern}
                      label={player.club_profile.shortName}
                      size={32}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-white">
                        {player.nickname}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {player.club_profile.name}
                      </div>
                    </div>
                  </div>

                  {isHostSeat ? (
                    <span className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 shrink-0">
                      방장
                    </span>
                  ) : (
                    <span
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-extrabold shrink-0 ${
                        player.is_ready
                          ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      {player.is_ready ? '준비 완료' : '대기 중'}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex h-12 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-[#090e15] text-xs font-bold text-slate-500">
                  초대 코드로 친구 참가 대기 중...
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Room Settings (Host editable, Guest read-only) */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-white">경기 설정</span>
          <span className="text-[10px] font-bold text-slate-400">
            {isHost ? '방장이 변경 가능' : '방장 설정'}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {LEAGUE_OPTIONS.map((lg) => {
              const active = (room.settings.draftLeaguePool ?? DEFAULT_MP_LEAGUE_POOL).includes(
                lg.id,
              );
              return (
                <button
                  key={lg.id}
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleToggleRoomLeague(lg.id)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    active
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                      : 'border-slate-800 bg-[#111822] text-slate-500'
                  } ${isHost ? 'cursor-pointer hover:border-emerald-400/60' : 'cursor-default'}`}
                >
                  {lg.shortLabel}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!isHost}
            onClick={handleToggleRoomKnockout}
            className={`rounded-lg border px-3 py-1 text-[11px] font-bold transition-colors ${
              room.settings.knockoutRules
                ? 'border-amber-400/40 bg-amber-500/12 text-amber-200'
                : 'border-slate-800 bg-[#111822] text-slate-400'
            } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
          >
            동점 시 연장·PK: {room.settings.knockoutRules ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Primary Action Bar */}
      <div className="flex items-center justify-end gap-2">
        {isHost ? (
          <button
            id="mp-start-draft-btn"
            type="button"
            disabled={busy || !canStartDraft}
            onClick={onStartDraft}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-45 cursor-pointer"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            {!guestPlayer
              ? '상대 입장 대기 중...'
              : !guestPlayer.is_ready
                ? '상대 준비 완료 대기 중...'
                : '블라인드 드래프트 시작'}
          </button>
        ) : (
          <button
            id="mp-toggle-ready-btn"
            type="button"
            disabled={busy || !myPlayer}
            onClick={() => onToggleReady(!myPlayer?.is_ready)}
            className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-extrabold transition-colors cursor-pointer ${
              myPlayer?.is_ready
                ? 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            <Check className="w-4 h-4" />
            {myPlayer?.is_ready ? '준비 취소' : '준비 완료'}
          </button>
        )}
      </div>
    </div>
  );
}

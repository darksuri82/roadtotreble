import {
  Check,
  Copy,
  Crown,
  Link2,
  Loader2,
  LogOut,
  Palette,
  Play,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useState } from 'react';
import { LEAGUES } from '../../../engine/dataLoader';
import { buildInviteUrl, DEFAULT_MP_LEAGUE_POOL } from '../../../services/multiplayerService';
import type { ManagerAvatarConfig, UserClubProfile } from '../../../types/game';
import type { LeagueId } from '../../../types/league';
import {
  MP_LEAGUE_MAX_PLAYERS,
  MP_LEAGUE_TURN_SEC_OPTIONS,
  normalizeMpLeagueSettings,
} from '../../../types/mpLeague';
import type { MpLeagueSettings } from '../../../types/mpLeague';
import type { MpRoomSettings, MpRoomSnapshot } from '../../../types/multiplayer';
import { JerseySvg } from '../../common/JerseySvg';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { MpProfileCustomizerModal } from '../MpProfileCustomizerModal';

const LEAGUE_SHORT: Record<LeagueId, string> = {
  epl: 'EPL',
  laliga: '라리가',
  seriea: '세리에A',
  bundesliga: '분데스리가',
  ligue1: '리그1',
};

interface MpLeagueLobbyRoomProps {
  snapshot: MpRoomSnapshot;
  playerId: string;
  nickname: string;
  avatar: ManagerAvatarConfig;
  clubProfile: UserClubProfile;
  onlinePlayerIds: string[];
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
  busy: boolean;
  errorMsg: string | null;
  onUpdateSettings: (settings: MpRoomSettings) => void;
  onApplyCustomProfile: (payload: {
    nickname: string;
    avatar: ManagerAvatarConfig;
    clubProfile: UserClubProfile;
  }) => void;
  onToggleReady: (nextReady: boolean) => void;
  onStart: () => void;
  onLeaveRoom: () => void;
}

export function MpLeagueLobbyRoom({
  snapshot,
  playerId,
  nickname,
  avatar,
  clubProfile,
  onlinePlayerIds,
  connectionStatus,
  busy,
  errorMsg,
  onUpdateSettings,
  onApplyCustomProfile,
  onToggleReady,
  onStart,
  onLeaveRoom,
}: MpLeagueLobbyRoomProps) {
  const { room, players } = snapshot;
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const isHost = room.host_player_id === playerId;
  const myPlayer = players.find((p) => p.player_id === playerId) ?? null;
  const league: MpLeagueSettings = normalizeMpLeagueSettings(room.settings.league);
  const pool = room.settings.draftLeaguePool?.length
    ? room.settings.draftLeaguePool
    : DEFAULT_MP_LEAGUE_POOL;
  const guests = players.filter((p) => p.player_id !== room.host_player_id);
  const canStart = players.length >= 2 && guests.every((p) => p.is_ready);
  const seats = Array.from({ length: MP_LEAGUE_MAX_PLAYERS }, (_, i) => players[i] ?? null);

  const patchLeague = (changes: Partial<MpLeagueSettings>) => {
    if (!isHost) return;
    onUpdateSettings({ ...room.settings, league: { ...league, ...changes } });
  };

  const togglePool = (id: LeagueId) => {
    if (!isHost) return;
    const next = pool.includes(id)
      ? pool.length > 1
        ? pool.filter((x) => x !== id)
        : pool
      : [...pool, id];
    onUpdateSettings({ ...room.settings, draftLeaguePool: next, league });
  };

  const copy = async (type: 'code' | 'link', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard may be blocked; the code is still visible on screen
    }
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const chipCls = (active: boolean) =>
    `rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
      active
        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
        : 'border-slate-800 bg-[#111822] text-slate-500'
    } ${isHost ? 'cursor-pointer hover:border-emerald-400/60' : 'cursor-default'}`;

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-5 sm:py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/10 px-2.5 py-1 text-xs font-extrabold text-sky-300">
            <Users className="w-3.5 h-3.5" />
            멀티 리그 로비
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
          onApply={onApplyCustomProfile}
          onClose={() => setCustomizerOpen(false)}
        />
      )}

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
            onClick={() => void copy('code', room.code)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#111822] px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-slate-500 cursor-pointer"
          >
            {copied === 'code' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            {copied === 'code' ? '코드 복사됨' : '코드 복사'}
          </button>
          <button
            type="button"
            onClick={() => void copy('link', buildInviteUrl(room.code))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 px-3.5 py-2 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
          >
            {copied === 'link' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
            {copied === 'link' ? '링크 복사됨' : '초대 링크 복사'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 px-3.5 py-2.5 text-xs font-bold text-rose-200">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {seats.map((player, idx) => {
          const isHostSeat = player?.player_id === room.host_player_id;
          const isMe = player?.player_id === playerId;
          const online = player ? onlinePlayerIds.includes(player.player_id) : false;
          return (
            <div
              key={player?.player_id ?? `empty-${idx}`}
              className={`rounded-2xl border p-3.5 ${
                isMe ? 'border-emerald-500/40 bg-[#0e1722]' : 'border-slate-800/90 bg-[#0d131c]'
              }`}
            >
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
                      <div className="flex items-center gap-1 truncate text-sm font-extrabold text-white">
                        {isHostSeat && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        <span className="truncate">{player.nickname}</span>
                        {isMe && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                            나
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 truncate text-[11px] text-slate-400">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            online ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                        {player.club_profile.name}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-extrabold shrink-0 ${
                      isHostSeat
                        ? 'border-amber-400/35 bg-amber-500/10 text-amber-300'
                        : player.is_ready
                          ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {isHostSeat ? '방장' : player.is_ready ? '준비 완료' : '대기 중'}
                  </span>
                </div>
              ) : (
                <div className="flex h-11 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-[#090e15] text-xs font-bold text-slate-600">
                  빈 자리
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-white">리그 설정</span>
          <span className="text-[10px] font-bold text-slate-400">
            {isHost ? '방장이 변경 가능' : '방장 설정'}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-400">진행 리그</div>
          <div className="flex flex-wrap gap-1.5">
            {LEAGUES.map((l) => (
              <button
                key={l.id}
                type="button"
                disabled={!isHost}
                onClick={() => patchLeague({ leagueId: l.id })}
                className={chipCls(league.leagueId === l.id)}
              >
                {LEAGUE_SHORT[l.id]} · {l.totalRounds}R
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-400">드래프트 풀</div>
          <div className="flex flex-wrap gap-1.5">
            {LEAGUES.map((l) => (
              <button
                key={l.id}
                type="button"
                disabled={!isHost}
                onClick={() => togglePool(l.id)}
                className={chipCls(pool.includes(l.id))}
              >
                {LEAGUE_SHORT[l.id]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isHost}
            onClick={() => patchLeague({ uclEnabled: !league.uclEnabled })}
            className={`rounded-lg border px-3 py-1 text-[11px] font-bold transition-colors ${
              league.uclEnabled
                ? 'border-sky-400/45 bg-sky-500/12 text-sky-200'
                : 'border-slate-800 bg-[#111822] text-slate-400'
            } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
          >
            챔피언스리그: {league.uclEnabled ? 'ON' : 'OFF'}
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0b1018] px-2 py-1">
            <span className="text-[10px] font-bold text-slate-500">드래프트 턴</span>
            {MP_LEAGUE_TURN_SEC_OPTIONS.map((sec) => (
              <button
                key={sec}
                type="button"
                disabled={!isHost}
                onClick={() => patchLeague({ turnSec: sec })}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  league.turnSec === sec
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-slate-500'
                } ${isHost ? 'cursor-pointer hover:text-slate-300' : 'cursor-default'}`}
              >
                {sec}초
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {isHost ? (
          <button
            id="mpl-start-btn"
            type="button"
            disabled={busy || !canStart}
            onClick={onStart}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-45 cursor-pointer"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            {players.length < 2
              ? '친구 입장 대기 중...'
              : !canStart
                ? '준비 완료 대기 중...'
                : `멀티 리그 시작 (${players.length}명)`}
          </button>
        ) : (
          <button
            id="mpl-toggle-ready-btn"
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

import { ArrowRight, Check, Dices, Loader2, LogOut, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import { FORMATION_LIST } from '../../../data/formations';
import { MANAGER_TRAIT_LIST } from '../../../data/managerTraits';
import { TACTIC_LIST } from '../../../engine/tacticEngine';
import type { FormationId, ManagerTraitId } from '../../../types/game';
import type { TacticId } from '../../../types/league';
import type {
  MpDraftRoll,
  MpLeagueLive,
  MpLeaguePickRow,
  MpLeagueSquadPayload,
} from '../../../types/mpLeague';
import type { MpRoomPlayerRow, MpRoomRow } from '../../../types/multiplayer';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { MpLeagueDraftBoard } from './MpLeagueDraftBoard';

interface MpLeagueSnakeDraftProps {
  room: MpRoomRow;
  players: MpRoomPlayerRow[];
  playerId: string;
  live: MpLeagueLive;
  picks: MpLeaguePickRow[];
  onlinePlayerIds: string[];
  ackKeys: string[];
  onSavePayload: (payload: MpLeagueSquadPayload) => Promise<void>;
  onSetRoll: (roll: MpDraftRoll) => void;
  onAck: (key: string) => void;
  onLeaveRoom: () => void;
}

export function MpLeagueSnakeDraft(props: MpLeagueSnakeDraftProps) {
  const { room, players, playerId, live, onSavePayload, onLeaveRoom } = props;
  const meRow = players.find((p) => p.player_id === playerId) ?? null;
  const myPayload = meRow?.league_payload ?? null;

  const [traitId, setTraitId] = useState<ManagerTraitId>(
    () => myPayload?.managerTraitId ?? MANAGER_TRAIT_LIST[0].id,
  );
  const [formationDraft, setFormationDraft] = useState<FormationId>(
    () => myPayload?.formation ?? '4-3-3',
  );
  const [tacticDraft, setTacticDraft] = useState<TacticId>(
    () => myPayload?.tactic ?? 'possession',
  );
  const [savingSetup, setSavingSetup] = useState(false);

  if (live.stage !== 'setup') {
    return <MpLeagueDraftBoard {...props} />;
  }

  const handleConfirmSetup = async () => {
    setSavingSetup(true);
    await onSavePayload({
      managerTraitId: traitId,
      formation: formationDraft,
      tactic: tacticDraft,
      starters: [],
      bench: [],
      setupReady: true,
      rev: (myPayload?.rev ?? 0) + 1,
      by: 'player',
    });
    setSavingSetup(false);
  };

  const header = (
    <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-extrabold text-sky-300">
          <Users className="w-3 h-3" />
          감독 선택
        </span>
        <span className="font-mono text-xs font-bold text-slate-400">#{room.code}</span>
      </div>
      <button
        type="button"
        onClick={onLeaveRoom}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#111822] px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-300 cursor-pointer"
      >
        <LogOut className="w-3 h-3" />
        나가기
      </button>
    </div>
  );


  const iAmReady = Boolean(myPayload?.setupReady);
  return (
    <div className="mx-auto max-w-6xl px-2.5 py-3 sm:px-4 sm:py-5 space-y-3">
      {header}
      <div className="flex flex-wrap gap-2">
        {players.map((p) => (
          <div
            key={p.player_id}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${
              p.league_payload?.setupReady
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-slate-800 bg-[#0d131c]'
            }`}
          >
            <PixelManagerAvatar
              avatar={p.avatar_json}
              clubPrimaryColor={p.club_profile.primaryColor}
              clubSecondaryColor={p.club_profile.secondaryColor}
              size={26}
            />
            <span className="text-xs font-bold text-slate-200">{p.nickname}</span>
            {p.league_payload?.setupReady ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            감독 능력 · 포메이션
          </h2>
          <button
            type="button"
            disabled={iAmReady}
            onClick={() => {
              const picked =
                MANAGER_TRAIT_LIST[Math.floor(Math.random() * MANAGER_TRAIT_LIST.length)];
              if (picked) setTraitId(picked.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#111822] px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-400/50 disabled:opacity-40 cursor-pointer"
          >
            <Dices className="w-3.5 h-3.5 text-amber-400" />
            랜덤 추천
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MANAGER_TRAIT_LIST.map((trait) => {
            const active = traitId === trait.id;
            return (
              <button
                key={trait.id}
                type="button"
                disabled={iAmReady}
                onClick={() => setTraitId(trait.id)}
                className={`rounded-xl border p-3 text-left transition-colors cursor-pointer space-y-1 disabled:cursor-default ${
                  active
                    ? 'border-emerald-400/60 bg-emerald-500/12 text-white'
                    : 'border-slate-800 bg-[#111822] text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold truncate">{trait.name}</span>
                  {active && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                  {trait.tagline}
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-slate-800/80">
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400">포메이션</div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {FORMATION_LIST.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={iAmReady}
                  onClick={() => setFormationDraft(f.id)}
                  className={`rounded-lg border py-1.5 px-1 text-[11px] font-bold transition-colors cursor-pointer truncate disabled:cursor-default ${
                    formationDraft === f.id
                      ? 'border-sky-400/55 bg-sky-500/18 text-white'
                      : 'border-slate-800 bg-[#111822] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.id === '4-4-2-diamond'
                    ? '4-4-2◇'
                    : f.id === '3-5-2-dm'
                      ? '3-5-2 DM'
                      : f.id}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400">기본 전술</div>
            <div className="grid grid-cols-5 gap-1.5">
              {TACTIC_LIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={iAmReady}
                  onClick={() => setTacticDraft(t.id)}
                  className={`rounded-lg border py-1.5 px-1 text-[11px] font-bold transition-colors cursor-pointer truncate disabled:cursor-default ${
                    tacticDraft === t.id
                      ? 'border-emerald-400/55 bg-emerald-500/15 text-white'
                      : 'border-slate-800 bg-[#111822] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.shortName}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          {iAmReady ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-sky-400/45 bg-sky-500/15 px-5 py-2.5 text-sm font-extrabold text-sky-200">
              <Loader2 className="w-4 h-4 animate-spin" />
              다른 감독 대기 중
            </div>
          ) : (
            <button
              id="mpl-confirm-setup-btn"
              type="button"
              disabled={savingSetup}
              onClick={() => void handleConfirmSetup()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
            >
              준비 완료
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import {
  Check,
  Crown,
  Loader2,
  Play,
  Swords,
} from 'lucide-react';
import { useMemo } from 'react';
import { FORMATIONS } from '../../data/formations';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { calculateChemistry, calculateTeamRatings } from '../../engine/chemistryEngine';
import { TACTICS } from '../../engine/tacticEngine';
import {
  evaluateTeamTacticalProfile,
  evaluateUnifiedTacticalMatchup,
} from '../../engine/unifiedTacticsEngine';
import type { FormationId, ManagerTraitId } from '../../types/game';
import { DEFAULT_MANAGER_AVATAR } from '../../types/game';
import type { MpRoomPlayerRow, MpTacticSubmission } from '../../types/multiplayer';
import { JerseySvg } from '../common/JerseySvg';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { UnifiedTacticsStrip } from '../common/UnifiedTacticsStrip';

function shortFormationLabel(id: FormationId): string {
  if (id === '4-4-2-diamond') return '4-4-2◇';
  if (id === '3-5-2-dm') return '3-5-2 DM';
  return id;
}

interface PreKickoffRevealModalProps {
  roomCode: string;
  matchNumber: number;
  isHost: boolean;
  hostRow: MpRoomPlayerRow;
  guestRow: MpRoomPlayerRow;
  hostSub: MpTacticSubmission;
  guestSub: MpTacticSubmission;
  hostTraitId: ManagerTraitId;
  guestTraitId: ManagerTraitId;
  busy: boolean;
  errorMsg: string | null;
  onToggleReady: (nextReady: boolean) => void;
  onHostKickoff: () => void;
}

export function PreKickoffRevealModal({
  roomCode,
  matchNumber,
  isHost,
  hostRow,
  guestRow,
  hostSub,
  guestSub,
  hostTraitId,
  guestTraitId,
  busy,
  errorMsg,
  onToggleReady,
  onHostKickoff,
}: PreKickoffRevealModalProps) {
  const hostStats = useMemo(() => {
    const chem = calculateChemistry(
      hostSub.formation,
      hostSub.starters,
      hostSub.tactic,
      hostTraitId,
    );
    const ratings = calculateTeamRatings(
      hostSub.formation,
      hostSub.starters,
      chem.total,
      hostTraitId,
      chem.slotSynergies,
    );
    const fit = evaluateTeamTacticalProfile({
      starters: hostSub.starters,
      formation: hostSub.formation,
      tactic: hostSub.tactic,
      managerTraitId: hostTraitId,
      managerOvr: 86,
    }).tacticalFit;
    return { chem, ratings, fit };
  }, [hostSub, hostTraitId]);

  const guestStats = useMemo(() => {
    const chem = calculateChemistry(
      guestSub.formation,
      guestSub.starters,
      guestSub.tactic,
      guestTraitId,
    );
    const ratings = calculateTeamRatings(
      guestSub.formation,
      guestSub.starters,
      chem.total,
      guestTraitId,
      chem.slotSynergies,
    );
    const fit = evaluateTeamTacticalProfile({
      starters: guestSub.starters,
      formation: guestSub.formation,
      tactic: guestSub.tactic,
      managerTraitId: guestTraitId,
      managerOvr: 86,
    }).tacticalFit;
    return { chem, ratings, fit };
  }, [guestSub, guestTraitId]);

  // Unified matchup evaluated from MY perspective against opponent's REAL locked tactics!
  const myMatchup = useMemo(() => {
    const mySub = isHost ? hostSub : guestSub;
    const oppSub = isHost ? guestSub : hostSub;
    const myTrait = isHost ? hostTraitId : guestTraitId;
    const oppTrait = isHost ? guestTraitId : hostTraitId;
    return evaluateUnifiedTacticalMatchup(
      {
        starters: mySub.starters,
        formation: mySub.formation,
        tactic: mySub.tactic,
        managerTraitId: myTrait,
        managerOvr: 86,
      },
      {
        starters: oppSub.starters,
        formation: oppSub.formation,
        tactic: oppSub.tactic,
        managerTraitId: oppTrait,
        managerOvr: 86,
      },
    );
  }, [isHost, hostSub, guestSub, hostTraitId, guestTraitId]);

  const myRow = isHost ? hostRow : guestRow;
  const bothReady = Boolean(hostRow.is_ready && guestRow.is_ready);

  const cards = [
    {
      roleLabel: 'HOME · 방장',
      row: hostRow,
      sub: hostSub,
      traitId: hostTraitId,
      stats: hostStats,
      isMe: isHost,
      isHostCard: true,
    },
    {
      roleLabel: 'AWAY · 도전자',
      row: guestRow,
      sub: guestSub,
      traitId: guestTraitId,
      stats: guestStats,
      isMe: !isHost,
      isHostCard: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-2.5 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131c] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0a0f17] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-extrabold text-emerald-300">
              <Swords className="w-3.5 h-3.5" />
              최종 전술 공개 · 매치 #{matchNumber}
            </span>
            <span className="font-mono text-xs text-slate-400">#{roomCode}</span>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            1x 동기화 2D 중계
          </span>
        </div>

        {/* Scrollable Comparison Body */}
        <div className="overflow-y-auto p-3.5 sm:p-5 space-y-3.5">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 px-3.5 py-2 text-xs font-bold text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Side-by-Side Final Tactical Cards */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {cards.map(({ roleLabel, row, sub, traitId, stats, isMe, isHostCard }) => {
              const slots = FORMATIONS[sub.formation]?.slots ?? [];
              return (
                <div
                  key={row.player_id}
                  className={`rounded-xl border p-3.5 space-y-3 ${
                    isMe
                      ? 'border-emerald-500/40 bg-[#0f1924]'
                      : 'border-slate-800 bg-[#0b1018]'
                  }`}
                >
                  {/* Card Top: Role & Ready Status */}
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-400">
                      {isHostCard && <Crown className="w-3 h-3 text-amber-400" />}
                      {roleLabel}
                      {isMe && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                          나
                        </span>
                      )}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                        row.is_ready
                          ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      {row.is_ready ? <Check className="w-3 h-3" /> : null}
                      {row.is_ready ? '준비 완료' : '대기 중'}
                    </span>
                  </div>

                  {/* Club, Manager, Final Formation & Tactic */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-10 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#111822] shrink-0">
                        <PixelManagerAvatar
                          avatar={row.avatar_json ?? DEFAULT_MANAGER_AVATAR}
                          clubPrimaryColor={row.club_profile.primaryColor}
                          clubSecondaryColor={row.club_profile.secondaryColor}
                          size={28}
                        />
                      </div>
                      <JerseySvg
                        primaryColor={row.club_profile.primaryColor}
                        secondaryColor={row.club_profile.secondaryColor}
                        pattern={row.club_profile.pattern}
                        label={row.club_profile.shortName}
                        size={30}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-white">
                          {row.club_profile.name}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">
                          {row.nickname} · {MANAGER_TRAITS[traitId]?.name ?? ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-black text-sky-300">
                        {shortFormationLabel(sub.formation)}
                      </div>
                      <div className="text-xs font-extrabold text-amber-300">
                        {TACTICS[sub.tactic].shortName}
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics Strip */}
                  <div className="grid grid-cols-4 gap-1.5 text-center tabular-nums">
                    <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1">
                      <div className="text-[9px] text-slate-500">ATT</div>
                      <div className="font-display text-xs font-bold text-white">
                        {Math.round(stats.ratings.effectiveAtt || stats.ratings.att)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1">
                      <div className="text-[9px] text-slate-500">MID</div>
                      <div className="font-display text-xs font-bold text-white">
                        {Math.round(stats.ratings.effectiveMid || stats.ratings.mid)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1">
                      <div className="text-[9px] text-slate-500">DEF</div>
                      <div className="font-display text-xs font-bold text-white">
                        {Math.round(stats.ratings.effectiveDef || stats.ratings.def)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1">
                      <div className="text-[9px] text-slate-500">완성도</div>
                      <div className="font-display text-xs font-bold text-emerald-300">
                        {stats.fit}%
                      </div>
                    </div>
                  </div>

                  {/* Compact Starting XI Grid */}
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    {sub.starters.slice(0, 11).map((p, idx) => (
                      <div
                        key={`${row.player_id}-${p.id}-${idx}`}
                        className="flex items-center justify-between gap-1 rounded bg-[#090e15] px-2 py-1 border border-slate-800/60"
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-mono text-[9px] font-bold text-slate-500 w-6 shrink-0">
                            {slots[idx]?.subPosition ?? p.position}
                          </span>
                          <span className="truncate font-semibold text-slate-200">
                            {p.name}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-300 tabular-nums shrink-0">
                          {p.ovr}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real 5-Zone Tactical Matchup Strip (from MY perspective) */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-300">
              최종 전술 상성 비교 (내 팀 기준)
            </div>
            <UnifiedTacticsStrip matchup={myMatchup} />
          </div>
        </div>

        {/* Footer: Dual Ready + Host Kickoff Button */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-800 bg-[#0a0f17] px-4 py-3">
          <div className="flex items-center gap-2 text-xs">
            <button
              id="mp-reveal-ready-btn"
              type="button"
              disabled={busy}
              onClick={() => onToggleReady(!myRow.is_ready)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50 ${
                myRow.is_ready
                  ? 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'border border-emerald-400/50 bg-emerald-500/18 text-emerald-200 hover:bg-emerald-500/28'
              }`}
            >
              <Check className="w-4 h-4" />
              {myRow.is_ready ? '준비 취소' : '경기 준비 완료'}
            </button>
          </div>

          {isHost ? (
            <button
              id="mp-reveal-kickoff-btn"
              type="button"
              disabled={busy || !bothReady}
              onClick={onHostKickoff}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              {bothReady ? '경기 시작 · 킥오프' : '양측 준비 완료 대기 중...'}
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-[#111822] px-4 py-2.5 text-xs font-bold text-slate-300">
              {bothReady ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  방장의 경기 시작 대기 중...
                </>
              ) : (
                '양측 모두 준비 완료를 눌러주세요'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

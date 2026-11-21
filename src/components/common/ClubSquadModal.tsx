import { Crown, Diamond, Users, X } from 'lucide-react';
import { useEffect } from 'react';
import {
  getFatigueLabel,
  getFatigueTier,
  getInjuryTooltip,
  getMoraleLabel,
  getMoraleTier,
  isPlayerActivelyInjured,
} from '../../engine/conditionEngine';
import { formatMainPositions } from '../../engine/positionEngine';
import { getPlayerStatById } from '../../engine/standingsEngine';
import { TACTICS } from '../../engine/tacticEngine';
import type { PlayerConditionMap } from '../../types/condition';
import type { Club, PlayerSeasonStats } from '../../types/league';
import type { Player } from '../../types/player';
import { CountryFlagSvg } from './CountryFlagSvg';
import { JerseySvg } from './JerseySvg';
import { PixelStatusIcon } from './PixelStatusIcon';
import { PlayerNameButton } from './PlayerNameButton';

interface ClubSquadModalProps {
  club: Club | null;
  roster: Player[];
  statsMap?: Record<string, PlayerSeasonStats>;
  conditionMap?: PlayerConditionMap;
  onSelectPlayer: (player: Player) => void;
  onClose: () => void;
}

const POS_ORDER: Record<Player['position'], number> = {
  GK: 0,
  DF: 1,
  MF: 2,
  FW: 3,
};

export function ClubSquadModal({
  club,
  roster,
  statsMap,
  conditionMap,
  onSelectPlayer,
  onClose,
}: ClubSquadModalProps) {
  useEffect(() => {
    if (!club) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [club, onClose]);

  if (!club) return null;

  const sortedRoster = [...roster].sort(
    (a, b) => POS_ORDER[a.position] - POS_ORDER[b.position] || b.ovr - a.ovr,
  );

  return (
    <div
      className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-950/82 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0e1520] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0a1019] px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <JerseySvg
              primaryColor={club.primaryColor}
              secondaryColor={club.secondaryColor}
              pattern={club.pattern}
              label={club.shortName}
              size={42}
            />
            <div className="min-w-0">
              <h3 className="truncate text-base font-extrabold text-white">
                {club.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>{club.formation}</span>
                <span>·</span>
                <span>{TACTICS[club.defaultTactic]?.name ?? club.defaultTactic}</span>
                <span>·</span>
                <span className="font-mono text-slate-300">
                  ATT {club.att} / MID {club.mid} / DEF {club.def}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Roster List */}
        <div className="max-h-[72vh] overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-300">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              등록 스쿼드 ({sortedRoster.length}명)
            </span>
            <span>선수 이름 클릭 시 대회별 세부 스탯 확인</span>
          </div>

          <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800 bg-[#090e16] overflow-hidden">
            {sortedRoster.map((p) => {
              const st = getPlayerStatById(statsMap, p.id);
              const cond = conditionMap?.[p.id];
              const injured = isPlayerActivelyInjured(cond);
              const mTier = cond ? getMoraleTier(cond.morale) : 'normal';
              const fat = cond?.fatigue ?? 0;
              const fatTier = getFatigueTier(fat);
              return (
                <div
                  key={p.id}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs hover:bg-slate-800/35 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-10 shrink-0 rounded py-0.5 text-center text-[10px] font-black ${
                        p.position === 'GK'
                          ? 'bg-amber-500/20 text-amber-300'
                          : p.position === 'DF'
                            ? 'bg-sky-500/20 text-sky-300'
                            : p.position === 'MF'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {p.mainPositions[0]}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CountryFlagSvg
                          code={p.nationalityCode}
                          nationality={p.nationality}
                          size="xs"
                        />
                        <PlayerNameButton
                          onClick={() => onSelectPlayer(p)}
                          className="font-bold text-white"
                        >
                          {p.name}
                        </PlayerNameButton>
                        {p.isLegend && (
                          <Crown className="h-3 w-3 text-amber-400 shrink-0" />
                        )}
                        {!p.isLegend && p.ovr >= 91 && (
                          <Diamond className="h-3 w-3 text-cyan-300 shrink-0" />
                        )}
                        {injured && cond?.injury && (
                          <span
                            title={getInjuryTooltip(cond.injury)}
                            className="inline-flex items-center gap-0.5 rounded bg-rose-500/20 border border-rose-400/40 px-1 py-0.5 text-[9px] font-bold text-rose-200"
                          >
                            <PixelStatusIcon variant="injury" size={11} />
                            {cond.injury.matchesRemaining}G
                          </span>
                        )}
                        {mTier === 'ecstatic' && (
                          <PixelStatusIcon
                            variant="morale_high"
                            size={12}
                            title={`사기 ${getMoraleLabel(cond!.morale)}`}
                          />
                        )}
                        {mTier === 'frozen' && (
                          <PixelStatusIcon
                            variant="morale_low"
                            size={12}
                            title={`사기 ${getMoraleLabel(cond!.morale)}`}
                          />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                        <span>
                          {formatMainPositions(p)} · STA {p.stamina ?? 82}
                        </span>
                        {fat >= 40 && (
                          <span
                            className={
                              fatTier === 'burnout' || fatTier === 'danger'
                                ? 'text-rose-400 font-semibold'
                                : 'text-amber-300'
                            }
                          >
                            · 피로 {fat}% ({getFatigueLabel(fat)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    {st && st.appearances > 0 && (
                      <div className="text-right text-[11px]">
                        <div className="font-bold text-emerald-300">
                          {p.position === 'GK' || p.position === 'DF'
                            ? `${st.cleanSheets}CS · ${st.goals}G`
                            : `${st.goals}G ${st.assists}A`}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {st.appearances}경기 · 평점 {st.avgRating.toFixed(2)}
                        </div>
                      </div>
                    )}
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 font-display text-sm font-black text-amber-300">
                      {p.ovr}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

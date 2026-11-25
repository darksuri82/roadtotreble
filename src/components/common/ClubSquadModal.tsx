import { Crown, Diamond, LayoutGrid, List, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getClubManager } from '../../data/aiManagers';
import { FORMATIONS } from '../../data/formations';
import {
  evaluateManagerPlayerSynergy,
  MANAGER_TRAITS,
} from '../../data/managerTraits';
import {
  calculateChemistry,
  calculateTeamRatings,
} from '../../engine/chemistryEngine';
import {
  getInjuryTooltip,
  getMoraleLabel,
  getMoraleTier,
  isPlayerActivelyInjured,
} from '../../engine/conditionEngine';
import { optimizeBestLineup } from '../../engine/lineupOptimizer';
import { formatMainPositions } from '../../engine/positionEngine';
import { getPlayerStatById } from '../../engine/standingsEngine';
import { TACTICS } from '../../engine/tacticEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { PlayerConditionMap } from '../../types/condition';
import type {
  FormationId,
  ManagerAvatarConfig,
  ManagerTraitId,
  PlayerSlotSynergy,
} from '../../types/game';
import type { Club, PlayerSeasonStats, TacticId } from '../../types/league';
import type { Player } from '../../types/player';
import { CountryFlagSvg } from './CountryFlagSvg';
import { JerseySvg } from './JerseySvg';
import { PitchBoard } from './PitchBoard';
import { PixelManagerAvatar } from './PixelManagerAvatar';
import { PixelStatusIcon } from './PixelStatusIcon';
import { PlayerNameButton } from './PlayerNameButton';

export interface ClubSquadManagerOverride {
  name: string;
  ovr?: number;
  traitId: ManagerTraitId | null;
  avatar?: ManagerAvatarConfig;
}

export interface ClubSquadModalProps {
  club: Club | null;
  roster: Player[];
  starters?: (Player | null)[];
  bench?: (Player | null)[];
  formation?: FormationId;
  tactic?: TacticId;
  managerOverride?: ClubSquadManagerOverride | null;
  defaultViewMode?: 'formation' | 'list';
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

/**
 * Infers a natural formation from a roster's position distribution when a club
 * lacks explicit formation metadata.
 */
function inferBestFormationFromRoster(roster: Player[]): FormationId {
  const dfCount = roster.filter((p) => p.position === 'DF').length;
  const mfCount = roster.filter((p) => p.position === 'MF').length;
  const fwCount = roster.filter((p) => p.position === 'FW').length;
  if (dfCount <= 3 && mfCount >= 5) return '3-5-2';
  if (dfCount <= 3) return '3-4-3';
  if (fwCount >= 3 && mfCount >= 3) return '4-3-3';
  if (mfCount >= 5) return '4-2-3-1';
  return '4-4-2';
}

/**
 * Resolves a club's formation, 11 starters, and bench players for the compact
 * formation/list squad popup. Preserves saved lineups when supplied and auto-fills
 * all 11 starter slots with zero empty slots for AI clubs without lineup metadata.
 */
export function buildClubSquadLineup(params: {
  club: Club;
  roster: Player[];
  starters?: (Player | null)[];
  bench?: (Player | null)[];
  formation?: FormationId;
  tactic?: TacticId;
  managerTraitId?: ManagerTraitId | null;
}): {
  formation: FormationId;
  tactic: TacticId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  allPlayers: Player[];
} {
  const { club, roster, starters, bench, formation, tactic, managerTraitId } =
    params;

  const explicitFormation =
    formation && FORMATIONS[formation]
      ? formation
      : club.formation && FORMATIONS[club.formation]
        ? club.formation
        : inferBestFormationFromRoster(roster);
  const resolvedTactic: TacticId = tactic ?? club.defaultTactic ?? 'balanced';

  const validSuppliedStarters = (starters ?? []).filter((p): p is Player =>
    Boolean(p),
  );
  if (validSuppliedStarters.length === 11) {
    const starterIds = new Set(validSuppliedStarters.map((p) => p.id));
    const resolvedBench: (Player | null)[] =
      bench && bench.length > 0
        ? bench
        : roster.filter((p) => !starterIds.has(p.id));
    const seen = new Set<string>();
    const allPlayers: Player[] = [];
    for (const p of [...validSuppliedStarters, ...resolvedBench]) {
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        allPlayers.push(p);
      }
    }
    return {
      formation: explicitFormation,
      tactic: resolvedTactic,
      starters: (starters ?? validSuppliedStarters).slice(0, 11),
      bench: resolvedBench,
      allPlayers,
    };
  }

  // Deduplicate roster pool
  const seen = new Set<string>();
  const deduped: Player[] = [];
  for (const p of roster) {
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  if (club.id.startsWith('hist-')) {
    return {
      formation: explicitFormation,
      tactic: resolvedTactic,
      starters: deduped.slice(0, 11),
      bench: deduped.slice(11),
      allPlayers: deduped,
    };
  }

  if (deduped.length === 0) {
    return {
      formation: explicitFormation,
      tactic: resolvedTactic,
      starters: Array.from({ length: 11 }, () => null),
      bench: [],
      allPlayers: [],
    };
  }

  const optimized = optimizeBestLineup(
    deduped.slice(0, 11),
    deduped.slice(11),
    explicitFormation,
    resolvedTactic,
    managerTraitId ?? null,
  );
  const filledStarters = optimized.starters.slice(0, 11);
  const filledBench = optimized.bench.filter((p): p is Player => Boolean(p));

  // Guarantee zero empty starter slots whenever >= 11 players exist
  if (deduped.length >= 11 && filledStarters.some((s) => s === null)) {
    const usedIds = new Set(
      filledStarters.filter((p): p is Player => Boolean(p)).map((p) => p.id),
    );
    const extras = deduped.filter((p) => !usedIds.has(p.id));
    let extraIdx = 0;
    const patched = filledStarters.map((s) => {
      if (s) return s;
      const next = extras[extraIdx++] ?? null;
      if (next) usedIds.add(next.id);
      return next;
    });
    return {
      formation: explicitFormation,
      tactic: resolvedTactic,
      starters: patched,
      bench: deduped.filter((p) => !usedIds.has(p.id)),
      allPlayers: deduped,
    };
  }

  return {
    formation: explicitFormation,
    tactic: resolvedTactic,
    starters: filledStarters,
    bench: filledBench,
    allPlayers: deduped,
  };
}

export function ClubSquadModal({
  club,
  roster,
  starters,
  bench,
  formation,
  tactic,
  managerOverride,
  defaultViewMode = 'formation',
  statsMap,
  conditionMap,
  onSelectPlayer,
  onClose,
}: ClubSquadModalProps) {
  useBodyScrollLock(Boolean(club));
  const clubKey = club?.id ?? '';
  const [viewModeState, setViewModeState] = useState<{
    clubKey: string;
    mode: 'formation' | 'list';
  }>({ clubKey, mode: defaultViewMode });
  const viewMode =
    viewModeState.clubKey === clubKey ? viewModeState.mode : defaultViewMode;

  useEffect(() => {
    if (!club) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [club, onClose]);

  const resolvedManager = useMemo(() => {
    if (!club) return null;
    if (managerOverride) {
      return {
        name: managerOverride.name,
        ovr: managerOverride.ovr,
        traitId: managerOverride.traitId,
        avatar: managerOverride.avatar,
      };
    }
    const aiMgr = getClubManager(club);
    return aiMgr
      ? {
          name: aiMgr.name,
          ovr: aiMgr.ovr,
          traitId: aiMgr.traitId as ManagerTraitId | null,
          avatar: undefined,
        }
      : null;
  }, [club, managerOverride]);

  const resolvedLineup = useMemo(() => {
    if (!club) return null;
    return buildClubSquadLineup({
      club,
      roster,
      starters,
      bench,
      formation,
      tactic,
      managerTraitId: resolvedManager?.traitId ?? null,
    });
  }, [club, roster, starters, bench, formation, tactic, resolvedManager]);

  const { chemistry, ratings, synergyByPlayerId } = useMemo(() => {
    if (!club || !resolvedLineup || resolvedLineup.allPlayers.length === 0) {
      return {
        chemistry: calculateChemistry('4-3-3', [], 'balanced', null),
        ratings: {
          effectiveAtt: club?.att ?? 0,
          effectiveMid: club?.mid ?? 0,
          effectiveDef: club?.def ?? 0,
        },
        synergyByPlayerId: {} as Record<string, PlayerSlotSynergy>,
      };
    }
    const chem = calculateChemistry(
      resolvedLineup.formation,
      resolvedLineup.starters,
      resolvedLineup.tactic,
      resolvedManager?.traitId ?? null,
      resolvedManager?.ovr,
    );
    const rt = calculateTeamRatings(
      resolvedLineup.formation,
      resolvedLineup.starters,
      chem.total,
      resolvedManager?.traitId ?? null,
      chem.slotSynergies,
      resolvedLineup.tactic,
    );
    const map: Record<string, PlayerSlotSynergy> = {};
    for (const syn of Object.values(chem.slotSynergies)) {
      map[syn.playerId] = syn;
    }
    return {
      chemistry: chem,
      ratings: {
        effectiveAtt: rt.effectiveAtt || club.att,
        effectiveMid: rt.effectiveMid || club.mid,
        effectiveDef: rt.effectiveDef || club.def,
      },
      synergyByPlayerId: map,
    };
  }, [club, resolvedLineup, resolvedManager]);

  if (!club || !resolvedLineup) return null;

  const traitDef = resolvedManager?.traitId
    ? MANAGER_TRAITS[resolvedManager.traitId]
    : null;
  const sortedRoster = [...resolvedLineup.allPlayers].sort(
    (a, b) => POS_ORDER[a.position] - POS_ORDER[b.position] || b.ovr - a.ovr,
  );

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[56] flex items-center justify-center bg-slate-950/82 p-2.5 sm:p-4"
      onClick={onClose}
    >
      <div
        className="modal-panel flex w-full max-w-lg sm:max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#0e1520] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-slate-800 bg-[#0a1019] px-3.5 py-3 sm:px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {resolvedManager?.avatar ? (
              <div className="relative shrink-0">
                <PixelManagerAvatar
                  avatar={resolvedManager.avatar}
                  clubPrimaryColor={club.primaryColor}
                  clubSecondaryColor={club.secondaryColor}
                  size={36}
                />
              </div>
            ) : (
              <JerseySvg
                primaryColor={club.primaryColor}
                secondaryColor={club.secondaryColor}
                pattern={club.pattern}
                label={club.shortName}
                size={36}
              />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate text-sm sm:text-base font-extrabold text-white">
                  {club.name}
                </h3>
                {resolvedManager && (
                  <span className="whitespace-nowrap rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-200 tabular-nums">
                    {resolvedManager.name}
                    {typeof resolvedManager.ovr === 'number'
                      ? ` ${resolvedManager.ovr}`
                      : ''}
                  </span>
                )}
                {traitDef && (
                  <span
                    title={`${traitDef.name} · ${traitDef.effectSummary}`}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-slate-700/80 bg-[#111926] px-1.5 py-0.5 text-[10px] font-bold text-slate-200"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: traitDef.badgeColor }}
                    />
                    {traitDef.name}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-400 tabular-nums">
                <span className="whitespace-nowrap font-bold text-slate-300">
                  {resolvedLineup.formation}
                </span>
                <span>·</span>
                <span className="whitespace-nowrap">
                  {TACTICS[resolvedLineup.tactic]?.name ?? resolvedLineup.tactic}
                </span>
                <span>·</span>
                <span className="whitespace-nowrap font-mono text-slate-300">
                  A {ratings.effectiveAtt} / M {ratings.effectiveMid} / D{' '}
                  {ratings.effectiveDef}
                </span>
                {chemistry.total > 0 && (
                  <>
                    <span>·</span>
                    <span className="whitespace-nowrap font-bold text-emerald-300">
                      케미 {chemistry.total}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() =>
                  setViewModeState({ clubKey, mode: 'formation' })
                }
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer ${
                  viewMode === 'formation'
                    ? 'bg-slate-800 text-white border border-slate-600/80'
                    : 'text-slate-400 border border-transparent hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="h-3 w-3 text-emerald-300" />
                포메이션
              </button>
              <button
                type="button"
                onClick={() => setViewModeState({ clubKey, mode: 'list' })}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-slate-800 text-white border border-slate-600/80'
                    : 'text-slate-400 border border-transparent hover:text-slate-200'
                }`}
              >
                <List className="h-3 w-3 text-sky-300" />
                리스트
              </button>
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
        </div>

        {/* Body */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {viewMode === 'formation' ? (
            <PitchBoard
              formation={resolvedLineup.formation}
              starters={resolvedLineup.starters}
              bench={resolvedLineup.bench}
              chemistry={chemistry}
              managerTraitId={resolvedManager?.traitId ?? null}
              tactic={resolvedLineup.tactic}
              conditionByPlayerId={conditionMap}
              onInspectPlayer={onSelectPlayer}
              onSlotClick={(area, index) => {
                const p =
                  area === 'starter'
                    ? resolvedLineup.starters[index]
                    : resolvedLineup.bench[index];
                if (p) onSelectPlayer(p);
              }}
              compact
              showBench
              showChemBreakdown={false}
              showChemLegend
              headerRight={
                <span className="whitespace-nowrap font-mono text-[10px] font-bold text-slate-300 tabular-nums">
                  A <strong className="text-white">{ratings.effectiveAtt}</strong>{' '}
                  · M{' '}
                  <strong className="text-white">{ratings.effectiveMid}</strong>{' '}
                  · D{' '}
                  <strong className="text-white">{ratings.effectiveDef}</strong>
                </span>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-300">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  등록 스쿼드 ({sortedRoster.length}명)
                </span>
                <span>선수 클릭 시 세부 스탯 확인</span>
              </div>

              <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800 bg-[#090e16] overflow-hidden">
                {sortedRoster.map((p) => {
                  const st = getPlayerStatById(statsMap, p.id);
                  const cond = conditionMap?.[p.id];
                  const injured = isPlayerActivelyInjured(cond);
                  const mTier = cond ? getMoraleTier(cond.morale) : 'normal';
                  const syn = synergyByPlayerId[p.id];
                  const mgrSyn = evaluateManagerPlayerSynergy(
                    p,
                    resolvedManager?.traitId ?? null,
                  );
                  const displayOvr = syn ? syn.effectiveOvrWithSynergy : p.ovr;
                  const synBonus = syn?.totalBonus ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-800/35 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
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
                            {mgrSyn.bonus > 0 && (
                              <span
                                title={mgrSyn.reason ?? '감독 궁합 일치'}
                                className="text-[10px] font-bold text-amber-300 leading-none shrink-0"
                              >
                                ★
                              </span>
                            )}
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
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 tabular-nums">
                        {st && st.appearances > 0 && (
                          <div className="text-right text-[11px] mr-1">
                            <div className="font-bold text-emerald-300">
                              {p.position === 'GK' || p.position === 'DF'
                                ? `${st.cleanSheets}CS · ${st.goals}G`
                                : `${st.goals}G ${st.assists}A`}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {st.appearances}경기 · 평점{' '}
                              {st.avgRating.toFixed(2)}
                            </div>
                          </div>
                        )}
                        {synBonus > 0 && (
                          <span
                            title={syn?.reasons.join(' · ')}
                            className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-black text-emerald-300"
                          >
                            +{synBonus}
                          </span>
                        )}
                        <span
                          title={
                            syn && synBonus > 0
                              ? `기본 ${p.ovr} → 실효 ${displayOvr} (${syn.reasons.join(' · ')})`
                              : undefined
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 font-display text-sm font-black text-amber-300"
                        >
                          {displayOvr}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

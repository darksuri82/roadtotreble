import { CheckCircle2, Crown, Dices, Link2, Sparkles, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PLAYSTYLES } from '../../data/playstyles';
import { ALL_CLUBS_WITH_LEAGUE } from '../../engine/dataLoader';
import {
  evaluatePositionFit,
  formatMainPositions,
} from '../../engine/positionEngine';
import type {
  ManagerTraitId,
  PlayerSlotSynergy,
  RouletteReelResult,
} from '../../types/game';
import type { LeagueId } from '../../types/league';
import { LEAGUE_LABELS } from '../../types/player';
import type { Player, SubPosition } from '../../types/player';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { JerseySvg } from '../common/JerseySvg';
import { PlayerCard } from '../common/PlayerCard';

interface RouletteReelsViewProps {
  hasSpun: boolean;
  reels: RouletteReelResult[];
  /** Number of club reels (3 default; 4 for 3+ player multi-league draft) */
  reelCount?: number;
  legendRatePercent: number; // 2.5 or 4.0
  targetSubPosition: SubPosition;
  managerTraitId: ManagerTraitId | null;
  allowedLeagueIds?: LeagueId[];
  previewCandidate?: Player | null;
  onSelectPreviewCandidate?: (player: Player | null) => void;
  previewSlotSynergy?: PlayerSlotSynergy | null;
  previewChemDelta?: number;
  onSpin: () => void;
  onPickPlayer: (player: Player) => void;
  pickActionLabel: string;
  /** False when waiting for another manager's turn in multiplayer draft (keeps full size, disables confirm) */
  canPick?: boolean;
  /** False when another manager is responsible for spinning the shared roulette */
  canSpin?: boolean;
  /** Concise status label displayed when waiting for another manager (e.g. "철수 지명 중") */
  waitingStatusLabel?: string | null;
  /** Map of playerId -> picker nickname; keeps taken cards locked in place instead of removing them */
  takenByPlayerId?: Record<string, string>;
  /** Optional map of playerId -> expected adjacent 4-color chemistry links at active draft slot */
  expectedLinksByPlayerId?: Record<string, number>;
}

export function RouletteReelsView({
  hasSpun,
  reels,
  reelCount = 3,
  legendRatePercent,
  targetSubPosition,
  managerTraitId,
  allowedLeagueIds,
  previewCandidate,
  onSelectPreviewCandidate,
  previewSlotSynergy = null,
  previewChemDelta = 0,
  onSpin,
  onPickPlayer,
  pickActionLabel,
  canPick = true,
  canSpin = true,
  waitingStatusLabel = null,
  takenByPlayerId,
  expectedLinksByPlayerId,
}: RouletteReelsViewProps) {
  const effectiveReelCount = Math.max(reelCount, reels.length || 0);
  const [lockedCount, setLockedCount] = useState(hasSpun ? effectiveReelCount : 0);
  const [tick, setTick] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [activeClubTab, setActiveClubTab] = useState<number | 'all'>('all');
  const [internalCandidate, setInternalCandidate] = useState<Player | null>(
    null,
  );

  const rawSelected =
    previewCandidate !== undefined ? previewCandidate : internalCandidate;
  const selectedCandidate =
    rawSelected && takenByPlayerId?.[rawSelected.id] ? null : rawSelected;

  const updateSelectedCandidate = (player: Player | null) => {
    setInternalCandidate(player);
    onSelectPreviewCandidate?.(player);
  };

  const previewClubs =
    allowedLeagueIds && allowedLeagueIds.length > 0
      ? ALL_CLUBS_WITH_LEAGUE.filter((c) =>
          allowedLeagueIds.includes(c.leagueId),
        )
      : ALL_CLUBS_WITH_LEAGUE;
  const activePreviewPool =
    previewClubs.length > 0 ? previewClubs : ALL_CLUBS_WITH_LEAGUE;

  useEffect(() => {
    if (!animating) return;
    const iv = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 65);

    const timers: number[] = [];
    const total = effectiveReelCount;
    for (let step = 1; step <= total; step += 1) {
      const delay = 280 + (step - 1) * 230;
      const isLast = step === total;
      timers.push(
        window.setTimeout(() => {
          setLockedCount(step);
          if (isLast) {
            setAnimating(false);
            window.clearInterval(iv);
          }
        }, delay),
      );
    }

    return () => {
      window.clearInterval(iv);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [animating, effectiveReelCount]);

  const handleSpinClick = () => {
    if (hasSpun || animating || !canSpin) return;
    setLockedCount(0);
    setActiveClubTab('all');
    updateSelectedCandidate(null);
    setAnimating(true);
    onSpin();
  };

  const handleConfirmPick = (player: Player) => {
    if (!canPick || takenByPlayerId?.[player.id]) return;
    updateSelectedCandidate(null);
    onPickPlayer(player);
  };

  const handleCandidateCardClick = (player: Player) => {
    if (takenByPlayerId?.[player.id]) return;
    if (selectedCandidate?.id === player.id) {
      if (canPick) handleConfirmPick(player);
      else updateSelectedCandidate(null);
      return;
    }
    updateSelectedCandidate(player);
  };

  const effectiveLockedCount = hasSpun && !animating ? effectiveReelCount : lockedCount;
  const allRevealed = hasSpun && !animating && effectiveLockedCount >= effectiveReelCount;
  const visibleReels =
    activeClubTab === 'all'
      ? reels
      : reels.filter((r) => r.reelIndex === activeClubTab);

  const selectedFit = selectedCandidate
    ? evaluatePositionFit(selectedCandidate, targetSubPosition, managerTraitId)
    : null;
  const synBonus = previewSlotSynergy?.totalBonus ?? 0;
  const finalBoostedOvr = selectedFit ? selectedFit.effectiveOvr + synBonus : 0;
  const remainingCount = reels.reduce(
    (sum, r) =>
      sum + r.candidates.filter((c) => !takenByPlayerId?.[c.id]).length,
    0,
  );
  const reelIndices = Array.from({ length: effectiveReelCount }, (_, i) => i);

  return (
    <div className="space-y-2">
      {/* Compact Club Roulette Machine */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131c] p-2 sm:p-2.5">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
            <Dices className="w-3.5 h-3.5 text-emerald-400" />
            {effectiveReelCount}구단 룰렛 · 구단당 3명
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-px text-[10px] font-bold text-amber-300">
            <Crown className="w-2.5 h-2.5" />
            LEGEND {legendRatePercent.toFixed(1)}%
          </span>
        </div>

        {/* Visual Reels (3 cols or 2x2 / 4 cols for 4-club roulette) */}
        <div
          className={`grid gap-1.5 ${
            effectiveReelCount >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
          }`}
        >
          {reelIndices.map((reelIdx) => {
            const isLocked =
              hasSpun && effectiveLockedCount > reelIdx && reels[reelIdx];
            const reelData = isLocked ? reels[reelIdx] : null;
            const spinningEntry =
              activePreviewPool[
                (tick * 7 + reelIdx * 31) % activePreviewPool.length
              ];
            const showGoldFlash = animating && (tick + reelIdx) % 9 === 0;

            return (
              <div
                key={reelIdx}
                className={`relative flex flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center min-h-[54px] sm:min-h-[60px] transition-all duration-200 ${
                  reelData
                    ? reelData.isLegendSlot
                      ? 'card-legend-glow'
                      : 'border-emerald-500/35 bg-[#121a25]'
                    : animating
                      ? showGoldFlash
                        ? 'border-amber-400 bg-amber-950/35'
                        : 'border-sky-400/40 bg-slate-900/80'
                      : 'border-dashed border-slate-800 bg-slate-950/50'
                }`}
              >
                <span className="absolute top-1 left-1.5 text-[8.5px] font-bold text-slate-500">
                  #{reelIdx + 1}
                </span>

                {reelData ? (
                  reelData.isLegendSlot ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <Crown className="w-4 h-4 text-amber-300" />
                      <span className="font-display text-xs font-bold tracking-wider text-amber-300 leading-none">
                        LEGEND
                      </span>
                      <span className="text-[9px] font-semibold text-amber-200/90 leading-none">
                        단독 1명
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5 min-w-0 max-w-full">
                      {reelData.club && (
                        <JerseySvg
                          primaryColor={reelData.club.primaryColor}
                          secondaryColor={reelData.club.secondaryColor}
                          pattern={reelData.club.pattern}
                          label={reelData.club.shortName}
                          size={22}
                        />
                      )}
                      <span className="truncate max-w-full text-[11px] font-bold text-white leading-tight">
                        {reelData.club?.name}
                      </span>
                      <span className="text-[9px] text-slate-400 leading-none">
                        {LEAGUE_LABELS[reelData.leagueId]} · {reelData.candidates.length}명
                      </span>
                    </div>
                  )
                ) : animating ? (
                  showGoldFlash ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <Crown className="w-4 h-4 text-amber-300 animate-pulse" />
                      <span className="font-display text-[11px] font-bold text-amber-300">
                        LEGEND?!
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5 opacity-85 min-w-0 max-w-full">
                      <JerseySvg
                        primaryColor={spinningEntry.club.primaryColor}
                        secondaryColor={spinningEntry.club.secondaryColor}
                        pattern={spinningEntry.club.pattern}
                        size={20}
                      />
                      <span className="truncate max-w-full text-[10px] font-semibold text-slate-300">
                        {spinningEntry.club.name}
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-1 text-slate-600">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-[10px]">대기</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Spin Button or Waiting Bar */}
        {!hasSpun && (
          canSpin ? (
            <button
              id="spin-club-roulette-btn"
              type="button"
              onClick={handleSpinClick}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5" />
              룰렛 돌리기 ({targetSubPosition} · {effectiveReelCount}구단 추첨)
            </button>
          ) : (
            <div className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-[#0b1018] py-2 text-[11px] font-bold text-slate-400">
              <Dices className="w-3.5 h-3.5 text-slate-500" />
              {waitingStatusLabel ?? '상대 룰렛 대기 중'}
            </div>
          )
        )}
      </div>

      {/* Compact Selection & Live Pitch Synergy Preview Strip */}
      {allRevealed && reels.length > 0 && (
        <div className="space-y-1.5">
          {selectedCandidate && selectedFit ? (
            <div className="min-h-[44px] flex flex-col justify-center rounded-xl border border-emerald-400/70 bg-emerald-950/30 px-2.5 py-1.5 gap-1">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="rounded bg-emerald-400 px-1 py-px text-[9px] font-black text-slate-950">
                    프리뷰
                  </span>
                  <CountryFlagSvg
                    code={selectedCandidate.nationalityCode}
                    nationality={selectedCandidate.nationality}
                    size="xs"
                  />
                  <span className="truncate text-xs font-extrabold text-white">
                    {selectedCandidate.name}
                  </span>
                  <span className="rounded bg-slate-950/85 border border-slate-700/80 px-1.5 py-px text-[10px] font-bold text-slate-200 tabular-nums">
                    {targetSubPosition}{' '}
                    <strong
                      className={
                        selectedFit.penalty < 0
                          ? 'text-amber-300'
                          : 'text-white'
                      }
                    >
                      {selectedFit.effectiveOvr}
                    </strong>
                    {synBonus > 0 && (
                      <strong className="ml-0.5 text-emerald-300">
                        →{finalBoostedOvr}(+{synBonus})
                      </strong>
                    )}
                  </span>
                  {previewSlotSynergy && previewSlotSynergy.managerBonus > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded border border-amber-400/45 bg-amber-400/15 px-1 py-px text-[9px] font-extrabold text-amber-200">
                      <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                      감독+{previewSlotSynergy.managerBonus}
                    </span>
                  )}
                  {previewSlotSynergy && previewSlotSynergy.neighborBonus > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded border border-emerald-400/45 bg-emerald-500/15 px-1 py-px text-[9px] font-extrabold text-emerald-200">
                      <Link2 className="w-2.5 h-2.5 text-emerald-300" />
                      인접+{previewSlotSynergy.neighborBonus}
                    </span>
                  )}
                  <span
                    className={`rounded border px-1 py-px text-[9px] font-bold tabular-nums ${
                      previewChemDelta > 0
                        ? 'border-sky-400/40 bg-sky-500/15 text-sky-200'
                        : previewChemDelta < 0
                          ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                          : 'border-slate-800 bg-slate-900/80 text-slate-400'
                    }`}
                  >
                    케미 {previewChemDelta > 0 ? `+${previewChemDelta}` : previewChemDelta}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {canPick ? (
                    <button
                      id="confirm-draft-pick-btn"
                      type="button"
                      onClick={() => handleConfirmPick(selectedCandidate)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {pickActionLabel || '영입'} 확정
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-[10px] font-bold text-slate-400 cursor-not-allowed"
                    >
                      {waitingStatusLabel ?? '상대 지명 중'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => updateSelectedCandidate(null)}
                    title="임시 배치 해제"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900/90 p-1 text-slate-400 hover:border-slate-500 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 text-[9.5px] text-slate-400">
                <span>
                  <strong className="text-emerald-300">
                    {formatMainPositions(selectedCandidate)}
                  </strong>
                  {selectedCandidate.secondaryPositions.length > 0 && (
                    <span className="text-amber-300/90">
                      {' '}
                      (부 {selectedCandidate.secondaryPositions.join('/')})
                    </span>
                  )}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300">
                  {selectedCandidate.isLegend ? 'ICON' : selectedCandidate.club}
                </span>
                {selectedCandidate.playstyles.map((ps) => (
                  <span
                    key={ps}
                    className="rounded bg-slate-900 px-1 py-px font-semibold text-amber-300"
                  >
                    {PLAYSTYLES[ps]?.shortName ?? PLAYSTYLES[ps]?.name ?? ps}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="min-h-[34px] flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-slate-800 bg-[#0d131c] px-2.5 py-1.5 text-[11px] text-slate-400">
              {canPick ? (
                <span>
                  <strong className="text-emerald-300">1클릭</strong> 프리뷰 ·{' '}
                  <strong className="text-white">확정</strong>(재클릭) 지명
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-bold text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {waitingStatusLabel ?? '상대 지명 중'}
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-500 tabular-nums">
                남은 후보 {remainingCount}명
              </span>
            </div>
          )}

          {/* Compact Club Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveClubTab('all')}
              className={`rounded-md border px-2 py-1 text-[10.5px] font-bold transition-colors cursor-pointer ${
                activeClubTab === 'all'
                  ? 'bg-slate-800 text-white border-emerald-500/50'
                  : 'bg-[#111822] text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              전체 ({remainingCount})
            </button>
            {reels.map((reel) => {
              const active = activeClubTab === reel.reelIndex;
              return (
                <button
                  key={reel.reelIndex}
                  type="button"
                  onClick={() => setActiveClubTab(reel.reelIndex)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-bold transition-colors cursor-pointer ${
                    active
                      ? reel.isLegendSlot
                        ? 'bg-amber-500/18 text-amber-200 border-amber-400/55'
                        : 'bg-slate-800 text-white border-slate-500/70'
                      : reel.isLegendSlot
                        ? 'bg-amber-950/35 text-amber-300/85 border-amber-400/30 hover:border-amber-400/50'
                        : 'bg-[#111822] text-slate-300 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {reel.isLegendSlot ? (
                    <>
                      <Crown className="w-2.5 h-2.5" />
                      LEGEND
                    </>
                  ) : (
                    <>
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: reel.club?.primaryColor ?? '#64748b' }}
                      />
                      {reel.club?.name}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Ultra-Compact Grouped Club Candidate Sections */}
          <div className="space-y-1.5">
            {visibleReels.map((reel) => (
              <div
                key={reel.reelIndex}
                className={`rounded-xl border p-1.5 sm:p-2 space-y-1.5 ${
                  reel.isLegendSlot
                    ? 'border-amber-400/60 bg-gradient-to-br from-amber-950/35 via-[#15120c] to-amber-950/20 shadow-[0_0_16px_rgba(251,191,36,0.12)]'
                    : 'border-slate-800 bg-[#0d131c]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 px-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {reel.isLegendSlot ? (
                      <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    ) : (
                      reel.club && (
                        <JerseySvg
                          primaryColor={reel.club.primaryColor}
                          secondaryColor={reel.club.secondaryColor}
                          pattern={reel.club.pattern}
                          size={16}
                        />
                      )
                    )}
                    <span
                      className={`truncate text-[11px] font-bold ${
                        reel.isLegendSlot ? 'text-amber-300' : 'text-white'
                      }`}
                    >
                      {reel.isLegendSlot
                        ? '황금 LEGEND 단독 출현'
                        : reel.club?.name}
                    </span>
                    <span className="text-[9.5px] text-slate-500">
                      {LEAGUE_LABELS[reel.leagueId]}
                    </span>
                  </div>
                  <span
                    className={`text-[9.5px] font-semibold shrink-0 ${
                      reel.isLegendSlot ? 'text-amber-300/90' : 'text-slate-500'
                    }`}
                  >
                    {reel.isLegendSlot ? '1명' : `${reel.candidates.length}명`}
                  </span>
                </div>

                {reel.isLegendSlot ? (
                  <div className="mx-auto max-w-xs">
                    {reel.candidates.map((player) => {
                      const pickedBy = takenByPlayerId?.[player.id] ?? null;
                      return (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          targetSubPosition={targetSubPosition}
                          managerTraitId={managerTraitId}
                          selected={!pickedBy && selectedCandidate?.id === player.id}
                          disabled={Boolean(pickedBy)}
                          dense
                          lockedBadgeLabel={pickedBy}
                          disableConfirmAction={!canPick}
                          disabledActionLabel={waitingStatusLabel ?? '상대 지명 중'}
                          expectedLinkCount={expectedLinksByPlayerId?.[player.id]}
                          onClick={() => handleCandidateCardClick(player)}
                          onConfirmAction={() => handleConfirmPick(player)}
                          actionLabel={pickActionLabel}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 snap-x sm:grid sm:grid-cols-3 sm:gap-1.5 sm:overflow-visible sm:pb-0">
                    {reel.candidates.map((player) => {
                      const pickedBy = takenByPlayerId?.[player.id] ?? null;
                      return (
                        <div
                          key={player.id}
                          className="w-[176px] shrink-0 snap-start sm:w-auto sm:shrink"
                        >
                          <PlayerCard
                            player={player}
                            targetSubPosition={targetSubPosition}
                            managerTraitId={managerTraitId}
                            selected={!pickedBy && selectedCandidate?.id === player.id}
                            disabled={Boolean(pickedBy)}
                            dense
                            lockedBadgeLabel={pickedBy}
                            disableConfirmAction={!canPick}
                            disabledActionLabel={waitingStatusLabel ?? '상대 지명 중'}
                            expectedLinkCount={expectedLinksByPlayerId?.[player.id]}
                            onClick={() => handleCandidateCardClick(player)}
                            onConfirmAction={() => handleConfirmPick(player)}
                            actionLabel={pickActionLabel}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

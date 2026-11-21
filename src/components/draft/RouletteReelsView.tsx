import { CheckCircle2, Crown, Dices, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PLAYSTYLES } from '../../data/playstyles';
import { ALL_CLUBS_WITH_LEAGUE } from '../../engine/dataLoader';
import {
  evaluatePositionFit,
  formatMainPositions,
} from '../../engine/positionEngine';
import type { ManagerTraitId, RouletteReelResult } from '../../types/game';
import type { LeagueId } from '../../types/league';
import { LEAGUE_LABELS } from '../../types/player';
import type { Player, SubPosition } from '../../types/player';
import { getCountryFlag } from '../../utils/countryFlag';
import { JerseySvg } from '../common/JerseySvg';
import { PlayerCard } from '../common/PlayerCard';

interface RouletteReelsViewProps {
  hasSpun: boolean;
  reels: RouletteReelResult[];
  legendRatePercent: number; // 2.5 or 4.0
  targetSubPosition: SubPosition;
  managerTraitId: ManagerTraitId | null;
  allowedLeagueIds?: LeagueId[];
  onSpin: () => void;
  onPickPlayer: (player: Player) => void;
  pickActionLabel: string;
}

export function RouletteReelsView({
  hasSpun,
  reels,
  legendRatePercent,
  targetSubPosition,
  managerTraitId,
  allowedLeagueIds,
  onSpin,
  onPickPlayer,
  pickActionLabel,
}: RouletteReelsViewProps) {
  const [lockedCount, setLockedCount] = useState(hasSpun ? 3 : 0);
  const [tick, setTick] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [activeClubTab, setActiveClubTab] = useState<number | 'all'>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Player | null>(
    null,
  );

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

    const t1 = window.setTimeout(() => setLockedCount(1), 380);
    const t2 = window.setTimeout(() => setLockedCount(2), 700);
    const t3 = window.setTimeout(() => {
      setLockedCount(3);
      setAnimating(false);
      window.clearInterval(iv);
    }, 1020);

    return () => {
      window.clearInterval(iv);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [animating]);

  const handleSpinClick = () => {
    if (hasSpun || animating) return;
    setLockedCount(0);
    setActiveClubTab('all');
    setSelectedCandidate(null);
    setAnimating(true);
    onSpin();
  };

  const handleConfirmPick = (player: Player) => {
    setSelectedCandidate(null);
    onPickPlayer(player);
  };

  const allRevealed = hasSpun && !animating && lockedCount >= 3;
  const visibleReels =
    activeClubTab === 'all'
      ? reels
      : reels.filter((r) => r.reelIndex === activeClubTab);

  const selectedFit = selectedCandidate
    ? evaluatePositionFit(selectedCandidate, targetSubPosition, managerTraitId)
    : null;

  return (
    <div className="space-y-4">
      {/* Top 3-Slot Club Roulette Machine */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131c] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Dices className="w-4 h-4 text-emerald-400" />
            3구단 룰렛 · 구단당 3명 (LEGEND 1명 단독 등장)
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
            <Crown className="w-3 h-3" />
            릴당 LEGEND {legendRatePercent.toFixed(1)}%
          </span>
        </div>

        {/* 3 Visual Reels */}
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((reelIdx) => {
            const isLocked = hasSpun && lockedCount > reelIdx && reels[reelIdx];
            const reelData = isLocked ? reels[reelIdx] : null;
            const spinningEntry =
              activePreviewPool[
                (tick * 7 + reelIdx * 31) % activePreviewPool.length
              ];
            const showGoldFlash = animating && (tick + reelIdx) % 9 === 0;

            return (
              <div
                key={reelIdx}
                className={`relative flex flex-col items-center justify-center rounded-xl border p-3 text-center min-h-[96px] transition-all duration-200 ${
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
                <span className="absolute top-1.5 left-2 text-[9px] font-bold text-slate-500">
                  #{reelIdx + 1}
                </span>

                {reelData ? (
                  reelData.isLegendSlot ? (
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <Crown className="w-6 h-6 text-amber-300" />
                      <span className="font-display text-sm font-bold tracking-wider text-amber-300">
                        LEGEND
                      </span>
                      <span className="text-[10px] font-semibold text-amber-200/90">
                        단독 출현 · 1명
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 pt-1">
                      {reelData.club && (
                        <JerseySvg
                          primaryColor={reelData.club.primaryColor}
                          secondaryColor={reelData.club.secondaryColor}
                          pattern={reelData.club.pattern}
                          label={reelData.club.shortName}
                          size={34}
                        />
                      )}
                      <span className="truncate max-w-full text-xs font-bold text-white">
                        {reelData.club?.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {LEAGUE_LABELS[reelData.leagueId]} · {reelData.candidates.length}명
                      </span>
                    </div>
                  )
                ) : animating ? (
                  showGoldFlash ? (
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <Crown className="w-5 h-5 text-amber-300 animate-pulse" />
                      <span className="font-display text-xs font-bold text-amber-300">
                        LEGEND?!
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 pt-1 opacity-85">
                      <JerseySvg
                        primaryColor={spinningEntry.club.primaryColor}
                        secondaryColor={spinningEntry.club.secondaryColor}
                        pattern={spinningEntry.club.pattern}
                        size={30}
                      />
                      <span className="truncate max-w-full text-[11px] font-semibold text-slate-300">
                        {spinningEntry.club.name}
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center gap-1 pt-1 text-slate-600">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[11px]">대기</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Spin Button */}
        {!hasSpun && (
          <button
            id="spin-club-roulette-btn"
            type="button"
            onClick={handleSpinClick}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 active:scale-[0.99] transition-all cursor-pointer"
          >
            <Dices className="w-4 h-4" />
            룰렛 돌리기 ({targetSubPosition} 슬롯 · 3구단 추첨)
          </button>
        )}
      </div>

      {/* 2-Step Selection & Confirmation Preview Bar (prevents accidental one-click picks) */}
      {allRevealed && reels.length > 0 && (
        <div className="space-y-3">
          {selectedCandidate && selectedFit ? (
            <div className="rounded-xl border border-emerald-400/60 bg-emerald-950/25 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-300">
                      선택된 후보
                    </span>
                    <span className="text-sm font-extrabold text-white">
                      {selectedCandidate.name}
                    </span>
                    <span className="text-xs text-slate-300">
                      {getCountryFlag(selectedCandidate.nationalityCode)}{' '}
                      {selectedCandidate.nationality} ·{' '}
                      {selectedCandidate.isLegend
                        ? 'ICON 와일드카드'
                        : selectedCandidate.club}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
                    <span>
                      주포지션:{' '}
                      <strong className="text-emerald-300">
                        {formatMainPositions(selectedCandidate)}
                      </strong>
                    </span>
                    {selectedCandidate.secondaryPositions.length > 0 && (
                      <span>
                        부포지션:{' '}
                        <strong className="text-amber-300">
                          {selectedCandidate.secondaryPositions.join(' · ')}
                        </strong>
                      </span>
                    )}
                    <span>
                      {targetSubPosition} 실효 OVR:{' '}
                      <strong
                        className={
                          selectedFit.penalty < 0
                            ? 'text-amber-300'
                            : 'text-white'
                        }
                      >
                        {selectedFit.effectiveOvr}
                        {selectedFit.penalty < 0
                          ? ` (${selectedFit.penalty})`
                          : ' (100%)'}
                      </strong>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                    {selectedCandidate.playstyles.map((ps) => (
                      <span
                        key={ps}
                        className="rounded bg-slate-900 px-1.5 py-0.5 font-semibold text-amber-300"
                      >
                        {PLAYSTYLES[ps]?.name ?? ps}
                      </span>
                    ))}
                    {selectedCandidate.scoutNote && (
                      <span className="truncate">
                        · {selectedCandidate.scoutNote}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  id="confirm-draft-pick-btn"
                  type="button"
                  onClick={() => handleConfirmPick(selectedCandidate)}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {selectedCandidate.name} {pickActionLabel}하기
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-[#0d131c] px-3.5 py-2.5 text-xs text-slate-400">
              후보 카드를 먼저 <strong className="text-slate-200">클릭해 상세 정보를 확인</strong>한 뒤, 활성화된{' '}
              <strong className="text-emerald-300">[영입하기]</strong> 버튼을 눌러 확정하세요.
            </div>
          )}

          {/* Club Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveClubTab('all')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  activeClubTab === 'all'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#111822] text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                전체 구단 ({reels.reduce((sum, r) => sum + r.candidates.length, 0)})
              </button>
              {reels.map((reel) => {
                const active = activeClubTab === reel.reelIndex;
                return (
                  <button
                    key={reel.reelIndex}
                    type="button"
                    onClick={() => setActiveClubTab(reel.reelIndex)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? reel.isLegendSlot
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-200 text-slate-950'
                        : reel.isLegendSlot
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-400/40'
                          : 'bg-[#111822] text-slate-300 border border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {reel.isLegendSlot ? (
                      <>
                        <Crown className="w-3 h-3" />
                        LEGEND (1)
                      </>
                    ) : (
                      <>
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: reel.club?.primaryColor ?? '#64748b' }}
                        />
                        {reel.club?.name}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-slate-400">
              선택 후 영입 확정
            </span>
          </div>

          {/* Grouped Club Candidate Sections */}
          <div className="space-y-3">
            {visibleReels.map((reel) => (
              <div
                key={reel.reelIndex}
                className={`rounded-xl border p-3 space-y-2.5 ${
                  reel.isLegendSlot
                    ? 'border-amber-400/60 bg-gradient-to-br from-amber-950/35 via-[#15120c] to-amber-950/20 shadow-[0_0_20px_rgba(251,191,36,0.12)]'
                    : 'border-slate-800 bg-[#0d131c]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {reel.isLegendSlot ? (
                      <Crown className="w-4 h-4 text-amber-300 shrink-0" />
                    ) : (
                      reel.club && (
                        <JerseySvg
                          primaryColor={reel.club.primaryColor}
                          secondaryColor={reel.club.secondaryColor}
                          pattern={reel.club.pattern}
                          size={22}
                        />
                      )
                    )}
                    <span
                      className={`truncate text-xs font-bold ${
                        reel.isLegendSlot ? 'text-amber-300' : 'text-white'
                      }`}
                    >
                      {reel.isLegendSlot
                        ? '황금 LEGEND 단독 출현!'
                        : reel.club?.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {LEAGUE_LABELS[reel.leagueId]}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold ${
                      reel.isLegendSlot ? 'text-amber-300/90' : 'text-slate-500'
                    }`}
                  >
                    {reel.isLegendSlot
                      ? '희귀 단독 카드'
                      : `${reel.candidates.length}명 중 선택`}
                  </span>
                </div>

                {reel.isLegendSlot ? (
                  <div className="mx-auto max-w-sm">
                    {reel.candidates.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        targetSubPosition={targetSubPosition}
                        managerTraitId={managerTraitId}
                        selected={selectedCandidate?.id === player.id}
                        onClick={() => setSelectedCandidate(player)}
                        onConfirmAction={() => handleConfirmPick(player)}
                        actionLabel={pickActionLabel}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {reel.candidates.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        targetSubPosition={targetSubPosition}
                        managerTraitId={managerTraitId}
                        selected={selectedCandidate?.id === player.id}
                        onClick={() => setSelectedCandidate(player)}
                        onConfirmAction={() => handleConfirmPick(player)}
                        actionLabel={pickActionLabel}
                      />
                    ))}
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

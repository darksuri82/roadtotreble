import { Check, Sparkles, UserCheck } from 'lucide-react';
import {
  getStaffCoachById,
  STAFF_COACH_CATEGORY_LABELS,
} from '../../engine/staffCoachEngine';
import { TACTICS } from '../../engine/tacticEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { StaffCoachId } from '../../types/game';
import type { TacticId } from '../../types/league';
import { InfoHelpButton } from './InfoHelpButton';
import { PixelManagerAvatar } from './PixelManagerAvatar';

interface StaffCoachHireModalProps {
  offeredCoachIds: StaffCoachId[];
  activeTactic: TacticId;
  onHire: (coachId: StaffCoachId) => void;
  onSkip: () => void;
}

const CATEGORY_BADGE_CLASS = {
  tactic: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
  line: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  system: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
} as const;

export function StaffCoachHireModal({
  offeredCoachIds,
  activeTactic,
  onHire,
  onSkip,
}: StaffCoachHireModalProps) {
  useBodyScrollLock(true);

  const coaches = offeredCoachIds
    .map((id) => getStaffCoachById(id))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div className="modal-backdrop fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4">
      <div className="modal-panel flex w-full max-w-3xl max-h-[90dvh] flex-col rounded-2xl border border-white/15 bg-[#0d131c] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#111822] px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/12 text-emerald-300">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="rounded border border-emerald-500/30 bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                  후반기 수석 코치 선임
                </span>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  2차 이적시장 특별 합류
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white mt-0.5 truncate">
                후반기를 함께할 수석 코치 1명을 선택하세요
              </h2>
            </div>
          </div>
          <InfoHelpButton
            title="수석 코치 영입 규칙"
            align="right"
            guideTab="transfer"
            items={[
              '2차 이적시장(시즌 중반)에 전술 특화 / 라인 강화 / 시스템 유틸 3개 분야에서 각 1명씩 총 3명이 추천됩니다.',
              'FFP 1·2단계 제재 여부와 무관하게 수석 코치 1명은 정상 선임할 수 있습니다.',
              '선임한 코치의 버프는 시즌 종료 및 UCL 토너먼트까지 계속 유지됩니다.',
            ]}
          />
        </div>

        {/* Body (Single Scroll Container) */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3.5 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-3.5 pb-1">
            {coaches.map((coach) => {
              const isTacticMatched =
                coach.category === 'tactic' &&
                coach.tacticId === activeTactic;
              const linkedTacticName = coach.tacticId
                ? TACTICS[coach.tacticId]?.name
                : null;

              return (
                <div
                  key={coach.id}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 bg-[#111822]/90 transition ${
                    isTacticMatched
                      ? 'border-sky-400/50 shadow-[0_0_20px_-8px_rgba(56,189,248,0.45)]'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    {/* Category & Match pill */}
                    <div className="flex items-center justify-between gap-1.5 mb-2.5 sm:mb-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                          CATEGORY_BADGE_CLASS[coach.category]
                        }`}
                      >
                        {STAFF_COACH_CATEGORY_LABELS[coach.category]}
                      </span>
                      {isTacticMatched && (
                        <span className="inline-flex items-center gap-0.5 rounded-md border border-sky-400/35 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-200 whitespace-nowrap">
                          <Sparkles className="w-2.5 h-2.5" />
                          현재 전술 일치
                        </span>
                      )}
                    </div>

                    {/* Portrait + Name */}
                    <div className="flex items-center gap-3 mb-2.5 sm:mb-3">
                      <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#090d13] overflow-hidden">
                        <PixelManagerAvatar
                          avatar={coach.avatar}
                          clubPrimaryColor={coach.clubPrimaryColor}
                          clubSecondaryColor={coach.clubSecondaryColor}
                          size={44}
                          pose="default"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-white leading-tight break-keep">
                          {coach.name}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-400 mt-0.5 break-keep">
                          {coach.roleTitle}
                        </div>
                        {linkedTacticName && (
                          <div className="text-[10px] font-bold text-sky-300/90 mt-1 whitespace-nowrap">
                            대상 전술: {linkedTacticName}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Effect Highlight */}
                    <div className="rounded-lg border border-white/10 bg-[#0b1018] px-2.5 py-2 mb-2.5">
                      <div className="text-xs font-extrabold text-emerald-300 break-keep">
                        {coach.shortBadge}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1 break-keep">
                        {coach.effectSummary}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onHire(coach.id)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 active:scale-[0.99] transition whitespace-nowrap cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    수석 코치 영입
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-[#0b1018] px-4 py-3 sm:px-5">
          <span className="text-[11px] text-slate-400 break-keep">
            현재 기본 전술:{' '}
            <strong className="text-slate-200">
              {TACTICS[activeTactic]?.name ?? activeTactic}
            </strong>
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-slate-200 transition whitespace-nowrap cursor-pointer"
          >
            이번 시즌 건너뛰기
          </button>
        </div>
      </div>
    </div>
  );
}

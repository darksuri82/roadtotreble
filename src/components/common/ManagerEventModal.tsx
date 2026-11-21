import { CheckCircle2, Flame, Megaphone, Mic, Sparkles, User, Users, Zap } from 'lucide-react';
import type {
  ActiveManagerEvent,
  ManagerEventResolution,
} from '../../types/condition';
import { CountryFlagSvg } from './CountryFlagSvg';
import { PixelStatusIcon } from './PixelStatusIcon';

interface ManagerEventModalProps {
  activeEvent: ActiveManagerEvent | null;
  lastResolution: ManagerEventResolution | null;
  onSelectChoice: (choiceId: string) => void;
  onDismissResolution: () => void;
}

export function ManagerEventModal({
  activeEvent,
  lastResolution,
  onSelectChoice,
  onDismissResolution,
}: ManagerEventModalProps) {
  if (!activeEvent && !lastResolution) return null;

  // Phase 2: Resolution Report Modal
  if (!activeEvent && lastResolution) {
    const isPress = lastResolution.category === 'press_conference';
    return (
      <div className="fixed inset-0 z-[71] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-500/40 bg-[#0e1520] shadow-2xl">
          <div
            className={`flex items-center gap-2.5 border-b px-5 py-4 ${
              isPress
                ? 'border-sky-500/30 bg-gradient-to-r from-sky-950/60 via-[#121a28] to-[#0e1520]'
                : 'border-emerald-500/30 bg-gradient-to-r from-emerald-950/60 via-[#121a28] to-[#0e1520]'
            }`}
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-400">
                {isPress ? '기자회견 결과 리포트' : '라커룸 연설 결과 리포트'}
              </div>
              <h3 className="truncate text-base font-extrabold text-white">
                {lastResolution.eventTitle}
              </h3>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Chosen Quote */}
            <div className="rounded-xl border border-slate-800 bg-[#090e16] p-3.5 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                  선택: {lastResolution.chosenLabel}
                </span>
                {lastResolution.wasRisky && (
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-extrabold ${
                      lastResolution.riskSucceeded
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                    }`}
                  >
                    {lastResolution.riskSucceeded ? '⚡ 도박 대성공!' : '❄️ 역효과 발생'}
                  </span>
                )}
              </div>
              <p className="text-xs italic text-slate-300 leading-relaxed">
                {lastResolution.chosenQuote}
              </p>
            </div>

            {/* Reaction Commentary */}
            <div className="rounded-xl border border-slate-700/70 bg-[#121b29] px-4 py-3 text-sm font-medium text-slate-100 leading-relaxed">
              {lastResolution.reactionText}
            </div>

            {/* Intuitive Morale Outcome Chips */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400">사기 변화 내역</div>
              <div className="flex flex-wrap gap-2">
                {lastResolution.outcomes.map((o, idx) => {
                  const positive = o.delta > 0;
                  return (
                    <div
                      key={`${o.label}-${idx}`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-extrabold ${
                        positive
                          ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                          : 'border-sky-400/45 bg-sky-500/15 text-sky-200'
                      }`}
                    >
                      <PixelStatusIcon
                        variant={positive ? 'morale_high' : 'morale_low'}
                        size={14}
                      />
                      <span>{o.label}</span>
                      <span className={positive ? 'text-emerald-300' : 'text-rose-300'}>
                        사기 {o.delta > 0 ? `+${o.delta}` : o.delta}
                      </span>
                      <span className="text-[10px] font-semibold opacity-85">
                        ({o.note})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-800 bg-[#0b1018] px-5 py-3.5">
            <button
              type="button"
              onClick={onDismissResolution}
              className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              확인하고 계속하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeEvent) return null;

  // Phase 1: Interactive Prompt & 3 Choices
  const isPress = activeEvent.category === 'press_conference';
  return (
    <div className="fixed inset-0 z-[71] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0e1520] shadow-2xl">
        {/* Header */}
        <div
          className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${
            isPress
              ? 'border-sky-500/30 bg-gradient-to-r from-sky-950/65 via-[#131c2c] to-[#0e1520]'
              : 'border-amber-500/30 bg-gradient-to-r from-amber-950/55 via-[#161b26] to-[#0e1520]'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                isPress
                  ? 'border-sky-400/40 bg-sky-500/15 text-sky-300'
                  : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
              }`}
            >
              {isPress ? (
                <Mic className="h-5 w-5" />
              ) : (
                <Megaphone className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-extrabold ${
                    isPress
                      ? 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
                      : 'bg-amber-500/20 text-amber-200 border border-amber-400/35'
                  }`}
                >
                  {activeEvent.contextBadge}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {activeEvent.speakerLabel}
                </span>
              </div>
              <h3 className="mt-1 text-base sm:text-lg font-extrabold text-white">
                {activeEvent.title}
              </h3>
            </div>
          </div>

          {/* Target Indicator Pill */}
          <div className="shrink-0">
            {activeEvent.targetScope === 'player' && activeEvent.targetPlayerName ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-950/50 px-2.5 py-1 text-xs font-bold text-emerald-200">
                <CountryFlagSvg
                  code={activeEvent.targetPlayerNationalityCode}
                  nationality={activeEvent.targetPlayerNationality}
                  size="sm"
                />
                <User className="h-3 w-3 text-emerald-400" />
                <span>{activeEvent.targetPlayerName}</span>
              </div>
            ) : activeEvent.targetScope === 'position_group' ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-200">
                <Users className="h-3.5 w-3.5 text-amber-300" />
                <span>
                  {activeEvent.positionGroup === 'FW'
                    ? '공격진'
                    : activeEvent.positionGroup === 'MF'
                      ? '미드필더진'
                      : '수비진·GK'}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-950/40 px-2.5 py-1 text-xs font-bold text-sky-200">
                <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                <span>팀 전체</span>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
          {/* Prompt Box */}
          <div className="rounded-xl border border-slate-800 bg-[#090e16] p-4 text-sm text-slate-100 leading-relaxed">
            {activeEvent.prompt}
          </div>

          {/* 3 Choices */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-bold text-slate-400">
              감독님의 답변을 선택하세요
            </div>
            {activeEvent.choices.map((choice, idx) => {
              const isRisky = Boolean(choice.riskLabel);
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => onSelectChoice(choice.id)}
                  className={`group w-full rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                    isRisky
                      ? 'border-amber-500/35 bg-[#121620] hover:border-amber-400/75 hover:bg-amber-950/25'
                      : 'border-slate-800 bg-[#101722] hover:border-emerald-400/65 hover:bg-emerald-950/20'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-black text-slate-200 group-hover:bg-emerald-500 group-hover:text-slate-950">
                        {idx + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-white">
                        {choice.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-slate-800/90 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                        {choice.toneTag}
                      </span>
                      {choice.riskLabel && (
                        <span className="inline-flex items-center gap-0.5 rounded border border-amber-400/45 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-200">
                          <Zap className="h-2.5 w-2.5" />
                          {choice.riskLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 group-hover:text-slate-100 leading-relaxed pl-7">
                    {choice.quote}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
            <Flame className="h-3.5 w-3.5 text-amber-400/70" />
            <span>
              선택에 따라 대상 선수·포지션 라인·팀 전체의 사기(Morale)가 즉시 변동되어 경기 실효 OVR에 반영됩니다.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

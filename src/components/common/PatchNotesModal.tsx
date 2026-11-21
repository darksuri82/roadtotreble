import { ScrollText, Sparkles, X } from 'lucide-react';
import { CURRENT_APP_VERSION, PATCH_NOTES } from '../../data/patchNotes';
import type { PatchNoteEntry } from '../../data/patchNotes';

interface PatchNotesModalProps {
  onClose: () => void;
}

function getTagStyle(tag: PatchNoteEntry['tag']): string {
  switch (tag) {
    case 'LATEST':
      return 'bg-emerald-500 text-slate-950';
    case 'MAJOR':
      return 'bg-amber-400 text-slate-950';
    case 'BALANCE':
      return 'bg-sky-400 text-slate-950';
    case 'FEATURE':
    default:
      return 'bg-slate-700 text-slate-200';
  }
}

export function PatchNotesModal({ onClose }: PatchNotesModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-5 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-700/80 bg-[#0f1621] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0a0f17] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300">
              <ScrollText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  PITCH MANAGER 패치노트
                </h2>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-300">
                  {CURRENT_APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                v1.0 출시부터 Phase 2 완성 및 최신 UI 개편까지의 전체 업데이트 기록
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
            aria-label="패치노트 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Timeline Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {PATCH_NOTES.map((entry, idx) => {
            const isLatest = idx === 0;
            return (
              <article
                key={entry.version}
                className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
                  isLatest
                    ? 'border-emerald-500/45 bg-gradient-to-br from-emerald-950/25 via-[#111822] to-[#0b1018]'
                    : 'border-slate-800 bg-[#111822]/90'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-black text-white">
                      {entry.version}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-black tracking-wide ${getTagStyle(entry.tag)}`}
                    >
                      {entry.tag}
                    </span>
                    <span className="text-sm font-extrabold text-emerald-300">
                      {entry.codename}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    {entry.date}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-300">
                  {entry.summary}
                </p>

                <div className="space-y-2.5 pt-1">
                  {entry.sections.map((sec) => (
                    <div
                      key={sec.category}
                      className="rounded-xl border border-slate-800/80 bg-[#0b1018] p-3 space-y-1.5"
                    >
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-amber-300">
                        <Sparkles className="h-3 w-3" />
                        {sec.category}
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300 leading-relaxed list-disc pl-4">
                        {sec.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

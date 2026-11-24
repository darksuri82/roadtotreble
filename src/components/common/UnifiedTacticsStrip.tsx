import { BookOpen, HelpCircle, X } from 'lucide-react';
import { useState } from 'react';
import type {
  TacticalZoneId,
  UnifiedTacticalMatchup,
} from '../../engine/unifiedTacticsEngine';
import { openSystemGuide } from '../guide/guideNavigation';

interface UnifiedTacticsStripProps {
  matchup: UnifiedTacticalMatchup;
  isHalftime?: boolean;
}

const ZONE_ROLE_DESC: Record<TacticalZoneId, string> = {
  midfield: '점유율·중앙 전개',
  flanks: '크로스·측면 침투',
  transition: '역습 vs 뒷공간',
  box: '박스 화력·공중볼',
  pressing: '전방 압박·탈압박',
};

export function UnifiedTacticsStrip({
  matchup,
  isHalftime = false,
}: UnifiedTacticsStripProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const p = matchup.myProfile;

  const fitBadgeCls =
    p.tacticalFit >= 84
      ? 'bg-emerald-500/20 text-emerald-300'
      : p.tacticalFit >= 72
        ? 'bg-sky-500/15 text-sky-300'
        : 'bg-rose-500/20 text-rose-300';

  return (
    <div className="space-y-1.5">
      {/* Minimal 1-Line Unified Tactical Zone Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#090e15] px-2.5 py-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-black tabular-nums ${fitBadgeCls}`}
            title={`전술 완성도 ${p.tacticalFit}% (구조 ${p.structureFit} · 선수 ${p.personnelFit} · 감독 ${p.managerFit})`}
          >
            완성도 {p.tacticalFit}%
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {matchup.zones.map((z) => {
            const cls =
              z.status === 'up'
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                : z.status === 'down'
                  ? 'border-rose-500/35 bg-rose-500/10 text-rose-300'
                  : 'border-slate-700/80 bg-slate-800/50 text-slate-400';
            const arrow = z.status === 'up' ? '▲' : z.status === 'down' ? '▼' : '▬';
            return (
              <span
                key={z.id}
                title={`${z.label} (${ZONE_ROLE_DESC[z.id]}): ${z.detail}`}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${cls}`}
              >
                <span>{z.shortLabel}</span>
                <span className="text-[9px]">{arrow}</span>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => setHelpOpen((prev) => !prev)}
            aria-label="전술 지표 안내 열기"
            aria-expanded={helpOpen}
            title="완성도 · 5대 구역 지표 안내"
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors cursor-pointer ${
              helpOpen
                ? 'border-sky-400/60 bg-sky-500/20 text-sky-200'
                : 'border-slate-700/80 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Compact On-Demand ? Explanation Panel (Zero clutter when closed) */}
      {helpOpen && (
        <div className="rounded-lg border border-slate-700/80 bg-[#0d1420] px-3 py-2.5 text-[11px] text-slate-300 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-slate-100 text-[11px]">
              통합 전술 지표 안내
            </span>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              aria-label="안내 닫기"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 text-[10px] leading-relaxed text-slate-400">
            <div>
              <span className="font-bold text-emerald-300">
                완성도 {p.tacticalFit}%
              </span>{' '}
              <span className="text-slate-500 tabular-nums">
                (구조 {p.structureFit} · 선수 {p.personnelFit} · 감독 {p.managerFit})
              </span>{' '}
              — 포메이션×전술(35%) · 선발 능력치/스타일(45%) · 감독 궁합(20%) 합산.
              전술 버튼 아래 <span className="text-slate-200 font-bold">%</span>는
              현재 포메이션·선발 기준 각 전술의 완성도입니다.
            </div>
            <div className="pt-1 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
              {matchup.zones.map((z) => {
                const arrow =
                  z.status === 'up' ? '▲' : z.status === 'down' ? '▼' : '▬';
                const statusColor =
                  z.status === 'up'
                    ? 'text-emerald-300'
                    : z.status === 'down'
                      ? 'text-rose-300'
                      : 'text-slate-400';
                return (
                  <div
                    key={`help-${z.id}`}
                    className="flex items-center justify-between gap-1.5 text-[10px]"
                  >
                    <span className="truncate">
                      <span className={`font-extrabold ${statusColor}`}>
                        {z.shortLabel} {arrow}
                      </span>{' '}
                      <span className="text-slate-400">
                        {ZONE_ROLE_DESC[z.id]}
                      </span>
                    </span>
                    <span className="shrink-0 text-[9px] text-slate-500 tabular-nums">
                      {z.detail}
                    </span>
                  </div>
                );
              })}
            </div>
            {isHalftime && (
              <div className="pt-1 border-t border-slate-800/90 text-[10px] text-amber-300/90">
                ※ 전반 상대 전술 기준 예상이며, 후반 시작 시 상대 감독도 전술·포메이션을
                변경할 수 있습니다.
              </div>
            )}
            <div className="pt-1.5 border-t border-slate-800/90 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setHelpOpen(false);
                  openSystemGuide('tactics');
                }}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="h-3 w-3 shrink-0" />
                가이드북 · 통합 전술·포메이션 →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

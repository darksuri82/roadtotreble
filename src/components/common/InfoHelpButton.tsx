import { BookOpen, HelpCircle, X } from 'lucide-react';
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  GUIDE_TAB_LABELS,
  type GuideTabId,
  openSystemGuide,
} from '../guide/guideNavigation';

interface InfoHelpButtonProps {
  title: string;
  items?: string[];
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  label?: string;
  size?: 'xs' | 'sm';
  className?: string;
  /** Optional deep-link tab in SystemGuideModal */
  guideTab?: GuideTabId;
  guideLinkLabel?: string;
  /** Optional custom width class (defaults to w-[min(21rem,calc(100vw-1.5rem))]) */
  popoverWidthClass?: string;
}

/**
 * Compact clickable `?` popover button for tucking rule explanations,
 * formulas, and tips neatly out of gameplay screens on both PC and mobile.
 * Automatically clamps horizontal position within the viewport so mobile
 * popovers never clip off-screen.
 */
export function InfoHelpButton({
  title,
  items,
  children,
  align = 'right',
  label,
  size = 'xs',
  className = '',
  guideTab,
  guideLinkLabel,
  popoverWidthClass = 'w-[min(21rem,calc(100vw-1.5rem))]',
}: InfoHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const clampToViewport = () => {
      const el = popoverRef.current;
      if (!el) return;
      const prevTransform = el.style.transform;
      el.style.transform = '';
      const rect = el.getBoundingClientRect();
      el.style.transform = prevTransform;

      const margin = 12;
      let delta = 0;
      if (rect.left < margin) {
        delta = margin - rect.left;
      } else if (rect.right > window.innerWidth - margin) {
        delta = window.innerWidth - margin - rect.right;
      }
      setShiftX(Math.round(delta));
    };

    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [open, align]);

  const alignClass =
    align === 'left'
      ? 'left-0'
      : align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'right-0';

  const btnClass =
    size === 'sm'
      ? 'h-6 px-1.5 text-[11px] gap-1'
      : 'h-5 px-1 text-[10px] gap-0.5';

  return (
    <div ref={rootRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShiftX(0);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={`${title} 도움말`}
        title={title}
        className={`inline-flex items-center justify-center rounded-md border transition-colors cursor-pointer touch-manipulation ${btnClass} ${
          open
            ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
            : 'border-slate-700/80 bg-[#0d141e] text-slate-400 hover:border-slate-500 hover:text-slate-200'
        }`}
      >
        <HelpCircle
          className={
            size === 'sm' ? 'h-3.5 w-3.5 shrink-0' : 'h-3 w-3 shrink-0'
          }
        />
        {label && (
          <span className="font-semibold whitespace-nowrap">{label}</span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          style={
            shiftX !== 0
              ? {
                  transform:
                    align === 'center'
                      ? `translateX(calc(-50% + ${shiftX}px))`
                      : `translateX(${shiftX}px)`,
                }
              : undefined
          }
          className={`absolute top-full z-[65] mt-1.5 rounded-xl border border-slate-700/90 bg-[#0b111b] p-3 text-left shadow-2xl break-keep ${popoverWidthClass} ${alignClass}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 pb-1.5 mb-2">
            <span className="text-[11px] font-bold text-slate-100">
              {title}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 cursor-pointer shrink-0"
              aria-label="닫기"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {items && items.length > 0 && (
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-300">
              {items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400/80" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
          {children}
          {guideTab && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/90 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openSystemGuide(guideTab);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="h-3 w-3 shrink-0" />
                {guideLinkLabel ?? `가이드북 · ${GUIDE_TAB_LABELS[guideTab]} →`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { HelpCircle, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

interface InfoHelpButtonProps {
  title: string;
  items?: string[];
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  label?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

/**
 * Compact clickable `?` popover button for tucking rule explanations,
 * formulas, and tips neatly out of gameplay screens on both PC and mobile.
 */
export function InfoHelpButton({
  title,
  items,
  children,
  align = 'right',
  label,
  size = 'xs',
  className = '',
}: InfoHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

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
        <HelpCircle className={size === 'sm' ? 'h-3.5 w-3.5 shrink-0' : 'h-3 w-3 shrink-0'} />
        {label && <span className="font-semibold whitespace-nowrap">{label}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full z-50 mt-1.5 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-700/90 bg-[#0b111b] p-3 text-left shadow-2xl ${alignClass}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 pb-1.5 mb-2">
            <span className="text-[11px] font-bold text-slate-100">{title}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
              aria-label="닫기"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {items && items.length > 0 && (
            <ul className="space-y-1 text-[11px] leading-relaxed text-slate-300">
              {items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400/80" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

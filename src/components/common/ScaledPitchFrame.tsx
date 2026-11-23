import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface ScaledPitchFrameProps {
  /** Natural pixel width at which the child PitchBoard renders without overlap */
  baseWidth?: number;
  children: ReactNode;
}

/**
 * Proportionally scales the original PitchBoard down when placed inside narrow
 * grid cells (2/3/4-player draft grid on mobile or desktop) without distorting
 * its aspect ratio and without using CSS `zoom`.
 * When the available cell width is >= baseWidth, renders natively at scale 1.
 */
export function ScaledPitchFrame({
  baseWidth = 376,
  children,
}: ScaledPitchFrameProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [outerWidth, setOuterWidth] = useState<number>(baseWidth);
  const [innerHeight, setInnerHeight] = useState<number>(0);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    const updateOuter = () => {
      const w = outer.clientWidth;
      if (w > 0) setOuterWidth(w);
    };
    updateOuter();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateOuter);
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  const scale = outerWidth > 0 && outerWidth < baseWidth ? outerWidth / baseWidth : 1;

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const updateInner = () => {
      const h = inner.offsetHeight;
      if (h > 0) setInnerHeight(h);
    };
    updateInner();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateInner);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [scale]);

  if (scale >= 0.995) {
    return (
      <div ref={outerRef} className="w-full">
        <div ref={innerRef} className="w-full">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      className="relative w-full overflow-hidden"
      style={{
        height: innerHeight > 0 ? Math.ceil(innerHeight * scale) : undefined,
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: baseWidth,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

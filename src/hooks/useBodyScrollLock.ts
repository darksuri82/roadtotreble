import { useEffect } from 'react';

let activeLockCount = 0;
let savedScrollY = 0;
let prevStyles: {
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverflow: string;
  bodyPaddingRight: string;
  bodyOverscroll: string;
  htmlOverscroll: string;
} | null = null;

function acquireBodyScrollLock(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  activeLockCount += 1;
  if (activeLockCount > 1) return;

  const { body, documentElement } = document;
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  const scrollbarWidth = Math.max(0, window.innerWidth - documentElement.clientWidth);

  prevStyles = {
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    bodyOverscroll: body.style.overscrollBehavior,
    htmlOverscroll: documentElement.style.overscrollBehavior,
  };

  documentElement.style.overscrollBehavior = 'none';
  body.style.position = 'fixed';
  body.style.top = `-${savedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

function releaseBodyScrollLock(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (activeLockCount <= 0) return;
  activeLockCount -= 1;
  if (activeLockCount > 0) return;

  const { body, documentElement } = document;
  if (prevStyles) {
    documentElement.style.overscrollBehavior = prevStyles.htmlOverscroll;
    body.style.position = prevStyles.bodyPosition;
    body.style.top = prevStyles.bodyTop;
    body.style.left = prevStyles.bodyLeft;
    body.style.right = prevStyles.bodyRight;
    body.style.width = prevStyles.bodyWidth;
    body.style.overflow = prevStyles.bodyOverflow;
    body.style.paddingRight = prevStyles.bodyPaddingRight;
    body.style.overscrollBehavior = prevStyles.bodyOverscroll;
    prevStyles = null;
  }
  window.scrollTo(0, savedScrollY);
}

/**
 * Ref-counted mobile-safe body scroll lock for modals and popups.
 * Prevents iOS Safari / Android Chrome background scroll chaining and bottom jitter.
 */
export function useBodyScrollLock(locked = true): void {
  useEffect(() => {
    if (!locked) return;
    acquireBodyScrollLock();
    return () => {
      releaseBodyScrollLock();
    };
  }, [locked]);
}

/** Declarative scroll lock helper for inline conditional modals. */
export function ModalBodyLock({ active = true }: { active?: boolean }) {
  useBodyScrollLock(active);
  return null;
}

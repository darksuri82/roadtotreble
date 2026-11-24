import { useCallback, useEffect, useRef, useState } from 'react';

export const TACTIC_EDIT_PAUSE_MS = 3000;
export const TACTIC_NEXT_MATCH_NOTICE =
  '전술 수정됨 · 변경된 전술은 다음 경기부터 적용됩니다';

export interface SoloTacticEditPauseOptions {
  /** Stable string signature of formation + tactics + starter/bench lineup */
  tacticSignature: string;
  /** Whether solo live auto-advance is currently running */
  liveAutoActive: boolean;
  /** Suppress detection during transfer market, injury swaps, or active 2D broadcast */
  suppressChanges: boolean;
  /** Scope key for the current match/gap; notice clears automatically once the next match starts */
  matchScopeKey: string;
}

export interface SoloTacticEditPauseState {
  /** True during the brief post-edit pause (auto-resumes after 3s or immediately via clearTacticPause) */
  tacticPauseActive: boolean;
  /** Non-null notice text while the modified tactics are queued for the next match */
  tacticNoticeLabel: string | null;
  /** Immediately cancel the brief pause (e.g. user clicked [재개]) */
  clearTacticPause: () => void;
  /** Reset both pause & notice (e.g. user stopped live auto-advance) */
  resetTacticNotice: () => void;
}

/**
 * Briefly pauses solo live auto-advance whenever the manager edits tactics/formation/lineup
 * and displays a clear notice that the change takes effect from the next match.
 */
export function useSoloTacticEditPause(
  options: SoloTacticEditPauseOptions,
): SoloTacticEditPauseState {
  const { tacticSignature, liveAutoActive, suppressChanges, matchScopeKey } =
    options;

  const [tacticPauseActive, setTacticPauseActive] = useState(false);
  const [noticeScopeKey, setNoticeScopeKey] = useState<string | null>(null);
  const prevSigRef = useRef<string>(tacticSignature);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearTacticPause = useCallback(() => {
    clearTimer();
    setTacticPauseActive(false);
  }, [clearTimer]);

  const resetTacticNotice = useCallback(() => {
    clearTimer();
    setTacticPauseActive(false);
    setNoticeScopeKey(null);
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  useEffect(() => {
    if (prevSigRef.current === tacticSignature) return;
    prevSigRef.current = tacticSignature;

    if (!liveAutoActive || suppressChanges) return;

    clearTimer();
    const startT = window.setTimeout(() => {
      setTacticPauseActive(true);
      setNoticeScopeKey(matchScopeKey);
    }, 0);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setTacticPauseActive(false);
    }, TACTIC_EDIT_PAUSE_MS);

    return () => {
      window.clearTimeout(startT);
    };
  }, [tacticSignature, liveAutoActive, suppressChanges, matchScopeKey, clearTimer]);

  const tacticNoticeLabel =
    liveAutoActive && noticeScopeKey !== null && noticeScopeKey === matchScopeKey
      ? TACTIC_NEXT_MATCH_NOTICE
      : null;

  return {
    tacticPauseActive: liveAutoActive && tacticPauseActive,
    tacticNoticeLabel,
    clearTacticPause,
    resetTacticNotice,
  };
}

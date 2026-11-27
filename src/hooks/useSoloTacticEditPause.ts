import { useCallback, useRef, useState } from 'react';

export const TACTIC_NEXT_MATCH_NOTICE =
  '전술 수정 완료 · 변경된 전술은 다음 경기부터 적용됩니다';

export interface SoloTacticEditSessionOptions {
  /** Stable string signature of formation + tactics + starter/bench lineup */
  tacticSignature: string;
  /** Whether solo live auto-advance is currently active */
  liveAutoActive: boolean;
  /** Scope key for the current match/gap; notice clears automatically once the next match starts */
  matchScopeKey: string;
}

export interface SoloTacticEditSessionState {
  /** True while the user explicitly entered [전술 수정] mode (pauses live auto-advance until [수정 확정]) */
  tacticEditMode: boolean;
  /** Non-null notice text shown until the next match begins */
  tacticNoticeLabel: string | null;
  /** Enters [전술 수정] mode, pausing auto-advance and snapshotting current tactics */
  startTacticEdit: () => void;
  /** Confirms [수정 확정], resumes auto-advance, and shows next-match notice if tactics changed */
  confirmTacticEdit: () => void;
  /** Marks tactics as directly modified (e.g. during between-match intermission) to show the next-match notice */
  markTacticModified: () => void;
  /** Resets edit mode & notice (e.g. when live auto-advance stops) */
  resetTacticEdit: () => void;
}

/**
 * Explicit [전술 수정] → pause → [수정 확정] → resume session for solo live auto-advance.
 * Auto-advance stays paused for as long as the user is editing tactics, resumes immediately
 * on confirmation, and displays a next-match notice if anything changed.
 */
export function useSoloTacticEditSession(
  options: SoloTacticEditSessionOptions,
): SoloTacticEditSessionState {
  const { tacticSignature, liveAutoActive, matchScopeKey } = options;

  const [tacticEditMode, setTacticEditMode] = useState(false);
  const [noticeScopeKey, setNoticeScopeKey] = useState<string | null>(null);
  const startSigRef = useRef<string>(tacticSignature);

  const startTacticEdit = useCallback(() => {
    startSigRef.current = tacticSignature;
    setTacticEditMode(true);
  }, [tacticSignature]);

  const confirmTacticEdit = useCallback(() => {
    setTacticEditMode(false);
    if (tacticSignature !== startSigRef.current) {
      setNoticeScopeKey(matchScopeKey);
    }
  }, [tacticSignature, matchScopeKey]);

  const markTacticModified = useCallback(() => {
    setNoticeScopeKey(matchScopeKey);
  }, [matchScopeKey]);

  const resetTacticEdit = useCallback(() => {
    setTacticEditMode(false);
    setNoticeScopeKey(null);
  }, []);

  const tacticNoticeLabel =
    liveAutoActive && noticeScopeKey !== null && noticeScopeKey === matchScopeKey
      ? TACTIC_NEXT_MATCH_NOTICE
      : null;

  return {
    tacticEditMode: liveAutoActive && tacticEditMode,
    tacticNoticeLabel,
    startTacticEdit,
    confirmTacticEdit,
    markTacticModified,
    resetTacticEdit,
  };
}

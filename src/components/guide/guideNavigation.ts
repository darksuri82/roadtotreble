export type GuideTabId =
  | 'budget'
  | 'tactics'
  | 'squad'
  | 'transfer'
  | 'match'
  | 'legacy';

export const OPEN_SYSTEM_GUIDE_EVENT = 'rtt:open-system-guide';
export const OPEN_SOLO_TUTORIAL_EVENT = 'rtt:open-solo-tutorial';

export const GUIDE_TAB_LABELS: Record<GuideTabId, string> = {
  budget: '예산·FFP',
  tactics: '전술·파훼',
  squad: '스쿼드·각성',
  transfer: '이적·코치',
  match: '경기·컨디션',
  legacy: '명전·멀티',
};

export function openSystemGuide(tab: GuideTabId = 'budget'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{ tab: GuideTabId }>(OPEN_SYSTEM_GUIDE_EVENT, {
      detail: { tab },
    }),
  );
}

export function openSoloTutorial(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_SOLO_TUTORIAL_EVENT));
}

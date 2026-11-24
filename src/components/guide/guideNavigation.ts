export type GuideTabId =
  | 'basics'
  | 'chemistry'
  | 'tactics'
  | 'season'
  | 'condition'
  | 'attributes';

export const OPEN_SYSTEM_GUIDE_EVENT = 'rtt:open-system-guide';
export const OPEN_SOLO_TUTORIAL_EVENT = 'rtt:open-solo-tutorial';

export const GUIDE_TAB_LABELS: Record<GuideTabId, string> = {
  basics: '포지션·드래프트·이적',
  chemistry: '케미·시너지·감독',
  tactics: '통합 전술·포메이션',
  season: '시즌·UCL·명전·멀티',
  condition: '부상·체력·사기',
  attributes: '세부 능력치·루트',
};

export function openSystemGuide(tab: GuideTabId = 'basics'): void {
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

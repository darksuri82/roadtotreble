import type { ReactNode } from 'react';

interface PlayerNameButtonProps {
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}

/**
 * Strictly clickable player-name trigger used across stats tables, leaderboards,
 * match reports, club squads, and award lists so clicking anywhere else on a row
 * never accidentally opens PlayerDetailModal.
 */
export function PlayerNameButton({
  onClick,
  children,
  className = '',
  title = '선수 세부 스탯 보기',
}: PlayerNameButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-block max-w-full truncate text-left cursor-pointer hover:text-emerald-300 hover:underline decoration-emerald-400/75 underline-offset-2 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 rounded-sm ${className}`}
    >
      {children}
    </button>
  );
}

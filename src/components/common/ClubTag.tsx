interface ClubTagProps {
  shortName: string;
  primaryColor?: string;
  isUserTeam?: boolean;
  size?: 'xs' | 'sm';
}

/**
 * Compact club disambiguation badge shown beside every player name in leaderboards,
 * Best XI, POTY, match events, and ratings so drafted players are instantly distinguished
 * from AI club players of the same name.
 */
export function ClubTag({
  shortName,
  primaryColor = '#64748b',
  isUserTeam = false,
  size = 'xs',
}: ClubTagProps) {
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[9px]';
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <span
        className={`inline-flex items-center gap-1 rounded font-bold tracking-wide ${pad} ${
          isUserTeam
            ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
            : 'bg-slate-800/90 text-slate-300 border border-slate-700/70'
        }`}
      >
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: primaryColor }}
        />
        {shortName}
      </span>
      {isUserTeam && (
        <span className="rounded bg-emerald-400 px-1 py-0.5 text-[8px] font-black leading-none text-slate-950">
          MY
        </span>
      )}
    </span>
  );
}

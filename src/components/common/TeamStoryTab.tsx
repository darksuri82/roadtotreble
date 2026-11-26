import {
  Award,
  Flame,
  Quote,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import type { TeamSeasonStory, TeamStoryHighlightKind } from '../../types/legacy';

interface TeamIntroBannerProps {
  intro: string;
  compact?: boolean;
  className?: string;
}

/**
 * Compact 1~2 line team identity summary strip used in Season Summary,
 * Hall of Fame detail, and Daily Ranking detail.
 */
export function TeamIntroBanner({
  intro,
  compact = false,
  className = '',
}: TeamIntroBannerProps) {
  if (!intro.trim()) return null;
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-slate-800/90 bg-[#0b111b] ${
        compact ? 'px-3 py-2 text-[11px]' : 'px-3.5 py-2.5 text-xs'
      } text-slate-200 leading-relaxed break-keep ${className}`}
    >
      <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
      <p className="min-w-0 flex-1 line-clamp-2">{intro}</p>
    </div>
  );
}

function getHighlightStyle(kind: TeamStoryHighlightKind): {
  icon: React.ReactNode;
  badgeCls: string;
  dotCls: string;
} {
  switch (kind) {
    case 'ucl_final':
      return {
        icon: <Trophy className="h-3.5 w-3.5 text-sky-300" />,
        badgeCls: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
        dotCls: 'bg-sky-400',
      };
    case 'title_match':
      return {
        icon: <Trophy className="h-3.5 w-3.5 text-amber-300" />,
        badgeCls: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
        dotCls: 'bg-amber-400',
      };
    case 'comeback':
      return {
        icon: <Zap className="h-3.5 w-3.5 text-rose-300" />,
        badgeCls: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
        dotCls: 'bg-rose-400',
      };
    case 'awakening':
      return {
        icon: <Flame className="h-3.5 w-3.5 text-orange-300" />,
        badgeCls: 'border-orange-400/40 bg-orange-500/15 text-orange-200',
        dotCls: 'bg-orange-400',
      };
    case 'overachieve':
    case 'streak':
      return {
        icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />,
        badgeCls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
        dotCls: 'bg-emerald-400',
      };
    case 'best_match':
      return {
        icon: <Sparkles className="h-3.5 w-3.5 text-cyan-300" />,
        badgeCls: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
        dotCls: 'bg-cyan-400',
      };
    case 'cup_final':
    case 'ace':
    default:
      return {
        icon: <Award className="h-3.5 w-3.5 text-violet-300" />,
        badgeCls: 'border-violet-400/40 bg-violet-500/15 text-violet-200',
        dotCls: 'bg-violet-400',
      };
  }
}

interface TeamStoryTabProps {
  story: TeamSeasonStory;
  clubName?: string;
  showIntroBanner?: boolean;
}

/**
 * Clean, lightweight timeline/card view of a club's seasonal story.
 */
export function TeamStoryTab({
  story,
  clubName,
  showIntroBanner = true,
}: TeamStoryTabProps) {
  return (
    <div className="space-y-3 break-keep">
      {showIntroBanner && <TeamIntroBanner intro={story.intro} />}

      {story.highlights.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0d1420] p-5 text-center text-xs text-slate-400">
          {clubName ? `${clubName}의 ` : ''}주요 시즌 기록이 아직 집계되지 않았습니다.
        </div>
      ) : (
        <div className="relative space-y-2.5 pl-4 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-slate-800">
          {story.highlights.map((item, idx) => {
            const st = getHighlightStyle(item.kind);
            return (
              <div
                key={`${item.kind}-${idx}`}
                className="relative rounded-xl border border-slate-800/90 bg-[#0e1522] px-3.5 py-3 transition-colors hover:border-slate-700"
              >
                <span
                  className={`absolute -left-[14.5px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-[#090d13] ${st.dotCls}`}
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${st.badgeCls}`}
                  >
                    {st.icon}
                    {item.tag}
                  </span>
                  {item.metric && (
                    <span className="rounded-md border border-slate-700/80 bg-slate-900/90 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-200 whitespace-nowrap tabular-nums">
                      {item.metric}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-xs sm:text-sm font-extrabold text-white">
                  {item.title}
                </div>
                <p className="mt-0.5 text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                  {item.detail}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

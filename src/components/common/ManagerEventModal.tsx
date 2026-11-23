import {
  Activity,
  Award,
  CheckCircle2,
  Flame,
  Megaphone,
  Mic,
  Zap,
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type {
  ActiveManagerEvent,
  ManagerEventMatchContext,
  ManagerEventResolution,
  ManagerEventSceneId,
} from '../../types/condition';
import type { ManagerAvatarConfig, UserClubProfile } from '../../types/game';
import { PixelEventSceneBanner } from './PixelEventSceneBanner';
import { PixelStatusIcon } from './PixelStatusIcon';

interface ManagerEventModalProps {
  activeEvent: ActiveManagerEvent | null;
  lastResolution: ManagerEventResolution | null;
  managerAvatar?: ManagerAvatarConfig;
  managerName?: string;
  userClub?: UserClubProfile;
  onSelectChoice: (choiceId: string) => void;
  onDismissResolution: () => void;
}

function MatchContextStatCard({
  ctx,
}: {
  ctx: ManagerEventMatchContext;
}) {
  const outcomeLabel =
    ctx.outcome === 'W' ? '승' : ctx.outcome === 'L' ? '패' : '무';
  const outcomeBadgeCls =
    ctx.outcome === 'W'
      ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
      : ctx.outcome === 'L'
        ? 'border-rose-400/45 bg-rose-500/15 text-rose-300'
        : 'border-slate-500/45 bg-slate-700/40 text-slate-200';

  const ps = ctx.playerStats;
  const ratingColor = ps
    ? ps.rating >= 8.5
      ? 'text-amber-300 bg-amber-500/20 border-amber-400/45'
      : ps.rating >= 7.3
        ? 'text-emerald-300 bg-emerald-500/15 border-emerald-400/40'
        : ps.rating <= 6.0
          ? 'text-rose-300 bg-rose-500/15 border-rose-400/45'
          : 'text-slate-200 bg-slate-800 border-slate-700'
    : '';

  return (
    <div className="rounded-xl border border-slate-700/80 bg-gradient-to-r from-[#0b121e] via-[#0e1726] to-[#0b121e] px-3.5 py-2.5 space-y-2">
      {/* Row 1: Last Match Scoreline & Team Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1 rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-300">
            <Activity className="h-3 w-3" />
            {ctx.competitionLabel}
          </span>
          <span className="font-extrabold text-white truncate">
            {ctx.userTeamName}
          </span>
          <span className="font-mono font-black text-amber-300">
            {ctx.userGoals} - {ctx.oppGoals}
          </span>
          <span className="font-bold text-slate-300 truncate">
            {ctx.opponentName}
          </span>
          <span
            className={`rounded border px-1.5 py-0.2 text-[10px] font-black ${outcomeBadgeCls}`}
          >
            {outcomeLabel}
            {ctx.note ? ` (${ctx.note})` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400 shrink-0">
          <span>
            xG <strong className="text-slate-200">{ctx.userXg.toFixed(2)}</strong>-
            {ctx.oppXg.toFixed(2)}
          </span>
          <span>·</span>
          <span>
            점유 <strong className="text-slate-200">{ctx.userPossession}%</strong>
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            슈팅 <strong className="text-slate-200">{ctx.userShots}</strong>({ctx.userShotsOnTarget})
          </span>
        </div>
      </div>

      {/* Row 2: Highlighted Individual Player Match Stat Line (when available) */}
      {ps ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/90 pt-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
              {ps.subPosition}
            </span>
            <span className="font-extrabold text-white">{ps.playerName}</span>
            <span
              className={`rounded border px-1.5 py-0.2 font-mono text-[10px] font-black ${ratingColor}`}
            >
              평점 {ps.rating.toFixed(1)}
            </span>
            <span className="text-slate-300 font-semibold">
              {ps.goals}골 {ps.assists}도움
            </span>
            {ps.xg > 0 && (
              <span className="text-slate-400 font-mono text-[10px]">
                (xG {ps.xg.toFixed(2)})
              </span>
            )}
            {ps.dribbleBeats > 0 && (
              <span className="text-emerald-300 font-semibold text-[10px]">
                · 드리블 돌파 {ps.dribbleBeats}회
              </span>
            )}
            {ps.savesCount > 0 && (
              <span className="text-sky-300 font-semibold text-[10px]">
                · 선방 {ps.savesCount}회
              </span>
            )}
          </div>

          {ps.keyMoments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {ps.keyMoments.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                    tag.includes('부진')
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-400/35'
                      : 'bg-amber-500/15 text-amber-200 border border-amber-400/35'
                  }`}
                >
                  {tag === '경기 MOM' && <Award className="h-2.5 w-2.5" />}
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : ctx.momPlayerName ? (
        <div className="flex items-center gap-1.5 border-t border-slate-800/90 pt-1.5 text-[11px] text-slate-400">
          <Award className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>
            직전 경기 MOM:{' '}
            <strong className="text-amber-200">{ctx.momPlayerName}</strong>
            {typeof ctx.momRating === 'number' && (
              <span className="ml-1 font-mono text-[10px] text-amber-300">
                ({ctx.momRating.toFixed(1)})
              </span>
            )}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function ManagerEventModal({
  activeEvent,
  lastResolution,
  managerAvatar,
  managerName,
  userClub,
  onSelectChoice,
  onDismissResolution,
}: ManagerEventModalProps) {
  useBodyScrollLock(Boolean(activeEvent || lastResolution));
  if (!activeEvent && !lastResolution) return null;

  // Phase 2: Resolution Report Modal
  if (!activeEvent && lastResolution) {
    const isPress = lastResolution.category === 'press_conference';
    const sceneId: ManagerEventSceneId =
      lastResolution.sceneId ?? (isPress ? 'press_official' : 'locker_home');
    return (
      <div className="modal-backdrop fixed inset-0 z-[71] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4">
        <div className="modal-panel flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-emerald-500/40 bg-[#0e1520] shadow-2xl">
          <div className="shrink-0">
            <PixelEventSceneBanner
              sceneId={sceneId}
              managerAvatar={managerAvatar}
              managerName={managerName}
              userClub={userClub}
              compact
            />
          </div>

          <div
            className={`flex shrink-0 items-center gap-2.5 border-b px-5 py-3.5 ${
              isPress
                ? 'border-sky-500/30 bg-gradient-to-r from-sky-950/60 via-[#121a28] to-[#0e1520]'
                : 'border-emerald-500/30 bg-gradient-to-r from-emerald-950/60 via-[#121a28] to-[#0e1520]'
            }`}
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-400">
                {isPress ? '기자회견 결과 리포트' : '라커룸 연설 결과 리포트'}
              </div>
              <h3 className="truncate text-base font-extrabold text-white">
                {lastResolution.eventTitle}
              </h3>
            </div>
          </div>

          <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {/* Chosen Quote */}
            <div className="rounded-xl border border-slate-800 bg-[#090e16] p-3.5 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                  선택: {lastResolution.chosenLabel}
                </span>
                {lastResolution.wasRisky && (
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-extrabold ${
                      lastResolution.riskSucceeded
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                    }`}
                  >
                    {lastResolution.riskSucceeded ? '⚡ 도박 대성공!' : '❄️ 역효과 발생'}
                  </span>
                )}
              </div>
              <p className="text-xs italic text-slate-300 leading-relaxed">
                {lastResolution.chosenQuote}
              </p>
            </div>

            {/* Reaction Commentary */}
            <div className="rounded-xl border border-slate-700/70 bg-[#121b29] px-4 py-3 text-sm font-medium text-slate-100 leading-relaxed">
              {lastResolution.reactionText}
            </div>

            {/* Intuitive Morale Outcome Chips */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400">사기 변화 내역</div>
              <div className="flex flex-wrap gap-2">
                {lastResolution.outcomes.map((o, idx) => {
                  const positive = o.delta > 0;
                  return (
                    <div
                      key={`${o.label}-${idx}`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-extrabold ${
                        positive
                          ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                          : 'border-sky-400/45 bg-sky-500/15 text-sky-200'
                      }`}
                    >
                      <PixelStatusIcon
                        variant={positive ? 'morale_high' : 'morale_low'}
                        size={14}
                      />
                      <span>{o.label}</span>
                      <span className={positive ? 'text-emerald-300' : 'text-rose-300'}>
                        사기 {o.delta > 0 ? `+${o.delta}` : o.delta}
                      </span>
                      <span className="text-[10px] font-semibold opacity-85">
                        ({o.note})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-800 bg-[#0b1018] px-5 py-3.5">
            <button
              type="button"
              onClick={onDismissResolution}
              className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              확인하고 계속하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeEvent) return null;

  // Phase 1: Interactive Prompt & 3 Choices with 8-Scene Pixel Art Backdrop + Custom Manager Avatar
  const isPress = activeEvent.category === 'press_conference';
  const sceneId: ManagerEventSceneId =
    activeEvent.sceneId ?? (isPress ? 'press_official' : 'locker_home');

  return (
    <div className="modal-backdrop fixed inset-0 z-[71] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4">
      <div className="modal-panel flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0e1520] shadow-2xl">
        {/* Situational Pixel-Art Backdrop Scene + Custom Manager Sprite + Target Player Card */}
        <div className="shrink-0">
          <PixelEventSceneBanner
            sceneId={sceneId}
            managerAvatar={managerAvatar}
            managerName={managerName}
            userClub={userClub}
            targetScope={activeEvent.targetScope}
            positionGroup={activeEvent.positionGroup}
            targetPlayer={
              activeEvent.targetScope === 'player' && activeEvent.targetPlayerName
                ? {
                    name: activeEvent.targetPlayerName,
                    nationality: activeEvent.targetPlayerNationality,
                    nationalityCode: activeEvent.targetPlayerNationalityCode,
                    ovr: activeEvent.targetPlayerOvr,
                    position: activeEvent.targetPlayerPosition,
                    mainPosition: activeEvent.targetPlayerMainPosition,
                    morale: activeEvent.targetPlayerMorale,
                    injured: activeEvent.targetPlayerInjured,
                  }
                : null
            }
          />
        </div>

        {/* Compact Title Strip */}
        <div
          className={`flex items-center gap-3 border-b px-5 py-3 shrink-0 ${
            isPress
              ? 'border-sky-500/30 bg-gradient-to-r from-sky-950/55 via-[#131c2c] to-[#0e1520]'
              : 'border-amber-500/30 bg-gradient-to-r from-amber-950/45 via-[#161b26] to-[#0e1520]'
          }`}
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
              isPress
                ? 'border-sky-400/40 bg-sky-500/15 text-sky-300'
                : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
            }`}
          >
            {isPress ? (
              <Mic className="h-4 w-4" />
            ) : (
              <Megaphone className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-extrabold ${
                  isPress
                    ? 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
                    : 'bg-amber-500/20 text-amber-200 border border-amber-400/35'
                }`}
              >
                {activeEvent.contextBadge}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 truncate">
                {activeEvent.speakerLabel}
              </span>
            </div>
            <h3 className="mt-0.5 text-sm sm:text-base font-extrabold text-white truncate">
              {activeEvent.title}
            </h3>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {/* Last Match Score & Individual Player Stat Summary Card */}
          {activeEvent.matchContext && (
            <MatchContextStatCard ctx={activeEvent.matchContext} />
          )}

          {/* Prompt Box */}
          <div className="rounded-xl border border-slate-800 bg-[#090e16] p-3.5 sm:p-4 text-xs sm:text-sm text-slate-100 leading-relaxed">
            {activeEvent.prompt}
          </div>

          {/* 3 Choices */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400">
              {managerName ? `${managerName} 감독님의 답변을 선택하세요` : '감독님의 답변을 선택하세요'}
            </div>
            {activeEvent.choices.map((choice, idx) => {
              const tier =
                choice.riskTier ??
                (typeof choice.successChance === 'number' && choice.failEffect
                  ? choice.successChance <= 0.65 || choice.riskLabel?.includes('하이리스크')
                    ? 'high'
                    : 'medium'
                  : 'safe');
              const isHigh = tier === 'high';
              const isMedium = tier === 'medium';
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => onSelectChoice(choice.id)}
                  className={`group w-full rounded-xl border p-3 sm:p-3.5 text-left transition-colors cursor-pointer ${
                    isHigh
                      ? 'border-rose-500/35 bg-[#121520] hover:border-rose-400/75 hover:bg-rose-950/20'
                      : isMedium
                        ? 'border-amber-500/35 bg-[#121620] hover:border-amber-400/75 hover:bg-amber-950/20'
                        : 'border-slate-800 bg-[#101722] hover:border-emerald-400/65 hover:bg-emerald-950/15'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-black text-slate-200 group-hover:bg-emerald-500 group-hover:text-slate-950">
                        {idx + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-white">
                        {choice.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                        {choice.toneTag}
                      </span>
                      {isHigh ? (
                        <span
                          title="하이리스크 · 하이리턴: 성공 시 사기 대폭 상승(OVR 각성 가능), 실패 시 큰 역풍"
                          className="inline-flex items-center gap-0.5 rounded border border-rose-400/45 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-200"
                        >
                          <Flame className="h-2.5 w-2.5 text-rose-300" />
                          고위험
                        </span>
                      ) : isMedium ? (
                        <span
                          title="승부수: 성공 시 사기 상승(OVR +1 도달 가능), 실패 시 소폭 하락"
                          className="inline-flex items-center gap-0.5 rounded border border-amber-400/45 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-200"
                        >
                          <Zap className="h-2.5 w-2.5 text-amber-300" />
                          승부수
                        </span>
                      ) : (
                        <span
                          title="안정 답변: 역풍 위험 없이 안정적 사기 관리"
                          className="inline-flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-300"
                        >
                          안정
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 group-hover:text-slate-100 leading-relaxed pl-7">
                    {choice.quote}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

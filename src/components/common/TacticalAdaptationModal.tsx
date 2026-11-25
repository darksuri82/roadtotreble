import { AlertTriangle, Eye, SlidersHorizontal, X } from 'lucide-react';
import { useEffect } from 'react';
import { TACTICS } from '../../engine/tacticEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type {
  ManagerAvatarConfig,
  TacticalAdaptationAlert,
  UserClubProfile,
} from '../../types/game';
import { PixelManagerAvatar } from './PixelManagerAvatar';

interface TacticalAdaptationModalProps {
  alert: TacticalAdaptationAlert;
  managerAvatar?: ManagerAvatarConfig;
  managerName?: string;
  userClub?: UserClubProfile;
  onDismiss: () => void;
  onGoToTactics?: () => void;
}

function PixelTacticalScoutBanner({
  isDanger,
  formation,
  managerAvatar,
  managerName,
  userClub,
}: {
  isDanger: boolean;
  formation: string;
  managerAvatar?: ManagerAvatarConfig;
  managerName?: string;
  userClub?: UserClubProfile;
}) {
  const accent = isDanger ? '#f43f5e' : '#f59e0b';
  const primary = userClub?.primaryColor ?? '#10b981';
  const secondary = userClub?.secondaryColor ?? '#f8fafc';

  return (
    <div className="relative h-28 sm:h-32 w-full overflow-hidden border-b border-white/10 bg-[#080d16]">
      {/* Crisp Pixel-Art Video Analysis / Tactical Scouting Room SVG */}
      <svg
        viewBox="0 0 160 64"
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
        className="h-full w-full pixel-crisp"
        aria-hidden="true"
      >
        {/* Room dark wall & floor */}
        <rect x="0" y="0" width="160" height="46" fill="#0d1523" />
        <rect x="0" y="46" width="160" height="18" fill="#090f19" />
        <rect x="0" y="45" width="160" height="1" fill="#1e293b" />

        {/* Ceiling warm/alert lamp */}
        <rect x="70" y="0" width="20" height="3" fill="#1e293b" />
        <rect x="73" y="3" width="14" height="2" fill={accent} opacity="0.85" />
        <polygon points="73,5 87,5 106,46 54,46" fill={accent} opacity="0.08" />

        {/* Left Side: Green Tactical Pitch Chalkboard with X/O & Counter Arrows */}
        <rect x="8" y="8" width="58" height="32" fill="#1e293b" />
        <rect x="10" y="10" width="54" height="28" fill="#11382a" />
        {/* Pitch lines */}
        <rect x="12" y="12" width="50" height="24" fill="none" stroke="#34d399" strokeWidth="0.6" opacity="0.55" />
        <rect x="37" y="12" width="1" height="24" fill="#34d399" opacity="0.45" />
        {/* Our formation dots (emerald) */}
        <rect x="16" y="23" width="2" height="2" fill="#34d399" />
        <rect x="23" y="15" width="2" height="2" fill="#34d399" />
        <rect x="23" y="21" width="2" height="2" fill="#34d399" />
        <rect x="23" y="27" width="2" height="2" fill="#34d399" />
        <rect x="23" y="32" width="2" height="2" fill="#34d399" />
        <rect x="31" y="18" width="2" height="2" fill="#34d399" />
        <rect x="31" y="28" width="2" height="2" fill="#34d399" />
        {/* Enemy counter X marks & dashed warning arrows (rose/amber) */}
        <rect x="44" y="16" width="3" height="3" fill={accent} />
        <rect x="44" y="23" width="3" height="3" fill={accent} />
        <rect x="44" y="30" width="3" height="3" fill={accent} />
        <rect x="35" y="17" width="7" height="1" fill={accent} />
        <rect x="35" y="24" width="7" height="1" fill={accent} />
        <rect x="35" y="31" width="7" height="1" fill={accent} />

        {/* Right Side: Opponent Scout Video Monitor */}
        <rect x="102" y="10" width="48" height="26" fill="#1e293b" />
        <rect x="104" y="12" width="44" height="22" fill="#0b1220" />
        {/* Monitor scan bars & alert graph */}
        <rect x="107" y="15" width="16" height="2" fill={accent} />
        <rect x="107" y="19" width="36" height="1" fill="#334155" />
        <rect x="108" y="28" width="4" height="4" fill="#38bdf8" />
        <rect x="114" y="26" width="4" height="6" fill="#38bdf8" />
        <rect x="120" y="23" width="4" height="9" fill="#f59e0b" />
        <rect x="126" y="20" width="4" height="12" fill={accent} />
        <rect x="132" y="17" width="4" height="15" fill={accent} />
        <rect x="140" y="15" width="5" height="5" fill={accent} opacity="0.9" />
        {/* Monitor stand */}
        <rect x="122" y="36" width="8" height="4" fill="#334155" />
        <rect x="116" y="40" width="20" height="2" fill="#475569" />

        {/* Desk silhouette */}
        <rect x="10" y="47" width="140" height="3" fill="#1b2638" />
      </svg>

      {/* Bottom dark gradient for crisp readability */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d131c] via-transparent to-black/35" />

      {/* Pixel Manager Avatar standing in the tactical analysis room */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]">
          <PixelManagerAvatar
            avatar={managerAvatar}
            clubPrimaryColor={primary}
            clubSecondaryColor={secondary}
            size={62}
            expression={isDanger ? 'dizzy_shock' : 'default'}
            pose="default"
          />
        </div>
      </div>

      {/* Top-Left Scene Chip */}
      <div className="absolute top-2.5 left-3 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black backdrop-blur-sm ${
            isDanger
              ? 'border-rose-400/50 bg-rose-950/80 text-rose-200'
              : 'border-amber-400/50 bg-amber-950/80 text-amber-200'
          }`}
        >
          {isDanger ? (
            <AlertTriangle className="w-3 h-3" />
          ) : (
            <Eye className="w-3 h-3" />
          )}
          전술 분석실 스카우팅 리포트
        </span>
      </div>

      {/* Bottom-Right Formation & Manager Tag */}
      <div className="absolute bottom-2 right-3 flex items-center gap-1.5 text-[10px] font-bold">
        <span className="rounded border border-white/15 bg-slate-950/80 px-1.5 py-0.5 font-mono text-slate-200">
          {formation}
        </span>
        {managerName && (
          <span className="rounded border border-white/15 bg-slate-950/80 px-1.5 py-0.5 text-slate-300 max-w-[7rem] truncate">
            {managerName}
          </span>
        )}
      </div>
    </div>
  );
}

export function TacticalAdaptationModal({
  alert,
  managerAvatar,
  managerName,
  userClub,
  onDismiss,
  onGoToTactics,
}: TacticalAdaptationModalProps) {
  useBodyScrollLock(true);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  const isDanger = alert.tier === 'danger';
  const tacticName = TACTICS[alert.repeatedTactic]?.name ?? alert.repeatedTactic;
  const roundLabel =
    typeof alert.triggeredAtRound === 'number'
      ? `${alert.triggeredAtRound}R 파훼 경계 도달`
      : '파훼 경계 도달';
  const headline =
    alert.headline ??
    '상대 감독들이 우리 전술 패턴을 완벽히 읽어냈습니다';
  const detail =
    alert.detail ??
    `최근 ${alert.consecutiveCount}경기 연속 동일 패턴이 노출되어(노출도 ${alert.exposureScore}/100), 다음 경기부터 명장 AI 감독이 프리뷰와 다른 전반 카운터 전술과 정밀 파훼 대응을 가동할 가능성이 높습니다.`;
  const accentBorder = isDanger
    ? 'border-rose-500/50 shadow-[0_0_36px_-10px_rgba(244,63,94,0.45)]'
    : 'border-amber-500/45 shadow-[0_0_36px_-10px_rgba(245,158,11,0.4)]';
  const badgeStyle = isDanger
    ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
    : 'bg-amber-500/15 text-amber-300 border-amber-500/35';
  const barStyle = isDanger
    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
    : 'bg-gradient-to-r from-amber-500 to-amber-300';

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4"
      onClick={onDismiss}
    >
      <div
        className={`modal-panel flex w-full max-w-md flex-col rounded-2xl border ${accentBorder} bg-[#0d131c] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pixel-Art Scouting Room Banner */}
        <div className="relative shrink-0">
          <PixelTacticalScoutBanner
            isDanger={isDanger}
            formation={alert.repeatedFormation}
            managerAvatar={managerAvatar}
            managerName={managerName}
            userClub={userClub}
          />
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-2 right-2 rounded-lg bg-slate-950/75 border border-white/15 p-1.5 text-slate-300 hover:bg-slate-900 hover:text-white transition cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Header Title */}
        <div className="shrink-0 border-b border-white/10 bg-[#111822] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${badgeStyle}`}
            >
              전술 파훼 경계 (위험)
            </span>
            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
              {roundLabel}
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-black text-white mt-1 break-keep">
            {headline}
          </h3>
        </div>

        {/* Body */}
        <div className="modal-scroll p-4 space-y-3.5">
          {/* Repeated pattern card */}
          <div className="rounded-xl border border-white/10 bg-[#111822]/90 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400 font-semibold whitespace-nowrap">
                반복 패턴
              </span>
              <span className="font-bold text-white whitespace-nowrap">
                {alert.repeatedFormation} · {tacticName}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold whitespace-nowrap">
                  상대 전술 노출도
                </span>
                <span
                  className={`font-black tabular-nums whitespace-nowrap ${
                    isDanger ? 'text-rose-400' : 'text-amber-300'
                  }`}
                >
                  {alert.exposureScore} / 100
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barStyle}`}
                  style={{ width: `${Math.min(100, alert.exposureScore)}%` }}
                />
              </div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-300 break-keep">
            {detail}
          </p>

          <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-400 break-keep">
            포메이션 또는 전술 스타일을 1경기라도 변주하면 노출도가 즉시 해소됩니다.
            (위험 단계 도달 시 1회 표시되며, 전술 변주 후 다시 위험에 진입할 때만 재안내됩니다.)
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 bg-[#0b1018] px-4 py-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 transition whitespace-nowrap cursor-pointer"
          >
            확인
          </button>
          {onGoToTactics && (
            <button
              type="button"
              onClick={() => {
                onDismiss();
                onGoToTactics();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 transition whitespace-nowrap cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              전술 수정하러 가기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import {
  AlertTriangle,
  Check,
  FileWarning,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import {
  FFP_TIER1_CHEM_PENALTY,
  FFP_TIER1_LOSS_MORALE_EXTRA,
  FFP_TIER1_MAX_OVERRUN_PCT,
  FFP_TIER1_SCORE_PENALTY_PCT,
  FFP_TIER1_WINDOW1_MAX_ATTEMPTS,
  FFP_TIER1_WINDOW2_MAX_ATTEMPTS,
  FFP_TIER1_WINDOW3_MAX_ATTEMPTS,
  FFP_TIER2_CHEM_PENALTY,
  FFP_TIER2_LOSS_MORALE_EXTRA,
  FFP_TIER2_SCORE_PENALTY_PCT,
  FFP_TIER2_WINDOW1_MAX_ATTEMPTS,
  FFP_TIER2_WINDOW2_MAX_ATTEMPTS,
  FFP_TIER2_WINDOW3_MAX_ATTEMPTS,
  FFP_UCL_SPECIAL_MAX_ATTEMPTS,
} from '../../engine/budgetEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type {
  ManagerAvatarConfig,
  SeasonBudgetState,
  UserClubProfile,
} from '../../types/game';
import { PixelManagerAvatar } from './PixelManagerAvatar';

interface FfpOpeningNoticeModalProps {
  budgetState: SeasonBudgetState;
  managerAvatar?: ManagerAvatarConfig;
  managerName?: string;
  userClub?: UserClubProfile;
  onDismiss: () => void;
}

function PixelFfpAuditBanner({
  isTier2,
  excessPct,
  managerAvatar,
  managerName,
  userClub,
}: {
  isTier2: boolean;
  excessPct: number;
  managerAvatar?: ManagerAvatarConfig;
  managerName?: string;
  userClub?: UserClubProfile;
}) {
  const accent = isTier2 ? '#f43f5e' : '#f59e0b';
  const accentSoft = isTier2 ? '#fda4af' : '#fcd34d';
  const primary = userClub?.primaryColor ?? '#10b981';
  const secondary = userClub?.secondaryColor ?? '#f8fafc';

  return (
    <div className="relative h-32 sm:h-36 w-full overflow-hidden border-b border-white/10 bg-[#080c14]">
      {/* Crisp Pixel-Art FFP Audit & Disciplinary Committee Room SVG */}
      <svg
        viewBox="0 0 160 68"
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
        className="h-full w-full pixel-crisp"
        aria-hidden="true"
      >
        {/* Boardroom dark slate wall & wooden panel trim */}
        <rect x="0" y="0" width="160" height="46" fill="#0d1320" />
        <rect x="0" y="40" width="160" height="6" fill="#161f30" />
        <rect x="0" y="46" width="160" height="22" fill="#090e17" />
        <rect x="0" y="45" width="160" height="1" fill="#26334a" />

        {/* Overhead harsh disciplinary spotlight */}
        <rect x="64" y="0" width="32" height="3" fill="#1e293b" />
        <rect x="68" y="3" width="24" height="2" fill={accent} opacity="0.9" />
        <polygon points="68,5 92,5 114,48 46,48" fill={accent} opacity="0.09" />

        {/* Left: FFP Financial Audit Screen showing red overrun bar chart */}
        <rect x="7" y="8" width="48" height="30" fill="#1e293b" />
        <rect x="9" y="10" width="44" height="26" fill="#0a101c" />
        {/* Cap dashed limit line */}
        <rect x="11" y="21" width="40" height="1" fill="#fbbf24" opacity="0.7" />
        {/* Bars breaching cap */}
        <rect x="13" y="25" width="5" height="9" fill="#34d399" />
        <rect x="20" y="22" width="5" height="12" fill="#38bdf8" />
        <rect x="27" y="17" width="5" height="17" fill="#f59e0b" />
        <rect x="34" y="13" width="5" height="21" fill="#f43f5e" />
        <rect x="41" y="12" width="6" height="22" fill="#e11d48" />
        {/* Tiny warning pixel icon */}
        <rect x="12" y="12" width="3" height="5" fill={accent} />
        <rect x="12" y="18" width="3" height="2" fill={accent} />

        {/* Right: Official FFP Disciplinary Board Banner & Red Stamp Dossier */}
        <rect x="106" y="8" width="47" height="28" fill="#1e293b" />
        <rect x="108" y="10" width="43" height="24" fill="#111827" />
        <rect x="111" y="13" width="18" height="3" fill={accent} />
        <rect x="111" y="18" width="36" height="2" fill="#334155" />
        <rect x="111" y="22" width="30" height="2" fill="#334155" />
        <rect x="111" y="26" width="22" height="2" fill="#334155" />
        {/* Red official seal stamp */}
        <rect x="136" y="21" width="11" height="10" fill={accent} opacity="0.9" />
        <rect x="138" y="23" width="7" height="6" fill="#111827" />
        <rect x="140" y="25" width="3" height="2" fill={accentSoft} />

        {/* Conference / Press Hearing Table in foreground */}
        <rect x="12" y="48" width="136" height="4" fill="#1e293b" />
        <rect x="12" y="52" width="136" height="16" fill="#121a28" />
        {/* Audit stacks of paper dossiers on left & right of desk */}
        <rect x="22" y="42" width="16" height="6" fill="#cbd5e1" />
        <rect x="23" y="44" width="14" height="1" fill="#94a3b8" />
        <rect x="24" y="40" width="12" height="2" fill={accent} />
        <rect x="122" y="43" width="18" height="5" fill="#cbd5e1" />
        <rect x="123" y="45" width="16" height="1" fill="#94a3b8" />
        <rect x="125" y="41" width="11" height="2" fill="#f59e0b" />
        {/* Hearing Microphone in front of manager */}
        <rect x="78" y="45" width="4" height="4" fill="#475569" />
        <rect x="79" y="42" width="2" height="3" fill="#94a3b8" />
        <rect x="78" y="40" width="4" height="2" fill="#e2e8f0" />

        {/* Pixel Sweat Drop & Flustered Lines around manager's head */}
        <rect x="94" y="18" width="2" height="2" fill="#38bdf8" />
        <rect x="93" y="20" width="4" height="3" fill="#38bdf8" />
        <rect x="94" y="21" width="1" height="1" fill="#e0f2fe" />
        {/* Flustered motion ticks left of head */}
        <rect x="61" y="18" width="3" height="1" fill={accentSoft} />
        <rect x="60" y="21" width="4" height="1" fill={accentSoft} />
      </svg>

      {/* Bottom dark fade */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d131c] via-transparent to-black/35" />

      {/* User's own Manager Avatar looking flustered/shocked at the audit hearing */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
          <PixelManagerAvatar
            avatar={managerAvatar}
            clubPrimaryColor={primary}
            clubSecondaryColor={secondary}
            size={66}
            expression="dizzy_shock"
            pose="default"
          />
        </div>
      </div>

      {/* Top-Left Scene Chip */}
      <div className="absolute top-2.5 left-3 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black backdrop-blur-sm whitespace-nowrap ${
            isTier2
              ? 'border-rose-400/55 bg-rose-950/85 text-rose-200'
              : 'border-amber-400/55 bg-amber-950/85 text-amber-200'
          }`}
        >
          {isTier2 ? (
            <ShieldAlert className="w-3 h-3" />
          ) : (
            <FileWarning className="w-3 h-3" />
          )}
          리그 재정 감사 위원회 · FFP 통지
        </span>
      </div>

      {/* Bottom-Right Overrun & Manager Tag */}
      <div className="absolute bottom-2 right-3 flex items-center gap-1.5 text-[10px] font-bold">
        <span
          className={`rounded border px-1.5 py-0.5 font-mono font-black tabular-nums whitespace-nowrap ${
            isTier2
              ? 'border-rose-400/50 bg-rose-950/85 text-rose-200'
              : 'border-amber-400/50 bg-amber-950/85 text-amber-200'
          }`}
        >
          +{excessPct}% 초과
        </span>
        {managerName && (
          <span className="rounded border border-white/15 bg-slate-950/85 px-1.5 py-0.5 text-slate-300 max-w-[7rem] truncate">
            {managerName}
          </span>
        )}
      </div>
    </div>
  );
}

export function FfpOpeningNoticeModal({
  budgetState,
  managerAvatar,
  managerName,
  userClub,
  onDismiss,
}: FfpOpeningNoticeModalProps) {
  useBodyScrollLock(true);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  const isTier2 = budgetState.ffpTier === 2;
  const accentBorder = isTier2
    ? 'border-rose-500/55 shadow-[0_0_40px_-10px_rgba(244,63,94,0.45)]'
    : 'border-amber-500/45 shadow-[0_0_36px_-10px_rgba(245,158,11,0.38)]';
  const badgeStyle = isTier2
    ? 'bg-rose-500/18 text-rose-200 border-rose-400/50'
    : 'bg-amber-500/15 text-amber-200 border-amber-400/45';

  const penaltyItems: { label: string; detail: string; severe?: boolean }[] = isTier2
    ? [
        {
          label: '이월 이적 자금 €0M',
          detail: '잔여 예산 없음 — 트레이드 현금 얹기 불가',
        },
        {
          label: `팀 케미 상시 -${FFP_TIER2_CHEM_PENALTY}`,
          detail: '시즌 내내 구단 재정 징계로 팀 케미스트리 대폭 감점',
          severe: true,
        },
        {
          label: `이적 제한: 1차 동결(${FFP_TIER2_WINDOW1_MAX_ATTEMPTS}회) · 2차 ${FFP_TIER2_WINDOW2_MAX_ATTEMPTS}회 · 3차 동결(${FFP_TIER2_WINDOW3_MAX_ATTEMPTS}회)`,
          detail: `정규 1·3차 영입 전면 동결, 2차만 ${FFP_TIER2_WINDOW2_MAX_ATTEMPTS}회 허용 (UCL 특별 이적시장 ${FFP_UCL_SPECIAL_MAX_ATTEMPTS}회 정상)`,
          severe: true,
        },
        {
          label: `패배 시 사기 추가 하락 (-${FFP_TIER2_LOSS_MORALE_EXTRA}단계)`,
          detail: '경기 패배 시 선수단 사기 하락폭이 크게 가중 적용',
          severe: true,
        },
        {
          label: `명예의 전당 · 글로벌 랭킹 점수 -${FFP_TIER2_SCORE_PENALTY_PCT}%`,
          detail: '시즌 최종 점수 정산 시 FFP 2단계 초과 감점 반영',
          severe: true,
        },
      ]
    : [
        {
          label: '이월 이적 자금 €0M',
          detail: '잔여 예산 없음 — 트레이드 현금 얹기 불가',
        },
        {
          label: `팀 케미 상시 -${FFP_TIER1_CHEM_PENALTY}`,
          detail: `시즌 내내 팀 케미스트리 -${FFP_TIER1_CHEM_PENALTY} 페널티 적용`,
        },
        {
          label: `이적 제한: 1·2·3차 각 ${FFP_TIER1_WINDOW1_MAX_ATTEMPTS}회 (UCL ${FFP_UCL_SPECIAL_MAX_ATTEMPTS}회)`,
          detail: `정규 1차(${FFP_TIER1_WINDOW1_MAX_ATTEMPTS}회)·2차(${FFP_TIER1_WINDOW2_MAX_ATTEMPTS}회)·3차(${FFP_TIER1_WINDOW3_MAX_ATTEMPTS}회) 모두 3회→1회 축소, UCL 특별 이적시장 정상`,
        },
        {
          label: `패배 시 사기 추가 하락 (-${FFP_TIER1_LOSS_MORALE_EXTRA}단계)`,
          detail: '경기 패배 시 선수단 사기 하락폭 추가 적용',
        },
        {
          label: `명예의 전당 · 글로벌 랭킹 점수 -${FFP_TIER1_SCORE_PENALTY_PCT}%`,
          detail: '시즌 최종 점수 정산 시 FFP 1단계 초과 감점 반영',
        },
      ];

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4"
      onClick={onDismiss}
    >
      <div
        className={`modal-panel flex w-full max-w-md max-h-[90dvh] flex-col rounded-2xl border ${accentBorder} bg-[#0d131c] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pixel-Art Audit Committee Banner */}
        <div className="relative shrink-0">
          <PixelFfpAuditBanner
            isTier2={isTier2}
            excessPct={budgetState.excessPct}
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

        {/* Title Header */}
        <div className="shrink-0 border-b border-white/10 bg-[#111822] px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-black whitespace-nowrap ${badgeStyle}`}
            >
              <AlertTriangle className="w-3 h-3" />
              {isTier2
                ? `FFP 2단계 징계 (+${FFP_TIER1_MAX_OVERRUN_PCT}% 초과)`
                : `FFP 1단계 주의 (+1~${FFP_TIER1_MAX_OVERRUN_PCT}%)`}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
              개막 전 재정 감사 결과
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-black text-white mt-1 break-keep">
            {isTier2
              ? '드래프트 예산 대폭 초과로 FFP 2단계 징계가 확정되었습니다'
              : '드래프트 예산 초과로 FFP 1단계 제한 조치가 적용됩니다'}
          </h3>
        </div>

        {/* Scrollable Body */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-3.5">
          {/* Spend Summary Box */}
          <div className="rounded-xl border border-white/10 bg-[#111822]/90 p-3 space-y-2 tabular-nums">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold whitespace-nowrap">
                스쿼드 총 지출 / 한도
              </span>
              <span className="font-black text-white whitespace-nowrap">
                <span className={isTier2 ? 'text-rose-300' : 'text-amber-300'}>
                  €{budgetState.initialSpentM}M
                </span>{' '}
                / €{budgetState.capM}M
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold whitespace-nowrap">
                예산 초과분
              </span>
              <span
                className={`font-black whitespace-nowrap ${
                  isTier2 ? 'text-rose-400' : 'text-amber-300'
                }`}
              >
                +€{budgetState.excessM}M (+{budgetState.excessPct}%)
              </span>
            </div>
          </div>

          {/* Active Penalty Checklist */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-extrabold text-slate-300">
              이번 시즌 적용 페널티 ({penaltyItems.length}건)
            </div>
            <div className="space-y-1.5">
              {penaltyItems.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-lg border px-3 py-2 ${
                    item.severe
                      ? 'border-rose-500/35 bg-rose-950/25'
                      : 'border-slate-800 bg-[#0b1018]'
                  }`}
                >
                  <div
                    className={`text-xs font-extrabold break-keep ${
                      item.severe
                        ? 'text-rose-200'
                        : isTier2
                          ? 'text-rose-200/90'
                          : 'text-amber-200'
                    }`}
                  >
                    • {item.label}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 break-keep">
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-[#0b1018] px-4 py-3">
          <span className="text-[10.5px] text-slate-500 break-keep">
            상세 내용은 대시보드 상단 FFP 배지에서 언제든 확인할 수 있습니다.
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-black transition whitespace-nowrap cursor-pointer ${
              isTier2
                ? 'bg-rose-500 text-white hover:bg-rose-400'
                : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            확인하고 개막
          </button>
        </div>
      </div>
    </div>
  );
}

import {
  ArrowLeftRight,
  BookOpen,
  Calendar,
  Check,
  Crown,
  Flame,
  Globe,
  ScrollText,
  Sparkles,
  TrendingDown,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATIONS } from '../../data/formations';
import legendPlayersRaw from '../../data/legendPlayers.json';
import { CURRENT_APP_VERSION } from '../../data/patchNotes';
import { getPlayerAttributes } from '../../engine/attributeEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  GLOBAL_DAILY_TOP_LIMIT,
  GLOBAL_PAST_DAY_ARCHIVE_LIMIT,
} from '../../services/globalRankingService';
import type { Player } from '../../types/player';
import { PlayerCard } from './PlayerCard';

export const WHATS_NEW_DISMISSED_STORAGE_KEY =
  'rtt_whats_new_dismissed_version_v1';

/** Version range highlighted in the current What's New popup. */
export const WHATS_NEW_HIGHLIGHT_RANGE = 'v9.4.0 ~ v9.7.2';

export function isWhatsNewDismissed(
  version: string = CURRENT_APP_VERSION,
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem(WHATS_NEW_DISMISSED_STORAGE_KEY) === version
    );
  } catch {
    return false;
  }
}

export function dismissWhatsNewForVersion(
  version: string = CURRENT_APP_VERSION,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WHATS_NEW_DISMISSED_STORAGE_KEY, version);
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function clearWhatsNewDismissal(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WHATS_NEW_DISMISSED_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

type WhatsNewTabId = 'v97' | 'story' | 'ranking' | 'classics';

const TABS: Array<{
  id: WhatsNewTabId;
  label: string;
  badge: string;
  icon: typeof Crown;
}> = [
  { id: 'v97', label: '이적 프리뷰 · 각성', badge: '9.7 NEW', icon: ArrowLeftRight },
  { id: 'story', label: '팀 소개 · 위기 서사', badge: '9.7 NEW', icon: BookOpen },
  { id: 'ranking', label: '일일 랭킹 · 공정성', badge: '9.5~9.6', icon: Globe },
  { id: 'classics', label: '3-2-4-1 · 클래식', badge: '9.4~9.5', icon: Crown },
];

const LEGEND_PLAYERS = legendPlayersRaw as Player[];

interface WhatsNewModalProps {
  onClose: () => void;
  onOpenPatchNotes?: () => void;
}

export function WhatsNewModal({
  onClose,
  onOpenPatchNotes,
}: WhatsNewModalProps) {
  useBodyScrollLock(true);
  const [activeTab, setActiveTab] = useState<WhatsNewTabId>('v97');
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);

  const previewPlayers = useMemo(() => {
    const busquets = LEGEND_PLAYERS.find((p) => p.id === 'cls-10s-cdm-01');
    const vanDijk = LEGEND_PLAYERS.find((p) => p.id === 'cls-10s-cb-01');
    return {
      busquets: busquets
        ? { ...busquets, attrs: getPlayerAttributes(busquets) }
        : null,
      vanDijk: vanDijk
        ? { ...vanDijk, attrs: getPlayerAttributes(vanDijk) }
        : null,
    };
  }, []);

  const formation3241 = FORMATIONS['3-2-4-1'];

  const handleClose = () => {
    if (dontShowAgain) {
      dismissWhatsNewForVersion(CURRENT_APP_VERSION);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[92] flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#0b111b] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0f1724] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-300">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="whats-new-modal-title"
                  className="text-sm sm:text-base font-black text-white truncate"
                >
                  업데이트 주요 안내
                </h2>
                <span className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-black text-emerald-300 whitespace-nowrap">
                  {CURRENT_APP_VERSION}
                </span>
                <span className="hidden sm:inline font-mono text-[10px] text-slate-400 whitespace-nowrap">
                  {WHATS_NEW_HIGHLIGHT_RANGE} 핵심 요약
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                최근 대규모 개편과 이번 패치의 핵심 변경점을 한눈에 확인하세요.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="업데이트 안내 닫기"
            className="rounded-lg border border-slate-700 bg-slate-900/90 p-1.5 text-slate-400 transition hover:border-slate-500 hover:text-white cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Compact Tab Bar */}
        <div
          role="tablist"
          aria-label="업데이트 카테고리"
          className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800/90 bg-[#090e17] px-3.5 py-2 sm:px-5"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-emerald-400/55 bg-emerald-500/15 text-emerald-200 shadow-sm shadow-emerald-500/10'
                    : 'border-slate-800 bg-[#0d1420] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{t.label}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-black ${
                    active
                      ? 'bg-emerald-400/20 text-emerald-200'
                      : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  {t.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Single Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 break-keep">
          {activeTab === 'v97' && (
            <div className="space-y-4">
              {/* Transfer Market Virtual Swap Preview Mockup */}
              <div className="rounded-2xl border border-emerald-500/30 bg-[#0d1522] p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-300">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    이적시장 가상 교체(스왑) 시너지 프리뷰 → 제안 확정
                  </span>
                  <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-200 whitespace-nowrap">
                    싱글 · 클래식 FA · 멀티리그 공통
                  </span>
                </div>

                {/* Compact Before -> After Delta Preview Bar */}
                <div className="rounded-xl border border-slate-800 bg-[#090f19] p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                    <span className="font-bold text-slate-200">
                      내 포메이션 피치에 임시 교체 투입
                    </span>
                    <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-200 whitespace-nowrap">
                      제안 확정 전 무제한 비교 · 원복 가능
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center tabular-nums">
                    {[
                      { label: '시너지 연결선', val: '24 → 28', delta: '+4', tone: 'text-emerald-300' },
                      { label: '팀 케미', val: '82 → 91', delta: '+9', tone: 'text-emerald-300' },
                      { label: '감독 궁합', val: '6 → 7명', delta: '+1 ★', tone: 'text-amber-300' },
                      { label: '실효 OVR', val: '84.6 → 86.1', delta: '+1.5', tone: 'text-sky-300' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg border border-slate-800/90 bg-[#0d1421] px-2 py-1.5"
                      >
                        <div className="text-[10px] text-slate-400 whitespace-nowrap">
                          {stat.label}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] font-black text-white whitespace-nowrap">
                          {stat.val}
                        </div>
                        <div className={`font-mono text-[10px] font-black ${stat.tone}`}>
                          {stat.delta}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    내 스쿼드 선수와 상대·클래식 선수를 클릭하면 즉시 거래되지 않고 피치 위 시너지선·케미·감독 궁합·포지션 적합도·A/M/D·현금 잔액 변화를 먼저 확인한 뒤{' '}
                    <strong className="text-emerald-200">제안 확정</strong>으로 최종 요청합니다.
                  </p>
                </div>
              </div>

              {/* Awakening 100-Season Diagnostic Calibration */}
              <div className="rounded-2xl border border-orange-500/25 bg-[#0d1522] p-3.5 sm:p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-orange-300">
                    <Flame className="h-3.5 w-3.5" />
                    포텐 각성 실측 진단 &amp; 저발동 병목 해소
                  </span>
                  <span className="rounded bg-orange-500/15 border border-orange-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-orange-200 whitespace-nowrap">
                    시즌 0~3명 체감 최적화
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-xl border border-slate-800 bg-[#090f19] p-2.5 space-y-1">
                    <div className="font-bold text-white">저발동 병목 원인 수정</div>
                    <p className="text-[10.5px] leading-relaxed text-slate-300">
                      연속 출전 과감쇠(주전 고정 시 확률 55% 증발)를 해소하고, 윙·풀백·GK의 인접 시너지 +1↑ 공명 및 UCL 토너먼트 자동진행 각성 판정 누락을 수정했습니다.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#090f19] p-2.5 space-y-1">
                    <div className="font-bold text-white">인플레·남발 억제 원칙 유지</div>
                    <p className="text-[10.5px] leading-relaxed text-slate-300">
                      저활용(케미·궁합 불일치) 0% 억제, 시대별 클래식 0%, 88~89+ 극희박(×0.04 · 최대 +2), 4명+ 남발 차단은 그대로 유지됩니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'story' && (
            <div className="space-y-4">
              {/* Diverse Team Intro Preview */}
              <div className="rounded-2xl border border-slate-800 bg-[#0d1522] p-3.5 sm:p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <BookOpen className="h-3.5 w-3.5" />
                    팀 소개 표현 다양성 대폭 확장
                  </span>
                  <span className="rounded bg-amber-500/15 border border-amber-400/35 px-2 py-0.5 text-[10px] font-bold text-amber-200 whitespace-nowrap">
                    9가지 시즌 정체성 분기
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-xl border border-slate-800/90 bg-[#090f19] p-2.5 space-y-1">
                    <div className="text-[10px] font-black text-emerald-300">
                      선수명 없는 팀·감독 정체성 서술
                    </div>
                    <p className="leading-relaxed text-slate-200">
                      “특정 스타에 기대기보다 3-2-4-1 점유율 축구와 빈틈없는 로테이션으로 시즌 내내 균형을 지킨 팀이었다.”
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800/90 bg-[#090f19] p-2.5 space-y-1">
                    <div className="text-[10px] font-black text-sky-300">
                      듀오·트리오 · 언더독 · 각성 군단 · 신구 조화
                    </div>
                    <p className="leading-relaxed text-slate-200">
                      공격 듀오·중원 사령탑 축·철벽 수비 라인, FFP 제약 돌파, 포텐 각성 군단 등 시즌 색깔에 맞춰 매번 다른 톤으로 완성됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Crisis & Rebound Documentary Team Story Preview */}
              <div className="rounded-2xl border border-slate-800 bg-[#0d1522] p-3.5 sm:p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-300">
                    <TrendingDown className="h-3.5 w-3.5" />
                    팀 스토리 — 부진·위기와 반등의 다큐멘터리 회고
                  </span>
                  <span className="rounded bg-rose-500/15 border border-rose-400/35 px-2 py-0.5 text-[10px] font-bold text-rose-200 whitespace-nowrap">
                    기승전결 흐름 연결
                  </span>
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="rounded-xl border border-rose-500/25 bg-rose-950/15 px-3 py-2 text-slate-200 leading-relaxed">
                    <span className="mr-1.5 rounded bg-rose-500/25 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-rose-200">
                      16~19R · 슬럼프
                    </span>
                    연패·무승 늪, 강팀전 대패·역전패, 핵심 선수 부상 이탈, 전술 파훼 위기, 리그 순위 추락, 컵·UCL 조기 탈락과 준우승의 아쉬움까지 실제 시즌 로그에서 자동 포착합니다.
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    단순 사건 나열이 아니라{' '}
                    <strong className="text-slate-200">
                      위기·부진 → 수석 코치 합류·이적 보강·전술 변주·각성을 통한 반등(또는 끝내 넘지 못한 벽)
                    </strong>
                    으로 이어지는 입체적인 시즌 연대기를 완성합니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ranking' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-[#0d1522] p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-sky-300">
                    <Globe className="h-3.5 w-3.5" />
                    주간 순환 KST 일일 랭킹 &amp; 5대 리그 공정성 기준
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                    <Calendar className="h-3 w-3 text-sky-400" />
                    매주 월요일 00:00(KST) 초기화
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {[
                    { label: '오늘', badge: `TOP ${GLOBAL_DAILY_TOP_LIMIT}`, active: true },
                    { label: '어제', badge: `TOP ${GLOBAL_PAST_DAY_ARCHIVE_LIMIT}`, active: false },
                    { label: '이번 주 이전 날짜', badge: `TOP ${GLOBAL_PAST_DAY_ARCHIVE_LIMIT} 아카이브`, active: false },
                  ].map((tabItem) => (
                    <div
                      key={tabItem.label}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${
                        tabItem.active
                          ? 'border-sky-400/55 bg-sky-500/18 text-sky-200'
                          : 'border-slate-800 bg-[#090f19] text-slate-400'
                      }`}
                    >
                      <span>{tabItem.label}</span>
                      <span className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">
                        {tabItem.badge}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] leading-relaxed text-slate-300">
                  당일은 <strong className="text-sky-200">TOP 10</strong>으로 실시간 경쟁하고, 지난 날짜는{' '}
                  <strong className="text-amber-300">TOP 3</strong>만 아카이브로 보존됩니다. 공정성을 위해{' '}
                  <strong className="text-rose-300">
                    5대 리그 풀 전체 체크 + 오늘(KST) 완료 시즌
                  </strong>
                  만 일일 랭킹에 제출할 수 있으며, 모든 명전 기록에 완료 날짜가 표기됩니다.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'classics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                {/* 3-2-4-1 Mini Pitch SVG */}
                <div className="sm:col-span-5 rounded-2xl border border-slate-800 bg-[#0d1522] p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-emerald-300">
                      {formation3241.name} 포메이션
                    </span>
                    <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-200 whitespace-nowrap">
                      중원 밀도 96
                    </span>
                  </div>
                  <div className="pitch-surface relative mx-auto aspect-[4/3.1] w-full max-w-[260px] overflow-hidden rounded-xl border border-emerald-500/25">
                    <svg
                      viewBox="0 0 100 100"
                      className="h-full w-full"
                      aria-label="3-2-4-1 포메이션 구조 프리뷰"
                    >
                      <rect x="4" y="4" width="92" height="92" rx="2" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.6" />
                      <line x1="4" y1="50" x2="96" y2="50" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
                      <circle cx="50" cy="50" r="11" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
                      <rect x="28" y="31" width="44" height="30" rx="3" fill="rgba(16,185,129,0.10)" stroke="rgba(52,211,153,0.45)" strokeDasharray="2 1.5" strokeWidth="0.6" />
                      {formation3241.links.map(([a, b]) => {
                        const sa = formation3241.slots[a];
                        const sb = formation3241.slots[b];
                        if (!sa || !sb) return null;
                        return (
                          <line key={`${a}-${b}`} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke="rgba(52,211,153,0.38)" strokeWidth="0.65" />
                        );
                      })}
                      {formation3241.slots.map((s) => (
                        <g key={s.index}>
                          <circle
                            cx={s.x}
                            cy={s.y}
                            r="4.2"
                            fill="#0f172a"
                            stroke={
                              s.position === 'MF'
                                ? '#34d399'
                                : s.position === 'FW'
                                  ? '#fbbf24'
                                  : s.position === 'DF'
                                    ? '#38bdf8'
                                    : '#94a3b8'
                            }
                            strokeWidth="1"
                          />
                          <text x={s.x} y={s.y + 1.3} textAnchor="middle" fontSize="2.7" fontWeight="800" fill="#f8fafc">
                            {s.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>

                {/* Era Classics Sub-Attribute Contrast */}
                <div className="sm:col-span-7 rounded-2xl border border-slate-800 bg-[#0d1522] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300">
                      <Crown className="h-3.5 w-3.5" />
                      시대별 클래식(60s~10s) · 세부능력치 차별화
                    </span>
                    <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                      동일 OVR 92
                    </span>
                  </div>
                  {previewPlayers.busquets && previewPlayers.vanDijk && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        {
                          player: previewPlayers.busquets,
                          bars: [
                            { label: 'PAS', val: previewPlayers.busquets.attrs.pas, color: 'bg-emerald-400' },
                            { label: 'PHY', val: previewPlayers.busquets.attrs.phy, color: 'bg-amber-400/80' },
                          ],
                        },
                        {
                          player: previewPlayers.vanDijk,
                          bars: [
                            { label: 'PAS', val: previewPlayers.vanDijk.attrs.pas, color: 'bg-emerald-400/80' },
                            { label: 'PHY', val: previewPlayers.vanDijk.attrs.phy, color: 'bg-rose-400' },
                          ],
                        },
                      ].map(({ player, bars }) => (
                        <div key={player.id} className="rounded-xl border border-slate-800/90 bg-[#090f19] p-2 space-y-1.5">
                          <div className="pointer-events-none">
                            <PlayerCard player={player} compact />
                          </div>
                          {bars.map((b) => (
                            <div key={b.label} className="flex items-center gap-1.5 px-1 text-[10px]">
                              <span className="w-6 font-mono font-bold text-slate-400">{b.label}</span>
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                                <div className={`h-full rounded-full ${b.color}`} style={{ width: `${b.val}%` }} />
                              </div>
                              <span className="w-5 text-right font-mono font-black text-slate-200 tabular-nums">{b.val}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-[#0d1420] px-4 py-3 sm:px-5">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
            <span className="relative flex h-4 w-4 items-center justify-center">
              <input
                id="whats-new-dont-show-checkbox"
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="peer sr-only"
              />
              <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-600 bg-slate-900 transition peer-checked:border-emerald-400 peer-checked:bg-emerald-500">
                {dontShowAgain && (
                  <Check className="h-3 w-3 text-slate-950 stroke-[3]" />
                )}
              </span>
            </span>
            <span className="whitespace-nowrap">
              다시 보지 않기{' '}
              <span className="text-[10px] text-slate-500">
                (다음 업데이트 시 자동 재안내)
              </span>
            </span>
          </label>

          <div className="flex items-center gap-2 ml-auto">
            {onOpenPatchNotes && (
              <button
                type="button"
                onClick={() => {
                  if (dontShowAgain) {
                    dismissWhatsNewForVersion(CURRENT_APP_VERSION);
                  }
                  onOpenPatchNotes();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:border-sky-400/50 hover:text-white cursor-pointer whitespace-nowrap"
              >
                <ScrollText className="h-3.5 w-3.5 text-sky-400" />
                <span>전체 패치노트</span>
              </button>
            )}
            <button
              id="whats-new-confirm-btn"
              type="button"
              onClick={handleClose}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

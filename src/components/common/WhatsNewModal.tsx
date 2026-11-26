import {
  BookOpen,
  Calendar,
  Check,
  Crown,
  Flame,
  Globe,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATIONS } from '../../data/formations';
import legendPlayersRaw from '../../data/legendPlayers.json';
import { CURRENT_APP_VERSION } from '../../data/patchNotes';
import { FFP_TIER2_SCORE_PENALTY_PCT } from '../../engine/budgetEngine';
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
export const WHATS_NEW_HIGHLIGHT_RANGE = 'v9.3.0 ~ v9.6.0';

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

type WhatsNewTabId = 'classics' | 'tactics' | 'ranking' | 'fixes';

const TABS: Array<{
  id: WhatsNewTabId;
  label: string;
  badge: string;
  icon: typeof Crown;
}> = [
  { id: 'ranking', label: '일일 랭킹 · 스토리', badge: '9.6 NEW', icon: Globe },
  { id: 'fixes', label: '저OVR 각성 · 공정성', badge: '9.6 BAL', icon: Wrench },
  { id: 'classics', label: '클래식 · 능력치', badge: '9.3~9.5', icon: Crown },
  { id: 'tactics', label: '3-2-4-1 · 전술', badge: '9.4', icon: Flame },
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
  const [activeTab, setActiveTab] = useState<WhatsNewTabId>('ranking');
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
          {activeTab === 'classics' && (
            <div className="space-y-4">
              {/* Live In-Game Card + Sub-Attribute Reality Contrast Preview */}
              <div className="rounded-2xl border border-slate-800 bg-[#0d1522] p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <Crown className="h-3.5 w-3.5" />
                    시대별 클래식(60s~10s) · 세부능력치 현실화 프리뷰
                  </span>
                  <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                    동일 OVR 92 · 유형별 스탯 차별화
                  </span>
                </div>

                {previewPlayers.busquets && previewPlayers.vanDijk && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      {
                        player: previewPlayers.busquets,
                        tag: '레지스타 · 시야/패스 특화',
                        bars: [
                          { label: 'PAS', val: previewPlayers.busquets.attrs.pas, color: 'bg-emerald-400' },
                          { label: 'DEF', val: previewPlayers.busquets.attrs.def, color: 'bg-sky-400' },
                          { label: 'PHY', val: previewPlayers.busquets.attrs.phy, color: 'bg-amber-400/80' },
                        ],
                      },
                      {
                        player: previewPlayers.vanDijk,
                        tag: '스토퍼 CB · 공중/피지컬 지배',
                        bars: [
                          { label: 'PAS', val: previewPlayers.vanDijk.attrs.pas, color: 'bg-emerald-400/80' },
                          { label: 'DEF', val: previewPlayers.vanDijk.attrs.def, color: 'bg-sky-400' },
                          { label: 'PHY', val: previewPlayers.vanDijk.attrs.phy, color: 'bg-rose-400' },
                        ],
                      },
                    ].map(({ player, tag, bars }) => (
                      <div
                        key={player.id}
                        className="rounded-xl border border-slate-800/90 bg-[#090f19] p-2.5 space-y-2"
                      >
                        <div className="pointer-events-none">
                          <PlayerCard player={player} compact />
                        </div>
                        <div className="px-1 space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400">
                            {tag}
                          </div>
                          {bars.map((b) => (
                            <div
                              key={b.label}
                              className="flex items-center gap-2 text-[10px]"
                            >
                              <span className="w-7 font-mono font-bold text-slate-400">
                                {b.label}
                              </span>
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className={`h-full rounded-full ${b.color}`}
                                  style={{ width: `${b.val}%` }}
                                />
                              </div>
                              <span className="w-6 text-right font-mono font-black text-slate-200 tabular-nums">
                                {b.val}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bullet Highlights */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800/90 bg-[#0f1623] p-3">
                  <div className="text-xs font-black text-amber-300">
                    60s~10s 시대별 클래식 101명 & 년도별 베스트 11
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                    단일 레전드를 폐지하고 60s~10s 아이콘 101명(균일가 €130M ·
                    룰렛 2.5%)과 드림 매치 전용 6개 시대 베스트 11을 신설했습니다.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800/90 bg-[#0f1623] p-3">
                  <div className="text-xs font-black text-emerald-300">
                    현역 OVR 압축(최고 92) & 세부능력치 전수 보정
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                    현역 상한 92 압축과 26-27 폼 반영에 이어, 클래식·현역의
                    패스·수비·피지컬이 실제 선수 유형에 맞게 갈리도록 보정했습니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tactics' && (
            <div className="space-y-4">
              {/* Visual Split Preview: 3-2-4-1 Mini Pitch + Awakening Card */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                {/* 3-2-4-1 Mini Pitch SVG */}
                <div className="sm:col-span-7 rounded-2xl border border-slate-800 bg-[#0d1522] p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-emerald-300">
                      신규 포메이션 · {formation3241.name}
                    </span>
                    <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-200 whitespace-nowrap">
                      중원 밀도 96
                    </span>
                  </div>
                  <div className="pitch-surface relative mx-auto aspect-[4/3.1] w-full max-w-[320px] overflow-hidden rounded-xl border border-emerald-500/25">
                    <svg
                      viewBox="0 0 100 100"
                      className="h-full w-full"
                      aria-label="3-2-4-1 포메이션 구조 프리뷰"
                    >
                      <rect
                        x="4"
                        y="4"
                        width="92"
                        height="92"
                        rx="2"
                        fill="none"
                        stroke="rgba(255,255,255,0.16)"
                        strokeWidth="0.6"
                      />
                      <line
                        x1="4"
                        y1="50"
                        x2="96"
                        y2="50"
                        stroke="rgba(255,255,255,0.14)"
                        strokeWidth="0.5"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="11"
                        fill="none"
                        stroke="rgba(255,255,255,0.14)"
                        strokeWidth="0.5"
                      />
                      {/* Box Midfield Highlight */}
                      <rect
                        x="28"
                        y="31"
                        width="44"
                        height="30"
                        rx="3"
                        fill="rgba(16,185,129,0.10)"
                        stroke="rgba(52,211,153,0.45)"
                        strokeDasharray="2 1.5"
                        strokeWidth="0.6"
                      />
                      {formation3241.links.map(([a, b]) => {
                        const sa = formation3241.slots[a];
                        const sb = formation3241.slots[b];
                        if (!sa || !sb) return null;
                        return (
                          <line
                            key={`${a}-${b}`}
                            x1={sa.x}
                            y1={sa.y}
                            x2={sb.x}
                            y2={sb.y}
                            stroke="rgba(52,211,153,0.38)"
                            strokeWidth="0.65"
                          />
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
                          <text
                            x={s.x}
                            y={s.y + 1.3}
                            textAnchor="middle"
                            fontSize="2.7"
                            fontWeight="800"
                            fill="#f8fafc"
                          >
                            {s.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>

                {/* Awakening Card Preview */}
                <div className="sm:col-span-5 rounded-2xl border border-slate-800 bg-[#0d1522] p-3.5 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center gap-1 text-xs font-black text-orange-300">
                        <Flame className="h-3.5 w-3.5" />
                        포텐 각성 · 즉시 발동
                      </span>
                      <span className="rounded bg-orange-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-orange-200 whitespace-nowrap">
                        시즌 0~3명
                      </span>
                    </div>
                    <div className="card-awakened-ember rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded bg-orange-500/20 border border-orange-400/40 px-1.5 py-0.5 text-[10px] font-black text-orange-200">
                          🔥 포텐↑ 각성
                        </span>
                        <span className="font-mono text-xs font-black text-amber-300 tabular-nums">
                          81 → 88 (+7)
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] font-bold text-white">
                        저·중 OVR(≤84) 현역 원석 육성
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-slate-300">
                        드래프트 피치 프리뷰 배치 기준으로만{' '}
                        <span className="text-orange-300 font-bold">
                          포텐↑/육성
                        </span>
                        을 안내하며, 각성 조건 충족 시 경기 직후 최우선으로 즉시
                        발동합니다.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#090f19] px-3 py-2 text-[11px] text-slate-300">
                    <span className="font-bold text-sky-300">전술 파훼 강화:</span>{' '}
                    동일 전술 10R+(×1.20) · 14R+(×1.35) 장기 경직성 페널티 및 AI
                    실효 전력 상향.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ranking' && (
            <div className="space-y-4">
              {/* Mini Daily Ranking Tabs + Team Story Preview */}
              <div className="rounded-2xl border border-slate-800 bg-[#0d1522] p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-sky-300">
                    <Globe className="h-3.5 w-3.5" />
                    주간 순환 KST 일일 랭킹 개편
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                    <Calendar className="h-3 w-3 text-sky-400" />
                    매주 월요일 00:00(KST) 초기화
                  </span>
                </div>

                {/* Live-style Date Tab Mockup */}
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
                  당일은 <strong className="text-sky-200">TOP 10</strong>으로
                  실시간 경쟁하고, 지난 날짜는{' '}
                  <strong className="text-amber-300">TOP 3</strong>만 아카이브로
                  보존됩니다. 공정성을 위해{' '}
                  <strong className="text-rose-300">
                    5대 리그 풀 전체 체크 + 오늘(KST) 완료 시즌
                  </strong>
                  만 일일 랭킹에 제출할 수 있으며, 모든 명전 기록에 완료 날짜가
                  표기됩니다.
                </p>
              </div>

              {/* Expressive Team Intro & Chronological Story Preview */}
              <div className="rounded-2xl border border-slate-800 bg-[#0d1522] p-3.5 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <BookOpen className="h-3.5 w-3.5" />
                    풍부해진 팀 소개 &amp; 시기별 스토리텔링 연대기
                  </span>
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-200 whitespace-nowrap">
                    v9.6.0 개편
                  </span>
                </div>
                <div className="rounded-xl border border-slate-800/90 bg-[#090f19] px-3 py-2 text-[11px] text-slate-200 leading-relaxed">
                  “개막 전 저평가를 비웃듯 3-2-4-1 점유율 축구에 승부사 기질을
                  녹여내며 정상을 훔쳐낸 반란의 주인공이다. 시즌 중 잠재력을
                  깨운 각성 에이스와 클래식의 품격이 어우러져 트레블의 서사를
                  완성했다.”
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  딱딱한 수치 나열 대신 스포츠 칼럼처럼 생생한 팀 설명을 생성하며,
                  <strong className="text-slate-200">
                    개막 → 강호 격파 → 각성 → 연승 → 반환점 → 대역전극 → 컵·리그·UCL
                    결승 → 에필로그
                  </strong>
                  까지 시즌 주요 사건을 시기별로 한 문장씩 엮어냅니다.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'fixes' && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {[
                {
                  badge: '저OVR 각성 개편',
                  accent: 'text-orange-300 border-orange-400/35 bg-orange-500/10',
                  title: '저OVR 원석 활약·평점·각성 밸런스 상향',
                  desc: '시너지·감독 궁합·육성 코치 보너스를 경기 세부 스탯과 평점에 직접 반영하고, 저OVR(≤79) 상대 평점 기준(6.8~7.0+)과 육성 공명 보너스를 도입해 잘 키운 원석이 실제로 활약하고 각성하도록 개선했습니다.',
                },
                {
                  badge: '랭킹 공정성',
                  accent: 'text-rose-300 border-rose-400/35 bg-rose-500/10',
                  title: '과거 기록 제출 차단 & 5대 리그 전체 풀 필수화',
                  desc: '유저 명전에 완료 날짜(KST)를 표기하고 과거 기록·날짜 불명 기록의 일일 랭킹 제출을 차단했습니다. 5대 리그 드래프트 풀 중 하나라도 해제하면 개인 명전 기록만 가능하며 랭킹 제출은 불가합니다.',
                },
                {
                  badge: 'FFP · 보스',
                  accent: 'text-emerald-300 border-emerald-400/35 bg-emerald-500/10',
                  title: `FFP 2단계 감점 ${FFP_TIER2_SCORE_PENALTY_PCT}% 완화 & 역대 24팀 현실화`,
                  desc: 'FFP 2단계 점수 감점을 20%→12%로 완화하고, 역대 24팀(최종 보스)의 과대평가 OVR을 소폭 현실화해 전략적 도전이 가능한 균형을 맞췄습니다.',
                },
                {
                  badge: '안정성',
                  accent: 'text-sky-300 border-sky-400/35 bg-sky-500/10',
                  title: '라이브 리트라이 차단 & 자동진행/이적시장 수정',
                  desc: '라이브 중계 일시중지·새로고침 리트라이를 원천 차단하고, 자동진행 중 하단 잠금 및 이적시장 클래식 카드 선택 피드백을 개선했습니다.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-800/90 bg-[#0f1623] p-3.5 space-y-1.5"
                >
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black whitespace-nowrap ${item.accent}`}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {item.badge}
                  </span>
                  <div className="text-xs font-black text-white">
                    {item.title}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    {item.desc}
                  </p>
                </div>
              ))}
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

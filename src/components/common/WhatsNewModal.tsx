import {
  ArrowLeftRight,
  BookOpen,
  Calendar,
  Check,
  Crown,
  Flame,
  Globe,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATIONS } from '../../data/formations';
import legendPlayersRaw from '../../data/legendPlayers.json';
import { CURRENT_APP_VERSION } from '../../data/patchNotes';
import { getPlayerAttributes } from '../../engine/attributeEngine';
import {
  CASH_LEGEND_CHANCE_MAX_BONUS,
  CASH_LEGEND_CHANCE_PER_10M,
  DRAFT_BUDGET_CAP_M,
} from '../../engine/budgetEngine';
import { BIG_CLUB_RANDOM_DRAFT_MIN_AVG } from '../../engine/draftEngine';
import { STORY_SCENARIOS } from '../../data/story/storyRegistry';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  GLOBAL_DAILY_TOP_LIMIT,
  GLOBAL_PAST_DAY_ARCHIVE_LIMIT,
} from '../../services/globalRankingService';
import type { Player } from '../../types/player';
import { RoadToTrebleHeroSvg } from '../setup/RoadToTrebleHeroSvg';
import { StoryPixelSceneSvg } from '../story/StoryPixelSceneSvg';
import { PlayerCard } from './PlayerCard';

export const WHATS_NEW_DISMISSED_STORAGE_KEY =
  'rtt_whats_new_dismissed_version_v1';

/** Version range highlighted in the current What's New popup. */
export const WHATS_NEW_HIGHLIGHT_RANGE = 'v9.5.0 ~ v10.0.0';

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

type WhatsNewTabId =
  | 'v100'
  | 'v910'
  | 'v99'
  | 'v98'
  | 'v97'
  | 'story'
  | 'ranking'
  | 'classics';

const TABS: Array<{
  id: WhatsNewTabId;
  label: string;
  badge: string;
  icon: typeof Crown;
}> = [
  { id: 'v100', label: '스토리 모드 출시!', badge: '10.0 NEW', icon: BookOpen },
  { id: 'v910', label: '난이도 상승!', badge: '9.10', icon: Flame },
  { id: 'v99', label: '타이틀 도트 · 빠른 시작', badge: '9.9', icon: SlidersHorizontal },
  { id: 'v98', label: '멀티리그 대규모 정비', badge: '9.8', icon: Users },
  { id: 'v97', label: '이적 프리뷰 · 각성', badge: '9.7', icon: ArrowLeftRight },
  { id: 'story', label: '팀 소개 · 위기 서사', badge: '9.7', icon: ScrollText },
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
  const [activeTab, setActiveTab] = useState<WhatsNewTabId>('v100');
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
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-5 space-y-4 break-keep">
          {activeTab === 'v100' && (
            <div className="space-y-3.5">
              {/* Hero Story Banner + Live Pixel Scene */}
              <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-950/30 via-[#0d1420] to-emerald-950/25 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm sm:text-base font-black text-amber-200">
                    <BookOpen className="h-4.5 w-4.5 text-amber-400 shrink-0" />
                    대형 신규 콘텐츠 「스토리 모드」 5종 전격 출시!
                  </span>
                  <span className="rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-black text-amber-200 whitespace-nowrap">
                    v10.0.0 MAJOR
                  </span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-slate-300">
                  드래프트를 생략하고{' '}
                  <strong className="text-white">
                    그 시절 실제 스쿼드 · 감독 · 전술 · UCL 16강 토너먼트
                  </strong>
                  로 곧장 뛰어들어 ★★★ 미션에 도전하세요. 시작 시 감독과 에이스들이 등장하는{' '}
                  <strong className="text-amber-200">
                    탭형 도트 일러스트 문학 프롤로그
                  </strong>
                  가 펼쳐집니다.
                </p>
                <div className="overflow-hidden rounded-xl border border-slate-800/90 bg-[#070b12]">
                  <StoryPixelSceneSvg
                    backdrop="three_lungs_engine"
                    accentColor="#ef4444"
                    characters={STORY_SCENARIOS[1].introSlides[1].characters}
                  />
                </div>
              </div>

              {/* 5 Scenarios Compact Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] tabular-nums">
                {STORY_SCENARIOS.map((sc) => (
                  <div
                    key={sc.id}
                    className="rounded-xl border border-slate-800 bg-[#090f19] p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-white truncate">
                        {sc.seasonLabel} {sc.clubName}
                      </span>
                      <span className="rounded border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-amber-300 whitespace-nowrap">
                        €{sc.cashBudgetM}M
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-emerald-300">
                      《{sc.title}》
                    </div>
                    <div className="text-[10.5px] text-slate-400">
                      {sc.leagueLabel} · {sc.cupLabel}
                      {sc.uclLabel ? ` · ${sc.uclLabel}` : ''} · {sc.transferRuleLabel}
                    </div>
                  </div>
                ))}
              </div>

              {/* 3 Core Design Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 space-y-1">
                  <div className="font-extrabold text-rose-200">
                    [빠른 선발] 전면 제거
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    자동 최적이 아닌 유저가 직접 라인업·전술·로테이션을 짜는 순수 실력 플레이.
                  </p>
                </div>
                <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 space-y-1">
                  <div className="font-extrabold text-sky-200">
                    5대 리그 35구단 직접 지목
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    룰렛 대신 자국 19팀 + 타 4대 리그 상위 4팀씩 16팀을 직접 골라 현금 협상(아스널은 겨울 1회 한정).
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-1">
                  <div className="font-extrabold text-emerald-200">
                    일일 랭킹 · 세이브 완전 분리
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    일반 커리어와 세이브·랭킹이 섞이지 않으며 전용 ★★★ 별 도감(최대 15★)으로 기록됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'v910' && (
            <div className="space-y-3.5">
              {/* Hero Difficulty Banner */}
              <div className="rounded-2xl border border-rose-500/35 bg-gradient-to-br from-rose-950/30 via-[#0d1420] to-amber-950/20 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm sm:text-base font-black text-rose-200">
                    <Flame className="h-4.5 w-4.5 text-rose-400 shrink-0" />
                    난이도 상승! 전략 · 시너지 · 각성 중심 밸런스 개편
                  </span>
                  <span className="rounded-md border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-black text-rose-200 whitespace-nowrap">
                    v9.10.0 BALANCE
                  </span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-slate-300">
                  단순 오버롤 찍누 대신{' '}
                  <strong className="text-white">
                    드래프트 · 4색 케미 · 감독 궁합 · 전술 변주 · 포텐 각성
                  </strong>
                  이 모두 맞물렸을 때 역사 최강 보스(14-15 바르사 등)에 도전할 수 있도록 출발선과 클래식 유입 속도를 다듬었습니다.
                </p>
              </div>

              {/* 3 Key Balance Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] tabular-nums">
                <div className="rounded-xl border border-emerald-500/30 bg-[#090f19] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-emerald-200">
                      드래프트 예산 축소
                    </span>
                    <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-emerald-300">
                      €950M → €{DRAFT_BUDGET_CAP_M}M
                    </span>
                  </div>
                  <p className="leading-relaxed text-slate-400">
                    초반 무페널티 슈퍼팀 구성을 억제하고 FFP 경계 압박을 높였습니다. 아낀 잔여 예산은{' '}
                    <strong className="text-slate-200">상한 없이 100% 이적 현금</strong>으로 이월됩니다.
                  </p>
                </div>

                <div className="rounded-xl border border-sky-500/30 bg-[#090f19] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-sky-200">
                      빅클럽 균등 랜덤 룰렛
                    </span>
                    <span className="rounded bg-sky-500/15 border border-sky-400/35 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-sky-300">
                      평균 {BIG_CLUB_RANDOM_DRAFT_MIN_AVG}+ (12팀)
                    </span>
                  </div>
                  <p className="leading-relaxed text-slate-400">
                    유럽 빅클럽 12팀은 포지션 버킷 내{' '}
                    <strong className="text-slate-200">균등 랜덤 추출</strong>(표시 3장은 OVR순 정렬)로 개편하고, 중하위권 84팀은 OVR 상위순을 유지합니다(싱글·멀티 공용).
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-[#090f19] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-amber-200">
                      클래식 FA 확률 하향
                    </span>
                    <span className="rounded bg-amber-500/15 border border-amber-400/35 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-amber-300">
                      15~30% (우승 34%)
                    </span>
                  </div>
                  <p className="leading-relaxed text-slate-400">
                    일반 현역 트레이드는 유지하고, 시대별 클래식 FA 성사율만 30%대 → 20%대 및 현금 가산{' '}
                    <strong className="text-slate-200">
                      €10M당 +{CASH_LEGEND_CHANCE_PER_10M}%p(최대 +{CASH_LEGEND_CHANCE_MAX_BONUS}%p)
                    </strong>
                    로 낮췄습니다.
                  </p>
                </div>
              </div>

              {/* Engine Preservation Note */}
              <div className="rounded-xl border border-slate-800 bg-[#0b111c] px-3.5 py-2.5 text-[11px] text-slate-300 flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  <strong className="text-white">경기 엔진 케미·시너지·전술 비중 현행 유지:</strong>{' '}
                  낮아진 출발선 위에서 시너지·감독 궁합·수석 코치·포텐 각성으로 만드는 역전의 가치가 더 선명해집니다.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'v99' && (
            <div className="space-y-3.5">
              {/* 1. Upgraded Retro Pixel Hero Art Preview */}
              <div className="rounded-2xl border border-emerald-500/30 bg-[#0d1522] p-3.5 sm:p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    첫 화면 고급 도트 일러스트 리디자인
                  </span>
                  <span className="rounded bg-amber-500/15 border border-amber-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200 whitespace-nowrap">
                    280×108 픽셀 · 실시간 감독 연동
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-[#060b14]">
                  <RoadToTrebleHeroSvg />
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  디더링 야간 스타디움·관중석·투광등 빛줄기·잔디 스트라이프·3D 트로피 받침대·정상 빅이어 &amp; 고트(GOAT) 반짝임을 고밀도 도트 아트로 업그레이드하고, 출발선에 <strong className="text-emerald-200">내가 커스텀한 감독 도트 캐릭터와 구단 깃발</strong>이 실시간 반영됩니다.
                </p>
              </div>

              {/* 2. Compact Profile Bar + Streamlined Quick Start Flow */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] text-slate-300">
                <div className="rounded-xl border border-slate-800 bg-[#090f19] p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-extrabold text-emerald-200">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    첫 화면 1줄 감독 · 구단 커스텀 바
                  </div>
                  <p className="leading-relaxed text-slate-400">
                    첫 화면 슬림 프로필 바에서 감독 외형·이름·구단명·유니폼 디자인을 한 번에 커스텀하고 영구 저장합니다(싱글·멀티플레이 자동 연동 · 프리셋 6개 지원).
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#090f19] p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-extrabold text-amber-200">
                    <Wand2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    새 시즌 빠른 시작 (중복 입력 제거)
                  </div>
                  <p className="leading-relaxed text-slate-400">
                    [새 시즌 시작] 클릭 시 구단·외형 입력을 생략하고 바로 <strong className="text-white">드래프트 풀 · 포메이션 · 전술 → 감독 특성 선택</strong>으로 진입합니다. 각 단계 상단 칩에서 언제든 모달 수정도 가능합니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'v98' && (
            <div className="space-y-3.5">
              {/* 1. Draft Quick Lineup + UCL Preview Inline Tactics */}
              <div className="rounded-2xl border border-emerald-500/30 bg-[#0d1522] p-3.5 sm:p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-300">
                    <Wand2 className="h-3.5 w-3.5" />
                    멀티리그 드래프트 [빠른 선발] &amp; UCL 프리뷰 실시간 전술 수정
                  </span>
                  <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-200 whitespace-nowrap">
                    방장 · 참가자 전원 지원
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="rounded-xl border border-slate-800 bg-[#090f19] p-3 space-y-1">
                    <div className="font-extrabold text-emerald-200">
                      드래프트 원클릭 [빠른 선발]
                    </div>
                    <p className="leading-relaxed text-slate-400">
                      싱글과 동일한 최적 라인업 엔진으로 11선발·5벤치를 원클릭 자동 배치하고, 중복 픽·턴 꼬임 가드와 v9.4 룰렛 포텐/시너지 프리뷰를 통일했습니다.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#090f19] p-3 space-y-1">
                    <div className="font-extrabold text-sky-200">
                      UCL 1·2차전 프리뷰 직접 전술 정비
                    </div>
                    <p className="leading-relaxed text-slate-400">
                      토너먼트 매 라운드(~강) 프리뷰에서 10종 포메이션(3-2-4-1 포함)·5대 전술·공용 피치보드 라인업을 직접 수정하고 시뮬 전 호스트에 즉시 동기화합니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Awakening Summary Fix & Dedup + Popup Queue & v9.x Parity */}
              <div className="rounded-2xl border border-orange-500/25 bg-[#0d1522] p-3.5 sm:p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-orange-300">
                    <Flame className="h-3.5 w-3.5" />
                    각성 결산 반영 · 중복 팝업 차단 · 싱글 v9.x 디자인/기능 통일
                  </span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-300">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">각자 팀 결산 각성 완벽 반영:</strong> 방장·참가자 전원 결산 피치·카드·표·점수에 각성 상승 OVR, 붉은 불꽃 효과, 각성 목록이 정상 표시됩니다.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">각성 팝업 1회 노출 가드 &amp; 단일 팝업 큐:</strong> 시즌·선수 고유 키 기반 1회 가드로 중복 노출을 차단하고, 모든 모달이 겹치지 않고 순차 표시됩니다.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                    <span>
                      <strong className="text-white">싱글 v9.x 완전 동기화:</strong> FFP 케미 페널티(-8/-14) 교정, 수석 코치·전술 노출도·시대 클래식 배지·H2H 팀 스토리까지 멀티리그 전역 통일.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

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

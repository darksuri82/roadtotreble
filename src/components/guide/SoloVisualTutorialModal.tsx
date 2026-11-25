import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Crown,
  Dices,
  HelpCircle,
  Play,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { openSystemGuide } from './guideNavigation';

export const SOLO_TUTORIAL_STORAGE_KEY = 'rtt_solo_tutorial_dismissed_v1';

export function isSoloTutorialDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SOLO_TUTORIAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSoloTutorialDismissed(dismissed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (dismissed) {
      window.localStorage.setItem(SOLO_TUTORIAL_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(SOLO_TUTORIAL_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota / private-mode errors
  }
}

interface TutorialStepSpec {
  id: string;
  shortLabel: string;
  headline: string;
  bullets: string[];
  visual: ReactNode;
}

function Step1Visual() {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#080d16] p-3.5 sm:p-4">
      <svg
        viewBox="0 0 560 156"
        className="w-full h-auto"
        role="img"
        aria-label="드래프트에서 리그, 자국 컵, 챔피언스리그, 명예의 전당으로 이어지는 시즌 흐름도"
      >
        <defs>
          <linearGradient id="tut-road-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        {/* Connecting Path */}
        <line
          x1="60"
          y1="68"
          x2="500"
          y2="68"
          stroke="url(#tut-road-grad)"
          strokeWidth="3"
          strokeDasharray="6 4"
          opacity="0.75"
        />

        {/* Node 1: Draft */}
        <g transform="translate(22, 30)">
          <rect
            width="84"
            height="76"
            rx="12"
            fill="#0e1726"
            stroke="#10b981"
            strokeOpacity="0.65"
            strokeWidth="1.5"
          />
          <text x="42" y="24" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="700">
            STEP 01
          </text>
          <text x="42" y="45" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">
            드래프트
          </text>
          <text x="42" y="62" textAnchor="middle" fill="#94a3b8" fontSize="9.5">
            선발11 · 벤치5
          </text>
        </g>

        {/* Node 2: League */}
        <g transform="translate(128, 30)">
          <rect
            width="84"
            height="76"
            rx="12"
            fill="#0e1726"
            stroke="#38bdf8"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
          <text x="42" y="24" textAnchor="middle" fill="#7dd3fc" fontSize="10" fontWeight="700">
            STEP 02
          </text>
          <text x="42" y="45" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">
            5대 리그
          </text>
          <text x="42" y="62" textAnchor="middle" fill="#94a3b8" fontSize="9.5">
            Top4 챔스 진출
          </text>
        </g>

        {/* Node 3: Cup */}
        <g transform="translate(234, 30)">
          <rect
            width="84"
            height="76"
            rx="12"
            fill="#0e1726"
            stroke="#fb7185"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
          <text x="42" y="24" textAnchor="middle" fill="#fda4af" fontSize="10" fontWeight="700">
            STEP 03
          </text>
          <text x="42" y="45" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">
            자국 컵
          </text>
          <text x="42" y="62" textAnchor="middle" fill="#94a3b8" fontSize="9.5">
            단판 토너먼트
          </text>
        </g>

        {/* Node 4: UCL */}
        <g transform="translate(340, 30)">
          <rect
            width="90"
            height="76"
            rx="12"
            fill="#0f1b2e"
            stroke="#38bdf8"
            strokeOpacity="0.85"
            strokeWidth="1.8"
          />
          <text x="45" y="24" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="700">
            STEP 04
          </text>
          <text x="45" y="45" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">
            챔피언스리그
          </text>
          <text x="45" y="62" textAnchor="middle" fill="#bae6fd" fontSize="9.5">
            36팀 스위스·토너먼트
          </text>
        </g>

        {/* Node 5: Treble / HoF */}
        <g transform="translate(450, 24)">
          <rect
            width="92"
            height="88"
            rx="14"
            fill="#1f180b"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          <text x="46" y="24" textAnchor="middle" fill="#fcd34d" fontSize="10" fontWeight="800">
            ★ GOAL
          </text>
          <text x="46" y="47" textAnchor="middle" fill="#fef3c7" fontSize="13.5" fontWeight="900">
            트레블 달성
          </text>
          <text x="46" y="66" textAnchor="middle" fill="#fbbf24" fontSize="9.5" fontWeight="700">
            명예의 전당
          </text>
          <text x="46" y="80" textAnchor="middle" fill="#cbd5e1" fontSize="8.5">
            역대 24팀 비교
          </text>
        </g>

        {/* Bottom Caption Pill */}
        <rect x="132" y="122" width="296" height="22" rx="11" fill="#0f172a" stroke="#1e293b" />
        <text x="280" y="136.5" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600">
          리그 우승 + 자국 컵 우승 + UCL 빅이어 = 역사적 트레블
        </text>
      </svg>
    </div>
  );
}

function Step2Visual() {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#080d16] p-3.5 sm:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
        {/* Manager Card */}
        <div className="sm:col-span-5 rounded-xl border border-emerald-500/40 bg-[#0e1726] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9.5px] font-extrabold text-emerald-300">
              감독 특성 14종
            </span>
            <span className="text-[10px] font-bold text-amber-300">★ 추천 전술</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-lg border border-sky-400/35 bg-sky-950/25 px-2.5 py-1.5 text-[11px]">
              <span className="font-bold text-white">빌드업 · 전술형 (8종)</span>
              <span className="font-mono text-[10px] font-bold text-sky-300">
                1~11명 강화
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-amber-400/35 bg-amber-950/20 px-2.5 py-1.5 text-[11px]">
              <span className="font-bold text-white">스페셜리스트 (6종)</span>
              <span className="font-mono text-[10px] font-bold text-amber-300">
                상황 특화
              </span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="hidden sm:flex sm:col-span-2 flex-col items-center justify-center text-emerald-400">
          <ArrowRight className="w-5 h-5" />
          <span className="text-[9px] font-bold text-amber-300 mt-0.5">독립 보정</span>
        </div>

        {/* Synergy Result Card */}
        <div className="sm:col-span-5 rounded-xl border border-amber-400/40 bg-[#121926] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-300">궁합 일치 선수</span>
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 font-mono text-[10px] font-black text-emerald-300">
              +1 <span className="text-amber-300">★</span>
            </span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#090f19] p-2 space-y-1 text-[10.5px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">개인 감독 궁합</span>
              <span className="font-mono font-bold text-amber-300">전원 ★ +1 OVR</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">철학 게이지 (★ N/11)</span>
              <span className="font-mono font-bold text-emerald-300">팀 A/M/D 상승</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">2D 경기 스타일</span>
              <span className="font-semibold text-sky-300">빌드업·압박 반영</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step3Visual() {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#080d16] p-3.5 sm:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Mini 3-Club Roulette */}
        <div className="sm:col-span-5 rounded-xl border border-slate-800 bg-[#0d1420] p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
            <span className="inline-flex items-center gap-1">
              <Dices className="w-3.5 h-3.5 text-emerald-400" />
              3구단 룰렛
            </span>
            <span className="text-amber-300">👑 LEGEND 2.5%</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg border border-emerald-500/35 bg-[#121c2c] py-2 px-1">
              <div className="text-[9px] text-slate-400">#1</div>
              <div className="text-[10.5px] font-extrabold text-white mt-0.5">구단 A</div>
              <div className="text-[8.5px] text-emerald-300">후보 3명</div>
            </div>
            <div className="rounded-lg border border-emerald-500/35 bg-[#121c2c] py-2 px-1">
              <div className="text-[9px] text-slate-400">#2</div>
              <div className="text-[10.5px] font-extrabold text-white mt-0.5">구단 B</div>
              <div className="text-[8.5px] text-emerald-300">후보 3명</div>
            </div>
            <div className="rounded-lg border border-amber-400/70 bg-amber-950/35 py-2 px-1">
              <div className="flex justify-center">
                <Crown className="w-3 h-3 text-amber-300" />
              </div>
              <div className="text-[10px] font-black text-amber-300 mt-0.5">LEGEND</div>
              <div className="text-[8.5px] text-amber-200/90">단독 1명</div>
            </div>
          </div>
        </div>

        {/* Mini 4-Color Synergy Pitch SVG */}
        <div className="sm:col-span-7 rounded-xl border border-slate-800 bg-[#0b1815] p-2.5">
          <svg
            viewBox="0 0 300 120"
            className="w-full h-auto"
            role="img"
            aria-label="4색 시너지 연결선과 최대 +4 보너스가 적용된 미니 피치"
          >
            {/* Pitch border */}
            <rect
              x="6"
              y="6"
              width="288"
              height="108"
              rx="10"
              fill="#0c1b18"
              stroke="#1e3a33"
              strokeWidth="1.2"
            />
            {/* 4 Parallel Colored Lines from Left/Right/Bottom to Center ST */}
            {/* Club (Emerald) */}
            <line x1="65" y1="78" x2="146" y2="40" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" />
            {/* Nation (Sky) */}
            <line x1="70" y1="84" x2="151" y2="46" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" />
            {/* Style (Amber) */}
            <line x1="234" y1="78" x2="154" y2="40" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
            {/* Elite 88+ (Purple) */}
            <line x1="229" y1="84" x2="149" y2="46" stroke="#c084fc" strokeWidth="2.4" strokeLinecap="round" />

            {/* Center Node (+4 ★) */}
            <g transform="translate(108, 16)">
              <rect
                width="84"
                height="44"
                rx="8"
                fill="#0f172a"
                stroke="#34d399"
                strokeWidth="1.6"
              />
              <text x="16" y="21" fill="#ffffff" fontSize="12" fontWeight="900">
                90
              </text>
              <rect x="36" y="10" width="24" height="14" rx="4" fill="#064e3b" stroke="#34d399" strokeWidth="0.8" />
              <text x="48" y="20" textAnchor="middle" fill="#6ee7b7" fontSize="9.5" fontWeight="800">
                +4
              </text>
              <text x="69" y="20" textAnchor="middle" fill="#fcd34d" fontSize="11" fontWeight="900">
                ★
              </text>
              <text x="42" y="36" textAnchor="middle" fill="#cbd5e1" fontSize="8.5" fontWeight="700">
                시너지+3 · 감독+1
              </text>
            </g>

            {/* Left Node */}
            <g transform="translate(24, 68)">
              <rect width="70" height="30" rx="7" fill="#0f172a" stroke="#334155" strokeWidth="1.2" />
              <text x="35" y="19" textAnchor="middle" fill="#e2e8f0" fontSize="9.5" fontWeight="700">
                LW · 구단·국적
              </text>
            </g>

            {/* Right Node */}
            <g transform="translate(206, 68)">
              <rect width="70" height="30" rx="7" fill="#0f172a" stroke="#334155" strokeWidth="1.2" />
              <text x="35" y="19" textAnchor="middle" fill="#e2e8f0" fontSize="9.5" fontWeight="700">
                CAM · 스타일·88+
              </text>
            </g>
          </svg>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2.5 text-[9.5px] text-slate-300">
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-3 rounded-full bg-emerald-400" />
              구단·전소속
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-3 rounded-full bg-sky-400" />
              국적
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-3 rounded-full bg-amber-400" />
              스타일
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-3 rounded-full bg-purple-400" />
              엘리트 88+
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4Visual() {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#080d16] p-3.5 sm:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Tactics Mini Panel */}
        <div className="rounded-xl border border-slate-800 bg-[#0e1522] p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-300">통합 전술</span>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-emerald-300">
              완성도 88%
            </span>
          </div>
          <div className="flex flex-wrap gap-1 text-[9px] font-bold">
            <span className="rounded border border-emerald-500/35 bg-emerald-500/12 px-1.5 py-0.5 text-emerald-300">
              중원 ▲
            </span>
            <span className="rounded border border-emerald-500/35 bg-emerald-500/12 px-1.5 py-0.5 text-emerald-300">
              측면 ▲
            </span>
            <span className="rounded border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 text-slate-300">
              전환 ▬
            </span>
            <span className="rounded border border-rose-500/35 bg-rose-500/12 px-1.5 py-0.5 text-rose-300">
              압박 ▼
            </span>
          </div>
          <div className="text-[9.5px] text-slate-400">
            5대 구역 대결 + 하프타임 수싸움
          </div>
        </div>

        {/* Live Auto-Advance Mini Panel */}
        <div className="rounded-xl border border-slate-800 bg-[#0e1522] p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-sky-300">라이브 진행</span>
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-sky-200">
              5 · 7 · 9초
            </span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#090e16] px-2 py-1.5">
            <div className="flex items-center justify-between font-mono text-[10px] font-black text-white">
              <span>MY</span>
              <span className="text-emerald-300">2 : 1</span>
              <span className="text-slate-400">68&apos;</span>
            </div>
            <div className="mt-1 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-3/4 rounded-full bg-emerald-400" />
            </div>
          </div>
          <div className="text-[9.5px] text-slate-400">
            일시정지 후 2D 중계 즉시 난입
          </div>
        </div>

        {/* Trade & Condition Mini Panel */}
        <div className="rounded-xl border border-slate-800 bg-[#0e1522] p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-300">이적 · 컨디션</span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-amber-200">
              3회 협상
            </span>
          </div>
          <div className="space-y-1 text-[9.5px]">
            <div className="flex items-center justify-between rounded bg-slate-900/90 px-2 py-1">
              <span className="text-slate-300">1:1 ~ 3:1 트레이드</span>
              <span className="font-bold text-emerald-300">니즈 +32%</span>
            </div>
            <div className="flex items-center justify-between rounded bg-slate-900/90 px-2 py-1">
              <span className="text-slate-300">인터뷰 · 부상 관리</span>
              <span className="font-bold text-amber-300">사기 ±2</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step5Visual() {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#080d16] p-3.5 sm:p-4 space-y-2.5">
      {/* Mock Top Bar */}
      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0d1420] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-display text-xs font-bold tracking-wider text-white">
            ROAD TO TREBLE
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/60 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-200 shadow-sm shadow-emerald-500/20">
            <BookOpen className="w-3 h-3" />
            가이드북
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/60 bg-sky-500/15 px-2 py-1 text-[10px] font-bold text-sky-200">
            <HelpCircle className="w-3 h-3" />
            ? 도움말
          </span>
        </div>
      </div>

      {/* Mock Contextual Popover */}
      <div className="mx-auto max-w-sm rounded-xl border border-slate-700/90 bg-[#0b111b] p-3 shadow-xl space-y-1.5">
        <div className="flex items-center justify-between text-[10.5px] font-bold text-white border-b border-slate-800 pb-1">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            화면 곳곳의 ? 버튼으로 즉시 확인
          </span>
          <span className="text-[9.5px] text-slate-500">탭하면 열림</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-relaxed">
          피치 케미 배지, 드래프트, 전술실, 이적시장의{' '}
          <strong className="text-emerald-300">?</strong> 버튼을 누르면 핵심 수치만
          깔끔하게 뜨고 <strong className="text-sky-300">가이드북 해당 탭</strong>으로
          바로 이동할 수 있습니다.
        </p>
      </div>
    </div>
  );
}

const TUTORIAL_STEPS: TutorialStepSpec[] = [
  {
    id: 'overview',
    shortLabel: '1. 목표',
    headline: '드래프트부터 트레블까지, 한 시즌 축구 감독 시뮬레이션',
    bullets: [
      '나만의 16인 스쿼드를 꾸려 5대 리그 우승 · 자국 컵 · 36팀 챔피언스리그 3관왕(트레블)에 도전합니다.',
      '시즌 종료 후 역대 전설 24팀과 동일 공식으로 점수를 겨루고 명예의 전당에 기록됩니다.',
    ],
    visual: <Step1Visual />,
  },
  {
    id: 'manager',
    shortLabel: '2. 감독',
    headline: '14종 감독 특성으로 내 팀의 축구 철학 결정',
    bullets: [
      '구단·포메이션 설정 후 14종 감독 특성 중 원하는 능력을 직접 고르거나 랜덤으로 선택합니다.',
      '감독과 궁합이 맞는 선수는 개인 ★+1 OVR을 받고, 모을수록 팀 A/M/D와 2D 경기 색깔이 강해집니다.',
    ],
    visual: <Step2Visual />,
  },
  {
    id: 'draft',
    shortLabel: '3. 드래프트',
    headline: '3구단 룰렛 · 예산 €950M · 4색 시너지선으로 팀 완성',
    bullets: [
      '매 슬롯 3구단 룰렛 후보 중 1명을 골라 선발 11명·벤치 5명을 완성합니다. 4색 연결선 2/4/8선(+1/+2/+3) + 감독 궁합(★+1)으로 개인 최대 +4 OVR!',
      '16인 예산 한도 €950M (레전드 전원 €95M 균일가 · 남은 예산은 이적시장 현금으로 100% 이월, 초과 시 2단계 FFP 페널티).',
    ],
    visual: <Step3Visual />,
  },
  {
    id: 'season',
    shortLabel: '4. 운영',
    headline: '전술 변주 · 반환점 수석 코치 · 현금 트레이드 · 포텐 각성',
    bullets: [
      '같은 포메이션·전술만 반복하면 AI 감독이 사전 파훼를 준비하므로 변주하세요. 2차 이적시장엔 수석 코치 1명(12종 중 3명 추천)을 선임합니다.',
      '이월된 예산(€M)을 트레이드 현금으로 얹어 성사율을 높이고, 실전 활약 선수(레전드 제외)는 영구 OVR +2~+7 포텐 각성이 터질 수 있습니다.',
    ],
    visual: <Step4Visual />,
  },
  {
    id: 'ready',
    shortLabel: '5. 시작',
    headline: '준비 끝! 상세 공식은 상단 가이드북과 ? 버튼에',
    bullets: [
      '플레이 중 수치가 궁금할 땐 언제든 우상단 [가이드] 또는 화면 곳곳의 ? 아이콘을 눌러 바로 확인하세요.',
      '준비가 되셨다면 아래 버튼으로 구단·포메이션 설정을 시작해 트레블을 향해 달려보세요!',
    ],
    visual: <Step5Visual />,
  },
];

interface SoloVisualTutorialModalProps {
  open: boolean;
  mode: 'onboarding' | 'replay';
  onClose: () => void;
  onProceed?: () => void;
}

export function SoloVisualTutorialModal({
  open,
  mode,
  onClose,
  onProceed,
}: SoloVisualTutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() =>
    isSoloTutorialDismissed(),
  );
  const touchStartXRef = useRef<number | null>(null);

  useBodyScrollLock(open);

  const finishAndExit = useCallback(
    (shouldProceed: boolean) => {
      if (mode === 'onboarding') {
        setSoloTutorialDismissed(dontShowAgain);
      } else if (dontShowAgain !== isSoloTutorialDismissed()) {
        setSoloTutorialDismissed(dontShowAgain);
      }
      onClose();
      if (shouldProceed && onProceed) {
        onProceed();
      }
    },
    [dontShowAgain, mode, onClose, onProceed],
  );

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finishAndExit(mode === 'onboarding');
      } else if (e.key === 'ArrowRight') {
        setStepIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setStepIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, finishAndExit, mode]);

  if (!open) return null;

  const current = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const diff = startX - endX;
    if (Math.abs(diff) < 44) return;
    if (diff > 0 && !isLast) {
      setStepIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1));
    } else if (diff < 0 && !isFirst) {
      setStepIndex((i) => Math.max(0, i - 1));
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/85 p-3 sm:p-5"
      onClick={() => finishAndExit(mode === 'onboarding')}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Road To Treble 입문 튜토리얼"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="modal-panel flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#0e1522] shadow-2xl break-keep"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-[#090e16] px-4 sm:px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-300 whitespace-nowrap">
              {stepIndex + 1} / {TUTORIAL_STEPS.length}
            </span>
            <h2 className="text-xs sm:text-sm font-extrabold text-white truncate">
              Road To Treble 입문 튜토리얼
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {mode === 'onboarding' && (
              <button
                type="button"
                onClick={() => finishAndExit(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:border-emerald-400/50 hover:text-emerald-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <SkipForward className="w-3 h-3 shrink-0" />
                바로 시작
              </button>
            )}
            <button
              type="button"
              onClick={() => finishAndExit(mode === 'onboarding')}
              aria-label="튜토리얼 닫기"
              className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clickable 5-Step Indicator Bar */}
        <div className="shrink-0 border-b border-slate-800/80 bg-[#0a1019] px-3 sm:px-5 py-2">
          <div className="grid grid-cols-5 gap-1">
            {TUTORIAL_STEPS.map((st, idx) => {
              const active = idx === stepIndex;
              const passed = idx < stepIndex;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStepIndex(idx)}
                  className={`rounded-lg border px-1.5 py-1.5 text-center text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate touch-manipulation ${
                    active
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                      : passed
                        ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white'
                        : 'border-transparent bg-slate-950/60 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {st.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slide Body */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          <div className="text-center space-y-1">
            <h3 className="text-base sm:text-lg font-black text-white">
              {current.headline}
            </h3>
          </div>

          {current.visual}

          <ul className="space-y-1.5 rounded-xl border border-slate-800/80 bg-[#0a1018] p-3.5 text-xs leading-relaxed text-slate-300">
            {current.bullets.map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer Controls */}
        <div className="shrink-0 border-t border-slate-800 bg-[#090e16] px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-400 hover:text-slate-200 cursor-pointer select-none">
            <button
              type="button"
              role="checkbox"
              aria-checked={dontShowAgain}
              onClick={() => setDontShowAgain((v) => !v)}
              className={`flex h-4 w-4 items-center justify-center rounded border transition-colors cursor-pointer ${
                dontShowAgain
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                  : 'border-slate-600 bg-slate-900 text-transparent'
              }`}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </button>
            <span>다음부터 보지 않기</span>
          </label>

          <div className="flex items-center gap-2 ml-auto">
            {isLast && (
              <button
                type="button"
                onClick={() => {
                  finishAndExit(false);
                  openSystemGuide('basics');
                }}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:border-sky-400/50 hover:text-sky-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5" />
                상세 가이드북
              </button>
            )}

            <button
              type="button"
              disabled={isFirst}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              이전
            </button>

            {isLast ? (
              <button
                id="tutorial-start-career-btn"
                type="button"
                onClick={() => finishAndExit(mode === 'onboarding')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap shadow-md shadow-emerald-500/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {mode === 'onboarding' ? '시즌 시작하기' : '닫기'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setStepIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1))
                }
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                다음
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Coins,
  Crown,
  Dices,
  Eye,
  Flame,
  HelpCircle,
  Play,
  ShieldCheck,
  SkipForward,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ERA_BEST_XI_DREAM_TEAMS } from '../../data/eraBestXiTeams';
import {
  DRAFT_BUDGET_CAP_M,
  FFP_TIER1_MAX_EXCESS_RATIO,
  LEGEND_FLAT_DRAFT_COST_M,
} from '../../engine/budgetEngine';
import { ELITE_PAIR_MIN_OVR } from '../../engine/chemistryEngine';
import { STAFF_COACHES } from '../../engine/staffCoachEngine';
import {
  ADAPTATION_HISTORY_WINDOW,
  EXPOSURE_DANGER_THRESHOLD,
} from '../../engine/tacticalAdaptationEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
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
        <g transform="translate(22, 30)">
          <rect width="84" height="76" rx="12" fill="#0e1726" stroke="#10b981" strokeOpacity="0.65" strokeWidth="1.5" />
          <text x="42" y="24" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="700">STEP 01</text>
          <text x="42" y="45" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">드래프트</text>
          <text x="42" y="62" textAnchor="middle" fill="#94a3b8" fontSize="9.5">16인 · €950M</text>
        </g>
        <g transform="translate(128, 30)">
          <rect width="84" height="76" rx="12" fill="#0e1726" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="1.5" />
          <text x="42" y="24" textAnchor="middle" fill="#7dd3fc" fontSize="10" fontWeight="700">STEP 02</text>
          <text x="42" y="45" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">5대 리그</text>
          <text x="42" y="62" textAnchor="middle" fill="#94a3b8" fontSize="9.5">Top4 챔스 진출</text>
        </g>
        <g transform="translate(234, 30)">
          <rect width="84" height="76" rx="12" fill="#0e1726" stroke="#fb7185" strokeOpacity="0.55" strokeWidth="1.5" />
          <text x="42" y="24" textAnchor="middle" fill="#fda4af" fontSize="10" fontWeight="700">STEP 03</text>
          <text x="42" y="45" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">자국 컵</text>
          <text x="42" y="62" textAnchor="middle" fill="#94a3b8" fontSize="9.5">단판 토너먼트</text>
        </g>
        <g transform="translate(340, 30)">
          <rect width="90" height="76" rx="12" fill="#0f1b2e" stroke="#38bdf8" strokeOpacity="0.85" strokeWidth="1.8" />
          <text x="45" y="24" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="700">STEP 04</text>
          <text x="45" y="45" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">챔피언스리그</text>
          <text x="45" y="62" textAnchor="middle" fill="#bae6fd" fontSize="9.5">36팀 스위스·토너먼트</text>
        </g>
        <g transform="translate(450, 24)">
          <rect width="92" height="88" rx="14" fill="#1f180b" stroke="#f59e0b" strokeWidth="2" />
          <text x="46" y="24" textAnchor="middle" fill="#fcd34d" fontSize="10" fontWeight="800">★ GOAL</text>
          <text x="46" y="47" textAnchor="middle" fill="#fef3c7" fontSize="13.5" fontWeight="900">트레블 달성</text>
          <text x="46" y="66" textAnchor="middle" fill="#fbbf24" fontSize="9.5" fontWeight="700">명예의 전당</text>
          <text x="46" y="80" textAnchor="middle" fill="#cbd5e1" fontSize="8.5">역대 24팀·시대XI</text>
        </g>
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
        {/* Real Pixel Manager Portrait + Traits */}
        <div className="sm:col-span-6 rounded-xl border border-emerald-500/40 bg-[#0e1726] p-3 flex items-center gap-3">
          <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-[#111824]">
            <PixelManagerAvatar
              clubPrimaryColor="#10b981"
              clubSecondaryColor="#ecfdf5"
              size={48}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9.5px] font-extrabold text-emerald-300 whitespace-nowrap">
                감독 특성 14종
              </span>
              <span className="text-[10px] font-bold text-amber-300 whitespace-nowrap">
                ★ 추천 전술
              </span>
            </div>
            <div className="rounded-lg border border-sky-400/35 bg-sky-950/25 px-2 py-1 text-[10.5px] flex items-center justify-between">
              <span className="font-bold text-white">빌드업·전술형 (8종)</span>
              <span className="font-mono text-[9.5px] font-bold text-sky-300">1~11명 강화</span>
            </div>
            <div className="rounded-lg border border-amber-400/35 bg-amber-950/20 px-2 py-1 text-[10.5px] flex items-center justify-between">
              <span className="font-bold text-white">스페셜리스트 (6종)</span>
              <span className="font-mono text-[9.5px] font-bold text-amber-300">상황 특화</span>
            </div>
          </div>
        </div>

        {/* Synergy Result Card */}
        <div className="sm:col-span-6 rounded-xl border border-amber-400/40 bg-[#121926] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-300">감독 궁합 일치 선수</span>
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
  const tier2CapM = Math.floor(
    DRAFT_BUDGET_CAP_M * (1 + FFP_TIER1_MAX_EXCESS_RATIO),
  );
  const sampleBaseM = 745;
  const sampleProjectedM = sampleBaseM + LEGEND_FLAT_DRAFT_COST_M;
  const sampleLeftTier1M = Math.max(0, DRAFT_BUDGET_CAP_M - sampleProjectedM);
  const sampleLeftTier2M = Math.max(0, tier2CapM - sampleProjectedM);
  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#080d16] p-3.5 sm:p-4 space-y-3">
      {/* Real-Styled In-Game Draft Budget Slider Preview */}
      <div className="rounded-xl border-2 border-sky-400/45 bg-gradient-to-r from-[#0e1b29] via-[#0e1622] to-[#0d1520] p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] tabular-nums">
          <div className="flex flex-wrap items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-extrabold text-white">드래프트 예산</span>
            <span className="font-black text-white">
              €{sampleBaseM}M <span className="text-slate-400 font-bold">/ €{DRAFT_BUDGET_CAP_M}M</span>
            </span>
            <span className="rounded border border-sky-400/55 bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-black text-sky-200 whitespace-nowrap">
              프리뷰 클래식 +€{LEGEND_FLAT_DRAFT_COST_M}M → €{sampleProjectedM}M
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-200 whitespace-nowrap">
            <Coins className="w-3 h-3 text-emerald-300" />
            이월 €{sampleLeftTier1M}M
          </span>
        </div>
        {/* Track with base + sky preview segment + 100% amber & 115% rose markers */}
        <div className="relative h-3 w-full rounded-full bg-slate-900 border border-slate-700/80 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300"
            style={{ width: '61%' }}
          />
          <div
            className="absolute inset-y-0 bg-gradient-to-r from-sky-400 to-cyan-300 animate-pulse"
            style={{ left: '61%', width: '11%' }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-amber-300"
            style={{ left: '78%' }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-rose-400"
            style={{ left: '90%' }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] tabular-nums">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-amber-400/35 bg-amber-500/12 px-1.5 py-0.5 font-bold text-amber-200 whitespace-nowrap">
              1차 경계(€{DRAFT_BUDGET_CAP_M}M): €{sampleLeftTier1M}M 남음
            </span>
            <span className="rounded border border-slate-600/60 bg-slate-800/90 px-1.5 py-0.5 font-bold text-slate-200 whitespace-nowrap">
              2차 경계(€{tier2CapM}M): €{sampleLeftTier2M}M 남음
            </span>
          </div>
          <span className="inline-flex items-center gap-1 font-bold text-amber-300 whitespace-nowrap">
            <Crown className="w-3 h-3" />
            시대별 클래식 전원 €{LEGEND_FLAT_DRAFT_COST_M}M 균일가
          </span>
        </div>
      </div>

      {/* Bottom Compact Row: 3-Club Roulette + 4-Color Synergy Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-5 rounded-xl border border-slate-800 bg-[#0d1420] p-2.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 mb-1.5">
            <span className="inline-flex items-center gap-1">
              <Dices className="w-3.5 h-3.5 text-emerald-400" />
              3구단 룰렛
            </span>
            <span className="text-amber-300">👑 2.5%</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg border border-emerald-500/35 bg-[#121c2c] py-1.5 px-1">
              <div className="text-[10px] font-extrabold text-white">구단 A</div>
              <div className="text-[8.5px] text-emerald-300">후보 3명</div>
            </div>
            <div className="rounded-lg border border-emerald-500/35 bg-[#121c2c] py-1.5 px-1">
              <div className="text-[10px] font-extrabold text-white">구단 B</div>
              <div className="text-[8.5px] text-emerald-300">후보 3명</div>
            </div>
            <div className="rounded-lg border border-amber-400/70 bg-amber-950/35 py-1.5 px-1">
              <div className="text-[10px] font-black text-amber-300">CLASSIC</div>
              <div className="text-[8.5px] text-amber-200/90">€{LEGEND_FLAT_DRAFT_COST_M}M</div>
            </div>
          </div>
        </div>
        <div className="sm:col-span-7 rounded-xl border border-slate-800 bg-[#0b1815] p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-emerald-300">4색 시너지 연결선</span>
            <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 font-mono text-emerald-200">
              최대 +3 + 감독 ★+1 = +4
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="h-1.5 w-3 rounded-full bg-emerald-400" />
              구단·전소속
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="h-1.5 w-3 rounded-full bg-sky-400" />
              국적
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="h-1.5 w-3 rounded-full bg-amber-400" />
              스타일 궁합
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="h-1.5 w-3 rounded-full bg-purple-400" />
              엘리트 {ELITE_PAIR_MIN_OVR}+
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4Visual() {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#080d16] p-3.5 sm:p-4 space-y-2.5">
      {/* Real In-Game Tactical Room Exposure Strip Preview */}
      <div className="rounded-xl border border-slate-800 bg-[#0c131d] p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded border border-rose-500/45 bg-rose-500/15 px-2 py-0.5 font-black text-rose-200 tabular-nums whitespace-nowrap">
              <Eye className="w-3 h-3" />
              전술 노출도 76/100 · 파훼 경계
            </span>
            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
              펩 과르디올라(93) 명장 파훼 높음
            </span>
          </div>
          <span className="rounded bg-emerald-500/15 border border-emerald-500/35 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300 whitespace-nowrap">
            전술 완성도 88%
          </span>
        </div>

        {/* Elite AI Counter Warning Banner (Exact In-Game Look) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-rose-500/45 bg-rose-950/35 px-2.5 py-1.5 text-[10.5px] text-rose-200">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            명장 AI 파훼 위험: 프리뷰와 다른 전반 카운터 전술 가능
          </span>
          <span className="text-[9.5px] font-bold text-rose-300/90 whitespace-nowrap">
            변주 시 즉시 해소
          </span>
        </div>

        {/* 5-Zone & Live Progress Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#090e15] px-2.5 py-1.5 text-[9.5px] font-bold">
            <span className="text-slate-400 mr-1">5구역:</span>
            <span className="rounded border border-emerald-500/35 bg-emerald-500/12 px-1.5 py-0.5 text-emerald-300">중원 ▲</span>
            <span className="rounded border border-emerald-500/35 bg-emerald-500/12 px-1.5 py-0.5 text-emerald-300">측면 ▲</span>
            <span className="rounded border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 text-slate-300">전환 ▬</span>
            <span className="rounded border border-rose-500/35 bg-rose-500/12 px-1.5 py-0.5 text-rose-300">압박 ▼</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#090e15] px-2.5 py-1.5 text-[10px]">
            <span className="font-bold text-sky-300">라이브 자동진행</span>
            <span className="font-mono font-black text-white">MY 2 : 1 · 68&apos;</span>
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold text-sky-200">2D 난입</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step5Visual() {
  const sampleCoach = STAFF_COACHES.sys_tactical_mastery;
  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#080d16] p-3.5 sm:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-stretch">
        {/* Real Staff Coach Pixel Portrait Card */}
        <div className="sm:col-span-6 rounded-xl border border-teal-500/40 bg-[#0d1620] p-3 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-teal-300">
              <UserCheck className="w-3.5 h-3.5" />
              2차 이적시장 수석 코치
            </span>
            <span className="rounded bg-teal-500/15 border border-teal-400/35 px-1.5 py-0.5 text-[9.5px] font-black text-teal-200">
              12종 중 3명 추천
            </span>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-[#090f17] p-2">
            <div className="flex h-12 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#111824]">
              <PixelManagerAvatar
                avatar={sampleCoach.avatar}
                clubPrimaryColor={sampleCoach.clubPrimaryColor}
                clubSecondaryColor={sampleCoach.clubSecondaryColor}
                size={38}
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white truncate">
                {sampleCoach.name}
              </div>
              <div className="text-[10px] font-bold text-teal-300 truncate">
                {sampleCoach.roleTitle}
              </div>
              <div className="text-[9.5px] text-slate-300 mt-0.5">
                {sampleCoach.shortBadge}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-2.5 py-1.5">
            <span className="font-bold text-emerald-200">이월 자금 현금 협상</span>
            <span className="font-bold text-emerald-300">
              트레이드·FA 성사율 상승
            </span>
          </div>
        </div>

        {/* Real Crimson Ember Awakened Player Card Preview */}
        <div className="sm:col-span-6 rounded-xl border border-rose-500/35 bg-[#120d12] p-3 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-200">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              선수 포텐 폭발 (영구 각성)
            </span>
            <span className="rounded bg-rose-500/20 border border-rose-400/40 px-1.5 py-0.5 text-[9.5px] font-black text-rose-200">
              클래식 제외
            </span>
          </div>

          <div className="card-awakened-ember rounded-xl bg-[#10131d] px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-black text-sky-300">
                  CM
                </span>
                <span className="text-xs font-black text-white truncate">
                  유망주 에이스
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[9.5px] text-rose-200/90">
                <span>패스 +4</span>
                <span>·</span>
                <span>드리블 +4</span>
                <span>·</span>
                <span>슈팅 +3</span>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0 tabular-nums">
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold text-slate-400 line-through">
                  83
                </span>
                <span className="font-display text-xl font-black text-white leading-none">
                  87
                </span>
              </div>
              <span className="mt-0.5 rounded bg-rose-500/25 border border-rose-400/50 px-1.5 py-px text-[9.5px] font-black text-rose-200">
                영구 +4
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 break-keep">
            잘 활용하고 활약한 선수의 <strong className="text-rose-200">순수 OVR 영구 상승</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step6Visual() {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#080d16] p-3.5 sm:p-4 space-y-2.5">
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
      <div className="mx-auto max-w-sm rounded-xl border border-slate-700/90 bg-[#0b111b] p-3 shadow-xl space-y-1.5">
        <div className="flex items-center justify-between text-[10.5px] font-bold text-white border-b border-slate-800 pb-1">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            화면 곳곳의 ? 버튼으로 즉시 확인
          </span>
          <span className="text-[9.5px] text-slate-500">탭하면 열림</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-relaxed break-keep">
          예산 바, 피치 케미, 전술실, 이적시장의{' '}
          <strong className="text-emerald-300">?</strong> 버튼을 누르면 핵심 수치만
          바로 확인하고 <strong className="text-sky-300">가이드북 해당 탭</strong>으로
          이동할 수 있습니다.
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
      '나만의 16인 스쿼드로 5대 리그 · 자국 컵 · 36팀 챔피언스리그 3관왕(트레블)에 도전합니다.',
      `시즌 종료 후 리그 난이도가 반영된 공정 점수로 역대 전설 24팀·일일·주간 랭킹(오늘 TOP 20 · 월~일 주간 TOP 10 · 주간 초기화)에 도전하고, 나만의 팀 스토리를 기록하며 드림 매치에서 년도별 베스트 11(${ERA_BEST_XI_DREAM_TEAMS.length}팀)과 겨룰 수 있습니다.`,
    ],
    visual: <Step1Visual />,
  },
  {
    id: 'manager',
    shortLabel: '2. 감독',
    headline: '14종 감독 특성으로 팀의 축구 철학을 결정',
    bullets: [
      '구단·포메이션 설정 후 14종 감독 특성 중 원하는 능력을 선택하거나 랜덤 배정받습니다.',
      '감독 궁합 선수는 ★ 보너스를 받고, 모을수록 팀 전력과 2D 경기 색깔이 뚜렷해집니다.',
    ],
    visual: <Step2Visual />,
  },
  {
    id: 'draft',
    shortLabel: '3. 예산·FFP',
    headline: `예산 €${DRAFT_BUDGET_CAP_M}M · 클래식 €${LEGEND_FLAT_DRAFT_COST_M}M · FFP 주의`,
    bullets: [
      `후보를 클릭해 피치에 프리뷰 배치하면 그 위치의 시너지·예산 변화·각성 잠재(포텐↑/육성)가 즉시 계산되며, 아낀 예산은 이적 자금으로 이월됩니다.`,
      '시대별 클래식(60s~10s)·슈퍼스타를 과도하게 모아 예산을 초과하면 FFP 1·2단계 제재가 적용되니 균형 있게 구성하세요(10s 클래식은 현역과 별도 표기로 공존).',
    ],
    visual: <Step3Visual />,
  },
  {
    id: 'tactics',
    shortLabel: '4. 전술·파훼',
    headline: `5구역 수싸움 & ${ADAPTATION_HISTORY_WINDOW}경기 반복 시 전술 파훼 타격`,
    bullets: [
      `같은 포메이션·전술을 약 ${ADAPTATION_HISTORY_WINDOW}경기 연속 반복하면 파훼 경계(${EXPOSURE_DANGER_THRESHOLD}+)에 도달하며, 10경기·14경기 이상 고집할수록 AI 파훼 타격이 최대 +35%까지 가중됩니다.`,
      '상대 스타일에 맞춰 10종 포메이션(신규 3-2-4-1 포함)이나 팀 전술을 한 번만 변주해도 노출도가 즉시 완화됩니다.',
    ],
    visual: <Step4Visual />,
  },
  {
    id: 'growth',
    shortLabel: '5. 코치·각성',
    headline: '반환점 수석 코치 & 저·중 OVR 포텐 각성(시즌 0~3명)',
    bullets: [
      '2차 이적시장 진입 시 추천 수석 코치 3명 중 1명을 선임해 후반기 전력을 보강할 수 있습니다(FFP 제재와 무관하게 선임 가능).',
      '포텐 각성 원리: 현역 OVR ≤84가 주포지션·인접 시너지 2선+(+1↑)·감독 궁합·좋은 컨디션으로 실전 활약(저OVR 6.75~7.1+ · 중상위권 7.25~7.4+ · 공격포인트/무실점)을 쌓으면 경기 직후 즉시 영구 각성합니다(클래식 0%).',
    ],
    visual: <Step5Visual />,
  },
  {
    id: 'ready',
    shortLabel: '6. 시작',
    headline: '준비 완료! 세부 수치는 상단 가이드북과 ? 버튼에',
    bullets: [
      '플레이 중 정확한 수치가 궁금할 땐 언제든 우상단 [가이드] 또는 화면 곳곳의 ? 아이콘을 눌러 확인하세요.',
      '아래 버튼으로 구단·포메이션 설정을 시작해 트레블을 향해 달려보세요!',
    ],
    visual: <Step6Visual />,
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
        className="modal-panel flex w-full max-w-2xl max-h-[90dvh] flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#0e1522] shadow-2xl break-keep"
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

        {/* Clickable 6-Step Indicator Bar */}
        <div className="shrink-0 border-b border-slate-800/80 bg-[#0a1019] px-3 sm:px-5 py-2">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
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
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 sm:px-6 py-4 sm:py-5 space-y-4">
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
                  openSystemGuide('budget');
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

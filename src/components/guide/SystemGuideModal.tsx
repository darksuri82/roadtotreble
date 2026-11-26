import {
  ArrowLeftRight,
  BookOpen,
  Coins,
  Compass,
  Crown,
  Eye,
  Flame,
  GraduationCap,
  Layers,
  Radio,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import { HISTORICAL_BENCHMARK_TEAMS } from '../../data/historicalTeams';
import { MANAGER_TRAIT_LIST } from '../../data/managerTraits';
import {
  AWAKENING_MAX_GAIN,
  AWAKENING_MIN_APPEARANCES,
  AWAKENING_MIN_GAIN,
  AWAKENING_MIN_SEASON_MATCH,
  AWAKENING_OVR_HARD_CAP,
  AWAKENING_SECOND_COUNT_MULT,
  AWAKENING_SUPERSTAR_MAX_GAIN,
  AWAKENING_SUPERSTAR_OVR_THRESHOLD,
  AWAKENING_SUPERSTAR_RATE_MULT,
  AWAKENING_THIRD_PLUS_MULT,
} from '../../engine/awakeningEngine';
import {
  CASH_LEGEND_CHANCE_MAX_BONUS,
  CASH_LEGEND_CHANCE_PER_10M,
  CASH_STAR_GUARD_RELIEF_THRESHOLD_M,
  CASH_TO_TP_OVER_CAP_RATE,
  CASH_TO_TP_RATE,
  CASH_TO_TP_SOFT_CAP_M,
  computePlayerDraftCostM,
  DRAFT_BUDGET_CAP_M,
  FFP_TIER1_CHEM_PENALTY,
  FFP_TIER1_LOSS_MORALE_EXTRA,
  FFP_TIER1_MAX_EXCESS_RATIO,
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
  LEGEND_FLAT_DRAFT_COST_M,
} from '../../engine/budgetEngine';
import {
  COMPLEMENTARY_STYLE_PAIRS,
  ELITE_PAIR_MIN_OVR,
  TEAM_CHEMISTRY_LINE_WEIGHTS,
  TEAM_CHEMISTRY_MAX_RAW_BONUS,
  TEAM_CHEMISTRY_MIN_BONUS,
  TEAM_CHEMISTRY_NEUTRAL_SCORE,
  TEAM_CHEMISTRY_ORG_BONUS_CAP,
  TEAM_CHEMISTRY_SYNERGY_DEDUCT_RATIO,
} from '../../engine/chemistryEngine';
import { ALL_CLUBS_WITH_LEAGUE } from '../../engine/dataLoader';
import {
  CANDIDATES_PER_REEL,
  DEFAULT_ROULETTE_LEGEND_RATE,
} from '../../engine/draftEngine';
import {
  HOF_AUTO_INDUCTION_MIN_SCORE,
  HOF_RESET_NOTICE_TEXT,
  HOF_RULE_ERA_V9,
} from '../../engine/legacyEngine';
import { MP_H2H_MAX_POINTS } from '../../engine/mpLeagueScore';
import {
  STAFF_COACH_CATEGORY_LABELS,
  STAFF_COACH_CHEM_LIFT,
  STAFF_COACH_DEV_AWAKENING_MULT,
  STAFF_COACH_DEV_MAX_BASE_OVR,
  STAFF_COACH_DEV_OVR_LIFT,
  STAFF_COACH_LATE_STAMINA_REDUCTION,
  STAFF_COACH_LINE_LIFT,
  STAFF_COACH_LIST,
  STAFF_COACH_SUB_COMBINED_CAP,
  STAFF_COACH_SUB_OVR_LIFT,
  STAFF_COACH_TACTIC_MATCHUP_MULT,
  STAFF_COACH_TACTIC_OVR_LIFT,
} from '../../engine/staffCoachEngine';
import { MAX_MATCH_SUBS } from '../../engine/staminaEngine';
import { TACTIC_LIST, TACTICS } from '../../engine/tacticEngine';
import {
  ADAPTATION_HISTORY_WINDOW,
  ADAPTATION_MAX_AI_OPP_XG_PENALTY,
  ADAPTATION_MAX_AI_XG_BONUS,
  ADAPTATION_MAX_ATT_PENALTY,
  ADAPTATION_MAX_DEF_PENALTY,
  ADAPTATION_MAX_MATCHUP_OVR_PENALTY,
  ADAPTATION_MAX_MID_PENALTY,
  ADAPTATION_MAX_POSSESSION_PENALTY,
  ADAPTATION_MAX_USER_XG_PENALTY,
  COACH_ADAPTATION_MITIGATION,
  ELITE_AI_COUNTER_OVR_THRESHOLD,
  EXPOSURE_DANGER_THRESHOLD,
  EXPOSURE_WARNING_THRESHOLD,
} from '../../engine/tacticalAdaptationEngine';
import {
  ATTEMPTS_PER_WINDOW,
  TRANSFER_ROULETTE_LEGEND_RATE,
} from '../../engine/transferEngine';
import { UCL_EXTERNAL_TEAMS } from '../../engine/uclEngine';
import { ModalBodyLock } from '../../hooks/useBodyScrollLock';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { AttributeRoutesGuideContent } from './AttributeRoutesGuideContent';
import {
  GUIDE_TAB_LABELS,
  type GuideTabId,
  openSoloTutorial,
} from './guideNavigation';
import { InjuryMoraleGuideContent } from './InjuryMoraleGuideContent';

const TABS: { id: GuideTabId; num: string; label: string }[] = [
  { id: 'budget', num: '1', label: GUIDE_TAB_LABELS.budget },
  { id: 'tactics', num: '2', label: GUIDE_TAB_LABELS.tactics },
  { id: 'squad', num: '3', label: GUIDE_TAB_LABELS.squad },
  { id: 'transfer', num: '4', label: GUIDE_TAB_LABELS.transfer },
  { id: 'match', num: '5', label: GUIDE_TAB_LABELS.match },
  { id: 'legacy', num: '6', label: GUIDE_TAB_LABELS.legacy },
];

const TAB_SECTIONS: Record<GuideTabId, { id: string; label: string }[]> = {
  budget: [
    { id: 'guide-budget-draft', label: '3구단 룰렛·자유 벤치' },
    { id: 'guide-budget-cost', label: 'OVR 몸값·레전드 고정가' },
    { id: 'guide-budget-ffp', label: 'FFP 1·2단계 제재' },
    { id: 'guide-budget-cash', label: '이월 현금 협상' },
  ],
  tactics: [
    { id: 'guide-tactics-5zone', label: '5대 전술·5구역 상성' },
    { id: 'guide-tactics-formations', label: '9종 포메이션' },
    { id: 'guide-tactics-exposure', label: '8경기 노출도·경고' },
    { id: 'guide-tactics-impact', label: 'AI 등급별 파훼 타격' },
  ],
  squad: [
    { id: 'guide-squad-position', label: '포지션 적합도' },
    { id: 'guide-squad-chemistry', label: '4색 시너지·팀 케미' },
    { id: 'guide-squad-managers', label: '14종 감독 특성' },
    { id: 'guide-squad-awakening', label: '영구 포텐 각성' },
  ],
  transfer: [
    { id: 'guide-transfer-rules', label: '트레이드·니즈·통합세' },
    { id: 'guide-transfer-coaches', label: '수석 코치 12종 도감' },
  ],
  match: [
    { id: 'guide-match-broadcast', label: '2D 중계·자동진행' },
    { id: 'guide-match-condition', label: '체력·부상·사기' },
    { id: 'guide-match-attributes', label: '세부 능력치·공격 루트' },
  ],
  legacy: [
    { id: 'guide-legacy-competitions', label: '5대 리그·컵·UCL' },
    { id: 'guide-legacy-hof', label: '명전·글로벌 TOP 15' },
    { id: 'guide-legacy-reset', label: 'v9.0 기록 초기화' },
    { id: 'guide-legacy-multi', label: '멀티 리그·1대1' },
  ],
};

function jumpToGuideSection(sectionId: string): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function SystemGuideContent({
  initialTab = 'budget',
}: {
  initialTab?: GuideTabId;
}) {
  const [tab, setTab] = useState<GuideTabId>(initialTab);

  const builderTraits = MANAGER_TRAIT_LIST.filter(
    (t) => t.category === 'builder',
  );
  const specialistTraits = MANAGER_TRAIT_LIST.filter(
    (t) => t.category === 'specialist',
  );

  const baseLegendPct = (DEFAULT_ROULETTE_LEGEND_RATE * 100).toFixed(1);
  const transferLegendPct = (TRANSFER_ROULETTE_LEGEND_RATE * 100).toFixed(1);
  const clubCount = ALL_CLUBS_WITH_LEAGUE.length;
  const historicalCount = HISTORICAL_BENCHMARK_TEAMS.length;
  const uclExtCount = UCL_EXTERNAL_TEAMS.length;
  const tier1UpperM = Math.floor(
    DRAFT_BUDGET_CAP_M * (1 + FFP_TIER1_MAX_EXCESS_RATIO),
  );
  const jumpSections = TAB_SECTIONS[tab];

  return (
    <div className="space-y-3.5 break-keep">
      {/* Primary Play-Flow Tabs */}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6 rounded-xl border border-slate-800 bg-[#0b1018] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
              tab === t.id
                ? 'bg-slate-800 text-white border-emerald-500/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="mr-1 font-mono text-[10px] text-emerald-400/90">
              {t.num}.
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Quick Section Jump Chips */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800/80 bg-[#0a0f17] px-2.5 py-2">
        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap mr-0.5">
          바로가기
        </span>
        {jumpSections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => jumpToGuideSection(sec.id)}
            className="rounded-md border border-slate-700/80 bg-slate-900/90 px-2 py-1 text-[10.5px] font-semibold text-slate-300 hover:border-emerald-400/50 hover:text-emerald-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            #{sec.label}
          </button>
        ))}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: 예산·FFP (Draft, Cost Curve, FFP 1/2, Carry-Over Cash)         */}
      {/* ===================================================================== */}
      {tab === 'budget' && (
        <div className="space-y-3.5 pb-2 text-xs leading-relaxed text-slate-300">
          {/* 1-1. Roulette Draft & Free Bench */}
          <div
            id="guide-budget-draft"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                3구단 룰렛 드래프트 (16인) &amp; 자유 벤치
              </div>
              <span className="rounded bg-amber-500/15 border border-amber-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300 whitespace-nowrap">
                {clubCount}구단 · 구단당 {CANDIDATES_PER_REEL}명
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[11px]">
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5">
                <div className="font-bold text-slate-100">룰렛 &amp; 프리뷰</div>
                <div className="mt-1 text-slate-400">
                  매 픽 3구단(멀티 3~4인 시 4구단) 출현 · 후보 1회 클릭으로 피치
                  시너지·예산 변화 즉시 프리뷰
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-2.5">
                <div className="font-bold text-amber-300">황금 [LEGEND] 확률</div>
                <div className="mt-1 font-mono text-slate-200 tabular-nums">
                  드래프트 {baseLegendPct}% · 이적시장 {transferLegendPct}% 고정 (순위 무관)
                </div>
              </div>
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/15 p-2.5">
                <div className="font-bold text-emerald-300">드래프트 후 자유 벤치</div>
                <div className="mt-1 text-slate-400">
                  완료 후 벤치 5칸 포지션 제약 해제 · 클릭/드래그 스왑 &amp;{' '}
                  <strong className="text-white">[빠른 선발]</strong> 지원
                </div>
              </div>
            </div>
          </div>

          {/* 1-2. Progressive OVR Cost vs Legend Flat Price */}
          <div
            id="guide-budget-cost"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                예산 소프트 캡 €{DRAFT_BUDGET_CAP_M}M &amp; OVR 누진 몸값
              </div>
              <span className="rounded bg-amber-500/15 border border-amber-400/40 px-2 py-0.5 font-mono text-[10px] font-black text-amber-200 whitespace-nowrap">
                레전드 전원 €{LEGEND_FLAT_DRAFT_COST_M}M 균일가
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-[10.5px] tabular-nums">
              {(
                [
                  ['OVR 78', computePlayerDraftCostM({ ovr: 78, isLegend: false }), false],
                  ['OVR 82', computePlayerDraftCostM({ ovr: 82, isLegend: false }), false],
                  ['OVR 85', computePlayerDraftCostM({ ovr: 85, isLegend: false }), false],
                  ['OVR 88', computePlayerDraftCostM({ ovr: 88, isLegend: false }), false],
                  ['OVR 90', computePlayerDraftCostM({ ovr: 90, isLegend: false }), false],
                  ['레전드 균일', LEGEND_FLAT_DRAFT_COST_M, true],
                ] as [string, number, boolean][]
              ).map(([label, cost, isLeg]) => (
                <div
                  key={label}
                  className={`rounded-lg border px-2 py-1.5 ${
                    isLeg
                      ? 'border-amber-400/55 bg-amber-950/30'
                      : 'border-slate-800 bg-[#0f1622]'
                  }`}
                >
                  <div
                    className={`text-[9.5px] font-bold whitespace-nowrap ${
                      isLeg ? 'text-amber-200' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </div>
                  <div
                    className={`font-mono font-black ${
                      isLeg ? 'text-amber-300' : 'text-white'
                    }`}
                  >
                    €{cost}M
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-[#0f1622] px-3 py-2 text-[11px] tabular-nums">
              <span className="text-slate-300">
                현역 슈퍼스타(91~94):{' '}
                <strong className="text-cyan-300">
                  €{computePlayerDraftCostM({ ovr: 91, isLegend: false })}M / €
                  {computePlayerDraftCostM({ ovr: 92, isLegend: false })}M / €
                  {computePlayerDraftCostM({ ovr: 93, isLegend: false })}M / €
                  {computePlayerDraftCostM({ ovr: 94, isLegend: false })}M
                </strong>
              </span>
              <span className="text-amber-200/90 font-semibold">
                레전드 1명+알짜 주전은 예산 내 가능 · 다수 수집 시 FFP 압박
              </span>
            </div>
          </div>

          {/* 1-3. FFP 3-Tier Comparison Table */}
          <div
            id="guide-budget-ffp"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Shield className="w-4 h-4 text-rose-400 shrink-0" />
                FFP 1·2단계 제재 기준표
              </div>
              <span className="rounded bg-rose-500/15 border border-rose-400/35 px-2 py-0.5 text-[10px] font-bold text-rose-200 whitespace-nowrap">
                초과 시 개막 재정 감사 팝업 1회 통지
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-[11px] tabular-nums">
                <thead className="bg-[#111927] text-slate-400">
                  <tr>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">구간</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">지출 기준</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">이적 제한</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">케미 · 사기</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">최종 점수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-[#0a1019]">
                  <tr>
                    <td className="px-2.5 py-2 font-black text-emerald-300 whitespace-nowrap">
                      예산 준수
                    </td>
                    <td className="px-2.5 py-2 text-slate-200 whitespace-nowrap">
                      €{DRAFT_BUDGET_CAP_M}M 이하
                    </td>
                    <td className="px-2.5 py-2 text-emerald-200 whitespace-nowrap">
                      1·2·3차 각 {ATTEMPTS_PER_WINDOW}회 · UCL {FFP_UCL_SPECIAL_MAX_ATTEMPTS}회
                    </td>
                    <td className="px-2.5 py-2 text-slate-300 whitespace-nowrap">
                      페널티 없음 · 잔액 100% 이월
                    </td>
                    <td className="px-2.5 py-2 font-bold text-emerald-300 whitespace-nowrap">
                      ×1.00 (0%)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-2 font-black text-amber-300 whitespace-nowrap">
                      FFP 1단계
                    </td>
                    <td className="px-2.5 py-2 text-slate-200 whitespace-nowrap">
                      +1~{FFP_TIER1_MAX_OVERRUN_PCT}% (€{DRAFT_BUDGET_CAP_M + 1}~{tier1UpperM}M)
                    </td>
                    <td className="px-2.5 py-2 text-amber-200 whitespace-nowrap">
                      1차 {FFP_TIER1_WINDOW1_MAX_ATTEMPTS}회 · 2차 {FFP_TIER1_WINDOW2_MAX_ATTEMPTS}회 · 3차 {FFP_TIER1_WINDOW3_MAX_ATTEMPTS}회 · UCL {FFP_UCL_SPECIAL_MAX_ATTEMPTS}회
                    </td>
                    <td className="px-2.5 py-2 text-amber-200 whitespace-nowrap">
                      케미 -{FFP_TIER1_CHEM_PENALTY} · 패배 사기 -{FFP_TIER1_LOSS_MORALE_EXTRA}
                    </td>
                    <td className="px-2.5 py-2 font-black text-amber-300 whitespace-nowrap">
                      -{FFP_TIER1_SCORE_PENALTY_PCT}% 감점
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-2 font-black text-rose-300 whitespace-nowrap">
                      FFP 2단계
                    </td>
                    <td className="px-2.5 py-2 text-slate-200 whitespace-nowrap">
                      +{FFP_TIER1_MAX_OVERRUN_PCT}% 초과 (€{tier1UpperM + 1}M+)
                    </td>
                    <td className="px-2.5 py-2 font-bold text-rose-200 whitespace-nowrap">
                      1차 동결({FFP_TIER2_WINDOW1_MAX_ATTEMPTS}회) · 2차 {FFP_TIER2_WINDOW2_MAX_ATTEMPTS}회 · 3차 동결({FFP_TIER2_WINDOW3_MAX_ATTEMPTS}회) · UCL {FFP_UCL_SPECIAL_MAX_ATTEMPTS}회
                    </td>
                    <td className="px-2.5 py-2 font-bold text-rose-200 whitespace-nowrap">
                      케미 -{FFP_TIER2_CHEM_PENALTY} · 패배 사기 -{FFP_TIER2_LOSS_MORALE_EXTRA}
                    </td>
                    <td className="px-2.5 py-2 font-black text-rose-300 whitespace-nowrap">
                      -{FFP_TIER2_SCORE_PENALTY_PCT}% 감점
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-[10.5px] text-slate-400">
              • FFP 1·2단계 모두 이월 이적 자금은 <strong className="text-slate-200">€0M</strong>이며,
              <strong className="text-sky-300">UCL 특별 이적시장({FFP_UCL_SPECIAL_MAX_ATTEMPTS}회)</strong> 및
              2차 이적시장 <strong className="text-emerald-300">수석 코치 1명 선임</strong>은 FFP와 무관하게 정상 허용됩니다.
            </div>
          </div>

          {/* 1-4. Carry-over Cash */}
          <div
            id="guide-budget-cash"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5"
          >
            <div className="flex items-center gap-1.5 font-bold text-white mb-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              잔여 예산 100% 이월 &amp; 이적시장 현금 협상
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[11px] tabular-nums">
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/15 p-2.5">
                <div className="font-bold text-emerald-300">트레이드 TP 환산</div>
                <div className="mt-0.5 text-slate-200">
                  €{CASH_TO_TP_SOFT_CAP_M}M 이하: €1M = +{CASH_TO_TP_RATE} TP
                </div>
                <div className="text-[10px] text-slate-400">
                  초과분 +{CASH_TO_TP_OVER_CAP_RATE} TP · 통합세 면제
                </div>
              </div>
              <div className="rounded-lg border border-sky-500/25 bg-sky-950/15 p-2.5">
                <div className="font-bold text-sky-300">슈퍼스타 가드 완화</div>
                <div className="mt-0.5 text-slate-200">
                  현금 €{CASH_STAR_GUARD_RELIEF_THRESHOLD_M}M+ 추가 시
                </div>
                <div className="text-[10px] text-slate-400">
                  OVR 87+ 핵심 자산(OVR-7) 하한 1 완화
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/25 bg-amber-950/15 p-2.5">
                <div className="font-bold text-amber-300">레전드 FA 협상</div>
                <div className="mt-0.5 text-slate-200">
                  €10M당 +{CASH_LEGEND_CHANCE_PER_10M}%p
                </div>
                <div className="text-[10px] text-slate-400">
                  최대 +{CASH_LEGEND_CHANCE_MAX_BONUS}%p 성사 확률 가산
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: 전술·파훼 (5 Tactics, 9 Formations, 8-Match Adaptation, Impact)*/}
      {/* ===================================================================== */}
      {tab === 'tactics' && (
        <div className="space-y-3.5 pb-2 text-xs leading-relaxed text-slate-300">
          {/* 2-1. 5 Tactics & 5-Zone Matchup */}
          <div
            id="guide-tactics-5zone"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Compass className="w-4 h-4 text-sky-400 shrink-0" />
                5대 팀 전술 &amp; 5구역 실시간 상성
              </div>
              <span className="rounded bg-sky-500/15 border border-sky-400/35 px-2 py-0.5 text-[10px] font-bold text-sky-300 whitespace-nowrap">
                중원 · 측면 · 전환 · 박스 · 압박
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-[11px] tabular-nums">
                <thead className="bg-[#111927] text-slate-400">
                  <tr>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">전술</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">강점 상성</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">약점 상성</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">점유</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">특징</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-[#0a1019]">
                  {TACTIC_LIST.map((t) => (
                    <tr key={t.id}>
                      <td className="px-2.5 py-2 font-black text-white whitespace-nowrap">
                        {t.name}
                      </td>
                      <td className="px-2.5 py-2 text-emerald-300 whitespace-nowrap">
                        {t.strongAgainst}
                      </td>
                      <td className="px-2.5 py-2 text-rose-300 whitespace-nowrap">
                        {t.weakAgainst}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-sky-300 whitespace-nowrap">
                        {t.possessionMod >= 0
                          ? `+${t.possessionMod}%`
                          : `${t.possessionMod}%`}
                      </td>
                      <td className="px-2.5 py-2 text-slate-400">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2-2. 9 Formations */}
          <div
            id="guide-tactics-formations"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                {FORMATION_LIST.length}종 포메이션 &amp; 전술 완성도
              </div>
              <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                빌드업 · 수비 · 전환 3단 변형
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              {FORMATION_LIST.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-slate-800 bg-[#0f1622] px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-black text-white">
                      {f.name}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-300 whitespace-nowrap">
                      {f.shortTag}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-slate-400">
                    {f.description}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2-3. 8-Match Exposure Tempo & Danger-Only Alert */}
          <div
            id="guide-tactics-exposure"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Eye className="w-4 h-4 text-rose-400 shrink-0" />
                최근 {ADAPTATION_HISTORY_WINDOW}경기 전술 노출도 &amp; 경고 규칙
              </div>
              <span className="rounded bg-teal-500/15 border border-teal-400/35 px-2 py-0.5 text-[10px] font-bold text-teal-200 whitespace-nowrap">
                전술 분석 코치 -{Math.round(COACH_ADAPTATION_MITIGATION * 100)}% 완화
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] tabular-nums">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2.5">
                <div className="font-black text-emerald-300">
                  낮음 (0~{EXPOSURE_WARNING_THRESHOLD - 1})
                </div>
                <div className="text-slate-300 mt-0.5">1~4경기 연속</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  파훼 없음 · 정상 경기 진행
                </div>
              </div>
              <div className="rounded-lg border border-amber-400/35 bg-amber-950/15 p-2.5">
                <div className="font-black text-amber-300">
                  주의 ({EXPOSURE_WARNING_THRESHOLD}~{EXPOSURE_DANGER_THRESHOLD - 1})
                </div>
                <div className="text-slate-300 mt-0.5">5~7경기 연속</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  전술실 배지만 표시(팝업 없음) · 일부 맞춤 대응 시작
                </div>
              </div>
              <div className="rounded-lg border border-rose-500/45 bg-rose-950/20 p-2.5">
                <div className="font-black text-rose-300">
                  파훼 경계 ({EXPOSURE_DANGER_THRESHOLD}+)
                </div>
                <div className="text-slate-300 mt-0.5">약 {ADAPTATION_HISTORY_WINDOW}경기 연속</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  스카우팅 팝업 1회 발동 · 변주 해제 후 재진입 시 재무장
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0f1622] px-3 py-2 text-[11px] text-slate-300">
              포메이션 또는 팀 전술 중 <strong className="text-emerald-300">1가지만 변주</strong>해도
              노출도가 즉시 완화되어 파훼 타격을 피할 수 있습니다.
            </div>
          </div>

          {/* 2-4. AI Tiered Counter Impact */}
          <div
            id="guide-tactics-impact"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Swords className="w-4 h-4 text-rose-400 shrink-0" />
                AI 감독 등급별 파훼 타격 (전술 변주 필수)
              </div>
              <span className="rounded bg-rose-500/15 border border-rose-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-200 whitespace-nowrap">
                명장 기준 OVR {ELITE_AI_COUNTER_OVR_THRESHOLD}+
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-[11px] tabular-nums">
                <thead className="bg-[#111927] text-slate-400">
                  <tr>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">AI 감독 등급</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">대응 수준</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">카운터 전술 전환</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">최대 파훼 타격</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-[#0a1019]">
                  <tr>
                    <td className="px-2.5 py-2 font-bold text-slate-300 whitespace-nowrap">
                      하위권 (OVR ≤80)
                    </td>
                    <td className="px-2.5 py-2 text-slate-400 whitespace-nowrap">제한적</td>
                    <td className="px-2.5 py-2 text-slate-400 whitespace-nowrap">6~24% (낮음)</td>
                    <td className="px-2.5 py-2 text-slate-400">
                      경미한 라인 감점 · 전력 우세 시 돌파 가능
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-2 font-bold text-amber-200 whitespace-nowrap">
                      중상위권 (OVR 81~84)
                    </td>
                    <td className="px-2.5 py-2 text-amber-300 whitespace-nowrap">맞춤 대응</td>
                    <td className="px-2.5 py-2 text-amber-200 whitespace-nowrap">28~74%</td>
                    <td className="px-2.5 py-2 text-slate-300">
                      실효 라인 약 -1.3~-1.8 · 찬스/점유 점진 압박
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-2 font-black text-rose-300 whitespace-nowrap">
                      상위권·명장 (OVR {ELITE_AI_COUNTER_OVR_THRESHOLD}+)
                    </td>
                    <td className="px-2.5 py-2 font-black text-rose-300 whitespace-nowrap">
                      정밀 파훼
                    </td>
                    <td className="px-2.5 py-2 font-bold text-rose-200 whitespace-nowrap">
                      72~98% (킥오프·전반 18&apos;~28&apos;)
                    </td>
                    <td className="px-2.5 py-2 text-rose-100">
                      실효 A-{ADAPTATION_MAX_ATT_PENALTY} / M-{ADAPTATION_MAX_MID_PENALTY} / D-
                      {ADAPTATION_MAX_DEF_PENALTY} · 상성 -{ADAPTATION_MAX_MATCHUP_OVR_PENALTY} ·
                      점유 -{ADAPTATION_MAX_POSSESSION_PENALTY}% · xG +{ADAPTATION_MAX_AI_XG_BONUS}/-
                      {ADAPTATION_MAX_USER_XG_PENALTY} · 수비억제 {ADAPTATION_MAX_AI_OPP_XG_PENALTY}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-[10.5px] text-slate-400">
              • 2D 중계에서도 파훼 발동 시 상대 AI의 압박 반경·라인 규율·역습 가속이 즉시 상승하고,
              상단 <strong className="text-rose-200">[전술 파훼 발동]</strong> 배너와 경기 리포트에 기록됩니다.
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: 스쿼드·각성 (Position Fit, Chemistry/Synergy, 14 Managers, Awakening) */}
      {/* ===================================================================== */}
      {tab === 'squad' && (
        <div className="space-y-3.5 pb-2 text-xs leading-relaxed text-slate-300">
          {/* 3-1. Position Fit */}
          <div
            id="guide-squad-position"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                복수 주포지션 &amp; 적합도 페널티
              </div>
              <span className="rounded bg-cyan-500/15 border border-cyan-400/35 px-2 py-0.5 text-[10px] font-bold text-cyan-300 whitespace-nowrap">
                토탈 풋볼 감독 시 0 / -2 / -8 완화
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] tabular-nums">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2.5">
                <div className="font-black text-emerald-300">주포지션 · 0</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  복수 주포지션 모두 100%
                </div>
              </div>
              <div className="rounded-lg border border-amber-400/30 bg-amber-950/15 p-2.5">
                <div className="font-black text-amber-300">부포지션 · -3</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  호환 쌍 포함 (토탈 0)
                </div>
              </div>
              <div className="rounded-lg border border-orange-500/30 bg-orange-950/15 p-2.5">
                <div className="font-black text-orange-300">같은 라인 · -6</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  예: CB→LB (토탈 -2)
                </div>
              </div>
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/15 p-2.5">
                <div className="font-black text-rose-300">다른 라인 · -15</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  필드 토탈 -8 (GK 유지)
                </div>
              </div>
            </div>
          </div>

          {/* 3-2. 4-Color Synergy & Team Chemistry (0~100) */}
          <div
            id="guide-squad-chemistry"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                4색 시너지 연결선 &amp; 팀 케미 (0~100) 구조
              </div>
              <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                인접 +3 + 감독 ★+1 = 최대 +4
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] tabular-nums">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2.5">
                <div className="font-bold text-emerald-300">🟢 구단·전소속</div>
                <div className="text-[10.5px] text-slate-300 mt-0.5">
                  개인 1선 · 케미 가중 ×{TEAM_CHEMISTRY_LINE_WEIGHTS.club}
                </div>
              </div>
              <div className="rounded-lg border border-sky-500/30 bg-sky-950/15 p-2.5">
                <div className="font-bold text-sky-300">🔵 같은 국적</div>
                <div className="text-[10.5px] text-slate-300 mt-0.5">
                  개인 1선 · 케미 가중 ×{TEAM_CHEMISTRY_LINE_WEIGHTS.nation.toFixed(1)}
                </div>
              </div>
              <div className="rounded-lg border border-amber-400/30 bg-amber-950/15 p-2.5">
                <div className="font-bold text-amber-300">
                  🟡 스타일 ({COMPLEMENTARY_STYLE_PAIRS.length}쌍)
                </div>
                <div className="text-[10.5px] text-slate-300 mt-0.5">
                  개인 1선 · 케미 가중 ×{TEAM_CHEMISTRY_LINE_WEIGHTS.style.toFixed(1)}
                </div>
              </div>
              <div className="rounded-lg border border-purple-400/30 bg-purple-950/15 p-2.5">
                <div className="font-bold text-purple-300">
                  🟣 엘리트 {ELITE_PAIR_MIN_OVR}+
                </div>
                <div className="text-[10.5px] text-slate-300 mt-0.5">
                  개인 1선 · 케미 가중 ×{TEAM_CHEMISTRY_LINE_WEIGHTS.elite}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] tabular-nums">
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] px-3 py-2">
                <span className="font-bold text-slate-200">개인 시너지 단계: </span>
                <span className="text-emerald-300 font-mono font-bold">
                  2선 +1 / 4선 +2 / 8선 +3
                </span>
                <span className="text-slate-400"> (+ 감독 궁합 ★+1 별도 합산)</span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] px-3 py-2">
                <span className="font-bold text-slate-200">팀 케미 보정: </span>
                <span className="text-sky-300 font-mono font-bold">
                  {TEAM_CHEMISTRY_NEUTRAL_SCORE}점 기준 ({TEAM_CHEMISTRY_MIN_BONUS}~+
                  {TEAM_CHEMISTRY_MAX_RAW_BONUS})
                </span>
                <span className="text-slate-400">
                  {' '}· 중복 차감(×{TEAM_CHEMISTRY_SYNERGY_DEDUCT_RATIO}) 후 조직력 최대 +
                  {TEAM_CHEMISTRY_ORG_BONUS_CAP}
                </span>
              </div>
            </div>
          </div>

          {/* 3-3. 14 Manager Traits */}
          <div
            id="guide-squad-managers"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Users className="w-4 h-4 text-amber-400 shrink-0" />
                {MANAGER_TRAIT_LIST.length}종 감독 특성 도감
              </div>
              <span className="rounded bg-amber-500/15 border border-amber-400/35 px-2 py-0.5 text-[10px] font-bold text-amber-200 whitespace-nowrap">
                빌드업·전술형 {builderTraits.length}종 · 스페셜리스트 {specialistTraits.length}종
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {MANAGER_TRAIT_LIST.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-slate-800 bg-[#0f1622] px-2.5 py-2 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-black text-white">{m.name}</span>
                      <span
                        className={`rounded px-1.5 py-px text-[9.5px] font-bold whitespace-nowrap ${
                          m.category === 'builder'
                            ? 'bg-sky-500/15 text-sky-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {m.category === 'builder' ? '빌드업·전술' : '스페셜리스트'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400">
                      {m.effectSummary}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3-4. Permanent Potential Awakening */}
          <div
            id="guide-squad-awakening"
            className="scroll-mt-2 rounded-xl border border-rose-500/30 bg-[#120d12] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Flame className="w-4 h-4 text-rose-400 shrink-0" />
                선수 포텐 폭발 (영구 각성 · Crimson Ember)
              </div>
              <span className="rounded bg-rose-500/20 border border-rose-400/40 px-2 py-0.5 text-[10px] font-black text-rose-200 whitespace-nowrap">
                시즌 0~2명 중심 · 레전드 0%
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-rose-500/25 bg-[#191116] p-2.5 space-y-1">
                <div className="font-bold text-rose-200">실제 활약 반영 요소</div>
                <div className="text-[10.5px] text-slate-300">
                  경기 평점(7.4+ · 8.1+/8.5+ 급상승) · 골/도움/GK·DF 무실점 ·
                  출전시간(45&apos;+, 풀타임 우대) · 시즌 누적 평점 및 공격포인트/클린시트 비율
                  ({AWAKENING_MIN_SEASON_MATCH}경기·개인 {AWAKENING_MIN_APPEARANCES}출전 이후)
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/25 bg-[#191511] p-2.5 space-y-1">
                <div className="font-bold text-amber-200">기용 완성도 반영 요소</div>
                <div className="text-[10.5px] text-slate-300">
                  인접 시너지(2~3+ 우대, 0선 감쇠) · 감독 궁합(★ 우대) · 사기(높을수록 상승) ·
                  컨디션·로테이션 관리(혹사·부상 시 급감) · 주포지션 적합도(0 우대, 비적합 급감)
                </div>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-rose-500/25">
              <table className="w-full text-left text-[11px] tabular-nums">
                <thead className="bg-[#1b1116] text-rose-200/80">
                  <tr>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">대상 등급</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">확률 배율</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">영구 상승폭</th>
                    <th className="px-2.5 py-1.5 font-bold whitespace-nowrap">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-500/15 bg-[#110c10]">
                  <tr>
                    <td className="px-2.5 py-1.5 font-bold text-white whitespace-nowrap">
                      일반 현역 (OVR ≤{AWAKENING_SUPERSTAR_OVR_THRESHOLD - 1})
                    </td>
                    <td className="px-2.5 py-1.5 text-emerald-300 font-mono whitespace-nowrap">
                      ×1.00 (기준)
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-rose-200 whitespace-nowrap">
                      +{AWAKENING_MIN_GAIN}~+{AWAKENING_MAX_GAIN} OVR
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-400">
                      낮은 OVR 유망주일수록 상승 천장 넓음
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 font-bold text-cyan-200 whitespace-nowrap">
                      슈퍼스타 (OVR {AWAKENING_SUPERSTAR_OVR_THRESHOLD}+)
                    </td>
                    <td className="px-2.5 py-1.5 text-amber-300 font-mono whitespace-nowrap">
                      ×{AWAKENING_SUPERSTAR_RATE_MULT} (1/25)
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-cyan-200 whitespace-nowrap">
                      최대 +{AWAKENING_SUPERSTAR_MAX_GAIN} (상한 {AWAKENING_OVR_HARD_CAP})
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-400">
                      극희박 발동 · 상승폭 엄격 제한
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 font-bold text-amber-300 whitespace-nowrap">
                      레전드
                    </td>
                    <td className="px-2.5 py-1.5 text-rose-400 font-mono font-bold whitespace-nowrap">
                      0% (제외)
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-500 whitespace-nowrap">-</td>
                    <td className="px-2.5 py-1.5 text-slate-400">
                      레전드는 각성하지 않음
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-400 tabular-nums">
              <span>
                시즌 누적 감쇠:{' '}
                <strong className="text-slate-200">1명째 ×1.00</strong> →{' '}
                <strong className="text-amber-200">
                  2명째 ×{AWAKENING_SECOND_COUNT_MULT}
                </strong>{' '}
                →{' '}
                <strong className="text-rose-300">
                  3명째+ ×{AWAKENING_THIRD_PLUS_MULT} (극소화)
                </strong>
              </span>
              <span>정적 DB 무오염 · 세이브·명전·글로벌 TOP 15 영구 보존</span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: 이적·코치 (Transfer Market TP/Needs/Tax + 12 Staff Coaches)    */}
      {/* ===================================================================== */}
      {tab === 'transfer' && (
        <div className="space-y-3.5 pb-2 text-xs leading-relaxed text-slate-300">
          {/* 4-1. Transfer Market Rules */}
          <div
            id="guide-transfer-rules"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <ArrowLeftRight className="w-4 h-4 text-sky-400 shrink-0" />
                NBA 패키지 트레이드 · 구단 니즈 · 통합세
              </div>
              <span className="rounded bg-sky-500/15 border border-sky-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300 whitespace-nowrap">
                기본 {ATTEMPTS_PER_WINDOW}회/창 · 1:1~3:1 패키지
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5 space-y-1">
                <div className="font-bold text-white">구단 니즈 &amp; 급매 보정</div>
                <div className="text-slate-300">
                  • 최우선 니즈 <strong className="text-rose-300">🔥 +32% · +8%p</strong> / 보강{' '}
                  <strong className="text-amber-300">✨ +18% · +4%p</strong> / 포화{' '}
                  <strong className="text-slate-400">-25% · -10%p</strong>
                </div>
                <div className="text-slate-300">
                  • 프런트 급매 <strong className="text-emerald-300">🚨 -35% · +12%p</strong> (슈퍼스타 가드 면제)
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5 space-y-1">
                <div className="font-bold text-white">다인 통합세 &amp; 슈퍼스타 가드</div>
                <div className="text-slate-300">
                  • 다인 패키지 2·3번째 선수 가치{' '}
                  <strong className="text-sky-300">100% / 78% / 60%</strong> (상대 니즈 시 +15% 완화)
                </div>
                <div className="text-slate-300">
                  • OVR 87+ 영입 시 대상 OVR-7 핵심 자산 필요 (현금 €
                  {CASH_STAR_GUARD_RELIEF_THRESHOLD_M}M+ 시 1 완화)
                </div>
              </div>
            </div>
            <div className="text-[10.5px] text-slate-400 space-y-1">
              <div>
                • FFP 1단계(1·2·3차 각 {FFP_TIER1_WINDOW1_MAX_ATTEMPTS}회) /
                2단계(1·3차 동결 · 2차 {FFP_TIER2_WINDOW2_MAX_ATTEMPTS}회) 제한이 싱글·멀티리그 동일 적용되며(UCL 특별 {FFP_UCL_SPECIAL_MAX_ATTEMPTS}회 정상),
                로스터 16인·GK 최소 1명 규칙이 항상 유지됩니다.
              </div>
              <div>
                • 리그 순위가 높을수록 타 구단의 AI 영입 제안 수신 확률·건수가 증가합니다 (1위 최소 2건·2~4위 최소 1건 보장 / 이적시장 룰렛 레전드 확률은 순위 무관 {transferLegendPct}% 고정).
              </div>
            </div>
          </div>

          {/* 4-2. 12 Staff Coaches Catalog */}
          <div
            id="guide-transfer-coaches"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                반환점 수석 코치 {STAFF_COACH_LIST.length}종 전체 도감
              </div>
              <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                2차 이적시장 분야별 1명씩 3명 추천 → 1명 선임
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] tabular-nums">
              <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-bold text-sky-200 whitespace-nowrap">
                전술 특화(5종): 해당 전술 A/M/D +{STAFF_COACH_TACTIC_OVR_LIFT} · 상성 ×{STAFF_COACH_TACTIC_MATCHUP_MULT}
              </span>
              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-200 whitespace-nowrap">
                라인 강화(3종): 전담 라인 +{STAFF_COACH_LINE_LIFT} · 케미 +{STAFF_COACH_CHEM_LIFT}
              </span>
              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-200 whitespace-nowrap">
                시스템(4종): 노출 -{Math.round(COACH_ADAPTATION_MITIGATION * 100)}% · 후반 체력 -{Math.round(STAFF_COACH_LATE_STAMINA_REDUCTION * 100)}% · 교체 +{STAFF_COACH_SUB_OVR_LIFT}(합산 상한 {STAFF_COACH_SUB_COMBINED_CAP}) · ≤{STAFF_COACH_DEV_MAX_BASE_OVR} +{STAFF_COACH_DEV_OVR_LIFT}/각성 ×{STAFF_COACH_DEV_AWAKENING_MULT}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {STAFF_COACH_LIST.map((coach) => (
                <div
                  key={coach.id}
                  className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5 flex items-center gap-2.5"
                >
                  <div className="flex h-12 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#090d13] overflow-hidden">
                    <PixelManagerAvatar
                      avatar={coach.avatar}
                      clubPrimaryColor={coach.clubPrimaryColor}
                      clubSecondaryColor={coach.clubSecondaryColor}
                      size={36}
                      pose="default"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black text-white truncate">
                        {coach.name}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-px text-[9px] font-bold text-slate-300 whitespace-nowrap">
                        {STAFF_COACH_CATEGORY_LABELS[coach.category]}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-emerald-300 mt-0.5">
                      {coach.shortBadge}
                    </div>
                    {coach.tacticId && (
                      <div className="text-[9.5px] text-sky-300/90">
                        대상: {TACTICS[coach.tacticId]?.name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: 경기·컨디션 (2D Broadcast, Condition/Morale/Injury, Attributes) */}
      {/* ===================================================================== */}
      {tab === 'match' && (
        <div className="space-y-4 pb-2 text-xs leading-relaxed text-slate-300">
          {/* 5-1. 2D Broadcast & Live Auto-Progress */}
          <div
            id="guide-match-broadcast"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Radio className="w-4 h-4 text-sky-400 shrink-0" />
                2D 리얼리스틱 중계 &amp; 라이브 자동진행
              </div>
              <span className="rounded bg-sky-500/15 border border-sky-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300 whitespace-nowrap">
                교체 최대 {MAX_MATCH_SUBS}명 · 1x/2x/4x
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5">
                <div className="font-bold text-white">직접 2D 지휘</div>
                <div className="mt-0.5 text-slate-400">
                  하프타임(45&apos;) 수싸움 · 최대 {MAX_MATCH_SUBS}명 교체 ·
                  후반·연장 막판 긴박도 AI 및 6야드 세컨찬스/혼전 연출
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5">
                <div className="font-bold text-sky-300">라이브 자동진행</div>
                <div className="mt-0.5 text-slate-400">
                  5·7·9초 템포 · 일시정지 후 [2D 경기 중계 입장]으로 멈춘 분
                  그대로 난입 가능 · 컵/이적/부상 시 자동 정지
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5">
                <div className="font-bold text-emerald-300">자동진행 중 전술 수정</div>
                <div className="mt-0.5 text-slate-400">
                  [전술 수정]으로 일시정지 → 변경 후 [수정 확정] 클릭 시 다음
                  경기 즉시 반영·자동 재개
                </div>
              </div>
            </div>
          </div>

          {/* 5-2. Injury, Stamina & Morale (Shared Engine-Synced Module) */}
          <div id="guide-match-condition" className="scroll-mt-2">
            <InjuryMoraleGuideContent />
          </div>

          {/* 5-3. Sub-Attributes & Attack Routes (Shared Engine-Synced Module) */}
          <div id="guide-match-attributes" className="scroll-mt-2">
            <AttributeRoutesGuideContent />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: 명전·멀티 (Competitions, HOF/Global TOP 15, v9.0 Reset, MP)     */}
      {/* ===================================================================== */}
      {tab === 'legacy' && (
        <div className="space-y-3.5 pb-2 text-xs leading-relaxed text-slate-300">
          {/* 6-1. Competitions */}
          <div
            id="guide-legacy-competitions"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2"
          >
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              5대 리그 · 자국 컵 · 36팀 UEFA 챔피언스리그
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] tabular-nums">
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5">
                <div className="font-bold text-emerald-300">5대 리그 (38R / 34R)</div>
                <div className="mt-0.5 text-slate-400">
                  상위 4팀 UCL 진출 · 34R 리그는 환산 승점(PPG×38)으로 공정 평가
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5">
                <div className="font-bold text-rose-300">자국 컵대회</div>
                <div className="mt-0.5 text-slate-400">
                  16강→8강→4강→결승 단판 토너먼트 · 연장/PK 지원
                </div>
              </div>
              <div className="rounded-lg border border-sky-500/30 bg-sky-950/15 p-2.5">
                <div className="font-bold text-sky-300">36팀 UCL (외부 {uclExtCount}팀)</div>
                <div className="mt-0.5 text-slate-400">
                  스위스 8R(1~8위 직행·9~24위 PO) → 홈·원정 토너먼트 · UCL 전용 PK 시각화
                </div>
              </div>
            </div>
          </div>

          {/* 6-2. Hall of Fame & Global TOP 15 */}
          <div
            id="guide-legacy-hof"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                명예의 전당 ({historicalCount}팀) &amp; 글로벌 역대 유저 TOP 15
              </div>
              <span className="rounded bg-amber-500/15 border border-amber-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200 whitespace-nowrap">
                자동 등재 {HOF_AUTO_INDUCTION_MIN_SCORE.toLocaleString()}+ · S+ 7,200+
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] tabular-nums">
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5 space-y-1">
                <div className="font-bold text-white">시즌 스코어 &amp; FFP 감점</div>
                <div className="text-slate-300">
                  리그 환산·순위·컵·UCL·영예(트레블/무패)·언더독·스쿼드 완성도·개인상 8항목 합산.
                  FFP 1단계 <strong className="text-amber-300">-{FFP_TIER1_SCORE_PENALTY_PCT}%</strong> ·
                  2단계 <strong className="text-rose-300">-{FFP_TIER2_SCORE_PENALTY_PCT}%</strong> 감점.
                </div>
              </div>
              <div className="rounded-lg border border-sky-500/25 bg-sky-950/15 p-2.5 space-y-1">
                <div className="font-bold text-sky-300">글로벌 TOP 15 &amp; 1대1 도전</div>
                <div className="text-slate-300">
                  상위 15팀만 원자적 유지(16위 즉시 삭제) · 중복 선수/레전드 상한 검증 ·
                  모든 랭킹 팀과 2D <strong className="text-white">1대1 드림 매치</strong> 가능
                </div>
              </div>
            </div>
          </div>

          {/* 6-3. v9.0 Reset Policy */}
          <div
            id="guide-legacy-reset"
            className="scroll-mt-2 rounded-xl border border-amber-500/30 bg-amber-950/12 p-3.5 space-y-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-amber-200">
                {HOF_RULE_ERA_V9}+ 기록 초기화 및 집계 기준
              </div>
              <span className="rounded border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200 whitespace-nowrap">
                {HOF_RULE_ERA_V9}+ 전용 집계
              </span>
            </div>
            <p className="text-[11px] text-slate-300">{HOF_RESET_NOTICE_TEXT}</p>
            <div className="text-[10.5px] text-slate-400">
              • 로컬 명전은 앱 로드 시 1회성 마이그레이션으로 구버전 기록을 자동 정리하며,
              글로벌 TOP 15는 {HOF_RULE_ERA_V9}+ 마커 기록만 조회·컷오프에 반영합니다(히든 업적·드림매치 전적은 보존).
            </div>
          </div>

          {/* 6-4. Multiplayer League & 1v1 */}
          <div
            id="guide-legacy-multi"
            className="scroll-mt-2 rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                멀티플레이 공유 리그 (2~4인) &amp; 1대1 대결
              </div>
              <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                맞대결 최대 +{MP_H2H_MAX_POINTS.toLocaleString()}점
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5">
                <div className="font-bold text-white">공유 시즌 · 방장 권위형</div>
                <div className="mt-0.5 text-slate-400">
                  균등 순환 룰렛 드래프트 · 전 경기 맞대결 2배속 고정(4인 리그는 2차전 2D 집중) ·
                  예산/FFP·수석 코치·각성 동일 적용
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0f1622] p-2.5">
                <div className="font-bold text-white">결산 2종 &amp; 1대1 블라인드</div>
                <div className="mt-0.5 text-slate-400">
                  친구 순위(시즌 점수 + 맞대결 최대 {MP_H2H_MAX_POINTS.toLocaleString()}) ·
                  역대 강팀 비교(시즌 점수 단독) · 1대1 블라인드 드래프트 별도 지원
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SystemGuideModalProps {
  open?: boolean;
  onClose: () => void;
  initialTab?: GuideTabId;
  onOpenTutorial?: () => void;
}

export function SystemGuideModal({
  open = true,
  onClose,
  initialTab = 'budget',
  onOpenTutorial,
}: SystemGuideModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4"
      onClick={onClose}
    >
      <ModalBodyLock active={open} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="게임 시스템 가이드북"
        onClick={(e) => e.stopPropagation()}
        className="modal-panel flex w-full max-w-4xl max-h-[90dvh] flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#0e141d] shadow-2xl"
      >
        {/* Fixed Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-[#0b1018] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="text-sm sm:text-base font-black text-white truncate">
              시스템 가이드북
            </h2>
            <span className="hidden sm:inline rounded border border-emerald-500/35 bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 whitespace-nowrap">
              엔진 상수 100% 동기화
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (onOpenTutorial) {
                  onOpenTutorial();
                } else {
                  onClose();
                  openSoloTutorial();
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-bold text-sky-200 hover:bg-sky-500/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              입문 튜토리얼
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="가이드 닫기"
              className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Single Scrollable Body */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3.5 sm:p-5">
          <SystemGuideContent key={initialTab} initialTab={initialTab} />
        </div>
      </div>
    </div>
  );
}

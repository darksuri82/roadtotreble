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
  FFP_TIER1_MAX_EXCESS_RATIO,
  FFP_TIER1_MAX_OVERRUN_PCT,
  FFP_TIER1_WINDOW2_MAX_ATTEMPTS,
  FFP_TIER2_SCORE_PENALTY_PCT,
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
  TOP4_TRANSFER_LEGEND_RATE,
} from '../../engine/draftEngine';
import { HOF_AUTO_INDUCTION_MIN_SCORE } from '../../engine/legacyEngine';
import { MP_H2H_MAX_POINTS } from '../../engine/mpLeagueScore';
import {
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
import { TACTIC_LIST, TACTICS } from '../../engine/tacticEngine';
import {
  ADAPTATION_HISTORY_WINDOW,
  COACH_ADAPTATION_MITIGATION,
  ELITE_AI_COUNTER_OVR_THRESHOLD,
  EXPOSURE_DANGER_THRESHOLD,
  EXPOSURE_WARNING_THRESHOLD,
} from '../../engine/tacticalAdaptationEngine';
import {
  ATTEMPTS_PER_WINDOW,
  UCL_CHAMPION_LEGEND_RATE,
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
  { id: 'basics', num: '1', label: GUIDE_TAB_LABELS.basics },
  { id: 'chemistry', num: '2', label: GUIDE_TAB_LABELS.chemistry },
  { id: 'tactics', num: '3', label: GUIDE_TAB_LABELS.tactics },
  { id: 'season', num: '4', label: GUIDE_TAB_LABELS.season },
  { id: 'condition', num: '5', label: GUIDE_TAB_LABELS.condition },
  { id: 'attributes', num: '6', label: GUIDE_TAB_LABELS.attributes },
];

export function SystemGuideContent({
  initialTab = 'basics',
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
  const top4LegendPct = (TOP4_TRANSFER_LEGEND_RATE * 100).toFixed(1);
  const champLegendPct = (UCL_CHAMPION_LEGEND_RATE * 100).toFixed(1);
  const clubCount = ALL_CLUBS_WITH_LEAGUE.length;
  const historicalCount = HISTORICAL_BENCHMARK_TEAMS.length;
  const uclExtCount = UCL_EXTERNAL_TEAMS.length;

  return (
    <div className="space-y-4 break-keep">
      {/* Tab Navigation */}
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

      {/* Tab 1: Positions, Draft, Free Bench & Transfer Market */}
      {tab === 'basics' && (
        <div className="space-y-3.5 pb-2 text-xs leading-relaxed text-slate-300">
          {/* 1-1. Position Fit */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                복수 주포지션 &amp; 실효 OVR 페널티
              </div>
              <span className="rounded bg-slate-800/90 px-2 py-0.5 text-[10px] font-bold text-cyan-300 whitespace-nowrap">
                토탈 풋볼 감독 시 0 / -2 / -8 완화
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              실제 현대 축구에서 여러 포지션을 본업 수준으로 소화하는 선수는{' '}
              <strong className="text-slate-200">주포지션 배열</strong>(예: 음바페{' '}
              <code className="text-emerald-300">ST · LW</code>, 발베르데{' '}
              <code className="text-emerald-300">CM · RB · RW</code>, 말디니{' '}
              <code className="text-emerald-300">LB · CB</code>)로 등록되어
              어느 주포지션 슬롯에 배치해도 100% 능력을 발휘합니다.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2.5">
                <div className="font-bold text-emerald-300">
                  주포지션 배열 일치 · 페널티 0
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  주포지션에 포함된 어느 슬롯에 배치해도 100% 실효 OVR
                </div>
              </div>
              <div className="rounded-lg border border-amber-400/30 bg-amber-950/15 p-2.5">
                <div className="font-bold text-amber-300">
                  부포지션 / 호환 · -3 OVR{' '}
                  <span className="text-cyan-300">(토탈 풋볼 시 0)</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  부포지션 또는 LB↔LWB · RB↔RWB · LW↔LM · RW↔RM 호환 쌍
                </div>
              </div>
              <div className="rounded-lg border border-orange-500/30 bg-orange-950/15 p-2.5">
                <div className="font-bold text-orange-300">
                  같은 라인 비적합 · -6 OVR{' '}
                  <span className="text-cyan-300">(토탈 풋볼 시 -2)</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  예: CB→LB, CDM→CAM, ST→LW 등 동일 라인 내 비적합 배치
                </div>
              </div>
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/15 p-2.5">
                <div className="font-bold text-rose-300">
                  다른 라인 · -15 OVR{' '}
                  <span className="text-cyan-300">(토탈 풋볼 필드 -8)</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  타 라인 기용 시 -15 (GK ↔ 필드 불일치는 토탈 풋볼에서도 -15 유지)
                </div>
              </div>
            </div>
          </div>

          {/* 1-2. Roulette Draft & Free Bench */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              3구단 룰렛 드래프트 (16인) &amp; 자유 벤치 규칙
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li>
                • <strong className="text-slate-100">5대 리그 {clubCount}구단 룰렛:</strong>{' '}
                매 픽마다 3개 구단(멀티 리그 3~4인 시 4개 구단)이 중복 없이 멈추며,
                구단당 현재 슬롯에 맞는 <strong>{CANDIDATES_PER_REEL}명</strong>의
                후보 중 최종 1명을 선택합니다. 후보를 1회 클릭하면 피치에 임시 배치되어
                예상 시너지·팀 케미를 실시간 프리뷰할 수 있습니다.
              </li>
              <li>
                • <strong className="text-amber-300">황금 [LEGEND] 칸 확률:</strong>{' '}
                드래프트 <strong className="text-white">{baseLegendPct}%</strong> ·
                리그 Top 4 / UCL 이적시장{' '}
                <strong className="text-white">{top4LegendPct}%</strong> ·
                리그 우승 UCL 특별 이적시장{' '}
                <strong className="text-amber-200">{champLegendPct}%</strong> — 당첨 시
                올타임 레전드(OVR 91~99) <strong>단독 1명</strong>이 등장합니다.
              </li>
              <li>
                • <strong className="text-emerald-300">드래프트 후 자유 벤치 &amp; 스왑:</strong>{' '}
                드래프트 완료 후 벤치 5칸은 포지션 제약이 완전히 해제되어 자유롭게
                배치되며 항상 선수의 실제 주포지션으로 표기·판정됩니다. 피치/벤치
                교환은 클릭·드래그, 상세 능력치는 우클릭/ⓘ 버튼, <strong>[빠른 선발]</strong>으로
                최적 베스트 11 자동 배치가 가능합니다.
              </li>
            </ul>
          </div>

          {/* 1-3. NBA-Style Trade Market */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <ArrowLeftRight className="w-4 h-4 text-sky-400 shrink-0" />
                NBA식 패키지 트레이드 &amp; 이적시장 규칙 (창당 {ATTEMPTS_PER_WINDOW}회)
              </div>
              <span className="rounded bg-sky-500/15 border border-sky-400/30 px-2 py-0.5 text-[10px] font-bold text-sky-200 whitespace-nowrap">
                리그 3회 + UCL 특별 1회
              </span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li>
                • <strong className="text-slate-100">다인 패키지 트레이드 (1:1 · 2:1 · 3:1):</strong>{' '}
                한 번에 최대 3명까지 묶어 제안할 수 있으며, 로스터 16인 규격(2:1/3:1 시
                상대 로테이션 선수 자동 포함)과 양 팀 <strong>최소 GK 1명</strong> 조건이
                자동 검증됩니다.
              </li>
              <li>
                • <strong className="text-emerald-300">트레이드 가치(TP) · 니즈 · 급매:</strong>{' '}
                OVR이 높을수록 가치가 지수적으로 상승하며, 2·3번째 카드에는{' '}
                <strong>다인 통합세(100% / 78% / 60%)</strong>가 적용됩니다(니즈 포지션은
                +15% 완화). 상대 구단의{' '}
                <strong className="text-amber-300">최우선 니즈(+32% TP · +8%p)</strong> /{' '}
                <strong className="text-sky-300">보강 니즈(+18% TP · +4%p)</strong>를
                채우면 성사율이 크게 오르고, 포화 포지션(-25% TP · -10%p)은 불리합니다.
                드물게 등장하는 <strong className="text-rose-300">🚨 프런트 급매(-35% TP · +12%p)</strong>는
                핵심 스타를 저렴하게 데려올 절호의 기회입니다.
              </li>
              <li>
                • <strong className="text-amber-200">슈퍼스타 핵심 자산 가드:</strong>{' '}
                OVR 87+ 스타 영입 시(급매 제외) 우리 측 제안에 <strong>대상 OVR -7 이상</strong>의
                핵심 선수가 포함되지 않으면 성사 확률이 극저(2~10%)로 제한됩니다.
              </li>
              <li>
                • <strong className="text-sky-200">받은 제안 · 역제안 · 스쿼드/전술 탭:</strong>{' '}
                AI 구단이 먼저 보내온 제안을 수락·거절하거나 <strong>[조건 수정 · 역제안]</strong>할
                수 있으며, 이적시장 모달 안의 <strong>[스쿼드 · 전술]</strong> 탭에서
                영입 직후 포메이션과 선발을 바로 정비할 수 있습니다.
              </li>
            </ul>
          </div>

          {/* 1-4. v9.0/v9.1 Draft Budget (FFP Soft Cap), Legend Flat Cost & Cash Negotiation */}
          <div className="rounded-xl border border-emerald-500/30 bg-[#0b1018] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                드래프트 예산(FFP 소프트 캡 €{DRAFT_BUDGET_CAP_M}M) · 레전드 균일가 &amp; 현금 협상
              </div>
              <span className="rounded bg-amber-500/15 border border-amber-400/35 px-2 py-0.5 text-[10px] font-bold text-amber-200 whitespace-nowrap">
                레전드 전원 €{LEGEND_FLAT_DRAFT_COST_M}M 균일가
              </span>
            </div>

            {/* OVR Progressive Cost Curve vs Legend Flat Cost */}
            <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                <span className="font-bold text-slate-200">
                  ① 누진 몸값 곡선 (현역) vs 레전드 균일가
                </span>
                <span className="text-[10px] text-amber-300 font-semibold">
                  레전드는 OVR 88~89급과 유사한 €{LEGEND_FLAT_DRAFT_COST_M}M 고정 (현역 90+보다 저렴)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 text-center text-[10.5px] tabular-nums">
                {[78, 82, 85, 87, 89, 91, 94].map((ovr) => (
                  <div
                    key={ovr}
                    className="rounded-md border border-slate-800 bg-[#090e15] py-1.5 px-1"
                  >
                    <div className="text-[9.5px] font-bold text-slate-400">OVR {ovr}</div>
                    <div
                      className={`font-mono font-black ${
                        ovr >= 91
                          ? 'text-rose-300'
                          : ovr >= 89
                            ? 'text-amber-300'
                            : 'text-slate-100'
                      }`}
                    >
                      €{computePlayerDraftCostM({ ovr, isLegend: false })}M
                    </div>
                  </div>
                ))}
                <div className="rounded-md border border-amber-400/55 bg-amber-950/30 py-1.5 px-1">
                  <div className="text-[9.5px] font-black text-amber-300">👑 레전드</div>
                  <div className="font-mono font-black text-amber-200">
                    €{LEGEND_FLAT_DRAFT_COST_M}M
                  </div>
                </div>
              </div>
            </div>

            {/* 3-Tier FFP Comparison Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#111822]">
              <table className="w-full min-w-[520px] text-left text-[10.5px] tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#090e15] text-slate-400">
                    <th className="py-2 px-2.5">FFP 구간</th>
                    <th className="py-2 px-2">기준 금액</th>
                    <th className="py-2 px-2">이월 자금</th>
                    <th className="py-2 px-2">2차 이적시장</th>
                    <th className="py-2 px-2">팀 케미 · 사기</th>
                    <th className="py-2 px-2.5">최종 랭킹 점수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  <tr>
                    <td className="py-2 px-2.5 font-extrabold text-emerald-300 whitespace-nowrap">
                      예산 준수
                    </td>
                    <td className="py-2 px-2 text-slate-200 whitespace-nowrap">
                      €{DRAFT_BUDGET_CAP_M}M 이하
                    </td>
                    <td className="py-2 px-2 font-bold text-emerald-300 whitespace-nowrap">
                      잔액 100% 이월
                    </td>
                    <td className="py-2 px-2 text-slate-200 whitespace-nowrap">
                      정상 {ATTEMPTS_PER_WINDOW}회
                    </td>
                    <td className="py-2 px-2 text-slate-300 whitespace-nowrap">
                      페널티 없음
                    </td>
                    <td className="py-2 px-2.5 text-slate-300 whitespace-nowrap">
                      감점 없음 (100%)
                    </td>
                  </tr>
                  <tr className="bg-amber-950/10">
                    <td className="py-2 px-2.5 font-extrabold text-amber-300 whitespace-nowrap">
                      FFP 1단계 주의
                    </td>
                    <td className="py-2 px-2 text-amber-200 whitespace-nowrap">
                      +1~{FFP_TIER1_MAX_OVERRUN_PCT}% (€{DRAFT_BUDGET_CAP_M + 1}~{Math.floor(DRAFT_BUDGET_CAP_M * (1 + FFP_TIER1_MAX_EXCESS_RATIO))}M)
                    </td>
                    <td className="py-2 px-2 font-bold text-amber-200 whitespace-nowrap">
                      €0M
                    </td>
                    <td className="py-2 px-2 font-bold text-amber-200 whitespace-nowrap">
                      {FFP_TIER1_WINDOW2_MAX_ATTEMPTS}회로 제한
                    </td>
                    <td className="py-2 px-2 font-bold text-amber-200 whitespace-nowrap">
                      팀 케미 -{FFP_TIER1_CHEM_PENALTY}
                    </td>
                    <td className="py-2 px-2.5 text-slate-300 whitespace-nowrap">
                      감점 없음 (100%)
                    </td>
                  </tr>
                  <tr className="bg-rose-950/15">
                    <td className="py-2 px-2.5 font-extrabold text-rose-300 whitespace-nowrap">
                      FFP 2단계 징계
                    </td>
                    <td className="py-2 px-2 text-rose-200 whitespace-nowrap">
                      +{FFP_TIER1_MAX_OVERRUN_PCT}% 초과 (€{Math.floor(DRAFT_BUDGET_CAP_M * (1 + FFP_TIER1_MAX_EXCESS_RATIO)) + 1}M+)
                    </td>
                    <td className="py-2 px-2 font-bold text-rose-200 whitespace-nowrap">
                      €0M
                    </td>
                    <td className="py-2 px-2 font-bold text-rose-300 whitespace-nowrap">
                      영입 동결 (0회)
                    </td>
                    <td className="py-2 px-2 font-bold text-rose-200 whitespace-nowrap">
                      케미 -{FFP_TIER1_CHEM_PENALTY} · 패배 사기 -1 추가
                    </td>
                    <td className="py-2 px-2.5 font-black text-rose-300 whitespace-nowrap">
                      -{FFP_TIER2_SCORE_PENALTY_PCT}% 감점
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cash Sweetener Summary */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[10.5px]">
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/12 p-2.5">
                <div className="font-extrabold text-emerald-300">트레이드 현금 얹기</div>
                <p className="mt-0.5 text-slate-300">
                  €1M당 <strong className="text-white">+{CASH_TO_TP_RATE} TP</strong> (€{CASH_TO_TP_SOFT_CAP_M}M 초과분 +{CASH_TO_TP_OVER_CAP_RATE} TP · 통합세 면제)
                </p>
              </div>
              <div className="rounded-lg border border-sky-500/25 bg-sky-950/12 p-2.5">
                <div className="font-extrabold text-sky-300">슈퍼스타 가드 완화</div>
                <p className="mt-0.5 text-slate-300">
                  <strong className="text-white">€{CASH_STAR_GUARD_RELIEF_THRESHOLD_M}M+</strong> 현금 추가 시 OVR -7 핵심 자산 기준 1단계 완화
                </p>
              </div>
              <div className="rounded-lg border border-amber-500/25 bg-amber-950/12 p-2.5">
                <div className="font-extrabold text-amber-300">레전드 FA 협상</div>
                <p className="mt-0.5 text-slate-300">
                  €10M당 성공률 <strong className="text-white">+{CASH_LEGEND_CHANCE_PER_10M}%p</strong> (최대 +{CASH_LEGEND_CHANCE_MAX_BONUS}%p)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 4-Pillar Synergy, Team Chemistry & 14 Manager Traits */}
      {tab === 'chemistry' && (
        <div className="space-y-3.5 pb-2 text-xs leading-relaxed text-slate-300">
          {/* Beginner-friendly 4-axis summary */}
          <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-r from-emerald-950/25 via-[#0b121c] to-amber-950/20 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 font-extrabold text-white">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              한눈에 구분하기: 개별 시너지 vs 감독 궁합 vs 팀 케미 vs 감독 철학
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 text-[11px]">
              <div className="rounded-lg border border-emerald-500/30 bg-slate-950/75 p-2.5">
                <div className="flex items-center justify-between gap-1 font-extrabold text-emerald-300">
                  <span>① 개별 시너지</span>
                  <span className="font-mono whitespace-nowrap">+0 ~ +3</span>
                </div>
                <p className="mt-1 text-[10.5px] text-slate-400">
                  선발 개인에게 연결된 4색 선 합계{' '}
                  <strong className="text-slate-200">2/4/8선 → +1/+2/+3</strong>.
                </p>
              </div>
              <div className="rounded-lg border border-amber-400/35 bg-slate-950/75 p-2.5">
                <div className="flex items-center justify-between gap-1 font-extrabold text-amber-300">
                  <span>② ★ 감독 궁합</span>
                  <span className="font-mono whitespace-nowrap">독립 +1</span>
                </div>
                <p className="mt-1 text-[10.5px] text-slate-400">
                  시너지 상한(+3)과 분리 적용. 일치 선수 모두{' '}
                  <strong className="text-emerald-300">+1</strong>(개인 최대{' '}
                  <strong className="text-white">+4</strong>).
                </p>
              </div>
              <div className="rounded-lg border border-sky-400/30 bg-slate-950/75 p-2.5">
                <div className="flex items-center justify-between gap-1 font-extrabold text-sky-300">
                  <span>③ 팀 케미 (0~100)</span>
                  <span className="font-mono whitespace-nowrap">
                    {TEAM_CHEMISTRY_MIN_BONUS} ~ +{TEAM_CHEMISTRY_ORG_BONUS_CAP}
                  </span>
                </div>
                <p className="mt-1 text-[10.5px] text-slate-400">
                  전체 연결선 가중 합산.{' '}
                  <strong className="text-rose-300">
                    {TEAM_CHEMISTRY_NEUTRAL_SCORE} 미만 페널티
                  </strong>
                  ·이상 시 중복 차단 후 팀 조직력{' '}
                  <strong className="text-slate-200">
                    최대 +{TEAM_CHEMISTRY_ORG_BONUS_CAP}
                  </strong>
                  .
                </p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950/75 p-2.5">
                <div className="flex items-center justify-between gap-1 font-extrabold text-slate-200">
                  <span>④ 감독 철학</span>
                  <span className="font-mono whitespace-nowrap">팀 A/M/D</span>
                </div>
                <p className="mt-1 text-[10.5px] text-slate-400">
                  궁합 선수 <strong>1~11명</strong>과 <strong>★추천 전술</strong>·상황 조건에
                  따라 팀 A/M/D·xG·점유율 상승.
                </p>
              </div>
            </div>
          </div>

          {/* 4-Color Lines */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              4색 시너지 연결선 (개별 1선 = 1점 · 2 / 4 / 8선 → +1 / +2 / +3)
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-[#111822] p-2.5 border border-slate-800">
                <div className="flex items-center justify-between font-bold gap-2">
                  <span className="inline-flex items-center gap-1.5 text-emerald-300">
                    <span className="h-1 w-3.5 rounded-full bg-emerald-400" />
                    1) 같은 팀 · 전 소속팀
                  </span>
                  <span className="text-emerald-200 text-[10.5px] whitespace-nowrap">
                    개별 1선 · 팀케미 ×{TEAM_CHEMISTRY_LINE_WEIGHTS.club}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  현재 동일 구단 또는 공식 1군 커리어상 같은 구단 인연 시 연결됩니다.
                </p>
              </div>
              <div className="rounded-lg bg-[#111822] p-2.5 border border-slate-800">
                <div className="flex items-center justify-between font-bold gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sky-300">
                    <span className="h-1 w-3.5 rounded-full bg-sky-400" />
                    2) 같은 국적
                  </span>
                  <span className="text-sky-200 text-[10.5px] whitespace-nowrap">
                    개별 1선 · 팀케미 ×{TEAM_CHEMISTRY_LINE_WEIGHTS.nation.toFixed(1)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  포메이션 인접 슬롯에 동일 국적 선수를 배치하면 연결됩니다.
                </p>
              </div>
              <div className="rounded-lg bg-[#111822] p-2.5 border border-amber-500/35">
                <div className="flex items-center justify-between font-bold gap-2">
                  <span className="inline-flex items-center gap-1.5 text-amber-300">
                    <span className="h-1 w-3.5 rounded-full bg-amber-400" />
                    3) 스타일 궁합 ({COMPLEMENTARY_STYLE_PAIRS.length}쌍)
                  </span>
                  <span className="text-amber-200 text-[10.5px] whitespace-nowrap">
                    개별 1선 · 팀케미 ×{TEAM_CHEMISTRY_LINE_WEIGHTS.style.toFixed(1)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  크로스 윙어+포처, 플레이메이커+라인브레이커 등 보완 스타일 조합 시 연결됩니다.
                </p>
              </div>
              <div className="rounded-lg bg-[#111822] p-2.5 border border-purple-500/35">
                <div className="flex items-center justify-between font-bold gap-2">
                  <span className="inline-flex items-center gap-1.5 text-purple-300">
                    <span className="h-1 w-3.5 rounded-full bg-purple-400" />
                    4) 엘리트 페어 (OVR {ELITE_PAIR_MIN_OVR}+)
                  </span>
                  <span className="text-purple-200 text-[10.5px] whitespace-nowrap">
                    개별 1선 · 팀케미 ×{TEAM_CHEMISTRY_LINE_WEIGHTS.elite}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  인접한 두 선수 모두 기본 OVR {ELITE_PAIR_MIN_OVR} 이상일 때 연결됩니다.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              ※ 피치 카드에서는 개별 시너지(+0~+3)와 감독 궁합(+1)을 합친 통합{' '}
              <strong className="text-emerald-300">+N</strong> 배지와 감독 궁합{' '}
              <strong className="text-amber-300">★</strong> 아이콘으로 표시됩니다.
            </p>
          </div>

          {/* Dedicated Team Chemistry (0~100) Structure & Guidelines */}
          <div className="rounded-xl border border-sky-500/35 bg-[#0b1018] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Users className="w-4 h-4 text-sky-400 shrink-0" />
                팀 케미 (0~100) 구조 &amp; 실전 가이드라인
              </div>
              <span className="rounded bg-sky-500/15 border border-sky-400/30 px-2 py-0.5 text-[10px] font-bold text-sky-300 whitespace-nowrap">
                기준선 {TEAM_CHEMISTRY_NEUTRAL_SCORE}점 · 페널티 방지 + 조직력 보너스
              </span>
            </div>

            {/* 1) How score is computed */}
            <div className="rounded-lg border border-slate-800 bg-[#111822] p-3 space-y-1.5">
              <div className="text-[11.5px] font-bold text-sky-200">
                1. 점수 계산 방식 — 왜 4색 선의 가중치가 다른가요?
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                팀 케미는 포메이션의 모든 인접 링크에서 켜진 4색 선을{' '}
                <strong className="text-white">
                  구단 ×{TEAM_CHEMISTRY_LINE_WEIGHTS.club} · 국적 ×
                  {TEAM_CHEMISTRY_LINE_WEIGHTS.nation.toFixed(1)} · 스타일 ×
                  {TEAM_CHEMISTRY_LINE_WEIGHTS.style.toFixed(1)} · 엘리트 ×
                  {TEAM_CHEMISTRY_LINE_WEIGHTS.elite}
                </strong>
                로 가중 합산한 뒤 포메이션 링크 수로 정규화해{' '}
                <strong className="text-white">0~100점</strong>으로 산출합니다(활성 선이 늘수록
                단조 증가).
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                개별 선수 시너지(+0~+3)에서는 4종 모두 1선=1점으로 동등하지만, 팀 케미에서는{' '}
                <strong className="text-slate-200">
                  구단·국적·스타일 조합 없이 88+ 스타만 모아 케미 95~100을 공짜로 얻는 현상을 막고
                </strong>{' '}
                같은 구단·국적·전술 스타일 조직력을 우대하도록 설계되었습니다.
              </p>
            </div>

            {/* 2) Tier breakdown */}
            <div className="space-y-1.5">
              <div className="text-[11.5px] font-bold text-sky-200">
                2. 점수 구간별 실제 경기력 반영 (이중 계산 방지 구조)
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[11px]">
                <div className="rounded-lg border border-rose-500/35 bg-rose-950/15 p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-1 font-bold text-rose-300">
                    <span>0 ~ {TEAM_CHEMISTRY_NEUTRAL_SCORE - 1}점</span>
                    <span className="font-mono text-[10px] whitespace-nowrap">
                      최대 {TEAM_CHEMISTRY_MIN_BONUS}
                    </span>
                  </div>
                  <div className="text-[10.5px] font-semibold text-rose-200">
                    페널티 구간 (주의)
                  </div>
                  <p className="text-[10.5px] text-slate-300 leading-snug">
                    조직력 부족으로 팀 공격·중원·수비에{' '}
                    <strong className="text-rose-200">페널티가 그대로 적용</strong>됩니다. 최소{' '}
                    <strong>{TEAM_CHEMISTRY_NEUTRAL_SCORE}점</strong> 이상 확보가 1순위입니다.
                  </p>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-1 font-bold text-amber-300">
                    <span>{TEAM_CHEMISTRY_NEUTRAL_SCORE} ~ 79점</span>
                    <span className="font-mono text-[10px] whitespace-nowrap">
                      기본 0 ~ +1.45
                    </span>
                  </div>
                  <div className="text-[10.5px] font-semibold text-amber-200">
                    안정 · 성장 구간
                  </div>
                  <p className="text-[10.5px] text-slate-300 leading-snug">
                    페널티가 사라집니다. 이미 반영된 선발 개별 시너지와 겹치지 않도록{' '}
                    <strong className="text-slate-100">
                      기본 보너스 − 평균 시너지×{TEAM_CHEMISTRY_SYNERGY_DEDUCT_RATIO}
                    </strong>
                    의 잔여분만 팀 A/M/D에 더해집니다.
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/15 p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-1 font-bold text-emerald-300">
                    <span>80 ~ 100점</span>
                    <span className="font-mono text-[10px] whitespace-nowrap">
                      조직력 최대 +{TEAM_CHEMISTRY_ORG_BONUS_CAP}
                    </span>
                  </div>
                  <div className="text-[10.5px] font-semibold text-emerald-200">
                    최상 조직력 구간
                  </div>
                  <p className="text-[10.5px] text-slate-300 leading-snug">
                    기본 보너스 최대 +{TEAM_CHEMISTRY_MAX_RAW_BONUS} 중 중복분을 제외하고 팀
                    A/M/D에{' '}
                    <strong className="text-emerald-200">
                      최대 +{TEAM_CHEMISTRY_ORG_BONUS_CAP}
                    </strong>
                    이 추가됩니다. 56점 이상부터{' '}
                    <strong className="text-white">명예의 전당 점수(최대 +440)</strong>에도
                    가산됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 3) Practical build guidelines */}
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/10 p-3 space-y-1.5">
              <div className="text-[11.5px] font-bold text-emerald-300">
                3. 실전 팀 케미 올리기 가이드라인
              </div>
              <ul className="space-y-1 text-[11px] text-slate-300">
                <li>
                  • <strong className="text-white">1차 목표는 {TEAM_CHEMISTRY_NEUTRAL_SCORE}점 돌파:</strong>{' '}
                  {TEAM_CHEMISTRY_NEUTRAL_SCORE}점 미만은 팀 전체 스탯이 깎이므로 드래프트 중반까지
                  최소 {TEAM_CHEMISTRY_NEUTRAL_SCORE}점을 넘기는 것이 가장 효율적입니다.
                </li>
                <li>
                  • <strong className="text-white">중앙 축에 구단(×{TEAM_CHEMISTRY_LINE_WEIGHTS.club}) · 국적/스타일(×1.0) 집중:</strong>{' '}
                  연결 간선이 많은 CM/CDM/CB·ST 축에 같은 구단(또는 전 소속팀)·같은 국적·보완
                  스타일을 배치하면 개별 시너지(+2~+3)와 팀 케미가 동시에 빠르게 오릅니다.
                </li>
                <li>
                  • <strong className="text-white">엘리트 88+(×{TEAM_CHEMISTRY_LINE_WEIGHTS.elite})는 보조 수단으로 활용:</strong>{' '}
                  개별 시너지 확보엔 똑같이 유효하지만 팀 케미 비중은 낮으므로, 슈퍼스타 영입 시에도
                  스타일 궁합이나 국적·구단 연결을 1개 이상 겹쳐 배치하는 것이 좋습니다.
                </li>
              </ul>
            </div>
          </div>

          {/* 14 Manager Traits (Direct Selection — No nested scroll!) */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                감독 특성 {MANAGER_TRAIT_LIST.length}종 (원하는 특성 직접 선택 · 랜덤 선택 가능)
              </div>
              <span className="text-[10px] text-slate-400">
                빌드업·전술형 {builderTraits.length}종 · 스페셜리스트 {specialistTraits.length}종
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-emerald-300">
                A. 빌드업 · 전술형 ({builderTraits.length}종 — 궁합 선수 1~11명 점진 강화)
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {builderTraits.map((tr) => (
                  <div
                    key={tr.id}
                    className="rounded-lg border border-slate-800 bg-[#111822] p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tr.badgeColor }}
                        />
                        <span className="font-bold text-white truncate">
                          {tr.name}
                        </span>
                      </div>
                      {tr.synergyTactic && (
                        <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-300 whitespace-nowrap shrink-0">
                          ★ {TACTICS[tr.synergyTactic].shortName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                      {tr.effectSummary}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold text-amber-300">
                B. 스페셜리스트형 ({specialistTraits.length}종 — 상황·특수 규칙 특화)
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {specialistTraits.map((tr) => (
                  <div
                    key={tr.id}
                    className="rounded-lg border border-slate-800 bg-[#111822] p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tr.badgeColor }}
                        />
                        <span className="font-bold text-white truncate">
                          {tr.name}
                        </span>
                      </div>
                      <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-300 whitespace-nowrap shrink-0">
                        스페셜리스트
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                      {tr.effectSummary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Unified Tactics & 9 Formations */}
      {tab === 'tactics' && (
        <div className="space-y-3.5 pb-2 text-xs text-slate-300">
          {/* 2-Stage Unified Engine */}
          <div className="rounded-xl border border-emerald-500/30 bg-[#0b1018] p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
              현실 축구형 2단계 통합 전술 수싸움 엔진
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[11px]">
              <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5 space-y-1">
                <div className="font-extrabold text-emerald-300">
                  1단계 · 내부 전술 완성도 (0 ~ 100%)
                </div>
                <p className="text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">포메이션×전술 구조(35%)</strong> +{' '}
                  <strong className="text-slate-200">선발 세부 능력치·스타일(45%)</strong> +{' '}
                  <strong className="text-slate-200">감독 스타일·OVR(20%)</strong>으로
                  전술 구현력을 산출합니다.
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5 space-y-1">
                <div className="font-extrabold text-sky-300">
                  2단계 · 5대 경기 구역 맞대결 (▲ / ▬ / ▼)
                </div>
                <p className="text-slate-400 leading-relaxed">
                  <strong>중원 · 측면 · 전환(뒷공간) · 박스(공중볼) · 압박(탈압박)</strong>{' '}
                  5구역 대결로 라인별 A/M/D(각 최대 ±2.9), 임계치 xG(최대 +0.32),
                  상대 xG 억제(최대 -0.22), 점유율(±8.5%)에 반영됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 5 Tactics */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
                5대 전술 특성 &amp; 상성 구조
              </div>
              <span className="text-[10px] text-slate-400">
                포메이션·선수 능력치에 따라 실제 유불리가 유동적으로 변화
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
              {TACTIC_LIST.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-slate-800 bg-[#111822] p-2.5"
                >
                  <div className="font-bold text-white">{t.name}</div>
                  <div className="mt-1 text-[10px] text-emerald-300">
                    강점: {t.strongAgainst}
                  </div>
                  <div className="mt-0.5 text-[10px] text-rose-300">
                    약점: {t.weakAgainst}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 9 Formations */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-bold text-white">
              <Layers className="w-4 h-4 text-sky-400 shrink-0" />
              {FORMATION_LIST.length}종 포메이션 구조 특성
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FORMATION_LIST.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-slate-800 bg-[#111822] p-2.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-display text-sm font-bold text-white">
                      {f.name}
                    </span>
                    <span className="text-[10px] text-emerald-300 font-semibold whitespace-nowrap">
                      {f.shortTag}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-slate-300">
                    + {f.strengthSummary}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-slate-500">
                    - {f.weaknessSummary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* AI Managers & Halftime */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-1.5 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 font-bold text-rose-300 text-xs">
              <Swords className="w-4 h-4 shrink-0" />
              AI 감독 역량 (OVR 70~99) &amp; 하프타임 실시간 수싸움
            </div>
            <p className="text-slate-400">
              • 유럽 5대 리그 {clubCount}구단 · UCL 외곽 {uclExtCount}구단 · 명예의
              전당 {historicalCount}팀 전부에 실제 감독의 OVR과 특성이 적용됩니다.
            </p>
            <p className="text-slate-400">
              • 하프타임(45&apos;)에 상대 AI 감독도 전반 흐름과 5대 구역 열세를
              분석해 포메이션·전술 전환 및 벤치 교체(최대 2명)로 맞대응합니다.
            </p>
          </div>

          {/* v9.0/v9.1 AI Pre-Match Tactical Adaptation (8-Match Window, Danger-Only Popup, Elite AI 1st-Half Counter) */}
          <div className="rounded-xl border border-amber-500/30 bg-[#0b1018] p-3.5 space-y-3 text-[11px] text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
                <Eye className="w-4 h-4 shrink-0" />
                AI 사전 전술 파훼 (반복 패턴 노출도 0~100)
              </div>
              <span className="rounded bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-200 whitespace-nowrap">
                최근 {ADAPTATION_HISTORY_WINDOW}경기 추적 · 위험 전용 팝업
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[10.5px]">
              <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5 space-y-1">
                <div className="flex items-center justify-between font-extrabold text-emerald-300">
                  <span>안전 (0~{EXPOSURE_WARNING_THRESHOLD - 1})</span>
                  <span className="font-mono text-[9.5px]">1~4연속</span>
                </div>
                <p className="text-slate-400">
                  상대 AI가 기본 전술대로 대응합니다. 포메이션이나 전술을 1경기만 변주해도 즉시 안전 구간으로 해소됩니다.
                </p>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-2.5 space-y-1">
                <div className="flex items-center justify-between font-extrabold text-amber-300">
                  <span>주의 ({EXPOSURE_WARNING_THRESHOLD}~{EXPOSURE_DANGER_THRESHOLD - 1})</span>
                  <span className="font-mono text-[9.5px]">5~7연속</span>
                </div>
                <p className="text-slate-300">
                  팝업 없이 전술실 정찰 배지만 은은하게 표시됩니다. 상위권 AI 감독이 사전 대응을 준비하기 시작합니다.
                </p>
              </div>
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-2.5 space-y-1">
                <div className="flex items-center justify-between font-extrabold text-rose-300">
                  <span>파훼 경계 ({EXPOSURE_DANGER_THRESHOLD}~100)</span>
                  <span className="font-mono text-[9.5px]">약 {ADAPTATION_HISTORY_WINDOW}연속</span>
                </div>
                <p className="text-slate-200">
                  최초 진입 시 <strong>스카우팅 경고 팝업 1회</strong> 발동(변주 해제 후 재진입 시에만 재안내). 명장 AI가 전반 카운터 전술을 가동합니다.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5 space-y-1.5 text-[10.5px]">
              <div className="font-bold text-slate-100">
                명장 AI 전반 카운터 &amp; 전술 완성도 코치 완화
              </div>
              <p className="text-slate-300">
                • <strong className="text-rose-200">OVR {ELITE_AI_COUNTER_OVR_THRESHOLD}+ 명장 AI</strong>는 높은 노출도에서 경기 프리뷰와 다른{' '}
                <strong className="text-white">전반 킥오프 또는 전반 중반(18&apos;~28&apos;) 기습 카운터 전술</strong>을 가동하며,
                중계 상단과 경기 리포트에 <code className="text-rose-300">[전술 파훼 발동]</code> 알림이 표시됩니다.
              </p>
              <p className="text-slate-400">
                • <strong className="text-teal-300">전술 완성도 수석 코치</strong>를 선임하면 노출도 누적 속도가{' '}
                <strong className="text-white">{Math.round(COACH_ADAPTATION_MITIGATION * 100)}% 완화</strong>됩니다.
              </p>
            </div>
          </div>

          {/* v9.0/v9.1 Mid-Season Assistant Coaches (Full 12-Coach Pixel Catalog) */}
          <div className="rounded-xl border border-emerald-500/30 bg-[#0b1018] p-3.5 space-y-3 text-[11px] text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300 text-xs">
                <UserCheck className="w-4 h-4 shrink-0" />
                반환점(2차 이적시장) 수석 코치 도감 ({STAFF_COACH_LIST.length}종 중 3명 추천 → 1명 선택)
              </div>
              <span className="rounded bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-200 whitespace-nowrap">
                FFP 2단계 동결 중에도 선임 가능
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[10.5px]">
              <div className="rounded-lg border border-sky-500/30 bg-[#111822] p-2.5">
                <div className="font-extrabold text-sky-300">① 전술 특화 (5종)</div>
                <div className="mt-0.5 text-slate-400">
                  해당 전술 선택 시 팀 A·M·D <strong className="text-white">+{STAFF_COACH_TACTIC_OVR_LIFT}</strong>
                </div>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-[#111822] p-2.5">
                <div className="font-extrabold text-emerald-300">② 라인 강화 (3종)</div>
                <div className="mt-0.5 text-slate-400">
                  전술 무관 공격/중원/수비 상시 <strong className="text-white">+{STAFF_COACH_LINE_LIFT.toFixed(1)}</strong>
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-[#111822] p-2.5">
                <div className="font-extrabold text-amber-300">③ 시스템 보너스 (4종)</div>
                <div className="mt-0.5 text-slate-400">
                  파훼 -{Math.round(COACH_ADAPTATION_MITIGATION * 100)}%·상성 +{Math.round((STAFF_COACH_TACTIC_MATCHUP_MULT - 1) * 100)}% / 케미 +{STAFF_COACH_CHEM_LIFT} / 교체 +{STAFF_COACH_SUB_OVR_LIFT.toFixed(1)}(최대 +{STAFF_COACH_SUB_COMBINED_CAP.toFixed(1)})·65&apos;+ 체력 -{Math.round(STAFF_COACH_LATE_STAMINA_REDUCTION * 100)}% / OVR≤{STAFF_COACH_DEV_MAX_BASE_OVR} +{STAFF_COACH_DEV_OVR_LIFT}·각성 +{Math.round((STAFF_COACH_DEV_AWAKENING_MULT - 1) * 100)}%
                </div>
              </div>
            </div>

            {/* Full 12 Staff Coaches Grid with Real Pixel Portraits */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {STAFF_COACH_LIST.map((coach) => (
                <div
                  key={coach.id}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-[#111822] p-2"
                >
                  <div className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-[#0b1018]">
                    <PixelManagerAvatar
                      avatar={coach.avatar}
                      clubPrimaryColor={coach.clubPrimaryColor}
                      clubSecondaryColor={coach.clubSecondaryColor}
                      size={34}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] font-extrabold text-white">
                        {coach.name}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-px text-[9px] font-bold text-slate-300 whitespace-nowrap shrink-0">
                        {coach.categoryLabel}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-emerald-300 truncate">
                      {coach.roleTitle} · {coach.shortBadge}
                    </div>
                    <div className="text-[9.5px] text-slate-400 leading-snug line-clamp-2">
                      {coach.effectSummary}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Season Flow, UCL 36-Team, Hall of Fame & Multiplayer */}
      {tab === 'season' && (
        <div className="space-y-3.5 pb-2 text-xs leading-relaxed text-slate-300">
          {/* Solo Progression */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
              솔로 시즌 3가지 진행 방식 (2D 중계 · 라이브 자동진행 · 통합 스킵)
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li>
                • <strong className="text-emerald-300">직접 2D 경기 중계:</strong>{' '}
                22명의 실시간 오프더볼·빌드업 움직임을 보며 하프타임(45&apos;) 전술
                수싸움과 최대 5명 교체를 직접 지휘합니다.
              </li>
              <li>
                • <strong className="text-sky-300">라이브 스코어보드 자동진행 (5초 / 7초 / 9초):</strong>{' '}
                실시간 0&apos;→90&apos;(연장·PK 포함) 스코어보드로 라운드를 연속 진행합니다.
                일시정지 후 <strong>[2D 경기 중계 입장]</strong>으로 멈춘 분 그대로
                난입할 수 있고, 스쿼드 탭 <strong>[전술 수정] → [수정 확정]</strong>으로
                안전하게 다음 경기 전술을 바꿀 수 있습니다. 자국 컵·이적시장·부상 시
                자동 멈춤 및 자국 컵 2D 진입 시 프리뷰 화면을 먼저 거쳐 정비합니다.
              </li>
              <li>
                • <strong className="text-amber-300">통합 [경기 스킵]:</strong>{' '}
                고속 시뮬레이션 중 이적시장·인터뷰·부상 이벤트가 발생하면 백그라운드
                진행을 멈추고 즉시 대응하도록 보장하며, 이적시장 종료 후 계속 스킵할지
                다시 선택합니다.
              </li>
            </ul>
          </div>

          {/* UCL 36-Team Format */}
          <div className="rounded-xl border border-sky-500/30 bg-[#0b1018] p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-sky-200">
              <Trophy className="w-4 h-4 text-sky-400 shrink-0" />
              36팀 UEFA 챔피언스리그 (리그 4위 이내 진출)
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li>
                • <strong className="text-white">참가 구성:</strong> 5대 리그 각 상위
                4팀(20팀) + 유럽 외곽 강호 {uclExtCount}팀 = 총 36팀(4개 포트 × 9팀).
                진출 직후 <strong>UCL 특별 이적시장</strong>이 1회 열립니다.
              </li>
              <li>
                • <strong className="text-sky-300">스위스 리그 페이즈 (8경기):</strong>{' '}
                홈 4·원정 4경기 결과로{' '}
                <strong className="text-emerald-300">1~8위 16강 직행</strong> ·{' '}
                <strong className="text-amber-300">9~24위 플레이오프</strong> ·{' '}
                <strong className="text-rose-300">25~36위 탈락</strong>이 결정됩니다.
              </li>
              <li>
                • <strong className="text-amber-200">토너먼트 (PO · 16강 · 8강 · 4강 · 결승):</strong>{' '}
                PO~4강은 홈·원정 2차전 합산(AGG) 승부이며, 1차전 종료 후 2차전 전술
                정비 단계를 거칩니다. 결승은 단판(동점 시 연장·승부차기)이며, 토너먼트에서도
                라이브 스코어보드 자동진행을 지원합니다.
              </li>
            </ul>
          </div>

          {/* Hall of Fame & Dream Match */}
          <div className="rounded-xl border border-amber-500/30 bg-[#0b1018] p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-200">
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              명예의 전당 · 역대 {historicalCount}팀 비교 &amp; 드림 매치
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li>
                • <strong className="text-slate-100">공정 시즌 스코어:</strong> 34R·38R
                리그를 38경기 환산 승점(PPG×38)으로 정규화하고, 우승·컵·UCL·역사적
                대기록·스쿼드 완성도(OVR/벤치/케미/감독 시너지/전술 이행도)·개인 수상을
                유저와 역대 {historicalCount}팀에 <strong>100% 동일 공식</strong>으로
                적용합니다(FFP 2단계 예산 초과 시 최종 점수{' '}
                <strong className="text-rose-300">-{FFP_TIER2_SCORE_PENALTY_PCT}% 감점</strong>).
              </li>
              <li>
                • <strong className="text-amber-300">등재 기준 &amp; 도전과제:</strong>{' '}
                시즌 점수 <strong className="text-white">{HOF_AUTO_INDUCTION_MIN_SCORE.toLocaleString()}점+</strong> ·
                S+ 등급 · UCL 우승 · 트레블 달성 시 자동 등재되며, 기준 미만 시즌도 결산
                화면에서 수동 등록할 수 있습니다. 24종 히든 도전과제는 매 시즌 자동 해금됩니다.
              </li>
              <li>
                • <strong className="text-emerald-300">드림 매치:</strong> 내 명예의
                전당 팀 또는 즉석 16인 드래프트로 역대 전설 {historicalCount}팀과
                단판 승부(연장·PK 포함)를 치릅니다.
              </li>
            </ul>
          </div>

          {/* v9.0/v9.1 Permanent Potential Awakening */}
          <div className="rounded-xl border border-rose-500/35 bg-[#120d12] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-rose-200">
                <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                선수 포텐 폭발 (영구 순수 OVR +{AWAKENING_MIN_GAIN} ~ +{AWAKENING_MAX_GAIN} 각성)
              </div>
              <span className="rounded bg-rose-500/15 border border-rose-400/35 px-2 py-0.5 text-[10px] font-bold text-rose-200 whitespace-nowrap">
                레전드 불가 (0%) · 상한 OVR {AWAKENING_OVR_HARD_CAP}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-rose-500/25 bg-[#0b0d14]">
              <table className="w-full min-w-[460px] text-left text-[10.5px] tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#090c12] text-slate-400">
                    <th className="py-2 px-2.5">선수 등급 (기본 OVR)</th>
                    <th className="py-2 px-2">발동 빈도</th>
                    <th className="py-2 px-2.5">영구 OVR 상승폭</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  <tr>
                    <td className="py-1.5 px-2.5 font-bold text-amber-300 whitespace-nowrap">
                      👑 레전드 (ICON)
                    </td>
                    <td className="py-1.5 px-2 font-bold text-rose-300 whitespace-nowrap">
                      0% (각성 불가)
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-500">해당 없음</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 font-bold text-purple-300 whitespace-nowrap">
                      슈퍼스타 · 월클 ({AWAKENING_SUPERSTAR_OVR_THRESHOLD}+)
                    </td>
                    <td className="py-1.5 px-2 text-slate-200 whitespace-nowrap">
                      극희박 (×{AWAKENING_SUPERSTAR_RATE_MULT.toFixed(2)}, 1/25)
                    </td>
                    <td className="py-1.5 px-2.5 font-bold text-white whitespace-nowrap">
                      최대 +{AWAKENING_SUPERSTAR_MAX_GAIN} (상한 {AWAKENING_OVR_HARD_CAP})
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 font-bold text-emerald-300 whitespace-nowrap">
                      일반 핵심 · 유망주 ({AWAKENING_SUPERSTAR_OVR_THRESHOLD - 1} 이하)
                    </td>
                    <td className="py-1.5 px-2 text-slate-200 whitespace-nowrap">
                      시즌당 평균 0~1명
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-200">
                      ≤77: <strong>+4~+7</strong> · 78~81: <strong>+3~+6</strong> · 82~84: <strong>+2~+5</strong> · 85~86: <strong>+2~+4</strong> · 87~88: <strong>+2~+3</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[10.5px]">
              <div className="rounded-lg border border-slate-800 bg-[#0d121c] p-2.5 space-y-1">
                <div className="font-bold text-slate-100">발동 조건 &amp; 시즌 누적 감쇠</div>
                <p className="text-slate-300">
                  팀 {AWAKENING_MIN_SEASON_MATCH}경기+ · 개인 {AWAKENING_MIN_APPEARANCES}경기+ · 45분+ 출전 &amp; 평점 7.4+ 활약 시 판정.{' '}
                  <strong className="text-emerald-300">1명째 ×1.00 → 2명째 ×{AWAKENING_SECOND_COUNT_MULT.toFixed(2)}</strong>(급감 없음),{' '}
                  <strong className="text-amber-300">3명째부터 ×{AWAKENING_THIRD_PLUS_MULT.toFixed(2)}</strong> 급감.
                </p>
              </div>
              <div className="rounded-lg border border-rose-500/25 bg-rose-950/15 p-2.5 space-y-1">
                <div className="font-bold text-orange-300">영구 순수 성장 &amp; 크림슨 엠버</div>
                <p className="text-slate-300">
                  임시 버프가 아닌 <strong>순수 기본 OVR + 포지션 핵심 세부 스탯</strong> 영구 상승. 붉은 불꽃(Crimson Ember) 테두리가 표시되며 세이브·명예의 전당·글로벌 랭킹·1v1 대전까지 보존됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Multiplayer (1v1 & 2~4P Multi-League) */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Users className="w-4 h-4 text-sky-400 shrink-0" />
              실시간 멀티플레이 (1v1 블라인드 대전 &amp; 2~4인 멀티 리그)
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li>
                • <strong className="text-sky-300">1v1 블라인드 대전:</strong> 비공개
                16인 동시 드래프트 → 전술실 블라인드 확정 → 최종 전술 공개 후 1배속
                대칭 2D 중계로 맞붙습니다.
              </li>
              <li>
                • <strong className="text-emerald-300">2~4인 멀티 리그:</strong> 라운드별
                균등 순환 공유 룰렛(3~4인 시 4구단 룰렛)으로 중복 없는 고유 스쿼드를
                짜고 같은 리그·컵·UCL을 함께 진행합니다. 친구 맞대결은 2D 중계(4인 리그
                맞대결은 2차전 2D · 1차전 라이브 중계, 비당사자는 읽기 전용 관전)로
                진행됩니다.
              </li>
              <li>
                • <strong className="text-amber-200">UCL 생존자 준비 &amp; 결산 점수:</strong>{' '}
                토너먼트 단계·1↔2차전 전환 시 현재 생존자만 [준비 완료]를 누르면 즉시
                진행됩니다. 최종 친구 순위는{' '}
                <strong>시즌 점수 + 맞대결 점수(최대 {MP_H2H_MAX_POINTS.toLocaleString()}점)</strong>로
                결정됩니다.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 5: Injury, Stamina & Morale Guide */}
      {tab === 'condition' && <InjuryMoraleGuideContent />}

      {/* Tab 6: Sub-Attributes & Scoring Routes Guide */}
      {tab === 'attributes' && <AttributeRoutesGuideContent />}
    </div>
  );
}

export function SystemGuideModal({
  onClose,
  initialTab = 'basics',
  onOpenTutorial,
}: {
  onClose: () => void;
  initialTab?: GuideTabId;
  onOpenTutorial?: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleReplayTutorial = () => {
    onClose();
    if (onOpenTutorial) {
      onOpenTutorial();
    } else {
      openSoloTutorial();
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/85 p-3 sm:p-6"
      onClick={onClose}
    >
      <ModalBodyLock />
      <div
        className="modal-panel flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#111822] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="text-sm font-extrabold text-white truncate">
              Road To Treble 시스템 가이드북
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleReplayTutorial}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              입문 튜토리얼
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 hover:text-white cursor-pointer"
              aria-label="가이드 닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pb-8 sm:pb-9">
          <SystemGuideContent key={initialTab} initialTab={initialTab} />
        </div>
      </div>
    </div>
  );
}

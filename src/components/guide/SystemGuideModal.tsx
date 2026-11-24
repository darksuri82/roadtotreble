import {
  ArrowLeftRight,
  BookOpen,
  Compass,
  Crown,
  GraduationCap,
  Layers,
  Radio,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import { HISTORICAL_BENCHMARK_TEAMS } from '../../data/historicalTeams';
import { MANAGER_TRAIT_LIST } from '../../data/managerTraits';
import {
  COMPLEMENTARY_STYLE_PAIRS,
  ELITE_PAIR_MIN_OVR,
} from '../../engine/chemistryEngine';
import { ALL_CLUBS_WITH_LEAGUE } from '../../engine/dataLoader';
import {
  CANDIDATES_PER_REEL,
  DEFAULT_ROULETTE_LEGEND_RATE,
  TOP4_TRANSFER_LEGEND_RATE,
} from '../../engine/draftEngine';
import { HOF_AUTO_INDUCTION_MIN_SCORE } from '../../engine/legacyEngine';
import { MP_H2H_MAX_POINTS } from '../../engine/mpLeagueScore';
import { TACTIC_LIST, TACTICS } from '../../engine/tacticEngine';
import {
  ATTEMPTS_PER_WINDOW,
  UCL_CHAMPION_LEGEND_RATE,
} from '../../engine/transferEngine';
import { UCL_EXTERNAL_TEAMS } from '../../engine/uclEngine';
import { ModalBodyLock } from '../../hooks/useBodyScrollLock';
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
                  <span className="font-mono whitespace-nowrap">-1.5~+2.5</span>
                </div>
                <p className="mt-1 text-[10.5px] text-slate-400">
                  전체 연결선 가중 합산(단조 증가). 개별 시너지와 중복 차단 후 팀 조직력{' '}
                  <strong className="text-slate-200">최대 +0.8</strong> 추가.
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
                <div className="flex items-center justify-between font-bold">
                  <span className="inline-flex items-center gap-1.5 text-emerald-300">
                    <span className="h-1 w-3.5 rounded-full bg-emerald-400" />
                    1) 같은 팀 · 전 소속팀
                  </span>
                  <span className="text-emerald-200 text-[10.5px] whitespace-nowrap">
                    1선 · 팀케미 가중 1.25
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  현재 동일 구단 또는 공식 1군 커리어상 같은 구단 인연 시 연결됩니다.
                </p>
              </div>
              <div className="rounded-lg bg-[#111822] p-2.5 border border-slate-800">
                <div className="flex items-center justify-between font-bold">
                  <span className="inline-flex items-center gap-1.5 text-sky-300">
                    <span className="h-1 w-3.5 rounded-full bg-sky-400" />
                    2) 같은 국적
                  </span>
                  <span className="text-sky-200 text-[10.5px] whitespace-nowrap">
                    1선 · 팀케미 가중 1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  포메이션 인접 슬롯에 동일 국적 선수를 배치하면 연결됩니다.
                </p>
              </div>
              <div className="rounded-lg bg-[#111822] p-2.5 border border-amber-500/35">
                <div className="flex items-center justify-between font-bold">
                  <span className="inline-flex items-center gap-1.5 text-amber-300">
                    <span className="h-1 w-3.5 rounded-full bg-amber-400" />
                    3) 스타일 궁합 ({COMPLEMENTARY_STYLE_PAIRS.length}쌍)
                  </span>
                  <span className="text-amber-200 text-[10.5px] whitespace-nowrap">
                    1선 · 팀케미 가중 1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  크로스 윙어+포처, 플레이메이커+라인브레이커 등 보완 스타일 조합 시 연결됩니다.
                </p>
              </div>
              <div className="rounded-lg bg-[#111822] p-2.5 border border-purple-500/35">
                <div className="flex items-center justify-between font-bold">
                  <span className="inline-flex items-center gap-1.5 text-purple-300">
                    <span className="h-1 w-3.5 rounded-full bg-purple-400" />
                    4) 엘리트 페어 (OVR {ELITE_PAIR_MIN_OVR}+)
                  </span>
                  <span className="text-purple-200 text-[10.5px] whitespace-nowrap">
                    1선 · 팀케미 가중 0.45
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
                적용합니다.
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

import {
  BookOpen,
  Compass,
  Crown,
  Layers,
  Shield,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import { MANAGER_TRAIT_LIST } from '../../data/managerTraits';
import { TACTIC_LIST } from '../../engine/tacticEngine';

type GuideTab = 'ovr' | 'chemistry' | 'tactics' | 'manager';

export function SystemGuideContent() {
  const [tab, setTab] = useState<GuideTab>('ovr');

  const tabs: { id: GuideTab; label: string }[] = [
    { id: 'ovr', label: '1. 복수 주포지션 · 룰렛' },
    { id: 'chemistry', label: '2. 케미스트리 · 병렬선' },
    { id: 'tactics', label: '3. 전술 · 포메이션 상성' },
    { id: 'manager', label: '4. 감독 강점 · 실시간 중계' },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 rounded-xl border border-slate-800 bg-[#0b1018] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-2.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
              tab === t.id
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Multi Main Positions & Roulette */}
      {tab === 'ovr' && (
        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-bold text-white">
              <Shield className="w-4 h-4 text-emerald-400" />
              복수 주포지션(mainPositions) &amp; 실효 OVR 페널티
            </div>
            <p className="text-slate-400 mb-3">
              실제 현대 축구에서 여러 포지션을 본업 수준으로 소화하는 선수는 모두 <strong className="text-slate-200">주포지션 배열</strong>(예: 음바페 <code className="text-emerald-300">ST · LW</code>, 발베르데 <code className="text-emerald-300">CM · RB · RW</code>, 말디니 <code className="text-emerald-300">LB · CB</code>)로 등록되어 페널티 없이 기용할 수 있습니다.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2.5">
                <div className="font-bold text-emerald-300">주포지션 배열 일치 · 페널티 0</div>
                <div className="text-[11px] text-slate-400 mt-0.5">주포지션에 포함된 어느 슬롯에 배치해도 100% 실효 OVR</div>
              </div>
              <div className="rounded-lg border border-amber-400/30 bg-amber-950/15 p-2.5">
                <div className="font-bold text-amber-300">부포지션 / 호환 · -3 OVR</div>
                <div className="text-[11px] text-slate-400 mt-0.5">가끔 소화 가능한 부포지션 또는 LB↔LWB 등 호환 포지션 (토탈 풋볼 시 -1)</div>
              </div>
              <div className="rounded-lg border border-orange-500/30 bg-orange-950/15 p-2.5">
                <div className="font-bold text-orange-300">같은 라인 비적합 · -6 OVR</div>
                <div className="text-[11px] text-slate-400 mt-0.5">예: CB→LB, CDM→CAM, ST→LW (토탈 풋볼 시 -3)</div>
              </div>
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/15 p-2.5">
                <div className="font-bold text-rose-300">다른 라인 / GK 불일치 · -15 OVR</div>
                <div className="text-[11px] text-slate-400 mt-0.5">라인이 완전히 다르거나 GK ↔ 필드 불일치</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-bold text-white">
              <Crown className="w-4 h-4 text-amber-400" />
              2026-27 3구단 룰렛 (구단당 3명 후보) &amp; 드래프트 중 자유 스왑
            </div>
            <ul className="space-y-1.5 text-slate-300">
              <li>
                • <strong className="text-slate-100">96개 구단 룰렛 (릴당 97.5%)</strong>: 3개 구단이 중복 없이 멈추며, 각 구단별로 현재 포지션에 맞는 <strong>3명의 선수 후보</strong>가 제시됩니다. 전체 후보 중 최종 1명을 선택하세요.
              </li>
              <li>
                • <strong className="text-amber-300">황금 [LEGEND] 칸 (드래프트 2.5% / Top4 이적시장 4.0%)</strong>: 당첨 시 올타임 레전드(OVR 91~99) <strong>딱 1명</strong>이 단독 등장합니다.
              </li>
              <li>
                • <strong className="text-emerald-300">자유 교환 · 선수 상세 · 빠른 선발</strong>: 피치·벤치 선수는 클릭·드래그로 교환, 우클릭·ⓘ 아이콘으로 상세 정보 확인이 가능하며, <strong>[빠른 선발]</strong> 버튼으로 실효 OVR+케미 최적 베스트 11을 자동 배치할 수 있습니다.
              </li>
              <li>
                • <strong className="text-sky-300">이적시장 협상 시스템 (기회 3회)</strong>: 추첨된 3구단의 2026-27 스쿼드를 탐색하고 시즌 폼·구단 순위·우리 팀 위상이 반영된 몸값(€M)과 성공률(%)을 보고 최대 3회 영입 오퍼를 시도할 수 있습니다.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: 4-Pillar Chemistry (NO Same League + Parallel Lines) */}
      {tab === 'chemistry' && (
        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-bold text-white">
              <Zap className="w-4 h-4 text-emerald-400" />
              케미스트리 4축 (총 100점 · &lsquo;동일 리그&rsquo; 항목 제거)
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-[#111822] p-2.5 border border-slate-800">
                <div className="flex justify-between font-bold">
                  <span className="text-emerald-300">1) 동일 구단 · 레전드 와일드카드</span>
                  <span className="text-white">최대 25점</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  동일 구단 소속 선수 간 강한 연결. 레전드는 인접 선수와 기본 구단/전술 와일드카드 연결 1종을 자동 제공합니다.
                </p>
              </div>
              <div className="rounded-lg bg-[#111822] p-2.5 border border-slate-800">
                <div className="flex justify-between font-bold">
                  <span className="text-sky-300">2) 동일 국적</span>
                  <span className="text-white">최대 20점</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  포메이션 인접 링크 간 동일 국적 선수(레전드 포함) 연결 비율로 산출됩니다.
                </p>
              </div>
              <div className="rounded-lg bg-[#111822] p-2.5 border border-amber-500/35">
                <div className="flex justify-between font-bold">
                  <span className="text-amber-300">3) ★ 플레이스타일 · 전술 · 감독 시너지</span>
                  <span className="text-white">최대 40점</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  가장 비중이 큰 핵심 축! 현재 전술·감독 강점에 맞는 플레이스타일과 인접 선수 간 보완 조합(예: 플레이메이커+라인브레이커)을 반영합니다.
                </p>
              </div>
              <div className="rounded-lg bg-[#111822] p-2.5 border border-slate-800">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-200">4) 스쿼드 역할 균형</span>
                  <span className="text-white">최대 15점</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  피니셔·찬스메이커·침투형·볼위너·수비수·키퍼 역할군이 고르게 조화를 이룰수록 가점됩니다.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
            <div className="font-bold text-white">
              피치 다중 병렬 연결선 시각화 &amp; 실효 OVR 보정
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-emerald-400" />
                에메랄드: 동일 구단 / 레전드 와일드카드
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-sky-400" />
                스카이블루: 동일 국적
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-amber-400" />
                골드: 플레이스타일 시너지
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              두 선수 사이에 조건이 2~3개 겹치면 해당 색상의 선이 나란히 평행하게 표시됩니다. 케미 0점 = -1.5 OVR / 50점(중립) = 0.0 OVR / 100점 = +2.5 OVR 보정이 적용됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: 5 Tactics & 6 Formations */}
      {tab === 'tactics' && (
        <div className="space-y-3 text-xs text-slate-300">
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-bold text-white">
              <Compass className="w-4 h-4 text-emerald-400" />
              5대 전술 상성 (우세 +2.2 / 약우위 +0.9 / 열세 -2.2 OVR)
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

          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-bold text-white">
              <Layers className="w-4 h-4 text-sky-400" />
              6대 포메이션 특징 &amp; 상성 (±1.1 ~ 1.4 OVR)
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FORMATION_LIST.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-slate-800 bg-[#111822] p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-white">
                      {f.id}
                    </span>
                    <span className="text-[10px] text-emerald-300 font-semibold">
                      {f.shortTag}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-300">+ {f.strengthSummary}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">- {f.weaknessSummary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Manager Traits & Real-Time Broadcast */}
      {tab === 'manager' && (
        <div className="space-y-3 text-xs text-slate-300">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3.5">
            <div className="mb-1 flex items-center gap-1.5 font-bold text-amber-300">
              <Sparkles className="w-4 h-4" />
              2D 탑뷰 피치 실시간 중계 (0&apos; → 45&apos; → 90&apos;) &amp; 고속 진행
            </div>
            <p className="text-slate-300 leading-relaxed">
              경기 진행 시 <strong>2D 탑뷰 축구장</strong>에서 양 팀 22명의 선수가 포메이션 대형을 유지하며 공수 전환·침투·슈팅·선방·골 연출을 펼칩니다. <strong>45&apos; 하프타임</strong>에 전술·포메이션 변경 및 교체가 가능하며, 이적시장/시즌 종료 이동 시에도 실시간 고속 진행 연출로 라운드별 결과와 순위 변동을 확인할 수 있습니다.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-bold text-white">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              감독 강점 14종 (시작 시 룰렛 · 최대 2회 리롤)
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto pr-1">
              {MANAGER_TRAIT_LIST.map((tr) => (
                <div
                  key={tr.id}
                  className="rounded-lg border border-slate-800 bg-[#111822] p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: tr.badgeColor }}
                    />
                    <span className="font-bold text-white">{tr.name}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                    {tr.effectSummary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SystemGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#111822] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-extrabold text-white">
              PITCH MANAGER 시스템 가이드
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 hover:text-white cursor-pointer"
            aria-label="가이드 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">
          <SystemGuideContent />
        </div>
      </div>
    </div>
  );
}

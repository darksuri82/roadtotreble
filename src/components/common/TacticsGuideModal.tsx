import { BookOpen, Compass, HeartPulse, Radar, Shield, Sparkles, Swords, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import { PLAYSTYLES } from '../../data/playstyles';
import { COMPLEMENTARY_STYLE_PAIRS, ELITE_PAIR_MIN_OVR } from '../../engine/chemistryEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { AttributeRoutesGuideContent } from '../guide/AttributeRoutesGuideContent';
import { InjuryMoraleGuideContent } from '../guide/InjuryMoraleGuideContent';

interface TacticsGuideModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'tactics' | 'condition' | 'attributes';
}

export function TacticsGuideModal({
  open,
  onClose,
  initialTab = 'tactics',
}: TacticsGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'tactics' | 'condition' | 'attributes'>(initialTab);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="modal-panel flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0d141f] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-[#090e16] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-emerald-400" />
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                통합 전술 · 시너지 · 부상/사기 · 세부 능력치 도감
              </h2>
              <p className="text-[11px] text-slate-400">
                통합 전술 수싸움 원리, 9종 포메이션, 4원칙 시너지 &amp; 감독 궁합, 하프타임 AI 감독 대응을 안내합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top Tab Switcher */}
        <div className="shrink-0 border-b border-slate-800 bg-[#0a1018] px-4 sm:px-5 py-2.5">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 rounded-xl border border-slate-800 bg-slate-950/80 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('tactics')}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'tactics'
                  ? 'bg-slate-800 text-white border-emerald-500/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              통합 전술 &amp; 시너지
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('condition')}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'condition'
                  ? 'bg-slate-800 text-white border-emerald-500/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <HeartPulse className="h-3.5 w-3.5" />
              부상 &amp; 사기 가이드
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attributes')}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'attributes'
                  ? 'bg-slate-800 text-white border-emerald-500/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radar className="h-3.5 w-3.5" />
              세부 능력치 &amp; 득점 루트
            </button>
          </div>
        </div>

        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5">
          {activeTab === 'condition' ? (
            <InjuryMoraleGuideContent />
          ) : activeTab === 'attributes' ? (
            <AttributeRoutesGuideContent />
          ) : (
            <>
              {/* Section 1: Unified 2-Stage Tactical Matchup */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
                  <Compass className="w-4 h-4" />
                  1. 현실 축구형 통합 전술 수싸움 (2단계 평가)
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-[11px]">
                  <div className="rounded-xl border border-slate-800 bg-[#0a1019] p-3 space-y-1.5">
                    <div className="font-extrabold text-white">1단계 · 내부 전술 완성도 (0~100%)</div>
                    <p className="text-slate-400 leading-relaxed">
                      선택한 전술을 현재 포메이션·선발 11인 세부 능력치(PAS/CRO/DRI/DEF/PHY/AER/SHO)·플레이스타일·감독 스타일/OVR로 얼마나 구현할 수 있는지 평가합니다. 스쿼드와 맞지 않는 억지 전술은 수행력이 하락합니다.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#0a1019] p-3 space-y-1.5">
                    <div className="font-extrabold text-white">2단계 · 5대 경기 구역 맞대결</div>
                    <p className="text-slate-400 leading-relaxed">
                      고정 가위바위보 대신 양 팀의 전체 라인업이 <strong className="text-slate-200">중원 주도권 · 측면 공간 · 뒷공간·전환 · 박스·공중볼 · 압박·탈압박</strong> 5개 구역에서 부딪혀 점유율·찬스 창출·xG·수비 안정도에 직접 반영됩니다.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 2: 9 Formations Overview */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-300">
                  <Shield className="w-4 h-4" />
                  2. 9종 포메이션 전술 특성
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[11px]">
                  {FORMATION_LIST.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-xl border border-slate-800 bg-[#0a1019] p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-white">{f.name}</span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                          {f.shortTag}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-snug">{f.strengthSummary}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 3: Strict 4-Pillar Synergy & Separated Manager Compatibility */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                  <Sparkles className="w-4 h-4" />
                  3. 선수 시너지 4원칙 (2/4/8선 → +1/+2/+3) &amp; 감독 궁합 ★+1
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0a1019] p-3.5 space-y-3 text-[11px]">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-900/80 p-2.5 space-y-1">
                      <div className="font-bold text-emerald-300">① 같은 팀 · 전 소속팀 (1선)</div>
                      <p className="text-slate-400">
                        현재 동일 소속 구단 또는 과거 공식 1군 커리어상 같은 구단 인연 시 연결됩니다.
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 p-2.5 space-y-1">
                      <div className="font-bold text-sky-300">② 같은 국적 (1선)</div>
                      <p className="text-slate-400">
                        인접 슬롯에 동일 국적 선수를 배치하면 국적 케미선이 연결됩니다.
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 p-2.5 space-y-1">
                      <div className="font-bold text-amber-300">③ 스타일 궁합 (1선)</div>
                      <p className="text-slate-400">
                        크로스 윙어↔포처, 플레이메이커↔라인브레이커 등 상호 보완 스타일 조합 시 연결됩니다.
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 p-2.5 space-y-1">
                      <div className="font-bold text-purple-300">④ 엘리트 페어 OVR {ELITE_PAIR_MIN_OVR}+ (1선)</div>
                      <p className="text-slate-400">
                        인접한 두 선수 모두 기본 OVR {ELITE_PAIR_MIN_OVR} 이상일 때 엘리트 시너지선이 연결됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-400/25 bg-amber-500/5 p-2.5 text-slate-300">
                    <strong className="text-amber-300">★ 감독 궁합 &amp; 철학 (독립 보정):</strong> 선수 시너지(2/4/8선 → 최대 +3)와 별개로 감독 궁합 일치 선수 모두 <strong className="text-emerald-300">+1</strong>(최대 총 +4 · 노란 별 ★ 표시)을 받습니다. 전술형 감독은 궁합 선수 수(1~11명)와 ★추천 전술에 따라 팀 A/M/D가 실시간 상승하며, 스페셜리스트 감독은 포지션·하프타임·교체·빅매치·언더독·세트피스에서 고유 특색을 발휘합니다.
                  </div>

                  <div className="pt-1">
                    <div className="mb-1.5 text-[11px] font-bold text-slate-300">
                      대표 스타일 궁합 쌍
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {COMPLEMENTARY_STYLE_PAIRS.slice(0, 12).map(([s1, s2], i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-slate-200"
                        >
                          <span className="text-emerald-300">
                            {PLAYSTYLES[s1]?.shortName ?? s1}
                          </span>
                          <span className="text-slate-500">+</span>
                          <span className="text-sky-300">
                            {PLAYSTYLES[s2]?.shortName ?? s2}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: AI Managers & Halftime Mind-Games */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-300">
                  <Swords className="w-4 h-4" />
                  4. AI 감독 역량(OVR) &amp; 하프타임 실시간 수싸움
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0a1019] p-3 text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                  <p>
                    • 유럽 5대 리그 96구단, UCL 16구단, 명예의 전당 14팀 전부에 실제 감독의 <strong className="text-slate-200">지휘력 OVR(70~99)</strong>과 <strong className="text-slate-200">전술 스타일</strong>이 적용됩니다.
                  </p>
                  <p>
                    • 하프타임에 상대 AI 감독도 전반 스코어·xG·5대 구역 열세를 읽고 <strong className="text-slate-200">포메이션 전환 · 전술 변경 · 벤치 교체(최대 2명)</strong>를 능동적으로 시도합니다. 명장(OVR 88+)일수록 날카롭고 적극적인 카운터를 날립니다.
                  </p>
                  <p>
                    • 수석코치의 하프타임 조언은 <strong className="text-slate-200">전반 데이터 기준의 유력한 관점</strong>이며, 상대 감독이 후반에 역으로 전술을 비틀 수 있으므로 100% 확정 정답이 아닙니다.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

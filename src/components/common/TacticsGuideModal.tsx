import { ArrowRight, BookOpen, Compass, HeartPulse, Radar, Shield, Sparkles, Swords, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PLAYSTYLES } from '../../data/playstyles';
import { COMPLEMENTARY_STYLE_PAIRS } from '../../engine/chemistryEngine';
import {
  evaluateTacticMatchup,
  STYLE_VS_OPP_TACTIC,
  TACTIC_LIST,
  TACTICS,
} from '../../engine/tacticEngine';
import type { TacticId } from '../../types/league';
import type { PlaystyleId } from '../../types/player';
import { AttributeRoutesGuideContent } from '../guide/AttributeRoutesGuideContent';
import { InjuryMoraleGuideContent } from '../guide/InjuryMoraleGuideContent';

interface TacticsGuideModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'tactics' | 'condition' | 'attributes';
}

const TACTIC_ORDER: TacticId[] = [
  'possession',
  'wingplay',
  'counter',
  'gegenpressing',
  'balanced',
];

const CYCLE_ORDER: { id: TacticId; color: string; shortNote: string }[] = [
  { id: 'possession', color: 'border-sky-400/50 bg-sky-500/15 text-sky-200', shortNote: '점유로 측면 차단' },
  { id: 'wingplay', color: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200', shortNote: '폭 넓혀 역습 해체' },
  { id: 'counter', color: 'border-amber-400/50 bg-amber-500/15 text-amber-200', shortNote: '높은 라인 배후 침투' },
  { id: 'gegenpressing', color: 'border-orange-400/50 bg-orange-500/15 text-orange-200', shortNote: '후방 빌드업 압박' },
];

export function TacticsGuideModal({
  open,
  onClose,
  initialTab = 'tactics',
}: TacticsGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'tactics' | 'condition' | 'attributes'>(initialTab);

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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0d141f] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#090e16] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-emerald-400" />
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                전술 상성 · 부상/사기 · 세부 능력치 가이드
              </h2>
              <p className="text-[11px] text-slate-400">
                전술·플레이스타일 상성표, 부상·사기 보정, 세부 능력치 및 공격 루트를 한눈에 확인할 수 있습니다.
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
        <div className="border-b border-slate-800 bg-[#0a1018] px-4 sm:px-5 py-2.5">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 rounded-xl border border-slate-800 bg-slate-950/80 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('tactics')}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                activeTab === 'tactics'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              ⚔️ 전술 &amp; 플레이스타일 상성
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('condition')}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                activeTab === 'condition'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HeartPulse className="h-3.5 w-3.5" />
              🩺 부상 &amp; 사기 가이드
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attributes')}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                activeTab === 'attributes'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radar className="h-3.5 w-3.5" />
              📊 세부 능력치 &amp; 득점 루트
            </button>
          </div>
        </div>

        <div className="max-h-[76vh] overflow-y-auto p-4 sm:p-5 space-y-5">
          {activeTab === 'condition' ? (
            <InjuryMoraleGuideContent />
          ) : activeTab === 'attributes' ? (
            <AttributeRoutesGuideContent />
          ) : (
            <>
              {/* Section 1: 4-Tactic Rock-Paper-Scissors Cycle + Balanced */}
              <section className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
                  <Compass className="w-4 h-4" />
                  1. 5대 팀 전술 상성 순환도 &amp; 상성표
                </div>

            {/* Visual Cycle */}
            <div className="rounded-xl border border-slate-800 bg-[#0a1019] p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                {CYCLE_ORDER.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div
                      className={`rounded-xl border px-3 py-2 text-center ${item.color}`}
                    >
                      <div className="font-extrabold">{TACTICS[item.id].name}</div>
                      <div className="text-[10px] opacity-85">{item.shortNote}</div>
                    </div>
                    <div className="flex flex-col items-center text-[9px] font-black text-emerald-400">
                      <span>우위 +2.8</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    {idx === CYCLE_ORDER.length - 1 && (
                      <span className="rounded-lg border border-sky-400/40 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-bold text-sky-200">
                        ↻ 다시 점유율
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-center text-[11px] text-slate-400">
                <strong className="text-slate-200">밸런스(Balanced)</strong>는 뚜렷한 약점이 없는 무상성 기본형이지만,{' '}
                <span className="text-sky-300 font-semibold">점유율</span> 상대로는 주도권을 소폭 내줍니다 (-1.1).
              </div>
            </div>

            {/* Compact 5x5 Matrix */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0a1019]">
              <table className="w-full text-center text-[11px] tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <th className="py-2 px-2.5 text-left">내 전술 \ 상대 전술</th>
                    {TACTIC_ORDER.map((opp) => (
                      <th key={opp} className="py-2 px-2 font-bold text-slate-200">
                        {TACTICS[opp].shortName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {TACTIC_ORDER.map((mine) => (
                    <tr key={mine}>
                      <td className="py-2 px-2.5 text-left font-bold text-white bg-slate-950/35">
                        {TACTICS[mine].name}
                      </td>
                      {TACTIC_ORDER.map((opp) => {
                        const evalRes = evaluateTacticMatchup(mine, opp);
                        const cls =
                          evalRes.delta >= 2
                            ? 'bg-emerald-500/20 text-emerald-300 font-black'
                            : evalRes.delta > 0
                              ? 'bg-emerald-500/10 text-emerald-200 font-bold'
                              : evalRes.delta <= -2
                                ? 'bg-rose-500/20 text-rose-300 font-black'
                                : evalRes.delta < 0
                                  ? 'bg-rose-500/10 text-rose-200 font-bold'
                                  : 'text-slate-500';
                        return (
                          <td key={opp} className={`py-2 px-2 ${cls}`} title={evalRes.reason}>
                            {evalRes.delta > 0
                              ? `🟢 +${evalRes.delta.toFixed(1)}`
                              : evalRes.delta < 0
                                ? `🔴 ${evalRes.delta.toFixed(1)}`
                                : '⚪ 0.0'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 2: Counter Playstyles vs Opponent Tactic */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
              <Swords className="w-4 h-4" />
              2. 상대 전술별 추천 카운터 플레이스타일 (맞춤 선발 시 xG · 라인 보너스 발동)
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TACTIC_LIST.map((t) => {
                const counterMap = STYLE_VS_OPP_TACTIC[t.id];
                const entries = Object.entries(counterMap) as [
                  PlaystyleId,
                  { att?: number; mid?: number; def?: number; label: string },
                ][];
                return (
                  <div
                    key={t.id}
                    className="rounded-xl border border-slate-800 bg-[#0a1019] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-white">
                        상대가 [{t.name}]일 때
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        추천 전술:{' '}
                        {t.id === 'possession'
                          ? '게겐프레싱'
                          : t.id === 'gegenpressing'
                            ? '선수비 후역습'
                            : t.id === 'counter'
                              ? '측면 공략'
                              : '점유율'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {entries.map(([psId, info]) => (
                        <span
                          key={psId}
                          title={info.label}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200"
                        >
                          {PLAYSTYLES[psId]?.shortName ?? psId}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] leading-snug text-slate-400">
                      {entries
                        .slice(0, 2)
                        .map(([, info]) => info.label)
                        .join(' · ')}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 3: Complementary Playstyle Pairs & Individual Synergy OVR */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-300">
              <Sparkles className="w-4 h-4" />
              3. 인접 선수 케미 &amp; 개인 시너지 OVR (+1 ~ +3) 발동 조합
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0a1019] p-3.5 space-y-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[11px]">
                <div className="rounded-lg bg-slate-900/80 p-2.5">
                  <div className="font-bold text-amber-300">⭐ 감독 시너지 (+1 OVR)</div>
                  <p className="mt-0.5 text-slate-400">
                    내 감독 특성의 핵심 스타일/조건과 일치하는 선발 선수에게 즉시 +1 적용
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5">
                  <div className="font-bold text-emerald-300">🔗 인접 팀원 케미 (+1~+2 OVR)</div>
                  <p className="mt-0.5 text-slate-400">
                    연결선으로 맞닿은 동료와 동일 구단/레전드·국적·아래 궁합 스타일을 맞추면 최대 +2 적용
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5">
                  <div className="flex items-center gap-1 font-bold text-sky-300">
                    <Shield className="w-3 h-3" />
                    실전 경기 직결 (최대 +3)
                  </div>
                  <p className="mt-0.5 text-slate-400">
                    피치 카드에 표시된 녹색 +N 상승폭이 팀 ATT/MID/DEF와 경기 엔진에 그대로 반영됩니다.
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <div className="mb-1.5 text-[11px] font-bold text-slate-300">
                  대표 인접 플레이스타일 황금 궁합 쌍
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

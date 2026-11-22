import {
  Activity,
  AlertTriangle,
  Flame,
  HeartPulse,
  MessageSquare,
  RefreshCw,
  Snowflake,
  Sparkles,
} from 'lucide-react';
import { PixelStatusIcon } from '../common/PixelStatusIcon';

export function InjuryMoraleGuideContent() {
  return (
    <div className="space-y-4 text-xs leading-relaxed text-slate-300">
      {/* 1. One-Glance Effective OVR Formula Banner */}
      <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-r from-emerald-950/30 via-[#0b131e] to-sky-950/25 p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-white">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            1. 실효 OVR 통합 계산 공식 (피치 · 스쿼드 · 상세 카드 실시간 반영)
          </div>
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            코드 100% 동기화
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5 text-center">
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-2">
            <div className="text-[10px] font-bold text-slate-400">기본 OVR</div>
            <div className="mt-0.5 font-mono text-sm font-black text-white">
              선수 고유 능력치
            </div>
            <div className="text-[9px] text-slate-500">포지션 불일치 시 -3~-15</div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-2">
            <div className="text-[10px] font-bold text-emerald-300">시너지 보너스</div>
            <div className="mt-0.5 font-mono text-sm font-black text-emerald-300">
              +0 ~ +3
            </div>
            <div className="text-[9px] text-emerald-200/70">감독 강점 + 인접 케미</div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-2.5 py-2">
            <div className="text-[10px] font-bold text-amber-300">사기 보정</div>
            <div className="mt-0.5 font-mono text-sm font-black text-amber-300">
              -2 ~ +2
            </div>
            <div className="text-[9px] text-amber-200/70">최상🔥 +2 / 최악❄️ -2</div>
          </div>
          <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 px-2.5 py-2">
            <div className="text-[10px] font-bold text-rose-300">부상 · 후유증</div>
            <div className="mt-0.5 font-mono text-sm font-black text-rose-400">
              -1 ~ -4 / 결장
            </div>
            <div className="text-[9px] text-rose-200/70">경상 강행 · 완치 회복기</div>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-lg border border-sky-400/40 bg-sky-950/25 px-2.5 py-2">
            <div className="text-[10px] font-extrabold text-sky-300">
              → 최종 실효 OVR
            </div>
            <div className="mt-0.5 font-mono text-sm font-black text-white">
              경기 엔진 직결
            </div>
            <div className="text-[9px] text-sky-200/80">팀 ATT / MID / DEF 반영</div>
          </div>
        </div>
      </div>

      {/* 2. Injury Tiers & OVR Penalties + Auto Return Rule */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-white">
            <HeartPulse className="h-4 w-4 text-rose-400" />
            2. 부상 3등급 체계 · OVR 페널티 &amp; 완치 시 자동 선발 복귀 규칙
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
            <PixelStatusIcon variant="injury" size={12} />
            GK 부상 확률 0.35배 · 경기당 팀 신규 부상 최대 1명
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#080d14]">
          <table className="w-full text-left text-[11px] tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
                <th className="py-2 px-2.5">부상 등급</th>
                <th className="py-2 px-2 text-center">90분당 확률</th>
                <th className="py-2 px-2 text-center">결장 기간</th>
                <th className="py-2 px-2 text-center">출전 가능 여부</th>
                <th className="py-2 px-2.5">실효 OVR 페널티 &amp; 완치 후 회복기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-2.5 px-2.5 font-extrabold text-amber-300">
                  🩹 경상 (Minor)
                  <div className="text-[10px] font-normal text-slate-400">
                    햄스트링 경련 · 발목 타박상 등
                  </div>
                </td>
                <td className="py-2.5 px-2 text-center font-mono text-slate-300">
                  0.13%
                </td>
                <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-300">
                  1 ~ 3경기
                </td>
                <td className="py-2.5 px-2 text-center">
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    출전 강행 가능
                  </span>
                </td>
                <td className="py-2.5 px-2.5 text-slate-300">
                  • 출전 강행 시 잔여 경기수에 따라{' '}
                  <strong className="text-rose-400">OVR -2 ~ -4</strong> (1경기 -2 / 2경기 -3 / 3경기 -4)
                  <br />• 강행 출전 시 <strong className="text-rose-300">4% 확률로 악화</strong> · 발생 시 사기 -1 · 풀시즌 평균 ~0.7회
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-2.5 font-extrabold text-orange-300">
                  🩼 중상 (Moderate)
                  <div className="text-[10px] font-normal text-slate-400">
                    햄스트링 부분 파열 · 내측 인대 염좌
                  </div>
                </td>
                <td className="py-2.5 px-2 text-center font-mono text-slate-300">
                  0.011%
                </td>
                <td className="py-2.5 px-2 text-center font-mono font-bold text-orange-300">
                  4 ~ 8경기
                </td>
                <td className="py-2.5 px-2 text-center">
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                    출전 절대 불가
                  </span>
                </td>
                <td className="py-2.5 px-2.5 text-slate-300">
                  • 부상 중 선발 제외 필수 · 발생 시 사기 -2 · 약 16시즌당 1회 드문 변수
                  <br />• 완치 직후 <strong className="text-amber-300">2경기 회복기</strong> 적용: 복귀 1경기차{' '}
                  <strong className="text-rose-400">OVR -2</strong> → 2경기차{' '}
                  <strong className="text-rose-400">OVR -1</strong>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-2.5 font-extrabold text-rose-400">
                  🚑 장기 부상 (Severe)
                  <div className="text-[10px] font-normal text-slate-400">
                    십자인대(ACL) · 아킬레스건 · 골절
                  </div>
                </td>
                <td className="py-2.5 px-2 text-center font-mono text-slate-300">
                  0.0018%
                </td>
                <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-400">
                  18 ~ 28경기
                </td>
                <td className="py-2.5 px-2 text-center">
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                    출전 절대 불가
                  </span>
                </td>
                <td className="py-2.5 px-2.5 text-slate-300">
                  • 발생 시 본인 사기 -3 &amp; 팀 분위기 -1 · 초희귀 이벤트(약 100시즌당 1회)
                  <br />• 완치 직후 <strong className="text-amber-300">3경기 회복기</strong> 적용: 1경기차{' '}
                  <strong className="text-rose-400">OVR -3</strong> → 2경기차{' '}
                  <strong className="text-rose-400">OVR -2</strong> → 3경기차{' '}
                  <strong className="text-rose-400">OVR -1</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Auto Return Rule Box */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2.5 flex items-start gap-2.5">
          <RefreshCw className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-300">
            <strong className="text-emerald-300">
              완치 시 원래 선발 슬롯 자동 복귀 시스템:
            </strong>{' '}
            부상 발생 알림창에서 부상 주전을 벤치로 내리고 대체 선수를 투입하면 원래 선발 슬롯이 자동 저장되며, 잔여 결장이{' '}
            <code className="text-emerald-300 font-bold">0경기</code>가 되는 즉시{' '}
            <strong className="text-white">원래 선발 자리로 자동 복귀</strong>합니다.
          </div>
        </div>
      </div>

      {/* 3. Morale 5 Tiers & OVR Modifiers (v5.1 Strict Thresholds) */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-white">
            <Activity className="h-4 w-4 text-amber-400" />
            3. 개인 사기 5단계 &amp; 라커룸 분위기 실효 능력치 보정
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <PixelStatusIcon variant="morale_high" size={11} /> 최상(+5)
            </span>
            <span className="inline-flex items-center gap-1">
              <PixelStatusIcon variant="morale_low" size={11} /> 최악(-5)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-2.5">
            <div className="flex items-center justify-between font-extrabold text-amber-300">
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" /> 최상 (+5)
              </span>
              <span className="font-mono text-sm">+2 OVR</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-300">
              피치 불꽃 아이콘 · 고위험 인터뷰 대성공 시 도달 · 모든 스탯 +2
            </p>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2.5">
            <div className="flex items-center justify-between font-extrabold text-emerald-300">
              <span>상승 (+3~+4)</span>
              <span className="font-mono text-sm">+1 OVR</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              기자회견·연설 성공 또는 압도적 흐름 중첩 시 실효 OVR +1
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
            <div className="flex items-center justify-between font-bold text-slate-300">
              <span>보통 (-2~+2)</span>
              <span className="font-mono text-sm text-slate-400">0 OVR</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              일반 경기 승패 구간 · 능력치 증감 없음
            </p>
          </div>

          <div className="rounded-lg border border-sky-500/30 bg-sky-950/15 p-2.5">
            <div className="flex items-center justify-between font-extrabold text-sky-300">
              <span>저조 (-3~-4)</span>
              <span className="font-mono text-sm">-1 OVR</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              인터뷰 역풍·장기 연패·부상 충격 시 실효 OVR -1
            </p>
          </div>

          <div className="rounded-lg border border-sky-400/45 bg-sky-950/30 p-2.5">
            <div className="flex items-center justify-between font-extrabold text-sky-200">
              <span className="inline-flex items-center gap-1">
                <Snowflake className="h-3.5 w-3.5 text-sky-300" /> 최악 (-5)
              </span>
              <span className="font-mono text-sm text-sky-300">-2 OVR</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-300">
              피치 얼음 아이콘 · 치명적 역풍/연속 악재 시 모든 스탯 -2
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          • <strong className="text-slate-200">팀 라커룸 분위기 (-5 ~ +5)</strong>: 팀 분위기가{' '}
          <strong className="text-emerald-300">+5</strong>에 도달하면 출전 전원{' '}
          <strong className="text-emerald-300">+0.5 OVR</strong>,{' '}
          <strong className="text-rose-300">-5</strong>에 도달하면 전원{' '}
          <strong className="text-rose-300">-0.5 OVR</strong>이 추가 반영됩니다.
        </div>
      </div>

      {/* 4. Morale Triggers & High-Stakes Press Conference / Locker Room Events */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 font-extrabold text-emerald-300">
            <Flame className="h-4 w-4" />
            4. 경기 사기 변동 &amp; 자연 냉각 규칙
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-300">
            <li>
              • <strong className="text-slate-100">일반 경기 변동 축소</strong>: 단순 승리나 1골·1도움만으로는 OVR 보정 구간(±3 이상)에 진입하지 않으며, 사기는 기본적으로 <code className="text-slate-200">-2 ~ +2</code> 안정 구간에 머뭅니다.
            </li>
            <li>
              • <strong className="text-amber-300">대기록·극단적 흐름</strong>: MOM·해트트릭·평점 9.2+ 또는 4골차 대승·5연승+ 시 소폭(+1) 상승하며, 3연패·3골차 대패·평점 5.2 이하 시 소폭(-1) 하락합니다.
            </li>
            <li>
              • <strong className="text-amber-200">자연 냉각</strong>: <code>+5 🔥</code> 상태는 다음 경기 개인 맹활약이 없으면 <code>+4</code>로 냉각되며, <code>+3/+4</code> 역시 맹활약·대승이 없으면 서서히 안정 구간으로 복귀합니다.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 font-extrabold text-rose-300">
            <AlertTriangle className="h-4 w-4" />
            5. 기자회견 · 라커룸 연설 리스크-리턴 (핵심 사기 동력)
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-300">
            <li>
              • <strong className="text-rose-300">🔥 고위험 (하이리스크 · 하이리턴)</strong>: 도발·공개 질책·초강수 공약. 성공 시 사기{' '}
              <strong className="text-emerald-300">+3 ~ +4</strong> 폭등(즉시 <code>+5 🔥</code> OVR +2 도달 가능), 실패 시{' '}
              <strong className="text-rose-400">-2 ~ -3</strong> 큰 역풍.
            </li>
            <li>
              • <strong className="text-amber-300">⚡ 승부수 (중위험)</strong>: 성공 시 <strong className="text-emerald-300">+2</strong>(OVR +1 도달 가능), 실패 시 <strong className="text-rose-400">-1 ~ -2</strong>.
            </li>
            <li>
              • <strong className="text-slate-200">🛡️ 안정 (로우리스크)</strong>: 역풍 위험 0%. 소폭 상승(+1) 및 침체/빙결 선수 안정 회복.
            </li>
            <li className="flex items-start gap-1.5 pt-0.5">
              <MessageSquare className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
              <span>
                2~3경기 주기로 등장하는 72종 기자회견·라커룸 연설이 팀 사기 OVR 보정을 좌우하는 핵심 전략 구간입니다.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Flame,
  HeartPulse,
  MessageSquare,
  RefreshCw,
  Snowflake,
  Sparkles,
} from 'lucide-react';
import { ALL_MANAGER_EVENTS } from '../../data/managerEvents';
import { SEVERITY_LABELS } from '../../engine/conditionEngine';
import {
  MAX_MATCH_SUBS,
  TACTIC_STAMINA_MULT,
} from '../../engine/staminaEngine';
import { PixelStatusIcon } from '../common/PixelStatusIcon';

export function InjuryMoraleGuideContent() {
  const eventCount = ALL_MANAGER_EVENTS.length;

  return (
    <div className="space-y-4 pb-2 text-xs leading-relaxed text-slate-300 break-keep">
      {/* 1. One-Glance Effective OVR Formula Banner */}
      <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-r from-emerald-950/30 via-[#0b131e] to-sky-950/25 p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-white">
            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            1. 실효 OVR 통합 계산 공식 (피치 · 스쿼드 · 상세 카드 실시간 반영)
          </div>
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 whitespace-nowrap">
            엔진 공식 100% 동기화
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6 text-center">
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-2">
            <div className="text-[10px] font-bold text-slate-400">기본 OVR</div>
            <div className="mt-0.5 font-mono text-xs sm:text-sm font-black text-white">
              선수 고유 능력치
            </div>
            <div className="mt-0.5 text-[9.5px] text-slate-500">
              포지션 불일치 -3 ~ -15
            </div>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-2">
            <div className="text-[10px] font-bold text-emerald-300">
              인접 시너지
            </div>
            <div className="mt-0.5 font-mono text-xs sm:text-sm font-black text-emerald-300 whitespace-nowrap">
              +0 ~ +3
            </div>
            <div className="mt-0.5 text-[9.5px] text-emerald-200/75">
              2 / 4 / 8선 → +1 / +2 / +3
            </div>
          </div>

          <div className="rounded-lg border border-amber-400/35 bg-amber-950/20 px-2.5 py-2">
            <div className="text-[10px] font-bold text-amber-300">
              ★ 감독 궁합 (독립)
            </div>
            <div className="mt-0.5 font-mono text-xs sm:text-sm font-black text-amber-300 whitespace-nowrap">
              +0 ~ +1
            </div>
            <div className="mt-0.5 text-[9.5px] text-amber-200/75">
              시너지 합산 최대 +4
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 px-2.5 py-2">
            <div className="text-[10px] font-bold text-amber-300">사기 보정</div>
            <div className="mt-0.5 font-mono text-xs sm:text-sm font-black text-amber-300 whitespace-nowrap">
              -2 ~ +2
            </div>
            <div className="mt-0.5 text-[9.5px] text-amber-200/75">
              팀 ±5 시 전원 ±0.5 추가
            </div>
          </div>

          <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 px-2.5 py-2">
            <div className="text-[10px] font-bold text-rose-300">
              부상 · 회복기
            </div>
            <div className="mt-0.5 font-mono text-xs sm:text-sm font-black text-rose-400 whitespace-nowrap">
              -1 ~ -4 / 결장
            </div>
            <div className="mt-0.5 text-[9.5px] text-rose-200/75">
              경상 강행 · 완치 회복기
            </div>
          </div>

          <div className="rounded-lg border border-sky-400/40 bg-sky-950/25 px-2.5 py-2">
            <div className="text-[10px] font-extrabold text-sky-300">
              → 최종 실효 OVR
            </div>
            <div className="mt-0.5 font-mono text-xs sm:text-sm font-black text-white whitespace-nowrap">
              50 ~ 99 반영
            </div>
            <div className="mt-0.5 text-[9.5px] text-sky-200/80">
              경기 중 체력(-1.5~-6) 별도
            </div>
          </div>
        </div>
      </div>

      {/* 2. Injury Tiers & OVR Penalties + Auto Return Rule */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-white">
            <HeartPulse className="h-4 w-4 text-rose-400 shrink-0" />
            2. 부상 3등급 체계 · OVR 페널티 &amp; 완치 시 자동 선발 복귀
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
            <PixelStatusIcon variant="injury" size={12} />
            GK 부상 확률 0.35배 · 경기당 팀 신규 부상 최대 1명
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#080d14]">
          <table className="w-full min-w-[640px] text-left text-[11px] tabular-nums break-keep">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
                <th className="py-2.5 px-3 whitespace-nowrap">부상 등급</th>
                <th className="py-2.5 px-2.5 text-center whitespace-nowrap">
                  90분당 확률
                </th>
                <th className="py-2.5 px-2.5 text-center whitespace-nowrap">
                  결장 기간
                </th>
                <th className="py-2.5 px-2.5 text-center whitespace-nowrap">
                  출전 가능 여부
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap">
                  실효 OVR 페널티 &amp; 완치 후 회복기
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-2.5 px-3 font-extrabold text-amber-300 align-top whitespace-nowrap">
                  🩹 {SEVERITY_LABELS.minor} (Minor)
                  <div className="text-[10px] font-normal text-slate-400 whitespace-normal">
                    발목 염좌 · 햄스트링 뻐근함 · 타박상
                  </div>
                </td>
                <td className="py-2.5 px-2.5 text-center font-mono text-slate-300 align-top whitespace-nowrap">
                  0.13%
                </td>
                <td className="py-2.5 px-2.5 text-center font-mono font-bold text-amber-300 align-top whitespace-nowrap">
                  1 ~ 3경기
                </td>
                <td className="py-2.5 px-2.5 text-center align-top whitespace-nowrap">
                  <span className="inline-block whitespace-nowrap rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    출전 강행 가능
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-300 align-top leading-relaxed">
                  • 부상 유형별 고정{' '}
                  <strong className="text-rose-400 whitespace-nowrap">
                    OVR -2 ~ -4
                  </strong>{' '}
                  적용 (타박상 -2 / 염좌·긴장 -3 / 무릎 통증 -4)
                  <br />• 강행 출전 시{' '}
                  <strong className="text-rose-300">4% 확률로 악화</strong>{' '}
                  (악화 시 30% 중상 격상 · 70% 경상 +2경기 연장 및 페널티 -1 추가, 최대 -4)
                  <br />• 발생 시 사기 -1 · 완치 후 회복기 없음 · 풀시즌 평균 약 0.7회
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-extrabold text-orange-300 align-top whitespace-nowrap">
                  🩼 {SEVERITY_LABELS.moderate} (Moderate)
                  <div className="text-[10px] font-normal text-slate-400 whitespace-normal">
                    햄스트링 2도 파열 · MCL 손상 · 인대 부분 파열
                  </div>
                </td>
                <td className="py-2.5 px-2.5 text-center font-mono text-slate-300 align-top whitespace-nowrap">
                  0.011%
                </td>
                <td className="py-2.5 px-2.5 text-center font-mono font-bold text-orange-300 align-top whitespace-nowrap">
                  4 ~ 8경기
                </td>
                <td className="py-2.5 px-2.5 text-center align-top whitespace-nowrap">
                  <span className="inline-block whitespace-nowrap rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                    출전 절대 불가
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-300 align-top leading-relaxed">
                  • 부상 중 선발 제외 필수 · 발생 시 사기 -2 · 약 16시즌당 1회 드문 변수
                  <br />• 완치 직후{' '}
                  <strong className="text-amber-300 whitespace-nowrap">
                    2경기 회복기
                  </strong>
                  : 복귀 1경기차{' '}
                  <strong className="text-rose-400 whitespace-nowrap">
                    OVR -2
                  </strong>{' '}
                  → 2경기차{' '}
                  <strong className="text-rose-400 whitespace-nowrap">
                    OVR -1
                  </strong>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-extrabold text-rose-400 align-top whitespace-nowrap">
                  🚑 {SEVERITY_LABELS.severe} (Severe)
                  <div className="text-[10px] font-normal text-slate-400 whitespace-normal">
                    ACL 파열 · 아킬레스건 · 햄스트링 3도 · 중족골 골절
                  </div>
                </td>
                <td className="py-2.5 px-2.5 text-center font-mono text-slate-300 align-top whitespace-nowrap">
                  0.0018%
                </td>
                <td className="py-2.5 px-2.5 text-center font-mono font-bold text-rose-400 align-top whitespace-nowrap">
                  18 ~ 28경기
                </td>
                <td className="py-2.5 px-2.5 text-center align-top whitespace-nowrap">
                  <span className="inline-block whitespace-nowrap rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                    출전 절대 불가
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-300 align-top leading-relaxed">
                  • 발생 시 본인 사기 -3 &amp; 팀 라커룸 분위기 -1 · 초희귀 이벤트(약 100시즌당 1회)
                  <br />• 완치 직후{' '}
                  <strong className="text-amber-300 whitespace-nowrap">
                    3경기 회복기
                  </strong>
                  : 1경기차{' '}
                  <strong className="text-rose-400 whitespace-nowrap">
                    OVR -3
                  </strong>{' '}
                  → 2경기차{' '}
                  <strong className="text-rose-400 whitespace-nowrap">
                    OVR -2
                  </strong>{' '}
                  → 3경기차{' '}
                  <strong className="text-rose-400 whitespace-nowrap">
                    OVR -1
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Auto Return Rule Box */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-3 flex items-start gap-2.5">
          <RefreshCw className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed text-slate-300">
            <strong className="text-emerald-300">
              완치 시 원래 선발 슬롯 자동 복귀:
            </strong>{' '}
            부상 알림창에서 부상 주전을 벤치로 내리고 대체 선수를 투입하면 원래 선발 슬롯이 자동 기록되며, 잔여 결장이{' '}
            <code className="text-emerald-300 font-bold whitespace-nowrap">
              0경기
            </code>
            가 되는 즉시{' '}
            <strong className="text-white">원래 선발 자리로 자동 복귀</strong>
            합니다.
          </div>
        </div>
      </div>

      {/* 3. In-Match Stamina & Substitutions (staminaEngine.ts 100% synced) */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-white">
            <BatteryCharging className="h-4 w-4 text-emerald-400 shrink-0" />
            3. 경기 중 실시간 체력(STA) · 전술 소모 배율 &amp; 교체 규칙
          </div>
          <span className="rounded bg-slate-800/90 px-2 py-0.5 text-[10px] font-bold text-slate-300 whitespace-nowrap">
            경기당 최대 {MAX_MATCH_SUBS}명 교체 · 교체 아웃 재투입 불가
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 text-center tabular-nums">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2">
            <div className="text-[10px] font-bold text-emerald-300 whitespace-nowrap">
              체력 70% 이상
            </div>
            <div className="font-mono text-sm font-black text-emerald-200 mt-0.5 whitespace-nowrap">
              0 OVR
            </div>
            <div className="text-[9.5px] text-slate-400">정상 컨디션</div>
          </div>
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-950/15 p-2">
            <div className="text-[10px] font-bold text-yellow-300 whitespace-nowrap">
              체력 55 ~ 69%
            </div>
            <div className="font-mono text-sm font-black text-yellow-200 mt-0.5 whitespace-nowrap">
              -1.5 OVR
            </div>
            <div className="text-[9.5px] text-slate-400">소폭 피로</div>
          </div>
          <div className="rounded-lg border border-orange-500/30 bg-orange-950/15 p-2">
            <div className="text-[10px] font-bold text-orange-300 whitespace-nowrap">
              체력 40 ~ 54%
            </div>
            <div className="font-mono text-sm font-black text-orange-200 mt-0.5 whitespace-nowrap">
              -3.5 OVR
            </div>
            <div className="text-[9.5px] text-slate-400">피로 누적</div>
          </div>
          <div className="rounded-lg border border-rose-500/35 bg-rose-950/20 p-2">
            <div className="text-[10px] font-bold text-rose-300 whitespace-nowrap">
              체력 40% 미만
            </div>
            <div className="font-mono text-sm font-black text-rose-300 mt-0.5 whitespace-nowrap">
              -6.0 OVR
            </div>
            <div className="text-[9.5px] text-slate-400">방전 (교체 권장)</div>
          </div>
        </div>

        <ul className="space-y-1 text-[11px] text-slate-300">
          <li>
            • <strong className="text-slate-100">전술별 체력 소모 배율:</strong>{' '}
            게겐프레싱 <strong className="text-orange-300">{TACTIC_STAMINA_MULT.gegenpressing.toFixed(2)}배</strong> (게겐프레싱 전도사 감독 시 1.15배로 완화) · 측면 공략{' '}
            <strong className="text-slate-200">{TACTIC_STAMINA_MULT.wingplay.toFixed(2)}배</strong> · 점유율/밸런스{' '}
            <strong className="text-slate-200">{TACTIC_STAMINA_MULT.balanced.toFixed(2)}배</strong> · 선수비 후역습{' '}
            <strong className="text-emerald-300">{TACTIC_STAMINA_MULT.counter.toFixed(2)}배</strong>
          </li>
          <li>
            • <strong className="text-emerald-300">후반 신선 조커 효과:</strong>{' '}
            45&apos; 이후 투입되어 체력 80% 이상을 유지하는 필드 교체 선수는 기본{' '}
            <strong className="text-white">+1.4 OVR</strong> (교체 카드의 귀재 감독 시{' '}
            <strong className="text-amber-300">+3.0 OVR</strong>) 및 팀 xG 보너스를 얻습니다.
          </li>
          <li>
            • <strong className="text-slate-200">고속 스킵 자동 교체:</strong>{' '}
            빠른 진행 시에도 60&apos;~82&apos; 사이 피로도가 높은 필드 주전을 포지션 적합 벤치 선수로 3~5명 자동 교체합니다.
          </li>
        </ul>
      </div>

      {/* 4. Morale 5 Tiers & OVR Modifiers */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-white">
            <Activity className="h-4 w-4 text-amber-400 shrink-0" />
            4. 개인 사기 5단계 &amp; 라커룸 분위기 실효 능력치 보정
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <PixelStatusIcon variant="morale_high" size={11} /> 최상(+5)
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <PixelStatusIcon variant="morale_low" size={11} /> 최악(-5)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-2.5">
            <div className="flex items-center justify-between gap-1 font-extrabold text-amber-300">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Flame className="h-3.5 w-3.5 shrink-0" /> 최상 (+5)
              </span>
              <span className="font-mono text-xs sm:text-sm whitespace-nowrap">
                +2 OVR
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-300">
              피치 불꽃 아이콘 · 고위험 인터뷰 대성공 시 도달 · 전 스탯 +2
            </p>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2.5">
            <div className="flex items-center justify-between gap-1 font-extrabold text-emerald-300">
              <span className="whitespace-nowrap">상승 (+3~+4)</span>
              <span className="font-mono text-xs sm:text-sm whitespace-nowrap">
                +1 OVR
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              기자회견·연설 성공 또는 압도적 흐름 중첩 시 실효 OVR +1
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
            <div className="flex items-center justify-between gap-1 font-bold text-slate-300">
              <span className="whitespace-nowrap">보통 (-2~+2)</span>
              <span className="font-mono text-xs sm:text-sm text-slate-400 whitespace-nowrap">
                0 OVR
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              일반 경기 승패 구간 · 능력치 증감 없음
            </p>
          </div>

          <div className="rounded-lg border border-sky-500/30 bg-sky-950/15 p-2.5">
            <div className="flex items-center justify-between gap-1 font-extrabold text-sky-300">
              <span className="whitespace-nowrap">저조 (-3~-4)</span>
              <span className="font-mono text-xs sm:text-sm whitespace-nowrap">
                -1 OVR
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              인터뷰 역풍·장기 연패·부상 충격 시 실효 OVR -1
            </p>
          </div>

          <div className="rounded-lg border border-sky-400/45 bg-sky-950/30 p-2.5">
            <div className="flex items-center justify-between gap-1 font-extrabold text-sky-200">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Snowflake className="h-3.5 w-3.5 text-sky-300 shrink-0" /> 최악
                (-5)
              </span>
              <span className="font-mono text-xs sm:text-sm text-sky-300 whitespace-nowrap">
                -2 OVR
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-300">
              피치 얼음 아이콘 · 치명적 역풍·연속 악재 시 전 스탯 -2
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          • <strong className="text-slate-200">팀 라커룸 분위기 (-5 ~ +5):</strong>{' '}
          팀 분위기가 <strong className="text-emerald-300">+5</strong>에 도달하면
          출전 전원 <strong className="text-emerald-300">+0.5 OVR</strong>,{' '}
          <strong className="text-rose-300">-5</strong>에 도달하면 전원{' '}
          <strong className="text-rose-300">-0.5 OVR</strong>이 추가 반영됩니다.
        </div>
      </div>

      {/* 5. Morale Triggers & Press Conference / Locker Room Events */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 font-extrabold text-emerald-300">
            <Flame className="h-4 w-4 shrink-0" />
            5. 경기 사기 변동 &amp; 자연 냉각 규칙
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-300">
            <li>
              • <strong className="text-slate-100">안정 구간 유지:</strong> 일반
              승리·1골·1도움만으로는 <code className="text-slate-200">-2 ~ +2</code>{' '}
              구간을 넘지 않습니다. (음수 사기 해빙에는 기여)
            </li>
            <li>
              • <strong className="text-amber-300">상승·하락 트리거:</strong>{' '}
              MOM·해트트릭·평점 9.2+ (+1), 5연승+ 또는 3골차+ 승리 (+1), 8연승+·4골차+·빅매치
              3골차+ 대승(집단 폭발 +1). 반대로 3연패+·3골차+ 대패·빅매치 2골차+
              패배·평점 5.2 이하(-1), 건강한 주전급 4경기 연속 벤치 결장(-1, 이후 3경기마다 -1).
            </li>
            <li>
              • <strong className="text-amber-200">자연 냉각:</strong>{' '}
              <code>+5 🔥</code>는 다음 경기 개인 맹활약이 없으면 <code>+4</code>로,{' '}
              <code>+3/+4</code> 역시 맹활약·집단 폭발이 없으면 1씩 안정 구간으로
              복귀합니다.
            </li>
            <li>
              • <strong className="text-sky-300">FFP 2단계 &amp; 수석 코치 연동:</strong>{' '}
              드래프트 예산 15% 초과(FFP 2단계) 시 패배 사기 하락폭이 1단계 증가하며,{' '}
              <strong className="text-amber-300">라커룸·케미 코치</strong>는 패배 사기 하락 1단계 방어,{' '}
              <strong className="text-pink-300">슈퍼서브·피지컬 코치</strong>는 65&apos; 이후 체력 소모 -25% 및 교체 투입 선수 OVR +3.0을 제공합니다.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 font-extrabold text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            6. 기자회견 · 라커룸 연설 ({eventCount}종) 리스크-리턴
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-300">
            <li>
              • <strong className="text-rose-300">🔥 고위험:</strong> 도발·공개
              질책·초강수 공약. 성공 시 사기{' '}
              <strong className="text-emerald-300">+3 ~ +4</strong> 폭등(즉시{' '}
              <code>+5 🔥</code> OVR +2 도달 가능), 실패 시{' '}
              <strong className="text-rose-400">-2 ~ -3</strong> 역풍.
            </li>
            <li>
              • <strong className="text-amber-300">⚡ 승부수:</strong> 성공 시{' '}
              <strong className="text-emerald-300">+2</strong>(OVR +1 도달 가능),
              실패 시 <strong className="text-rose-400">-1 ~ -2</strong>.
            </li>
            <li>
              • <strong className="text-slate-200">🛡️ 안정:</strong> 역풍 위험
              0%. 소폭 상승(+1) 및 침체·빙결 선수 안정 회복.
            </li>
            <li className="flex items-start gap-1.5 pt-0.5">
              <MessageSquare className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
              <span>
                싱글플레이는 최소 2경기 쿨다운(2경기 30% · 3경기 65% · 4경기+ 100%)으로,
                멀티 리그는 8라운드 쿨다운 · 시즌 최대 4회로 등장합니다.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

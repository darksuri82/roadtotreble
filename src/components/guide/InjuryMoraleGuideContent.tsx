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
                  0.42%
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
                  <br />• 강행 출전 시 <strong className="text-rose-300">6% 확률로 중상(4~8경기) 악화</strong> · 발생 시 사기 -1 · 후유증 없음
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
                  0.030%
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
                  • 부상 중 선발 제외 필수 · 발생 시 사기 -2
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
                  0.006%
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
                  • 발생 시 본인 사기 -3 &amp; 팀 분위기 -1
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
            부상 발생 알림창(포메이션 교체 화면)에서 부상당한 주전을 벤치로 내리고 대체 선수를 투입하면 원래 선발 슬롯 번호(0~10번)가 자동 저장됩니다. 이후 정규리그·챔피언스리그(UCL)·고속진행 어디서든 잔여 결장이{' '}
            <code className="text-emerald-300 font-bold">0경기</code>가 되어 완치되는 즉시{' '}
            <strong className="text-white">원래 선발 자리로 자동 복귀</strong>하며 상단 복귀 알림 배너가 표시됩니다.
          </div>
        </div>
      </div>

      {/* 3. Morale 5 Tiers & OVR Modifiers */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-white">
            <Activity className="h-4 w-4 text-amber-400" />
            3. 개인 사기 5단계 &amp; 라커룸 분위기 실효 능력치 보정
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <PixelStatusIcon variant="morale_high" size={11} /> 최상(+4~+5)
            </span>
            <span className="inline-flex items-center gap-1">
              <PixelStatusIcon variant="morale_low" size={11} /> 최악(-4~-5)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-2.5">
            <div className="flex items-center justify-between font-extrabold text-amber-300">
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" /> 최상 (+4~+5)
              </span>
              <span className="font-mono text-sm">+2 OVR</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-300">
              피치 불꽃 아이콘 표시 · 모든 스탯 +2 · 트레이드 가치 +4%
            </p>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-2.5">
            <div className="flex items-center justify-between font-extrabold text-emerald-300">
              <span>상승 (+2~+3)</span>
              <span className="font-mono text-sm">+1 OVR</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              좋은 폼 유지 · 실효 OVR +1 상승 (일반 승리·클린시트 상한선)
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
            <div className="flex items-center justify-between font-bold text-slate-300">
              <span>보통 (-1~+1)</span>
              <span className="font-mono text-sm text-slate-400">0 OVR</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              기본 컨디션 상태 · 능력치 증감 없음
            </p>
          </div>

          <div className="rounded-lg border border-sky-500/30 bg-sky-950/15 p-2.5">
            <div className="flex items-center justify-between font-extrabold text-sky-300">
              <span>저조 (-2~-3)</span>
              <span className="font-mono text-sm">-1 OVR</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              연패·부진·벤치 소외 초기 단계 · 실효 OVR -1 하락
            </p>
          </div>

          <div className="rounded-lg border border-sky-400/45 bg-sky-950/30 p-2.5">
            <div className="flex items-center justify-between font-extrabold text-sky-200">
              <span className="inline-flex items-center gap-1">
                <Snowflake className="h-3.5 w-3.5 text-sky-300" /> 최악 (-4~-5)
              </span>
              <span className="font-mono text-sm text-sky-300">-2 OVR</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-300">
              피치 얼음 아이콘 표시 · 모든 스탯 -2 · 트레이드 가치 -6%
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          • <strong className="text-slate-200">팀 라커룸 분위기 (-5 ~ +5)</strong>: 팀 분위기가{' '}
          <strong className="text-emerald-300">+4 ~ +5</strong>이면 출전 선수 전원에게{' '}
          <strong className="text-emerald-300">+0.5 OVR</strong>,{' '}
          <strong className="text-rose-300">-4 ~ -5</strong>이면 전원에게{' '}
          <strong className="text-rose-300">-0.5 OVR</strong>이 추가 반영됩니다.
        </div>
      </div>

      {/* 4. Morale Triggers, Flame Gate, and Press Conference / Locker Room Events */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 font-extrabold text-emerald-300">
            <Flame className="h-4 w-4" />
            4. 사기 상승 조건 &amp; 🔥 불꽃 진입 · 냉각 규칙
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-300">
            <li>
              • <strong className="text-amber-300">개인 맹활약 (불꽃 직행 가능)</strong>: 경기 MOM 선정{' '}
              <strong className="text-emerald-300">+3</strong> / 멀티골(2골+)·평점 9.0+{' '}
              <strong className="text-emerald-300">+2</strong> / 1골·1도움·평점 7.8+{' '}
              <strong className="text-emerald-300">+1</strong>
            </li>
            <li>
              • <strong className="text-sky-300">수비 클린시트 히어로</strong>: 무실점 승리 시 최고 평점 GK·DF{' '}
              <strong>단 1명(평점 7.0+)</strong>만 <strong className="text-emerald-300">+1</strong> (수비진 전체 일괄 상승 방지)
            </li>
            <li>
              • <strong className="text-emerald-300">팀 연승 · 대승 보너스</strong>: 4골차+ 대승 · 7연승+ · 빅매치 3골차+ 승리 시 출전 전원{' '}
              <strong>+2</strong> (벤치 +1) / 3골차 승리 · 4~6연승 · 빅매치 승리 시 출전 <strong>+1</strong>
            </li>
            <li>
              • <strong className="text-amber-200">🔥 불꽃(+4~+5) 진입 게이트 &amp; 자연 냉각</strong>: 일반 승리·클린시트만으로는 최대{' '}
              <code>+3(상승)</code>까지만 도달합니다. 불꽃 상태였던 선수가 다음 경기에서 골·도움·MOM·평점 7.8+ 없이 평범하게 마치면 경기 후{' '}
              <strong className="text-slate-100">+3(상승)으로 자연 냉각</strong>됩니다.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 font-extrabold text-rose-300">
            <AlertTriangle className="h-4 w-4" />
            5. 사기 하락 조건 &amp; 기자회견 · 라커룸 연설 (72종)
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-300">
            <li>
              • <strong className="text-rose-300">경기 부진 &amp; 부상 충격</strong>: 경기 평점 5.3 이하{' '}
              <strong className="text-rose-400">-2</strong> / 5.9 이하{' '}
              <strong className="text-rose-400">-1</strong> / 부상 발생 시 등급에 따라{' '}
              <strong className="text-rose-400">-1 ~ -3</strong>
            </li>
            <li>
              • <strong className="text-amber-300">주전급 연속 벤치 소외</strong>: 부상이 없는 주전급(팀 내 기본 OVR 상위 11위 이내) 선수가{' '}
              <strong className="text-rose-300">3경기 연속 벤치 결장 시 -1</strong> (이후 2경기마다 추가 -1)
            </li>
            <li>
              • <strong className="text-rose-300">연패 · 참패 충격</strong>: 2연패 이상 출전 전원{' '}
              <strong className="text-rose-400">-1</strong> / 3골차 이상 대패{' '}
              <strong className="text-rose-400">-2</strong> (벤치 -1) / 라이벌·빅매치 패배 시 추가{' '}
              <strong className="text-rose-400">-1</strong>
            </li>
            <li className="flex items-start gap-1.5 pt-0.5">
              <MessageSquare className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-sky-300">72종 기자회견(36종) · 라커룸 연설(36종)</strong>: 모든 선택지에 대성공(+1~+2)과{' '}
                <strong className="text-rose-300">역효과(사기 -1~-3) 리스크 확률</strong>이 함께 존재하므로 상황에 맞는 화법을 선택해야 합니다.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

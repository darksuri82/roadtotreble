import { Compass, Flame, Radar, Shield, Sparkles, Target, Zap } from 'lucide-react';

export function AttributeRoutesGuideContent() {
  return (
    <div className="space-y-4 text-xs leading-relaxed text-slate-300">
      {/* 1. Sub-Attributes System Overview */}
      <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-r from-emerald-950/30 via-[#0b131e] to-cyan-950/25 p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-white">
            <Radar className="h-4 w-4 text-emerald-400" />
            1. 선수 세부 능력치 체계 (필드 7대 항목 · GK 5대 항목 · OVR 정합성 ±2)
          </div>
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            전 선수 2,239명 적용
          </span>
        </div>

        <p className="text-[11px] text-slate-300">
          단일 OVR만으로는 구분되지 않던 선수 개성(예: 결정력형 9번 vs 크로스·스루패스 창조형 vs 폭발적 드리블러)을{' '}
          <strong className="text-white">세부 능력치(40~99)</strong>로 세분화했습니다. 선수 상세 모달에서 레이더 차트와 스탯 바, 아키타입 배지를 확인할 수 있으며 시너지·사기·부상으로 변동된 실효 OVR이 세부 능력치에도 그대로 반영됩니다.
        </p>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
            <div className="font-mono text-[11px] font-black text-rose-300">SHO · 슈팅/결정력</div>
            <div className="mt-0.5 text-[10px] text-slate-400">박스 마무리, 중거리 슛, 승부차기·PK 성공률</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
            <div className="font-mono text-[11px] font-black text-sky-300">PAS · 패스/시야</div>
            <div className="mt-0.5 text-[10px] text-slate-400">스루패스, 티키타카 연계, 점유율·도움 확률</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
            <div className="font-mono text-[11px] font-black text-cyan-300">CRO · 크로스/킥</div>
            <div className="mt-0.5 text-[10px] text-slate-400">얼리 크로스, 컷백, 코너킥·직접 프리킥</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
            <div className="font-mono text-[11px] font-black text-amber-300">DRI · 드리블/돌파</div>
            <div className="mt-0.5 text-[10px] text-slate-400">원맨 드리블 쇼, 1대1 돌파, PK 유도</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
            <div className="font-mono text-[11px] font-black text-orange-300">AER · 헤더/공중볼</div>
            <div className="mt-0.5 text-[10px] text-slate-400">크로스·코너킥 헤더 경합, 공중볼 수비</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
            <div className="font-mono text-[11px] font-black text-emerald-300">DEF · 수비/태클</div>
            <div className="mt-0.5 text-[10px] text-slate-400">드리블 차단, 슈팅 블록, 1대1 대인 방어</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
            <div className="font-mono text-[11px] font-black text-violet-300">PHY · 스피드/피지컬</div>
            <div className="mt-0.5 text-[10px] text-slate-400">역습 침투 가속, 몸싸움, 압박 강도</div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2">
            <div className="font-mono text-[11px] font-black text-amber-200">GK · 5대 전문 스탯</div>
            <div className="mt-0.5 text-[10px] text-amber-100/80">DIV·HAN·REF·KIC(빌드업)·POS</div>
          </div>
        </div>
      </div>

      {/* 2. Staged Attack Chain & Scoring/Assist Routes */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-white">
            <Target className="h-4 w-4 text-amber-400" />
            2. 단계별 공격 체인 &amp; 다채로운 득점 · 어시스트 루트
          </div>
          <span className="text-[10px] text-slate-400">
            빌드업 → 찬스 루트 → 창출자(PAS/CRO/DRI) → 수비 경합(DEF/AER) → 마무리(SHO/AER)
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#080d14]">
          <table className="w-full text-left text-[11px] tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
                <th className="py-2 px-2.5">공격 루트</th>
                <th className="py-2 px-2">핵심 공격 능력치</th>
                <th className="py-2 px-2">상대 수비 경합</th>
                <th className="py-2 px-2.5">특징 &amp; 강화 전술</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-2 px-2.5 font-bold text-amber-300">🔥 원맨 드리블 쇼</td>
                <td className="py-2 px-2 font-mono text-slate-200">DRI · PHY · SHO</td>
                <td className="py-2 px-2 font-mono text-slate-400">수비수 DEF</td>
                <td className="py-2 px-2.5 text-slate-300">
                  측면·하프스페이스에서 수비 1~3명을 단독 드리블로 제치고 마무리 (단독 골 비중 높음)
                </td>
              </tr>
              <tr>
                <td className="py-2 px-2.5 font-bold text-cyan-300">🎯 얼리 크로스 · 컷백</td>
                <td className="py-2 px-2 font-mono text-slate-200">CRO · DRI → AER · SHO</td>
                <td className="py-2 px-2 font-mono text-slate-400">수비수 AER · DEF</td>
                <td className="py-2 px-2.5 text-slate-300">
                  측면 윙어·윙백의 높은 어시스트 비중, 9번 스트라이커의 헤더·발리·논스톱 마무리 (<strong className="text-emerald-300">측면 공략</strong> 강화)
                </td>
              </tr>
              <tr>
                <td className="py-2 px-2.5 font-bold text-emerald-300">⚡ 티키타카 · 스루패스</td>
                <td className="py-2 px-2 font-mono text-slate-200">PAS → PHY · SHO</td>
                <td className="py-2 px-2 font-mono text-slate-400">수비 라인 · GK</td>
                <td className="py-2 px-2.5 text-slate-300">
                  삼각형 원투패스 및 하프스페이스 킬패스 1대1 침투·칩슛 (<strong className="text-sky-300">점유율</strong> 강화)
                </td>
              </tr>
              <tr>
                <td className="py-2 px-2.5 font-bold text-orange-300">💨 압박 탈취 · 고속 역습</td>
                <td className="py-2 px-2 font-mono text-slate-200">PHY · PAS · SHO</td>
                <td className="py-2 px-2 font-mono text-slate-400">수비 복귀 속도</td>
                <td className="py-2 px-2.5 text-slate-300">
                  게겐프레싱 탈취 직후 속공 또는 낮은 블록 탈취 후 롱볼 뒷공간 침투 (<strong className="text-orange-300">게겐·역습</strong> 강화)
                </td>
              </tr>
              <tr>
                <td className="py-2 px-2.5 font-bold text-sky-300">🚀 중거리 · 컷인 감아차기</td>
                <td className="py-2 px-2 font-mono text-slate-200">SHO · DRI</td>
                <td className="py-2 px-2 font-mono text-slate-400">GK DIV · REF</td>
                <td className="py-2 px-2.5 text-slate-300">
                  2선 미드필더의 아크 정면 대포알 슈팅 및 인버티드 윙어의 파포스트 감아차기
                </td>
              </tr>
              <tr>
                <td className="py-2 px-2.5 font-bold text-rose-300">🚩 코너킥 · 프리킥 · PK</td>
                <td className="py-2 px-2 font-mono text-slate-200">CRO · AER · SHO</td>
                <td className="py-2 px-2 font-mono text-slate-400">수비 AER · GK</td>
                <td className="py-2 px-2.5 text-slate-300">
                  제공권 센터백·9번의 코너킥 헤더, 키커의 직접 프리킥, 크랙 드리블러의 PK 유도
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Realistic Player Archetype Balance */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5 font-extrabold text-white">
          <Sparkles className="h-4 w-4 text-sky-400" />
          3. 선수 유형(아키타입)별 자연스러운 골 · 도움 균형
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[11px]">
          <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5 space-y-1">
            <div className="flex items-center gap-1 font-bold text-rose-300">
              <Flame className="h-3.5 w-3.5" />
              정통 9번 / 완성형 스트라이커
            </div>
            <p className="text-slate-400">
              최상위 <code className="text-slate-200">SHO·AER·PHY</code>와 박스 점유 계수로 크로스 헤더·원터치·리바운드 득점 비중이 가장 높습니다. 연계형 9번은 어시스트도 함께 생산합니다.
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5 space-y-1">
            <div className="flex items-center gap-1 font-bold text-cyan-300">
              <Zap className="h-3.5 w-3.5" />
              크랙 &amp; 찬스메이커 윙어 · 10번
            </div>
            <p className="text-slate-400">
              뛰어난 <code className="text-slate-200">PAS·CRO·DRI</code>로 어시스트 창출 확률이 크게 높아지되, 준수한 <code className="text-slate-200">SHO</code>를 유지해 컷인 감아차기·침투 골도 자연스럽게 기록합니다.
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5 space-y-1">
            <div className="flex items-center gap-1 font-bold text-emerald-300">
              <Shield className="h-3.5 w-3.5" />
              수비수 · 윙백 · 골키퍼
            </div>
            <p className="text-slate-400">
              오버래핑 윙백은 크로스 도움, 볼플레잉 CB는 대각선 전환, 스토퍼 CB는 코너킥 헤더 골, 스위퍼 키퍼는 후방 빌드업과 승부차기 선방에 기여합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 4. 2D Tactical Pitch Movement */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
        <div className="flex items-center gap-1.5 font-extrabold text-white">
          <Compass className="h-4 w-4 text-emerald-400" />
          4. 전술별 2D 피치 빌드업 · 오프더볼 · 수비 조직력 움직임
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[11px] text-slate-300">
          <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5">
            <strong className="text-sky-300">점유율 (티키타카)</strong>: GK가 전진해 후방 빌드업에 가담하고 풀백이 하프스페이스로 인버티드 진입, 삼각형 짧은 패스 연계를 전개합니다.
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5">
            <strong className="text-orange-300">게겐프레싱</strong>: 높은 수비 라인과 공 주변 3인 압박 트랩을 형성해 볼 탈취 직후 즉각 수직 전진합니다.
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5">
            <strong className="text-amber-300">선수비 후역습</strong>: 중앙을 좁힌 낮은 블록으로 수비하다가 탈취 즉시 빠른 윙어·ST에게 뒷공간 롱볼을 찔러줍니다.
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#111822] p-2.5">
            <strong className="text-emerald-300">측면 공략</strong>: 풀백이 터치라인으로 깊게 오버래핑하고, 윙어가 안쪽으로 좁히며 최전방 공격수가 박스로 쇄도해 크로스를 노립니다.
          </div>
        </div>
      </div>
    </div>
  );
}

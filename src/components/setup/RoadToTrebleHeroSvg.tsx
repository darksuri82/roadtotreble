import {
  getPixelTrophyRects,
  type PixelTrophyVariant,
} from '../common/PixelTrophySvg';

interface RoadToTrebleHeroSvgProps {
  className?: string;
}

const EPL_TROPHY = getPixelTrophyRects('epl_league');
const CUP_TROPHY = getPixelTrophyRects('fa_cup');
const UCL_TROPHY = getPixelTrophyRects('ucl');

function EmbeddedPixelTrophy({
  data,
  x,
  y,
  scale = 1,
  variantKey,
}: {
  data: ReturnType<typeof getPixelTrophyRects>;
  x: number;
  y: number;
  scale?: number;
  variantKey: PixelTrophyVariant;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {data.rects.map((r, idx) => (
        <rect
          key={`${variantKey}-${idx}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={r.fill}
        />
      ))}
    </g>
  );
}

/**
 * High-detail retro-modern pixel-art illustration of the "Road To Treble":
 * Keeps the charming winding stadium road concept while restoring authentic
 * 24x28 detailed pixel-art trophies (EPL Crown Trophy, FA Cup Spire Trophy,
 * and oversized glowing Big Ears UCL Trophy) with crisp metallic highlights.
 */
export function RoadToTrebleHeroSvg({
  className = '',
}: RoadToTrebleHeroSvgProps) {
  return (
    <svg
      viewBox="0 0 240 94"
      role="img"
      aria-label="드래프트에서 EPL 리그 트로피, 자국 컵 트로피, 챔피언스리그 빅이어 정상으로 이어지는 트레블 로드 픽셀 일러스트"
      shapeRendering="crispEdges"
      className={`block w-full h-auto select-none ${className}`}
    >
      {/* 1. Night Stadium Twilight Sky */}
      <rect x="0" y="0" width="240" height="22" fill="#080f1b" />
      <rect x="0" y="22" width="240" height="17" fill="#0c172a" />
      <rect x="0" y="39" width="240" height="15" fill="#112138" />
      <rect x="0" y="54" width="240" height="40" fill="#0d3627" />

      {/* Crisp Pixel Stars */}
      <rect x="14" y="7" width="1" height="1" fill="#94a3b8" />
      <rect x="33" y="13" width="1" height="1" fill="#e2e8f0" />
      <rect x="57" y="6" width="1" height="1" fill="#fde68a" />
      <rect x="86" y="10" width="1" height="1" fill="#94a3b8" />
      <rect x="112" y="5" width="1" height="1" fill="#e2e8f0" />
      <rect x="144" y="9" width="1" height="1" fill="#94a3b8" />
      <rect x="169" y="6" width="1" height="1" fill="#fde68a" />
      <rect x="226" y="8" width="1" height="1" fill="#e2e8f0" />
      {/* Cross Twinkles near Summit */}
      <rect x="181" y="8" width="1" height="3" fill="#fef08a" />
      <rect x="180" y="9" width="3" height="1" fill="#fef08a" />
      <rect x="219" y="13" width="1" height="3" fill="#fde047" />
      <rect x="218" y="14" width="3" height="1" fill="#fde047" />
      <rect x="200" y="5" width="1" height="3" fill="#ffffff" />
      <rect x="199" y="6" width="3" height="1" fill="#ffffff" />

      {/* Distant Stadium Floodlight Towers & Arena Bowl */}
      <rect x="44" y="22" width="2" height="26" fill="#1e293b" />
      <rect x="40" y="18" width="10" height="5" fill="#334155" />
      <rect x="41" y="19" width="3" height="2" fill="#fef9c3" />
      <rect x="46" y="19" width="3" height="2" fill="#fef9c3" />
      <rect x="36" y="23" width="18" height="4" fill="#fef08a" opacity="0.08" />
      <rect x="32" y="27" width="26" height="6" fill="#fef08a" opacity="0.04" />

      <rect x="162" y="24" width="2" height="22" fill="#1e293b" />
      <rect x="158" y="20" width="10" height="4" fill="#334155" />
      <rect x="159" y="21" width="3" height="2" fill="#fef9c3" />
      <rect x="164" y="21" width="3" height="2" fill="#fef9c3" />
      <rect x="154" y="24" width="18" height="5" fill="#fef08a" opacity="0.07" />

      {/* Distant Stadium Roof Silhouette */}
      <rect x="66" y="42" width="44" height="8" fill="#16263d" />
      <rect x="69" y="40" width="38" height="2" fill="#233754" />
      <rect x="73" y="44" width="3" height="1" fill="#38bdf8" opacity="0.45" />
      <rect x="82" y="44" width="3" height="1" fill="#38bdf8" opacity="0.45" />
      <rect x="91" y="44" width="3" height="1" fill="#38bdf8" opacity="0.45" />
      <rect x="100" y="44" width="3" height="1" fill="#38bdf8" opacity="0.45" />

      {/* 2. Layered Emerald Pitch Hills */}
      <rect x="0" y="51" width="58" height="8" fill="#0f3d2d" />
      <rect x="58" y="48" width="60" height="11" fill="#0f3d2d" />
      <rect x="118" y="44" width="56" height="15" fill="#0f3d2d" />
      <rect x="174" y="38" width="66" height="21" fill="#114634" />

      {/* Mid Striped Emerald Turf */}
      <rect x="0" y="58" width="240" height="36" fill="#124e38" />
      <rect x="0" y="58" width="24" height="36" fill="#155840" />
      <rect x="48" y="58" width="24" height="36" fill="#155840" />
      <rect x="96" y="55" width="24" height="39" fill="#155840" />
      <rect x="144" y="51" width="24" height="43" fill="#155840" />
      <rect x="174" y="46" width="66" height="48" fill="#165e44" />
      <rect x="196" y="46" width="22" height="48" fill="#1a6d4f" />

      {/* Hill Ridge Highlights */}
      <rect x="0" y="56" width="66" height="2" fill="#1a6c4e" />
      <rect x="66" y="53" width="56" height="2" fill="#1a6c4e" />
      <rect x="122" y="49" width="52" height="2" fill="#1c7554" />
      <rect x="174" y="44" width="66" height="2" fill="#228761" />

      {/* Foreground Touchline Accent */}
      <rect x="0" y="88" width="240" height="1" fill="#34d399" opacity="0.22" />

      {/* 3. Winding Golden-Cream "Road To Treble" */}
      {/* Road Shadow Border */}
      <rect x="0" y="77" width="46" height="10" fill="#473827" />
      <rect x="38" y="73" width="32" height="10" fill="#473827" />
      <rect x="64" y="69" width="36" height="10" fill="#473827" />
      <rect x="94" y="65" width="34" height="10" fill="#473827" />
      <rect x="122" y="61" width="34" height="10" fill="#473827" />
      <rect x="150" y="56" width="32" height="10" fill="#473827" />
      <rect x="176" y="51" width="52" height="10" fill="#5c4520" />

      {/* Road Main Surface */}
      <rect x="0" y="78" width="45" height="8" fill="#d6c29f" />
      <rect x="39" y="74" width="30" height="8" fill="#dcc8a3" />
      <rect x="65" y="70" width="34" height="8" fill="#e2cfab" />
      <rect x="95" y="66" width="32" height="8" fill="#e8d6b0" />
      <rect x="123" y="62" width="32" height="8" fill="#efdca8" />
      <rect x="151" y="57" width="30" height="8" fill="#f5e29d" />
      <rect x="177" y="52" width="50" height="8" fill="#fde047" />

      {/* Stepping Stone Highlights */}
      <rect x="8" y="81" width="6" height="2" fill="#f3e9d2" />
      <rect x="22" y="81" width="6" height="2" fill="#f3e9d2" />
      <rect x="47" y="77" width="6" height="2" fill="#f5ecd6" />
      <rect x="76" y="73" width="7" height="2" fill="#f7efda" />
      <rect x="106" y="69" width="6" height="2" fill="#faf1d6" />
      <rect x="134" y="65" width="7" height="2" fill="#fef3c7" />
      <rect x="160" y="60" width="7" height="2" fill="#fef08a" />
      <rect x="184" y="55" width="34" height="2" fill="#fef9c3" />

      {/* 4. Milestone 1 (Draft Start): Corner Flag + Chibi Pixel Manager + Pixel Ball */}
      <rect x="11" y="58" width="2" height="20" fill="#e2e8f0" />
      <rect x="13" y="58" width="8" height="5" fill="#10b981" />
      <rect x="15" y="59" width="3" height="2" fill="#a7f3d0" />

      {/* Cute Chibi Pixel Manager */}
      <rect x="24" y="79" width="9" height="2" fill="#8b7355" opacity="0.65" />
      <rect x="25" y="76" width="3" height="3" fill="#0f172a" />
      <rect x="29" y="76" width="3" height="3" fill="#0f172a" />
      <rect x="25" y="72" width="3" height="4" fill="#1e293b" />
      <rect x="29" y="72" width="3" height="4" fill="#1e293b" />
      <rect x="24" y="66" width="9" height="6" fill="#0f172a" />
      <rect x="25" y="66" width="7" height="6" fill="#1e293b" />
      <rect x="28" y="66" width="1" height="5" fill="#f8fafc" />
      <rect x="28" y="68" width="1" height="3" fill="#10b981" />
      <rect x="33" y="68" width="4" height="4" fill="#b45309" />
      <rect x="34" y="69" width="2" height="2" fill="#fef3c7" />
      <rect x="24" y="58" width="9" height="8" fill="#0f172a" />
      <rect x="25" y="59" width="7" height="6" fill="#fcd5b5" />
      <rect x="24" y="58" width="9" height="3" fill="#334155" />
      <rect x="26" y="62" width="1" height="1" fill="#0f172a" />
      <rect x="30" y="62" width="1" height="1" fill="#0f172a" />

      {/* Pixel Soccer Ball */}
      <rect x="42" y="74" width="6" height="6" fill="#0f172a" />
      <rect x="43" y="75" width="4" height="4" fill="#ffffff" />
      <rect x="44" y="76" width="2" height="2" fill="#0f172a" />
      <rect x="43" y="75" width="1" height="1" fill="#cbd5e1" />

      {/* 5. Milestone 2: Authentic 24x28 EPL Crown League Trophy */}
      {/* Stone Pedestal & Subtle Glow */}
      <rect x="74" y="42" width="28" height="26" fill="#34d399" opacity="0.06" />
      <rect x="75" y="69" width="26" height="3" fill="#475569" />
      <rect x="77" y="67" width="22" height="2" fill="#94a3b8" />
      <rect x="79" y="66" width="18" height="1" fill="#10b981" />
      <EmbeddedPixelTrophy
        data={EPL_TROPHY}
        x={76}
        y={39}
        scale={1}
        variantKey="epl_league"
      />

      {/* 6. Milestone 3: Authentic 24x28 FA Cup Spire Trophy */}
      <rect x="128" y="34" width="28" height="26" fill="#f43f5e" opacity="0.06" />
      <rect x="129" y="61" width="26" height="3" fill="#475569" />
      <rect x="131" y="59" width="22" height="2" fill="#94a3b8" />
      <rect x="133" y="58" width="18" height="1" fill="#f43f5e" />
      <EmbeddedPixelTrophy
        data={CUP_TROPHY}
        x={130}
        y={31}
        scale={1}
        variantKey="fa_cup"
      />

      {/* 7. Summit Milestone 4: Hero Authentic 24x28 UCL Big Ears Trophy (1.28x) */}
      {/* Golden-Sky Summit Aura */}
      <rect x="179" y="10" width="42" height="40" fill="#f59e0b" opacity="0.08" />
      <rect x="184" y="14" width="32" height="32" fill="#38bdf8" opacity="0.09" />
      <rect x="188" y="18" width="24" height="24" fill="#fef08a" opacity="0.1" />

      {/* Royal Stepped Summit Dais */}
      <rect x="181" y="51" width="38" height="4" fill="#1e293b" />
      <rect x="184" y="48" width="32" height="3" fill="#334155" />
      <rect x="187" y="46" width="26" height="2" fill="#f59e0b" />
      <rect x="190" y="46" width="20" height="1" fill="#fef08a" />

      {/* Iconic Big Ears UCL Pixel Trophy (scaled up cleanly) */}
      <EmbeddedPixelTrophy
        data={UCL_TROPHY}
        x={185}
        y={11.5}
        scale={1.25}
        variantKey="ucl"
      />

      {/* Golden Crown Sparkles Around Big Ears */}
      <rect x="183" y="16" width="2" height="2" fill="#fef08a" />
      <rect x="216" y="19" width="2" height="2" fill="#fef08a" />
      <rect x="199" y="7" width="2" height="2" fill="#fef9c3" />
    </svg>
  );
}

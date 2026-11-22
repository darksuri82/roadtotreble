interface RoadToTrebleHeroSvgProps {
  className?: string;
}

/**
 * Charming retro-modern pixel-art illustration of the "Road To Treble":
 * A winding sunlit road across night-lit emerald stadium hills from
 * Draft (chibi manager + ball + corner flag) -> League -> Domestic Cup -> Summit UCL Big Ears.
 */
export function RoadToTrebleHeroSvg({
  className = '',
}: RoadToTrebleHeroSvgProps) {
  return (
    <svg
      viewBox="0 0 180 66"
      role="img"
      aria-label="드래프트에서 리그, 컵, 챔피언스리그 정상으로 이어지는 트레블 로드 픽셀 일러스트"
      shapeRendering="crispEdges"
      className={`block w-full h-auto select-none ${className}`}
    >
      {/* 1. Night Stadium Sky Bands */}
      <rect x="0" y="0" width="180" height="16" fill="#09101c" />
      <rect x="0" y="16" width="180" height="12" fill="#0d1729" />
      <rect x="0" y="28" width="180" height="10" fill="#122138" />
      <rect x="0" y="38" width="180" height="28" fill="#0d3527" />

      {/* Subtle Pixel Stars */}
      <rect x="12" y="6" width="1" height="1" fill="#94a3b8" />
      <rect x="26" y="11" width="1" height="1" fill="#e2e8f0" />
      <rect x="44" y="5" width="1" height="1" fill="#fde68a" />
      <rect x="65" y="9" width="1" height="1" fill="#94a3b8" />
      <rect x="86" y="4" width="1" height="1" fill="#e2e8f0" />
      <rect x="108" y="8" width="1" height="1" fill="#94a3b8" />
      <rect x="127" y="5" width="1" height="1" fill="#fde68a" />
      <rect x="166" y="7" width="1" height="1" fill="#e2e8f0" />
      {/* Tiny cross twinkle near summit */}
      <rect x="137" y="7" width="1" height="3" fill="#fef08a" />
      <rect x="136" y="8" width="3" height="1" fill="#fef08a" />
      <rect x="160" y="11" width="1" height="3" fill="#fde047" />
      <rect x="159" y="12" width="3" height="1" fill="#fde047" />

      {/* Distant Stadium Silhouette & Floodlight Towers */}
      {/* Left tower */}
      <rect x="33" y="17" width="2" height="17" fill="#1e293b" />
      <rect x="30" y="14" width="8" height="4" fill="#334155" />
      <rect x="31" y="15" width="2" height="2" fill="#fef9c3" />
      <rect x="35" y="15" width="2" height="2" fill="#fef9c3" />
      {/* Soft pixel light cone */}
      <rect x="28" y="18" width="12" height="3" fill="#fef08a" opacity="0.09" />
      <rect x="25" y="21" width="18" height="4" fill="#fef08a" opacity="0.05" />

      {/* Right summit stadium roof & tower */}
      <rect x="120" y="19" width="2" height="14" fill="#1e293b" />
      <rect x="117" y="16" width="8" height="3" fill="#334155" />
      <rect x="118" y="17" width="2" height="1" fill="#fef9c3" />
      <rect x="122" y="17" width="2" height="1" fill="#fef9c3" />
      <rect x="115" y="19" width="12" height="4" fill="#fef08a" opacity="0.08" />

      {/* Distant Stadium Bowl Ridge */}
      <rect x="52" y="29" width="30" height="6" fill="#16263d" />
      <rect x="54" y="28" width="26" height="1" fill="#233754" />
      <rect x="57" y="30" width="2" height="1" fill="#38bdf8" opacity="0.5" />
      <rect x="63" y="30" width="2" height="1" fill="#38bdf8" opacity="0.5" />
      <rect x="69" y="30" width="2" height="1" fill="#38bdf8" opacity="0.5" />
      <rect x="75" y="30" width="2" height="1" fill="#38bdf8" opacity="0.5" />

      {/* 2. Layered Emerald Pitch Hills (climbing gently toward summit on right) */}
      {/* Back hill */}
      <rect x="0" y="35" width="44" height="6" fill="#0f3d2d" />
      <rect x="44" y="33" width="46" height="8" fill="#0f3d2d" />
      <rect x="90" y="30" width="42" height="11" fill="#0f3d2d" />
      <rect x="132" y="26" width="48" height="15" fill="#114634" />

      {/* Mid emerald turf with subtle stadium mowing stripes */}
      <rect x="0" y="40" width="180" height="26" fill="#124e38" />
      <rect x="0" y="40" width="18" height="26" fill="#155840" />
      <rect x="36" y="40" width="18" height="26" fill="#155840" />
      <rect x="72" y="40" width="18" height="26" fill="#155840" />
      <rect x="108" y="36" width="18" height="30" fill="#155840" />
      <rect x="132" y="32" width="48" height="34" fill="#165e44" />
      <rect x="148" y="32" width="16" height="34" fill="#1a6d4f" />

      {/* Hill step ridges */}
      <rect x="0" y="39" width="52" height="2" fill="#1a6c4e" />
      <rect x="52" y="37" width="42" height="2" fill="#1a6c4e" />
      <rect x="94" y="34" width="38" height="2" fill="#1c7554" />
      <rect x="132" y="31" width="48" height="2" fill="#228761" />

      {/* Subtle white pitch touchline accent in foreground */}
      <rect x="0" y="61" width="180" height="1" fill="#34d399" opacity="0.22" />

      {/* 3. The Winding Golden-Cream "Road To Treble" */}
      {/* Road dark border / shadow */}
      <rect x="0" y="54" width="34" height="8" fill="#473827" />
      <rect x="28" y="51" width="24" height="8" fill="#473827" />
      <rect x="48" y="48" width="26" height="8" fill="#473827" />
      <rect x="70" y="45" width="24" height="8" fill="#473827" />
      <rect x="90" y="42" width="24" height="8" fill="#473827" />
      <rect x="110" y="39" width="24" height="7" fill="#473827" />
      <rect x="130" y="36" width="38" height="7" fill="#5c4520" />

      {/* Road main warm gravel/golden path */}
      <rect x="0" y="55" width="33" height="6" fill="#d6c29f" />
      <rect x="29" y="52" width="22" height="6" fill="#dcc8a3" />
      <rect x="49" y="49" width="24" height="6" fill="#e2cfab" />
      <rect x="71" y="46" width="22" height="6" fill="#e8d6b0" />
      <rect x="91" y="43" width="22" height="6" fill="#efdca8" />
      <rect x="111" y="40" width="22" height="5" fill="#f5e29d" />
      <rect x="131" y="37" width="36" height="5" fill="#fde047" />

      {/* Road center highlight & pixel stepping stones */}
      <rect x="6" y="57" width="4" height="2" fill="#f3e9d2" />
      <rect x="16" y="57" width="4" height="2" fill="#f3e9d2" />
      <rect x="35" y="54" width="4" height="2" fill="#f5ecd6" />
      <rect x="57" y="51" width="5" height="2" fill="#f7efda" />
      <rect x="79" y="48" width="4" height="2" fill="#faf1d6" />
      <rect x="99" y="45" width="5" height="2" fill="#fef3c7" />
      <rect x="119" y="42" width="5" height="2" fill="#fef08a" />
      <rect x="137" y="38" width="24" height="2" fill="#fef9c3" />

      {/* 4. Milestone 1 (Start): Corner Flag + Chibi Pixel Manager + Pixel Ball */}
      {/* Corner Flag */}
      <rect x="11" y="41" width="1" height="14" fill="#e2e8f0" />
      <rect x="12" y="41" width="6" height="4" fill="#10b981" />
      <rect x="13" y="42" width="2" height="2" fill="#a7f3d0" />

      {/* Cute 2-Head Chibi Pixel Manager walking onto the road */}
      {/* Shadow */}
      <rect x="20" y="56" width="7" height="2" fill="#8b7355" opacity="0.65" />
      {/* Shoes & Legs */}
      <rect x="21" y="54" width="2" height="2" fill="#0f172a" />
      <rect x="24" y="54" width="2" height="2" fill="#0f172a" />
      <rect x="21" y="51" width="2" height="3" fill="#1e293b" />
      <rect x="24" y="51" width="2" height="3" fill="#1e293b" />
      {/* Suit Jacket & Emerald Tie */}
      <rect x="20" y="47" width="7" height="4" fill="#0f172a" />
      <rect x="21" y="47" width="5" height="4" fill="#1e293b" />
      <rect x="23" y="47" width="1" height="3" fill="#f8fafc" />
      <rect x="23" y="48" width="1" height="2" fill="#10b981" />
      {/* Tiny Tactical Clipboard in right hand */}
      <rect x="27" y="48" width="3" height="3" fill="#b45309" />
      <rect x="28" y="49" width="1" height="1" fill="#fef3c7" />
      {/* Head & Hair */}
      <rect x="20" y="41" width="7" height="6" fill="#0f172a" />
      <rect x="21" y="42" width="5" height="4" fill="#fcd5b5" />
      <rect x="20" y="41" width="7" height="2" fill="#334155" />
      <rect x="22" y="44" width="1" height="1" fill="#0f172a" />
      <rect x="25" y="44" width="1" height="1" fill="#0f172a" />

      {/* Cute Pixel Soccer Ball right ahead of the manager */}
      <rect x="33" y="52" width="5" height="5" fill="#0f172a" />
      <rect x="34" y="53" width="3" height="3" fill="#ffffff" />
      <rect x="35" y="54" width="1" height="1" fill="#0f172a" />
      <rect x="34" y="53" width="1" height="1" fill="#cbd5e1" />

      {/* 5. Milestone 2 (League Trophy Pad, x ~ 64) */}
      <rect x="60" y="46" width="11" height="2" fill="#94a3b8" />
      <rect x="61" y="45" width="9" height="1" fill="#cbd5e1" />
      {/* Mini Pixel League Trophy */}
      <rect x="63" y="43" width="5" height="2" fill="#1e293b" />
      <rect x="64" y="43" width="3" height="1" fill="#10b981" />
      <rect x="65" y="41" width="1" height="2" fill="#cbd5e1" />
      <rect x="63" y="36" width="5" height="5" fill="#e2e8f0" />
      <rect x="62" y="37" width="1" height="3" fill="#94a3b8" />
      <rect x="68" y="37" width="1" height="3" fill="#94a3b8" />
      <rect x="64" y="37" width="1" height="3" fill="#ffffff" />
      <rect x="63" y="35" width="5" height="1" fill="#f59e0b" />
      <rect x="64" y="34" width="1" height="1" fill="#fbbf24" />
      <rect x="66" y="34" width="1" height="1" fill="#fbbf24" />

      {/* 6. Milestone 3 (Domestic Cup Pad, x ~ 104) */}
      <rect x="100" y="40" width="11" height="2" fill="#94a3b8" />
      <rect x="101" y="39" width="9" height="1" fill="#cbd5e1" />
      {/* Mini Pixel Cup Trophy */}
      <rect x="103" y="37" width="5" height="2" fill="#27272a" />
      <rect x="104" y="37" width="3" height="1" fill="#ef4444" />
      <rect x="105" y="35" width="1" height="2" fill="#e2e8f0" />
      <rect x="103" y="30" width="5" height="5" fill="#f8fafc" />
      <rect x="102" y="31" width="1" height="2" fill="#94a3b8" />
      <rect x="108" y="31" width="1" height="2" fill="#94a3b8" />
      <rect x="104" y="31" width="1" height="2" fill="#ffffff" />
      <rect x="104" y="29" width="3" height="1" fill="#f43f5e" />

      {/* 7. Milestone 4 (SUMMIT: Golden Big Ears Treble Dais, x ~ 149) */}
      {/* Golden Summit Glow */}
      <rect x="139" y="13" width="22" height="22" fill="#f59e0b" opacity="0.1" />
      <rect x="142" y="16" width="16" height="16" fill="#fde047" opacity="0.14" />

      {/* Stepped Summit Pedestal */}
      <rect x="141" y="35" width="18" height="3" fill="#1e293b" />
      <rect x="143" y="33" width="14" height="2" fill="#334155" />
      <rect x="145" y="32" width="10" height="1" fill="#f59e0b" />

      {/* Crisp Golden Pixel Big Ears Trophy */}
      {/* Base */}
      <rect x="146" y="30" width="8" height="2" fill="#92400e" />
      <rect x="147" y="29" width="6" height="1" fill="#f59e0b" />
      <rect x="149" y="27" width="2" height="2" fill="#d97706" />
      {/* Cup Body */}
      <rect x="146" y="19" width="8" height="8" fill="#f59e0b" />
      <rect x="147" y="18" width="6" height="9" fill="#fbbf24" />
      <rect x="148" y="19" width="2" height="6" fill="#fef08a" />
      <rect x="148" y="20" width="1" height="3" fill="#ffffff" />
      <rect x="152" y="20" width="1" height="6" fill="#d97706" />
      {/* Rim */}
      <rect x="145" y="17" width="10" height="2" fill="#fde047" />
      <rect x="146" y="17" width="8" height="1" fill="#fef9c3" />
      {/* Iconic "Big Ears" Handles */}
      <rect x="143" y="18" width="2" height="2" fill="#f59e0b" />
      <rect x="142" y="20" width="2" height="4" fill="#fbbf24" />
      <rect x="143" y="24" width="3" height="2" fill="#d97706" />
      <rect x="155" y="18" width="2" height="2" fill="#f59e0b" />
      <rect x="156" y="20" width="2" height="4" fill="#fbbf24" />
      <rect x="154" y="24" width="3" height="2" fill="#d97706" />
      {/* Star Crest on Cup */}
      <rect x="150" y="22" width="1" height="1" fill="#ffffff" />

      {/* Floating Pixel Sparkles around Summit */}
      <rect x="140" y="15" width="1" height="1" fill="#fef08a" />
      <rect x="159" y="16" width="1" height="1" fill="#fef08a" />
      <rect x="149" y="12" width="2" height="2" fill="#fef9c3" />
      <rect x="150" y="11" width="1" height="4" fill="#fde047" opacity="0.8" />
      <rect x="148" y="12" width="4" height="1" fill="#fde047" opacity="0.8" />
    </svg>
  );
}

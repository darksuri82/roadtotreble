import { useId, useMemo } from 'react';
import type { ManagerAvatarConfig } from '../../types/game';
import type { JerseyPattern } from '../../types/league';
import { getManagerAvatarRects } from '../common/PixelManagerAvatar';
import {
  getPixelTrophyRects,
  type PixelTrophyVariant,
} from '../common/PixelTrophySvg';

interface RoadToTrebleHeroSvgProps {
  managerAvatar?: Partial<ManagerAvatarConfig> | null;
  clubPrimaryColor?: string;
  clubSecondaryColor?: string;
  clubPattern?: JerseyPattern;
  className?: string;
}

const EPL_TROPHY = getPixelTrophyRects('epl_league');
const CUP_TROPHY = getPixelTrophyRects('fa_cup');
const UCL_TROPHY = getPixelTrophyRects('ucl');

// Precomputed ordered pixel-dither bands for night sky & mowed turf stripes
const SKY_DITHER_ROW_1 = Array.from({ length: 70 }, (_, i) => i * 4);
const SKY_DITHER_ROW_2 = Array.from({ length: 70 }, (_, i) => i * 4 + 2);

const CROWD_LIGHTS: readonly { x: number; y: number; fill: string; o: number }[] = [
  { x: 54, y: 45, fill: '#fef9c3', o: 0.65 },
  { x: 61, y: 47, fill: '#38bdf8', o: 0.5 },
  { x: 67, y: 44, fill: '#e2e8f0', o: 0.45 },
  { x: 75, y: 46, fill: '#34d399', o: 0.55 },
  { x: 82, y: 48, fill: '#fef08a', o: 0.5 },
  { x: 91, y: 45, fill: '#ffffff', o: 0.7 },
  { x: 98, y: 47, fill: '#f87171', o: 0.45 },
  { x: 113, y: 44, fill: '#fef9c3', o: 0.6 },
  { x: 121, y: 46, fill: '#38bdf8', o: 0.5 },
  { x: 129, y: 45, fill: '#34d399', o: 0.55 },
  { x: 136, y: 48, fill: '#ffffff', o: 0.65 },
  { x: 145, y: 44, fill: '#fde047', o: 0.55 },
  { x: 154, y: 46, fill: '#e2e8f0', o: 0.45 },
  { x: 162, y: 45, fill: '#38bdf8', o: 0.5 },
  { x: 169, y: 47, fill: '#fef9c3', o: 0.6 },
  { x: 185, y: 44, fill: '#34d399', o: 0.45 },
  { x: 192, y: 45, fill: '#fef08a', o: 0.55 },
];

const TURF_STRIPE_SEAMS = [24, 48, 72, 96, 120, 144, 168, 196, 224, 252] as const;

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
 * High-density retro-modern pixel-art illustration of the "Road To Treble" (280x108):
 * Starting-line customized Pixel Manager & Team Banner -> Stepped Golden/Turf Road ->
 * 3 Sculpted Treble Trophies (League, Domestic Cup, Grand UCL Big Ears) -> Summit GOAT.
 */
export function RoadToTrebleHeroSvg({
  managerAvatar,
  clubPrimaryColor = '#10b981',
  clubSecondaryColor = '#f8fafc',
  clubPattern = 'sash',
  className = '',
}: RoadToTrebleHeroSvgProps) {
  const uid = useId().replace(/:/g, '');
  const summitHaloId = `rtt-summit-halo-${uid}`;
  const beamGoldId = `rtt-beam-gold-${uid}`;
  const beamSkyId = `rtt-beam-sky-${uid}`;
  const beamSoftId = `rtt-beam-soft-${uid}`;

  const managerSprite = useMemo(
    () =>
      getManagerAvatarRects({
        avatar: managerAvatar,
        clubPrimaryColor,
        clubSecondaryColor,
      }),
    [managerAvatar, clubPrimaryColor, clubSecondaryColor],
  );

  return (
    <svg
      viewBox="0 0 280 108"
      role="img"
      aria-label="출발선 감독에서 계단식 황금 길을 따라 리그 트로피, 자국 컵 트로피, 챔피언스리그 빅이어와 정상 위 고트(GOAT)로 이어지는 트레블 로드 픽셀 일러스트"
      shapeRendering="crispEdges"
      className={`pixel-crisp block w-full h-auto select-none ${className}`}
    >
      <defs>
        {/* Smooth radial summit atmosphere (eliminates boxy edges around Big Ears) */}
        <radialGradient id={summitHaloId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.24" />
          <stop offset="42%" stopColor="#38bdf8" stopOpacity="0.11" />
          <stop offset="72%" stopColor="#f59e0b" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#091222" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={beamGoldId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.16" />
          <stop offset="65%" stopColor="#fde68a" stopOpacity="0.065" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={beamSkyId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.14" />
          <stop offset="70%" stopColor="#7dd3fc" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={beamSoftId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#fef9c3" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ================================================================= */}
      {/* 1. NIGHT STADIUM SKY WITH ORDERED PIXEL DITHERING                 */}
      {/* ================================================================= */}
      <rect x="0" y="0" width="280" height="15" fill="#060b14" />
      <rect x="0" y="15" width="280" height="15" fill="#091222" />
      <rect x="0" y="30" width="280" height="15" fill="#0d1b31" />
      <rect x="0" y="45" width="280" height="16" fill="#122440" />

      {/* Crisp 1px pixel-art dither transitions between sky bands */}
      <g opacity="0.9">
        {SKY_DITHER_ROW_1.map((x) => (
          <g key={`sd1-${x}`}>
            <rect x={x} y="14" width="2" height="1" fill="#091222" />
            <rect x={x + 2} y="15" width="2" height="1" fill="#060b14" />
            <rect x={x} y="29" width="2" height="1" fill="#0d1b31" />
            <rect x={x + 2} y="30" width="2" height="1" fill="#091222" />
            <rect x={x} y="44" width="2" height="1" fill="#122440" />
            <rect x={x + 2} y="45" width="2" height="1" fill="#0d1b31" />
          </g>
        ))}
        {SKY_DITHER_ROW_2.map((x) => (
          <g key={`sd2-${x}`}>
            <rect x={x} y="13" width="1" height="1" fill="#091222" />
            <rect x={x} y="28" width="1" height="1" fill="#0d1b31" />
            <rect x={x} y="43" width="1" height="1" fill="#122440" />
          </g>
        ))}
      </g>

      {/* Subtle Pixel Crescent Moon (upper left) */}
      <g opacity="0.82">
        <rect x="16" y="7" width="3" height="1" fill="#fef3c7" />
        <rect x="15" y="8" width="2" height="1" fill="#fef9c3" />
        <rect x="14" y="9" width="2" height="3" fill="#fef3c7" />
        <rect x="15" y="12" width="2" height="1" fill="#fde68a" />
        <rect x="16" y="13" width="3" height="1" fill="#fcd34d" />
        <rect x="19" y="12" width="1" height="1" fill="#fde68a" />
      </g>

      {/* Deep Starfield */}
      <rect x="30" y="9" width="1" height="1" fill="#94a3b8" />
      <rect x="64" y="6" width="1" height="1" fill="#e2e8f0" />
      <rect x="82" y="12" width="1" height="1" fill="#fde68a" />
      <rect x="97" y="7" width="1" height="1" fill="#94a3b8" />
      <rect x="126" y="5" width="1" height="1" fill="#e2e8f0" />
      <rect x="143" y="11" width="1" height="1" fill="#94a3b8" />
      <rect x="160" y="7" width="1" height="1" fill="#fde68a" />
      <rect x="193" y="9" width="1" height="1" fill="#cbd5e1" />
      <rect x="247" y="6" width="1" height="1" fill="#fde68a" />
      <rect x="272" y="10" width="1" height="1" fill="#94a3b8" />

      {/* ================================================================= */}
      {/* 2. DISTANT STADIUM BOWL, TIERED STANDS & FLOODLIGHT TOWERS        */}
      {/* ================================================================= */}
      {/* Distant Stadium Roof & Bowl Silhouette */}
      <rect x="46" y="38" width="150" height="19" fill="#0b1526" />
      {/* Roof Arch Canopy */}
      <rect x="48" y="36" width="146" height="3" fill="#172740" />
      <rect x="52" y="35" width="138" height="1" fill="#263e61" />
      <rect x="56" y="34" width="130" height="1" fill="#335078" opacity="0.65" />
      {/* Roof Support Trusses */}
      {[56, 74, 92, 110, 128, 146, 164, 182].map((tx) => (
        <rect key={`truss-${tx}`} x={tx} y="39" width="1" height="14" fill="#13233b" />
      ))}
      {/* Upper & Lower Spectator Tiers */}
      <rect x="48" y="42" width="146" height="4" fill="#101f36" />
      <rect x="48" y="47" width="146" height="6" fill="#132541" />
      <rect x="48" y="46" width="146" height="1" fill="#1f3659" />
      {/* Micro-crowd pixel lights & camera flashes */}
      {CROWD_LIGHTS.map((c, i) => (
        <rect
          key={`cl-${i}`}
          x={c.x}
          y={c.y}
          width="1"
          height="1"
          fill={c.fill}
          opacity={c.o}
        />
      ))}
      {/* Perimeter LED ad-board hairline */}
      <rect x="48" y="53" width="146" height="2" fill="#0d1b2f" />
      {[52, 64, 76, 88, 100, 112, 124, 136, 148, 160, 172, 184].map((ax, idx) => (
        <rect
          key={`ad-${ax}`}
          x={ax}
          y="53"
          width="7"
          height="1"
          fill={idx % 3 === 0 ? '#10b981' : idx % 3 === 1 ? '#38bdf8' : '#f59e0b'}
          opacity="0.38"
        />
      ))}

      {/* Grand Stadium Spotlight Beams & Ceremonial Summit Light Canopy */}
      <g className="hero-spotlight-breath" shapeRendering="auto">
        {/* Soft Radial Celestial Summit Glow behind UCL Big Ears */}
        <circle cx="222" cy="28" r="38" fill={`url(#${summitHaloId})`} />

        {/* Left Floodlight Beam toward starting road & League Trophy */}
        <polygon
          points="45,20 55,20 112,74 72,78"
          fill={`url(#${beamSoftId})`}
        />
        {/* Mid-Right Floodlight Beam toward FA Cup */}
        <polygon
          points="173,20 182,20 174,66 138,66"
          fill={`url(#${beamSoftId})`}
        />
        {/* Grand Converging UCL Summit Cathedral Spotlights */}
        <polygon
          points="179,19 187,19 248,54 198,54"
          fill={`url(#${beamGoldId})`}
        />
        <polygon
          points="207,0 237,0 250,52 194,52"
          fill={`url(#${beamGoldId})`}
          opacity="0.55"
        />
        <polygon
          points="259,20 268,20 245,54 202,52"
          fill={`url(#${beamSkyId})`}
        />
      </g>

      {/* Floodlight Tower 1 (Left Hero Pylon) */}
      <rect x="48" y="20" width="2" height="37" fill="#1e293b" />
      <rect x="49" y="20" width="1" height="37" fill="#334155" />
      <rect x="47" y="44" width="4" height="1" fill="#1e293b" />
      <rect x="46" y="50" width="6" height="1" fill="#1e293b" />
      <rect x="42" y="14" width="14" height="6" fill="#26354d" />
      <rect x="43" y="15" width="12" height="4" fill="#0f172a" />
      <rect x="44" y="15" width="2" height="2" fill="#fef9c3" />
      <rect x="47" y="15" width="2" height="2" fill="#ffffff" />
      <rect x="50" y="15" width="2" height="2" fill="#ffffff" />
      <rect x="53" y="15" width="2" height="2" fill="#fef9c3" />
      <rect x="44" y="18" width="2" height="1" fill="#fde68a" />
      <rect x="47" y="18" width="2" height="1" fill="#fef9c3" />
      <rect x="50" y="18" width="2" height="1" fill="#fef9c3" />
      <rect x="53" y="18" width="2" height="1" fill="#fde68a" />

      {/* Floodlight Tower 2 (Distant Mid-Left) */}
      <rect x="115" y="25" width="2" height="22" fill="#1a273c" />
      <rect x="111" y="22" width="10" height="3" fill="#24354f" />
      <rect x="112" y="23" width="2" height="1" fill="#fef9c3" opacity="0.8" />
      <rect x="115" y="23" width="2" height="1" fill="#ffffff" opacity="0.85" />
      <rect x="118" y="23" width="2" height="1" fill="#fef9c3" opacity="0.8" />

      {/* Floodlight Tower 3 (Mid-Right Hero Pylon) */}
      <rect x="178" y="20" width="2" height="30" fill="#1e293b" />
      <rect x="179" y="20" width="1" height="30" fill="#334155" />
      <rect x="172" y="14" width="14" height="6" fill="#26354d" />
      <rect x="173" y="15" width="12" height="4" fill="#0f172a" />
      <rect x="174" y="15" width="2" height="2" fill="#fef9c3" />
      <rect x="177" y="15" width="2" height="2" fill="#ffffff" />
      <rect x="180" y="15" width="2" height="2" fill="#ffffff" />
      <rect x="183" y="15" width="2" height="2" fill="#fef9c3" />
      <rect x="174" y="18" width="2" height="1" fill="#fde68a" />
      <rect x="177" y="18" width="2" height="1" fill="#fef9c3" />
      <rect x="180" y="18" width="2" height="1" fill="#fef9c3" />
      <rect x="183" y="18" width="2" height="1" fill="#fde68a" />

      {/* Floodlight Tower 4 (Right Summit Flank) */}
      <rect x="263" y="22" width="2" height="24" fill="#1b2a40" />
      <rect x="259" y="18" width="10" height="4" fill="#263752" />
      <rect x="260" y="19" width="2" height="2" fill="#e0f2fe" />
      <rect x="263" y="19" width="2" height="2" fill="#ffffff" />
      <rect x="266" y="19" width="2" height="2" fill="#fef9c3" />

      {/* ================================================================= */}
      {/* 3. LAYERED EMERALD PITCH HILLS & DITHERED MOWED TURF STRIPES      */}
      {/* ================================================================= */}
      {/* Far Ascending Pitch Hills */}
      <rect x="0" y="59" width="68" height="10" fill="#0c3425" />
      <rect x="68" y="55" width="66" height="14" fill="#0d3929" />
      <rect x="134" y="50" width="60" height="19" fill="#0f412f" />
      <rect x="194" y="42" width="86" height="27" fill="#114a35" />

      {/* Main Mowed Emerald Turf Field */}
      <rect x="0" y="65" width="280" height="43" fill="#104431" />
      <rect x="0" y="65" width="24" height="43" fill="#14533c" />
      <rect x="48" y="64" width="24" height="44" fill="#14533c" />
      <rect x="96" y="61" width="24" height="47" fill="#14533c" />
      <rect x="144" y="56" width="24" height="52" fill="#14533c" />
      <rect x="194" y="48" width="30" height="60" fill="#165c43" />
      <rect x="224" y="48" width="28" height="60" fill="#1b6b4e" />
      <rect x="252" y="48" width="28" height="60" fill="#165c43" />

      {/* Pixel Dithering Along Mowed Grass Stripe Seams */}
      <g opacity="0.72">
        {TURF_STRIPE_SEAMS.map((sx, idx) => {
          const yStart = sx >= 196 ? 49 : sx >= 144 ? 57 : sx >= 96 ? 62 : 66;
          const lightTone = sx >= 196 ? '#1b6b4e' : '#14533c';
          const darkTone = sx >= 196 ? '#124c37' : '#104431';
          return (
            <g key={`seam-${sx}`}>
              {[0, 4, 8, 12, 16, 20, 24, 28, 32, 36].map((dy) => {
                const y = yStart + dy;
                if (y >= 106) return null;
                return (
                  <g key={`d-${sx}-${dy}`}>
                    <rect
                      x={sx}
                      y={y}
                      width="1"
                      height="2"
                      fill={idx % 2 === 0 ? lightTone : darkTone}
                    />
                    <rect
                      x={sx - 1}
                      y={y + 2}
                      width="1"
                      height="2"
                      fill={idx % 2 === 0 ? darkTone : lightTone}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>

      {/* Crisp Hill Ridge Highlights */}
      <rect x="0" y="63" width="70" height="2" fill="#1a6c4e" />
      <rect x="70" y="59" width="66" height="2" fill="#1d7454" />
      <rect x="136" y="54" width="58" height="2" fill="#21805d" />
      <rect x="194" y="46" width="86" height="2" fill="#28946c" />

      {/* Subtle Pitch Chalk Touchline & Grass Tufts */}
      <rect x="0" y="101" width="280" height="1" fill="#a7f3d0" opacity="0.22" />
      <rect x="136" y="96" width="12" height="1" fill="#a7f3d0" opacity="0.16" />
      <rect x="141" y="95" width="2" height="2" fill="#a7f3d0" opacity="0.16" />
      {[
        [14, 97],
        [59, 96],
        [104, 93],
        [164, 89],
        [216, 86],
        [258, 79],
      ].map(([gx, gy]) => (
        <g key={`tuft-${gx}-${gy}`} opacity="0.55">
          <rect x={gx} y={gy} width="1" height="2" fill="#34d399" />
          <rect x={gx + 2} y={gy + 1} width="1" height="1" fill="#10b981" />
        </g>
      ))}

      {/* ================================================================= */}
      {/* 4. STEPPED GOLDEN-CREAM "ROAD TO TREBLE" ASCENT                   */}
      {/* ================================================================= */}
      {/* Ground Cast Shadows under Road Terraces */}
      <rect x="0" y="96" width="54" height="3" fill="#072219" opacity="0.55" />
      <rect x="44" y="92" width="42" height="3" fill="#072219" opacity="0.55" />
      <rect x="78" y="87" width="44" height="3" fill="#072219" opacity="0.55" />
      <rect x="114" y="82" width="42" height="3" fill="#072219" opacity="0.55" />
      <rect x="148" y="77" width="38" height="3" fill="#072219" opacity="0.55" />
      <rect x="176" y="71" width="32" height="3" fill="#072219" opacity="0.55" />
      <rect x="196" y="64" width="78" height="3" fill="#072219" opacity="0.62" />

      {/* 3D Stone / Burnished Gold Road Risers */}
      <rect x="0" y="87" width="52" height="10" fill="#463623" />
      <rect x="44" y="83" width="40" height="10" fill="#4d3b25" />
      <rect x="78" y="78" width="42" height="10" fill="#564126" />
      <rect x="114" y="73" width="40" height="10" fill="#614824" />
      <rect x="148" y="68" width="36" height="10" fill="#6d5021" />
      <rect x="176" y="62" width="30" height="10" fill="#7c591d" />
      <rect x="196" y="55" width="78" height="10" fill="#8a6016" />

      {/* Main Stepped Road Surface (Sandstone -> Warm Gold -> Royal Summit Gold) */}
      <rect x="0" y="88" width="51" height="7" fill="#cbb791" />
      <rect x="45" y="84" width="38" height="7" fill="#d5c198" />
      <rect x="79" y="79" width="40" height="7" fill="#dfcb9f" />
      <rect x="115" y="74" width="38" height="7" fill="#e9d59c" />
      <rect x="149" y="69" width="34" height="7" fill="#f2dc90" />
      <rect x="177" y="63" width="28" height="7" fill="#fae278" />
      <rect x="197" y="56" width="76" height="7" fill="#fde047" />

      {/* Top Rim Light on Each Step */}
      <rect x="0" y="88" width="51" height="1" fill="#e7dbc1" />
      <rect x="45" y="84" width="38" height="1" fill="#efe2c6" />
      <rect x="79" y="79" width="40" height="1" fill="#f4e8ca" />
      <rect x="115" y="74" width="38" height="1" fill="#faf0cd" />
      <rect x="149" y="69" width="34" height="1" fill="#fef3c7" />
      <rect x="177" y="63" width="28" height="1" fill="#fef9c3" />
      <rect x="197" y="56" width="76" height="1" fill="#ffffff" opacity="0.88" />

      {/* Cobblestone Pavers & Golden Step Highlights */}
      <rect x="7" y="91" width="6" height="2" fill="#e7dbc1" />
      <rect x="22" y="91" width="7" height="2" fill="#e7dbc1" />
      <rect x="55" y="87" width="7" height="2" fill="#efe2c6" />
      <rect x="89" y="82" width="7" height="2" fill="#f5e9cb" />
      <rect x="125" y="77" width="7" height="2" fill="#faf0cd" />
      <rect x="158" y="72" width="7" height="2" fill="#fef3c7" />
      {/* Royal Golden Carpet Runner on Final Ascent */}
      <rect x="180" y="65" width="20" height="3" fill="#d97706" />
      <rect x="181" y="66" width="18" height="1" fill="#fef08a" />
      <rect x="200" y="59" width="46" height="2" fill="#fef9c3" />
      <rect x="252" y="59" width="18" height="2" fill="#fef08a" />

      {/* ================================================================= */}
      {/* 5. MILESTONE 1 (START): CRISP CLUB BANNER + PIXEL MANAGER + BALL  */}
      {/* ================================================================= */}
      {/* Prominent Crisp-Outlined Club Flag (User's Team Colors & Pattern) */}
      <g>
        {/* Ground shadow */}
        <rect x="4" y="90" width="6" height="2" fill="#463623" opacity="0.62" />
        {/* Flagpole with crisp dark edge & golden finial orb */}
        <rect x="5" y="57" width="3" height="34" fill="#141016" />
        <rect x="6" y="58" width="1" height="32" fill="#f8fafc" />
        <rect x="5" y="55" width="3" height="3" fill="#141016" />
        <rect x="6" y="56" width="1" height="1" fill="#fde047" />

        {/* Waving Pennant Banner Outline (14x10 crisp dark pixel border) */}
        <rect x="7" y="57" width="14" height="11" fill="#141016" />
        <rect x="21" y="58" width="1" height="9" fill="#141016" />

        {/* Banner Base Fill (Team Primary Color) */}
        <rect x="8" y="58" width="12" height="9" fill={clubPrimaryColor} />
        <rect x="20" y="59" width="1" height="7" fill={clubPrimaryColor} />

        {/* Pattern Accent (Team Secondary Color) */}
        {clubPattern === 'stripes' && (
          <>
            <rect x="10" y="58" width="2" height="9" fill={clubSecondaryColor} />
            <rect x="14" y="58" width="2" height="9" fill={clubSecondaryColor} />
            <rect x="18" y="58" width="2" height="9" fill={clubSecondaryColor} />
          </>
        )}
        {clubPattern === 'hoops' && (
          <>
            <rect x="8" y="60" width="12" height="2" fill={clubSecondaryColor} />
            <rect x="8" y="64" width="12" height="2" fill={clubSecondaryColor} />
          </>
        )}
        {clubPattern === 'half' && (
          <rect x="14" y="58" width="6" height="9" fill={clubSecondaryColor} />
        )}
        {clubPattern === 'sash' && (
          <>
            <rect x="9" y="58" width="3" height="2" fill={clubSecondaryColor} />
            <rect x="11" y="60" width="3" height="2" fill={clubSecondaryColor} />
            <rect x="13" y="62" width="3" height="2" fill={clubSecondaryColor} />
            <rect x="15" y="64" width="3" height="3" fill={clubSecondaryColor} />
          </>
        )}
        {clubPattern === 'solid' && (
          <>
            <rect x="8" y="61" width="12" height="3" fill={clubSecondaryColor} />
            <rect x="12" y="58" width="3" height="9" fill={clubSecondaryColor} />
          </>
        )}
        {clubPattern === 'pinstripes' && (
          <>
            <rect x="9" y="58" width="1" height="9" fill={clubSecondaryColor} />
            <rect x="12" y="58" width="1" height="9" fill={clubSecondaryColor} />
            <rect x="15" y="58" width="1" height="9" fill={clubSecondaryColor} />
            <rect x="18" y="58" width="1" height="9" fill={clubSecondaryColor} />
          </>
        )}
        {clubPattern === 'chevron' && (
          <>
            <rect x="8" y="59" width="3" height="2" fill={clubSecondaryColor} />
            <rect x="17" y="59" width="3" height="2" fill={clubSecondaryColor} />
            <rect x="10" y="61" width="3" height="2" fill={clubSecondaryColor} />
            <rect x="15" y="61" width="3" height="2" fill={clubSecondaryColor} />
            <rect x="12" y="63" width="4" height="2" fill={clubSecondaryColor} />
          </>
        )}
        {clubPattern === 'quarters' && (
          <>
            <rect x="14" y="58" width="6" height="4" fill={clubSecondaryColor} />
            <rect x="8" y="62" width="6" height="5" fill={clubSecondaryColor} />
          </>
        )}
        {clubPattern === 'center_band' && (
          <rect x="12" y="58" width="4" height="9" fill={clubSecondaryColor} />
        )}
        {clubPattern === 'chest_band' && (
          <rect x="8" y="61" width="12" height="3" fill={clubSecondaryColor} />
        )}
        {clubPattern === 'checkered' && (
          <>
            <rect x="8" y="58" width="3" height="3" fill={clubSecondaryColor} />
            <rect x="14" y="58" width="3" height="3" fill={clubSecondaryColor} />
            <rect x="11" y="61" width="3" height="3" fill={clubSecondaryColor} />
            <rect x="17" y="61" width="3" height="3" fill={clubSecondaryColor} />
            <rect x="8" y="64" width="3" height="3" fill={clubSecondaryColor} />
            <rect x="14" y="64" width="3" height="3" fill={clubSecondaryColor} />
          </>
        )}
        {clubPattern === 'gradient' && (
          <>
            <rect x="8" y="62" width="12" height="2" fill={clubSecondaryColor} opacity="0.45" />
            <rect x="8" y="64" width="12" height="3" fill={clubSecondaryColor} opacity="0.88" />
          </>
        )}

        {/* Subtle cloth fold specular highlight & bottom hem shade */}
        <rect x="8" y="58" width="12" height="1" fill="#ffffff" opacity="0.28" />
        <rect x="8" y="66" width="12" height="1" fill="#000000" opacity="0.22" />
      </g>

      {/* Manager Ground Shadow */}
      <rect x="23" y="89" width="18" height="2" fill="#5e4b31" opacity="0.58" />
      <rect x="25" y="90" width="14" height="1" fill="#3d301e" opacity="0.45" />

      {/* User's Live Customized Pixel Manager Avatar (28x34 grid embedded crisply) */}
      <g transform="translate(20 60) scale(0.88)">
        {managerSprite.rects.map((r, idx) => (
          <rect
            key={`mgr-${idx}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={1}
            fill={r.fill}
          />
        ))}
      </g>

      {/* Pixel Football beside Manager */}
      <rect x="48" y="90" width="8" height="2" fill="#5e4b31" opacity="0.5" />
      <rect x="49" y="84" width="6" height="1" fill="#0f172a" />
      <rect x="48" y="85" width="8" height="5" fill="#0f172a" />
      <rect x="49" y="90" width="6" height="1" fill="#0f172a" />
      <rect x="49" y="85" width="6" height="5" fill="#f8fafc" />
      <rect x="50" y="85" width="2" height="1" fill="#ffffff" />
      <rect x="51" y="87" width="2" height="2" fill="#1e293b" />
      <rect x="49" y="86" width="1" height="1" fill="#64748b" />
      <rect x="54" y="89" width="1" height="1" fill="#94a3b8" />

      {/* ================================================================= */}
      {/* 6. MILESTONE 2: LEAGUE CROWN TROPHY (SCULPTED 3D PEDESTAL)        */}
      {/* ================================================================= */}
      <rect x="84" y="79" width="32" height="2" fill="#072219" opacity="0.45" />
      <rect x="85" y="76" width="30" height="4" fill="#1e293b" />
      <rect x="85" y="76" width="24" height="4" fill="#334155" />
      <rect x="87" y="73" width="26" height="3" fill="#475569" />
      <rect x="87" y="73" width="21" height="2" fill="#64748b" />
      <rect x="89" y="72" width="22" height="1" fill="#cbd5e1" />
      <rect x="93" y="75" width="14" height="2" fill="#10b981" />
      <rect x="94" y="75" width="10" height="1" fill="#6ee7b7" />
      <EmbeddedPixelTrophy
        data={EPL_TROPHY}
        x={88}
        y={45}
        scale={1}
        variantKey="epl_league"
      />
      <rect x="93" y="47" width="1" height="1" fill="#ffffff" className="hero-pixel-twinkle-slow" />

      {/* ================================================================= */}
      {/* 7. MILESTONE 3: DOMESTIC CUP TROPHY (SCULPTED 3D PEDESTAL)        */}
      {/* ================================================================= */}
      <rect x="145" y="70" width="32" height="2" fill="#072219" opacity="0.45" />
      <rect x="146" y="67" width="30" height="4" fill="#1e293b" />
      <rect x="146" y="67" width="24" height="4" fill="#334155" />
      <rect x="148" y="64" width="26" height="3" fill="#475569" />
      <rect x="148" y="64" width="21" height="2" fill="#64748b" />
      <rect x="150" y="63" width="22" height="1" fill="#cbd5e1" />
      <rect x="154" y="66" width="14" height="2" fill="#f43f5e" />
      <rect x="155" y="66" width="10" height="1" fill="#fda4af" />
      <EmbeddedPixelTrophy
        data={CUP_TROPHY}
        x={149}
        y={36}
        scale={1}
        variantKey="fa_cup"
      />
      <rect x="159" y="38" width="1" height="1" fill="#ffffff" className="hero-pixel-twinkle-delayed" />

      {/* ================================================================= */}
      {/* 8. SUMMIT MILESTONE 4: GRAND UCL BIG EARS TROPHY (MONUMENTAL DAIS)*/}
      {/* ================================================================= */}
      {/* Twin Ceremonial Golden Pedestal Pillars Flanking the Royal Dais */}
      <g>
        {/* Left ceremonial pillar */}
        <rect x="196" y="47" width="5" height="9" fill="#141016" />
        <rect x="197" y="48" width="3" height="7" fill="#1e293b" />
        <rect x="197" y="48" width="2" height="7" fill="#334155" />
        <rect x="196" y="46" width="5" height="2" fill="#d97706" />
        <rect x="197" y="46" width="3" height="1" fill="#fde047" />
        <rect x="198" y="44" width="1" height="2" fill="#fef08a" className="hero-pixel-twinkle-slow" />
        {/* Right ceremonial pillar */}
        <rect x="243" y="47" width="5" height="9" fill="#141016" />
        <rect x="244" y="48" width="3" height="7" fill="#1e293b" />
        <rect x="244" y="48" width="2" height="7" fill="#334155" />
        <rect x="243" y="46" width="5" height="2" fill="#d97706" />
        <rect x="244" y="46" width="3" height="1" fill="#fde047" />
        <rect x="245" y="44" width="1" height="2" fill="#fef08a" className="hero-pixel-twinkle-delayed" />
      </g>

      {/* Grand 3-Tier Monumental Royal Championship Dais */}
      <rect x="196" y="57" width="52" height="2" fill="#4d350b" opacity="0.52" />
      {/* Tier 1 Base (Midnight Obsidian with Fluted Column Accents) */}
      <rect x="198" y="53" width="48" height="5" fill="#0f172a" />
      <rect x="199" y="53" width="39" height="4" fill="#1e293b" />
      {[203, 209, 233, 239].map((fx) => (
        <rect key={`flute-${fx}`} x={fx} y="54" width="1" height="3" fill="#334155" />
      ))}
      {/* Tier 2 Mid Plinth with Gold Trim */}
      <rect x="202" y="49" width="40" height="4" fill="#1e293b" />
      <rect x="203" y="49" width="33" height="3" fill="#334155" />
      <rect x="202" y="52" width="40" height="1" fill="#b45309" />
      {/* Tier 3 Crown Platform (Burnished Gold Cornice) */}
      <rect x="205" y="46" width="34" height="3" fill="#b45309" />
      <rect x="206" y="46" width="32" height="2" fill="#f59e0b" />
      <rect x="207" y="46" width="27" height="1" fill="#fef08a" />
      {/* Center Royal Champions Plaque (Gold Frame + Midnight Star Core) */}
      <rect x="213" y="50" width="18" height="6" fill="#92400e" />
      <rect x="214" y="51" width="16" height="4" fill="#0c1b33" />
      <rect x="214" y="50" width="16" height="1" fill="#fde047" />
      <rect x="214" y="55" width="16" height="1" fill="#f59e0b" />
      <rect x="221" y="52" width="2" height="2" fill="#7dd3fc" />
      <rect x="217" y="52" width="1" height="1" fill="#fef08a" />
      <rect x="226" y="52" width="1" height="1" fill="#fef08a" />

      {/* Hero Big Ears UCL Pixel Trophy (Commanding 1.38x Scale) */}
      <EmbeddedPixelTrophy
        data={UCL_TROPHY}
        x={205.5}
        y={8.5}
        scale={1.38}
        variantKey="ucl"
      />

      {/* ================================================================= */}
      {/* 9. SUMMIT COMPANION: HIGH-DETAIL PIXEL GOAT (고트)                */}
      {/* ================================================================= */}
      <g>
        {/* Ground shadow on summit plateau */}
        <rect x="252" y="55" width="16" height="2" fill="#8a6016" opacity="0.55" />
        {/* Back & Front Legs with Crisp Outline + Dark Hooves */}
        <rect x="254" y="51" width="3" height="4" fill="#141016" />
        <rect x="255" y="51" width="1" height="3" fill="#e2e8f0" />
        <rect x="255" y="54" width="1" height="1" fill="#334155" />

        <rect x="258" y="51" width="3" height="4" fill="#141016" />
        <rect x="259" y="51" width="1" height="3" fill="#f8fafc" />
        <rect x="259" y="54" width="1" height="1" fill="#1e293b" />

        <rect x="263" y="51" width="3" height="4" fill="#141016" />
        <rect x="264" y="51" width="1" height="3" fill="#f8fafc" />
        <rect x="264" y="54" width="1" height="1" fill="#1e293b" />

        {/* Fluffy Woolly Body with Crisp 1px Outline & Highlight */}
        <rect x="253" y="43" width="15" height="9" fill="#141016" />
        <rect x="254" y="42" width="13" height="1" fill="#141016" />
        <rect x="254" y="43" width="13" height="8" fill="#f8fafc" />
        <rect x="255" y="43" width="10" height="2" fill="#ffffff" />
        <rect x="254" y="49" width="13" height="2" fill="#cbd5e1" />
        <rect x="265" y="44" width="2" height="5" fill="#e2e8f0" />

        {/* Perky Upturned Tail */}
        <rect x="268" y="42" width="3" height="3" fill="#141016" />
        <rect x="268" y="43" width="2" height="1" fill="#ffffff" />
        <rect x="269" y="42" width="1" height="1" fill="#f8fafc" />

        {/* Sculpted Curved Golden Horns */}
        <rect x="253" y="34" width="2" height="4" fill="#141016" />
        <rect x="255" y="33" width="3" height="2" fill="#141016" />
        <rect x="254" y="34" width="1" height="3" fill="#f59e0b" />
        <rect x="255" y="34" width="2" height="1" fill="#fde68a" />
        <rect x="256" y="36" width="2" height="2" fill="#d97706" />

        {/* Expressive Head & Floppy Ear */}
        <rect x="248" y="37" width="10" height="8" fill="#141016" />
        <rect x="249" y="38" width="8" height="6" fill="#ffffff" />
        <rect x="247" y="40" width="2" height="3" fill="#141016" />
        <rect x="248" y="40" width="2" height="2" fill="#f8fafc" />
        <rect x="256" y="39" width="2" height="3" fill="#e2e8f0" />
        {/* Bright Eye with Catchlight, Cute Pink Nose & Classic Goatee */}
        <rect x="250" y="39" width="2" height="2" fill="#0f172a" />
        <rect x="250" y="39" width="1" height="1" fill="#ffffff" />
        <rect x="248" y="41" width="1" height="1" fill="#fda4af" />
        <rect x="249" y="44" width="3" height="2" fill="#141016" />
        <rect x="250" y="44" width="1" height="2" fill="#e2e8f0" />
        <rect x="251" y="45" width="1" height="1" fill="#cbd5e1" />
      </g>

      {/* ================================================================= */}
      {/* 10. RESTRAINED ANIMATED PIXEL SPARKLES (BIG EARS & GOAT SUMMIT)   */}
      {/* ================================================================= */}
      {/* Big Ears Summit Crown Twinkles */}
      <g className="hero-pixel-twinkle">
        <rect x="200" y="13" width="1" height="5" fill="#fef08a" />
        <rect x="198" y="15" width="5" height="1" fill="#fef08a" />
        <rect x="200" y="15" width="1" height="1" fill="#ffffff" />
      </g>
      <g className="hero-pixel-twinkle-delayed">
        <rect x="243" y="14" width="1" height="5" fill="#fde047" />
        <rect x="241" y="16" width="5" height="1" fill="#fde047" />
        <rect x="243" y="16" width="1" height="1" fill="#ffffff" />
      </g>
      <g className="hero-pixel-twinkle-slow">
        <rect x="222" y="3" width="1" height="5" fill="#ffffff" />
        <rect x="220" y="5" width="5" height="1" fill="#ffffff" />
        <rect x="222" y="5" width="1" height="1" fill="#fef08a" />
      </g>

      {/* Subtle Golden Pixel Twinkle above GOAT */}
      <g className="hero-pixel-twinkle-delayed">
        <rect x="255" y="27" width="1" height="3" fill="#fde047" />
        <rect x="254" y="28" width="3" height="1" fill="#fde047" />
        <rect x="255" y="28" width="1" height="1" fill="#ffffff" />
      </g>
      <g className="hero-pixel-twinkle">
        <rect x="268" y="33" width="1" height="3" fill="#fef9c3" />
        <rect x="267" y="34" width="3" height="1" fill="#fef9c3" />
      </g>
    </svg>
  );
}

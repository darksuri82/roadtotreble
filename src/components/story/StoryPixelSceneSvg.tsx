import type {
  StoryPixelBackdropId,
  StoryPixelCharacterSpec,
} from '../../types/storyMode';

interface StoryPixelSceneSvgProps {
  backdrop: StoryPixelBackdropId;
  characters: StoryPixelCharacterSpec[];
  accentColor?: string;
}

const SKIN_HEX: Record<StoryPixelCharacterSpec['skinTone'], { main: string; shade: string }> = {
  light: { main: '#f6d6be', shade: '#e0b699' },
  peach: { main: '#f0c5a5', shade: '#d4a17e' },
  warm: { main: '#d9a074', shade: '#b87f54' },
  tan: { main: '#b87d52', shade: '#925e38' },
  deep: { main: '#7a4b32', shade: '#59331f' },
};

const HAIR_HEX: Record<StoryPixelCharacterSpec['hairColor'], string> = {
  brown: '#5c3a21',
  black: '#1a1f2b',
  silver: '#d8e0ea',
  blonde: '#e8c458',
};

function renderBackdrop(backdrop: StoryPixelBackdropId, accentColor: string) {
  const isMoscowRain = backdrop === 'moscow_rain_final';
  const isCounter = backdrop === 'counter_sprint';
  const isLungs = backdrop === 'three_lungs_engine';
  const isCrown = backdrop === 'underdog_crown' || backdrop === 'highbury_unbeaten';

  const skyTop =
    backdrop === 'old_trafford_night' || backdrop === 'calderon_fortress'
      ? '#160910'
      : isMoscowRain
        ? '#07111f'
        : '#081022';
  const skyMid =
    backdrop === 'old_trafford_night' || backdrop === 'calderon_fortress'
      ? '#26111a'
      : isMoscowRain
        ? '#0f1f36'
        : '#101d38';

  return (
    <g>
      {/* Night sky gradient bands (pixel dithered) */}
      <rect x="0" y="0" width="260" height="24" fill={skyTop} />
      <rect x="0" y="24" width="260" height="26" fill={skyMid} />
      <rect x="0" y="50" width="260" height="20" fill="#132035" />

      {/* Pixel stars */}
      {[
        [18, 8], [46, 14], [88, 6], [122, 11], [164, 7], [202, 13], [238, 9], [66, 22], [190, 20],
      ].map(([sx, sy], i) => (
        <rect
          key={i}
          x={sx}
          y={sy}
          width="2"
          height="2"
          fill={i % 3 === 0 ? '#fde68a' : '#94a3b8'}
          opacity={isMoscowRain ? 0.25 : 0.7}
        />
      ))}

      {/* Stadium roof & tiered stands silhouette */}
      <rect x="8" y="34" width="244" height="4" fill="#1e293b" />
      <rect x="14" y="38" width="232" height="14" fill="#0d1522" />
      <rect x="14" y="52" width="232" height="16" fill="#111b2c" />
      {/* Crowd dots */}
      {Array.from({ length: 34 }, (_, idx) => {
        const cx = 18 + idx * 6.8;
        const cy = 42 + (idx % 3) * 4;
        const color =
          idx % 4 === 0 ? accentColor : idx % 3 === 0 ? '#e2e8f0' : '#475569';
        return (
          <rect
            key={idx}
            x={Math.round(cx)}
            y={cy}
            width="2"
            height="2"
            fill={color}
            opacity="0.7"
          />
        );
      })}

      {/* Floodlight towers & diagonal light beams */}
      <rect x="20" y="14" width="4" height="22" fill="#334155" />
      <rect x="17" y="10" width="10" height="5" fill="#e2e8f0" />
      <rect x="236" y="14" width="4" height="22" fill="#334155" />
      <rect x="233" y="10" width="10" height="5" fill="#e2e8f0" />
      <polygon points="22,15 112,72 72,72 18,15" fill="#fef08a" opacity="0.06" />
      <polygon points="238,15 148,72 188,72 242,15" fill="#fef08a" opacity="0.06" />

      {/* Advertising board strip */}
      <rect x="0" y="67" width="260" height="5" fill="#090e17" />
      <rect x="0" y="68" width="260" height="2" fill={accentColor} opacity="0.55" />

      {/* Pixel grass pitch stripes */}
      <rect x="0" y="72" width="260" height="40" fill="#0f3d28" />
      <rect x="0" y="78" width="260" height="6" fill="#144c32" />
      <rect x="0" y="90" width="260" height="8" fill="#144c32" />
      <rect x="0" y="104" width="260" height="8" fill="#0c3221" />
      {/* Pitch touchline & center markings */}
      <rect x="0" y="74" width="260" height="1" fill="#e2e8f0" opacity="0.35" />
      <rect x="129" y="74" width="2" height="38" fill="#e2e8f0" opacity="0.18" />

      {/* Backdrop-specific iconic pixel motif */}
      {isCounter && (
        <g opacity="0.65">
          {/* Dynamic golden counter-attack sprint arrow pixels */}
          <rect x="24" y="88" width="26" height="2" fill="#fbbf24" />
          <rect x="54" y="86" width="18" height="2" fill="#fbbf24" />
          <rect x="76" y="84" width="12" height="2" fill="#fde68a" />
          <rect x="208" y="84" width="20" height="2" fill="#fbbf24" />
          <rect x="224" y="82" width="4" height="6" fill="#fde68a" />
        </g>
      )}

      {isLungs && (
        <g opacity="0.35">
          {/* Subtle glowing pulse waves behind Park Ji-sung */}
          <rect x="96" y="42" width="68" height="1" fill="#ef4444" />
          <rect x="108" y="38" width="44" height="1" fill="#fbbf24" />
          <rect x="118" y="34" width="24" height="1" fill="#ef4444" />
        </g>
      )}

      {(isCrown || isMoscowRain) && (
        <g>
          {/* Distant Golden Trophy / Big Ears silhouette above center */}
          <rect x="125" y="14" width="10" height="2" fill="#fde68a" />
          <rect x="124" y="16" width="12" height="7" fill="#f59e0b" />
          <rect x="121" y="17" width="3" height="4" fill="#fbbf24" />
          <rect x="136" y="17" width="3" height="4" fill="#fbbf24" />
          <rect x="128" y="23" width="4" height="4" fill="#d97706" />
          <rect x="125" y="27" width="10" height="3" fill="#fde68a" />
        </g>
      )}

      {/* Moscow 2008 diagonal pixel rain streaks */}
      {isMoscowRain && (
        <g opacity="0.45">
          {[
            [14, 18], [32, 30], [56, 12], [78, 44], [102, 22], [148, 16], [174, 34],
            [198, 20], [220, 42], [244, 24], [42, 62], [90, 58], [164, 60], [212, 64],
          ].map(([rx, ry], idx) => (
            <g key={idx}>
              <rect x={rx} y={ry} width="1" height="4" fill="#7dd3fc" />
              <rect x={rx - 1} y={ry + 4} width="1" height="4" fill="#38bdf8" />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

function renderPixelCharacter(char: StoryPixelCharacterSpec, index: number) {
  const skin = SKIN_HEX[char.skinTone];
  const hair = HAIR_HEX[char.hairColor];
  const cx = char.x;
  const baseY = 58; // head top around y=54, feet on grass y=94

  const isManager = char.kind === 'manager';

  return (
    <g key={`${char.name}-${index}`}>
      {/* Ground shadow */}
      <rect x={cx - 10} y={baseY + 34} width="20" height="3" fill="#051b11" opacity="0.7" />

      {/* Emblem above character */}
      {char.emblem === 'crown' && (
        <g>
          <rect x={cx - 6} y={baseY - 12} width="12" height="3" fill="#f59e0b" />
          <rect x={cx - 6} y={baseY - 15} width="2" height="3" fill="#fde68a" />
          <rect x={cx - 1} y={baseY - 16} width="2" height="4" fill="#fde68a" />
          <rect x={cx + 4} y={baseY - 15} width="2" height="3" fill="#fde68a" />
        </g>
      )}
      {char.emblem === 'lungs' && (
        <g>
          {/* Crisp pixel heart / three-lungs stamina emblem */}
          <rect x={cx - 6} y={baseY - 14} width="4" height="5" fill="#ef4444" />
          <rect x={cx + 2} y={baseY - 14} width="4" height="5" fill="#ef4444" />
          <rect x={cx - 2} y={baseY - 15} width="4" height="2" fill="#fbbf24" />
          <rect x={cx - 5} y={baseY - 13} width="2" height="2" fill="#fca5a5" />
          <rect x={cx + 3} y={baseY - 13} width="2" height="2" fill="#fca5a5" />
        </g>
      )}
      {char.emblem === 'bolt' && (
        <g>
          <rect x={cx - 1} y={baseY - 16} width="4" height="3" fill="#fde047" />
          <rect x={cx - 3} y={baseY - 13} width="5" height="2" fill="#facc15" />
          <rect x={cx - 1} y={baseY - 11} width="3" height="3" fill="#fde047" />
        </g>
      )}
      {char.emblem === 'shield' && (
        <g>
          <rect x={cx - 4} y={baseY - 15} width="8" height="6" fill={char.primaryColor} />
          <rect x={cx - 3} y={baseY - 14} width="6" height="4" fill={char.secondaryColor} />
          <rect x={cx - 2} y={baseY - 9} width="4" height="2" fill={char.primaryColor} />
        </g>
      )}
      {char.emblem === 'ball' && (
        <g>
          <rect x={cx - 3} y={baseY - 14} width="6" height="6" fill="#f8fafc" />
          <rect x={cx - 1} y={baseY - 12} width="2" height="2" fill="#0f172a" />
        </g>
      )}

      {/* Hair */}
      {char.hairStyle !== 'bald' && (
        <g>
          <rect x={cx - 6} y={baseY - 5} width="12" height="4" fill={hair} />
          <rect x={cx - 7} y={baseY - 3} width="2" height="4" fill={hair} />
          <rect x={cx + 5} y={baseY - 3} width="2" height="4" fill={hair} />
        </g>
      )}

      {/* Head */}
      <rect x={cx - 5} y={baseY - 2} width="10" height="9" fill={skin.main} />
      <rect x={cx - 5} y={baseY + 5} width="10" height="2" fill={skin.shade} />
      {/* Eyes */}
      <rect x={cx - 3} y={baseY + 1} width="2" height="2" fill="#0f172a" />
      <rect x={cx + 1} y={baseY + 1} width="2" height="2" fill="#0f172a" />

      {/* Neck */}
      <rect x={cx - 2} y={baseY + 7} width="4" height="2" fill={skin.shade} />

      {/* Torso: Suit/Coat for Manager, Football Kit for Player */}
      {isManager ? (
        <g>
          <rect x={cx - 9} y={baseY + 9} width="18" height="15" fill="#1e293b" />
          <rect x={cx - 7} y={baseY + 9} width="14" height="14" fill="#0f172a" />
          {/* White shirt collar & club-color tie */}
          <rect x={cx - 3} y={baseY + 9} width="6" height="4" fill="#f8fafc" />
          <rect x={cx - 1} y={baseY + 10} width="2" height="9" fill={char.primaryColor} />
          <rect x={cx - 1} y={baseY + 14} width="2" height="2" fill={char.secondaryColor} />
          {/* Sleeves & hands */}
          <rect x={cx - 11} y={baseY + 10} width="3" height="10" fill="#1e293b" />
          <rect x={cx + 8} y={baseY + 10} width="3" height="10" fill="#1e293b" />
          <rect x={cx - 11} y={baseY + 20} width="3" height="3" fill={skin.main} />
          <rect x={cx + 8} y={baseY + 20} width="3" height="3" fill={skin.main} />
          {/* Trousers & shoes */}
          <rect x={cx - 6} y={baseY + 24} width="5" height="9" fill="#0f172a" />
          <rect x={cx + 1} y={baseY + 24} width="5" height="9" fill="#0f172a" />
          <rect x={cx - 7} y={baseY + 32} width="6" height="3" fill="#334155" />
          <rect x={cx + 1} y={baseY + 32} width="6" height="3" fill="#334155" />
        </g>
      ) : (
        <g>
          {/* Jersey body */}
          <rect x={cx - 8} y={baseY + 9} width="16" height="13" fill={char.primaryColor} />
          {/* Accent trim / collar */}
          <rect x={cx - 4} y={baseY + 9} width="8" height="2" fill={char.secondaryColor} />
          {char.pattern === 'stripes' && (
            <>
              <rect x={cx - 5} y={baseY + 11} width="2" height="11" fill={char.secondaryColor} />
              <rect x={cx - 1} y={baseY + 11} width="2" height="11" fill={char.secondaryColor} />
              <rect x={cx + 3} y={baseY + 11} width="2" height="11" fill={char.secondaryColor} />
            </>
          )}
          {/* Sleeves & arms */}
          <rect x={cx - 11} y={baseY + 10} width="3" height="6" fill={char.primaryColor} />
          <rect x={cx + 8} y={baseY + 10} width="3" height="6" fill={char.primaryColor} />
          <rect x={cx - 11} y={baseY + 16} width="3" height="5" fill={skin.main} />
          <rect x={cx + 8} y={baseY + 16} width="3" height="5" fill={skin.main} />
          {/* Shorts */}
          <rect x={cx - 7} y={baseY + 22} width="14" height="5" fill={char.secondaryColor} />
          <rect x={cx - 1} y={baseY + 25} width="2" height="2" fill="#0f3d28" />
          {/* Legs & socks & boots */}
          <rect x={cx - 6} y={baseY + 27} width="4" height="3" fill={skin.main} />
          <rect x={cx + 2} y={baseY + 27} width="4" height="3" fill={skin.main} />
          <rect x={cx - 6} y={baseY + 30} width="4" height="3" fill={char.primaryColor} />
          <rect x={cx + 2} y={baseY + 30} width="4" height="3" fill={char.primaryColor} />
          <rect x={cx - 7} y={baseY + 33} width="5" height="2" fill="#0f172a" />
          <rect x={cx + 2} y={baseY + 33} width="5" height="2" fill="#0f172a" />
        </g>
      )}

      {/* Nameplate pill at bottom of pitch */}
      <rect
        x={cx - 24}
        y={baseY + 38}
        width="48"
        height="11"
        rx="2"
        fill="#090d13"
        opacity="0.88"
      />
      <text
        x={cx}
        y={baseY + 46}
        textAnchor="middle"
        fill="#f8fafc"
        fontSize="6.5"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {char.shirtNumber ? `#${char.shirtNumber} ` : ''}
        {char.name}
      </text>
    </g>
  );
}

export function StoryPixelSceneSvg({
  backdrop,
  characters,
  accentColor = '#10b981',
}: StoryPixelSceneSvgProps) {
  return (
    <svg
      viewBox="0 0 260 112"
      className="w-full h-auto block select-none"
      style={{ imageRendering: 'pixelated' }}
      shapeRendering="crispEdges"
      role="img"
      aria-label="스토리 모드 픽셀 일러스트"
    >
      {renderBackdrop(backdrop, accentColor)}
      {characters.map((char, idx) => renderPixelCharacter(char, idx))}
    </svg>
  );
}

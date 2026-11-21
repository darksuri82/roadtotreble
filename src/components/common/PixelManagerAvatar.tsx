import type {
  ManagerAvatarConfig,
  ManagerHairColorId,
  ManagerHairStyleId,
  ManagerOutfitId,
  ManagerSkinToneId,
} from '../../types/game';
import { DEFAULT_MANAGER_AVATAR } from '../../types/game';

export const SKIN_TONE_OPTIONS: {
  id: ManagerSkinToneId;
  label: string;
  base: string;
  shadow: string;
  highlight: string;
}[] = [
  { id: 'light', label: '밝은 톤', base: '#fde4d2', shadow: '#e4b79c', highlight: '#fff3ea' },
  { id: 'peach', label: '내추럴', base: '#f8d0b0', shadow: '#d9a079', highlight: '#ffe4cd' },
  { id: 'warm', label: '웜 톤', base: '#eab48a', shadow: '#c28559', highlight: '#f7c9a3' },
  { id: 'tan', label: '탠', base: '#c98a5e', shadow: '#9c6038', highlight: '#dca177' },
  { id: 'deep', label: '딥 톤', base: '#8d5636', shadow: '#63371e', highlight: '#a76d49' },
];

export const HAIR_COLOR_OPTIONS: {
  id: ManagerHairColorId;
  label: string;
  base: string;
  shadow: string;
  highlight: string;
}[] = [
  { id: 'brown', label: '다크 브라운', base: '#362720', shadow: '#221713', highlight: '#523d32' },
  { id: 'black', label: '제트 블랙', base: '#1e212a', shadow: '#11131a', highlight: '#353b4a' },
  { id: 'silver', label: '실버 그레이', base: '#cbd5e1', shadow: '#8596ab', highlight: '#f1f5f9' },
  { id: 'blonde', label: '골드 블론드', base: '#d9a441', shadow: '#a67421', highlight: '#f2cb72' },
];

export const HAIR_STYLE_OPTIONS: { id: ManagerHairStyleId; label: string }[] = [
  { id: 'fluffy', label: '내추럴 컷' },
  { id: 'parted', label: '가르마 컷' },
  { id: 'slick', label: '올백 포마드' },
  { id: 'buzz', label: '숏 크롭' },
];

export const OUTFIT_OPTIONS: {
  id: ManagerOutfitId;
  label: string;
  previewColor: string;
}[] = [
  { id: 'classic_suit', label: '블랙 수트', previewColor: '#1e2430' },
  { id: 'navy_coat', label: '네이비 코트', previewColor: '#1e3a5f' },
  { id: 'team_tracksuit', label: '팀 트레이닝복', previewColor: '#10b981' },
  { id: 'casual_shirt', label: '화이트 셔츠', previewColor: '#e2e8f0' },
  { id: 'puffer_jacket', label: '터치라인 패딩', previewColor: '#334155' },
];

interface PixelManagerAvatarProps {
  avatar?: ManagerAvatarConfig | null;
  clubPrimaryColor?: string;
  clubSecondaryColor?: string;
  size?: number;
  className?: string;
}

/**
 * 2-head-tall chibi pixel-art football manager avatar (28x34 pixel grid)
 * styled after crisp 1px dark-outlined retro chibi sprites.
 */
export function PixelManagerAvatar({
  avatar,
  clubPrimaryColor = '#10b981',
  clubSecondaryColor = '#f8fafc',
  size = 84,
  className = '',
}: PixelManagerAvatarProps) {
  const cfg = avatar ?? DEFAULT_MANAGER_AVATAR;
  const skin =
    SKIN_TONE_OPTIONS.find((s) => s.id === cfg.skinTone) ?? SKIN_TONE_OPTIONS[1];
  const hair =
    HAIR_COLOR_OPTIONS.find((h) => h.id === cfg.hairColor) ?? HAIR_COLOR_OPTIONS[0];

  const O = '#141016'; // Crisp dark outline

  // Outfit color tokens
  let topMain = '#1e2430';
  let topShade = '#12161f';
  let topHighlight = '#333d50';
  let innerMain = '#f8fafc';
  let accent = '#dc2626'; // tie / zip / stripe
  let pantsMain = '#1e2530';
  let pantsShade = '#11161e';
  let shoeMain = '#1b1d24';
  let shoeHi = '#3a3f4d';

  if (cfg.outfit === 'navy_coat') {
    topMain = '#1f365c';
    topShade = '#142440';
    topHighlight = '#315287';
    innerMain = '#28303d';
    accent = '#94a3b8';
    pantsMain = '#202630';
    pantsShade = '#141820';
  } else if (cfg.outfit === 'team_tracksuit') {
    topMain = clubPrimaryColor;
    topShade = '#151c26';
    topHighlight = clubSecondaryColor;
    innerMain = clubSecondaryColor;
    accent = clubSecondaryColor;
    pantsMain = '#19202b';
    pantsShade = '#10151d';
  } else if (cfg.outfit === 'casual_shirt') {
    topMain = '#e2e8f0';
    topShade = '#cbd5e1';
    topHighlight = '#ffffff';
    innerMain = '#ffffff';
    accent = '#38bdf8';
    pantsMain = '#2b3445';
    pantsShade = '#1c2330';
  } else if (cfg.outfit === 'puffer_jacket') {
    topMain = '#2d3748';
    topShade = '#1a202c';
    topHighlight = '#4a5568';
    innerMain = '#cbd5e1';
    accent = '#f59e0b';
    pantsMain = '#1a202c';
    pantsShade = '#11151d';
  }

  // Pixel drawing helper onto a 28x34 canvas
  const W = 28;
  const H = 34;
  const pixels: (string | null)[][] = Array.from({ length: H }, () =>
    Array<string | null>(W).fill(null),
  );

  const px = (x: number, y: number, color: string) => {
    if (x >= 0 && x < W && y >= 0 && y < H) {
      pixels[y][x] = color;
    }
  };

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        px(x + dx, y + dy, color);
      }
    }
  };

  // 1) HEAD BASE (Chibi rounded face: x=7..20, y=6..18)
  rect(8, 6, 12, 12, skin.base);
  rect(7, 8, 14, 9, skin.base);
  // Subtle forehead highlight & cheek/chin shadow
  rect(10, 10, 8, 1, skin.highlight);
  rect(8, 16, 12, 1, skin.shadow);
  rect(9, 17, 10, 1, skin.shadow);
  px(8, 15, skin.shadow);
  px(19, 15, skin.shadow);
  // Head outline (chin + sides)
  rect(9, 18, 10, 1, O);
  px(8, 17, O);
  px(19, 17, O);
  px(7, 16, O);
  px(20, 16, O);

  // Ears (chibi rounded side ears like reference image)
  rect(5, 13, 2, 3, skin.base);
  px(6, 15, skin.shadow);
  px(5, 12, O);
  px(4, 13, O);
  px(4, 14, O);
  px(5, 15, O);
  px(6, 16, O);

  rect(21, 13, 2, 3, skin.base);
  px(21, 15, skin.shadow);
  px(22, 12, O);
  px(23, 13, O);
  px(23, 14, O);
  px(22, 15, O);
  px(21, 16, O);

  // 2) EYES, EYEBROWS & MOUTH (matching reference chibi look)
  // Eyebrows
  rect(9, 11, 3, 1, O);
  rect(16, 11, 3, 1, O);
  // Left eye (x=9..11, y=12..14): crisp white outer sclera + dark vertical oval pupil
  px(9, 12, '#ffffff');
  px(9, 13, '#ffffff');
  px(9, 14, '#e2e8f0');
  rect(10, 12, 2, 3, '#17151c');
  px(10, 12, '#35313f'); // subtle shine
  // Right eye (x=16..18, y=12..14)
  px(18, 12, '#ffffff');
  px(18, 13, '#ffffff');
  px(18, 14, '#e2e8f0');
  rect(16, 12, 2, 3, '#17151c');
  px(16, 12, '#35313f');
  // Subtle mouth
  rect(13, 16, 2, 1, skin.shadow);

  // 3) HAIR (4 distinct styles, default 'fluffy' mirrors reference image)
  if (cfg.hairStyle === 'fluffy') {
    // Fluffy layered silhouette with spiky tufts on crown & sides
    rect(7, 3, 14, 7, hair.base);
    rect(5, 5, 18, 6, hair.base);
    rect(4, 7, 20, 4, hair.base);
    // Crown highlights
    rect(9, 4, 3, 2, hair.highlight);
    rect(15, 4, 3, 2, hair.highlight);
    rect(12, 6, 4, 1, hair.highlight);
    // Root shading
    rect(6, 9, 16, 1, hair.shadow);
    // Bangs hanging over forehead (jagged chibi bangs)
    rect(7, 10, 3, 2, hair.base);
    rect(11, 10, 3, 2, hair.base);
    rect(15, 10, 3, 2, hair.base);
    rect(19, 10, 2, 2, hair.base);
    px(8, 12, hair.shadow);
    px(12, 12, hair.shadow);
    px(16, 12, hair.shadow);
    px(19, 12, hair.shadow);
    // Side locks framing ears
    rect(5, 10, 2, 3, hair.shadow);
    rect(21, 10, 2, 3, hair.shadow);
    // Crisp dark top & side outline + spikes
    rect(10, 1, 3, 1, O);
    rect(15, 1, 3, 1, O);
    rect(8, 2, 2, 1, O);
    px(13, 2, O);
    px(14, 2, O);
    rect(18, 2, 2, 1, O);
    px(11, 2, hair.base);
    px(12, 2, hair.base);
    px(15, 2, hair.base);
    px(16, 2, hair.base);
    rect(6, 3, 2, 1, O);
    rect(20, 3, 2, 1, O);
    px(4, 4, O);
    px(5, 4, O);
    px(22, 4, O);
    px(23, 4, O);
    px(3, 6, O);
    px(4, 5, O);
    px(23, 5, O);
    px(24, 6, O);
    px(3, 7, O);
    px(24, 7, O);
    px(2, 9, O);
    px(3, 8, O);
    px(3, 10, O);
    px(4, 11, O);
    px(25, 9, O);
    px(24, 8, O);
    px(24, 10, O);
    px(23, 11, O);
  } else if (cfg.hairStyle === 'parted') {
    // Neat 6:4 side-parted modern manager cut
    rect(7, 3, 14, 7, hair.base);
    rect(6, 5, 16, 6, hair.base);
    rect(8, 4, 5, 2, hair.highlight);
    rect(16, 4, 3, 1, hair.highlight);
    // Side part gap exposing forehead
    rect(16, 9, 2, 2, skin.base);
    // Swept bangs
    rect(7, 9, 8, 2, hair.base);
    rect(18, 9, 3, 2, hair.base);
    rect(7, 10, 3, 2, hair.shadow);
    rect(19, 10, 2, 2, hair.shadow);
    // Outline
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(5, 5, 1, 6, O);
    rect(22, 5, 1, 6, O);
    px(6, 11, O);
    px(21, 11, O);
  } else if (cfg.hairStyle === 'slick') {
    // Classic slicked-back veteran manager pompadour
    rect(8, 2, 12, 7, hair.base);
    rect(6, 4, 16, 6, hair.base);
    rect(9, 3, 10, 2, hair.highlight);
    rect(7, 8, 14, 1, hair.shadow);
    // Clean high forehead
    rect(8, 9, 12, 2, skin.base);
    rect(6, 9, 2, 3, hair.shadow);
    rect(20, 9, 2, 3, hair.shadow);
    // Outline
    rect(9, 1, 10, 1, O);
    px(8, 2, O);
    px(19, 2, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(5, 5, 1, 6, O);
    rect(22, 5, 1, 6, O);
    px(6, 11, O);
    px(21, 11, O);
  } else {
    // Buzz / short crop
    rect(7, 4, 14, 6, hair.base);
    rect(6, 6, 16, 5, hair.base);
    rect(9, 5, 10, 1, hair.highlight);
    rect(7, 9, 14, 1, hair.shadow);
    rect(8, 10, 12, 1, skin.base);
    // Outline
    rect(8, 3, 12, 1, O);
    px(7, 4, O);
    px(20, 4, O);
    px(6, 5, O);
    px(21, 5, O);
    rect(5, 6, 1, 5, O);
    rect(22, 6, 1, 5, O);
    px(6, 11, O);
    px(21, 11, O);
  }

  // 4) NECK & COMPACT CHIBI TORSO (y=19..26)
  rect(12, 18, 4, 2, skin.shadow);
  rect(13, 18, 2, 2, skin.base);

  // Torso main shape
  rect(8, 19, 12, 7, topMain);
  rect(9, 20, 10, 6, topMain);
  // Subtle shoulder/side shading
  rect(8, 20, 1, 6, topShade);
  rect(19, 20, 1, 6, topShade);

  // Outfit-specific details
  if (cfg.outfit === 'classic_suit') {
    // White V-shirt + crimson tie + jacket lapels
    rect(12, 19, 4, 4, innerMain);
    rect(13, 20, 2, 5, accent);
    px(11, 20, topHighlight);
    px(16, 20, topHighlight);
    px(11, 21, topHighlight);
    px(16, 21, topHighlight);
    px(13, 24, '#991b1b');
  } else if (cfg.outfit === 'navy_coat') {
    // Turtleneck + double-breasted coat buttons
    rect(12, 19, 4, 3, innerMain);
    rect(11, 20, 1, 6, topHighlight);
    rect(16, 20, 1, 6, topHighlight);
    px(12, 22, accent);
    px(15, 22, accent);
    px(12, 24, accent);
    px(15, 24, accent);
  } else if (cfg.outfit === 'team_tracksuit') {
    // White shoulder stripes + center zip + club crest dot
    rect(8, 19, 3, 1, topHighlight);
    rect(17, 19, 3, 1, topHighlight);
    rect(13, 19, 2, 7, innerMain);
    px(10, 22, topHighlight);
    px(17, 22, accent);
  } else if (cfg.outfit === 'casual_shirt') {
    // Crisp open collar + subtle placket
    rect(12, 19, 4, 2, innerMain);
    rect(13, 20, 2, 6, topShade);
    px(13, 21, accent);
    px(13, 23, accent);
  } else if (cfg.outfit === 'puffer_jacket') {
    // Horizontal quilted baffles + bright zipper
    rect(9, 21, 10, 1, topShade);
    rect(9, 23, 10, 1, topShade);
    rect(9, 25, 10, 1, topShade);
    rect(13, 19, 2, 7, accent);
  }

  // Torso outer border
  rect(8, 19, 3, 1, O);
  rect(17, 19, 3, 1, O);
  rect(8, 26, 12, 1, O);

  // Arms hanging cleanly at sides (matching reference pose)
  // Left arm (x=6..7)
  rect(6, 20, 2, 4, topMain);
  px(6, 20, O);
  px(5, 21, O);
  px(5, 22, O);
  px(5, 23, O);
  // Left hand
  rect(6, 24, 2, 2, skin.base);
  px(6, 25, skin.shadow);
  px(5, 24, O);
  px(5, 25, O);
  rect(6, 26, 2, 1, O);

  // Right arm (x=20..21)
  rect(20, 20, 2, 4, topMain);
  px(21, 20, O);
  px(22, 21, O);
  px(22, 22, O);
  px(22, 23, O);
  // Right hand
  rect(20, 24, 2, 2, skin.base);
  px(21, 25, skin.shadow);
  px(22, 24, O);
  px(22, 25, O);
  rect(20, 26, 2, 1, O);

  // 5) TROUSERS & SHOES (y=27..32)
  // Left leg
  rect(9, 27, 4, 3, pantsMain);
  px(9, 27, pantsShade);
  px(9, 28, pantsShade);
  px(9, 29, pantsShade);
  rect(8, 27, 1, 3, O);
  rect(13, 28, 1, 2, O);

  // Right leg
  rect(15, 27, 4, 3, pantsMain);
  px(18, 27, pantsShade);
  px(18, 28, pantsShade);
  px(18, 29, pantsShade);
  rect(19, 27, 1, 3, O);
  rect(14, 28, 1, 2, O);
  // Waist center connector
  px(13, 27, pantsShade);
  px(14, 27, pantsShade);

  // Rounded dark chibi shoes (y=30..32)
  rect(8, 30, 5, 2, shoeMain);
  rect(9, 30, 2, 1, shoeHi);
  px(7, 31, O);
  rect(8, 32, 5, 1, O);
  px(13, 30, O);
  px(13, 31, O);

  rect(15, 30, 5, 2, shoeMain);
  rect(17, 30, 2, 1, shoeHi);
  px(20, 31, O);
  rect(15, 32, 5, 1, O);
  px(14, 30, O);
  px(14, 31, O);

  // Merge adjacent pixels into horizontal rects for clean minimal SVG DOM
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  for (let y = 0; y < H; y += 1) {
    let x = 0;
    while (x < W) {
      const col = pixels[y][x];
      if (!col) {
        x += 1;
        continue;
      }
      let w = 1;
      while (x + w < W && pixels[y][x + w] === col) {
        w += 1;
      }
      rects.push({ x, y, w, fill: col });
      x += w;
    }
  }

  return (
    <svg
      width={size}
      height={Math.round((size * H) / W)}
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      className={`pixel-crisp select-none ${className}`}
      aria-label="감독 도트 캐릭터"
    >
      {rects.map((r, idx) => (
        <rect
          key={idx}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={r.fill}
        />
      ))}
    </svg>
  );
}

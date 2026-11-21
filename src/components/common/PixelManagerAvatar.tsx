import type {
  ManagerAvatarConfig,
  ManagerGenderId,
  ManagerHairColorId,
  ManagerHairStyleId,
  ManagerOutfitId,
  ManagerSkinToneId,
} from '../../types/game';
import { DEFAULT_MANAGER_AVATAR } from '../../types/game';

export const GENDER_OPTIONS: {
  id: ManagerGenderId;
  label: string;
}[] = [
  { id: 'male', label: '남성' },
  { id: 'female', label: '여성' },
];

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

export const HAIR_STYLE_OPTIONS: {
  id: ManagerHairStyleId;
  label: string;
  recommendedFor: 'male' | 'female' | 'both';
}[] = [
  { id: 'fluffy', label: '내추럴 컷', recommendedFor: 'male' },
  { id: 'parted', label: '가르마 컷', recommendedFor: 'male' },
  { id: 'slick', label: '올백 포마드', recommendedFor: 'male' },
  { id: 'buzz', label: '스포츠 숏컷', recommendedFor: 'male' },
  { id: 'bald', label: '대머리 (명장)', recommendedFor: 'both' },
  { id: 'bob', label: '단발 컷', recommendedFor: 'female' },
  { id: 'ponytail', label: '포니테일', recommendedFor: 'female' },
  { id: 'long_wave', label: '웨이브 롱헤어', recommendedFor: 'female' },
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
  avatar?: Partial<ManagerAvatarConfig> | null;
  clubPrimaryColor?: string;
  clubSecondaryColor?: string;
  size?: number;
  className?: string;
}

/**
 * 2-head-tall chibi pixel-art football manager avatar (28x34 pixel grid)
 * supporting Male/Female expressions, Bald cranium gleam, 8 hairstyles, and 5 outfits.
 */
export function PixelManagerAvatar({
  avatar,
  clubPrimaryColor = '#10b981',
  clubSecondaryColor = '#f8fafc',
  size = 84,
  className = '',
}: PixelManagerAvatarProps) {
  const cfg: ManagerAvatarConfig = {
    gender: avatar?.gender === 'female' ? 'female' : 'male',
    skinTone: avatar?.skinTone ?? DEFAULT_MANAGER_AVATAR.skinTone,
    hairStyle: avatar?.hairStyle ?? DEFAULT_MANAGER_AVATAR.hairStyle,
    hairColor: avatar?.hairColor ?? DEFAULT_MANAGER_AVATAR.hairColor,
    outfit: avatar?.outfit ?? DEFAULT_MANAGER_AVATAR.outfit,
  };
  const isFemale = cfg.gender === 'female';
  const skin =
    SKIN_TONE_OPTIONS.find((s) => s.id === cfg.skinTone) ?? SKIN_TONE_OPTIONS[1];
  const hair =
    HAIR_COLOR_OPTIONS.find((h) => h.id === cfg.hairColor) ?? HAIR_COLOR_OPTIONS[0];

  const O = '#141016'; // Crisp 1px dark outline

  // Outfit color tokens
  let topMain = '#1e2430';
  let topShade = '#12161f';
  let topHighlight = '#333d50';
  let innerMain = '#f8fafc';
  let accent = '#dc2626';
  let pantsMain = '#1e2530';
  let pantsShade = '#11161e';
  const shoeMain = '#1b1d24';
  const shoeHi = '#3a3f4d';

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

  // 0) BACK HAIR LAYER (behind body/head for long_wave, bob, ponytail)
  if (cfg.hairStyle === 'long_wave') {
    rect(4, 11, 20, 14, hair.shadow);
    rect(5, 11, 18, 13, hair.base);
    rect(3, 14, 1, 9, O);
    rect(24, 14, 1, 9, O);
    px(4, 23, O);
    px(23, 23, O);
    rect(5, 24, 3, 1, O);
    rect(20, 24, 3, 1, O);
    // Subtle wave highlights on sides
    px(5, 17, hair.highlight);
    px(5, 20, hair.highlight);
    px(22, 17, hair.highlight);
    px(22, 20, hair.highlight);
  } else if (cfg.hairStyle === 'bob') {
    rect(5, 11, 18, 9, hair.shadow);
    rect(6, 11, 16, 8, hair.base);
    rect(4, 12, 1, 7, O);
    rect(23, 12, 1, 7, O);
    px(5, 19, O);
    px(22, 19, O);
  } else if (cfg.hairStyle === 'ponytail') {
    // High side ponytail draping on right side
    rect(21, 7, 4, 10, hair.base);
    rect(22, 10, 3, 8, hair.shadow);
    rect(22, 8, 2, 2, hair.highlight);
    // Hair tie accent
    px(21, 7, '#f43f5e');
    px(21, 8, '#fb7185');
    // Ponytail outline
    rect(22, 6, 3, 1, O);
    px(25, 7, O);
    rect(25, 8, 1, 9, O);
    px(24, 17, O);
    rect(22, 18, 2, 1, O);
  }

  // 1) HEAD BASE (Chibi rounded face: x=7..20, y=6..18)
  rect(8, 6, 12, 12, skin.base);
  rect(7, 8, 14, 9, skin.base);
  rect(10, 10, 8, 1, skin.highlight);
  rect(8, 16, 12, 1, skin.shadow);
  rect(9, 17, 10, 1, skin.shadow);
  px(8, 15, skin.shadow);
  px(19, 15, skin.shadow);
  // Subtle warm rosy blush for female managers
  if (isFemale) {
    px(8, 15, '#f29f9f');
    px(19, 15, '#f29f9f');
  }
  // Head outline (chin + sides)
  rect(9, 18, 10, 1, O);
  px(8, 17, O);
  px(19, 17, O);
  px(7, 16, O);
  px(20, 16, O);

  // Ears (covered slightly by long_wave/bob)
  if (cfg.hairStyle !== 'long_wave' && cfg.hairStyle !== 'bob') {
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
  }

  // 2) EYES, EYEBROWS & MOUTH
  if (isFemale) {
    // Slightly thinner arched brows + cute eyelash flick on outer eye corners
    rect(9, 11, 3, 1, '#2b2024');
    rect(16, 11, 3, 1, '#2b2024');
    // Left eye with outer lash pixel
    px(8, 12, O);
    px(9, 12, '#ffffff');
    px(9, 13, '#ffffff');
    px(9, 14, '#e2e8f0');
    rect(10, 12, 2, 3, '#17151c');
    px(10, 12, '#ffffff'); // bright chibi eye sparkle
    // Right eye with outer lash pixel
    px(19, 12, O);
    px(18, 12, '#ffffff');
    px(18, 13, '#ffffff');
    px(18, 14, '#e2e8f0');
    rect(16, 12, 2, 3, '#17151c');
    px(17, 12, '#ffffff');
    // Soft smile mouth
    rect(13, 16, 2, 1, '#c97f7a');
  } else {
    // Classic crisp male manager brows & eyes matching reference sprite
    rect(9, 11, 3, 1, O);
    rect(16, 11, 3, 1, O);
    px(9, 12, '#ffffff');
    px(9, 13, '#ffffff');
    px(9, 14, '#e2e8f0');
    rect(10, 12, 2, 3, '#17151c');
    px(10, 12, '#35313f');
    px(18, 12, '#ffffff');
    px(18, 13, '#ffffff');
    px(18, 14, '#e2e8f0');
    rect(16, 12, 2, 3, '#17151c');
    px(16, 12, '#35313f');
    rect(13, 16, 2, 1, skin.shadow);
  }

  // 3) HAIR / BALD CRANIUM (8 styles)
  if (cfg.hairStyle === 'bald') {
    // Smooth rounded pixel cranium (Pep / Zidane / Slot iconic manager look!)
    rect(9, 4, 10, 4, skin.base);
    rect(7, 6, 14, 5, skin.base);
    rect(6, 8, 16, 4, skin.base);
    // Subtle temple shadow
    rect(7, 9, 1, 3, skin.shadow);
    rect(20, 9, 1, 3, skin.shadow);
    // Iconic shiny pixel highlight gleam on upper-left cranium
    rect(10, 5, 3, 2, skin.highlight);
    px(10, 5, '#ffffff');
    px(11, 5, '#ffffff');
    px(14, 5, skin.highlight);
    // Smooth dark cranium outline
    rect(9, 3, 10, 1, O);
    px(8, 4, O);
    px(19, 4, O);
    px(7, 5, O);
    px(20, 5, O);
    px(6, 6, O);
    px(21, 6, O);
    rect(6, 7, 1, 5, O);
    rect(21, 7, 1, 5, O);
  } else if (cfg.hairStyle === 'fluffy') {
    rect(7, 3, 14, 7, hair.base);
    rect(5, 5, 18, 6, hair.base);
    rect(4, 7, 20, 4, hair.base);
    rect(9, 4, 3, 2, hair.highlight);
    rect(15, 4, 3, 2, hair.highlight);
    rect(12, 6, 4, 1, hair.highlight);
    rect(6, 9, 16, 1, hair.shadow);
    rect(7, 10, 3, 2, hair.base);
    rect(11, 10, 3, 2, hair.base);
    rect(15, 10, 3, 2, hair.base);
    rect(19, 10, 2, 2, hair.base);
    px(8, 12, hair.shadow);
    px(12, 12, hair.shadow);
    px(16, 12, hair.shadow);
    px(19, 12, hair.shadow);
    rect(5, 10, 2, 3, hair.shadow);
    rect(21, 10, 2, 3, hair.shadow);
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
    rect(7, 3, 14, 7, hair.base);
    rect(6, 5, 16, 6, hair.base);
    rect(8, 4, 5, 2, hair.highlight);
    rect(16, 4, 3, 1, hair.highlight);
    rect(16, 9, 2, 2, skin.base);
    rect(7, 9, 8, 2, hair.base);
    rect(18, 9, 3, 2, hair.base);
    rect(7, 10, 3, 2, hair.shadow);
    rect(19, 10, 2, 2, hair.shadow);
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
    rect(8, 2, 12, 7, hair.base);
    rect(6, 4, 16, 6, hair.base);
    rect(9, 3, 10, 2, hair.highlight);
    rect(7, 8, 14, 1, hair.shadow);
    rect(8, 9, 12, 2, skin.base);
    rect(6, 9, 2, 3, hair.shadow);
    rect(20, 9, 2, 3, hair.shadow);
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
  } else if (cfg.hairStyle === 'buzz') {
    rect(7, 4, 14, 6, hair.base);
    rect(6, 6, 16, 5, hair.base);
    rect(9, 5, 10, 1, hair.highlight);
    rect(7, 9, 14, 1, hair.shadow);
    rect(8, 10, 12, 1, skin.base);
    rect(8, 3, 12, 1, O);
    px(7, 4, O);
    px(20, 4, O);
    px(6, 5, O);
    px(21, 5, O);
    rect(5, 6, 1, 5, O);
    rect(22, 6, 1, 5, O);
    px(6, 11, O);
    px(21, 11, O);
  } else if (cfg.hairStyle === 'bob') {
    // Rounded chibi bob crown + framing cheek locks
    rect(7, 3, 14, 7, hair.base);
    rect(5, 5, 18, 6, hair.base);
    rect(9, 4, 10, 2, hair.highlight);
    rect(7, 9, 14, 2, hair.base);
    rect(12, 10, 4, 1, skin.base); // airy center fringe
    // Framing side locks
    rect(5, 10, 2, 8, hair.base);
    rect(21, 10, 2, 8, hair.base);
    px(6, 17, hair.shadow);
    px(21, 17, hair.shadow);
    // Crown outline
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(4, 5, 1, 7, O);
    rect(23, 5, 1, 7, O);
  } else if (cfg.hairStyle === 'ponytail') {
    // Sleek pulled-back top + soft wispy bangs
    rect(7, 3, 14, 7, hair.base);
    rect(6, 5, 16, 6, hair.base);
    rect(9, 4, 9, 2, hair.highlight);
    rect(7, 9, 5, 2, hair.base);
    rect(16, 9, 5, 2, hair.base);
    rect(12, 9, 4, 2, skin.base);
    px(11, 11, hair.shadow);
    px(16, 11, hair.shadow);
    // Crown outline
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(5, 5, 1, 6, O);
    rect(22, 5, 1, 6, O);
  } else {
    // long_wave front crown + bangs + side face-framing waves
    rect(7, 3, 14, 7, hair.base);
    rect(5, 5, 18, 6, hair.base);
    rect(9, 4, 10, 2, hair.highlight);
    rect(7, 9, 6, 2, hair.base);
    rect(15, 9, 6, 2, hair.base);
    px(13, 10, hair.shadow);
    rect(5, 10, 2, 11, hair.base);
    rect(21, 10, 2, 11, hair.base);
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(4, 5, 1, 9, O);
    rect(23, 5, 1, 9, O);
  }

  // 4) NECK & COMPACT CHIBI TORSO (y=19..26)
  rect(12, 18, 4, 2, skin.shadow);
  rect(13, 18, 2, 2, skin.base);

  rect(8, 19, 12, 7, topMain);
  rect(9, 20, 10, 6, topMain);
  rect(8, 20, 1, 6, topShade);
  rect(19, 20, 1, 6, topShade);

  if (cfg.outfit === 'classic_suit') {
    rect(12, 19, 4, 4, innerMain);
    rect(13, 20, 2, 5, accent);
    px(11, 20, topHighlight);
    px(16, 20, topHighlight);
    px(11, 21, topHighlight);
    px(16, 21, topHighlight);
    px(13, 24, '#991b1b');
  } else if (cfg.outfit === 'navy_coat') {
    rect(12, 19, 4, 3, innerMain);
    rect(11, 20, 1, 6, topHighlight);
    rect(16, 20, 1, 6, topHighlight);
    px(12, 22, accent);
    px(15, 22, accent);
    px(12, 24, accent);
    px(15, 24, accent);
  } else if (cfg.outfit === 'team_tracksuit') {
    rect(8, 19, 3, 1, topHighlight);
    rect(17, 19, 3, 1, topHighlight);
    rect(13, 19, 2, 7, innerMain);
    px(10, 22, topHighlight);
    px(17, 22, accent);
  } else if (cfg.outfit === 'casual_shirt') {
    rect(12, 19, 4, 2, innerMain);
    rect(13, 20, 2, 6, topShade);
    px(13, 21, accent);
    px(13, 23, accent);
  } else if (cfg.outfit === 'puffer_jacket') {
    rect(9, 21, 10, 1, topShade);
    rect(9, 23, 10, 1, topShade);
    rect(9, 25, 10, 1, topShade);
    rect(13, 19, 2, 7, accent);
  }

  rect(8, 19, 3, 1, O);
  rect(17, 19, 3, 1, O);
  rect(8, 26, 12, 1, O);

  // Arms & hands
  rect(6, 20, 2, 4, topMain);
  px(6, 20, O);
  px(5, 21, O);
  px(5, 22, O);
  px(5, 23, O);
  rect(6, 24, 2, 2, skin.base);
  px(6, 25, skin.shadow);
  px(5, 24, O);
  px(5, 25, O);
  rect(6, 26, 2, 1, O);

  rect(20, 20, 2, 4, topMain);
  px(21, 20, O);
  px(22, 21, O);
  px(22, 22, O);
  px(22, 23, O);
  rect(20, 24, 2, 2, skin.base);
  px(21, 25, skin.shadow);
  px(22, 24, O);
  px(22, 25, O);
  rect(20, 26, 2, 1, O);

  // 5) TROUSERS & SHOES (y=27..32)
  rect(9, 27, 4, 3, pantsMain);
  px(9, 27, pantsShade);
  px(9, 28, pantsShade);
  px(9, 29, pantsShade);
  rect(8, 27, 1, 3, O);
  rect(13, 28, 1, 2, O);

  rect(15, 27, 4, 3, pantsMain);
  px(18, 27, pantsShade);
  px(18, 28, pantsShade);
  px(18, 29, pantsShade);
  rect(19, 27, 1, 3, O);
  rect(14, 28, 1, 2, O);
  px(13, 27, pantsShade);
  px(14, 27, pantsShade);

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

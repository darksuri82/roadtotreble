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
  blush: string;
}[] = [
  { id: 'light', label: '밝은 톤', base: '#fde4d2', shadow: '#e4b79c', highlight: '#fff4ec', blush: '#f6a5ab' },
  { id: 'peach', label: '내추럴', base: '#f8d0b0', shadow: '#d9a079', highlight: '#ffe5d0', blush: '#f09494' },
  { id: 'warm', label: '웜 톤', base: '#eab48a', shadow: '#c28559', highlight: '#f8cca7', blush: '#e0837e' },
  { id: 'tan', label: '탠', base: '#c98a5e', shadow: '#9c6038', highlight: '#dda379', blush: '#c76e66' },
  { id: 'deep', label: '딥 톤', base: '#8d5636', shadow: '#63371e', highlight: '#a96f4b', blush: '#9e504a' },
];

export const HAIR_COLOR_OPTIONS: {
  id: ManagerHairColorId;
  label: string;
  base: string;
  shadow: string;
  highlight: string;
}[] = [
  { id: 'brown', label: '다크 브라운', base: '#3d2b22', shadow: '#241813', highlight: '#614638' },
  { id: 'black', label: '제트 블랙', base: '#1e222d', shadow: '#11131a', highlight: '#3b4256' },
  { id: 'silver', label: '실버 그레이', base: '#cbd5e1', shadow: '#8596ab', highlight: '#f1f5f9' },
  { id: 'blonde', label: '골드 블론드', base: '#d9a441', shadow: '#a67421', highlight: '#f4d078' },
  { id: 'auburn', label: '체스트넛 레드', base: '#8b3a2b', shadow: '#5c2217', highlight: '#b85a46' },
  { id: 'crimson', label: '와인 레드', base: '#9f1239', shadow: '#680b25', highlight: '#e11d48' },
  { id: 'navy', label: '미드나잇 블루', base: '#1e3a8a', shadow: '#122359', highlight: '#3b82f6' },
  { id: 'ash_pink', label: '애쉬 핑크', base: '#d97ea8', shadow: '#9d4e74', highlight: '#f5b8d4' },
  { id: 'emerald', label: '딥 에메랄드', base: '#0f766e', shadow: '#084c47', highlight: '#2dd4bf' },
];

export interface HairStyleOption {
  id: ManagerHairStyleId;
  label: string;
  gender: ManagerGenderId;
}

export const MALE_HAIR_STYLE_OPTIONS: HairStyleOption[] = [
  { id: 'fluffy', label: '내추럴 숏컷', gender: 'male' },
  { id: 'parted', label: '가르마 펌', gender: 'male' },
  { id: 'slick', label: '올백 포마드', gender: 'male' },
  { id: 'buzz', label: '스포츠 컷', gender: 'male' },
  { id: 'curly', label: '컬리 펌', gender: 'male' },
  { id: 'mohawk', label: '모히칸 페이드', gender: 'male' },
  { id: 'long_tied', label: '장발 묶음머리', gender: 'male' },
  { id: 'cap', label: '터치라인 캡', gender: 'male' },
  { id: 'bald', label: '대머리 (민머리)', gender: 'male' },
];

export const FEMALE_HAIR_STYLE_OPTIONS: HairStyleOption[] = [
  { id: 'bob', label: 'C컬 단발', gender: 'female' },
  { id: 'ponytail', label: '하이 포니테일', gender: 'female' },
  { id: 'long_wave', label: '웨이브 롱헤어', gender: 'female' },
  { id: 'updo_bun', label: '사이드뱅 올림머리', gender: 'female' },
  { id: 'pixie', label: '숏 픽시컷', gender: 'female' },
  { id: 'twintail', label: '로우 트윈테일', gender: 'female' },
  { id: 'half_up', label: '반묶음 롱헤어', gender: 'female' },
  { id: 'braid', label: '사이드 브레이드', gender: 'female' },
];

export const HAIR_STYLE_OPTIONS: HairStyleOption[] = [
  ...MALE_HAIR_STYLE_OPTIONS,
  ...FEMALE_HAIR_STYLE_OPTIONS,
];

export interface OutfitOption {
  id: ManagerOutfitId;
  label: string;
  previewColor: string;
  gender: ManagerGenderId;
  usesTeamColor?: boolean;
}

export const MALE_OUTFIT_OPTIONS: OutfitOption[] = [
  { id: 'classic_suit', label: '클래식 블랙 수트', previewColor: '#1e2430', gender: 'male' },
  { id: 'navy_coat', label: '네이비 코트 & 터틀넥', previewColor: '#1e3a5f', gender: 'male' },
  { id: 'team_tracksuit', label: '팀 컬러 트레이닝복', previewColor: '#10b981', gender: 'male', usesTeamColor: true },
  { id: 'casual_shirt', label: '캐주얼 셔츠', previewColor: '#e2e8f0', gender: 'male' },
  { id: 'puffer_jacket', label: '터치라인 패딩', previewColor: '#334155', gender: 'male' },
  { id: 'tuxedo', label: '갈라 턱시도', previewColor: '#151922', gender: 'male' },
  { id: 'sweater_vest', label: '니트 베스트 & 셔츠', previewColor: '#5b2333', gender: 'male' },
  { id: 'leather_jacket', label: '블랙 레더 재킷', previewColor: '#1b1f28', gender: 'male' },
  { id: 'team_polo', label: '팀 컬러 폴로셔츠', previewColor: '#10b981', gender: 'male', usesTeamColor: true },
];

export const FEMALE_OUTFIT_OPTIONS: OutfitOption[] = [
  { id: 'female_blazer', label: '테일러드 블레이저', previewColor: '#232938', gender: 'female' },
  { id: 'female_trench', label: '트렌치코트 & 원피스', previewColor: '#c49a6c', gender: 'female' },
  { id: 'female_tracksuit', label: '핏한 팀 트레이닝 셋업', previewColor: '#10b981', gender: 'female', usesTeamColor: true },
  { id: 'female_knit_skirt', label: '니트 & 스커트 코디', previewColor: '#f3e8d8', gender: 'female' },
  { id: 'female_coat_scarf', label: '울 코트 & 머플러', previewColor: '#334155', gender: 'female' },
  { id: 'female_puffer', label: '터치라인 패딩', previewColor: '#475569', gender: 'female' },
  { id: 'female_cardigan', label: '가디건 & 슬랙스', previewColor: '#9f5f7a', gender: 'female' },
  { id: 'female_team_polo', label: '팀 컬러 폴로 & 스커트', previewColor: '#10b981', gender: 'female', usesTeamColor: true },
];

export const OUTFIT_OPTIONS: OutfitOption[] = [
  ...MALE_OUTFIT_OPTIONS,
  ...FEMALE_OUTFIT_OPTIONS,
];

export function getHairStyleOptionsForGender(
  gender: ManagerGenderId,
): HairStyleOption[] {
  return gender === 'female' ? FEMALE_HAIR_STYLE_OPTIONS : MALE_HAIR_STYLE_OPTIONS;
}

export function getOutfitOptionsForGender(
  gender: ManagerGenderId,
): OutfitOption[] {
  return gender === 'female' ? FEMALE_OUTFIT_OPTIONS : MALE_OUTFIT_OPTIONS;
}

const MALE_HAIR_IDS = new Set<ManagerHairStyleId>(
  MALE_HAIR_STYLE_OPTIONS.map((h) => h.id),
);
const FEMALE_HAIR_IDS = new Set<ManagerHairStyleId>(
  FEMALE_HAIR_STYLE_OPTIONS.map((h) => h.id),
);
const MALE_OUTFIT_IDS = new Set<ManagerOutfitId>(
  MALE_OUTFIT_OPTIONS.map((o) => o.id),
);
const FEMALE_OUTFIT_IDS = new Set<ManagerOutfitId>(
  FEMALE_OUTFIT_OPTIONS.map((o) => o.id),
);

function mapHairToGender(
  hairStyle: ManagerHairStyleId | undefined,
  gender: ManagerGenderId,
): ManagerHairStyleId {
  if (gender === 'female') {
    if (hairStyle && FEMALE_HAIR_IDS.has(hairStyle)) return hairStyle;
    if (hairStyle === 'parted' || hairStyle === 'curly') return 'long_wave';
    if (hairStyle === 'slick') return 'updo_bun';
    if (hairStyle === 'buzz' || hairStyle === 'mohawk') return 'pixie';
    if (hairStyle === 'long_tied') return 'braid';
    if (hairStyle === 'cap') return 'ponytail';
    return 'bob';
  }
  if (hairStyle && MALE_HAIR_IDS.has(hairStyle)) return hairStyle;
  if (hairStyle === 'long_wave' || hairStyle === 'half_up') return 'parted';
  if (hairStyle === 'updo_bun') return 'slick';
  if (hairStyle === 'ponytail' || hairStyle === 'pixie') return 'buzz';
  if (hairStyle === 'twintail') return 'curly';
  if (hairStyle === 'braid') return 'long_tied';
  return 'fluffy';
}

function mapOutfitToGender(
  outfit: ManagerOutfitId | undefined,
  gender: ManagerGenderId,
): ManagerOutfitId {
  if (gender === 'female') {
    if (outfit && FEMALE_OUTFIT_IDS.has(outfit)) return outfit;
    if (outfit === 'navy_coat') return 'female_trench';
    if (outfit === 'team_tracksuit') return 'female_tracksuit';
    if (outfit === 'team_polo') return 'female_team_polo';
    if (outfit === 'puffer_jacket') return 'female_puffer';
    if (outfit === 'sweater_vest') return 'female_cardigan';
    if (outfit === 'leather_jacket') return 'female_coat_scarf';
    if (outfit === 'casual_shirt') return 'female_knit_skirt';
    return 'female_blazer';
  }
  if (outfit && MALE_OUTFIT_IDS.has(outfit)) return outfit;
  if (outfit === 'female_trench' || outfit === 'female_coat_scarf') return 'navy_coat';
  if (outfit === 'female_tracksuit') return 'team_tracksuit';
  if (outfit === 'female_team_polo') return 'team_polo';
  if (outfit === 'female_puffer') return 'puffer_jacket';
  if (outfit === 'female_cardigan') return 'sweater_vest';
  if (outfit === 'female_knit_skirt') return 'casual_shirt';
  return 'classic_suit';
}

/**
 * Normalizes any partial or legacy ManagerAvatarConfig so gender-exclusive
 * hairstyles and outfits always match the active gender cleanly.
 */
export function normalizeAvatarForGender(
  avatar?: Partial<ManagerAvatarConfig> | null,
  forcedGender?: ManagerGenderId,
): ManagerAvatarConfig {
  const gender: ManagerGenderId =
    forcedGender ?? (avatar?.gender === 'female' ? 'female' : 'male');
  const validSkin = SKIN_TONE_OPTIONS.some((s) => s.id === avatar?.skinTone)
    ? (avatar?.skinTone as ManagerSkinToneId)
    : DEFAULT_MANAGER_AVATAR.skinTone;
  const validHairColor = HAIR_COLOR_OPTIONS.some(
    (h) => h.id === avatar?.hairColor,
  )
    ? (avatar?.hairColor as ManagerHairColorId)
    : DEFAULT_MANAGER_AVATAR.hairColor;

  return {
    gender,
    skinTone: validSkin,
    hairStyle: mapHairToGender(avatar?.hairStyle, gender),
    hairColor: validHairColor,
    outfit: mapOutfitToGender(avatar?.outfit, gender),
  };
}

export type ManagerExpressionId =
  | 'default'
  | 'cheer_grin'
  | 'smug_wink'
  | 'cool_shades'
  | 'crying_wail'
  | 'dizzy_shock'
  | 'fierce_glare';

export type ManagerPoseId =
  | 'default'
  | 'arms_up_cheer'
  | 'fist_pump'
  | 'arms_crossed_smug'
  | 'hands_on_head_despair';

export function resolveManagerPalette(
  avatar?: Partial<ManagerAvatarConfig> | null,
  clubPrimaryColor = '#10b981',
  clubSecondaryColor = '#f8fafc',
) {
  const cfg = normalizeAvatarForGender(avatar);
  const isFemale = cfg.gender === 'female';
  const skin =
    SKIN_TONE_OPTIONS.find((s) => s.id === cfg.skinTone) ?? SKIN_TONE_OPTIONS[1];
  const hair =
    HAIR_COLOR_OPTIONS.find((h) => h.id === cfg.hairColor) ??
    HAIR_COLOR_OPTIONS[0];

  let topMain = isFemale ? '#232938' : '#1e2430';
  let topShade = isFemale ? '#141824' : '#12161f';
  let topHighlight = isFemale ? '#3b455e' : '#364156';
  let bottomMain = isFemale ? '#1e2432' : '#1e2530';
  let shoeMain = '#1b1d24';

  if (cfg.outfit === 'female_trench') {
    topMain = '#c89e70';
    topShade = '#9b7247';
    topHighlight = '#e0bd94';
    bottomMain = '#c89e70';
    shoeMain = '#3b241c';
  } else if (
    cfg.outfit === 'female_tracksuit' ||
    cfg.outfit === 'team_tracksuit'
  ) {
    topMain = clubPrimaryColor;
    topShade = '#151c26';
    topHighlight = clubSecondaryColor;
    bottomMain = '#19202c';
    shoeMain = '#f1f5f9';
  } else if (cfg.outfit === 'female_team_polo' || cfg.outfit === 'team_polo') {
    topMain = clubPrimaryColor;
    topShade = '#141b26';
    topHighlight = clubSecondaryColor;
    bottomMain = '#1e293b';
    shoeMain = '#f1f5f9';
  } else if (cfg.outfit === 'female_knit_skirt') {
    topMain = '#f3e8d8';
    topShade = '#d6c3a8';
    topHighlight = '#ffffff';
    bottomMain = '#1e3454';
    shoeMain = '#261b18';
  } else if (cfg.outfit === 'female_coat_scarf') {
    topMain = '#334155';
    topShade = '#1e293b';
    topHighlight = '#475569';
    bottomMain = '#1e2430';
    shoeMain = '#261b18';
  } else if (cfg.outfit === 'female_puffer') {
    topMain = '#3b475c';
    topShade = '#222b3a';
    topHighlight = '#64748b';
    bottomMain = '#181e29';
    shoeMain = '#f1f5f9';
  } else if (cfg.outfit === 'female_cardigan') {
    topMain = '#9f5f7a';
    topShade = '#743e56';
    topHighlight = '#c78aa4';
    bottomMain = '#252c3b';
    shoeMain = '#261b18';
  } else if (cfg.outfit === 'navy_coat') {
    topMain = '#1f365c';
    topShade = '#142440';
    topHighlight = '#345891';
    bottomMain = '#202630';
  } else if (cfg.outfit === 'casual_shirt') {
    topMain = '#e2e8f0';
    topShade = '#cbd5e1';
    topHighlight = '#ffffff';
    bottomMain = '#2b3445';
  } else if (cfg.outfit === 'puffer_jacket') {
    topMain = '#2d3748';
    topShade = '#1a202c';
    topHighlight = '#4a5568';
    bottomMain = '#1a202c';
  } else if (cfg.outfit === 'tuxedo') {
    topMain = '#151922';
    topShade = '#0b0e14';
    topHighlight = '#334155';
    bottomMain = '#151922';
  } else if (cfg.outfit === 'sweater_vest') {
    topMain = '#5b2333';
    topShade = '#3b1520';
    topHighlight = '#82354a';
    bottomMain = '#27303f';
  } else if (cfg.outfit === 'leather_jacket') {
    topMain = '#1b1f28';
    topShade = '#0f1218';
    topHighlight = '#475569';
    bottomMain = '#1e2430';
  }

  return {
    cfg,
    isFemale,
    skin,
    hair,
    topMain,
    topShade,
    topHighlight,
    bottomMain,
    shoeMain,
  };
}

interface PixelManagerAvatarProps {
  avatar?: Partial<ManagerAvatarConfig> | null;
  clubPrimaryColor?: string;
  clubSecondaryColor?: string;
  size?: number;
  className?: string;
  expression?: ManagerExpressionId;
  pose?: ManagerPoseId;
}

export interface PixelManagerAvatarRects {
  width: number;
  height: number;
  rects: { x: number; y: number; w: number; fill: string }[];
}

/**
 * Pure pixel-grid builder for the 28x34 chibi pixel manager so both
 * PixelManagerAvatar and RoadToTrebleHeroSvg share one pixel-accurate source.
 */
export function getManagerAvatarRects({
  avatar,
  clubPrimaryColor = '#10b981',
  clubSecondaryColor = '#f8fafc',
  expression = 'default',
  pose = 'default',
}: Pick<
  PixelManagerAvatarProps,
  'avatar' | 'clubPrimaryColor' | 'clubSecondaryColor' | 'expression' | 'pose'
>): PixelManagerAvatarRects {
  const cfg = normalizeAvatarForGender(avatar);
  const isFemale = cfg.gender === 'female';
  const skin =
    SKIN_TONE_OPTIONS.find((s) => s.id === cfg.skinTone) ?? SKIN_TONE_OPTIONS[1];
  const hair =
    HAIR_COLOR_OPTIONS.find((h) => h.id === cfg.hairColor) ?? HAIR_COLOR_OPTIONS[0];

  const O = '#141016'; // Crisp 1px dark outline

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

  // =========================================================================
  // 0) BACK HAIR LAYER (behind head/shoulders for long/bob/ponytail/bun/twintail/half_up/braid/long_tied)
  // =========================================================================
  if (cfg.hairStyle === 'long_wave' || cfg.hairStyle === 'half_up') {
    // Flowing layered waves cascading behind shoulders
    rect(4, 10, 20, 14, hair.shadow);
    rect(5, 10, 18, 13, hair.base);
    // Soft wavy outer silhouette with dark outline
    rect(3, 12, 1, 10, O);
    rect(24, 12, 1, 10, O);
    px(4, 22, O);
    px(23, 22, O);
    px(5, 23, O);
    px(22, 23, O);
    rect(6, 24, 3, 1, O);
    rect(19, 24, 3, 1, O);
    // Wavy shine accents on draped locks
    px(5, 16, hair.highlight);
    px(6, 19, hair.highlight);
    px(5, 21, hair.shadow);
    px(22, 16, hair.highlight);
    px(21, 19, hair.highlight);
    px(22, 21, hair.shadow);
    if (cfg.hairStyle === 'half_up') {
      // Delicate half-up satin ribbon peeking behind crown
      rect(11, 2, 6, 2, '#f43f5e');
      px(13, 2, '#fda4af');
      px(14, 2, '#fda4af');
      rect(11, 1, 6, 1, O);
    }
  } else if (cfg.hairStyle === 'bob') {
    // Rounded C-curl bob silhouette curving gently inward at jaw
    rect(5, 10, 18, 9, hair.shadow);
    rect(6, 10, 16, 8, hair.base);
    rect(4, 11, 1, 7, O);
    rect(23, 11, 1, 7, O);
    px(5, 18, O);
    px(22, 18, O);
    rect(6, 19, 3, 1, O);
    rect(19, 19, 3, 1, O);
  } else if (cfg.hairStyle === 'ponytail') {
    // High voluminous ponytail draping gracefully on right side
    rect(20, 6, 4, 12, hair.base);
    rect(21, 9, 3, 9, hair.shadow);
    rect(21, 7, 2, 2, hair.highlight);
    px(22, 12, hair.highlight);
    // Satin hair ribbon / tie
    px(20, 6, '#f43f5e');
    px(21, 6, '#fb7185');
    // Ponytail outline
    rect(21, 5, 3, 1, O);
    px(24, 6, O);
    rect(24, 7, 1, 10, O);
    px(23, 17, O);
    rect(21, 18, 2, 1, O);
  } else if (cfg.hairStyle === 'updo_bun') {
    // Elegant high chignon bun perched atop crown
    rect(11, 1, 6, 3, hair.base);
    rect(12, 1, 4, 1, hair.highlight);
    rect(11, 3, 6, 1, hair.shadow);
    // Gold hairpin accent
    px(16, 2, '#fbbf24');
    px(17, 1, '#fde68a');
    // Bun outline
    rect(11, 0, 6, 1, O);
    px(10, 1, O);
    px(17, 1, O);
    px(10, 2, O);
    px(17, 2, O);
  } else if (cfg.hairStyle === 'twintail') {
    // Low playful twin tails on both left and right sides
    rect(3, 13, 4, 10, hair.base);
    rect(3, 16, 2, 7, hair.shadow);
    px(5, 15, hair.highlight);
    px(4, 19, hair.highlight);
    px(5, 13, '#f43f5e'); // left hair tie
    px(6, 13, '#fb7185');
    rect(2, 14, 1, 8, O);
    px(3, 13, O);
    px(3, 22, O);
    rect(4, 23, 2, 1, O);

    rect(21, 13, 4, 10, hair.base);
    rect(23, 16, 2, 7, hair.shadow);
    px(22, 15, hair.highlight);
    px(23, 19, hair.highlight);
    px(22, 13, '#f43f5e'); // right hair tie
    px(21, 13, '#fb7185');
    rect(25, 14, 1, 8, O);
    px(24, 13, O);
    px(24, 22, O);
    rect(22, 23, 2, 1, O);
  } else if (cfg.hairStyle === 'braid') {
    // Soft back crown + sculpted side braid draping over right shoulder
    rect(5, 10, 18, 9, hair.shadow);
    rect(6, 10, 16, 8, hair.base);
    rect(4, 11, 1, 7, O);
    rect(23, 11, 1, 7, O);
    // Braided plait segments descending on right side
    rect(20, 16, 4, 9, hair.base);
    px(21, 17, hair.highlight);
    px(22, 18, hair.shadow);
    px(21, 19, hair.highlight);
    px(22, 20, hair.shadow);
    px(21, 21, hair.highlight);
    px(22, 22, hair.shadow);
    // Ribbon tie near braid tip
    rect(20, 23, 4, 1, '#fbbf24');
    rect(21, 24, 2, 1, hair.shadow);
    rect(24, 16, 1, 8, O);
    px(23, 24, O);
    rect(21, 25, 2, 1, O);
    px(20, 24, O);
  } else if (cfg.hairStyle === 'long_tied') {
    // Male low tied samurai/footballer ponytail behind neck
    rect(19, 13, 4, 7, hair.shadow);
    rect(20, 13, 3, 6, hair.base);
    px(21, 14, hair.highlight);
    px(20, 14, '#cbd5e1'); // elastic tie
    rect(23, 14, 1, 5, O);
    px(22, 19, O);
    rect(20, 20, 2, 1, O);
  }

  // =========================================================================
  // 1) HEAD & CLEAN FACE CONTOUR (ZERO BEARD NOISE!)
  // =========================================================================
  if (isFemale) {
    // Sleek, refined feminine chibi face (soft slender jawline, zero dark chin bar!)
    rect(8, 6, 12, 10, skin.base);
    rect(7, 8, 14, 7, skin.base);
    rect(9, 16, 10, 1, skin.base);
    rect(10, 17, 8, 1, skin.base);
    // Bright clean forehead & nose-bridge highlight
    rect(10, 9, 8, 1, skin.highlight);
    px(13, 14, skin.highlight);
    // Gentle outer-cheek blush (soft rose, clean & natural)
    px(8, 15, skin.blush);
    px(9, 15, skin.blush);
    px(18, 15, skin.blush);
    px(19, 15, skin.blush);
    // Delicate V-chin dark outline (slimmer than male)
    rect(10, 18, 8, 1, O);
    px(9, 17, O);
    px(18, 17, O);
    px(8, 16, O);
    px(19, 16, O);
    px(7, 15, O);
    px(20, 15, O);
  } else {
    // Crisp, handsome male chibi face (clean jawline without muddy stubble bar)
    rect(8, 6, 12, 11, skin.base);
    rect(7, 8, 14, 8, skin.base);
    rect(9, 17, 10, 1, skin.base);
    // Forehead & cheek light plane
    rect(10, 9, 8, 1, skin.highlight);
    px(13, 14, skin.highlight);
    // Very subtle 1px jaw edge shadow at outer corners only (never across mouth!)
    px(9, 17, skin.shadow);
    px(18, 17, skin.shadow);
    // Structured male jaw outline
    rect(9, 18, 10, 1, O);
    px(8, 17, O);
    px(19, 17, O);
    px(7, 16, O);
    px(20, 16, O);
  }

  // Ears (tucked under bob/long_wave/half_up/braid)
  if (
    cfg.hairStyle !== 'long_wave' &&
    cfg.hairStyle !== 'bob' &&
    cfg.hairStyle !== 'half_up' &&
    cfg.hairStyle !== 'braid'
  ) {
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

    // Dainty pearl/gold stud earrings for female managers when ears are visible
    if (isFemale) {
      px(5, 15, '#fde68a');
      px(22, 15, '#fde68a');
    }
  }

  // =========================================================================
  // 2) EYES, BROWS & EXPRESSIVE MOUTH
  // =========================================================================
  if (isFemale) {
    // Softly arched slender brows
    rect(9, 11, 3, 1, '#36262c');
    rect(16, 11, 3, 1, '#36262c');
    // Refined bright eyes with subtle upper-outer eyelash wing
    px(8, 12, O); // left lash flick
    rect(9, 12, 3, 1, O); // crisp upper lash line
    px(9, 13, '#ffffff');
    px(9, 14, '#e2e8f0');
    rect(10, 12, 2, 3, '#1a1726');
    px(10, 12, '#ffffff'); // main eye catchlight
    px(11, 14, '#4c4668'); // subtle lower iris gleam

    px(19, 12, O); // right lash flick
    rect(16, 12, 3, 1, O); // crisp upper lash line
    px(18, 13, '#ffffff');
    px(18, 14, '#e2e8f0');
    rect(16, 12, 2, 3, '#1a1726');
    px(17, 12, '#ffffff'); // main eye catchlight
    px(16, 14, '#4c4668'); // subtle lower iris gleam

    // Clean warm rose smile (no surrounding dark pixels!)
    rect(13, 16, 2, 1, '#d87a80');
  } else {
    // Defined handsome male brows & sharp confident eyes
    rect(9, 11, 3, 1, O);
    rect(16, 11, 3, 1, O);
    px(12, 11, '#2d2733');
    px(15, 11, '#2d2733');
    // Left eye with crisp specular dot & deep iris
    px(9, 12, '#ffffff');
    px(9, 13, '#ffffff');
    px(9, 14, '#dbe4ee');
    rect(10, 12, 2, 3, '#161822');
    px(10, 12, '#e2e8f0'); // crisp light reflection
    px(11, 14, '#334155');
    // Right eye
    px(18, 12, '#ffffff');
    px(18, 13, '#ffffff');
    px(18, 14, '#dbe4ee');
    rect(16, 12, 2, 3, '#161822');
    px(17, 12, '#e2e8f0');
    px(16, 14, '#334155');
    // Clean subtle confident mouth
    rect(13, 16, 2, 1, '#a97464');
  }

  // =========================================================================
  // 3) FRONT HAIR / BALD CRANIUM / TOUCHLINE CAP (9 Male-only + 8 Female-only)
  // =========================================================================
  if (cfg.hairStyle === 'bald') {
    // Smooth rounded cranium with iconic touchline tactician gleam
    rect(9, 4, 10, 4, skin.base);
    rect(7, 6, 14, 5, skin.base);
    rect(6, 8, 16, 4, skin.base);
    rect(7, 9, 1, 3, skin.shadow);
    rect(20, 9, 1, 3, skin.shadow);
    rect(10, 5, 3, 2, skin.highlight);
    px(10, 5, '#ffffff');
    px(11, 5, '#ffffff');
    px(14, 5, skin.highlight);
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
    // Male: clean layered natural short cut
    rect(7, 3, 14, 7, hair.base);
    rect(5, 5, 18, 6, hair.base);
    rect(4, 7, 20, 4, hair.base);
    rect(9, 4, 3, 2, hair.highlight);
    rect(15, 4, 3, 2, hair.highlight);
    rect(12, 6, 4, 1, hair.highlight);
    rect(6, 9, 16, 1, hair.shadow);
    rect(7, 10, 3, 1, hair.base);
    rect(11, 10, 3, 1, hair.base);
    rect(15, 10, 3, 1, hair.base);
    rect(19, 10, 2, 1, hair.base);
    px(8, 11, hair.shadow);
    px(13, 11, hair.shadow);
    px(17, 11, hair.shadow);
    rect(5, 10, 2, 3, hair.shadow);
    rect(21, 10, 2, 3, hair.shadow);
    rect(9, 2, 10, 1, O);
    px(7, 3, O);
    px(8, 3, O);
    px(19, 3, O);
    px(20, 3, O);
    px(5, 4, O);
    px(6, 4, O);
    px(21, 4, O);
    px(22, 4, O);
    px(4, 5, O);
    px(23, 5, O);
    rect(3, 6, 1, 4, O);
    rect(24, 6, 1, 4, O);
    px(4, 10, O);
    px(23, 10, O);
    px(5, 11, O);
    px(22, 11, O);
  } else if (cfg.hairStyle === 'parted') {
    // Male: stylish 6:4 comma/parted perm with soft volume
    rect(7, 3, 14, 7, hair.base);
    rect(6, 5, 16, 6, hair.base);
    rect(8, 4, 6, 2, hair.highlight);
    rect(16, 4, 4, 2, hair.highlight);
    rect(15, 8, 2, 3, skin.base); // crisp 6:4 parting gap
    rect(7, 9, 8, 2, hair.base);
    rect(17, 9, 4, 2, hair.base);
    rect(7, 10, 3, 1, hair.shadow);
    rect(18, 10, 3, 1, hair.shadow);
    rect(6, 10, 1, 3, hair.shadow);
    rect(21, 10, 1, 3, hair.shadow);
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
    // Male: sleek swept-back pomade
    rect(8, 2, 12, 7, hair.base);
    rect(6, 4, 16, 6, hair.base);
    rect(9, 3, 10, 2, hair.highlight);
    rect(10, 5, 8, 1, hair.highlight);
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
    // Male: crisp athletic buzz / sports cut
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
  } else if (cfg.hairStyle === 'curly') {
    // Male: voluminous textured curly perm
    rect(6, 2, 16, 8, hair.base);
    rect(4, 4, 20, 7, hair.base);
    // Textured curly puffs & specular curls
    px(8, 3, hair.highlight);
    px(12, 3, hair.highlight);
    px(16, 3, hair.highlight);
    px(19, 4, hair.highlight);
    px(6, 5, hair.highlight);
    px(10, 5, hair.shadow);
    px(14, 5, hair.highlight);
    px(18, 6, hair.shadow);
    px(8, 7, hair.shadow);
    px(12, 7, hair.highlight);
    px(16, 7, hair.shadow);
    // Scalloped curly fringe
    rect(7, 9, 3, 2, hair.base);
    rect(11, 9, 4, 2, hair.base);
    rect(16, 9, 3, 2, hair.base);
    px(10, 10, hair.shadow);
    px(15, 10, hair.shadow);
    rect(5, 10, 2, 2, hair.shadow);
    rect(21, 10, 2, 2, hair.shadow);
    // Puffy curly crown outline
    rect(7, 1, 5, 1, O);
    rect(13, 1, 5, 1, O);
    px(12, 2, O);
    px(6, 2, O);
    px(18, 2, O);
    px(19, 2, O);
    px(5, 3, O);
    px(21, 3, O);
    px(4, 4, O);
    px(22, 4, O);
    rect(3, 5, 1, 5, O);
    rect(24, 5, 1, 5, O);
    px(4, 10, O);
    px(23, 10, O);
  } else if (cfg.hairStyle === 'mohawk') {
    // Male: shaved fade sides + sculpted central mohawk crest
    rect(7, 5, 14, 5, skin.base);
    rect(6, 7, 16, 4, skin.base);
    // Faded temple shadow
    rect(6, 7, 2, 4, hair.shadow);
    rect(20, 7, 2, 4, hair.shadow);
    // Tall central mohawk crest
    rect(11, 1, 6, 8, hair.base);
    rect(12, 0, 4, 2, hair.base);
    rect(12, 2, 4, 2, hair.highlight);
    rect(13, 5, 2, 2, hair.highlight);
    rect(11, 8, 6, 1, hair.shadow);
    // Outline
    rect(12, 0, 4, 1, O);
    px(11, 1, O);
    px(16, 1, O);
    rect(10, 2, 1, 4, O);
    rect(17, 2, 1, 4, O);
    rect(7, 4, 3, 1, O);
    rect(18, 4, 3, 1, O);
    px(6, 5, O);
    px(21, 5, O);
    rect(5, 6, 1, 5, O);
    rect(22, 6, 1, 5, O);
  } else if (cfg.hairStyle === 'long_tied') {
    // Male: sleek swept-back long hair with subtle stray temple lock
    rect(7, 3, 14, 7, hair.base);
    rect(6, 5, 16, 6, hair.base);
    rect(9, 4, 10, 2, hair.highlight);
    rect(8, 8, 12, 2, hair.shadow);
    rect(9, 9, 10, 2, skin.base);
    // Stylish loose side strand
    rect(6, 10, 2, 4, hair.base);
    rect(20, 10, 2, 4, hair.base);
    px(7, 13, hair.shadow);
    px(20, 13, hair.shadow);
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(5, 5, 1, 6, O);
    rect(22, 5, 1, 6, O);
  } else if (cfg.hairStyle === 'cap') {
    // Male: iconic touchline manager cap in clubPrimaryColor + side hair tufts
    rect(7, 3, 14, 5, clubPrimaryColor);
    rect(6, 5, 16, 3, clubPrimaryColor);
    // Cap front panel emblem in clubSecondaryColor
    rect(12, 4, 4, 2, clubSecondaryColor);
    px(13, 3, clubSecondaryColor);
    px(14, 3, clubSecondaryColor);
    // Curved cap visor brim (slightly angled right)
    rect(6, 8, 18, 2, '#141a24');
    rect(8, 8, 14, 1, clubSecondaryColor);
    // Side hair peeking neatly beneath cap
    rect(6, 10, 2, 2, hair.base);
    rect(20, 10, 2, 2, hair.base);
    px(6, 11, hair.shadow);
    px(21, 11, hair.shadow);
    // Crisp cap outline
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(5, 5, 1, 5, O);
    rect(22, 5, 1, 3, O);
    rect(24, 8, 1, 2, O);
    rect(6, 10, 18, 1, O);
  } else if (cfg.hairStyle === 'bob') {
    // Female: soft C-curl bob with airy see-through bangs & inward-curled cheek tips
    rect(7, 3, 14, 7, hair.base);
    rect(5, 5, 18, 6, hair.base);
    rect(9, 4, 10, 2, hair.highlight);
    rect(7, 9, 14, 2, hair.base);
    // Airy see-through bangs showing a peek of forehead
    px(11, 10, skin.base);
    rect(13, 10, 2, 1, skin.base);
    px(16, 10, skin.base);
    // Side framing locks curving gently inward (C-curl)
    rect(5, 10, 2, 7, hair.base);
    rect(21, 10, 2, 7, hair.base);
    rect(6, 17, 2, 2, hair.base);
    rect(20, 17, 2, 2, hair.base);
    px(6, 18, hair.shadow);
    px(21, 18, hair.shadow);
    px(5, 13, hair.highlight);
    px(22, 13, hair.highlight);
    // Crown outline
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(4, 5, 1, 7, O);
    rect(23, 5, 1, 7, O);
  } else if (cfg.hairStyle === 'ponytail') {
    // Female: sleek pulled-back crown + soft side-swept wispy fringe
    rect(7, 3, 14, 7, hair.base);
    rect(6, 5, 16, 6, hair.base);
    rect(9, 4, 9, 2, hair.highlight);
    rect(7, 9, 6, 2, hair.base);
    rect(16, 9, 5, 2, hair.base);
    rect(13, 9, 3, 2, skin.base);
    px(6, 11, hair.base); // wispy temple strand
    px(21, 11, hair.base);
    px(11, 11, hair.shadow);
    px(17, 11, hair.shadow);
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(5, 5, 1, 6, O);
    rect(22, 5, 1, 6, O);
  } else if (cfg.hairStyle === 'updo_bun') {
    // Female: chic high updo with face-framing side-swept bangs
    rect(7, 3, 14, 7, hair.base);
    rect(6, 5, 16, 6, hair.base);
    rect(9, 4, 10, 2, hair.highlight);
    // Diagonal side-bang sweeping right-to-left
    rect(7, 9, 9, 2, hair.base);
    rect(18, 9, 3, 2, hair.base);
    rect(16, 9, 2, 2, skin.base);
    // Soft framing temple wisps
    rect(6, 11, 1, 4, hair.base);
    rect(21, 11, 1, 4, hair.base);
    px(6, 14, hair.shadow);
    px(21, 14, hair.shadow);
    rect(8, 2, 3, 1, O);
    rect(17, 2, 3, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(5, 5, 1, 6, O);
    rect(22, 5, 1, 6, O);
  } else if (cfg.hairStyle === 'pixie') {
    // Female: chic feathered short pixie cut with diagonal side bangs
    rect(7, 3, 14, 7, hair.base);
    rect(6, 5, 16, 6, hair.base);
    rect(9, 4, 8, 2, hair.highlight);
    // Feathered diagonal fringe
    rect(7, 9, 10, 2, hair.base);
    rect(18, 9, 3, 1, hair.base);
    rect(17, 10, 3, 1, skin.base);
    px(10, 11, hair.shadow);
    px(14, 11, hair.shadow);
    // Sleek tapered sideburns above earrings
    rect(6, 10, 1, 2, hair.shadow);
    rect(21, 10, 1, 2, hair.shadow);
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(5, 5, 1, 6, O);
    rect(22, 5, 1, 6, O);
  } else if (cfg.hairStyle === 'twintail') {
    // Female: cute full bangs + soft temple locks framing twin tails
    rect(7, 3, 14, 7, hair.base);
    rect(6, 5, 16, 6, hair.base);
    rect(9, 4, 10, 2, hair.highlight);
    rect(7, 9, 14, 2, hair.base);
    px(10, 10, skin.base);
    px(14, 10, skin.base);
    px(17, 10, skin.base);
    rect(6, 10, 1, 4, hair.base);
    rect(21, 10, 1, 4, hair.base);
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(5, 5, 1, 6, O);
    rect(22, 5, 1, 6, O);
  } else if (cfg.hairStyle === 'braid') {
    // Female: smooth crown + side-parted bangs leading into right shoulder braid
    rect(7, 3, 14, 7, hair.base);
    rect(5, 5, 18, 6, hair.base);
    rect(9, 4, 10, 2, hair.highlight);
    rect(7, 9, 8, 2, hair.base);
    rect(17, 9, 4, 2, hair.base);
    rect(15, 9, 2, 2, skin.base);
    rect(5, 10, 2, 7, hair.base);
    rect(21, 10, 2, 8, hair.base);
    px(22, 13, hair.highlight);
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(4, 5, 1, 7, O);
    rect(23, 5, 1, 7, O);
  } else {
    // Female: long_wave & half_up front crown + glossy bangs + face-framing side waves
    rect(7, 3, 14, 7, hair.base);
    rect(5, 5, 18, 6, hair.base);
    rect(9, 4, 10, 2, hair.highlight);
    rect(7, 9, 6, 2, hair.base);
    rect(15, 9, 6, 2, hair.base);
    rect(13, 9, 2, 2, skin.base); // soft center part
    rect(5, 10, 2, 11, hair.base);
    rect(21, 10, 2, 11, hair.base);
    px(6, 13, hair.highlight);
    px(21, 13, hair.highlight);
    rect(8, 2, 12, 1, O);
    px(7, 3, O);
    px(20, 3, O);
    px(6, 4, O);
    px(21, 4, O);
    rect(4, 5, 1, 9, O);
    rect(23, 5, 1, 9, O);
  }

  // =========================================================================
  // 4) GENDER-DISTINCT BODY SILHOUETTE & OUTFITS (y=18..32)
  // =========================================================================
  if (isFemale) {
    // -----------------------------------------------------------------------
    // FEMALE SILHOUETTE:
    // - Slender neck (x=13..14)
    // - Narrower sloped shoulders (x=9..18)
    // - Natural subtle bust contour (y=20..21 highlight + gentle under-bust shade)
    // - Clearly cinched hourglass waist (x=10..17 at y=22..23 with 1px outline at x=9 & x=18!)
    // - Soft feminine hip/pelvis flare (x=8..19 at y=24..26 with outline at x=7 & x=20!)
    // - Slim legs + sleek shoes/boots (y=27..32)
    // -----------------------------------------------------------------------
    rect(13, 18, 2, 2, skin.base);
    px(12, 18, skin.shadow);
    px(15, 18, skin.shadow);

    let topMain = '#232938';
    let topShade = '#141824';
    let topHighlight = '#3b455e';
    let innerMain = '#f8fafc';
    let accent = '#f43f5e';
    let bottomMain = '#1e2432';
    let bottomShade = '#111620';
    let bottomHighlight = '#333d54';
    let isSkirtOrDress = true;
    let shoeMain = '#1c1820';
    let shoeHi = '#483e52';

    if (cfg.outfit === 'female_trench') {
      topMain = '#c89e70';
      topShade = '#9b7247';
      topHighlight = '#e0bd94';
      innerMain = '#27232c'; // chic dark dress underneath
      accent = '#78522d'; // waist belt & buckle
      bottomMain = '#c89e70';
      bottomShade = '#9b7247';
      bottomHighlight = '#e0bd94';
      isSkirtOrDress = true;
      shoeMain = '#3b241c';
      shoeHi = '#6b4334';
    } else if (cfg.outfit === 'female_tracksuit') {
      topMain = clubPrimaryColor;
      topShade = '#151c26';
      topHighlight = clubSecondaryColor;
      innerMain = clubSecondaryColor;
      accent = clubSecondaryColor;
      bottomMain = '#19202c';
      bottomShade = '#0f141d';
      bottomHighlight = clubPrimaryColor;
      isSkirtOrDress = false; // fitted slim joggers!
      shoeMain = '#f1f5f9';
      shoeHi = clubPrimaryColor;
    } else if (cfg.outfit === 'female_knit_skirt') {
      topMain = '#f3e8d8';
      topShade = '#d6c3a8';
      topHighlight = '#ffffff';
      innerMain = '#ffffff';
      accent = '#b91c1c'; // dainty collar/belt accent
      bottomMain = '#1e3454'; // high-waist navy pleated skirt
      bottomShade = '#122138';
      bottomHighlight = '#315282';
      isSkirtOrDress = true;
      shoeMain = '#261b18';
      shoeHi = '#523c36';
    } else if (cfg.outfit === 'female_coat_scarf') {
      topMain = '#334155';
      topShade = '#1e293b';
      topHighlight = '#64748b';
      innerMain = '#be123c'; // warm burgundy wool scarf
      accent = '#fb7185'; // scarf highlight weave
      bottomMain = '#1e2430';
      bottomShade = '#11161f';
      bottomHighlight = '#3b455c';
      isSkirtOrDress = true;
      shoeMain = '#261b18';
      shoeHi = '#4f3a34';
    } else if (cfg.outfit === 'female_puffer') {
      topMain = '#3b475c';
      topShade = '#222b3a';
      topHighlight = '#64748b';
      innerMain = '#f8fafc';
      accent = '#f59e0b';
      bottomMain = '#181e29';
      bottomShade = '#0e131b';
      bottomHighlight = '#334155';
      isSkirtOrDress = false; // fitted winter pants
      shoeMain = '#f1f5f9';
      shoeHi = '#94a3b8';
    } else if (cfg.outfit === 'female_cardigan') {
      topMain = '#9f5f7a';
      topShade = '#743e56';
      topHighlight = '#c78aa4';
      innerMain = '#f8fafc';
      accent = '#fde68a'; // pearl cardigan buttons
      bottomMain = '#252c3b';
      bottomShade = '#161b26';
      bottomHighlight = '#3d475e';
      isSkirtOrDress = false; // tailored slacks
      shoeMain = '#261b18';
      shoeHi = '#523c36';
    } else if (cfg.outfit === 'female_team_polo') {
      topMain = clubPrimaryColor;
      topShade = '#151c26';
      topHighlight = clubSecondaryColor;
      innerMain = clubSecondaryColor;
      accent = clubSecondaryColor;
      bottomMain = '#1e293b'; // pleated athletic navy skirt
      bottomShade = '#0f172a';
      bottomHighlight = '#334155';
      isSkirtOrDress = true;
      shoeMain = '#f1f5f9';
      shoeHi = clubPrimaryColor;
    }

    // Upper chest / shoulders (y=19..21, width 10px: x=9..18)
    rect(9, 19, 10, 3, topMain);
    // Natural bust shading (soft upper chest highlight + gentle curve shadow)
    rect(10, 20, 2, 1, topHighlight);
    rect(16, 20, 2, 1, topHighlight);
    px(10, 21, topShade);
    px(11, 21, topShade);
    px(16, 21, topShade);
    px(17, 21, topShade);

    // Cinched waist (y=22..23, narrows inward to x=10..17!)
    rect(10, 22, 8, 2, topMain);
    px(10, 22, topShade);
    px(17, 22, topShade);
    px(10, 23, topShade);
    px(17, 23, topShade);

    // Outfit-specific upper torso & waist tailoring details
    if (cfg.outfit === 'female_blazer') {
      // V-neck silk ivory blouse + tailored lapels + waist button
      rect(12, 19, 4, 2, innerMain);
      rect(13, 21, 2, 2, innerMain);
      px(11, 20, topHighlight);
      px(16, 20, topHighlight);
      px(12, 21, topHighlight);
      px(15, 21, topHighlight);
      px(13, 23, '#fbbf24'); // gold waist button
      px(14, 23, topShade);
    } else if (cfg.outfit === 'female_trench') {
      // Open V-collar showing dark dress + double-breasted lapels + cinched belt at y=23
      rect(12, 19, 4, 3, innerMain);
      px(11, 20, topHighlight);
      px(16, 20, topHighlight);
      rect(10, 23, 8, 1, accent); // cinched waist belt!
      rect(13, 23, 2, 1, '#fbbf24'); // gold buckle
    } else if (cfg.outfit === 'female_tracksuit') {
      // Fitted team zip-up jacket with sleeve stripe + center white zip + cropped waist hem
      rect(9, 19, 2, 1, topHighlight);
      rect(17, 19, 2, 1, topHighlight);
      rect(13, 19, 2, 5, innerMain);
      px(11, 21, accent);
      rect(10, 23, 8, 1, topShade); // fitted elastic waistband
      rect(13, 23, 2, 1, innerMain);
    } else if (cfg.outfit === 'female_coat_scarf') {
      // Cozy wrapped wool scarf at collar + draping scarf tail + double-breasted buttons
      rect(11, 19, 6, 2, innerMain);
      px(12, 19, accent);
      px(15, 20, accent);
      rect(12, 21, 2, 2, innerMain);
      px(11, 22, '#cbd5e1');
      px(16, 22, '#cbd5e1');
      px(11, 23, '#cbd5e1');
      px(16, 23, '#cbd5e1');
    } else if (cfg.outfit === 'female_puffer') {
      // Horizontal quilted touchline puffer seams + bright front zip
      rect(10, 21, 8, 1, topShade);
      rect(10, 23, 8, 1, topShade);
      rect(13, 19, 2, 5, innerMain);
      px(13, 20, accent);
    } else if (cfg.outfit === 'female_cardigan') {
      // Open soft cardigan over crisp white tee + pearl buttons
      rect(12, 19, 4, 4, innerMain);
      px(11, 20, accent);
      px(11, 22, accent);
      px(16, 20, accent);
      px(16, 22, accent);
      rect(10, 23, 8, 1, bottomShade);
      rect(13, 23, 2, 1, '#fbbf24');
    } else if (cfg.outfit === 'female_team_polo') {
      // Sporty team polo collar + 2-button placket + club chest badge
      rect(11, 19, 6, 1, innerMain);
      rect(13, 20, 2, 2, innerMain);
      px(16, 21, accent); // club crest dot
      rect(10, 23, 8, 1, bottomShade);
    } else {
      // female_knit_skirt: cozy cream knit sweater + ribbon bow + tucked high waist
      rect(12, 19, 4, 1, innerMain);
      px(13, 20, accent);
      px(14, 20, accent);
      px(11, 22, topShade);
      px(13, 22, topShade);
      px(15, 22, topShade);
      rect(10, 23, 8, 1, bottomShade); // high-waist skirt waistband!
      px(13, 23, '#fbbf24');
    }

    // Flared feminine hips / pelvis (y=24..26, flares smoothly outward x=9..18 -> x=8..19!)
    if (isSkirtOrDress) {
      // Tailored A-line skirt / trench dress flare
      rect(9, 24, 10, 1, bottomMain);
      rect(8, 25, 12, 2, bottomMain);
      // Soft vertical pleat / fold highlights
      px(11, 25, bottomHighlight);
      px(16, 25, bottomHighlight);
      px(13, 25, bottomShade);
      px(14, 26, bottomShade);
      px(9, 24, bottomShade);
      px(18, 24, bottomShade);
      px(8, 26, bottomShade);
      px(19, 26, bottomShade);
      if (cfg.outfit === 'female_trench') {
        // Dark dress peek in front slit of trench
        rect(13, 25, 2, 2, innerMain);
      }
      // Crisp skirt/hip outline
      px(8, 24, O);
      px(19, 24, O);
      px(7, 25, O);
      px(20, 25, O);
      px(7, 26, O);
      px(20, 26, O);
      rect(8, 27, 12, 1, O);
    } else {
      // Fitted hips into slim athletic joggers / slacks
      rect(9, 24, 10, 2, bottomMain);
      rect(8, 25, 12, 1, bottomMain);
      px(9, 24, bottomHighlight); // side highlight / stripe
      px(18, 24, bottomHighlight);
      px(8, 25, bottomHighlight);
      px(19, 25, bottomHighlight);
      px(13, 25, bottomShade);
      px(14, 25, bottomShade);
      // Hip outline
      px(8, 24, O);
      px(19, 24, O);
      px(7, 25, O);
      px(20, 25, O);
      px(8, 26, O);
      px(19, 26, O);
      rect(9, 26, 4, 1, bottomMain);
      rect(15, 26, 4, 1, bottomMain);
      rect(13, 26, 2, 1, O);
    }

    // Shoulder & cinched-waist outline (makes hourglass shape unmistakably crisp!)
    rect(9, 19, 3, 1, O);
    rect(16, 19, 3, 1, O);
    px(9, 22, O); // cinched waist left indent!
    px(18, 22, O); // cinched waist right indent!
    px(9, 23, O);
    px(18, 23, O);

    // Slender female arms tucked naturally along upper torso (y=20..25)
    const femaleShortSleeve = cfg.outfit === 'female_team_polo';
    rect(7, 20, 2, femaleShortSleeve ? 2 : 3, topMain);
    if (femaleShortSleeve) {
      rect(7, 22, 2, 1, skin.base);
    }
    px(7, 20, O);
    px(6, 21, O);
    px(6, 22, O);
    px(6, 23, O);
    rect(7, 23, 2, 2, skin.base);
    px(7, 24, skin.shadow);
    px(6, 24, O);
    px(7, 25, O);

    rect(19, 20, 2, femaleShortSleeve ? 2 : 3, topMain);
    if (femaleShortSleeve) {
      rect(19, 22, 2, 1, skin.base);
    }
    px(20, 20, O);
    px(21, 21, O);
    px(21, 22, O);
    px(21, 23, O);
    rect(19, 23, 2, 2, skin.base);
    px(20, 24, skin.shadow);
    px(21, 24, O);
    px(20, 25, O);

    // Slim legs (skin/stockings under skirt, or slim joggers/slacks) + sleek footwear (y=27..32)
    const darkTights =
      cfg.outfit === 'female_blazer' || cfg.outfit === 'female_coat_scarf';
    const legMain = isSkirtOrDress
      ? darkTights
        ? '#262936' // sheer dark tights for blazer / winter wool coat
        : skin.base
      : bottomMain;
    const legShade = isSkirtOrDress
      ? darkTights
        ? '#181a24'
        : skin.shadow
      : bottomShade;

    rect(10, 28, 3, 2, legMain);
    px(10, 28, legShade);
    px(10, 29, legShade);
    rect(9, 28, 1, 2, O);
    rect(13, 28, 1, 2, O);

    rect(15, 28, 3, 2, legMain);
    px(17, 28, legShade);
    px(17, 29, legShade);
    rect(14, 28, 1, 2, O);
    rect(18, 28, 1, 2, O);

    if (!isSkirtOrDress) {
      // Connect trousers seamlessly at y=27
      rect(10, 27, 3, 1, bottomMain);
      rect(15, 27, 3, 1, bottomMain);
      px(9, 27, O);
      px(13, 27, O);
      px(14, 27, O);
      px(18, 27, O);
    }

    // Sleek shoes / ankle boots / sneakers (y=30..32)
    rect(9, 30, 4, 2, shoeMain);
    rect(10, 30, 2, 1, shoeHi);
    px(8, 31, O);
    rect(9, 32, 4, 1, O);
    px(13, 30, O);
    px(13, 31, O);

    rect(15, 30, 4, 2, shoeMain);
    rect(16, 30, 2, 1, shoeHi);
    px(19, 31, O);
    rect(15, 32, 4, 1, O);
    px(14, 30, O);
    px(14, 31, O);
  } else {
    // -----------------------------------------------------------------------
    // MALE SILHOUETTE:
    // - Structured broader shoulders (x=8..19) & straight athletic torso (y=19..26)
    // - Straight sleeves & sturdy trousers (y=27..32)
    // -----------------------------------------------------------------------
    let topMain = '#1e2430';
    let topShade = '#12161f';
    let topHighlight = '#364156';
    let innerMain = '#f8fafc';
    let accent = '#dc2626';
    let pantsMain = '#1e2530';
    let pantsShade = '#11161e';
    let shoeMain = '#1b1d24';
    let shoeHi = '#3d4354';

    if (cfg.outfit === 'navy_coat') {
      topMain = '#1f365c';
      topShade = '#142440';
      topHighlight = '#345891';
      innerMain = '#28303d';
      accent = '#cbd5e1';
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
    } else if (cfg.outfit === 'tuxedo') {
      topMain = '#151922';
      topShade = '#0b0e14';
      topHighlight = '#334155';
      innerMain = '#f8fafc';
      accent = '#e11d48'; // gala crimson bowtie
      pantsMain = '#151922';
      pantsShade = '#0b0e14';
    } else if (cfg.outfit === 'sweater_vest') {
      topMain = '#5b2333';
      topShade = '#3b1520';
      topHighlight = '#82354a';
      innerMain = '#f1f5f9'; // crisp white shirt beneath vest
      accent = '#fbbf24';
      pantsMain = '#27303f';
      pantsShade = '#181e29';
    } else if (cfg.outfit === 'leather_jacket') {
      topMain = '#1b1f28';
      topShade = '#0f1218';
      topHighlight = '#64748b';
      innerMain = '#2d3442';
      accent = '#cbd5e1'; // metallic silver zip
      pantsMain = '#1e2430';
      pantsShade = '#12161f';
    } else if (cfg.outfit === 'team_polo') {
      topMain = clubPrimaryColor;
      topShade = '#151c26';
      topHighlight = clubSecondaryColor;
      innerMain = clubSecondaryColor;
      accent = clubSecondaryColor;
      pantsMain = '#1e293b';
      pantsShade = '#0f172a';
      shoeMain = '#f1f5f9';
      shoeHi = clubPrimaryColor;
    }

    // Neck
    rect(12, 18, 4, 2, skin.shadow);
    rect(13, 18, 2, 2, skin.base);

    // Straight structured male torso (x=8..19, y=19..26)
    rect(8, 19, 12, 7, topMain);
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
    } else if (cfg.outfit === 'tuxedo') {
      // Crisp white tuxedo bib + satin lapels + crimson bowtie + gold button
      rect(12, 19, 4, 5, innerMain);
      rect(12, 20, 4, 1, accent);
      px(13, 20, '#fb7185');
      px(11, 20, topHighlight);
      px(16, 20, topHighlight);
      px(11, 21, topHighlight);
      px(16, 21, topHighlight);
      px(12, 22, topHighlight);
      px(15, 22, topHighlight);
      px(13, 24, '#fbbf24');
      px(16, 22, '#f8fafc'); // pocket square
    } else if (cfg.outfit === 'sweater_vest') {
      // White collared shirt V-neck + argyle/knit texture on burgundy vest
      rect(12, 19, 4, 2, innerMain);
      rect(13, 21, 2, 1, innerMain);
      px(10, 22, topHighlight);
      px(17, 22, topHighlight);
      px(12, 23, topHighlight);
      px(15, 23, topHighlight);
      rect(9, 25, 10, 1, topShade);
    } else if (cfg.outfit === 'leather_jacket') {
      // Biker lapels + dark tee + metallic diagonal zipper
      rect(12, 19, 4, 4, innerMain);
      px(10, 20, topHighlight);
      px(17, 20, topHighlight);
      px(11, 21, accent);
      px(16, 21, accent);
      rect(13, 23, 2, 3, accent);
      rect(9, 25, 10, 1, topShade);
    } else if (cfg.outfit === 'team_polo') {
      // Sporty touchline polo collar + contrast placket + club crest
      rect(11, 19, 6, 1, innerMain);
      rect(13, 20, 2, 3, innerMain);
      px(10, 21, accent);
      px(16, 22, accent);
    }

    // Broad straight shoulder & hem outline
    rect(8, 19, 3, 1, O);
    rect(17, 19, 3, 1, O);
    rect(8, 26, 12, 1, O);

    // Sturdy male arms & hands (white shirt sleeves for sweater_vest, short sleeves for team_polo)
    const maleSleeveColor =
      cfg.outfit === 'sweater_vest' ? innerMain : topMain;
    const maleShortSleeve = cfg.outfit === 'team_polo';

    rect(6, 20, 2, maleShortSleeve ? 2 : 4, maleSleeveColor);
    if (maleShortSleeve) {
      rect(6, 22, 2, 2, skin.base);
    }
    px(6, 20, O);
    px(5, 21, O);
    px(5, 22, O);
    px(5, 23, O);
    rect(6, 24, 2, 2, skin.base);
    px(6, 25, skin.shadow);
    px(5, 24, O);
    px(5, 25, O);
    rect(6, 26, 2, 1, O);

    rect(20, 20, 2, maleShortSleeve ? 2 : 4, maleSleeveColor);
    if (maleShortSleeve) {
      rect(20, 22, 2, 2, skin.base);
    }
    px(21, 20, O);
    px(22, 21, O);
    px(22, 22, O);
    px(22, 23, O);
    rect(20, 24, 2, 2, skin.base);
    px(21, 25, skin.shadow);
    px(22, 24, O);
    px(22, 25, O);
    rect(20, 26, 2, 1, O);

    // Straight trousers & shoes (y=27..32)
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
  }

  // =========================================================================
  // 5) OPTIONAL DYNAMIC FACIAL EXPRESSION OVERLAY
  // =========================================================================
  if (expression !== 'default') {
    // Clear standard eyes & mouth plane cleanly with skin base first
    rect(8, 11, 12, 6, skin.base);
    rect(10, 9, 8, 1, skin.highlight);

    if (expression === 'cheer_grin') {
      // Joyful arched laughing eyes (^ ^) + big cheering open smile
      px(9, 13, O);
      px(10, 12, O);
      px(11, 12, O);
      px(12, 13, O);

      px(15, 13, O);
      px(16, 12, O);
      px(17, 12, O);
      px(18, 13, O);

      // Rosy happy cheeks
      rect(8, 14, 2, 1, '#f43f5e');
      rect(18, 14, 2, 1, '#f43f5e');

      // Big open cheering mouth with white teeth & tongue
      rect(11, 15, 6, 1, '#ffffff');
      rect(11, 16, 6, 2, '#be123c');
      rect(12, 17, 4, 1, '#fb7185');
    } else if (expression === 'smug_wink') {
      // Left eye winking (>), right eye gleaming, cocky tilted smirk
      px(9, 12, O);
      px(10, 13, O);
      px(11, 13, O);
      px(9, 14, O);

      rect(16, 11, 3, 1, O);
      rect(16, 12, 2, 3, '#161822');
      px(18, 12, '#ffffff');
      px(17, 12, '#38bdf8');

      // Cocky asymmetric smirk
      rect(12, 16, 4, 1, O);
      px(16, 15, O);
      px(15, 15, '#ffffff');
    } else if (expression === 'cool_shades') {
      // Deal-with-it pixel sunglasses + confident grin
      rect(7, 12, 14, 1, O);
      rect(8, 12, 5, 3, '#090d16');
      rect(15, 12, 5, 3, '#090d16');
      // Lens shine
      px(9, 12, '#ffffff');
      px(10, 13, '#38bdf8');
      px(16, 12, '#ffffff');
      px(17, 13, '#38bdf8');
      // Confident white-teeth grin
      rect(11, 16, 6, 1, '#ffffff');
      px(10, 15, O);
      px(17, 15, O);
    } else if (expression === 'crying_wail') {
      // Sad upturned brows + crying shut eyes + waterfall tears + wailing mouth
      px(9, 12, O);
      px(10, 11, O);
      px(11, 11, O);
      px(18, 12, O);
      px(17, 11, O);
      px(16, 11, O);

      rect(9, 13, 3, 1, O);
      rect(16, 13, 3, 1, O);

      // Streaming cyan waterfall tears down both cheeks
      rect(9, 14, 2, 5, '#38bdf8');
      px(10, 15, '#bae6fd');
      rect(17, 14, 2, 5, '#38bdf8');
      px(17, 15, '#bae6fd');

      // Wailing open crying mouth
      rect(12, 15, 4, 2, '#881337');
      rect(12, 15, 4, 1, '#ffffff');
      px(11, 17, O);
      px(16, 17, O);
    } else if (expression === 'dizzy_shock') {
      // X-eyes + pale shock lines + open gasping mouth
      px(9, 12, O);
      px(11, 12, O);
      px(10, 13, O);
      px(9, 14, O);
      px(11, 14, O);

      px(16, 12, O);
      px(18, 12, O);
      px(17, 13, O);
      px(16, 14, O);
      px(18, 14, O);

      // Trembling shock mouth
      rect(12, 15, 4, 2, '#1e293b');
      px(13, 16, '#fb7185');
    } else if (expression === 'fierce_glare') {
      // Competitive V-angled brows + glowing eyes + grit teeth
      px(9, 11, O);
      px(10, 11, O);
      px(11, 12, O);
      px(18, 11, O);
      px(17, 11, O);
      px(16, 12, O);

      rect(9, 12, 3, 2, '#161822');
      px(10, 12, '#fbbf24');
      rect(16, 12, 3, 2, '#161822');
      px(17, 12, '#fbbf24');

      rect(11, 16, 6, 1, '#ffffff');
      rect(11, 15, 6, 1, O);
    }
  }

  // =========================================================================
  // 6) OPTIONAL DYNAMIC ARM POSE OVERLAY
  // =========================================================================
  if (pose !== 'default') {
    const pal = resolveManagerPalette(
      avatar,
      clubPrimaryColor,
      clubSecondaryColor,
    );
    // Clear default side arms (x=5..7 & x=20..22, y=20..26)
    for (let y = 20; y <= 26; y += 1) {
      for (let x = 5; x <= 7; x += 1) {
        if (!isFemale || x <= 7) pixels[y][x] = null;
      }
      for (let x = 20; x <= 22; x += 1) {
        if (!isFemale || x >= 19) pixels[y][x] = null;
      }
    }
    if (isFemale) {
      for (let y = 20; y <= 25; y += 1) {
        pixels[y][7] = null;
        pixels[y][8] = y >= 24 ? pixels[y][8] : null;
        pixels[y][19] = y >= 24 ? pixels[y][19] : null;
        pixels[y][20] = null;
      }
    }

    if (pose === 'arms_up_cheer') {
      // Both arms raised high cheering in a V-shape!
      rect(5, 13, 2, 7, pal.topMain);
      rect(4, 12, 1, 8, O);
      rect(7, 13, 1, 6, O);
      rect(5, 11, 2, 2, skin.base);
      rect(5, 10, 2, 1, O);

      rect(21, 13, 2, 7, pal.topMain);
      rect(23, 12, 1, 8, O);
      rect(20, 13, 1, 6, O);
      rect(21, 11, 2, 2, skin.base);
      rect(21, 10, 2, 1, O);
    } else if (pose === 'fist_pump') {
      // Left arm on hip, right arm pumping fist high!
      rect(6, 20, 2, 4, pal.topMain);
      rect(6, 24, 2, 2, skin.base);
      px(5, 21, O);
      px(5, 22, O);
      px(5, 23, O);

      rect(21, 12, 2, 8, pal.topMain);
      rect(23, 12, 1, 8, O);
      rect(21, 9, 3, 3, skin.base);
      rect(21, 8, 3, 1, O);
    } else if (pose === 'arms_crossed_smug') {
      // Arms folded smugly across the chest
      rect(7, 20, 2, 3, pal.topMain);
      rect(19, 20, 2, 3, pal.topMain);
      rect(8, 22, 12, 3, pal.topMain);
      rect(8, 21, 12, 1, O);
      rect(8, 25, 12, 1, O);
      rect(9, 22, 2, 2, skin.base);
      rect(17, 22, 2, 2, skin.base);
    } else if (pose === 'hands_on_head_despair') {
      // Both hands raised clutching sides of the head in disbelief!
      rect(5, 14, 2, 7, pal.topMain);
      rect(6, 11, 2, 3, skin.base);
      px(4, 15, O);
      px(4, 16, O);
      px(4, 17, O);

      rect(21, 14, 2, 7, pal.topMain);
      rect(20, 11, 2, 3, skin.base);
      px(23, 15, O);
      px(23, 16, O);
      px(23, 17, O);
    }
  }

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

  return { width: W, height: H, rects };
}

/**
 * 2-head-tall chibi pixel-art football manager avatar (28x34 pixel grid)
 * with strictly separated Male/Female silhouettes, faces, hairstyles, outfits,
 * plus optional dynamic facial expressions and celebration/despair arm poses.
 */
export function PixelManagerAvatar({
  avatar,
  clubPrimaryColor = '#10b981',
  clubSecondaryColor = '#f8fafc',
  size = 84,
  className = '',
  expression = 'default',
  pose = 'default',
}: PixelManagerAvatarProps) {
  const { width: W, height: H, rects } = getManagerAvatarRects({
    avatar,
    clubPrimaryColor,
    clubSecondaryColor,
    expression,
    pose,
  });

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

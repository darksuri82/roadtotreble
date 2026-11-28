import { describe, expect, it } from 'vitest';
import jerseySvgSrc from '../components/common/JerseySvg.tsx?raw';
import {
  FEMALE_HAIR_STYLE_OPTIONS,
  FEMALE_OUTFIT_OPTIONS,
  getHairStyleOptionsForGender,
  getManagerAvatarRects,
  getOutfitOptionsForGender,
  HAIR_COLOR_OPTIONS,
  MALE_HAIR_STYLE_OPTIONS,
  MALE_OUTFIT_OPTIONS,
  normalizeAvatarForGender,
  resolveManagerPalette,
} from '../components/common/PixelManagerAvatar';
import profileModalSrc from '../components/common/ProfileCustomizerModal.tsx?raw';
import {
  JERSEY_PATTERN_OPTIONS,
  PRIMARY_COLORS,
  SECONDARY_COLORS,
} from '../components/common/ProfileCustomizerModal';
import heroSvgSrc from '../components/setup/RoadToTrebleHeroSvg.tsx?raw';
import globalRankingSrc from '../services/globalRankingService.ts?raw';
import {
  ALL_JERSEY_PATTERNS,
  MAX_CLUB_PRESETS,
  normalizeClubProfile,
} from '../utils/clubPresets';

describe('v10.1.8 감독 커스텀 다양성 & 구단 유니폼 패턴·컬러 확장', () => {
  it('남녀 헤어스타일(남 9종 · 여 8종), 머리색(9종), 남녀 의상(남 9종 · 여 8종)이 모두 정의되어 있다', () => {
    expect(MALE_HAIR_STYLE_OPTIONS).toHaveLength(9);
    expect(FEMALE_HAIR_STYLE_OPTIONS).toHaveLength(8);
    expect(HAIR_COLOR_OPTIONS).toHaveLength(9);
    expect(MALE_OUTFIT_OPTIONS).toHaveLength(9);
    expect(FEMALE_OUTFIT_OPTIONS).toHaveLength(8);
    expect(getHairStyleOptionsForGender('male')).toHaveLength(9);
    expect(getHairStyleOptionsForGender('female')).toHaveLength(8);
    expect(getOutfitOptionsForGender('male')).toHaveLength(9);
    expect(getOutfitOptionsForGender('female')).toHaveLength(8);
  });

  it('모든 남성·여성 헤어스타일과 의상 조합이 28x34 픽셀 그리드에서 서로 구분되는 아바타를 렌더링한다', () => {
    const maleHairFingerprints = new Set<string>();
    for (const hair of MALE_HAIR_STYLE_OPTIONS) {
      const sprite = getManagerAvatarRects({
        avatar: {
          gender: 'male',
          skinTone: 'peach',
          hairStyle: hair.id,
          hairColor: 'auburn',
          outfit: 'classic_suit',
        },
        clubPrimaryColor: '#2563eb',
        clubSecondaryColor: '#fbbf24',
      });
      expect(sprite.width).toBe(28);
      expect(sprite.height).toBe(34);
      expect(sprite.rects.length).toBeGreaterThan(20);
      maleHairFingerprints.add(JSON.stringify(sprite.rects));
    }
    expect(maleHairFingerprints.size).toBe(MALE_HAIR_STYLE_OPTIONS.length);

    const femaleHairFingerprints = new Set<string>();
    for (const hair of FEMALE_HAIR_STYLE_OPTIONS) {
      const sprite = getManagerAvatarRects({
        avatar: {
          gender: 'female',
          skinTone: 'light',
          hairStyle: hair.id,
          hairColor: 'ash_pink',
          outfit: 'female_blazer',
        },
        clubPrimaryColor: '#ec4899',
        clubSecondaryColor: '#ffffff',
      });
      expect(sprite.rects.length).toBeGreaterThan(20);
      femaleHairFingerprints.add(JSON.stringify(sprite.rects));
    }
    expect(femaleHairFingerprints.size).toBe(FEMALE_HAIR_STYLE_OPTIONS.length);

    const maleOutfitFingerprints = new Set<string>();
    for (const outfit of MALE_OUTFIT_OPTIONS) {
      const sprite = getManagerAvatarRects({
        avatar: {
          gender: 'male',
          skinTone: 'warm',
          hairStyle: 'fluffy',
          hairColor: 'black',
          outfit: outfit.id,
        },
        clubPrimaryColor: '#10b981',
        clubSecondaryColor: '#f8fafc',
      });
      maleOutfitFingerprints.add(JSON.stringify(sprite.rects));
    }
    expect(maleOutfitFingerprints.size).toBe(MALE_OUTFIT_OPTIONS.length);

    const femaleOutfitFingerprints = new Set<string>();
    for (const outfit of FEMALE_OUTFIT_OPTIONS) {
      const sprite = getManagerAvatarRects({
        avatar: {
          gender: 'female',
          skinTone: 'peach',
          hairStyle: 'bob',
          hairColor: 'navy',
          outfit: outfit.id,
        },
        clubPrimaryColor: '#10b981',
        clubSecondaryColor: '#f8fafc',
      });
      femaleOutfitFingerprints.add(JSON.stringify(sprite.rects));
    }
    expect(femaleOutfitFingerprints.size).toBe(FEMALE_OUTFIT_OPTIONS.length);
  });

  it('팀 컬러 연동 헤어(cap) 및 의상(team_polo, female_team_polo)이 구단 컬러를 반영한다', () => {
    const capSprite = getManagerAvatarRects({
      avatar: {
        gender: 'male',
        skinTone: 'peach',
        hairStyle: 'cap',
        hairColor: 'brown',
        outfit: 'team_polo',
      },
      clubPrimaryColor: '#7c3aed',
      clubSecondaryColor: '#fde047',
    });
    expect(capSprite.rects.some((r) => r.fill === '#7c3aed')).toBe(true);
    expect(capSprite.rects.some((r) => r.fill === '#fde047')).toBe(true);

    const femalePoloPalette = resolveManagerPalette(
      {
        gender: 'female',
        skinTone: 'light',
        hairStyle: 'pixie',
        hairColor: 'emerald',
        outfit: 'female_team_polo',
      },
      '#b91c1c',
      '#ffffff',
    );
    expect(femalePoloPalette.topMain).toBe('#b91c1c');
    expect(femalePoloPalette.topHighlight).toBe('#ffffff');
  });

  it('성별 전환 시 신규 헤어스타일과 의상도 유효한 대상 성별 옵션으로 안전 매핑된다', () => {
    const maleHairIds = new Set(MALE_HAIR_STYLE_OPTIONS.map((h) => h.id));
    const femaleHairIds = new Set(FEMALE_HAIR_STYLE_OPTIONS.map((h) => h.id));
    const maleOutfitIds = new Set(MALE_OUTFIT_OPTIONS.map((o) => o.id));
    const femaleOutfitIds = new Set(FEMALE_OUTFIT_OPTIONS.map((o) => o.id));

    for (const hair of MALE_HAIR_STYLE_OPTIONS) {
      for (const outfit of MALE_OUTFIT_OPTIONS) {
        const converted = normalizeAvatarForGender(
          {
            gender: 'male',
            skinTone: 'tan',
            hairStyle: hair.id,
            hairColor: 'crimson',
            outfit: outfit.id,
          },
          'female',
        );
        expect(converted.gender).toBe('female');
        expect(femaleHairIds.has(converted.hairStyle)).toBe(true);
        expect(femaleOutfitIds.has(converted.outfit)).toBe(true);
        expect(converted.hairColor).toBe('crimson');
      }
    }

    for (const hair of FEMALE_HAIR_STYLE_OPTIONS) {
      for (const outfit of FEMALE_OUTFIT_OPTIONS) {
        const converted = normalizeAvatarForGender(
          {
            gender: 'female',
            skinTone: 'deep',
            hairStyle: hair.id,
            hairColor: 'emerald',
            outfit: outfit.id,
          },
          'male',
        );
        expect(converted.gender).toBe('male');
        expect(maleHairIds.has(converted.hairStyle)).toBe(true);
        expect(maleOutfitIds.has(converted.outfit)).toBe(true);
        expect(converted.hairColor).toBe('emerald');
      }
    }
  });

  it('유니폼 패턴 12종과 커스텀 HEX 컬러, 10슬롯 프리셋이 전 컴포넌트·서비스에 일관 반영된다', () => {
    expect(ALL_JERSEY_PATTERNS).toHaveLength(12);
    expect(JERSEY_PATTERN_OPTIONS).toHaveLength(12);
    expect(PRIMARY_COLORS.length).toBeGreaterThanOrEqual(18);
    expect(SECONDARY_COLORS.length).toBeGreaterThanOrEqual(16);
    expect(MAX_CLUB_PRESETS).toBe(10);

    for (const pattern of ALL_JERSEY_PATTERNS) {
      const normalized = normalizeClubProfile({
        name: '나만의 FC',
        shortName: 'MYFC',
        primaryColor: '#3b1d5e',
        secondaryColor: '#facc15',
        pattern,
      });
      expect(normalized.pattern).toBe(pattern);
      expect(normalized.primaryColor).toBe('#3b1d5e');
      expect(normalized.secondaryColor).toBe('#facc15');
      expect(globalRankingSrc).toContain(`'${pattern}'`);
      if (pattern !== 'solid') {
        expect(jerseySvgSrc).toContain(`'${pattern}'`);
        expect(heroSvgSrc).toContain(`'${pattern}'`);
      }
    }

    expect(profileModalSrc).toContain('type="color"');
    expect(profileModalSrc).toContain('색상 반전');
    expect(profileModalSrc).toContain('랜덤 외형');
    expect(profileModalSrc).toContain('랜덤 유니폼');
  });
});

import { describe, expect, it } from 'vitest';
import { getManagerAvatarRects } from '../components/common/PixelManagerAvatar';
import {
  isWhatsNewDismissed,
  WHATS_NEW_HIGHLIGHT_RANGE,
} from '../components/common/WhatsNewModal';
import profileModalSrc from '../components/common/ProfileCustomizerModal.tsx?raw';
import leagueSelectSrc from '../components/league/LeagueSelect.tsx?raw';
import formationSelectSrc from '../components/setup/FormationSelect.tsx?raw';
import managerRouletteSrc from '../components/setup/ManagerRouletteScreen.tsx?raw';
import heroSvgSrc from '../components/setup/RoadToTrebleHeroSvg.tsx?raw';
import titleScreenSrc from '../components/setup/TitleScreen.tsx?raw';
import { CURRENT_APP_VERSION, PATCH_NOTES } from '../data/patchNotes';
import {
  createInitialState,
  gameReducer,
  loadSavedGameState,
  persistGameStateToStorage,
} from '../store/GameContext';
import { DEFAULT_MANAGER_AVATAR, DEFAULT_MANAGER_NAME } from '../types/game';
import {
  ACTIVE_PROFILE_STORAGE_KEY,
  CLUB_PRESETS_STORAGE_KEY,
  DEFAULT_USER_CLUB_PROFILE,
  loadActiveUserProfile,
  saveActiveUserProfile,
  saveClubPreset,
} from '../utils/clubPresets';

function withMockLocalStorage(fn: (store: Map<string, string>) => void) {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => {
      store.set(key, String(val));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  const prevWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: mockStorage },
  });
  try {
    fn(store);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: prevWindow,
      });
    }
  }
}

describe('v9.9.0 Title Pixel Redesign, First-Screen Profile Customizer & Streamlined Start Flow', () => {
  it('1) produces distinct pixel sprite rects for customized manager avatars & embeds live manager/trophies/GOAT in RoadToTrebleHeroSvg', () => {
    const maleDefault = getManagerAvatarRects({
      avatar: DEFAULT_MANAGER_AVATAR,
      clubPrimaryColor: '#10b981',
      clubSecondaryColor: '#0f172a',
    });
    const femaleCustom = getManagerAvatarRects({
      avatar: {
        gender: 'female',
        skinTone: 'light',
        hairStyle: 'ponytail',
        hairColor: 'blonde',
        outfit: 'female_tracksuit',
      },
      clubPrimaryColor: '#ef4444',
      clubSecondaryColor: '#fbbf24',
    });

    expect(maleDefault.width).toBe(28);
    expect(maleDefault.height).toBe(34);
    expect(maleDefault.rects.length).toBeGreaterThan(40);
    expect(femaleCustom.rects.length).toBeGreaterThan(40);
    // Custom club tracksuit color must appear in pixel output
    expect(femaleCustom.rects.some((r) => r.fill === '#ef4444')).toBe(true);
    expect(maleDefault.rects.some((r) => r.fill === '#ef4444')).toBe(false);

    // RoadToTrebleHeroSvg preserves all required visual landmarks & upgraded details
    expect(heroSvgSrc).toContain('viewBox="0 0 280 108"');
    expect(heroSvgSrc).toContain('getManagerAvatarRects');
    expect(heroSvgSrc).toContain('EPL_TROPHY');
    expect(heroSvgSrc).toContain('CUP_TROPHY');
    expect(heroSvgSrc).toContain('UCL_TROPHY');
    expect(heroSvgSrc).toContain('hero-pixel-twinkle');
    expect(heroSvgSrc).toContain('hero-spotlight-breath');
    expect(heroSvgSrc).toContain('GOAT');
  });

  it('2) persists active club + manager profile in localStorage, migrates from legacy club presets, and falls back to clean defaults', () => {
    withMockLocalStorage((store) => {
      // Fresh visit returns clean defaults without requiring customization
      const fresh = loadActiveUserProfile();
      expect(fresh.clubProfile.name).toBe(DEFAULT_USER_CLUB_PROFILE.name);
      expect(fresh.managerName).toBe(DEFAULT_MANAGER_NAME);
      expect(fresh.managerAvatar.gender).toBe('male');

      // Legacy club preset fallback works seamlessly when ACTIVE_PROFILE_STORAGE_KEY is absent
      saveClubPreset(
        {
          name: '서울 유나이티드',
          shortName: 'SEL',
          primaryColor: '#ef4444',
          secondaryColor: '#ffffff',
          pattern: 'stripes',
        },
        {
          name: '박명장',
          avatar: {
            gender: 'female',
            skinTone: 'light',
            hairStyle: 'bob',
            hairColor: 'black',
            outfit: 'female_blazer',
          },
        },
      );
      expect(store.has(CLUB_PRESETS_STORAGE_KEY)).toBe(true);
      const migrated = loadActiveUserProfile();
      expect(migrated.clubProfile.name).toBe('서울 유나이티드');
      expect(migrated.clubProfile.shortName).toBe('SEL');
      expect(migrated.managerName).toBe('박명장');
      expect(migrated.managerAvatar.gender).toBe('female');

      // Saving active profile persists independently to ACTIVE_PROFILE_STORAGE_KEY
      saveActiveUserProfile({
        clubProfile: {
          name: '레알 코리아',
          shortName: 'RKR',
          primaryColor: '#2563eb',
          secondaryColor: '#fbbf24',
          pattern: 'half',
        },
        managerName: '김전술',
        managerAvatar: {
          gender: 'male',
          skinTone: 'warm',
          hairStyle: 'bald',
          hairColor: 'black',
          outfit: 'navy_coat',
        },
      });
      expect(store.has(ACTIVE_PROFILE_STORAGE_KEY)).toBe(true);
      const reloaded = loadActiveUserProfile();
      expect(reloaded.clubProfile.name).toBe('레알 코리아');
      expect(reloaded.clubProfile.shortName).toBe('RKR');
      expect(reloaded.managerName).toBe('김전술');
      expect(reloaded.managerAvatar.hairStyle).toBe('bald');
    });
  });

  it('3) preserves customized club and manager across START_NEW_CAREER, RESET_GAME, and keeps in-progress season saves intact', () => {
    withMockLocalStorage(() => {
      let st = createInitialState();
      st = gameReducer(st, {
        type: 'APPLY_USER_PROFILE',
        payload: {
          clubProfile: {
            name: '에메랄드 시티 FC',
            shortName: 'EMC',
            primaryColor: '#0ea5e9',
            secondaryColor: '#ffffff',
            pattern: 'hoops',
          },
          managerName: '이감독',
          managerAvatar: {
            gender: 'female',
            skinTone: 'peach',
            hairStyle: 'long_wave',
            hairColor: 'blonde',
            outfit: 'female_trench',
          },
        },
      });

      // START_NEW_CAREER jumps straight to tactical setup preserving BOTH club and manager profile
      const started = gameReducer(st, { type: 'START_NEW_CAREER' });
      expect(started.phase).toBe('setup');
      expect(started.userClub.name).toBe('에메랄드 시티 FC');
      expect(started.userClub.shortName).toBe('EMC');
      expect(started.manager.name).toBe('이감독');
      expect(started.manager.avatar.gender).toBe('female');
      expect(started.manager.avatar.hairStyle).toBe('long_wave');

      // Proceed to manager trait selection -> draft -> league select smoothly
      let progressed = gameReducer(started, { type: 'PROCEED_TO_MANAGER_ROULETTE' });
      expect(progressed.phase).toBe('manager_roulette');
      progressed = gameReducer(progressed, {
        type: 'SELECT_MANAGER_TRAIT',
        payload: { traitId: 'tiki_taka' },
      });
      progressed = gameReducer(progressed, { type: 'CONFIRM_MANAGER_TRAIT' });
      expect(progressed.phase).toBe('draft');
      expect(progressed.userClub.name).toBe('에메랄드 시티 FC');
      expect(progressed.manager.name).toBe('이감독');

      // In-progress season save keeps its own snapshot on loadSavedGameState
      progressed = gameReducer(progressed, { type: 'AUTO_COMPLETE_DRAFT' });
      progressed = gameReducer(progressed, {
        type: 'SELECT_LEAGUE',
        payload: { leagueId: 'epl' },
      });
      expect(progressed.phase).toBe('season');
      persistGameStateToStorage(progressed);

      const loadedSeason = loadSavedGameState();
      expect(loadedSeason.phase).toBe('season');
      expect(loadedSeason.userClub.name).toBe('에메랄드 시티 FC');
      expect(loadedSeason.manager.name).toBe('이감독');

      // RESET_GAME clears season save but retains persisted club + manager profile
      const afterReset = gameReducer(loadedSeason, { type: 'RESET_GAME' });
      expect(afterReset.phase).toBe('title');
      expect(afterReset.userClub.name).toBe('에메랄드 시티 FC');
      expect(afterReset.manager.name).toBe('이감독');
      expect(afterReset.manager.avatar.hairStyle).toBe('long_wave');
    });
  });

  it('4) separates club/avatar customization onto TitleScreen compact bar and removes redundant input walls from setup steps', () => {
    // TitleScreen embeds compact 1-line profile bar + passes live manager/club props to RoadToTrebleHeroSvg
    expect(titleScreenSrc).toContain('title-profile-customizer-btn');
    expect(titleScreenSrc).toContain('h-[50px]');
    expect(titleScreenSrc).toContain('managerAvatar={state.manager.avatar}');
    expect(titleScreenSrc).toContain('ProfileCustomizerModal');

    // FormationSelect removes redundant club/preset forms while keeping 10 formations + ActiveProfileChip
    expect(formationSelectSrc).toContain('ActiveProfileChip');
    expect(formationSelectSrc).toContain('10종 포메이션 선택');
    expect(formationSelectSrc).not.toContain('이전 팀 불러오기');
    expect(formationSelectSrc).not.toContain('구단 &amp; 유니폼');

    // ManagerRouletteScreen removes redundant avatar form while keeping trait selection + ActiveProfileChip
    expect(managerRouletteSrc).toContain('ActiveProfileChip');
    expect(managerRouletteSrc).not.toContain('감독 캐릭터 커스터마이징');
    expect(managerRouletteSrc).not.toContain('manager-name-input');

    // LeagueSelect includes ActiveProfileChip and reflects 10 formations
    expect(leagueSelectSrc).toContain('ActiveProfileChip');
    expect(leagueSelectSrc).toContain('포메이션(10종)');

    // Shared modal uses ModalBodyLock + 100dvh-safe modal-panel
    expect(profileModalSrc).toContain('ModalBodyLock');
    expect(profileModalSrc).toContain('modal-panel');
  });

  it('5) keeps v9.9.0 patch notes and WhatsNewModal version keys synchronized', () => {
    expect(CURRENT_APP_VERSION).toBe('v9.9.0');
    expect(PATCH_NOTES[0].version).toBe('v9.9.0');
    expect(WHATS_NEW_HIGHLIGHT_RANGE).toContain('v9.9.0');
    withMockLocalStorage(() => {
      expect(isWhatsNewDismissed('v9.9.0')).toBe(false);
    });
  });
});

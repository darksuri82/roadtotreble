import { normalizeAvatarForGender } from '../components/common/PixelManagerAvatar';
import type { ManagerAvatarConfig, UserClubProfile } from '../types/game';
import { DEFAULT_MANAGER_AVATAR, DEFAULT_MANAGER_NAME } from '../types/game';
import type { JerseyPattern } from '../types/league';

export const CLUB_PRESETS_STORAGE_KEY = 'pitch_manager_club_presets_v1';
export const ACTIVE_PROFILE_STORAGE_KEY = 'rtt_active_user_profile_v1';
export const MAX_CLUB_PRESETS = 10;

export const DEFAULT_USER_CLUB_PROFILE: UserClubProfile = {
  name: 'FC 유나이티드 드림',
  shortName: 'FUD',
  primaryColor: '#10b981',
  secondaryColor: '#0f172a',
  pattern: 'sash',
};

export const ALL_JERSEY_PATTERNS: readonly JerseyPattern[] = [
  'solid',
  'stripes',
  'pinstripes',
  'hoops',
  'sash',
  'half',
  'chevron',
  'quarters',
  'center_band',
  'chest_band',
  'checkered',
  'gradient',
] as const;

const VALID_PATTERNS = new Set<JerseyPattern>(ALL_JERSEY_PATTERNS);

export interface ClubPreset extends UserClubProfile {
  id: string;
  savedAt: string;
  managerName?: string;
  managerAvatar?: ManagerAvatarConfig;
}

export interface SavedUserProfile {
  clubProfile: UserClubProfile;
  managerName: string;
  managerAvatar: ManagerAvatarConfig;
  updatedAt: string;
}

export function normalizeManagerAvatar(
  avatar?: Partial<ManagerAvatarConfig> | null,
): ManagerAvatarConfig {
  return normalizeAvatarForGender(avatar);
}

export function normalizeClubProfile(
  club?: Partial<UserClubProfile> | null,
): UserClubProfile {
  const name =
    typeof club?.name === 'string' && club.name.trim().length > 0
      ? club.name.trim().slice(0, 22)
      : DEFAULT_USER_CLUB_PROFILE.name;
  const shortName =
    typeof club?.shortName === 'string' && club.shortName.trim().length > 0
      ? club.shortName.trim().toUpperCase().slice(0, 4)
      : DEFAULT_USER_CLUB_PROFILE.shortName;
  const primaryColor =
    typeof club?.primaryColor === 'string' && club.primaryColor.trim().length > 0
      ? club.primaryColor
      : DEFAULT_USER_CLUB_PROFILE.primaryColor;
  const secondaryColor =
    typeof club?.secondaryColor === 'string' &&
    club.secondaryColor.trim().length > 0
      ? club.secondaryColor
      : DEFAULT_USER_CLUB_PROFILE.secondaryColor;
  const pattern: JerseyPattern =
    club?.pattern && VALID_PATTERNS.has(club.pattern)
      ? club.pattern
      : DEFAULT_USER_CLUB_PROFILE.pattern;

  return {
    name,
    shortName,
    primaryColor,
    secondaryColor,
    pattern,
  };
}

export function hasSavedActiveUserProfile(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return Boolean(window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY));
  } catch {
    return false;
  }
}

/**
 * Loads the persisted default club + manager profile for single-player & multiplayer.
 * Falls back cleanly to the latest saved club preset, or first-visit defaults.
 */
export function loadActiveUserProfile(): SavedUserProfile {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedUserProfile>;
        if (parsed && typeof parsed === 'object') {
          return {
            clubProfile: normalizeClubProfile(parsed.clubProfile),
            managerName:
              typeof parsed.managerName === 'string' &&
              parsed.managerName.trim().length > 0
                ? parsed.managerName.trim().slice(0, 14)
                : DEFAULT_MANAGER_NAME,
            managerAvatar: normalizeManagerAvatar(parsed.managerAvatar),
            updatedAt:
              typeof parsed.updatedAt === 'string'
                ? parsed.updatedAt
                : new Date().toISOString(),
          };
        }
      }

      // Seamless migration for returning players who already saved a preset before v9.9
      const presets = loadClubPresets();
      if (presets.length > 0) {
        const latest = presets[0];
        return {
          clubProfile: normalizeClubProfile(latest),
          managerName:
            latest.managerName?.trim().slice(0, 14) || DEFAULT_MANAGER_NAME,
          managerAvatar: normalizeManagerAvatar(latest.managerAvatar),
          updatedAt: latest.savedAt,
        };
      }
    }
  } catch {
    // Ignore storage read errors and fall through to clean defaults
  }

  return {
    clubProfile: { ...DEFAULT_USER_CLUB_PROFILE },
    managerName: DEFAULT_MANAGER_NAME,
    managerAvatar: { ...DEFAULT_MANAGER_AVATAR },
    updatedAt: '',
  };
}

export function saveActiveUserProfile(input: {
  clubProfile: Partial<UserClubProfile>;
  managerName?: string;
  managerAvatar?: Partial<ManagerAvatarConfig> | null;
}): SavedUserProfile {
  const normalized: SavedUserProfile = {
    clubProfile: normalizeClubProfile(input.clubProfile),
    managerName:
      typeof input.managerName === 'string' && input.managerName.trim().length > 0
        ? input.managerName.trim().slice(0, 14)
        : DEFAULT_MANAGER_NAME,
    managerAvatar: normalizeManagerAvatar(input.managerAvatar),
    updatedAt: new Date().toISOString(),
  };

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        ACTIVE_PROFILE_STORAGE_KEY,
        JSON.stringify(normalized),
      );
    }
  } catch {
    // Ignore storage quota errors
  }

  return normalized;
}

export function loadClubPresets(): ClubPreset[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(CLUB_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ClubPreset =>
          Boolean(
            item &&
              typeof item.id === 'string' &&
              typeof item.name === 'string' &&
              typeof item.shortName === 'string' &&
              typeof item.primaryColor === 'string',
          ),
      )
      .map((item) => ({
        ...item,
        managerAvatar: item.managerAvatar
          ? normalizeManagerAvatar(item.managerAvatar)
          : undefined,
      }));
  } catch {
    return [];
  }
}

export function saveClubPreset(
  profile: UserClubProfile,
  manager?: { name?: string; avatar?: ManagerAvatarConfig },
): ClubPreset[] {
  const normalizedName = profile.name.trim() || DEFAULT_USER_CLUB_PROFILE.name;
  const normalizedShort =
    (profile.shortName.trim() || DEFAULT_USER_CLUB_PROFILE.shortName)
      .toUpperCase()
      .slice(0, 4);

  const existing = loadClubPresets();
  const prevMatch = existing.find(
    (p) => p.name.trim().toLowerCase() === normalizedName.toLowerCase(),
  );
  const deduped = existing.filter(
    (p) => p.name.trim().toLowerCase() !== normalizedName.toLowerCase(),
  );

  const nextPreset: ClubPreset = {
    id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: normalizedName,
    shortName: normalizedShort,
    primaryColor: profile.primaryColor,
    secondaryColor: profile.secondaryColor,
    pattern: profile.pattern,
    savedAt: new Date().toISOString(),
    managerName: manager?.name ?? prevMatch?.managerName,
    managerAvatar: manager?.avatar
      ? normalizeManagerAvatar(manager.avatar)
      : prevMatch?.managerAvatar,
  };

  const nextList = [nextPreset, ...deduped].slice(0, MAX_CLUB_PRESETS);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        CLUB_PRESETS_STORAGE_KEY,
        JSON.stringify(nextList),
      );
    }
  } catch {
    // Ignore storage quota errors
  }

  return nextList;
}

export function deleteClubPreset(presetId: string): ClubPreset[] {
  const existing = loadClubPresets();
  const nextList = existing.filter((p) => p.id !== presetId);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        CLUB_PRESETS_STORAGE_KEY,
        JSON.stringify(nextList),
      );
    }
  } catch {
    // Ignore storage quota errors
  }

  return nextList;
}

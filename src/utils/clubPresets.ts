import { normalizeAvatarForGender } from '../components/common/PixelManagerAvatar';
import type { ManagerAvatarConfig, UserClubProfile } from '../types/game';

export const CLUB_PRESETS_STORAGE_KEY = 'pitch_manager_club_presets_v1';
export const MAX_CLUB_PRESETS = 6;

export interface ClubPreset extends UserClubProfile {
  id: string;
  savedAt: string;
  managerName?: string;
  managerAvatar?: ManagerAvatarConfig;
}

export function normalizeManagerAvatar(
  avatar?: Partial<ManagerAvatarConfig> | null,
): ManagerAvatarConfig {
  return normalizeAvatarForGender(avatar);
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
  const normalizedName = profile.name.trim() || 'FC 유나이티드 드림';
  const normalizedShort =
    (profile.shortName.trim() || 'FUD').toUpperCase().slice(0, 4);

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

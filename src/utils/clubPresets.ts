import type { UserClubProfile } from '../types/game';

export const CLUB_PRESETS_STORAGE_KEY = 'pitch_manager_club_presets_v1';
export const MAX_CLUB_PRESETS = 6;

export interface ClubPreset extends UserClubProfile {
  id: string;
  savedAt: string;
}

export function loadClubPresets(): ClubPreset[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(CLUB_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ClubPreset =>
        Boolean(
          item &&
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.shortName === 'string' &&
            typeof item.primaryColor === 'string',
        ),
    );
  } catch {
    return [];
  }
}

export function saveClubPreset(profile: UserClubProfile): ClubPreset[] {
  const normalizedName = profile.name.trim() || 'FC 유나이티드 드림';
  const normalizedShort =
    (profile.shortName.trim() || 'FUD').toUpperCase().slice(0, 4);

  const existing = loadClubPresets();
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

import {
  Bookmark,
  Check,
  Palette,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { ModalBodyLock } from '../../hooks/useBodyScrollLock';
import type {
  ManagerAvatarConfig,
  ManagerGenderId,
  UserClubProfile,
} from '../../types/game';
import type { JerseyPattern } from '../../types/league';
import {
  type ClubPreset,
  deleteClubPreset,
  loadClubPresets,
  saveClubPreset,
} from '../../utils/clubPresets';
import { JerseySvg } from '../common/JerseySvg';
import {
  GENDER_OPTIONS,
  getHairStyleOptionsForGender,
  getOutfitOptionsForGender,
  HAIR_COLOR_OPTIONS,
  normalizeAvatarForGender,
  PixelManagerAvatar,
  SKIN_TONE_OPTIONS,
} from '../common/PixelManagerAvatar';

const PRIMARY_COLORS = [
  '#10b981',
  '#ef4444',
  '#2563eb',
  '#f59e0b',
  '#0ea5e9',
  '#f8fafc',
  '#1e293b',
  '#dc2626',
  '#7c3aed',
  '#ec4899',
];

const SECONDARY_COLORS = [
  '#0f172a',
  '#ffffff',
  '#fbbf24',
  '#10b981',
  '#ef4444',
  '#38bdf8',
  '#e2e8f0',
  '#1d4ed8',
];

const PATTERNS: { id: JerseyPattern; label: string }[] = [
  { id: 'solid', label: '솔리드' },
  { id: 'stripes', label: '세로줄' },
  { id: 'hoops', label: '가로줄' },
  { id: 'sash', label: '사선' },
  { id: 'half', label: '하프' },
];

interface MpProfileCustomizerModalProps {
  initialNickname: string;
  initialAvatar: ManagerAvatarConfig;
  initialClubProfile: UserClubProfile;
  onApply: (payload: {
    nickname: string;
    avatar: ManagerAvatarConfig;
    clubProfile: UserClubProfile;
  }) => void;
  onClose: () => void;
}

export function MpProfileCustomizerModal({
  initialNickname,
  initialAvatar,
  initialClubProfile,
  onApply,
  onClose,
}: MpProfileCustomizerModalProps) {
  const [nickname, setNickname] = useState<string>(initialNickname);
  const [avatar, setAvatar] = useState<ManagerAvatarConfig>(() =>
    normalizeAvatarForGender(initialAvatar),
  );
  const [clubProfile, setClubProfile] = useState<UserClubProfile>({
    ...initialClubProfile,
  });
  const [presets, setPresets] = useState<ClubPreset[]>(() => loadClubPresets());
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const activeGender: ManagerGenderId =
    avatar.gender === 'female' ? 'female' : 'male';
  const isBald = avatar.hairStyle === 'bald';
  const genderHairOptions = getHairStyleOptionsForGender(activeGender);
  const genderOutfitOptions = getOutfitOptionsForGender(activeGender);

  const handleGenderChange = (nextGender: ManagerGenderId) => {
    if (nextGender === activeGender) return;
    setAvatar((prev) => normalizeAvatarForGender(prev, nextGender));
  };

  const handleApplyPreset = (preset: ClubPreset) => {
    setClubProfile({
      name: preset.name,
      shortName: preset.shortName,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      pattern: preset.pattern,
    });
    if (preset.managerName) {
      setNickname(preset.managerName);
    }
    if (preset.managerAvatar) {
      setAvatar(normalizeAvatarForGender(preset.managerAvatar));
    }
    setSavedNotice(`'${preset.name}' 프리셋을 불러왔습니다.`);
    window.setTimeout(() => setSavedNotice(null), 2000);
  };

  const handleSaveAsPreset = () => {
    const cleanName = clubProfile.name.trim() || 'FC 유나이티드 드림';
    const cleanShort =
      (clubProfile.shortName.trim() || 'FUD').toUpperCase().slice(0, 4);
    const cleanManager = nickname.trim() || '감독';
    const nextClub: UserClubProfile = {
      ...clubProfile,
      name: cleanName,
      shortName: cleanShort,
    };
    setClubProfile(nextClub);
    setPresets(
      saveClubPreset(nextClub, {
        name: cleanManager,
        avatar,
      }),
    );
    setSavedNotice('프리셋으로 저장되었습니다.');
    window.setTimeout(() => setSavedNotice(null), 2000);
  };

  const handleDeletePreset = (id: string) => {
    setPresets(deleteClubPreset(id));
  };

  const handleConfirm = () => {
    const cleanName = clubProfile.name.trim() || 'FC 유나이티드 드림';
    const cleanShort =
      (clubProfile.shortName.trim() || 'FUD').toUpperCase().slice(0, 4);
    const cleanManager = nickname.trim() || '감독';
    const finalClub: UserClubProfile = {
      ...clubProfile,
      name: cleanName,
      shortName: cleanShort,
    };
    onApply({
      nickname: cleanManager,
      avatar,
      clubProfile: finalClub,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-2.5 sm:p-4">
      <ModalBodyLock />
      <div className="modal-panel flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131c] shadow-2xl">
        {/* Top Bar */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-[#0a0f17] px-4 py-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-extrabold text-white">
              감독 외형 · 유니폼 · 구단 커스텀
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-[#111822] p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 space-y-4">
          {/* Saved Presets Strip */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                <Bookmark className="h-3.5 w-3.5 text-emerald-400" />
                저장된 프리셋 불러오기 ({presets.length}/6)
              </div>
              <button
                type="button"
                onClick={handleSaveAsPreset}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
              >
                <Save className="h-3 w-3" />
                현재 설정 프리셋 저장
              </button>
            </div>

            {savedNotice && (
              <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/25 px-3 py-1.5 text-[11px] font-bold text-emerald-300">
                {savedNotice}
              </div>
            )}

            {presets.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {presets.map((preset) => {
                  const isCurrent =
                    clubProfile.name.trim().toLowerCase() ===
                      preset.name.trim().toLowerCase() &&
                    clubProfile.primaryColor === preset.primaryColor &&
                    clubProfile.pattern === preset.pattern;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleApplyPreset(preset);
                        }
                      }}
                      className={`group relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                        isCurrent
                          ? 'border-emerald-400 bg-emerald-500/12'
                          : 'border-slate-800 bg-[#111822] hover:border-slate-600'
                      }`}
                    >
                      {preset.managerAvatar ? (
                        <div className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-[#0b1018]">
                          <PixelManagerAvatar
                            avatar={preset.managerAvatar}
                            clubPrimaryColor={preset.primaryColor}
                            clubSecondaryColor={preset.secondaryColor}
                            size={26}
                          />
                        </div>
                      ) : null}
                      <JerseySvg
                        primaryColor={preset.primaryColor}
                        secondaryColor={preset.secondaryColor}
                        pattern={preset.pattern}
                        label={preset.shortName}
                        size={28}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-extrabold text-white">
                          {preset.name}
                        </div>
                        <div className="truncate text-[10px] text-slate-400">
                          {preset.managerName
                            ? `${preset.managerName} · ${preset.shortName}`
                            : preset.shortName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePreset(preset.id);
                        }}
                        className="rounded p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300 cursor-pointer"
                        title="프리셋 삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">
                저장된 프리셋이 없습니다. 아래에서 커스텀 후 프리셋으로 저장할 수 있습니다.
              </div>
            )}
          </div>

          {/* 2-Column Customizer: Left = Manager Avatar, Right = Club & Jersey */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Left: Manager Avatar & Nickname */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] p-4 space-y-3.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                <User className="h-3.5 w-3.5 text-emerald-400" />
                감독 캐릭터 &amp; 닉네임
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#090d14] p-3">
                <div className="flex h-20 w-18 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#111822]">
                  <PixelManagerAvatar
                    avatar={avatar}
                    clubPrimaryColor={clubProfile.primaryColor}
                    clubSecondaryColor={clubProfile.secondaryColor}
                    size={58}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label
                    htmlFor="mp-custom-nickname"
                    className="block text-[10px] font-bold text-slate-400"
                  >
                    감독 닉네임 (최대 14자)
                  </label>
                  <input
                    id="mp-custom-nickname"
                    type="text"
                    maxLength={14}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="감독 이름 입력"
                    className="w-full rounded-lg border border-slate-700 bg-[#111822] px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Gender */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400">성별</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleGenderChange(opt.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        activeGender === opt.id
                          ? 'border-emerald-400 bg-emerald-500/15 text-white'
                          : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {opt.id === 'male' ? '👨 남성 감독' : '👩 여성 감독'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skin Tone */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400">피부톤</div>
                <div className="flex flex-wrap gap-1.5">
                  {SKIN_TONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setAvatar((prev) => ({ ...prev, skinTone: opt.id }))
                      }
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                        avatar.skinTone === opt.id
                          ? 'border-emerald-400 bg-emerald-500/15 text-white'
                          : 'border-slate-800 bg-[#111822] text-slate-400'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/40"
                        style={{ backgroundColor: opt.base }}
                      />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hair Style */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-400">헤어스타일</span>
                  {isBald && (
                    <span className="font-bold text-amber-300">✨ 명장 광택</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {genderHairOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setAvatar((prev) => ({ ...prev, hairStyle: opt.id }))
                      }
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold cursor-pointer ${
                        avatar.hairStyle === opt.id
                          ? 'border-emerald-400 bg-emerald-500/15 text-white'
                          : 'border-slate-800 bg-[#111822] text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hair Color */}
              {!isBald && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400">머리색</div>
                  <div className="flex flex-wrap gap-1.5">
                    {HAIR_COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setAvatar((prev) => ({ ...prev, hairColor: opt.id }))
                        }
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                          avatar.hairColor === opt.id
                            ? 'border-emerald-400 bg-emerald-500/15 text-white'
                            : 'border-slate-800 bg-[#111822] text-slate-400'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-white/20"
                          style={{ backgroundColor: opt.base }}
                        />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Outfit & Glasses */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400">감독 의상</div>
                <div className="flex flex-wrap gap-1.5">
                  {genderOutfitOptions.map((opt) => {
                    const swatch = opt.usesTeamColor
                      ? clubProfile.primaryColor
                      : opt.previewColor;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setAvatar((prev) => ({ ...prev, outfit: opt.id }))
                        }
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                          avatar.outfit === opt.id
                            ? 'border-emerald-400 bg-emerald-500/15 text-white'
                            : 'border-slate-800 bg-[#111822] text-slate-400'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-sm border border-white/20"
                          style={{ backgroundColor: swatch }}
                        />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Club Name & Jersey Customizer */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] p-4 space-y-3.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                <Palette className="h-3.5 w-3.5 text-sky-400" />
                구단명 &amp; 유니폼 디자인
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#090d14] p-3">
                <div className="flex h-20 w-18 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#111822]">
                  <JerseySvg
                    primaryColor={clubProfile.primaryColor}
                    secondaryColor={clubProfile.secondaryColor}
                    pattern={clubProfile.pattern}
                    label={clubProfile.shortName}
                    size={54}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <label
                      htmlFor="mp-custom-club-name"
                      className="block text-[10px] font-bold text-slate-400 mb-0.5"
                    >
                      구단명 (최대 16자)
                    </label>
                    <input
                      id="mp-custom-club-name"
                      type="text"
                      maxLength={16}
                      value={clubProfile.name}
                      onChange={(e) =>
                        setClubProfile((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="예: FC 유나이티드"
                      className="w-full rounded-lg border border-slate-700 bg-[#111822] px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="mp-custom-club-short"
                      className="block text-[10px] font-bold text-slate-400 mb-0.5"
                    >
                      구단 약칭 (2~4자 영문/한글)
                    </label>
                    <input
                      id="mp-custom-club-short"
                      type="text"
                      maxLength={4}
                      value={clubProfile.shortName}
                      onChange={(e) =>
                        setClubProfile((prev) => ({
                          ...prev,
                          shortName: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="예: FUD"
                      className="w-24 rounded-lg border border-slate-700 bg-[#111822] px-2.5 py-1 text-xs font-mono font-bold text-white uppercase outline-none focus:border-sky-400"
                    />
                  </div>
                </div>
              </div>

              {/* Jersey Pattern */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400">
                  유니폼 패턴
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {PATTERNS.map((pat) => (
                    <button
                      key={pat.id}
                      type="button"
                      onClick={() =>
                        setClubProfile((prev) => ({ ...prev, pattern: pat.id }))
                      }
                      className={`rounded-lg border py-1.5 text-[11px] font-bold transition cursor-pointer ${
                        clubProfile.pattern === pat.id
                          ? 'border-sky-400 bg-sky-500/15 text-white'
                          : 'border-slate-800 bg-[#111822] text-slate-400'
                      }`}
                    >
                      {pat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Color */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400">
                  메인 컬러
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRIMARY_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() =>
                        setClubProfile((prev) => ({ ...prev, primaryColor: hex }))
                      }
                      className={`h-7 w-7 rounded-lg border-2 transition cursor-pointer ${
                        clubProfile.primaryColor === hex
                          ? 'border-white scale-110 shadow'
                          : 'border-slate-700 opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Secondary Color */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400">
                  보조 컬러
                </div>
                <div className="flex flex-wrap gap-2">
                  {SECONDARY_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() =>
                        setClubProfile((prev) => ({
                          ...prev,
                          secondaryColor: hex,
                        }))
                      }
                      className={`h-7 w-7 rounded-lg border-2 transition cursor-pointer ${
                        clubProfile.secondaryColor === hex
                          ? 'border-white scale-110 shadow'
                          : 'border-slate-700 opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-[#0a0f17] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-[#111822] px-4 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            취소
          </button>
          <button
            id="mp-apply-custom-profile-btn"
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            적용 완료
          </button>
        </div>
      </div>
    </div>
  );
}

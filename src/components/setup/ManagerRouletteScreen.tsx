import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  Crown,
  Dices,
  Flame,
  Shield,
  Sparkles,
  Target,
  User,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  MANAGER_TRAIT_LIST,
  MANAGER_TRAITS,
  type ManagerTraitCategory,
} from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type { ManagerGenderId, ManagerTraitId } from '../../types/game';
import { InfoHelpButton } from '../common/InfoHelpButton';
import {
  GENDER_OPTIONS,
  getHairStyleOptionsForGender,
  getOutfitOptionsForGender,
  HAIR_COLOR_OPTIONS,
  normalizeAvatarForGender,
  PixelManagerAvatar,
  SKIN_TONE_OPTIONS,
} from '../common/PixelManagerAvatar';

function TraitIcon({ traitId }: { traitId: ManagerTraitId }) {
  switch (traitId) {
    case 'tiki_taka':
    case 'midfield_maestro':
    case 'total_football':
      return <Sparkles className="h-4 w-4" />;
    case 'gegenpress_guru':
    case 'wing_bomber':
    case 'direct_football':
      return <Flame className="h-4 w-4" />;
    case 'catenaccio':
    case 'defensive_architect':
      return <Shield className="h-4 w-4" />;
    case 'big_game_hunter':
    case 'galactico_manager':
      return <Crown className="h-4 w-4" />;
    case 'set_piece_master':
    case 'underdog_killer':
      return <Target className="h-4 w-4" />;
    case 'halftime_wizard':
    case 'super_sub':
      return <Zap className="h-4 w-4" />;
    default:
      return <Award className="h-4 w-4" />;
  }
}

export function ManagerRouletteScreen() {
  const {
    state,
    updateManagerProfile,
    selectManagerTrait,
    spinManagerTrait,
    confirmManagerTrait,
    backToClubSetup,
    setDefaultTactic,
  } = useGame();

  const [traitFilter, setTraitFilter] = useState<'all' | ManagerTraitCategory>(
    'all',
  );
  const { name, traitId } = state.manager;
  const avatar = normalizeAvatarForGender(state.manager.avatar);
  const activeTrait = traitId ? MANAGER_TRAITS[traitId] : null;
  const builderCount = MANAGER_TRAIT_LIST.filter(
    (t) => t.category === 'builder',
  ).length;
  const specialistCount = MANAGER_TRAIT_LIST.filter(
    (t) => t.category === 'specialist',
  ).length;
  const filteredTraits =
    traitFilter === 'all'
      ? MANAGER_TRAIT_LIST
      : MANAGER_TRAIT_LIST.filter((t) => t.category === traitFilter);
  const activeGender: ManagerGenderId = avatar.gender === 'female' ? 'female' : 'male';
  const isBald = avatar.hairStyle === 'bald';
  const genderHairOptions = getHairStyleOptionsForGender(activeGender);
  const genderOutfitOptions = getOutfitOptionsForGender(activeGender);

  const synergyTacticDef = activeTrait?.synergyTactic
    ? TACTICS[activeTrait.synergyTactic]
    : null;

  const handleGenderChange = (nextGender: ManagerGenderId) => {
    if (nextGender === activeGender) return;
    const normalized = normalizeAvatarForGender(avatar, nextGender);
    updateManagerProfile({
      avatar: normalized,
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={backToClubSetup}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0e141d] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          1단계 구단·포메이션 설정
        </button>
        <span className="text-xs text-slate-400">
          {state.userClub.name} · {state.formation} · {TACTICS[state.defaultTactic].name}
        </span>
      </div>

      {/* Header */}
      <div className="text-center">
        <p className="text-[11px] font-bold tracking-[0.22em] text-emerald-400 uppercase">
          STEP 2 · MANAGER PROFILE &amp; SPECIALTY
        </p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-white">
          감독 캐릭터 &amp; 능력 선택
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
          나만의 감독 캐릭터를 꾸미고, 원하는 감독 강점(특성) 1가지를 직접 선택하세요.
        </p>
      </div>

      {/* Main 2-Column Workspace: Left = Pixel Avatar Customizer, Right = Direct Trait Selection Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Manager Name + 2-Head-Tall Pixel Avatar Customizer (Gender + Bald + 8 Hairstyles) */}
        <section className="lg:col-span-4 rounded-2xl border border-slate-800/90 bg-[#0e141d] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <User className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">감독 캐릭터 커스터마이징</h2>
          </div>

          {/* Live Sprite Stage + Name Input */}
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-800/80 bg-[#090e15] p-3.5">
            <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#121a26]">
              <PixelManagerAvatar
                avatar={avatar}
                clubPrimaryColor={state.userClub.primaryColor}
                clubSecondaryColor={state.userClub.secondaryColor}
                size={76}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <label
                htmlFor="manager-name-input"
                className="block text-[11px] font-semibold text-slate-400"
              >
                감독 이름 (최대 14자)
              </label>
              <input
                id="manager-name-input"
                type="text"
                maxLength={14}
                value={name}
                onChange={(e) =>
                  updateManagerProfile({ name: e.target.value })
                }
                placeholder="감독 이름을 입력하세요"
                className="w-full rounded-lg border border-slate-700 bg-[#111925] px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-400"
              />
              <p className="text-[10px] text-slate-500">
                프리셋·라커룸·결산·명예의 전당에 저장됩니다
              </p>
            </div>
          </div>

          {/* Gender Toggle (Male / Female) */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">성별</div>
            <div className="grid grid-cols-2 gap-1.5">
              {GENDER_OPTIONS.map((opt) => {
                const selected = activeGender === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleGenderChange(opt.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {opt.id === 'male' ? '👨 남성 감독' : '👩 여성 감독'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skin Tone */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">피부톤</div>
            <div className="flex flex-wrap gap-1.5">
              {SKIN_TONE_OPTIONS.map((opt) => {
                const selected = avatar.skinTone === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updateManagerProfile({ avatar: { skinTone: opt.id } })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-black/40"
                      style={{ backgroundColor: opt.base }}
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hair Style (Gender-exclusive presets) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-400">
                {activeGender === 'female' ? '여성 전용 헤어스타일' : '남성 전용 헤어스타일'}
              </span>
              {isBald && (
                <span className="text-[10px] font-bold text-amber-300">
                  ✨ 명장 광택 적용
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {genderHairOptions.map((opt) => {
                const selected = avatar.hairStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updateManagerProfile({ avatar: { hairStyle: opt.id } })
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hair Color (hidden when Bald is selected!) */}
          {!isBald && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400">머리색</div>
              <div className="flex flex-wrap gap-1.5">
                {HAIR_COLOR_OPTIONS.map((opt) => {
                  const selected = avatar.hairColor === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        updateManagerProfile({ avatar: { hairColor: opt.id } })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                        selected
                          ? 'border-emerald-400 bg-emerald-500/15 text-white'
                          : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: opt.base }}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manager Outfit (Gender-exclusive coordinates) */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">
              {activeGender === 'female' ? '여성 전용 감독 의상' : '남성 전용 감독 의상'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {genderOutfitOptions.map((opt) => {
                const selected = avatar.outfit === opt.id;
                const swatch = opt.usesTeamColor
                  ? state.userClub.primaryColor
                  : opt.previewColor;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updateManagerProfile({ avatar: { outfit: opt.id } })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-sm border border-white/20"
                      style={{ backgroundColor: swatch }}
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Direct Selection Grid for All 14 Manager Traits */}
        <section className="lg:col-span-8 flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0e141d] p-5 space-y-4">
          {/* Header + Category Filter + Optional Small Random Pick Button */}
          <div className="space-y-2.5 border-b border-slate-800/80 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-white">
                  감독 능력(강점) 직접 선택 ({MANAGER_TRAIT_LIST.length}종)
                </h2>
                <InfoHelpButton
                  title="감독 특성 · 궁합 규칙"
                  align="left"
                  guideTab="squad"
                  items={[
                    '빌드업·전술형(8종): 궁합 선수 1~11명 수에 따라 팀 A/M/D 점진 강화 + ★추천 전술 시 추가 보너스',
                    '스페셜리스트(6종): 포지션 유연성·하프타임 전환·후반 조커·빅매치·언더독·세트피스 특화',
                    '★ 감독 궁합: 스타일·조건 일치 선수 전원에게 인접 시너지(+3)와 별개로 개인 +1 OVR (최대 +4)',
                  ]}
                />
              </div>
              <button
                id="spin-manager-btn"
                type="button"
                onClick={spinManagerTrait}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#121a26] px-3 py-1.5 text-xs font-bold text-amber-300 hover:border-amber-400/60 hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                <Dices className="h-3.5 w-3.5" />
                🎲 랜덤 선택
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['all', `전체 ${MANAGER_TRAIT_LIST.length}`],
                  ['builder', `빌드업·전술형 ${builderCount}`],
                  ['specialist', `스페셜리스트 ${specialistCount}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTraitFilter(key)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    traitFilter === key
                      ? 'border-emerald-400/60 bg-slate-800 text-white'
                      : 'border-slate-800 bg-[#0a1018] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 14-Trait Direct Selection Card Grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 max-h-[470px] overflow-y-auto pr-1">
            {filteredTraits.map((t) => {
              const selected = traitId === t.id;
              const synTactic = t.synergyTactic ? TACTICS[t.synergyTactic] : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectManagerTrait(t.id)}
                  className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer break-keep ${
                    selected
                      ? 'border-emerald-400 bg-emerald-950/30 shadow-md shadow-emerald-500/10'
                      : 'border-slate-800 bg-[#0a1018] hover:border-slate-600 hover:bg-[#101824]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-950"
                          style={{ backgroundColor: t.badgeColor }}
                        >
                          <TraitIcon traitId={t.id} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-white truncate">
                              {t.name}
                            </span>
                            {selected && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-400 px-1.5 py-px text-[9px] font-black text-slate-950 whitespace-nowrap">
                                <Check className="h-2.5 w-2.5" />
                                선택됨
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {t.tagline}
                          </div>
                        </div>
                      </div>
                      {synTactic ? (
                        <span className="shrink-0 rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300 whitespace-nowrap">
                          ★ {synTactic.shortName} · 1~{t.philosophyTarget}명
                        </span>
                      ) : (
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[9.5px] font-semibold whitespace-nowrap ${
                            t.philosophyTarget > 0
                              ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                              : 'border-sky-400/30 bg-sky-500/10 text-sky-200'
                          }`}
                        >
                          {t.philosophyTarget > 0
                            ? `1~${t.philosophyTarget}명 비례`
                            : '팀 효과 인원 무관'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      {t.effectSummary}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Trait Sticky Footer + Compatible Playstyles + CTA */}
          <div className="rounded-xl border border-slate-800 bg-[#090e15] p-4 space-y-3">
            {activeTrait ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-black text-slate-950 whitespace-nowrap"
                      style={{ backgroundColor: activeTrait.badgeColor }}
                    >
                      선택한 능력
                    </span>
                    <span className="text-sm font-extrabold text-white">
                      {activeTrait.name}
                    </span>
                    {synergyTacticDef &&
                      activeTrait.synergyTactic &&
                      activeTrait.synergyTactic !== state.defaultTactic && (
                        <button
                          type="button"
                          onClick={() =>
                            setDefaultTactic(activeTrait.synergyTactic!)
                          }
                          className="rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer whitespace-nowrap"
                        >
                          추천 전술({synergyTacticDef.shortName}) 즉시 적용
                        </button>
                      )}
                  </div>
                  <p className="text-xs text-slate-400 break-keep">
                    {activeTrait.effectSummary}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[10px] font-bold text-amber-300/90 mr-0.5 whitespace-nowrap">
                      ★ 궁합(+1):
                    </span>
                    {activeTrait.synergyPlaystyles.map((ps) => (
                      <span
                        key={ps}
                        className="rounded border border-slate-700/90 bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200 whitespace-nowrap"
                      >
                        {PLAYSTYLES[ps]?.shortName ?? ps}
                      </span>
                    ))}
                    {activeTrait.id === 'galactico_manager' && (
                      <span className="rounded border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 whitespace-nowrap">
                        OVR 88+ · 레전드
                      </span>
                    )}
                    {activeTrait.id === 'total_football' && (
                      <span className="rounded border border-cyan-400/35 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200 whitespace-nowrap">
                        3포지션+ 멀티
                      </span>
                    )}
                    {activeTrait.id === 'super_sub' && (
                      <span className="rounded border border-pink-400/35 bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-pink-200 whitespace-nowrap">
                        STA 86+
                      </span>
                    )}
                  </div>
                </div>

                <button
                  id="confirm-manager-btn"
                  type="button"
                  onClick={confirmManagerTrait}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors cursor-pointer"
                >
                  <span>16인 드래프트 시작</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>
                  위 카드 중 원하는 감독 능력을 1가지 선택하거나 우측 상단{' '}
                  <strong className="text-amber-300">[🎲 랜덤 선택]</strong>을 눌러주세요.
                </span>
                <button
                  type="button"
                  disabled
                  className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-500 cursor-not-allowed"
                >
                  능력을 먼저 선택하세요
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

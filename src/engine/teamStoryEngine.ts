import {
  evaluateManagerPlayerSynergy,
  MANAGER_TRAITS,
} from '../data/managerTraits';
import type { DomesticCupState } from '../types/cup';
import type {
  FormationId,
  ManagerTraitId,
  SeasonStoryCrisisLog,
  StaffCoachId,
  TacticalAdaptationState,
  TradeHistoryRecord,
} from '../types/game';
import type {
  Club,
  Fixture,
  LeagueId,
  MatchResult,
  PlayerSeasonStats,
  StandingRow,
  TacticId,
} from '../types/league';
import type {
  GlobalHofRankingEntry,
  HallOfFameEntry,
  TeamSeasonStory,
  TeamStoryHighlight,
} from '../types/legacy';
import { formatPlayerRecordName } from '../types/player';
import type { Player } from '../types/player';
import type { UclTournamentState } from '../types/ucl';
import { USER_CLUB_ID } from './matchEngine';
import { STAFF_COACHES } from './staffCoachEngine';
import { TACTICS } from './tacticEngine';

// =============================================================================
// Korean Josa (조사) & Deterministic Prose Helpers
// =============================================================================

function getLastMeaningfulChar(word: string): string {
  const cleaned = word.replace(/[\s)\]}"'.,!?~·]+$/g, '');
  return cleaned.length > 0 ? cleaned[cleaned.length - 1] : '';
}

function getBatchimKind(word: string): 'none' | 'rieul' | 'other' {
  const ch = getLastMeaningfulChar(word);
  if (!ch) return 'none';
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    if (jong === 0) return 'none';
    if (jong === 8) return 'rieul';
    return 'other';
  }
  if (ch >= '0' && ch <= '9') {
    if (ch === '1' || ch === '7' || ch === '8') return 'rieul';
    if (ch === '0' || ch === '3' || ch === '6') return 'other';
    return 'none';
  }
  if (/[lL]/.test(ch)) return 'rieul';
  if (/[mnrkgptbMNRKGPTB]/.test(ch)) return 'other';
  return 'none';
}

/** Attaches grammatically natural Korean particle to `word`. */
export function josa(
  word: string,
  pair: '이/가' | '은/는' | '을/를' | '와/과' | '으로/로',
): string {
  const kind = getBatchimKind(word);
  switch (pair) {
    case '이/가':
      return `${word}${kind === 'none' ? '가' : '이'}`;
    case '은/는':
      return `${word}${kind === 'none' ? '는' : '은'}`;
    case '을/를':
      return `${word}${kind === 'none' ? '를' : '을'}`;
    case '와/과':
      return `${word}${kind === 'none' ? '와' : '과'}`;
    case '으로/로':
      return `${word}${kind === 'none' || kind === 'rieul' ? '로' : '으로'}`;
  }
}

function joinPair(a: string, b: string): string {
  return `${josa(a, '와/과')} ${b}`;
}

function stableHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickVariant<T>(items: readonly T[], seed: string): T {
  return items[stableHash(seed) % items.length];
}

function getTeamDisplayName(
  teamId: string,
  clubsById: Record<string, Club>,
  userClubName: string,
): string {
  if (teamId === USER_CLUB_ID) return userClubName;
  return clubsById[teamId]?.name ?? teamId;
}

const TRAIT_PROSE: Record<
  ManagerTraitId,
  { style: string; noun: string; vibe: string }
> = {
  tiki_taka: {
    style: '정교한 삼각 패스로 경기를 쥐는 점유 축구',
    noun: '티키타카 설계',
    vibe: '촘촘한 패스 연결로 상대의 숨을 조인',
  },
  gegenpress_guru: {
    style: '상대 진영부터 거세게 몰아치는 전방 압박',
    noun: '게겐프레싱',
    vibe: '높은 라인에서 쉼 없이 압박을 건',
  },
  catenaccio: {
    style: '빈틈없는 빗장 수비와 날카로운 한 방 역습',
    noun: '카테나치오',
    vibe: '단단한 수비 블록 뒤에 매서운 카운터를 감춘',
  },
  wing_bomber: {
    style: '양 측면을 집요하게 가르는 측면 전개',
    noun: '측면 공략',
    vibe: '터치라인과 하프스페이스를 쉴 새 없이 흔든',
  },
  halftime_wizard: {
    style: '하프타임마다 경기 흐름을 뒤집는 용병술',
    noun: '후반 수정 능력',
    vibe: '라커룸 조율 하나로 경기 판도를 바꾸곤 했던',
  },
  big_game_hunter: {
    style: '강호와의 정면 승부에서 더 빛나는 승부사 기질',
    noun: '빅게임 감각',
    vibe: '큰 무대일수록 과감하게 맞받아친',
  },
  set_piece_master: {
    style: '코너킥과 프리킥 디테일로 균형을 깨는 세트피스 전술',
    noun: '세트피스 설계',
    vibe: '데드볼 상황마다 상대를 위협한',
  },
  underdog_killer: {
    style: '강팀의 빈틈을 파고드는 자이언트 킬러 기질',
    noun: '거인 사냥 전술',
    vibe: '체급 차를 아랑곳하지 않고 맞선',
  },
  total_football: {
    style: '포지션 경계를 허무는 유연한 스위칭',
    noun: '토탈 풋볼',
    vibe: '전원이 유기적으로 자리를 바꿔가며 상대를 흔든',
  },
  galactico_manager: {
    style: '화려한 스타들을 하나의 승리 공식으로 묶는 지휘력',
    noun: '갈락티코 운영',
    vibe: '개성 강한 스타 군단의 균형을 잡아낸',
  },
  direct_football: {
    style: '군더더기 없는 종패스와 매서운 직선 마무리',
    noun: '다이렉트 풋볼',
    vibe: '간결한 전진 패스로 상대 뒷공간을 노린',
  },
  defensive_architect: {
    style: '치밀한 간격 유지로 실점을 봉쇄하는 수비 건축',
    noun: '수비 조직력',
    vibe: '쉽게 골문을 허락하지 않은 질식 수비의',
  },
  midfield_maestro: {
    style: '허리 싸움을 완전히 장악하는 중원 지배력',
    noun: '중원 장악력',
    vibe: '경기 템포를 자유자재로 조율한',
  },
  super_sub: {
    style: '후반 승부처마다 교체 카드로 판을 흔드는 벤치 활용',
    noun: '조커 용병술',
    vibe: '교체 투입으로 후반 흐름을 틀어쥔',
  },
};

const TACTIC_PROSE: Record<TacticId, { phrase: string; flavor: string }> = {
  possession: {
    phrase: '점유율 축구',
    flavor: '높은 볼 점유와 촘촘한 패스 전개',
  },
  gegenpressing: {
    phrase: '전방 압박',
    flavor: '높은 라인에서 볼을 탈취해 몰아치는 템포',
  },
  counter: {
    phrase: '선수비 후역습',
    flavor: '견고한 수비 블록과 빠른 역습 전환',
  },
  wingplay: {
    phrase: '측면 공략',
    flavor: '폭넓은 측면 침투와 예리한 크로스',
  },
  balanced: {
    phrase: '공수 밸런스',
    flavor: '상황에 맞춰 템포를 조절하는 노련한 균형감',
  },
};

const COACH_PROSE: Record<StaffCoachId, string> = {
  tactic_possession: '패스 전개의 결을 한층 매끄럽게 다듬어준',
  tactic_gegenpressing: '전방 압박의 타이밍과 강도를 끌어올린',
  tactic_counter: '역습 전환 속도와 수비 간격을 정밀하게 가다듬은',
  tactic_wingplay: '측면 오버래핑과 크로스 완성도를 높여준',
  tactic_balanced: '공수 전환의 균형추를 안정적으로 잡아준',
  line_attack: '문전 결정력과 공격 패턴에 날을 세워준',
  line_midfield: '중원 장악과 볼 순환에 숨결을 불어넣은',
  line_defense: '최후방 수비 라인의 집중력과 간격을 탄탄히 묶어준',
  sys_tactical_mastery: '상대의 전술 대응을 한 수 앞서 무력화한',
  sys_locker_room: '라커룸 결속력과 경기장 사기를 단단히 끌어올린',
  sys_supersub_phys: '후반 교체 승부와 체력 관리로 뒷심을 살려낸',
  sys_potential_dev: '숨은 원석들의 잠재력을 실전에서 깨워낸',
};

// =============================================================================
// Expressive, Multi-Focus Compact Team Intro Engine (Task 2)
// =============================================================================

export interface CompactTeamIntroInput {
  clubName: string;
  managerName?: string;
  managerTraitId: ManagerTraitId | null;
  managerRating?: number;
  staffCoachId?: StaffCoachId | null;
  formation: FormationId;
  tactic: TacticId;
  baseAvgOvr: number;
  effectiveOvr?: number;
  chemistry: number;
  awakenedCount?: number;
  classicCount?: number;
  ffpTier?: 0 | 1 | 2;
  // Optional rich seasonal narrative context
  leagueName?: string;
  finalRank?: number;
  expectedRank?: number;
  leaguePoints?: number;
  leaguePlayed?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  losses?: number;
  cupWon?: boolean;
  cupName?: string;
  uclWon?: boolean;
  uclResultLabel?: string;
  isTreble?: boolean;
  aceName?: string;
  aceGoals?: number;
  aceAssists?: number;
  awakenedNames?: string[];
  classicNames?: string[];
  defAnchorName?: string;
  // v9.7 Expanded focus axes (duo/trio, midfield, defense line, rotation, manager fit, crisis rebound)
  attackDuoNames?: string[];
  midfieldAxisNames?: string[];
  defenseLineNames?: string[];
  trioNames?: string[];
  rotationBenchContributors?: number;
  managerSynergyCount?: number;
  hasCrisisRebound?: boolean;
}

type IntroFocusArchetype =
  | 'underdog_rebellion'
  | 'awakening_corps'
  | 'ffp_defiance'
  | 'classic_modern_harmony'
  | 'iron_defense'
  | 'explosive_firepower'
  | 'tactical_identity'
  | 'spine_duo_trio'
  | 'balanced_ace';

function buildFinaleSentence(
  input: CompactTeamIntroInput,
  isUnbeatenChamp: boolean,
  seed: string,
): string {
  const league = input.leagueName ?? '리그';
  const cup = input.cupName ?? '자국 컵';
  if (input.isTreble) {
    return pickVariant(
      [
        `${league}·${cup}·챔피언스리그 3관왕까지 모두 품으며 구단 최고의 시즌을 완성했다.`,
        `국내 2관왕에 유럽 정상까지 보탠 트레블로 시즌의 마지막 페이지를 장식했다.`,
        `${league}와 ${cup}, 빅이어를 한 시즌에 쓸어 담으며 완벽한 결실을 맺었다.`,
      ],
      `${seed}:fin:treble`,
    );
  }
  if (isUnbeatenChamp) {
    return pickVariant(
      [
        `단 한 번의 패배도 허용하지 않은 무패 질주로 ${league} 정상에 올랐다.`,
        `시즌 끝까지 패배를 잊은 채 ${league} 무패 우승이라는 값진 기록을 남겼다.`,
      ],
      `${seed}:fin:unbeaten`,
    );
  }
  if (input.uclWon && input.finalRank === 1) {
    return pickVariant(
      [
        `${league} 제패와 유럽 챔피언스리그 우승을 동시에 거두며 최고의 한 해를 보냈다.`,
        `자국 리그와 유럽 정상까지 두 마리 토끼를 모두 잡은 완벽한 더블 시즌이었다.`,
      ],
      `${seed}:fin:lg_ucl`,
    );
  }
  if (input.uclWon) {
    return pickVariant(
      [
        `유럽 강호들을 연파하고 빅이어를 들어 올리며 잊지 못할 밤을 남겼다.`,
        `리그의 아쉬움을 유럽 무대 정상 등극으로 깨끗이 털어냈다.`,
      ],
      `${seed}:fin:ucl`,
    );
  }
  if (input.finalRank === 1 && input.cupWon) {
    return pickVariant(
      [
        `${league}와 ${cup}을 함께 거머쥔 더블 우승으로 탄탄한 결실을 맺었다.`,
        `리그 정상에 ${cup} 트로피까지 더하며 국내 무대를 완전히 지배했다.`,
      ],
      `${seed}:fin:double`,
    );
  }
  if (input.finalRank === 1) {
    return pickVariant(
      [
        `긴 레이스 끝에 ${league} 트로피를 들어 올리며 시즌의 주인공이 됐다.`,
        `흔들리지 않는 뒷심으로 끝내 ${league} 정상을 차지했다.`,
      ],
      `${seed}:fin:league`,
    );
  }
  if (input.cupWon) {
    return pickVariant(
      [
        `${cup} 정상에 오르며 값진 트로피와 함께 시즌을 마쳤다.`,
        `치열한 토너먼트 끝에 ${cup} 우승컵을 들어 올리며 팀의 저력을 증명했다.`,
      ],
      `${seed}:fin:cup`,
    );
  }
  if (input.hasCrisisRebound) {
    return pickVariant(
      [
        `시즌 중 고비를 딛고 반등에 성공하며 다음을 기대하게 만든 한 해였다.`,
        `흔들리던 시기를 이겨낸 뒷심이 팀의 색깔을 한층 단단하게 만들었다.`,
      ],
      `${seed}:fin:rebound`,
    );
  }
  if ((input.finalRank ?? 99) <= 4) {
    return pickVariant(
      [
        `${league} ${input.finalRank}위로 상위권 경쟁을 완주하며 유럽 무대 자격을 증명했다.`,
        `시즌 내내 상위권 흐름을 지키며 ${league} ${input.finalRank}위로 여정을 마무리했다.`,
      ],
      `${seed}:fin:top4`,
    );
  }
  if (input.ffpTier === 0 && input.chemistry >= 86) {
    return pickVariant(
      [
        `건전한 재정과 탄탄한 결속력 속에서 꾸준히 자기 색깔을 지켜냈다.`,
        `무리한 투자 없이도 단단한 팀워크로 경쟁력을 보여준 시즌이었다.`,
      ],
      `${seed}:fin:clean`,
    );
  }
  return '';
}

/**
 * Generates a natural, non-repetitive 1~2 sentence football-column team description.
 * Diversifies narrative focus across:
 * - Underdog rebellion / Awakening corps / FFP defiance / Classic+Modern harmony
 * - Iron defense / Explosive firepower
 * - Pure Team & Manager/Coach/Chemistry/Rotation identity (zero player names!)
 * - Attack duo / Midfield axis / Defense line / 3-man spine trio
 * - Single ace (only when warranted)
 */
export function generateCompactTeamIntro(input: CompactTeamIntroInput): string {
  const seed = [
    input.clubName,
    input.formation,
    input.tactic,
    input.managerTraitId ?? 'none',
    input.staffCoachId ?? 'none',
    input.finalRank ?? 0,
    input.leaguePoints ?? 0,
    input.goalsFor ?? 0,
    input.goalsAgainst ?? 0,
    input.chemistry,
    input.awakenedCount ?? 0,
    input.classicCount ?? 0,
    input.ffpTier ?? 0,
  ].join('|');

  const traitInfo = input.managerTraitId ? TRAIT_PROSE[input.managerTraitId] : null;
  const traitName = input.managerTraitId
    ? MANAGER_TRAITS[input.managerTraitId]?.name ?? null
    : null;
  const tacticInfo = TACTIC_PROSE[input.tactic] ?? {
    phrase: TACTICS[input.tactic]?.name ?? input.tactic,
    flavor: '안정적인 경기 운영',
  };
  const coach = input.staffCoachId ? STAFF_COACHES[input.staffCoachId] : null;
  const played = Math.max(1, input.leaguePlayed ?? 38);
  const gfPerGame = typeof input.goalsFor === 'number' ? input.goalsFor / played : null;
  const gaPerGame = typeof input.goalsAgainst === 'number' ? input.goalsAgainst / played : null;
  const rankDelta =
    typeof input.expectedRank === 'number' && typeof input.finalRank === 'number'
      ? input.expectedRank - input.finalRank
      : 0;
  const effLift =
    typeof input.effectiveOvr === 'number'
      ? input.effectiveOvr - input.baseAvgOvr
      : 0;

  const isUnderdogRebellion =
    rankDelta >= 3 && (input.finalRank ?? 99) <= 6;
  const isIronDefense =
    (gaPerGame !== null && gaPerGame <= 0.75) ||
    input.managerTraitId === 'defensive_architect' ||
    input.managerTraitId === 'catenaccio';
  const isExplosiveAttack = gfPerGame !== null && gfPerGame >= 2.25;
  const isUnbeatenChamp =
    input.finalRank === 1 && input.losses === 0 && (input.leaguePlayed ?? 0) >= 30;
  const isFfpDefiance =
    (input.ffpTier ?? 0) >= 1 &&
    ((input.finalRank ?? 99) <= 4 || Boolean(input.cupWon) || Boolean(input.uclWon));
  const hasStrongRotation = (input.rotationBenchContributors ?? 0) >= 3;
  const hasHighTacticalIdentity =
    input.chemistry >= 84 ||
    effLift >= 1.8 ||
    (input.managerSynergyCount ?? 0) >= 6 ||
    Boolean(coach) ||
    hasStrongRotation;

  const attackDuo = (input.attackDuoNames ?? []).filter(Boolean).slice(0, 2);
  const midfieldAxis = (input.midfieldAxisNames ?? []).filter(Boolean).slice(0, 2);
  const defenseLine = (input.defenseLineNames ?? []).filter(Boolean).slice(0, 2);
  const trio = (input.trioNames ?? []).filter(Boolean).slice(0, 3);
  const awakenedNames = (input.awakenedNames ?? []).filter(Boolean);
  const classicNames = (input.classicNames ?? []).filter(Boolean);
  const defAnchor = input.defAnchorName?.trim();
  const aceName = input.aceName?.trim();

  // Build weighted candidate archetypes grounded in actual season profile
  const candidates: IntroFocusArchetype[] = [];

  if (isUnderdogRebellion) {
    candidates.push('underdog_rebellion', 'underdog_rebellion');
  }
  if (isIronDefense) {
    candidates.push('iron_defense', 'iron_defense');
  }
  if ((input.awakenedCount ?? 0) >= 2) {
    candidates.push('awakening_corps', 'awakening_corps');
  } else if ((input.awakenedCount ?? 0) === 1 && !isUnderdogRebellion && !isIronDefense) {
    candidates.push('awakening_corps');
  }
  if (isFfpDefiance) {
    candidates.push('ffp_defiance');
  }
  if ((input.classicCount ?? 0) >= 1 && !isUnderdogRebellion && !isIronDefense) {
    candidates.push('classic_modern_harmony');
  }
  if (isExplosiveAttack) {
    candidates.push('explosive_firepower', 'explosive_firepower');
  }
  if (hasHighTacticalIdentity) {
    // Player-name-free team/manager/coach/chemistry/rotation identity focus!
    candidates.push('tactical_identity', 'tactical_identity');
  }
  if (attackDuo.length >= 2 || midfieldAxis.length >= 2 || defenseLine.length >= 2 || trio.length >= 3) {
    candidates.push('spine_duo_trio', 'spine_duo_trio');
  }
  if (aceName && candidates.length === 0) {
    candidates.push('balanced_ace');
  } else if (aceName && (input.aceGoals ?? 0) >= 22) {
    candidates.push('balanced_ace');
  }
  if (candidates.length === 0) {
    candidates.push('tactical_identity');
  }

  // Strong signature seasons (underdog rebellion / iron defense) keep priority when clearly defining
  let chosen: IntroFocusArchetype;
  if (isUnderdogRebellion) {
    chosen = 'underdog_rebellion';
  } else if (isIronDefense && (gaPerGame !== null && gaPerGame <= 0.72 || input.managerTraitId === 'defensive_architect')) {
    chosen = 'iron_defense';
  } else {
    chosen = pickVariant(candidates, `${seed}:archetype`);
  }

  const coachTag =
    coach && input.staffCoachId
      ? `${COACH_PROSE[input.staffCoachId]} ${coach.name} 수석 코치`
      : null;
  const mgrLead =
    input.managerName && traitInfo
      ? `${input.managerName} 감독의 ${traitInfo.noun}`
      : traitInfo
        ? traitInfo.style
        : traitName
          ? `${traitName} 철학`
          : input.managerName
            ? `${input.managerName} 감독의 지휘`
            : '탄탄한 전술 설계';

  const finale = buildFinaleSentence(input, isUnbeatenChamp, seed);

  // --- Compose Sentence 1 & Sentence 2 by chosen focus archetype ---
  let s1 = '';
  let s2 = '';

  switch (chosen) {
    case 'underdog_rebellion': {
      const rankPhrase =
        input.finalRank === 1
          ? `${input.leagueName ? `${input.leagueName} ` : ''}정상까지 훔쳐낸 반란의 주인공이다`
          : `${input.leagueName ? `${input.leagueName} ` : ''}${input.finalRank}위까지 치고 오른 통쾌한 반란의 팀이다`;
      s1 = pickVariant(
        [
          `개막 전 예상 ${input.expectedRank}위라는 저평가를 뒤집고, ${input.formation} ${tacticInfo.phrase}에 ${traitInfo ? josa(traitInfo.style, '을/를') : '끈끈한 조직력'} 녹여내며 ${rankPhrase}.`,
          `객관적 전력의 열세를 ${input.formation} 대형의 응집력과 ${tacticInfo.flavor}로 깨부수며 끝내 ${rankPhrase}.`,
          `누구도 우승 후보로 꼽지 않았지만, ${input.formation} ${tacticInfo.phrase} 아래 똘똘 뭉친 팀워크로 예상을 비웃으며 ${rankPhrase}.`,
          `화려한 이름값 대신 ${input.formation} ${tacticInfo.phrase}의 조직력으로 정면 돌파해, 개막 전 예상 ${input.expectedRank}위를 딛고 ${rankPhrase}.`,
        ],
        `${seed}:s1:underdog`,
      );
      if ((input.awakenedCount ?? 0) > 0) {
        const awkLead =
          awakenedNames.length >= 2
            ? `${joinPair(awakenedNames[0], awakenedNames[1])} 등 ${input.awakenedCount}명의 각성이 반란의 엔진이 됐고`
            : awakenedNames[0]
              ? `시즌 중 잠재력을 깨운 ${awakenedNames[0]}의 각성이 팀의 한계를 끌어올렸고`
              : `${input.awakenedCount}명의 포텐 각성이 결정적 추동력이 됐고`;
        s2 = finale
          ? `${awkLead}, ${finale}`
          : `${awkLead} ${coachTag ? `${coachTag}의 조율까지 더해져` : '시즌 내내'} 거침없는 돌풍을 이어갔다.`;
      } else if (coachTag && finale) {
        s2 = `${coachTag}의 조율까지 맞물리며 ${finale}`;
      } else {
        s2 = finale;
      }
      break;
    }

    case 'iron_defense': {
      const defUnit =
        defenseLine.length >= 2
          ? `${joinPair(defenseLine[0], defenseLine[1])} 중심의 철벽 수비 라인`
          : defAnchor
            ? `${josa(defAnchor, '을/를')} 축으로 세운 단단한 수비진`
            : '빈틈없는 수비 블록';
      const gaNote =
        typeof input.goalsAgainst === 'number' && gaPerGame !== null && gaPerGame <= 0.78
          ? `리그 ${input.goalsAgainst}실점의 짠물 수비로 상대 공격을 꽁꽁 묶었다`
          : `${traitInfo ? `${traitInfo.vibe} ` : ''}견고한 간격 유지로 좀처럼 틈을 내주지 않았다`;
      s1 = pickVariant(
        [
          `${defUnit} 위에 ${input.formation} ${tacticInfo.phrase}을 정교하게 얹어, ${gaNote}.`,
          `${input.formation} 대형 속에서 ${josa(defUnit, '이/가')} 흔들림 없이 버텨내며 ${gaNote}.`,
          `실점을 허락하지 않는 조직력이 가장 큰 무기였던 팀으로, ${defUnit}과 ${tacticInfo.phrase}으로 ${gaNote}.`,
          `먼저 잠그고 날카롭게 찌르는 실리 축구 속에 ${josa(defUnit, '이/가')} 빛나며 ${gaNote}.`,
        ],
        `${seed}:s1:defense`,
      );
      if (coachTag && finale) {
        s2 = `${coachTag}까지 가세한 안정감 속에 ${finale}`;
      } else if (finale) {
        s2 = finale;
      } else if (coachTag) {
        s2 = `후반기 합류한 ${coachTag}의 디테일이 수비 완성도를 한 단계 더 끌어올렸다.`;
      }
      break;
    }

    case 'awakening_corps': {
      const awkCount = input.awakenedCount ?? awakenedNames.length;
      const awkSubject =
        awakenedNames.length >= 2
          ? `${joinPair(awakenedNames[0], awakenedNames[1])}${awkCount > 2 ? ` 등 ${awkCount}인` : ''}`
          : awakenedNames[0]
            ? awakenedNames[0]
            : `${awkCount}명의 숨은 원석`;
      s1 = pickVariant(
        [
          `${input.formation} ${tacticInfo.phrase} 속에서 잠재력을 터뜨린 ${josa(awkSubject, '이/가')} 팀의 체급을 통째로 바꿔놓은 포텐 각성 군단이다.`,
          `기존 평가의 한계를 깨부순 ${awkSubject}의 각성이 ${input.formation} 전술과 맞물리며 매 라운드 폭발력을 키운 팀이다.`,
          `원석을 실전 에이스로 키워낸 육성의 승리였다 — ${josa(awkSubject, '이/가')} 각성하며 ${tacticInfo.flavor}에 날카로움을 더했다.`,
          `${josa(mgrLead, '을/를')} 바탕으로 ${awkSubject}의 포텐을 깨워내며 시즌 중반부터 완전히 다른 차원의 팀으로 변모했다.`,
        ],
        `${seed}:s1:awakening`,
      );
      if (coachTag && finale) {
        s2 = `${coachTag}의 지원 속에 ${finale}`;
      } else {
        s2 = finale || (coachTag ? `${coachTag}의 조율까지 더해져 탄탄한 성장 곡선을 그렸다.` : '');
      }
      break;
    }

    case 'ffp_defiance': {
      const ffpLabel = input.ffpTier === 2 ? 'FFP 2단계 영입 동결' : 'FFP 제재';
      s1 = pickVariant(
        [
          `${ffpLabel}라는 불리한 조건을 ${input.formation} ${tacticInfo.phrase}과 내부 결속력으로 정면 돌파한 뚝심의 팀이다.`,
          `이적시장 제약과 페널티를 떠안고도 흔들리지 않았고, ${josa(mgrLead, '으로/로')} 기존 자원의 최대치를 끌어냈다.`,
          `${ffpLabel}의 압박 속에서도 ${input.formation} 대형의 완성도를 지켜내며 외부의 우려를 실력으로 잠재웠다.`,
          `보강이 막힌 악조건이 오히려 팀을 단단하게 묶었고, ${tacticInfo.flavor}로 끝까지 상위권 경쟁을 버텨냈다.`,
        ],
        `${seed}:s1:ffp`,
      );
      s2 = finale || (coachTag ? `중반 합류한 ${coachTag}의 보탬으로 제약 속에서도 균형을 잃지 않았다.` : '');
      break;
    }

    case 'classic_modern_harmony': {
      const clsLead =
        classicNames.length >= 2
          ? `${joinPair(classicNames[0], classicNames[1])}`
          : classicNames[0]
            ? `클래식 ${classicNames[0]}`
            : `시대의 전설 ${input.classicCount}인`;
      const modernPartner =
        awakenedNames[0] ??
        attackDuo.find((n) => !classicNames.includes(n)) ??
        midfieldAxis.find((n) => !classicNames.includes(n));
      const bridgePhrase = modernPartner
        ? `${josa(clsLead, '와/과')} 현역 주축 ${modernPartner}의 신구 조화`
        : `${clsLead}의 노련함과 현역 스쿼드의 에너지가 어우러진 신구 조화`;
      s1 = pickVariant(
        [
          `${josa(bridgePhrase, '이/가')} ${input.formation} ${tacticInfo.phrase} 안에서 매끄럽게 녹아든 팀이다.`,
          `${clsLead}의 품격이 큰 경기마다 중심을 잡아주고, 현역 선수들이 ${tacticInfo.flavor}로 템포를 끌어올렸다.`,
          `세대를 넘나드는 조합이 돋보였다 — ${input.formation} 대형 위에서 ${josa(bridgePhrase, '이/가')} 뚜렷한 색깔을 빚어냈다.`,
          `전설의 노련미와 현역의 기동력을 ${josa(mgrLead, '으로/로')} 하나로 엮어내며 ${clsLead}의 존재감을 극대화했다.`,
        ],
        `${seed}:s1:classic`,
      );
      s2 = finale || (coachTag ? `${coachTag}의 조율까지 더해져 세대 간 호흡이 한층 정교해졌다.` : '');
      break;
    }

    case 'explosive_firepower': {
      const gfNote =
        typeof input.goalsFor === 'number'
          ? `리그 ${input.goalsFor}골을 몰아친`
          : '매 경기 상대 골문을 두드린';
      const fireLead =
        attackDuo.length >= 2
          ? `${joinPair(attackDuo[0], attackDuo[1])} 공격 듀오를 앞세워`
          : trio.length >= 3
            ? `${trio[0]}·${trio[1]}·${trio[2]} 삼각 편대를 앞세워`
            : `${input.formation} 대형의 공격 숫자를 극대화해`;
      s1 = pickVariant(
        [
          `${fireLead} ${gfNote} 화끈한 공격 축구의 팀이다.`,
          `${input.formation} ${tacticInfo.phrase}에 ${traitInfo ? josa(traitInfo.style, '을/를') : '과감한 공격 본능'} 더해 ${gfNote} 화력을 뽐냈다.`,
          `수비보다 더 많은 득점으로 답을 내놓던 팀으로, ${fireLead} ${tacticInfo.flavor}를 마음껏 펼쳤다.`,
          `경기당 2골을 훌쩍 넘기는 화력이 상징이었고, ${input.formation} 전형 속에서 ${tacticInfo.flavor}로 상대를 압도했다.`,
        ],
        `${seed}:s1:firepower`,
      );
      s2 = finale || (coachTag ? `여기에 ${coachTag}까지 더해지며 득점 루트가 한층 다채로워졌다.` : '');
      break;
    }

    case 'tactical_identity': {
      // Pure Team / Manager / Coach / Chemistry / Rotation identity — ZERO player names!
      const rotationNote = hasStrongRotation
        ? '선발과 벤치를 가리지 않는 두터운 로테이션'
        : input.chemistry >= 88
          ? '물 흐르듯 맞물린 높은 팀 케미스트리'
          : '빈틈없는 팀 조직력';
      s1 = pickVariant(
        [
          `특정 스타에 기대지 않고 ${josa(mgrLead, '와/과')} ${input.formation} ${tacticInfo.phrase}의 완성도로 승부한 팀이다.`,
          `${josa(rotationNote, '이/가')} 가장 큰 강점이었던 시즌으로, ${input.formation} 대형 속에서 ${tacticInfo.flavor}를 일관되게 구현했다.`,
          `개인기보다 시스템이 먼저 보였던 팀이다. ${josa(mgrLead, '을/를')} ${input.formation} ${tacticInfo.phrase}으로 정교하게 풀어내며 기대 이상의 실효 전력을 뽑아냈다.`,
          `11명이 하나의 유기체처럼 움직인 ${input.formation} ${tacticInfo.phrase}과 ${josa(rotationNote, '이/가')} 시즌 내내 팀을 지탱했다.`,
          coachTag
            ? `${mgrLead}에 ${coachTag}의 디테일이 더해지며, ${input.formation} ${tacticInfo.phrase}이 한층 날카롭게 다듬어진 팀이다.`
            : `${traitInfo ? `${traitInfo.vibe} ` : ''}${input.formation} ${tacticInfo.phrase}과 ${josa(rotationNote, '으로/로')} 자기만의 팀 색깔을 선명하게 각인시켰다.`,
        ],
        `${seed}:s1:tactical`,
      );
      if (coachTag && !s1.includes(coach!.name)) {
        s2 = finale
          ? `중반 합류한 ${coachTag}의 조율까지 어우러지며 ${finale}`
          : `후반기 가세한 ${coachTag}의 뒷받침 속에 끝까지 균형 잡힌 경기력을 유지했다.`;
      } else {
        s2 = finale || (hasStrongRotation ? '주전과 교체의 격차가 크지 않은 스쿼드 운용이 긴 레이스에서 진가를 발휘했다.' : '');
      }
      break;
    }

    case 'spine_duo_trio': {
      const subPool: string[] = [];
      if (attackDuo.length >= 2) {
        subPool.push(
          `${joinPair(attackDuo[0], attackDuo[1])} 공격 듀오가 최전방에서 호흡을 맞추며 ${input.formation} ${tacticInfo.phrase}의 파괴력을 극대화한 팀이다.`,
          `상대 수비를 양옆으로 찢어놓은 ${joinPair(attackDuo[0], attackDuo[1])} 콤비가 ${tacticInfo.flavor}의 마침표를 책임졌다.`,
        );
      }
      if (midfieldAxis.length >= 2) {
        subPool.push(
          `${joinPair(midfieldAxis[0], midfieldAxis[1])} 중원 콤비가 경기의 템포를 쥐고 흔들며 ${input.formation} ${tacticInfo.phrase}에 생기를 불어넣었다.`,
          `허리에서 중심을 잡은 ${joinPair(midfieldAxis[0], midfieldAxis[1])}의 안정감 위에 ${josa(mgrLead, '이/가')} 자연스럽게 얹힌 팀이다.`,
        );
      }
      if (defenseLine.length >= 2) {
        subPool.push(
          `${joinPair(defenseLine[0], defenseLine[1])}의 탄탄한 후방 지지대 덕분에 ${input.formation} ${tacticInfo.phrase}을 자신 있게 밀어붙일 수 있었던 팀이다.`,
        );
      }
      if (trio.length >= 3) {
        subPool.push(
          `${trio[0]}·${trio[1]}·${trio[2]} 삼각 편대가 공수의 뼈대를 세우고, ${tacticInfo.flavor}로 매 경기 주도권을 쥔 팀이다.`,
        );
      }
      s1 = pickVariant(
        subPool.length > 0
          ? subPool
          : [`${josa(mgrLead, '을/를')} ${input.formation} ${tacticInfo.phrase}으로 구현하며 균형 잡힌 팀 색깔을 보여줬다.`],
        `${seed}:s1:spine`,
      );
      if ((input.awakenedCount ?? 0) > 0 && awakenedNames[0]) {
        s2 = finale
          ? `여기에 ${awakenedNames[0]}의 각성까지 더해지며 ${finale}`
          : `시즌 중 ${awakenedNames[0]}의 잠재력 각성이 더해지며 스쿼드의 두께가 한층 두터워졌다.`;
      } else if (coachTag && finale) {
        s2 = `${coachTag}의 조율까지 뒷받침되며 ${finale}`;
      } else {
        s2 = finale;
      }
      break;
    }

    case 'balanced_ace':
    default: {
      const leadAce = aceName ?? '핵심 에이스';
      s1 = pickVariant(
        [
          `${josa(leadAce, '을/를')} 중심축으로 세우고 ${input.formation} ${tacticInfo.phrase}으로 매 경기 흐름을 주도한 팀이다.`,
          `${josa(mgrLead, '을/를')} 피치 위에서 구현한 ${leadAce}의 꾸준한 활약이 ${input.formation} 전술의 완성도를 끌어올렸다.`,
          `승부처마다 해결사로 나선 ${leadAce}의 존재감과 ${tacticInfo.flavor}가 조화를 이룬 시즌이었다.`,
        ],
        `${seed}:s1:ace`,
      );
      s2 =
        coachTag && finale
          ? `${coachTag}의 지원까지 더해져 ${finale}`
          : finale || (coachTag ? `${coachTag}의 합류가 후반 레이스에 안정감을 보탰다.` : '');
      break;
    }
  }

  return s2 ? `${s1} ${s2}` : s1;
}

// =============================================================================
// Chronological Documentary Storytelling Helpers (Task 3)
// =============================================================================

function formatGoalScorerList(match: MatchResult, teamId: string): string[] {
  const events = [
    ...match.events,
    ...(match.extraTime?.etEvents ?? []),
  ].filter((ev) => ev.type === 'goal' && ev.teamId === teamId && ev.scorerName);
  return events.map((ev) => `${ev.scorerName} ${ev.minute}'`);
}

function getMatchOutcomeForUser(
  match: MatchResult,
  userClubId: string,
  clubsById: Record<string, Club>,
  userClubName: string,
) {
  const isHome = match.homeTeamId === userClubId;
  const ug = isHome ? match.homeGoals : match.awayGoals;
  const og = isHome ? match.awayGoals : match.homeGoals;
  const htU = isHome ? match.halftimeHomeGoals : match.halftimeAwayGoals;
  const htO = isHome ? match.halftimeAwayGoals : match.halftimeHomeGoals;
  const oppId = isHome ? match.awayTeamId : match.homeTeamId;
  const oppClub = clubsById[oppId];
  const oppName = getTeamDisplayName(oppId, clubsById, userClubName);
  const oppOvr = oppClub ? (oppClub.att + oppClub.mid + oppClub.def) / 3 : 78;
  const wonOnPk =
    match.extraTime?.penalties?.winnerTeamId === userClubId;
  const lostOnPk =
    Boolean(match.extraTime?.penalties) &&
    match.extraTime?.penalties?.winnerTeamId !== userClubId;
  const outcome: 'W' | 'D' | 'L' =
    ug > og || wonOnPk ? 'W' : ug < og || lostOnPk ? 'L' : 'D';
  return {
    isHome,
    ug,
    og,
    htU,
    htO,
    oppId,
    oppName,
    oppOvr,
    outcome,
    wonOnPk,
    lostOnPk,
  };
}

function computeRankAtRound(
  fixtures: Fixture[],
  userClubId: string,
  targetRound: number,
): { rank: number; points: number } | null {
  if (fixtures.length === 0) return null;
  const pts = new Map<string, number>();
  const gd = new Map<string, number>();
  let anyPlayed = false;
  for (const f of fixtures) {
    if (!f.played || !f.result || f.round > targetRound) continue;
    anyPlayed = true;
    const r = f.result;
    const hp = r.homeGoals > r.awayGoals ? 3 : r.homeGoals === r.awayGoals ? 1 : 0;
    const ap = r.awayGoals > r.homeGoals ? 3 : r.awayGoals === r.homeGoals ? 1 : 0;
    pts.set(f.homeTeamId, (pts.get(f.homeTeamId) ?? 0) + hp);
    pts.set(f.awayTeamId, (pts.get(f.awayTeamId) ?? 0) + ap);
    gd.set(f.homeTeamId, (gd.get(f.homeTeamId) ?? 0) + (r.homeGoals - r.awayGoals));
    gd.set(f.awayTeamId, (gd.get(f.awayTeamId) ?? 0) + (r.awayGoals - r.homeGoals));
  }
  if (!anyPlayed || !pts.has(userClubId)) return null;
  const sorted = [...pts.keys()].sort(
    (a, b) =>
      (pts.get(b) ?? 0) - (pts.get(a) ?? 0) ||
      (gd.get(b) ?? 0) - (gd.get(a) ?? 0),
  );
  const rank = sorted.indexOf(userClubId) + 1;
  return rank > 0 ? { rank, points: pts.get(userClubId) ?? 0 } : null;
}

function findTitleClinchingMatch(params: {
  fixtures: Fixture[];
  standings: StandingRow[];
  userClubId: string;
  totalRounds: number;
  clubsById: Record<string, Club>;
}): {
  round: number;
  match: MatchResult;
  opponentName: string;
  userGoals: number;
  oppGoals: number;
  isFinalDay: boolean;
} | null {
  const { fixtures, standings, userClubId, totalRounds, clubsById } = params;
  const userRank = standings.findIndex((r) => r.teamId === userClubId) + 1;
  if (userRank !== 1 || fixtures.length === 0) return null;

  const byRound = new Map<number, Fixture[]>();
  for (const f of fixtures) {
    if (!f.played || !f.result) continue;
    const list = byRound.get(f.round) ?? [];
    list.push(f);
    byRound.set(f.round, list);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  const pts = new Map<string, number>();

  for (const r of rounds) {
    const rFixtures = byRound.get(r) ?? [];
    let userMatch: MatchResult | null = null;
    for (const f of rFixtures) {
      const res = f.result!;
      const hp =
        res.homeGoals > res.awayGoals ? 3 : res.homeGoals === res.awayGoals ? 1 : 0;
      const ap =
        res.awayGoals > res.homeGoals ? 3 : res.awayGoals === res.homeGoals ? 1 : 0;
      pts.set(f.homeTeamId, (pts.get(f.homeTeamId) ?? 0) + hp);
      pts.set(f.awayTeamId, (pts.get(f.awayTeamId) ?? 0) + ap);
      if (f.homeTeamId === userClubId || f.awayTeamId === userClubId) {
        userMatch = res;
      }
    }
    const userPts = pts.get(userClubId) ?? 0;
    let bestOther = 0;
    for (const [tid, p] of pts.entries()) {
      if (tid !== userClubId && p > bestOther) bestOther = p;
    }
    const remaining = Math.max(0, totalRounds - r);
    const clinchedEarly = userPts > bestOther + remaining * 3;
    const isFinalDay = r === totalRounds;
    if ((clinchedEarly || isFinalDay) && userMatch) {
      const isHome = userMatch.homeTeamId === userClubId;
      const oppId = isHome ? userMatch.awayTeamId : userMatch.homeTeamId;
      return {
        round: r,
        match: userMatch,
        opponentName: clubsById[oppId]?.name ?? '상대 구단',
        userGoals: isHome ? userMatch.homeGoals : userMatch.awayGoals,
        oppGoals: isHome ? userMatch.awayGoals : userMatch.homeGoals,
        isFinalDay,
      };
    }
  }
  return null;
}

interface CrisisAftermathContext {
  sortedLeagueMatches: MatchResult[];
  userClubId: string;
  clubsById: Record<string, Club>;
  userClubName: string;
  halfRound: number;
  hiredCoachName: string | null;
  tradeHistory: TradeHistoryRecord[];
  awakenedPlayers: Player[];
  tacticalHistory: TacticalAdaptationState['history'];
  finalRank: number;
}

/**
 * Inspects what happened right after a crisis/slump at `crisisEndRound` to weave genuine
 * cause-and-effect ("위기 -> 전술 변주·영입·코치·각성으로 반등" OR "끝내 넘지 못한 벽").
 */
function buildCrisisFollowUpClause(
  crisisEndRound: number,
  ctx: CrisisAftermathContext,
  seed: string,
): { hasRebound: boolean; clause: string } {
  const afterMatches = ctx.sortedLeagueMatches
    .filter((m) => m.round > crisisEndRound)
    .slice(0, 6);
  let wins = 0;
  let losses = 0;
  for (const m of afterMatches) {
    const o = getMatchOutcomeForUser(m, ctx.userClubId, ctx.clubsById, ctx.userClubName);
    if (o.outcome === 'W') wins += 1;
    else if (o.outcome === 'L') losses += 1;
  }

  // Detect real catalysts right around the crisis window
  const nearbyTrade = ctx.tradeHistory.find(
    (tr) => tr.round >= crisisEndRound - 2 && tr.round <= crisisEndRound + 6,
  );
  const nearbyAwakening = ctx.awakenedPlayers.find(
    (p) =>
      p.awakening &&
      p.awakening.competition === 'league' &&
      p.awakening.round >= crisisEndRound &&
      p.awakening.round <= crisisEndRound + 7,
  );
  const nearbyCoach =
    ctx.hiredCoachName &&
    Math.abs(ctx.halfRound - crisisEndRound) <= 6;

  // Detect tactical/formation variation right after crisis
  let variedTacticsAfter = false;
  if (ctx.tacticalHistory.length >= 2) {
    const atCrisis = [...ctx.tacticalHistory]
      .reverse()
      .find((h) => h.competition === 'league' && h.round <= crisisEndRound);
    const afterEntry = ctx.tacticalHistory.find(
      (h) =>
        h.competition === 'league' &&
        h.round > crisisEndRound &&
        h.round <= crisisEndRound + 4 &&
        atCrisis &&
        (h.formation !== atCrisis.formation || h.tactic !== atCrisis.tactic),
    );
    variedTacticsAfter = Boolean(afterEntry);
  }

  const catalysts: string[] = [];
  if (nearbyAwakening) {
    catalysts.push(`${formatPlayerRecordName(nearbyAwakening)}의 포텐 각성`);
  }
  if (nearbyTrade && nearbyTrade.receivedPlayers.length > 0) {
    catalysts.push(`${nearbyTrade.receivedPlayers[0].name} 영입 보강`);
  }
  if (nearbyCoach && ctx.hiredCoachName) {
    catalysts.push(`${ctx.hiredCoachName} 수석 코치 합류`);
  }
  if (variedTacticsAfter) {
    catalysts.push('과감한 전술 변주');
  }

  const isRebound =
    (afterMatches.length >= 3 && wins >= Math.ceil(afterMatches.length * 0.6)) ||
    (afterMatches.length >= 2 && wins >= 2 && losses === 0);

  if (isRebound) {
    const catalystPhrase =
      catalysts.length > 0 ? `${josa(catalysts[0], '을/를')} 계기로 ` : '';
    const clause = pickVariant(
      [
        `그러나 ${catalystPhrase}곧바로 이어진 ${afterMatches.length}경기에서 ${wins}승을 거두며 보란 듯이 흐름을 되돌렸다.`,
        `하지만 흔들림은 길지 않았고, ${catalystPhrase}이후 ${afterMatches.length}경기 ${wins}승으로 반등의 발판을 마련했다.`,
        `위기 직후 ${catalystPhrase}전열을 추스르며 다음 ${afterMatches.length}경기 중 ${wins}경기를 잡아내며 분위기를 뒤집었다.`,
      ],
      `${seed}:rebound`,
    );
    return { hasRebound: true, clause };
  }

  if (afterMatches.length >= 3 && wins <= 1) {
    const clause = pickVariant(
      [
        `이후에도 ${afterMatches.length}경기 ${wins}승에 그치며 좀처럼 탈출구를 찾지 못한 아쉬운 구간으로 남았다.`,
        `전열을 정비하려 애썼지만 이어진 ${afterMatches.length}경기에서도 ${wins}승에 머물며 끝내 두꺼운 벽을 체감했다.`,
      ],
      `${seed}:wall`,
    );
    return { hasRebound: false, clause };
  }

  if (catalysts.length > 0) {
    return {
      hasRebound: ctx.finalRank <= 4,
      clause: `이 고비를 넘기기 위해 ${josa(catalysts[0], '으로/로')} 돌파구를 모색하며 시즌의 방향을 다시 잡았다.`,
    };
  }

  return {
    hasRebound: ctx.finalRank <= 3,
    clause:
      ctx.finalRank <= 2
        ? '아픈 교훈을 삼킨 뒤 다시 집중력을 끌어올리며 우승 경쟁의 끈을 놓지 않았다.'
        : '시즌 후반을 향한 과제를 남긴 쓰라린 분기점이었다.',
  };
}

export interface SoloSeasonStoryInput {
  userClubName: string;
  managerName: string;
  managerTraitId: ManagerTraitId | null;
  managerRating: number;
  staffCoachId?: StaffCoachId | null;
  formation: FormationId;
  tactic: TacticId;
  leagueName: string;
  clubs: Club[];
  standings: StandingRow[];
  fixtures: Fixture[];
  totalRounds: number;
  userMatchHistory: MatchResult[];
  userCupMatchHistory: MatchResult[];
  userUclMatchHistory: MatchResult[];
  cup: DomesticCupState | null;
  ucl: UclTournamentState | null;
  starters: (Player | null)[];
  bench: (Player | null)[];
  combinedStatsMap: Record<string, PlayerSeasonStats>;
  baseAvgOvr: number;
  effectiveOvr: number;
  chemistry: number;
  ffpTier?: 0 | 1 | 2;
  userClubId?: string;
  // v9.7 Optional season telemetry for richer intro & adversity storytelling
  tacticalAdaptation?: TacticalAdaptationState | null;
  tradeHistory?: TradeHistoryRecord[];
  storyCrisisLog?: SeasonStoryCrisisLog | null;
  managerSynergyCount?: number;
}

interface ChronologicalBeat {
  order: number;
  priority: number; // Higher priority beats survive curation cap
  highlight: TeamStoryHighlight;
}

/**
 * Generates an expressive, multi-focus team intro AND a documentary retrospective
 * season chronicle weaving both highs (wins, awakenings, comebacks, titles) and lows
 * (slumps, heavy losses, injuries, tactical counters, rank dips, cup/UCL exits) into
 * a cohesive chronological arc.
 */
export function generateSoloSeasonTeamStory(
  input: SoloSeasonStoryInput,
): TeamSeasonStory {
  const userClubId = input.userClubId ?? USER_CLUB_ID;
  const filledStarters = input.starters.filter((p): p is Player => p !== null);
  const squad = [...input.starters, ...input.bench].filter(Boolean) as Player[];
  const awakenedPlayers = squad
    .filter((p) => Boolean(p.awakening))
    .sort(
      (a, b) =>
        (a.awakening?.round ?? 20) - (b.awakening?.round ?? 20) ||
        (b.awakening?.ovrGain ?? 0) - (a.awakening?.ovrGain ?? 0),
    );
  const classicPlayers = squad.filter((p) => p.isLegend);

  const clubsById: Record<string, Club> = {};
  for (const c of input.clubs) clubsById[c.id] = c;
  if (input.ucl) {
    for (const c of input.ucl.clubs) {
      if (!clubsById[c.id]) clubsById[c.id] = c;
    }
  }

  const finalRank =
    input.standings.findIndex((r) => r.teamId === userClubId) + 1;
  const userRow = input.standings.find((r) => r.teamId === userClubId);

  const aiOvrs = input.clubs
    .filter((c) => c.id !== userClubId)
    .map((c) => (c.att + c.mid + c.def) / 3);
  const expectedRank =
    aiOvrs.length > 0
      ? aiOvrs.filter((v) => v > input.baseAvgOvr + 0.1).length + 1
      : undefined;

  const userStats = Object.values(input.combinedStatsMap).filter(
    (s) => s.teamId === userClubId && s.appearances >= 3,
  );
  const sortedByGA = [...userStats].sort(
    (a, b) =>
      b.goals + b.assists - (a.goals + a.assists) || b.avgRating - a.avgRating,
  );
  const aceStat = sortedByGA[0];
  const attackDuoNames = sortedByGA
    .filter((s) => s.position === 'FW' || s.position === 'MF')
    .filter((s) => s.goals + s.assists >= 8)
    .slice(0, 2)
    .map((s) => s.playerName);
  const midfieldAxisNames = [...userStats]
    .filter((s) => s.position === 'MF')
    .sort((a, b) => b.avgRating - a.avgRating || b.appearances - a.appearances)
    .slice(0, 2)
    .map((s) => s.playerName);
  const defSorted = [...userStats]
    .filter((s) => s.position === 'DF' || s.position === 'GK')
    .sort((a, b) => b.avgRating - a.avgRating || b.cleanSheets - a.cleanSheets);
  const defAnchorStat = defSorted[0];
  const defAnchorFallback = squad
    .filter((p) => p.position === 'DF' || p.position === 'GK')
    .sort((a, b) => b.ovr - a.ovr)[0];
  const defenseLineNames = defSorted.slice(0, 2).map((s) => s.playerName);
  const trioNames = [...userStats]
    .sort((a, b) => b.avgRating - a.avgRating || b.goals + b.assists - (a.goals + a.assists))
    .slice(0, 3)
    .map((s) => s.playerName);
  const rotationBenchContributors = userStats.filter(
    (s) => s.subAppearances >= 4 || (s.appearances >= 10 && s.starts < s.appearances * 0.6),
  ).length;
  const computedManagerSynergyCount =
    input.managerSynergyCount ??
    (input.managerTraitId
      ? filledStarters.filter(
          (p) => evaluateManagerPlayerSynergy(p, input.managerTraitId).isMatch,
        ).length
      : 0);

  const cupWon = input.cup?.championTeamId === userClubId;
  const uclWon = input.ucl?.championTeamId === userClubId;
  const isTreble = finalRank === 1 && cupWon && uclWon;

  const storySeed = `${input.userClubName}|${input.formation}|${input.tactic}|${finalRank}|${userRow?.points ?? 0}|${input.userMatchHistory.length}`;

  const beats: ChronologicalBeat[] = [];
  const usedMatchIds = new Set<string>();
  const halfRound = Math.max(10, Math.round(input.totalRounds / 2));
  const sortedLeagueMatches = [...input.userMatchHistory].sort(
    (a, b) => a.round - b.round,
  );
  const hiredCoach = input.staffCoachId ? STAFF_COACHES[input.staffCoachId] : null;
  const tacticalHistory = input.tacticalAdaptation?.history ?? [];
  const tradeHistory = input.tradeHistory ?? [];

  const aftermathCtx: CrisisAftermathContext = {
    sortedLeagueMatches,
    userClubId,
    clubsById,
    userClubName: input.userClubName,
    halfRound,
    hiredCoachName: hiredCoach?.name ?? null,
    tradeHistory,
    awakenedPlayers,
    tacticalHistory,
    finalRank: finalRank > 0 ? finalRank : 10,
  };

  let hadCrisisRebound = false;
  let hadMajorCrisis = false;

  // ---------------------------------------------------------------------------
  // 1) Season Opening & Early Momentum (1R ~ 5R)
  // ---------------------------------------------------------------------------
  if (sortedLeagueMatches.length > 0) {
    const opener = sortedLeagueMatches[0];
    const openInfo = getMatchOutcomeForUser(
      opener,
      userClubId,
      clubsById,
      input.userClubName,
    );
    const earlySlice = sortedLeagueMatches.slice(
      0,
      Math.min(5, sortedLeagueMatches.length),
    );
    let ew = 0;
    let ed = 0;
    let el = 0;
    for (const m of earlySlice) {
      const o = getMatchOutcomeForUser(m, userClubId, clubsById, input.userClubName);
      if (o.outcome === 'W') ew += 1;
      else if (o.outcome === 'D') ed += 1;
      else el += 1;
    }
    const openScorers = formatGoalScorerList(opener, userClubId).slice(0, 2);
    const scorerSuffix =
      openScorers.length > 0 ? `(${openScorers.join(', ')})` : '';
    let openingSentence = '';
    if (earlySlice.length >= 4 && ew >= 4) {
      openingSentence = pickVariant(
        [
          `개막전 ${openInfo.oppName}전 ${openInfo.ug}-${openInfo.og} 승리${scorerSuffix}로 기분 좋게 문을 연 뒤, 초반 ${earlySlice.length}경기 ${ew}승 ${ed}무 ${el}패로 단숨에 선두권에 안착했다.`,
          `시즌 첫날부터 ${input.formation} 전술이 매끄럽게 돌아갔다. 초반 ${earlySlice.length}경기에서 ${ew}승 ${ed}무 ${el}패를 쓸어 담으며 일찌감치 우승 경쟁을 예고했다.`,
          `${openInfo.oppName}전 ${openInfo.ug}-${openInfo.og}${scorerSuffix}을 시작으로 초반 ${earlySlice.length}경기를 ${ew}승 ${ed}무 ${el}패로 돌파하며 거침없이 치고 나갔다.`,
        ],
        `${storySeed}:open:fast`,
      );
    } else if (earlySlice.length >= 4 && el >= 2) {
      hadMajorCrisis = true;
      openingSentence = pickVariant(
        [
          `출발은 순탄치 않았다. 초반 ${earlySlice.length}경기 ${ew}승 ${ed}무 ${el}패로 불안하게 흔들리며, ${input.formation} 호흡을 맞추는 데 예상보다 시간이 걸렸다.`,
          `개막 직후 ${earlySlice.length}경기에서 ${el}패를 떠안으며 조용히 시험대에 올랐지만, 빠르게 전열을 가다듬으며 긴 시즌의 해법을 찾아 나섰다.`,
          `초반 ${earlySlice.length}경기 ${ew}승 ${ed}무 ${el}패 — 기대보다 무거웠던 출발선에서 팀의 진짜 시험이 시작됐다.`,
        ],
        `${storySeed}:open:rocky`,
      );
    } else if (openInfo.outcome === 'W') {
      openingSentence = pickVariant(
        [
          `개막전 ${openInfo.oppName}전 ${openInfo.ug}-${openInfo.og}${scorerSuffix} 승리로 산뜻하게 출항했고, 초반 ${earlySlice.length}경기를 ${ew}승 ${ed}무 ${el}패로 차분히 넘겼다.`,
          `${openInfo.oppName}전을 ${openInfo.ug}-${openInfo.og}로 잡으며 첫 단추를 잘 끼웠고, 초반 ${earlySlice.length}경기 ${ew}승 ${ed}무 ${el}패의 안정감 있는 출발을 보였다.`,
        ],
        `${storySeed}:open:win`,
      );
    } else {
      openingSentence = pickVariant(
        [
          `개막전 ${openInfo.oppName}전(${openInfo.ug}-${openInfo.og})으로 막을 올린 뒤 초반 ${earlySlice.length}경기 ${ew}승 ${ed}무 ${el}패로 긴 레이스의 감각을 조율했다.`,
          `${openInfo.oppName}전(${openInfo.ug}-${openInfo.og})으로 시작된 시즌 초반, ${ew}승 ${ed}무 ${el}패를 기록하며 서서히 팀의 리듬을 찾아갔다.`,
        ],
        `${storySeed}:open:steady`,
      );
    }

    beats.push({
      order: 1,
      priority: 95,
      highlight: {
        kind: 'opening',
        period:
          earlySlice.length >= 4
            ? `개막 ~ ${earlySlice[earlySlice.length - 1].round}R`
            : '개막',
        tag: el >= 2 ? '험난한 출발' : '시즌 출항',
        title:
          ew >= 4
            ? `초반 ${earlySlice.length}경기 ${ew}승 쾌조의 스타트`
            : el >= 2
              ? `초반 ${el}패의 흔들림 속에 시작한 시즌`
              : `${openInfo.oppName}전으로 막을 올린 대장정`,
        detail: openingSentence,
        metric: `${ew}승 ${ed}무 ${el}패`,
      },
    });
    usedMatchIds.add(opener.fixtureId);
  }

  // ---------------------------------------------------------------------------
  // 2) Losing Streak / Winless Slump Detection + Rebound Arc (Task 3)
  // ---------------------------------------------------------------------------
  if (sortedLeagueMatches.length >= 6) {
    let curLoss = 0;
    let curLossStart = 0;
    let maxLoss = 0;
    let bestLossStart = 0;
    let bestLossEnd = 0;

    let curWinless = 0;
    let curWinlessStart = 0;
    let curWinlessDraws = 0;
    let curWinlessLosses = 0;
    let maxWinless = 0;
    let bestWinlessStart = 0;
    let bestWinlessEnd = 0;
    let bestWinlessDraws = 0;
    let bestWinlessLosses = 0;

    for (const m of sortedLeagueMatches) {
      const info = getMatchOutcomeForUser(m, userClubId, clubsById, input.userClubName);
      if (info.outcome === 'L') {
        if (curLoss === 0) curLossStart = m.round;
        curLoss += 1;
        if (curWinless === 0) {
          curWinlessStart = m.round;
          curWinlessDraws = 0;
          curWinlessLosses = 0;
        }
        curWinless += 1;
        curWinlessLosses += 1;
      } else if (info.outcome === 'D') {
        curLoss = 0;
        if (curWinless === 0) {
          curWinlessStart = m.round;
          curWinlessDraws = 0;
          curWinlessLosses = 0;
        }
        curWinless += 1;
        curWinlessDraws += 1;
      } else {
        curLoss = 0;
        curWinless = 0;
        curWinlessDraws = 0;
        curWinlessLosses = 0;
      }

      if (curLoss > maxLoss) {
        maxLoss = curLoss;
        bestLossStart = curLossStart;
        bestLossEnd = m.round;
      }
      if (curWinless > maxWinless) {
        maxWinless = curWinless;
        bestWinlessStart = curWinlessStart;
        bestWinlessEnd = m.round;
        bestWinlessDraws = curWinlessDraws;
        bestWinlessLosses = curWinlessLosses;
      }
    }

    if (maxLoss >= 2 || maxWinless >= 4) {
      hadMajorCrisis = true;
      const useLoss = maxLoss >= 3 || (maxLoss >= 2 && maxWinless < 4);
      const sR = useLoss ? bestLossStart : bestWinlessStart;
      const eR = useLoss ? bestLossEnd : bestWinlessEnd;
      const follow = buildCrisisFollowUpClause(eR, aftermathCtx, `${storySeed}:slump:${sR}`);
      if (follow.hasRebound) hadCrisisRebound = true;

      const leadText = useLoss
        ? pickVariant(
            [
              `${sR}라운드부터 ${eR}라운드까지 ${maxLoss}연패의 늪에 빠지며 시즌 최대의 위기를 맞았다.`,
              `${sR}R~${eR}R 내리 ${maxLoss}경기를 내주며 라커룸 분위기가 무겁게 가라앉았다.`,
              `잘 나가던 흐름에 급제동이 걸렸다. ${sR}라운드부터 ${maxLoss}연패를 당하며 순위 경쟁이 크게 흔들렸다.`,
            ],
            `${storySeed}:slump:loss`,
          )
        : pickVariant(
            [
              `${sR}라운드부터 ${eR}라운드까지 ${maxWinless}경기 연속 무승(${bestWinlessDraws}무 ${bestWinlessLosses}패)에 묶이며 답답한 슬럼프를 겪었다.`,
              `좀처럼 승전보가 울리지 않던 시기였다. ${sR}R~${eR}R ${maxWinless}경기 무승으로 승점이 빠르게 깎여 나갔다.`,
              `${sR}R~${eR}R 사이 ${bestWinlessDraws}무 ${bestWinlessLosses}패의 긴 무승 터널을 지나며 팀 전체가 시험대에 올랐다.`,
            ],
            `${storySeed}:slump:winless`,
          );

      beats.push({
        order: sR + 0.12,
        priority: 92,
        highlight: {
          kind: 'slump',
          period: `${sR}R ~ ${eR}R`,
          tag: useLoss ? '연패 슬럼프' : '무승 고비',
          title: useLoss
            ? `${sR}R~${eR}R ${maxLoss}연패의 위기${follow.hasRebound ? '와 반등' : ''}`
            : `${sR}R~${eR}R ${maxWinless}경기 무승 침체${follow.hasRebound ? ' 돌파' : ''}`,
          detail: `${leadText} ${follow.clause}`,
          metric: useLoss ? `${maxLoss}연패` : `${maxWinless}G 무승`,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3) Painful Heavy Defeat OR Blown Halftime Lead (Task 3)
  // ---------------------------------------------------------------------------
  const allMatches = [
    ...input.userMatchHistory,
    ...input.userCupMatchHistory,
    ...input.userUclMatchHistory,
  ];
  let worstSetback: {
    match: MatchResult;
    kind: 'heavy' | 'blown_lead';
    ug: number;
    og: number;
    htU: number;
    htO: number;
    oppName: string;
    oppOvr: number;
    severity: number;
  } | null = null;

  for (const m of allMatches) {
    if (usedMatchIds.has(m.fixtureId)) continue;
    const info = getMatchOutcomeForUser(m, userClubId, clubsById, input.userClubName);
    if (info.outcome !== 'L') continue;
    const margin = info.og - info.ug;
    const isBlownLead =
      typeof info.htU === 'number' &&
      typeof info.htO === 'number' &&
      info.htU > info.htO &&
      info.ug < info.og;
    const isHeavy = margin >= 3 || (margin >= 2 && info.oppOvr >= 83);
    if (!isBlownLead && !isHeavy) continue;

    const compBonus = m.competition === 'ucl' ? 1.2 : m.competition === 'cup' ? 0.6 : 0;
    const severity = (isBlownLead ? 3.2 + (info.htU! - info.htO!) : margin) + compBonus;
    if (!worstSetback || severity > worstSetback.severity) {
      worstSetback = {
        match: m,
        kind: isBlownLead ? 'blown_lead' : 'heavy',
        ug: info.ug,
        og: info.og,
        htU: info.htU ?? 0,
        htO: info.htO ?? 0,
        oppName: info.oppName,
        oppOvr: info.oppOvr,
        severity,
      };
    }
  }

  if (worstSetback) {
    hadMajorCrisis = true;
    usedMatchIds.add(worstSetback.match.fixtureId);
    const compTag =
      worstSetback.match.competitionLabel ??
      (worstSetback.match.competition === 'ucl'
        ? 'UCL'
        : worstSetback.match.competition === 'cup'
          ? input.cup?.meta.koreanName ?? '컵대회'
          : `${worstSetback.match.round}R`);
    const sbOrder =
      worstSetback.match.competition === 'ucl'
        ? input.totalRounds + 2.2
        : worstSetback.match.competition === 'cup'
          ? Math.max(12, input.totalRounds - 5.5)
          : worstSetback.match.round + 0.18;
    const follow =
      worstSetback.match.competition === 'league'
        ? buildCrisisFollowUpClause(
            worstSetback.match.round,
            aftermathCtx,
            `${storySeed}:setback:${worstSetback.match.round}`,
          )
        : {
            hasRebound: false,
            clause: '뼈아픈 실점을 되짚으며 남은 일정의 경계심을 다시 조여야 했다.',
          };
    if (follow.hasRebound) hadCrisisRebound = true;

    const detailLead =
      worstSetback.kind === 'blown_lead'
        ? pickVariant(
            [
              `전반을 ${worstSetback.htU}-${worstSetback.htO}로 앞선 채 마치고도 후반 집중력이 무너지며 ${worstSetback.oppName}에 ${worstSetback.ug}-${worstSetback.og} 역전패를 당했다.`,
              `다 잡았던 경기였다. ${worstSetback.oppName}전 전반 ${worstSetback.htU}-${worstSetback.htO} 리드를 지키지 못하고 ${worstSetback.ug}-${worstSetback.og}로 쓰라리게 뒤집혔다.`,
            ],
            `${storySeed}:sb:blown`,
          )
        : pickVariant(
            [
              `${josa(worstSetback.oppName, '을/를')} 상대로 ${worstSetback.ug}-${worstSetback.og} 완패를 당하며 수비 간격과 전술 대응의 허점이 고스란히 드러났다.`,
              `${compTag} ${worstSetback.oppName}전 ${worstSetback.ug}-${worstSetback.og} 대패는 시즌을 통틀어 가장 뼈아팠던 밤으로 기억된다.`,
            ],
            `${storySeed}:sb:heavy`,
          );

    beats.push({
      order: sbOrder,
      priority: 86,
      highlight: {
        kind: 'setback',
        period: compTag,
        tag: worstSetback.kind === 'blown_lead' ? '쓰라린 역전패' : '뼈아픈 완패',
        title:
          worstSetback.kind === 'blown_lead'
            ? `${compTag} ${worstSetback.oppName}전 ${worstSetback.htU}-${worstSetback.htO} → ${worstSetback.ug}-${worstSetback.og} 역전패`
            : `${compTag} ${worstSetback.oppName}전 ${worstSetback.ug}-${worstSetback.og} 충격패`,
        detail: `${detailLead} ${follow.clause}`,
        metric: `${worstSetback.ug}-${worstSetback.og}`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 4) Key Player Injury Crisis (from storyCrisisLog) (Task 3)
  // ---------------------------------------------------------------------------
  const loggedInjuries = input.storyCrisisLog?.keyInjuries ?? [];
  const worstInjury = [...loggedInjuries]
    .filter((inj) => inj.matchesMissed >= 2 || inj.ovr >= 82)
    .sort((a, b) => b.matchesMissed * 10 + b.ovr - (a.matchesMissed * 10 + a.ovr))[0];
  if (worstInjury) {
    hadMajorCrisis = true;
    const follow = buildCrisisFollowUpClause(
      worstInjury.round,
      aftermathCtx,
      `${storySeed}:inj:${worstInjury.round}`,
    );
    if (follow.hasRebound) hadCrisisRebound = true;
    const sevLabel =
      worstInjury.severity === 'severe'
        ? '장기 부상'
        : worstInjury.severity === 'moderate'
          ? '중상'
          : '부상';
    const injPeriod =
      worstInjury.competition === 'ucl'
        ? 'UCL 무대'
        : worstInjury.competition === 'cup'
          ? '컵대회'
          : `${worstInjury.round}R`;
    const injDetail = pickVariant(
      [
        `${injPeriod} 무렵 핵심 자원 ${josa(worstInjury.playerName, '이/가')} ${sevLabel}(${worstInjury.matchesMissed}경기 이탈)로 빠지며 스쿼드 운용에 비상이 걸렸다. ${follow.clause}`,
        `주축 ${worstInjury.playerName}의 ${sevLabel}(${worstInjury.matchesMissed}경기 결장)이라는 악재가 겹치며 로테이션 시험대에 올랐다. ${follow.clause}`,
      ],
      `${storySeed}:inj:prose`,
    );
    beats.push({
      order:
        worstInjury.competition === 'ucl'
          ? input.totalRounds + 1.8
          : worstInjury.round + 0.22,
      priority: 84,
      highlight: {
        kind: 'slump',
        period: injPeriod,
        tag: '핵심 부상 악재',
        title: `${worstInjury.playerName} ${sevLabel} 이탈 (${worstInjury.matchesMissed}경기)`,
        detail: injDetail,
        metric: `${worstInjury.matchesMissed}G 이탈`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 5) Tactical Exposure / Counter Crisis + Variation Rebound (Task 3)
  // ---------------------------------------------------------------------------
  let detectedTacCrisis = (input.storyCrisisLog?.tacticalCrises ?? [])[0] ?? null;
  if (!detectedTacCrisis && tacticalHistory.length >= 8) {
    // Derive from tacticalAdaptation history when consecutive identical pattern >= 8
    let runLen = 1;
    for (let i = 1; i < tacticalHistory.length; i += 1) {
      const prev = tacticalHistory[i - 1];
      const cur = tacticalHistory[i];
      if (cur.formation === prev.formation && cur.tactic === prev.tactic) {
        runLen += 1;
        if (runLen === 8) {
          detectedTacCrisis = {
            round: cur.round,
            competition: cur.competition,
            formation: cur.formation,
            tactic: cur.tactic,
            exposureScore: 76,
          };
          break;
        }
      } else {
        runLen = 1;
      }
    }
  }
  if (detectedTacCrisis) {
    hadMajorCrisis = true;
    const afterChange = tacticalHistory.find(
      (h) =>
        h.round > detectedTacCrisis!.round &&
        h.round <= detectedTacCrisis!.round + 5 &&
        (h.formation !== detectedTacCrisis!.formation ||
          h.tactic !== detectedTacCrisis!.tactic),
    );
    const tacName =
      TACTICS[detectedTacCrisis.tactic]?.name ?? detectedTacCrisis.tactic;
    const tacResolution = afterChange
      ? `곧바로 ${afterChange.formation} · ${TACTICS[afterChange.tactic]?.name ?? afterChange.tactic} 카드로 전술 변주를 단행하며 상대의 맞춤 대응을 따돌렸다.`
      : `그럼에도 기존 전술을 고수하며 상대 감독들의 집요한 맞춤 공략을 정면으로 감수해야 했다.`;
    if (afterChange) hadCrisisRebound = true;

    beats.push({
      order: detectedTacCrisis.round + 0.28,
      priority: 85,
      highlight: {
        kind: 'slump',
        period: `${detectedTacCrisis.round}R`,
        tag: afterChange ? '전술 파훼·변주' : '전술 노출 위기',
        title: afterChange
          ? `${detectedTacCrisis.formation} 파훼 위기 → 전술 변주 돌파`
          : `${detectedTacCrisis.formation} ${tacName} 패턴 노출 위기`,
        detail: `${detectedTacCrisis.round}라운드 무렵 반복된 ${detectedTacCrisis.formation} ${tacName} 패턴이 상대 분석망에 완전히 포착되며 공격 전개가 막히기 시작했다. ${tacResolution}`,
        metric: afterChange ? '변주 대응' : `노출 ${detectedTacCrisis.exposureScore}%`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 6) Mid-Season Rank Drop / Stagnation (from fixtures trajectory) (Task 3)
  // ---------------------------------------------------------------------------
  if (input.fixtures.length > 0 && input.totalRounds >= 20) {
    const checkpoints = [6, 12, 18, 24, 30].filter((r) => r < input.totalRounds);
    let bestEarlyRank = 99;
    let bestEarlyRound = 0;
    let worstDip = 0;
    let dipFromRank = 0;
    let dipToRank = 0;
    let dipFromRound = 0;
    let dipToRound = 0;

    for (const r of checkpoints) {
      const st = computeRankAtRound(input.fixtures, userClubId, r);
      if (!st) continue;
      if (st.rank < bestEarlyRank) {
        bestEarlyRank = st.rank;
        bestEarlyRound = r;
      } else if (st.rank - bestEarlyRank >= 3 && st.rank - bestEarlyRank > worstDip) {
        worstDip = st.rank - bestEarlyRank;
        dipFromRank = bestEarlyRank;
        dipToRank = st.rank;
        dipFromRound = bestEarlyRound;
        dipToRound = r;
      }
    }

    if (worstDip >= 3 && !beats.some((b) => b.highlight.kind === 'slump' && Math.abs(b.order - dipToRound) <= 4)) {
      hadMajorCrisis = true;
      const recovered = finalRank > 0 && dipToRank - finalRank >= 2;
      if (recovered) hadCrisisRebound = true;
      beats.push({
        order: dipToRound + 0.2,
        priority: 78,
        highlight: {
          kind: 'setback',
          period: `${dipFromRound}R → ${dipToRound}R`,
          tag: recovered ? '순위 추락과 반등' : '중반 순위 정체',
          title: `${dipFromRound}R ${dipFromRank}위 → ${dipToRound}R ${dipToRank}위 하락`,
          detail: recovered
            ? `${dipFromRound}라운드 ${dipFromRank}위까지 올랐던 순위가 ${dipToRound}라운드 ${dipToRank}위까지 미끄러지며 위기감이 감돌았지만, 후반 뒷심으로 끝내 ${finalRank}위까지 순위를 되찾았다.`
            : `${dipFromRound}라운드 ${dipFromRank}위에서 ${dipToRound}라운드 ${dipToRank}위로 내려앉은 뒤, 중반 정체의 여파를 완전히 털어내지 못한 채 시즌 후반을 맞았다.`,
          metric: `-${worstDip}계단`,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 7) Early / Mid-Season Giant Killing (Upset win vs strong rival)
  // ---------------------------------------------------------------------------
  let bestGiantKill: {
    match: MatchResult;
    oppName: string;
    ug: number;
    og: number;
    oppOvr: number;
  } | null = null;
  for (const m of sortedLeagueMatches) {
    if (usedMatchIds.has(m.fixtureId)) continue;
    const info = getMatchOutcomeForUser(m, userClubId, clubsById, input.userClubName);
    if (
      info.outcome === 'W' &&
      info.oppOvr >= Math.max(82.5, input.baseAvgOvr - 0.5)
    ) {
      const scoreWeight =
        (info.oppOvr - input.baseAvgOvr) * 2 + (info.ug - info.og) + (info.isHome ? 0 : 0.7);
      const prevWeight = bestGiantKill
        ? (bestGiantKill.oppOvr - input.baseAvgOvr) * 2 +
          (bestGiantKill.ug - bestGiantKill.og)
        : -999;
      if (scoreWeight > prevWeight) {
        bestGiantKill = {
          match: m,
          oppName: info.oppName,
          ug: info.ug,
          og: info.og,
          oppOvr: info.oppOvr,
        };
      }
    }
  }
  if (bestGiantKill) {
    usedMatchIds.add(bestGiantKill.match.fixtureId);
    const scorers = formatGoalScorerList(bestGiantKill.match, userClubId).slice(0, 3);
    const isAway = bestGiantKill.match.awayTeamId === userClubId;
    const gkDetail = pickVariant(
      [
        `${bestGiantKill.match.round}라운드, 강호 ${josa(bestGiantKill.oppName, '을/를')} ${isAway ? '적지에서 ' : ''}${bestGiantKill.ug}-${bestGiantKill.og}로 제압하며${scorers.length > 0 ? `(${scorers.join(', ')})` : ''} 팀의 자신감을 크게 끌어올렸다.`,
        `객관적 전력이 만만치 않던 ${josa(bestGiantKill.oppName, '을/를')} ${isAway ? '원정에서 ' : ''}${bestGiantKill.ug}-${bestGiantKill.og}로 꺾은 이 한 판${scorers.length > 0 ? `(${scorers.join(', ')})` : ''}이 시즌의 분기점이 됐다.`,
        `${bestGiantKill.match.round}R ${bestGiantKill.oppName}전 ${bestGiantKill.ug}-${bestGiantKill.og} 승리는 우리 팀이 강팀 상대로도 통한다는 확신을 심어준 경기였다.`,
      ],
      `${storySeed}:gk:${bestGiantKill.match.round}`,
    );
    beats.push({
      order: bestGiantKill.match.round + 0.1,
      priority: 82,
      highlight: {
        kind: 'best_match',
        period: `${bestGiantKill.match.round}R`,
        tag: bestGiantKill.oppOvr > input.baseAvgOvr ? '강호 격파' : '빅매치 제압',
        title: `${bestGiantKill.oppName} ${isAway ? '원정 ' : ''}${bestGiantKill.ug}-${bestGiantKill.og} 승리`,
        detail: gkDetail,
        metric: `${bestGiantKill.ug}-${bestGiantKill.og}`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 8) Potential Awakening Milestones (exact round)
  // ---------------------------------------------------------------------------
  for (const hero of awakenedPlayers.slice(0, 2)) {
    const awk = hero.awakening!;
    const afterOvr = awk.originalOvr + awk.ovrGain;
    const heroName = formatPlayerRecordName(hero);
    const st = input.combinedStatsMap[hero.id];
    const awkOrder =
      awk.competition === 'ucl'
        ? input.totalRounds + 2.5
        : awk.competition === 'cup'
          ? Math.max(10, Math.min(input.totalRounds - 4, awk.round))
          : awk.round + 0.15;
    const periodLabel =
      awk.competition === 'ucl'
        ? 'UCL 무대'
        : awk.competition === 'cup'
          ? '컵대회'
          : `${awk.round}R`;
    const statClause =
      st && st.appearances >= 5
        ? ` 이후 ${st.goals}골 ${st.assists}도움(평균 평점 ${st.avgRating.toFixed(2)})으로 팀의 핵심 축으로 자리매김했다.`
        : ` 단숨에 스쿼드의 무게추를 바꾸며 후반 레이스의 결정적 카드가 됐다.`;
    const awkDetail = pickVariant(
      [
        `${periodLabel} 무렵, 묵묵히 기회를 쌓아가던 ${josa(heroName, '이/가')} 잠재력을 터뜨리며 기본 OVR +${awk.ovrGain} 성장을 이뤄냈다.${statClause}`,
        `감독의 신뢰에 보답하듯 ${periodLabel}에 ${josa(heroName, '이/가')} 한 단계 껍질을 깨고 각성(${awk.originalOvr}→${afterOvr})했다.${statClause}`,
        `${periodLabel}을 기점으로 ${heroName}의 경기력이 확연히 달라졌다. OVR +${awk.ovrGain} 각성과 함께 팀의 전력 천장이 한층 높아졌다.${statClause}`,
      ],
      `${storySeed}:awk:${hero.id}`,
    );

    beats.push({
      order: awkOrder,
      priority: 90,
      highlight: {
        kind: 'awakening',
        period: periodLabel,
        tag: '포텐 각성',
        title: `${heroName} 각성 (OVR ${awk.originalOvr}→${afterOvr})`,
        detail: awkDetail,
        metric: `OVR +${awk.ovrGain}`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 9) Longest Win / Unbeaten Streak (exact round window)
  // ---------------------------------------------------------------------------
  if (sortedLeagueMatches.length >= 6) {
    let curWin = 0;
    let curWinStart = 0;
    let maxWin = 0;
    let bestWinStart = 0;
    let bestWinEnd = 0;

    let curUnb = 0;
    let curUnbStart = 0;
    let maxUnb = 0;
    let bestUnbStart = 0;
    let bestUnbEnd = 0;

    for (const m of sortedLeagueMatches) {
      const info = getMatchOutcomeForUser(m, userClubId, clubsById, input.userClubName);
      if (info.outcome === 'W') {
        if (curWin === 0) curWinStart = m.round;
        curWin += 1;
        if (curUnb === 0) curUnbStart = m.round;
        curUnb += 1;
      } else if (info.outcome === 'D') {
        curWin = 0;
        if (curUnb === 0) curUnbStart = m.round;
        curUnb += 1;
      } else {
        curWin = 0;
        curUnb = 0;
      }
      if (curWin > maxWin) {
        maxWin = curWin;
        bestWinStart = curWinStart;
        bestWinEnd = m.round;
      }
      if (curUnb > maxUnb) {
        maxUnb = curUnb;
        bestUnbStart = curUnbStart;
        bestUnbEnd = m.round;
      }
    }

    if (maxWin >= 4 || maxUnb >= 8) {
      const useWin = maxWin >= 5 || maxWin >= Math.floor(maxUnb * 0.55);
      const startR = useWin ? bestWinStart : bestUnbStart;
      const endR = useWin ? bestWinEnd : bestUnbEnd;
      const streakDetail = useWin
        ? pickVariant(
            [
              `${startR}라운드부터 ${endR}라운드까지 내리 ${maxWin}연승을 몰아치며${maxUnb > maxWin ? `(최장 ${maxUnb}경기 무패)` : ''} 순위 경쟁의 흐름을 완전히 가져왔다.`,
              `가장 뜨거운 시기였다. ${startR}R~${endR}R ${maxWin}연승 행진으로 경쟁 팀들과의 간격을 단숨에 벌렸다.`,
            ],
            `${storySeed}:streak:win`,
          )
        : pickVariant(
            [
              `${startR}라운드부터 ${endR}라운드까지 ${maxUnb}경기 동안 단 한 번도 패하지 않는 끈질긴 집중력으로 상위권을 지켰다.`,
              `${startR}R~${endR}R ${maxUnb}경기 연속 무패 — 쉽게 무너지지 않는 팀의 단단함이 가장 잘 드러난 구간이었다.`,
            ],
            `${storySeed}:streak:unb`,
          );

      beats.push({
        order: startR + 0.25,
        priority: 80,
        highlight: {
          kind: 'streak',
          period: `${startR}R ~ ${endR}R`,
          tag: useWin ? '파죽지세 연승' : '무패 질주',
          title: useWin
            ? `${startR}R~${endR}R 리그 ${maxWin}연승`
            : `${startR}R~${endR}R ${maxUnb}경기 연속 무패`,
          detail: streakDetail,
          metric: useWin ? `${maxWin}연승` : `${maxUnb}무패`,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 10) Mid-Season Turning Point: Assistant Coach & Trade Reinforcement
  // ---------------------------------------------------------------------------
  const halfStanding = computeRankAtRound(input.fixtures, userClubId, halfRound);
  const headlineTrade = tradeHistory.find((t) => t.receivedPlayers.length > 0) ?? null;
  if (hiredCoach || halfStanding || headlineTrade) {
    let midTitle = '';
    let midDetail = '';
    const tradeClause = headlineTrade
      ? ` 이적시장에서 ${josa(headlineTrade.receivedPlayers[0].name, '을/를')} 품은 보강까지 더해져`
      : '';
    if (hiredCoach && halfStanding) {
      midTitle = `반환점 ${halfStanding.rank}위 · ${hiredCoach.name} 수석 코치 합류`;
      midDetail = `${halfRound}라운드 반환점을 리그 ${halfStanding.rank}위(${halfStanding.points}점)로 지난 시점에 ${COACH_PROSE[input.staffCoachId!]} ${hiredCoach.name} 수석 코치가 합류했다.${tradeClause} 후반기 경기력이 한결 정돈되며 본격적인 스퍼트에 나섰다.`;
    } else if (hiredCoach) {
      midTitle = `후반기 승부수 · ${hiredCoach.name} 수석 코치 선임`;
      midDetail = `시즌 중반 ${COACH_PROSE[input.staffCoachId!]} ${hiredCoach.name} 수석 코치를 불러들이며${tradeClause ? `,${tradeClause}` : ''} 후반기 반전의 발판을 다졌다.`;
    } else if (headlineTrade) {
      midTitle = `${headlineTrade.round}R 이적 보강 · ${headlineTrade.receivedPlayers[0].name} 합류`;
      midDetail = `${headlineTrade.round}라운드 이적시장에서 ${headlineTrade.partnerClubName}와의 트레이드로 ${josa(headlineTrade.receivedPlayers[0].name, '을/를')} 영입하며 스쿼드의 약점을 정조준했다.`;
    } else if (halfStanding && finalRank > 0) {
      const surged = halfStanding.rank - finalRank;
      if (surged >= 2) {
        midTitle = `반환점 ${halfStanding.rank}위에서 시작된 후반기 추격`;
        midDetail = `전반기를 ${halfStanding.rank}위(${halfStanding.points}점)로 마쳤지만, 후반기 들어 뒷심이 살아나며 끝내 ${finalRank}위까지 순위를 끌어올렸다.`;
      } else if (halfStanding.rank === 1) {
        midTitle = `반환점 선두(${halfStanding.points}점) 수성`;
        midDetail = `전반기 ${halfRound}경기를 리그 1위(${halfStanding.points}점)로 통과하며 우승 레이스의 주도권을 지켰다.`;
      }
    }
    if (midTitle && midDetail) {
      beats.push({
        order: halfRound + 0.35,
        priority: 79,
        highlight: {
          kind: 'turning_point',
          period: `반환점 (${halfRound}R)`,
          tag: '시즌 분수령',
          title: midTitle,
          detail: midDetail,
          metric: halfStanding
            ? `${halfStanding.rank}위 · ${halfStanding.points}점`
            : hiredCoach?.shortBadge,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 11) Greatest Comeback & Biggest Win across all competitions
  // ---------------------------------------------------------------------------
  let bestComeback: {
    match: MatchResult;
    deficit: number;
    ug: number;
    og: number;
    htU: number;
    htO: number;
    oppName: string;
  } | null = null;
  let biggestWin: {
    match: MatchResult;
    margin: number;
    ug: number;
    og: number;
    oppName: string;
  } | null = null;

  for (const m of allMatches) {
    const info = getMatchOutcomeForUser(m, userClubId, clubsById, input.userClubName);
    if (
      info.ug > info.og &&
      typeof info.htU === 'number' &&
      typeof info.htO === 'number' &&
      info.htO > info.htU
    ) {
      const deficit = info.htO - info.htU;
      const bonus = m.competition === 'ucl' ? 0.5 : m.competition === 'cup' ? 0.3 : 0;
      const prevScore = bestComeback
        ? bestComeback.deficit +
          (bestComeback.match.competition === 'ucl'
            ? 0.5
            : bestComeback.match.competition === 'cup'
              ? 0.3
              : 0)
        : -1;
      if (deficit + bonus > prevScore) {
        bestComeback = {
          match: m,
          deficit,
          ug: info.ug,
          og: info.og,
          htU: info.htU,
          htO: info.htO,
          oppName: info.oppName,
        };
      }
    }
    if (info.ug > info.og && !usedMatchIds.has(m.fixtureId)) {
      const margin = info.ug - info.og;
      if (
        !biggestWin ||
        margin > biggestWin.margin ||
        (margin === biggestWin.margin && info.ug > biggestWin.ug)
      ) {
        biggestWin = {
          match: m,
          margin,
          ug: info.ug,
          og: info.og,
          oppName: info.oppName,
        };
      }
    }
  }

  if (bestComeback) {
    usedMatchIds.add(bestComeback.match.fixtureId);
    const scorers = formatGoalScorerList(bestComeback.match, userClubId).slice(0, 3);
    const compTag =
      bestComeback.match.competitionLabel ??
      (bestComeback.match.competition === 'ucl'
        ? 'UCL'
        : bestComeback.match.competition === 'cup'
          ? input.cup?.meta.koreanName ?? '컵대회'
          : `${bestComeback.match.round}R`);
    const cbOrder =
      bestComeback.match.competition === 'ucl'
        ? input.totalRounds + 3
        : bestComeback.match.competition === 'cup'
          ? input.totalRounds - 4
          : bestComeback.match.round + 0.4;
    beats.push({
      order: cbOrder,
      priority: 83,
      highlight: {
        kind: 'comeback',
        period: compTag,
        tag: bestComeback.deficit >= 2 ? '극적인 대역전극' : '후반 역전 명승부',
        title: `${compTag} ${bestComeback.oppName}전 ${bestComeback.htU}-${bestComeback.htO} → ${bestComeback.ug}-${bestComeback.og} 뒤집기`,
        detail:
          bestComeback.deficit >= 2
            ? `전반을 ${bestComeback.htU}-${bestComeback.htO}로 끌려가며 패색이 짙었지만, 후반전 거센 반격${scorers.length > 0 ? `(${scorers.join(', ')})` : ''}으로 승부를 통쾌하게 뒤집으며 포기하지 않는 저력을 증명했다.`
            : `전반 열세(${bestComeback.htU}-${bestComeback.htO})를 딛고 후반 집중력${scorers.length > 0 ? `(${scorers.join(', ')})` : ''}으로 ${bestComeback.ug}-${bestComeback.og} 역전승을 일궈낸 명승부였다.`,
        metric: `HT ${bestComeback.htU}-${bestComeback.htO}`,
      },
    });
  }

  if (
    biggestWin &&
    biggestWin.margin >= 3 &&
    !usedMatchIds.has(biggestWin.match.fixtureId)
  ) {
    usedMatchIds.add(biggestWin.match.fixtureId);
    const scorers = formatGoalScorerList(biggestWin.match, userClubId).slice(0, 3);
    const compTag =
      biggestWin.match.competitionLabel ??
      (biggestWin.match.competition === 'ucl'
        ? 'UCL'
        : biggestWin.match.competition === 'cup'
          ? input.cup?.meta.koreanName ?? '컵대회'
          : `${biggestWin.match.round}R`);
    const bwOrder =
      biggestWin.match.competition === 'ucl'
        ? input.totalRounds + 2
        : biggestWin.match.competition === 'cup'
          ? input.totalRounds - 5
          : biggestWin.match.round + 0.45;
    beats.push({
      order: bwOrder,
      priority: 72,
      highlight: {
        kind: 'best_match',
        period: compTag,
        tag: '화력 폭발 대승',
        title: `${compTag} ${biggestWin.oppName}전 ${biggestWin.ug}-${biggestWin.og} 압승`,
        detail: `${josa(biggestWin.oppName, '을/를')} 상대로 ${biggestWin.ug}골을 몰아치며${scorers.length > 0 ? `(${scorers.join(', ')})` : ''} 시즌 최다 점수 차 완승으로 공격 전개의 위력을 과시했다.`,
        metric: `+${biggestWin.margin}골 차`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 12) Domestic Cup: Title, Heartbreaking Final Loss, OR Early Exit (Task 3)
  // ---------------------------------------------------------------------------
  if (input.cup && input.userCupMatchHistory.length > 0) {
    const cupFinalNode = input.cup.rounds.final.find(
      (m) =>
        m.result &&
        (m.homeTeamId === userClubId || m.awayTeamId === userClubId),
    );
    const cupFinalMatch = cupFinalNode?.result ?? null;
    if (cupFinalMatch) {
      const info = getMatchOutcomeForUser(
        cupFinalMatch,
        userClubId,
        clubsById,
        input.userClubName,
      );
      const scorers = formatGoalScorerList(cupFinalMatch, userClubId).slice(0, 3);
      const hasPk = Boolean(cupFinalMatch.extraTime?.penalties);
      beats.push({
        order: input.totalRounds - 2.2,
        priority: 88,
        highlight: {
          kind: cupWon ? 'cup_final' : 'setback',
          period: `${input.cup.meta.koreanName} 결승`,
          tag: cupWon ? '컵대회 우승' : '아쉬운 컵 준우승',
          title: `${input.cup.meta.koreanName} 결승 vs ${info.oppName} (${info.ug}-${info.og}${hasPk ? ' PK' : ''})`,
          detail: cupWon
            ? hasPk
              ? `연장 혈투 끝 승부차기에서 ${josa(info.oppName, '을/를')} 따돌리며 ${input.cup.meta.koreanName} 트로피를 들어 올렸다.`
              : `결승에서 ${josa(info.oppName, '을/를')} ${info.ug}-${info.og}로 제압하며${scorers.length > 0 ? `(${scorers.join(', ')})` : ''} 값진 ${input.cup.meta.koreanName} 정상에 올랐다.`
            : `치열한 토너먼트를 뚫고 결승 무대까지 올랐으나, ${info.oppName}에 ${info.ug}-${info.og}${hasPk ? '(PK)' : ''}로 무릎 꿇으며 우승 문턱에서 눈물을 삼켰다.`,
          metric: cupWon ? '우승' : '준우승',
        },
      });
    } else if (!cupWon) {
      // Capture painful early cup elimination!
      const lastCupMatch =
        input.userCupMatchHistory[input.userCupMatchHistory.length - 1];
      const info = getMatchOutcomeForUser(
        lastCupMatch,
        userClubId,
        clubsById,
        input.userClubName,
      );
      if (info.outcome === 'L') {
        const stageLabel = lastCupMatch.competitionLabel ?? `${input.cup.meta.koreanName} 토너먼트`;
        beats.push({
          order: Math.max(12, Math.min(input.totalRounds - 3, lastCupMatch.round || halfRound + 4)),
          priority: 77,
          highlight: {
            kind: 'setback',
            period: stageLabel,
            tag: '컵대회 조기 탈락',
            title: `${stageLabel} ${info.oppName}전 ${info.ug}-${info.og}${info.lostOnPk ? ' PK' : ''} 탈락`,
            detail: `${input.cup.meta.koreanName}에서 ${josa(info.oppName, '을/를')} 넘지 못하며 예상보다 일찍 컵 여정을 접었다. 대신 남은 에너지를 리그 레이스에 온전히 쏟아부어야 했다.`,
            metric: '탈락',
          },
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 13) League Climax: Title Clinch / Underdog Finish / Bittersweet Miss
  // ---------------------------------------------------------------------------
  const clinch = findTitleClinchingMatch({
    fixtures: input.fixtures,
    standings: input.standings,
    userClubId,
    totalRounds: input.totalRounds,
    clubsById,
  });

  if (clinch && userRow) {
    const scorers = formatGoalScorerList(clinch.match, userClubId).slice(0, 3);
    const runnerUp = input.standings[1];
    const gap = runnerUp ? userRow.points - runnerUp.points : 0;
    const unbeatenClause =
      userRow.lost === 0
        ? ` 단 1패도 허용하지 않은 완벽한 무패 우승(${userRow.won}승 ${userRow.drawn}무)이었다.`
        : runnerUp && gap > 0
          ? ` 2위 ${josa(runnerUp.teamName, '을/를')} 승점 ${gap}점 차로 따돌린 결실이었다.`
          : '';
    beats.push({
      order: clinch.round + 0.5,
      priority: 96,
      highlight: {
        kind: 'title_match',
        period: clinch.isFinalDay ? `최종전 (${clinch.round}R)` : `${clinch.round}R`,
        tag: userRow.lost === 0 ? '무패 우승 확정' : clinch.isFinalDay ? '최종전 우승' : '조기 우승 확정',
        title: `${clinch.round}R ${clinch.opponentName}전 ${clinch.userGoals}-${clinch.oppGoals}로 ${input.leagueName} 제패`,
        detail: `${clinch.isFinalDay ? '마지막 라운드까지 이어진 숨 막히는 경쟁 끝에 ' : `${input.totalRounds - clinch.round}경기를 남기고 `}${clinch.opponentName}전 ${clinch.userGoals}-${clinch.oppGoals}${scorers.length > 0 ? `(${scorers.join(', ')})` : ''}로 리그 우승에 마침표를 찍었다.${unbeatenClause}`,
        metric: `${userRow.points}점 · 1위`,
      },
    });
  } else if (finalRank > 0 && userRow) {
    const rankDelta =
      typeof expectedRank === 'number' ? expectedRank - finalRank : 0;
    const leader = input.standings[0];
    const gapToFirst = leader ? leader.points - userRow.points : 0;
    if (rankDelta >= 3) {
      beats.push({
        order: input.totalRounds + 0.5,
        priority: 92,
        highlight: {
          kind: 'overachieve',
          period: '리그 피날레',
          tag: '언더독 반란 결실',
          title: `예상 ${expectedRank}위 전력으로 ${input.leagueName} ${finalRank}위 돌파`,
          detail: `개막 전 예상 ${expectedRank}위였던 전력을 팀 조직력으로 끌어올리며, 끝내 승점 ${userRow.points}점(${userRow.won}승 ${userRow.drawn}무 ${userRow.lost}패)으로 ${rankDelta}계단 뛰어오른 ${finalRank}위로 시즌을 마감했다.`,
          metric: `+${rankDelta}계단`,
        },
      });
    } else if (finalRank === 1) {
      const runnerUp = input.standings[1];
      const gap = runnerUp ? userRow.points - runnerUp.points : 0;
      beats.push({
        order: input.totalRounds + 0.5,
        priority: 96,
        highlight: {
          kind: 'title_match',
          period: '리그 피날레',
          tag: userRow.lost === 0 ? '무패 우승' : '리그 제패',
          title: `${input.leagueName} 정상 등극 (${userRow.points}점 · ${userRow.won}승 ${userRow.drawn}무 ${userRow.lost}패)`,
          detail:
            userRow.lost === 0
              ? `시즌 내내 단 1패도 허용하지 않은 압도적 경기력으로 ${input.leagueName} 무패 우승을 완성했다.`
              : runnerUp
                ? `2위 ${josa(runnerUp.teamName, '을/를')} 승점 ${gap}점 차로 따돌리며 마침내 ${input.leagueName} 트로피를 들어 올렸다.`
                : `긴 레이스 내내 흔들리지 않으며 ${input.leagueName} 정상을 지켜냈다.`,
          metric: `득실 ${userRow.goalDifference >= 0 ? '+' : ''}${userRow.goalDifference}`,
        },
      });
    } else if (finalRank === 2 && gapToFirst <= 4 && leader) {
      beats.push({
        order: input.totalRounds + 0.5,
        priority: 92,
        highlight: {
          kind: 'setback',
          period: '리그 피날레',
          tag: '아쉬운 준우승',
          title: `${input.leagueName} 2위 마감 (선두 ${leader.teamName}와 ${gapToFirst}점 차)`,
          detail: `끝까지 우승 경쟁을 펼쳤지만 승점 ${gapToFirst}점 차라는 한 끗 벽을 넘지 못한 채 ${userRow.points}점(${userRow.won}승 ${userRow.drawn}무 ${userRow.lost}패)으로 아쉬운 준우승에 머물렀다.`,
          metric: `${userRow.points}점 · 2위`,
        },
      });
    } else if (rankDelta <= -3 && typeof expectedRank === 'number') {
      beats.push({
        order: input.totalRounds + 0.5,
        priority: 90,
        highlight: {
          kind: 'setback',
          period: '리그 피날레',
          tag: '기대 미달의 벽',
          title: `${input.leagueName} ${finalRank}위 마감 (예상 ${expectedRank}위 대비 ${Math.abs(rankDelta)}계단 하락)`,
          detail: `개막 전 상위권 기대(${expectedRank}위)에 미치지 못한 채 ${userRow.won}승 ${userRow.drawn}무 ${userRow.lost}패(${userRow.points}점)로 시즌을 접으며 뼈아픈 숙제를 남겼다.`,
          metric: `${userRow.points}점 · ${finalRank}위`,
        },
      });
    } else {
      beats.push({
        order: input.totalRounds + 0.5,
        priority: 88,
        highlight: {
          kind: 'overachieve',
          period: '리그 피날레',
          tag: finalRank <= 4 ? 'UCL 진출권 확보' : '리그 완주',
          title: `${input.leagueName} ${finalRank}위 마감 (${userRow.points}점)`,
          detail: `${userRow.played}라운드 대장정을 ${userRow.won}승 ${userRow.drawn}무 ${userRow.lost}패(득실 ${userRow.goalDifference >= 0 ? '+' : ''}${userRow.goalDifference})로 마무리하며${finalRank <= 4 ? ' 당당히 다음 시즌 유럽 무대 티켓을 거머쥐었다.' : ' 굴곡 많았던 한 시즌의 여정을 끝마쳤다.'}`,
          metric: `${userRow.points}점`,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 14) UEFA Champions League: Deep Run, Final, OR Painful Exit (Task 3)
  // ---------------------------------------------------------------------------
  if (input.ucl && input.ucl.userParticipated !== false) {
    const sfTie = input.ucl.ties.sf.find(
      (t) => t.teamAId === userClubId || t.teamBId === userClubId,
    );
    if (sfTie && sfTie.winnerId === userClubId) {
      const oppId = sfTie.teamAId === userClubId ? sfTie.teamBId : sfTie.teamAId;
      const oppName = getTeamDisplayName(oppId, clubsById, input.userClubName);
      const userAgg =
        sfTie.teamAId === userClubId ? sfTie.aggTeamA : sfTie.aggTeamB;
      const oppAgg =
        sfTie.teamAId === userClubId ? sfTie.aggTeamB : sfTie.aggTeamA;
      beats.push({
        order: input.totalRounds + 3.5,
        priority: 85,
        highlight: {
          kind: 'turning_point',
          period: 'UCL 4강',
          tag: '유럽 결승행',
          title: `챔피언스리그 4강에서 ${oppName} 격파 (합산 ${userAgg}-${oppAgg})`,
          detail: `유럽 최강을 가리는 준결승 1·2차전에서 ${josa(oppName, '을/를')} 합산 ${userAgg}-${oppAgg}로 따돌리며 대망의 결승 무대에 올랐다.`,
          metric: `합산 ${userAgg}-${oppAgg}`,
        },
      });
    }

    const uclFinalMatch = input.ucl.ties.final[0]?.leg1 ?? null;
    if (
      uclFinalMatch &&
      (uclFinalMatch.homeTeamId === userClubId ||
        uclFinalMatch.awayTeamId === userClubId)
    ) {
      const info = getMatchOutcomeForUser(
        uclFinalMatch,
        userClubId,
        clubsById,
        input.userClubName,
      );
      const userGoalsEv = [
        ...uclFinalMatch.events,
        ...(uclFinalMatch.extraTime?.etEvents ?? []),
      ].filter((e) => e.type === 'goal' && e.teamId === userClubId);
      const lastGoal = userGoalsEv[userGoalsEv.length - 1];
      const hasPenalties = Boolean(uclFinalMatch.extraTime?.penalties);
      const isLateDrama = Boolean(lastGoal && lastGoal.minute >= 80 && uclWon);
      const scorers = formatGoalScorerList(uclFinalMatch, userClubId).slice(0, 3);

      beats.push({
        order: input.totalRounds + 5,
        priority: 97,
        highlight: {
          kind: uclWon ? 'ucl_final' : 'setback',
          period: 'UCL 결승',
          tag: uclWon
            ? isLateDrama
              ? '챔스 결승 극장골'
              : '유럽 정상 등극'
            : '아쉬운 UCL 준우승',
          title: `챔피언스리그 결승 vs ${info.oppName} (${info.ug}-${info.og}${hasPenalties ? ' PK' : ''})`,
          detail: uclWon
            ? hasPenalties
              ? `120분 혈투 끝에 이어진 승부차기에서 끝내 ${josa(info.oppName, '을/를')} 꺾고 빅이어를 하늘 높이 들어 올렸다.`
              : isLateDrama && lastGoal?.scorerName
                ? `후반 ${lastGoal.minute}분, ${lastGoal.scorerName}의 극적인 결승골이 터지며 ${josa(info.oppName, '을/를')} 무너뜨리고 유럽 정상에 섰다.`
                : `${scorers.length > 0 ? `${scorers.join(', ')}의 득점포를 앞세워 ` : '완벽한 경기 운영으로 '}${josa(info.oppName, '을/를')} ${info.ug}-${info.og}로 제압하며 꿈에 그리던 빅이어를 품에 안았다.`
            : `유럽 최강 클럽들을 뚫고 결승 무대까지 오르는 투혼을 발휘했으나, 마지막 문턱에서 ${info.oppName}의 벽을 넘지 못하고 빅이어를 눈앞에서 놓쳤다.`,
          metric: uclWon ? '우승' : '준우승',
        },
      });
    } else if (!uclWon && input.ucl.completed) {
      // Capture painful UCL knockout or League Phase elimination!
      const checkTieElim = (
        ties: UclTournamentState['ties']['sf'],
        stageName: string,
      ) => {
        const tie = ties.find(
          (t) =>
            (t.teamAId === userClubId || t.teamBId === userClubId) &&
            t.winnerId &&
            t.winnerId !== userClubId,
        );
        if (!tie) return false;
        const oppId = tie.teamAId === userClubId ? tie.teamBId : tie.teamAId;
        const oppName = getTeamDisplayName(oppId, clubsById, input.userClubName);
        const userAgg = tie.teamAId === userClubId ? tie.aggTeamA : tie.aggTeamB;
        const oppAgg = tie.teamAId === userClubId ? tie.aggTeamB : tie.aggTeamA;
        beats.push({
          order: input.totalRounds + 4.2,
          priority: 87,
          highlight: {
            kind: 'setback',
            period: `UCL ${stageName}`,
            tag: `UCL ${stageName} 탈락`,
            title: `챔피언스리그 ${stageName}에서 ${oppName}에 고배 (합산 ${userAgg}-${oppAgg})`,
            detail: `유럽 무대 ${stageName}에서 만난 ${oppName}의 높은 벽에 합산 ${userAgg}-${oppAgg}로 막히며 빅이어 도전을 아쉽게 멈춰야 했다.`,
            metric: `합산 ${userAgg}-${oppAgg}`,
          },
        });
        return true;
      };

      const capturedKo =
        checkTieElim(input.ucl.ties.sf, '4강') ||
        checkTieElim(input.ucl.ties.qf, '8강') ||
        checkTieElim(input.ucl.ties.r16, '16강') ||
        checkTieElim(input.ucl.ties.playoff, '플레이오프');

      if (!capturedKo && input.userUclMatchHistory.length > 0) {
        const lpRank =
          input.ucl.standings.findIndex((r) => r.teamId === userClubId) + 1;
        if (lpRank > 24) {
          beats.push({
            order: input.totalRounds + 3.2,
            priority: 84,
            highlight: {
              kind: 'setback',
              period: 'UCL 리그 페이즈',
              tag: 'UCL 조기 탈락',
              title: `UCL 리그 페이즈 ${lpRank}위 · 토너먼트 진출 실패`,
              detail: `유럽 무대의 높은 벽을 실감하며 리그 페이즈 ${lpRank}위에 머물렀고, 24강 토너먼트 문턱을 끝내 넘지 못한 채 도전을 마감했다.`,
              metric: `${lpRank}위 탈락`,
            },
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 15) Epilogue: Retrospective Documentary Closing (Varied Focus!)
  // ---------------------------------------------------------------------------
  let epilogueTitle = '';
  let epilogueDetail = '';
  let epilogueMetric: string | undefined;

  if (isTreble) {
    epilogueTitle = `${input.userClubName}, 3관왕으로 완성한 구단 최고의 시즌`;
    epilogueDetail = hadMajorCrisis
      ? `순탄하기만 한 길은 아니었지만 매 고비마다 더 단단해진 팀이 결국 ${input.leagueName}·${input.cup?.meta.koreanName ?? '자국 컵'}·UCL 3관왕이라는 완벽한 마침표를 찍었다.`
      : aceStat
        ? `${aceStat.goals}골 ${aceStat.assists}도움(평점 ${aceStat.avgRating.toFixed(2)})을 몰아친 ${josa(aceStat.playerName, '을/를')} 비롯한 스쿼드 전원의 헌신 속에 트레블의 밤이 완성됐다.`
        : `리그, 자국 컵, 챔피언스리그를 모두 품으며 구단 역사에 길이 남을 시즌의 막을 내렸다.`;
    epilogueMetric = '👑 트레블';
  } else if (hadCrisisRebound && (finalRank === 1 || uclWon || cupWon)) {
    epilogueTitle = `흔들려도 꺾이지 않았던 ${input.userClubName}의 한 해`;
    epilogueDetail = pickVariant(
      [
        `슬럼프와 위기의 순간마다 포기하지 않고 해법을 찾아낸 끝에 트로피로 보상받았다. 단순한 우승을 넘어 팀의 단단한 정체성을 증명한 시즌이었다.`,
        `돌아보면 가장 힘들었던 고비가 오히려 팀을 하나로 묶어준 전환점이었다. 굴곡 끝에 들어 올린 우승컵은 어느 때보다 값졌다.`,
      ],
      `${storySeed}:epi:rebound_win`,
    );
    epilogueMetric = finalRank === 1 ? '🏆 반등 우승' : '🏆 트로피';
  } else if (attackDuoNames.length >= 2 && stableHash(`${storySeed}:epi`) % 3 === 0) {
    epilogueTitle = `시즌을 이끈 쌍포 · ${joinPair(attackDuoNames[0], attackDuoNames[1])}`;
    epilogueDetail = `${joinPair(attackDuoNames[0], attackDuoNames[1])}의 꾸준한 호흡과 팀 전체의 조직력이 어우러지며 ${input.userClubName}만의 색깔이 또렷하게 남은 시즌이었다.`;
    epilogueMetric = userRow ? `${userRow.goalsFor}득점` : undefined;
  } else if (aceStat) {
    epilogueTitle = `시즌의 얼굴 · ${aceStat.playerName} (${aceStat.goals}골 ${aceStat.assists}도움)`;
    epilogueDetail = pickVariant(
      [
        `공식전 ${aceStat.appearances}경기 ${aceStat.goals}골 ${aceStat.assists}도움(평균 평점 ${aceStat.avgRating.toFixed(2)})을 남긴 ${josa(aceStat.playerName, '이/가')} 기쁨과 고비의 순간을 모두 함께하며 한 시즌의 막을 내렸다.`,
        `좋은 날에도, 힘들었던 날에도 피치 중심을 지킨 ${aceStat.playerName}(${aceStat.goals}G ${aceStat.assists}A · 평점 ${aceStat.avgRating.toFixed(2)})과 함께 ${input.userClubName}의 시즌이 기록으로 남았다.`,
      ],
      `${storySeed}:epi:ace`,
    );
    epilogueMetric = `${aceStat.goals}G ${aceStat.assists}A`;
  } else {
    epilogueTitle = `${input.userClubName}의 시즌을 돌아보며`;
    epilogueDetail = `환호와 아쉬움이 교차했던 긴 여정 끝에, ${input.formation} 전술 아래 다져진 팀의 색깔이 또렷한 기억으로 남았다.`;
  }

  beats.push({
    order: input.totalRounds + 10,
    priority: 100,
    highlight: {
      kind: isTreble ? 'epilogue' : hadCrisisRebound ? 'epilogue' : 'ace',
      period: '에필로그',
      tag: isTreble ? '전설의 완성' : '시즌 회고',
      title: epilogueTitle,
      detail: epilogueDetail,
      metric: epilogueMetric,
    },
  });

  // Curate top 10 highest-priority beats, then sort strictly chronologically
  const curated =
    beats.length > 10
      ? [...beats]
          .sort((a, b) => b.priority - a.priority || a.order - b.order)
          .slice(0, 10)
          .sort((a, b) => a.order - b.order)
      : [...beats].sort((a, b) => a.order - b.order);

  const intro = generateCompactTeamIntro({
    clubName: input.userClubName,
    managerName: input.managerName,
    managerTraitId: input.managerTraitId,
    managerRating: input.managerRating,
    staffCoachId: input.staffCoachId,
    formation: input.formation,
    tactic: input.tactic,
    baseAvgOvr: input.baseAvgOvr,
    effectiveOvr: input.effectiveOvr,
    chemistry: input.chemistry,
    awakenedCount: awakenedPlayers.length,
    classicCount: classicPlayers.length,
    ffpTier: input.ffpTier,
    leagueName: input.leagueName,
    finalRank: finalRank > 0 ? finalRank : undefined,
    expectedRank,
    leaguePoints: userRow?.points,
    leaguePlayed: userRow?.played ?? input.totalRounds,
    goalsFor: userRow?.goalsFor,
    goalsAgainst: userRow?.goalsAgainst,
    losses: userRow?.lost,
    cupWon,
    cupName: input.cup?.meta.koreanName,
    uclWon,
    isTreble,
    aceName: aceStat?.playerName,
    aceGoals: aceStat?.goals,
    aceAssists: aceStat?.assists,
    awakenedNames: awakenedPlayers.map((p) => formatPlayerRecordName(p)),
    classicNames: classicPlayers.map((p) => formatPlayerRecordName(p)),
    defAnchorName:
      defAnchorStat?.playerName ??
      (defAnchorFallback ? formatPlayerRecordName(defAnchorFallback) : undefined),
    attackDuoNames,
    midfieldAxisNames,
    defenseLineNames,
    trioNames,
    rotationBenchContributors,
    managerSynergyCount: computedManagerSynergyCount,
    hasCrisisRebound: hadCrisisRebound,
  });

  return {
    intro,
    highlights: curated.map((b) => b.highlight),
  };
}

// =============================================================================
// Fallback Story Resolvers for Archived HOF & Daily Ranking Entries
// =============================================================================

function isLegacyDryIntro(intro: string): boolean {
  return (
    intro.includes('으로 완성한 팀(') ||
    intro.includes('조합으로 시즌 색깔을 각인시켰다')
  );
}

/**
 * Deterministically builds a TeamSeasonStory fallback for archived HallOfFameEntry
 * records created before `teamStory` was serialized (or upgrades legacy v9.5 dry intros).
 */
export function resolveHofTeamStory(entry: HallOfFameEntry): TeamSeasonStory {
  const existing = entry.teamStory;
  if (existing && existing.intro && !isLegacyDryIntro(existing.intro)) {
    return existing;
  }

  const allSquad = [...entry.starters, ...entry.bench];
  const awakened = allSquad.filter((p) => Boolean(p.awakening));
  const classics = allSquad.filter((p) => p.isLegend);
  const sortedByGA = [...allSquad].sort(
    (a, b) => b.goals + b.assists - (a.goals + a.assists) || b.avgRating - a.avgRating,
  );
  const topAce = sortedByGA[0];
  const attackDuoNames = sortedByGA
    .filter((p) => p.position === 'FW' || p.position === 'MF')
    .slice(0, 2)
    .map((p) => p.name);
  const midfieldAxisNames = [...allSquad]
    .filter((p) => p.position === 'MF')
    .sort((a, b) => b.avgRating - a.avgRating || b.ovr - a.ovr)
    .slice(0, 2)
    .map((p) => p.name);
  const defSorted = [...allSquad]
    .filter((p) => p.position === 'DF' || p.position === 'GK')
    .sort((a, b) => b.avgRating - a.avgRating || b.ovr - a.ovr);
  const defAnchor = defSorted[0];
  const defenseLineNames = defSorted.slice(0, 2).map((p) => p.name);
  const trioNames = [...allSquad]
    .sort((a, b) => b.avgRating - a.avgRating || b.ovr - a.ovr)
    .slice(0, 3)
    .map((p) => p.name);

  const intro = generateCompactTeamIntro({
    clubName: entry.userClub.name,
    managerName: entry.managerName,
    managerTraitId: entry.managerTraitId,
    managerRating: entry.managerRating,
    staffCoachId: entry.staffCoachId,
    formation: entry.formation,
    tactic: entry.defaultTactic,
    baseAvgOvr: entry.teamAvgOvr,
    effectiveOvr:
      entry.avgSynergyOvrBonus !== undefined
        ? Math.round((entry.teamAvgOvr + entry.avgSynergyOvrBonus) * 10) / 10
        : undefined,
    chemistry: entry.chemistry,
    awakenedCount: awakened.length,
    classicCount: classics.length,
    ffpTier: entry.seasonScore.ffpTier,
    leagueName: entry.leagueKoreanName,
    finalRank: entry.finalLeagueRank,
    leaguePoints: entry.leaguePoints,
    leaguePlayed: entry.leagueTotalRounds,
    cupWon: entry.cupWon,
    cupName: entry.cupName,
    uclWon: entry.uclWon,
    isTreble: entry.isTreble,
    aceName: topAce?.name,
    aceGoals: topAce?.goals,
    aceAssists: topAce?.assists,
    awakenedNames: awakened.map((p) => p.name),
    classicNames: classics.map((p) => p.name),
    defAnchorName: defAnchor?.name,
    attackDuoNames,
    midfieldAxisNames,
    defenseLineNames,
    trioNames,
    managerSynergyCount: entry.managerSynergyCount,
  });

  const highlights: TeamStoryHighlight[] = [];
  const history = entry.matchHistory ?? [];

  const heavyLoss = [...history]
    .filter((m) => m.outcome === 'L')
    .sort(
      (a, b) =>
        b.oppGoals - b.userGoals - (a.oppGoals - a.userGoals) ||
        b.oppGoals - a.oppGoals,
    )[0];
  if (heavyLoss && heavyLoss.oppGoals - heavyLoss.userGoals >= 2) {
    highlights.push({
      kind: 'setback',
      period: heavyLoss.label,
      tag: '시즌의 고비',
      title: `${heavyLoss.label} ${heavyLoss.opponentName}전 ${heavyLoss.userGoals}-${heavyLoss.oppGoals} 패배`,
      detail: `${josa(heavyLoss.opponentName, '을/를')} 상대로 ${heavyLoss.userGoals}-${heavyLoss.oppGoals} 패배를 겪으며 시즌 도중 뼈아픈 시험대에 올랐지만, 끝까지 중심을 잃지 않고 레이스를 이어갔다.`,
      metric: `${heavyLoss.userGoals}-${heavyLoss.oppGoals}`,
    });
  }

  const bigWin = [...history]
    .filter((m) => m.outcome === 'W')
    .sort(
      (a, b) =>
        b.userGoals - b.oppGoals - (a.userGoals - a.oppGoals) ||
        b.userGoals - a.userGoals,
    )[0];
  if (bigWin && bigWin.userGoals - bigWin.oppGoals >= 3) {
    highlights.push({
      kind: 'best_match',
      period: bigWin.label,
      tag: '압도적 완승',
      title: `${bigWin.label} ${bigWin.opponentName}전 ${bigWin.userGoals}-${bigWin.oppGoals} 대승`,
      detail: `${josa(bigWin.opponentName, '을/를')} 상대로 ${bigWin.userGoals}골을 터뜨리며${bigWin.scorers.length > 0 ? `(${bigWin.scorers.slice(0, 3).join(', ')})` : ''} 압도적인 경기력을 선보였다.`,
      metric: `+${bigWin.userGoals - bigWin.oppGoals}골 차`,
    });
  }

  if (awakened.length > 0) {
    const topAwakened = [...awakened].sort(
      (a, b) => (b.awakening?.ovrGain ?? 0) - (a.awakening?.ovrGain ?? 0),
    )[0];
    const afterOvr =
      topAwakened.awakening!.originalOvr + topAwakened.awakening!.ovrGain;
    highlights.push({
      kind: 'awakening',
      period: '시즌 중반',
      tag: '포텐 각성',
      title: `${topAwakened.name} 잠재력 폭발 (OVR ${topAwakened.awakening!.originalOvr}→${afterOvr})`,
      detail: `시즌 도중 각성에 성공한 ${josa(topAwakened.name, '이/가')} ${topAwakened.goals}골 ${topAwakened.assists}도움(평균 평점 ${topAwakened.avgRating.toFixed(2)})으로 팀 도약의 결정적 동력이 됐다.`,
      metric: `OVR +${topAwakened.awakening!.ovrGain}`,
    });
  }

  if (entry.isTreble) {
    highlights.push({
      kind: 'title_match',
      period: '시즌 결실',
      tag: '역사적 트레블',
      title: `${entry.leagueKoreanName} · ${entry.cupName} · UCL 3관왕 달성`,
      detail: `${entry.leagueRecord}(${entry.leaguePoints}점)의 탄탄한 레이스에 자국 컵과 유럽 정상까지 더하며 구단 역사에 길이 남을 시즌을 완성했다.`,
      metric: `${entry.seasonScore.totalScore.toLocaleString()} PTS`,
    });
  } else if (entry.isLeagueChampion) {
    highlights.push({
      kind: 'title_match',
      period: '리그 피날레',
      tag: '리그 우승',
      title: `${entry.leagueKoreanName} 정상 등극 (${entry.leaguePoints}점 · ${entry.leagueRecord})`,
      detail: `치열한 경쟁 끝에 ${entry.leagueKoreanName} 트로피를 들어 올렸고, ${entry.cupName} ${entry.cupResultLabel} · UCL ${entry.uclResultLabel}의 성적을 남겼다.`,
      metric: `${entry.leaguePoints}점`,
    });
  }

  const uclFinal = history.find(
    (m) => m.competition === 'ucl' && m.label.includes('결승'),
  );
  if (uclFinal) {
    highlights.push({
      kind: entry.uclWon ? 'ucl_final' : 'setback',
      period: 'UCL 결승',
      tag: entry.uclWon ? 'UCL 우승' : '아쉬운 UCL 준우승',
      title: `챔피언스리그 결승 vs ${uclFinal.opponentName} (${uclFinal.userGoals}-${uclFinal.oppGoals})`,
      detail:
        uclFinal.scorers.length > 0
          ? `${uclFinal.scorers.slice(0, 3).join(', ')}의 활약 속에${uclFinal.note ? `(${uclFinal.note})` : ''} ${entry.uclWon ? '빅이어를 품에 안았다.' : '결승까지 올랐으나 마지막 문턱에서 아쉽게 멈췄다.'}`
          : entry.uclWon
            ? `${josa(uclFinal.opponentName, '을/를')} 제압하며 유럽 정상에 우뚝 섰다.`
            : `유럽 결승까지 오르는 저력을 발휘했으나 우승 문턱을 넘지 못했다.`,
      metric: entry.uclWon ? '우승' : '준우승',
    });
  }

  if (entry.topScorerSummary && entry.topScorerSummary !== '-') {
    highlights.push({
      kind: 'ace',
      period: '에필로그',
      tag: '시즌 회고',
      title: entry.topScorerSummary,
      detail: `매 경기 중심축으로 활약하며 환호와 고비가 교차한 시즌의 여정을 마무리했다.`,
    });
  }

  return {
    intro,
    highlights:
      existing && existing.highlights.length > 0
        ? existing.highlights
        : highlights.slice(0, 6),
  };
}

/**
 * Resolves TeamSeasonStory for a Global/Daily Ranking entry (uses serialized story if present,
 * or synthesizes cleanly from snapshot + breakdown fields).
 */
export function resolveGlobalEntryTeamStory(
  entry: GlobalHofRankingEntry,
): TeamSeasonStory {
  const existing = entry.teamStory ?? entry.squadSnapshot?.teamStory;
  if (existing && existing.intro && !isLegacyDryIntro(existing.intro)) {
    return existing;
  }

  const allSquad = [
    ...(entry.squadSnapshot?.starters ?? []),
    ...(entry.squadSnapshot?.bench ?? []),
  ];
  const awakened = allSquad.filter((p) => Boolean(p.awakening));
  const classics = allSquad.filter((p) => p.isLegend);
  const sortedByGA = [...allSquad].sort(
    (a, b) =>
      (b.goals ?? 0) + (b.assists ?? 0) - ((a.goals ?? 0) + (a.assists ?? 0)) ||
      (b.avgRating ?? 0) - (a.avgRating ?? 0),
  );
  const topAce = sortedByGA[0];
  const attackDuoNames = sortedByGA
    .filter((p) => p.position === 'FW' || p.position === 'MF')
    .slice(0, 2)
    .map((p) => p.name);
  const midfieldAxisNames = [...allSquad]
    .filter((p) => p.position === 'MF')
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.ovr - a.ovr)
    .slice(0, 2)
    .map((p) => p.name);
  const defSorted = [...allSquad]
    .filter((p) => p.position === 'DF' || p.position === 'GK')
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.ovr - a.ovr);
  const defAnchor = defSorted[0];
  const defenseLineNames = defSorted.slice(0, 2).map((p) => p.name);
  const trioNames = [...allSquad]
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.ovr - a.ovr)
    .slice(0, 3)
    .map((p) => p.name);

  const intro = generateCompactTeamIntro({
    clubName: entry.clubName,
    managerName: entry.managerName,
    managerTraitId: entry.managerTraitId,
    managerRating: entry.managerRating,
    staffCoachId: entry.staffCoachId ?? entry.squadSnapshot?.staffCoachId,
    formation: entry.formation,
    tactic: entry.defaultTactic,
    baseAvgOvr: entry.teamAvgOvr,
    effectiveOvr:
      Math.round((entry.teamAvgOvr + entry.avgSynergyOvrBonus) * 10) / 10,
    chemistry: entry.chemistry,
    awakenedCount: awakened.length,
    classicCount: classics.length,
    ffpTier: entry.scoreBreakdown.ffpTier,
    leagueName: entry.leagueKoreanName,
    finalRank: entry.finalLeagueRank,
    leaguePoints: entry.leaguePoints,
    leaguePlayed: entry.leagueTotalRounds,
    cupWon: entry.cupWon,
    cupName: entry.cupName,
    uclWon: entry.uclWon,
    isTreble: entry.isTreble,
    aceName: topAce?.name,
    aceGoals: topAce?.goals,
    aceAssists: topAce?.assists,
    awakenedNames: awakened.map((p) => p.name),
    classicNames: classics.map((p) => p.name),
    defAnchorName: defAnchor?.name,
    attackDuoNames,
    midfieldAxisNames,
    defenseLineNames,
    trioNames,
    managerSynergyCount: entry.managerSynergyCount,
  });

  const highlights: TeamStoryHighlight[] = [];
  if (awakened.length > 0) {
    const hero = [...awakened].sort(
      (a, b) => (b.awakening?.ovrGain ?? 0) - (a.awakening?.ovrGain ?? 0),
    )[0];
    const heroAfterOvr = hero.awakening!.originalOvr + hero.awakening!.ovrGain;
    highlights.push({
      kind: 'awakening',
      period: '시즌 중반',
      tag: '포텐 각성',
      title: `${hero.name}, 잠재력 폭발 (OVR ${hero.awakening!.originalOvr}→${heroAfterOvr})`,
      detail:
        awakened.length > 1
          ? `${josa(hero.name, '을/를')} 비롯한 ${awakened.length}명의 각성 에이스가 시즌 중반부터 스쿼드의 한계를 깨뜨렸다.`
          : `핵심 자원 ${hero.name}의 각성(+${hero.awakening!.ovrGain})이 승부처마다 결정적 돌파구가 됐다.`,
      metric: `OVR +${hero.awakening!.ovrGain}`,
    });
  }

  if (entry.isTreble) {
    highlights.push({
      kind: 'title_match',
      period: '시즌 피날레',
      tag: '트레블 달성',
      title: `${entry.leagueKoreanName} · ${entry.cupName} · UCL 3관왕`,
      detail: `${entry.leagueRecord}(${entry.leaguePoints}점)의 압도적 시즌으로 자국과 유럽을 모두 제패했다.`,
      metric: `${entry.seasonScore.toLocaleString()} PTS`,
    });
  } else if (entry.isLeagueChampion) {
    highlights.push({
      kind: 'title_match',
      period: '리그 피날레',
      tag: '리그 우승',
      title: `${entry.leagueKoreanName} 정상 (${entry.leaguePoints}점 · ${entry.leagueRecord})`,
      detail: `리그 우승과 함께 ${entry.cupName} ${entry.cupResultLabel} · 챔피언스리그 ${entry.uclResultLabel}의 성과를 올렸다.`,
      metric: `${entry.leaguePoints}점`,
    });
  } else {
    highlights.push({
      kind: 'overachieve',
      period: '리그 피날레',
      tag: '시즌 성적',
      title: `${entry.leagueKoreanName} ${entry.finalLeagueRank}위 (${entry.leaguePoints}점)`,
      detail: `${entry.leagueRecord}의 성적과 함께 ${entry.cupName} ${entry.cupResultLabel}, UCL ${entry.uclResultLabel}로 시즌을 마쳤다.`,
      metric: `${entry.seasonScore.toLocaleString()} PTS`,
    });
  }

  if (entry.uclWon) {
    highlights.push({
      kind: 'ucl_final',
      period: 'UCL 결승',
      tag: '유럽 제패',
      title: 'UEFA 챔피언스리그 우승',
      detail: `유럽 최강 클럽들을 연파하며 빅이어를 품에 안았다.`,
      metric: 'UCL 우승',
    });
  } else if (entry.uclResultLabel && entry.uclResultLabel !== '미진출') {
    highlights.push({
      kind: 'setback',
      period: '유럽 무대',
      tag: `UCL ${entry.uclResultLabel}`,
      title: `UEFA 챔피언스리그 ${entry.uclResultLabel} 마감`,
      detail: `유럽 강호들과의 경쟁 속에서 ${entry.uclResultLabel}까지 올랐으나 마지막 벽을 아쉽게 넘지 못했다.`,
      metric: entry.uclResultLabel,
    });
  }

  if (entry.topScorerSummary && entry.topScorerSummary !== '-') {
    highlights.push({
      kind: 'ace',
      period: '에필로그',
      tag: '시즌 회고',
      title: entry.topScorerSummary,
      detail: `감독과의 전술 궁합(${entry.managerSynergyCount}명)과 끈끈한 호흡 속에서 팀 공격을 이끌었다.`,
    });
  }

  return {
    intro,
    highlights:
      existing && existing.highlights.length > 0
        ? existing.highlights
        : highlights.slice(0, 5),
  };
}

export interface MpClubStoryInput {
  clubName: string;
  managerName: string;
  managerTraitId: ManagerTraitId | null;
  staffCoachId?: StaffCoachId | null;
  formation: FormationId;
  tactic: TacticId;
  leagueName: string;
  leagueRank?: number;
  standingRow?: StandingRow | null;
  cupResultLabel?: string;
  uclResultLabel?: string;
  starters: (Player | null)[];
  bench: (Player | null)[];
  baseAvgOvr: number;
  effectiveOvr: number;
  chemistry: number;
  ffpTier?: 0 | 1 | 2;
  teamStats: PlayerSeasonStats[];
  h2hSummary?: { wins: number; draws: number; losses: number } | null;
  leagueAvgOvr?: number;
}

/**
 * Generates an expressive TeamSeasonStory for Multiplayer League clubs in both
 * regular-season summary and final board.
 */
export function generateMpClubTeamStory(input: MpClubStoryInput): TeamSeasonStory {
  const filledStarters = input.starters.filter((p): p is Player => p !== null);
  const squad = [...input.starters, ...input.bench].filter(Boolean) as Player[];
  const awakened = squad.filter((p) => Boolean(p.awakening));
  const classics = squad.filter((p) => p.isLegend);
  const activeStats = input.teamStats.filter((s) => s.appearances > 0);
  const sortedByGA = [...activeStats].sort(
    (a, b) => b.goals + b.assists - (a.goals + a.assists) || b.avgRating - a.avgRating,
  );
  const topScorer = [...activeStats].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists,
  )[0];
  const attackDuoNames = sortedByGA
    .filter((s) => s.position === 'FW' || s.position === 'MF')
    .slice(0, 2)
    .map((s) => s.playerName);
  const midfieldAxisNames = [...activeStats]
    .filter((s) => s.position === 'MF')
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 2)
    .map((s) => s.playerName);
  const defSorted = [...activeStats]
    .filter((s) => s.position === 'DF' || s.position === 'GK')
    .sort((a, b) => b.avgRating - a.avgRating);
  const defAnchor = defSorted[0];
  const defenseLineNames = defSorted.slice(0, 2).map((s) => s.playerName);
  const trioNames = [...activeStats]
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 3)
    .map((s) => s.playerName);
  const rotationBenchContributors = activeStats.filter(
    (s) => s.subAppearances >= 3,
  ).length;
  const managerSynergyCount = input.managerTraitId
    ? filledStarters.filter(
        (p) => evaluateManagerPlayerSynergy(p, input.managerTraitId).isMatch,
      ).length
    : 0;

  const intro = generateCompactTeamIntro({
    clubName: input.clubName,
    managerName: input.managerName,
    managerTraitId: input.managerTraitId,
    staffCoachId: input.staffCoachId,
    formation: input.formation,
    tactic: input.tactic,
    baseAvgOvr: input.baseAvgOvr,
    effectiveOvr: input.effectiveOvr,
    chemistry: input.chemistry,
    awakenedCount: awakened.length,
    classicCount: classics.length,
    ffpTier: input.ffpTier,
    leagueName: input.leagueName,
    finalRank: input.leagueRank,
    leaguePoints: input.standingRow?.points,
    leaguePlayed: input.standingRow?.played,
    goalsFor: input.standingRow?.goalsFor,
    goalsAgainst: input.standingRow?.goalsAgainst,
    losses: input.standingRow?.lost,
    uclWon: Boolean(input.uclResultLabel?.includes('우승')),
    cupWon: Boolean(input.cupResultLabel?.includes('우승')),
    isTreble:
      input.leagueRank === 1 &&
      Boolean(input.cupResultLabel?.includes('우승')) &&
      Boolean(input.uclResultLabel?.includes('우승')),
    aceName: topScorer?.playerName,
    aceGoals: topScorer?.goals,
    aceAssists: topScorer?.assists,
    awakenedNames: awakened.map((p) => formatPlayerRecordName(p)),
    classicNames: classics.map((p) => formatPlayerRecordName(p)),
    defAnchorName: defAnchor?.playerName,
    attackDuoNames,
    midfieldAxisNames,
    defenseLineNames,
    trioNames,
    rotationBenchContributors,
    managerSynergyCount,
  });

  const highlights: TeamStoryHighlight[] = [];

  if (
    input.h2hSummary &&
    input.h2hSummary.wins + input.h2hSummary.draws + input.h2hSummary.losses > 0
  ) {
    const { wins, draws, losses } = input.h2hSummary;
    highlights.push({
      kind: losses > wins ? 'setback' : 'best_match',
      period: '라이벌전',
      tag: losses > wins ? '라이벌전 고전' : '친구 맞대결',
      title: `라이벌 H2H ${wins}승 ${draws}무 ${losses}패`,
      detail:
        wins > losses
          ? `유저 간 정면 승부에서 우위를 점하며 리그 주도권을 단단히 거머쥐었다.`
          : losses > wins
            ? `직접 맞대결에서 ${losses}패를 안으며 쓰라린 고비를 겪었지만, 남은 경기에서 설욕을 노리며 끝까지 싸웠다.`
            : `한 치 양보 없는 라이벌 맞대결 속에서 치열한 순위 싸움을 이어갔다.`,
      metric: `${wins}W ${draws}D ${losses}L`,
    });
  }

  if (awakened.length > 0) {
    const hero = [...awakened].sort(
      (a, b) => (b.awakening?.ovrGain ?? 0) - (a.awakening?.ovrGain ?? 0),
    )[0];
    const heroAfterOvr = hero.awakening!.originalOvr + hero.awakening!.ovrGain;
    const st = input.teamStats.find((s) => s.playerId === hero.id);
    highlights.push({
      kind: 'awakening',
      period: '시즌 중반',
      tag: '포텐 각성 에이스',
      title: `${formatPlayerRecordName(hero)} 각성 (${hero.awakening!.originalOvr}→${heroAfterOvr})`,
      detail: st
        ? `시즌 도중 잠재력을 터뜨린 ${josa(formatPlayerRecordName(hero), '이/가')} ${st.goals}골 ${st.assists}도움(평균 평점 ${st.avgRating.toFixed(2)})으로 팀의 상승세를 이끌었다.`
        : `시즌 중 OVR +${hero.awakening!.ovrGain} 영구 각성을 이뤄내며 팀 전력을 한 단계 끌어올렸다.`,
      metric: `OVR +${hero.awakening!.ovrGain}`,
    });
  }

  if (input.standingRow && input.leagueRank) {
    const r = input.standingRow;
    highlights.push({
      kind:
        input.leagueRank === 1
          ? 'title_match'
          : r.lost >= 10
            ? 'setback'
            : 'overachieve',
      period: '리그 피날레',
      tag:
        input.leagueRank === 1
          ? '리그 우승'
          : r.lost >= 10
            ? '굴곡진 레이스'
            : '리그 성적',
      title: `${input.leagueName} ${input.leagueRank}위 (${r.points}점 · ${r.won}승 ${r.drawn}무 ${r.lost}패)`,
      detail:
        r.lost >= 10
          ? `${r.lost}패의 굴곡 속에서도 ${r.goalsFor}득점 ${r.goalsAgainst}실점을 남기며 끝까지 리그 일정을 완주했다.`
          : `${r.goalsFor}득점 ${r.goalsAgainst}실점(득실 ${r.goalDifference >= 0 ? '+' : ''}${r.goalDifference})의 기록으로 긴 리그 레이스를 완주했다.`,
      metric: `${r.points}점`,
    });
  }

  if (input.uclResultLabel && input.uclResultLabel !== '미진출') {
    const wonUcl = input.uclResultLabel.includes('우승');
    highlights.push({
      kind: wonUcl ? 'ucl_final' : 'setback',
      period: '유럽 무대',
      tag: wonUcl ? 'UCL 우승' : '챔피언스리그',
      title: `UEFA 챔피언스리그 ${input.uclResultLabel}`,
      detail: wonUcl
        ? `유럽 최강 클럽들을 제치고 빅이어를 품에 안으며 최고의 결실을 맺었다.`
        : input.cupResultLabel
          ? `자국 컵 ${input.cupResultLabel}과 병행하며 유럽 무대에 도전했으나 ${input.uclResultLabel}에서 발걸음을 멈췄다.`
          : `유럽 강호들과 맞붙어 ${input.uclResultLabel}의 기록을 남겼다.`,
      metric: input.uclResultLabel,
    });
  }

  if (topScorer && topScorer.goals > 0) {
    highlights.push({
      kind: 'ace',
      period: '에필로그',
      tag: '시즌 회고',
      title: `${topScorer.playerName} (${topScorer.goals}골 ${topScorer.assists}도움)`,
      detail: `평균 평점 ${topScorer.avgRating.toFixed(2)}로 매 경기 팀의 최전방을 책임지며 시즌의 여정에 마침표를 찍었다.`,
      metric: `${topScorer.goals}G`,
    });
  }

  return { intro, highlights: highlights.slice(0, 6) };
}

export function normalizeLeagueIdLabel(leagueId: LeagueId): string {
  switch (leagueId) {
    case 'epl':
      return '프리미어리그';
    case 'laliga':
      return '라리가';
    case 'seriea':
      return '세리에 A';
    case 'bundesliga':
      return '분데스리가';
    case 'ligue1':
      return '리그 1';
  }
}

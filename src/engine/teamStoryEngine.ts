import { MANAGER_TRAITS } from '../data/managerTraits';
import type { DomesticCupState } from '../types/cup';
import type { FormationId, ManagerTraitId, StaffCoachId } from '../types/game';
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
// Korean Josa (조사) & Expressive Prose Helpers
// =============================================================================

function getLastMeaningfulChar(word: string): string {
  const cleaned = word.replace(/[\s)\]}"'.,!?~·]+$/g, '');
  return cleaned.length > 0 ? cleaned[cleaned.length - 1] : '';
}

function getBatchimKind(word: string): 'none' | 'rieul' | 'other' {
  const ch = getLastMeaningfulChar(word);
  if (!ch) return 'none';
  const code = ch.charCodeAt(0);
  // Hangul Syllables (가..힣)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    if (jong === 0) return 'none';
    if (jong === 8) return 'rieul';
    return 'other';
  }
  // ASCII digits: 0(영),1(일),3(삼),6(육),7(칠),8(팔) have batchim; 1,7,8 end with ㄹ
  if (ch >= '0' && ch <= '9') {
    if (ch === '1' || ch === '7' || ch === '8') return 'rieul';
    if (ch === '0' || ch === '3' || ch === '6') return 'other';
    return 'none';
  }
  // English letters fallback
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
    style: '정교한 삼각 패스로 경기의 숨통을 쥐는 점유 철학',
    noun: '티키타카 설계',
    vibe: '숨 쉴 틈 없이 볼을 돌리며 상대를 지치게 만든',
  },
  gegenpress_guru: {
    style: '상대 진영부터 거칠게 몰아치는 전방 압박',
    noun: '게겐프레싱',
    vibe: '90분 내내 쉼 없는 압박으로 상대를 질식시킨',
  },
  catenaccio: {
    style: '한 치의 빈틈도 내주지 않는 빗장 수비와 날카로운 역습',
    noun: '카테나치오',
    vibe: '철벽 같은 수비 블록 뒤에 치명적인 카운터를 숨긴',
  },
  wing_bomber: {
    style: '양 측면을 집요하게 허무는 측면 폭격',
    noun: '측면 전개',
    vibe: '하프스페이스와 터치라인을 쉴 새 없이 가른',
  },
  halftime_wizard: {
    style: '하프타임마다 흐름을 뒤바꾸는 기민한 용병술',
    noun: '후반 반전 설계',
    vibe: '라커룸 지시 하나로 경기 양상을 뒤집곤 했던',
  },
  big_game_hunter: {
    style: '큰 무대일수록 과감해지는 승부사 기질',
    noun: '빅게임 DNA',
    vibe: '강호와의 정면 승부에서 오히려 더 빛났던',
  },
  set_piece_master: {
    style: '코너킥과 프리킥 한 방으로 승부를 가르는 세트피스 디테일',
    noun: '세트피스 전술',
    vibe: '데드볼 상황마다 상대를 공포에 떨게 만든',
  },
  underdog_killer: {
    style: '강팀의 빈틈을 파고드는 자이언트 킬러 본능',
    noun: '거인 사냥 전술',
    vibe: '강호들을 상대로 주눅 들지 않고 맞받아친',
  },
  total_football: {
    style: '포지션의 경계를 허무는 유연한 스위칭',
    noun: '토탈 풋볼',
    vibe: '전원이 유기적으로 자리를 바꿔가며 상대를 흔든',
  },
  galactico_manager: {
    style: '스타 군단의 개성을 하나로 묶는 카리스마',
    noun: '갈락티코 지휘력',
    vibe: '화려한 개인 기량을 하나의 승리 공식으로 빚어낸',
  },
  direct_football: {
    style: '군더더기 없는 종패스와 매서운 직선 마무리',
    noun: '다이렉트 풋볼',
    vibe: '단 몇 번의 패스로 상대 골문을 위협한',
  },
  defensive_architect: {
    style: '빈틈없는 간격으로 실점을 봉쇄하는 수비 건축',
    noun: '단단한 수비 조직력',
    vibe: '좀처럼 골문을 열리지 않게 만든 질식 수비의',
  },
  midfield_maestro: {
    style: '허리 싸움을 완전히 장악하는 중원 지배력',
    noun: '중원 장악력',
    vibe: '경기 템포를 자유자재로 조율하며 흐름을 쥔',
  },
  super_sub: {
    style: '후반 승부처마다 조커 카드로 판을 흔드는 교체 전술',
    noun: '조커 용병술',
    vibe: '벤치에서 꺼내 든 교체 카드 하나로 흐름을 뒤집곤 했던',
  },
};

const TACTIC_PROSE: Record<TacticId, { phrase: string; flavor: string }> = {
  possession: {
    phrase: '점유율 축구',
    flavor: '높은 볼 점유와 촘촘한 패스 전개',
  },
  gegenpressing: {
    phrase: '강한 전방 압박',
    flavor: '높은 라인에서 볼을 빼앗아 곧장 몰아치는 템포',
  },
  counter: {
    phrase: '선수비 후역습',
    flavor: '견고한 수비 블록과 번개 같은 역습 전환',
  },
  wingplay: {
    phrase: '측면 공략',
    flavor: '폭넓은 측면 침투와 날카로운 크로스',
  },
  balanced: {
    phrase: '공수 밸런스 축구',
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
// Expressive Human-Written Team Introduction (Item 3)
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
}

/**
 * Generates an expressive, natural 2~3 sentence football-column style team description
 * (avoiding robotic parenthetical stat dumps) grounded in real tactical & seasonal data.
 */
export function generateCompactTeamIntro(input: CompactTeamIntroInput): string {
  const seed = `${input.clubName}|${input.formation}|${input.tactic}|${input.finalRank ?? 0}|${input.leaguePoints ?? 0}|${input.awakenedCount ?? 0}`;
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
    (gaPerGame !== null && gaPerGame <= 0.72) ||
    input.managerTraitId === 'defensive_architect' ||
    input.managerTraitId === 'catenaccio';
  const isExplosiveAttack = gfPerGame !== null && gfPerGame >= 2.3;
  const isCohesionMachine = effLift >= 2.0 && input.chemistry >= 85;
  const isUnbeatenChamp =
    input.finalRank === 1 && input.losses === 0 && (input.leaguePlayed ?? 0) >= 30;

  const defAnchor = input.defAnchorName?.trim();
  const aceName = input.aceName?.trim();
  const primaryAwakened = input.awakenedNames?.[0]?.trim();
  const primaryClassic = input.classicNames?.[0]?.trim();

  // --- Sentence 1: Team Identity, Tactical Color & Story Angle ---
  let sentence1 = '';
  if (isUnderdogRebellion) {
    const rankClause =
      input.finalRank === 1
        ? `${input.leagueName ? `${input.leagueName} ` : ''}정상을 훔쳐낸 동화 같은 반란의 주인공이다`
        : `${input.leagueName ? `${input.leagueName} ` : ''}${input.finalRank}위까지 치고 오른 통쾌한 반란의 팀이다`;
    sentence1 = pickVariant(
      [
        `개막 전 예상 ${input.expectedRank}위라는 저평가를 비웃듯, ${input.formation} ${tacticInfo.phrase}에 ${traitInfo ? josa(traitInfo.style, '을/를') : '끈끈한 조직력'} 녹여내며 ${rankClause}.`,
        `객관적 전력의 열세를 ${input.formation} ${tacticInfo.phrase}과 몸을 사리지 않는 팀워크로 뒤집으며, 끝내 ${rankClause}.`,
      ],
      `${seed}:s1:underdog`,
    );
  } else if (isIronDefense) {
    const anchorClause = defAnchor
      ? `${josa(defAnchor, '을/를')} 핵심으로 한 단단한 수비력 위에 `
      : '한 치의 흔들림도 없는 수비 조직력 위에 ';
    const gaNote =
      typeof input.goalsAgainst === 'number' && gaPerGame !== null && gaPerGame <= 0.75
        ? `시즌 ${input.goalsAgainst}실점의 철벽 방패로 상대를 숨 막히게 옥죈 팀이다.`
        : `${traitInfo ? `${traitInfo.vibe} ` : ''}질식 수비와 실리적인 경기 운영으로 상대를 제압한 팀이다.`;
    sentence1 = `${anchorClause}${input.formation} ${tacticInfo.phrase}을 정교하게 덧입혀, ${gaNote}`;
  } else if (isExplosiveAttack) {
    const aceLead = aceName ? `${josa(aceName, '을/를')} 선봉에 세워 ` : '';
    sentence1 = pickVariant(
      [
        `${aceLead}${input.formation} 대형에서 뿜어져 나오는 ${tacticInfo.flavor}로 매 경기 상대를 몰아붙인 화력의 팀이다.`,
        `${input.formation} ${tacticInfo.phrase}에 ${traitInfo ? josa(traitInfo.style, '을/를') : '과감한 공격 본능'} 결합해, 시즌 내내 숨 막히는 득점 행진을 펼친 공격 축구의 진수다.`,
      ],
      `${seed}:s1:attack`,
    );
  } else if (isCohesionMachine) {
    sentence1 = pickVariant(
      [
        `화려한 이름값보다 끈끈한 조직력이 먼저 빛났던 팀으로, ${input.formation} ${tacticInfo.phrase} 속에서 ${traitInfo ? `${traitInfo.style}이 ` : ''}완벽히 맞물리며 기대 이상의 실효 전력을 끌어냈다.`,
        `${input.formation} 대형 아래 선수들의 호흡이 하나로 녹아들며, ${traitInfo ? `${traitInfo.vibe} ` : ''}${tacticInfo.flavor}로 한 단계 높은 완성도를 보여준 팀이다.`,
      ],
      `${seed}:s1:cohesion`,
    );
  } else {
    const mgrPrefix =
      traitInfo && input.managerName
        ? `${input.managerName} 감독의 ${traitInfo.style}`
        : traitInfo
          ? traitInfo.style
          : traitName
            ? `${traitName}의 전술 철학`
            : input.managerName
              ? `${input.managerName} 감독의 지휘`
              : '탄탄한 전술 설계';
    sentence1 = `${josa(mgrPrefix, '을/를')} ${input.formation} ${tacticInfo.phrase}으로 구현해내며, ${tacticInfo.flavor}로 뚜렷한 팀 색깔을 각인시킨 팀이다.`;
  }

  // --- Sentence 2: Protagonists (Awakening, Classic, Ace, Coach) + Climax ---
  const flavorClauses: string[] = [];

  if ((input.awakenedCount ?? 0) > 0) {
    if (primaryAwakened) {
      flavorClauses.push(
        (input.awakenedCount ?? 0) > 1
          ? `시즌 중 잠재력을 터뜨린 ${josa(primaryAwakened, '을/를')} 비롯한 ${input.awakenedCount}명의 각성이 폭발적인 추동력이 되었고`
          : `결정적 순간 잠재력을 깨운 ${primaryAwakened}의 각성이 팀의 한계를 한 단계 끌어올렸고`,
      );
    } else {
      flavorClauses.push(
        `시즌 중 잠재력을 폭발시킨 ${input.awakenedCount}인의 포텐 각성이 승부처마다 날카로운 변수가 되었고`,
      );
    }
  }

  if ((input.classicCount ?? 0) > 0) {
    if (primaryClassic) {
      flavorClauses.push(
        (input.classicCount ?? 0) > 1
          ? `${josa(primaryClassic, '을/를')} 비롯한 시대의 전설들이 중심을 단단히 잡아주었다`
          : `클래식 ${primaryClassic}의 노련한 품격이 큰 경기마다 결정적인 차이를 만들었다`,
      );
    } else {
      flavorClauses.push(
        `시대를 풍미한 클래식 ${input.classicCount}인의 존재감이 결정적인 순간마다 무게감을 더했다`,
      );
    }
  }

  if (flavorClauses.length === 0 && aceName) {
    const gaText =
      typeof input.aceGoals === 'number' && input.aceGoals > 0
        ? `(${input.aceGoals}골${input.aceAssists ? ` ${input.aceAssists}도움` : ''})`
        : '';
    flavorClauses.push(
      `공격의 중심축 ${aceName}${gaText}의 꾸준한 활약이 매 경기 팀을 앞으로 밀어 올렸다`,
    );
  }

  const coachPhrase =
    coach && input.staffCoachId
      ? `${COACH_PROSE[input.staffCoachId]} ${coach.name} 수석 코치의 조율까지 더해져`
      : null;

  let finaleClause = '';
  if (input.isTreble) {
    finaleClause = `마침내 ${input.leagueName ?? '리그'}와 ${input.cupName ?? '자국 컵'}, 챔피언스리그까지 모두 품에 안으며 구단 역사에 길이 남을 트레블의 서사를 완성했다.`;
  } else if (isUnbeatenChamp) {
    finaleClause = `단 한 번의 패배도 허락하지 않은 무패 질주로 ${input.leagueName ?? '리그'} 정상에 우뚝 섰다.`;
  } else if (input.uclWon) {
    finaleClause =
      input.finalRank === 1
        ? `자국 리그와 유럽 챔피언스리그를 동시에 제패하며 대륙 최고의 강호로 우뚝 섰다.`
        : `유럽 최강 클럽들을 연파하고 빅이어를 들어 올리며 잊지 못할 밤을 남겼다.`;
  } else if (input.finalRank === 1 && input.cupWon) {
    finaleClause = `${input.leagueName ?? '리그'}와 ${input.cupName ?? '자국 컵'}을 모두 휩쓴 더블 우승으로 완벽한 결실을 맺었다.`;
  } else if (input.finalRank === 1) {
    finaleClause = `긴 레이스 끝에 ${input.leagueName ?? '리그'} 트로피를 들어 올리며 시즌의 주인공이 되었다.`;
  } else if (input.cupWon) {
    finaleClause = `${input.cupName ?? '자국 컵'} 정상에 오르며 값진 트로피로 시즌을 빛냈다.`;
  } else if (input.ffpTier === 0 && input.chemistry >= 88) {
    finaleClause = `건전한 재정과 높은 결속력 속에서 시즌 내내 탄탄한 경쟁력을 증명했다.`;
  }

  let sentence2 = '';
  if (flavorClauses.length >= 2) {
    const joined = `${flavorClauses[0]}, ${flavorClauses[1]}`;
    if (finaleClause) {
      sentence2 = `${joined}. ${coachPhrase ? `${coachPhrase} ` : ''}${finaleClause}`;
    } else if (coachPhrase) {
      sentence2 = `${coachPhrase} ${joined}.`;
    } else {
      sentence2 = `${joined}.`;
    }
  } else if (flavorClauses.length === 1) {
    const lead = flavorClauses[0].replace(/되었고$|올렸고$/, (m) =>
      m === '되었고' ? '되었으며' : '올렸으며',
    );
    if (finaleClause) {
      sentence2 = coachPhrase
        ? `${lead}, ${coachPhrase} ${finaleClause}`
        : `${lead}, ${finaleClause}`;
    } else if (coachPhrase) {
      sentence2 = `${lead}, ${coachPhrase} 시즌의 색깔을 더욱 선명하게 새겼다.`;
    } else {
      sentence2 = `${lead.replace(/되었으며$/, '되었다').replace(/올렸으며$/, '올렸다')}.`;
    }
  } else if (coachPhrase && finaleClause) {
    sentence2 = `${coachPhrase} ${finaleClause}`;
  } else if (finaleClause) {
    sentence2 = finaleClause;
  } else if (coachPhrase) {
    sentence2 = `${coachPhrase} 탄탄한 스쿼드 완성도로 시즌을 치러냈다.`;
  }

  return sentence2 ? `${sentence1} ${sentence2}` : sentence1;
}

// =============================================================================
// Chronological Storytelling Helpers (Item 2)
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
}

interface ChronologicalBeat {
  order: number;
  highlight: TeamStoryHighlight;
}

/**
 * Generates an expressive football-column team intro AND a chronological season storytelling
 * timeline (opening -> early clashes -> awakenings -> streaks -> mid-season turn -> comebacks
 * -> cup climax -> league finale -> UCL knockout & final -> epilogue).
 */
export function generateSoloSeasonTeamStory(
  input: SoloSeasonStoryInput,
): TeamSeasonStory {
  const userClubId = input.userClubId ?? USER_CLUB_ID;
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
  const aceStat = [...userStats].sort(
    (a, b) =>
      b.goals + b.assists - (a.goals + a.assists) || b.avgRating - a.avgRating,
  )[0];
  const defAnchorStat = [...userStats]
    .filter((s) => s.position === 'DF' || s.position === 'GK')
    .sort((a, b) => b.avgRating - a.avgRating || b.cleanSheets - a.cleanSheets)[0];
  const defAnchorFallback = squad
    .filter((p) => p.position === 'DF' || p.position === 'GK')
    .sort((a, b) => b.ovr - a.ovr)[0];

  const cupWon = input.cup?.championTeamId === userClubId;
  const uclWon = input.ucl?.championTeamId === userClubId;
  const isTreble = finalRank === 1 && cupWon && uclWon;

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
  });

  const beats: ChronologicalBeat[] = [];
  const usedMatchIds = new Set<string>();
  const halfRound = Math.max(10, Math.round(input.totalRounds / 2));
  const sortedLeagueMatches = [...input.userMatchHistory].sort(
    (a, b) => a.round - b.round,
  );

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
    const earlySlice = sortedLeagueMatches.slice(0, Math.min(5, sortedLeagueMatches.length));
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
      openScorers.length > 0 ? ` (${openScorers.join(', ')})` : '';
    let openingSentence = '';
    if (earlySlice.length >= 4 && ew >= 4) {
      openingSentence = `${opener.round}라운드 ${openInfo.oppName}전 ${openInfo.ug}-${openInfo.og} 승리${scorerSuffix}로 포문을 연 뒤, 초반 ${earlySlice.length}경기 ${ew}승 ${ed}무 ${el}패의 매서운 기세로 단숨에 선두권에 이름을 올렸다.`;
    } else if (earlySlice.length >= 4 && el >= 2) {
      openingSentence = `초반 ${earlySlice.length}경기에서 ${ew}승 ${ed}무 ${el}패로 잠시 숨을 고르는 시기를 겪었지만, ${input.formation} 전술의 호흡을 맞추며 서서히 반등의 불씨를 살려냈다.`;
    } else if (openInfo.outcome === 'W') {
      openingSentence = `개막전 ${openInfo.oppName}전을 ${openInfo.ug}-${openInfo.og}${scorerSuffix}로 잡으며 산뜻하게 출항했고, 초반 ${earlySlice.length}경기를 ${ew}승 ${ed}무 ${el}패로 안정감 있게 통과했다.`;
    } else {
      openingSentence = `개막전 ${openInfo.oppName}전(${openInfo.ug}-${openInfo.og})으로 막을 올린 시즌 초반, ${earlySlice.length}경기 ${ew}승 ${ed}무 ${el}패를 기록하며 긴 레이스의 첫 발을 내디뎠다.`;
    }

    beats.push({
      order: 1,
      highlight: {
        kind: 'opening',
        period: earlySlice.length >= 4 ? `개막 ~ ${earlySlice[earlySlice.length - 1].round}R` : '개막',
        tag: '시즌 출항',
        title:
          ew >= 4
            ? `초반 ${earlySlice.length}경기 ${ew}승 무서운 출발`
            : el >= 2
              ? `초반 시행착오 딛고 전열 정비`
              : `${openInfo.oppName}전으로 막을 올린 대장정`,
        detail: openingSentence,
        metric: `${ew}승 ${ed}무 ${el}패`,
      },
    });
    usedMatchIds.add(opener.fixtureId);
  }

  // ---------------------------------------------------------------------------
  // 2) Early / Mid-Season Giant Killing (Upset win vs strong rival)
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
    beats.push({
      order: bestGiantKill.match.round + 0.1,
      highlight: {
        kind: 'best_match',
        period: `${bestGiantKill.match.round}R`,
        tag: bestGiantKill.oppOvr > input.baseAvgOvr ? '강호 격파' : '빅매치 제압',
        title: `${bestGiantKill.oppName} ${isAway ? '원정 ' : ''}${bestGiantKill.ug}-${bestGiantKill.og} 완파`,
        detail: `${bestGiantKill.match.round}라운드, 리그 강호 ${josa(bestGiantKill.oppName, '을/를')} ${isAway ? '적지에서 ' : ''}${bestGiantKill.ug}-${bestGiantKill.og}로 꺾으며${scorers.length > 0 ? `(${scorers.join(', ')})` : ''} 이번 시즌이 단순한 돌풍이 아님을 선언했다.`,
        metric: `${bestGiantKill.ug}-${bestGiantKill.og}`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 3) Potential Awakening Milestones (placed at exact round!)
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
        ? ` 이후 시즌 ${st.goals}골 ${st.assists}도움(평균 평점 ${st.avgRating.toFixed(2)})으로 팀의 핵심 축으로 자리 잡았다.`
        : ` 단숨에 스쿼드의 무게추를 바꾸며 후반 레이스의 결정적 카드가 되었다.`;

    beats.push({
      order: awkOrder,
      highlight: {
        kind: 'awakening',
        period: periodLabel,
        tag: '포텐 각성',
        title: `${heroName}, 껍질을 깨고 각성 (OVR ${awk.originalOvr}→${afterOvr})`,
        detail: `${periodLabel} 무렵, 묵묵히 신뢰를 쌓아가던 ${josa(heroName, '이/가')} 마침내 잠재력을 터뜨리며 기본 OVR +${awk.ovrGain} 성장을 이뤄냈다.${statClause}`,
        metric: `OVR +${awk.ovrGain}`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 4) Longest Win / Unbeaten Streak (exact round window!)
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
      beats.push({
        order: startR + 0.25,
        highlight: {
          kind: 'streak',
          period: `${startR}R ~ ${endR}R`,
          tag: useWin ? '파죽지세 연승' : '무패 질주',
          title: useWin
            ? `${startR}R~${endR}R 리그 ${maxWin}연승 질주`
            : `${startR}R~${endR}R ${maxUnb}경기 연속 무패 행진`,
          detail: useWin
            ? `${startR}라운드부터 ${endR}라운드까지 내리 ${maxWin}연승을 몰아치며${maxUnb > maxWin ? `(최장 ${maxUnb}경기 무패)` : ''} 순위 경쟁의 주도권을 완벽히 거머쥐었다.`
            : `${startR}라운드부터 ${endR}라운드까지 ${maxUnb}경기 동안 단 한 번도 무릎 꿇지 않는 끈질긴 저력으로 순위표 상단을 지켜냈다.`,
          metric: useWin ? `${maxWin}연승` : `${maxUnb}무패`,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5) Mid-Season Turning Point & Assistant Coach Appointment
  // ---------------------------------------------------------------------------
  const halfStanding = computeRankAtRound(input.fixtures, userClubId, halfRound);
  const hiredCoach = input.staffCoachId ? STAFF_COACHES[input.staffCoachId] : null;
  if (hiredCoach || halfStanding) {
    let midTitle = '';
    let midDetail = '';
    if (hiredCoach && halfStanding) {
      midTitle = `반환점 ${halfStanding.rank}위 · ${hiredCoach.name} 수석 코치 합류`;
      midDetail = `${halfRound}라운드 반환점을 리그 ${halfStanding.rank}위(${halfStanding.points}점)로 통과한 시점에 ${COACH_PROSE[input.staffCoachId!]} ${hiredCoach.name} 수석 코치가 합류하며 후반기 완성도를 한 단계 끌어올렸다.`;
    } else if (hiredCoach) {
      midTitle = `후반기 승부수 · ${hiredCoach.name} 수석 코치 영입`;
      midDetail = `시즌 중반, ${COACH_PROSE[input.staffCoachId!]} ${hiredCoach.name} 수석 코치를 선임하며 후반기 대도약의 발판을 다졌다.`;
    } else if (halfStanding && finalRank > 0) {
      const surged = halfStanding.rank - finalRank;
      if (surged >= 2) {
        midTitle = `반환점 ${halfStanding.rank}위에서 시작된 후반기 대추격`;
        midDetail = `전반기를 ${halfStanding.rank}위(${halfStanding.points}점)로 마쳤지만, 후반기 들어 경기력이 폭발하며 끝내 ${finalRank}위까지 순위를 끌어올렸다.`;
      } else if (halfStanding.rank === 1) {
        midTitle = `반환점 선두(${halfStanding.points}점) 수성`;
        midDetail = `전반기 ${halfRound}경기를 리그 1위(${halfStanding.points}점)로 마치며 우승 후보로서의 흔들리지 않는 기세를 이어갔다.`;
      }
    }
    if (midTitle && midDetail) {
      beats.push({
        order: halfRound + 0.35,
        highlight: {
          kind: 'turning_point',
          period: `반환점 (${halfRound}R)`,
          tag: '시즌 분수령',
          title: midTitle,
          detail: midDetail,
          metric: halfStanding ? `${halfStanding.rank}위 · ${halfStanding.points}점` : hiredCoach?.shortBadge,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6) Greatest Comeback & Biggest Win across all competitions
  // ---------------------------------------------------------------------------
  const allMatches = [
    ...input.userMatchHistory,
    ...input.userCupMatchHistory,
    ...input.userUclMatchHistory,
  ];

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
      highlight: {
        kind: 'comeback',
        period: compTag,
        tag: bestComeback.deficit >= 2 ? '극적인 대역전극' : '후반 역전 명승부',
        title: `${compTag} ${bestComeback.oppName}전 ${bestComeback.htU}-${bestComeback.htO} → ${bestComeback.ug}-${bestComeback.og} 뒤집기`,
        detail:
          bestComeback.deficit >= 2
            ? `전반을 ${bestComeback.htU}-${bestComeback.htO}로 끌려가며 패색이 짙었지만, 후반전 거센 반격${scorers.length > 0 ? `(${scorers.join(', ')})` : ''}으로 승부를 통쾌하게 뒤집으며 팀의 포기하지 않는 저력을 증명했다.`
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
      highlight: {
        kind: 'best_match',
        period: compTag,
        tag: '화력 폭발 대승',
        title: `${compTag} ${biggestWin.oppName}전 ${biggestWin.ug}-${biggestWin.og} 압승`,
        detail: `${josa(biggestWin.oppName, '을/를')} 상대로 ${biggestWin.ug}골을 몰아치며${scorers.length > 0 ? `(${scorers.join(', ')})` : ''} 시즌 최다 점수 차 완승으로 완벽한 공격 전개를 과시했다.`,
        metric: `+${biggestWin.margin}골 차`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 7) Domestic Cup Climax
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
        highlight: {
          kind: 'cup_final',
          period: `${input.cup.meta.koreanName} 결승`,
          tag: cupWon ? '컵대회 우승' : '컵대회 결승',
          title: `${input.cup.meta.koreanName} 결승 vs ${info.oppName} (${info.ug}-${info.og}${hasPk ? ' PK' : ''})`,
          detail: cupWon
            ? hasPk
              ? `연장 혈투 끝 승부차기에서 ${josa(info.oppName, '을/를')} 따돌리며 ${input.cup.meta.koreanName} 트로피에 입을 맞췄다.`
              : `결승 무대에서 ${josa(info.oppName, '을/를')} ${info.ug}-${info.og}로 제압하며${scorers.length > 0 ? `(${scorers.join(', ')})` : ''} 값진 ${input.cup.meta.koreanName} 정상에 올랐다.`
            : `치열한 토너먼트를 뚫고 ${input.cup.meta.koreanName} 결승까지 진출했으나, ${info.oppName}에 아쉽게 우승 문턱에서 멈춰 섰다.`,
          metric: cupWon ? '우승' : '준우승',
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 8) League Climax: Title Clinching Match OR Underdog Finish / Rank Story
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
          ? ` 2위 ${josa(runnerUp.teamName, '을/를')} 승점 ${gap}점 차로 따돌린 완승이었다.`
          : '';
    beats.push({
      order: clinch.round + 0.5,
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
    if (rankDelta >= 3) {
      beats.push({
        order: input.totalRounds + 0.5,
        highlight: {
          kind: 'overachieve',
          period: '리그 피날레',
          tag: '언더독 반란 결실',
          title: `예상 ${expectedRank}위 전력으로 ${input.leagueName} ${finalRank}위 돌파`,
          detail: `개막 전 예상 ${expectedRank}위였던 전력을 실효 OVR ${input.effectiveOvr.toFixed(1)}까지 끌어올리며, 끝내 승점 ${userRow.points}점(${userRow.won}승 ${userRow.drawn}무 ${userRow.lost}패)으로 ${rankDelta}계단 뛰어오른 ${finalRank}위로 시즌을 마감했다.`,
          metric: `+${rankDelta}계단`,
        },
      });
    } else if (finalRank === 1) {
      const runnerUp = input.standings[1];
      const gap = runnerUp ? userRow.points - runnerUp.points : 0;
      beats.push({
        order: input.totalRounds + 0.5,
        highlight: {
          kind: 'title_match',
          period: '리그 피날레',
          tag: userRow.lost === 0 ? '무패 우승' : '리그 제패',
          title: `${input.leagueName} 정상 등극 (${userRow.points}점 · ${userRow.won}승 ${userRow.drawn}무 ${userRow.lost}패)`,
          detail:
            userRow.lost === 0
              ? `시즌 내내 단 1패도 허용하지 않은 압도적 경기력으로 ${input.leagueName} 무패 우승의 위업을 세웠다.`
              : runnerUp
                ? `2위 ${josa(runnerUp.teamName, '을/를')} 승점 ${gap}점 차로 따돌리며 마침내 ${input.leagueName} 트로피를 들어 올렸다.`
                : `긴 레이스 내내 흔들리지 않으며 ${input.leagueName} 정상을 지켜냈다.`,
          metric: `득실 ${userRow.goalDifference >= 0 ? '+' : ''}${userRow.goalDifference}`,
        },
      });
    } else {
      beats.push({
        order: input.totalRounds + 0.5,
        highlight: {
          kind: 'overachieve',
          period: '리그 피날레',
          tag: finalRank <= 4 ? 'UCL 진출권 확보' : '리그 완주',
          title: `${input.leagueName} ${finalRank}위 마감 (${userRow.points}점)`,
          detail: `38라운드에 가까운 대장정을 ${userRow.won}승 ${userRow.drawn}무 ${userRow.lost}패(득실 ${userRow.goalDifference >= 0 ? '+' : ''}${userRow.goalDifference})로 마무리하며${finalRank <= 4 ? ' 당당히 다음 시즌 유럽 무대 티켓을 거머쥐었다.' : ' 한 시즌의 여정을 끝마쳤다.'}`,
          metric: `${userRow.points}점`,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 9) UEFA Champions League Knockout Drama & Final
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
        highlight: {
          kind: 'ucl_final',
          period: 'UCL 결승',
          tag: uclWon
            ? isLateDrama
              ? '챔스 결승 극장골'
              : '유럽 정상 등극'
            : 'UCL 결승전',
          title: `챔피언스리그 결승 vs ${info.oppName} (${info.ug}-${info.og}${hasPenalties ? ' PK' : ''})`,
          detail: uclWon
            ? hasPenalties
              ? `120분 혈투 끝에 이어진 승부차기에서 끝내 ${josa(info.oppName, '을/를')} 꺾고 빅이어를 하늘 높이 들어 올렸다.`
              : isLateDrama && lastGoal?.scorerName
                ? `후반 ${lastGoal.minute}분, ${lastGoal.scorerName}의 극적인 결승골이 터지며 ${josa(info.oppName, '을/를')} 무너뜨리고 유럽 정상에 섰다.`
                : `${scorers.length > 0 ? `${scorers.join(', ')}의 득점포를 앞세워 ` : '완벽한 경기 운영으로 '}${josa(info.oppName, '을/를')} ${info.ug}-${info.og}로 제압하며 꿈에 그리던 빅이어를 품에 안았다.`
            : `유럽 최강 클럽들을 뚫고 결승 무대까지 오르는 투혼을 발휘했으나, 마지막 고비에서 ${info.oppName}에 아쉽게 빅이어를 내주었다.`,
          metric: uclWon ? '우승' : '준우승',
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 10) Epilogue: Defining Ace & Season Legacy
  // ---------------------------------------------------------------------------
  if (aceStat || isTreble) {
    const epilogueTitle = isTreble
      ? `${input.userClubName}, 구단 역사에 새겨진 트레블의 밤`
      : aceStat
        ? `시즌의 얼굴 · ${aceStat.playerName} (${aceStat.goals}골 ${aceStat.assists}도움)`
        : `${input.userClubName}의 시즌을 마치며`;

    let epilogueDetail = '';
    if (isTreble && aceStat) {
      epilogueDetail = `공식전 ${aceStat.appearances}경기 ${aceStat.goals}골 ${aceStat.assists}도움(평균 평점 ${aceStat.avgRating.toFixed(2)})을 몰아친 ${josa(aceStat.playerName, '을/를')} 앞세워, 리그·컵·챔피언스리그 3관왕이라는 완벽한 서사로 시즌의 막을 내렸다.`;
    } else if (isTreble) {
      epilogueDetail = `리그, 자국 컵, 챔피언스리그를 모두 제패한 3관왕의 대업으로 구단 역사상 가장 찬란한 한 페이지를 완성했다.`;
    } else if (aceStat) {
      epilogueDetail = `공식전 ${aceStat.appearances}경기에 나서 ${aceStat.goals}골 ${aceStat.assists}도움(평균 평점 ${aceStat.avgRating.toFixed(2)})을 기록한 ${josa(aceStat.playerName, '이/가')} 시즌 내내 팀의 심장으로 뛰며 잊지 못할 여정에 마침표를 찍었다.`;
    }

    if (epilogueDetail) {
      beats.push({
        order: input.totalRounds + 10,
        highlight: {
          kind: isTreble ? 'epilogue' : 'ace',
          period: '에필로그',
          tag: isTreble ? '전설의 완성' : '시즌 에필로그',
          title: epilogueTitle,
          detail: epilogueDetail,
          metric: isTreble
            ? '👑 트레블'
            : aceStat
              ? `${aceStat.goals}G ${aceStat.assists}A`
              : undefined,
        },
      });
    }
  }

  beats.sort((a, b) => a.order - b.order);

  return {
    intro,
    highlights: beats.map((b) => b.highlight).slice(0, 10),
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
  const topAce = [...allSquad].sort(
    (a, b) => b.goals + b.assists - (a.goals + a.assists) || b.avgRating - a.avgRating,
  )[0];
  const defAnchor = [...allSquad]
    .filter((p) => p.position === 'DF' || p.position === 'GK')
    .sort((a, b) => b.avgRating - a.avgRating || b.ovr - a.ovr)[0];

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
  });

  const highlights: TeamStoryHighlight[] = [];
  const history = entry.matchHistory ?? [];

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
      detail: `시즌 도중 각성에 성공한 ${josa(topAwakened.name, '이/가')} ${topAwakened.goals}골 ${topAwakened.assists}도움(평균 평점 ${topAwakened.avgRating.toFixed(2)})으로 팀 도약의 결정적 동력이 되었다.`,
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
      kind: 'ucl_final',
      period: 'UCL 결승',
      tag: entry.uclWon ? 'UCL 우승' : 'UCL 결승',
      title: `챔피언스리그 결승 vs ${uclFinal.opponentName} (${uclFinal.userGoals}-${uclFinal.oppGoals})`,
      detail:
        uclFinal.scorers.length > 0
          ? `${uclFinal.scorers.slice(0, 3).join(', ')}의 활약 속에${uclFinal.note ? `(${uclFinal.note})` : ''} ${entry.uclWon ? '빅이어를 품에 안았다.' : '결승 무대까지 오르는 투혼을 보여주었다.'}`
          : entry.uclWon
            ? `${josa(uclFinal.opponentName, '을/를')} 제압하며 유럽 정상에 우뚝 섰다.`
            : `유럽 결승까지 오르는 저력을 발휘했다.`,
      metric: entry.uclWon ? '우승' : '준우승',
    });
  }

  if (entry.topScorerSummary && entry.topScorerSummary !== '-') {
    highlights.push({
      kind: 'ace',
      period: '에필로그',
      tag: '시즌의 얼굴',
      title: entry.topScorerSummary,
      detail: `매 경기 공격의 중심축으로 활약하며 한 시즌의 여정을 빛냈다.`,
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
  const topAce = [...allSquad].sort(
    (a, b) =>
      (b.goals ?? 0) + (b.assists ?? 0) - ((a.goals ?? 0) + (a.assists ?? 0)) ||
      (b.avgRating ?? 0) - (a.avgRating ?? 0),
  )[0];
  const defAnchor = [...allSquad]
    .filter((p) => p.position === 'DF' || p.position === 'GK')
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.ovr - a.ovr)[0];

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
          : `핵심 자원 ${hero.name}의 각성(+${hero.awakening!.ovrGain})이 승부처마다 결정적 돌파구가 되었다.`,
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
  }

  if (entry.topScorerSummary && entry.topScorerSummary !== '-') {
    highlights.push({
      kind: 'ace',
      period: '에필로그',
      tag: '시즌 에이스',
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
  const squad = [...input.starters, ...input.bench].filter(Boolean) as Player[];
  const awakened = squad.filter((p) => Boolean(p.awakening));
  const classics = squad.filter((p) => p.isLegend);
  const topScorer = [...input.teamStats]
    .filter((s) => s.appearances > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0];
  const defAnchor = [...input.teamStats]
    .filter((s) => s.position === 'DF' || s.position === 'GK')
    .sort((a, b) => b.avgRating - a.avgRating)[0];

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
  });

  const highlights: TeamStoryHighlight[] = [];

  if (
    input.h2hSummary &&
    input.h2hSummary.wins + input.h2hSummary.draws + input.h2hSummary.losses > 0
  ) {
    const { wins, draws, losses } = input.h2hSummary;
    highlights.push({
      kind: 'best_match',
      period: '라이벌전',
      tag: '친구 맞대결',
      title: `라이벌 H2H ${wins}승 ${draws}무 ${losses}패`,
      detail:
        wins > losses
          ? `유저 간 정면 승부에서 우위를 점하며 리그 주도권을 단단히 거머쥐었다.`
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
      kind: input.leagueRank === 1 ? 'title_match' : 'overachieve',
      period: '리그 피날레',
      tag: input.leagueRank === 1 ? '리그 우승' : '리그 성적',
      title: `${input.leagueName} ${input.leagueRank}위 (${r.points}점 · ${r.won}승 ${r.drawn}무 ${r.lost}패)`,
      detail: `${r.goalsFor}득점 ${r.goalsAgainst}실점(득실 ${r.goalDifference >= 0 ? '+' : ''}${r.goalDifference})의 기록으로 긴 리그 레이스를 완주했다.`,
      metric: `${r.points}점`,
    });
  }

  if (input.uclResultLabel && input.uclResultLabel !== '미진출') {
    highlights.push({
      kind: 'ucl_final',
      period: '유럽 무대',
      tag: input.uclResultLabel.includes('우승') ? 'UCL 우승' : '챔피언스리그',
      title: `UEFA 챔피언스리그 ${input.uclResultLabel}`,
      detail: input.cupResultLabel
        ? `자국 컵 ${input.cupResultLabel}과 병행하며 유럽 무대에서도 스쿼드의 저력을 증명했다.`
        : `유럽 무대에서 스쿼드 경쟁력을 유감없이 선보였다.`,
      metric: input.uclResultLabel,
    });
  }

  if (topScorer && topScorer.goals > 0) {
    highlights.push({
      kind: 'ace',
      period: '에필로그',
      tag: '팀 최다 득점',
      title: `${topScorer.playerName} (${topScorer.goals}골 ${topScorer.assists}도움)`,
      detail: `평균 평점 ${topScorer.avgRating.toFixed(2)}로 매 경기 팀의 최전방을 책임졌다.`,
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

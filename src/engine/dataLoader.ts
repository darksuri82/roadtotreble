import activePlayersRaw from '../data/activePlayers.json';
import { FORMATIONS } from '../data/formations';
import leaguesRaw from '../data/leagues.json';
import legendPlayersRaw from '../data/legendPlayers.json';
import type { Club, LeagueData, LeagueId } from '../types/league';
import type { Player, PlaystyleId, Position, SubPosition } from '../types/player';
import { getLineForSubPosition } from './positionEngine';

export const ACTIVE_PLAYERS: Player[] = activePlayersRaw as Player[];
export const LEGEND_PLAYERS: Player[] = legendPlayersRaw as Player[];
export const ALL_PLAYERS: Player[] = [...ACTIVE_PLAYERS, ...LEGEND_PLAYERS];
export const LEAGUES: LeagueData[] = leaguesRaw as LeagueData[];

export interface ClubWithLeague {
  club: Club;
  leagueId: LeagueId;
}

export const ALL_CLUBS_WITH_LEAGUE: ClubWithLeague[] = LEAGUES.flatMap((l) =>
  l.clubs.map((club) => ({ club, leagueId: l.id })),
);

const ACTIVE_PLAYERS_BY_CLUB = new Map<string, Player[]>();
for (const p of ACTIVE_PLAYERS) {
  const arr = ACTIVE_PLAYERS_BY_CLUB.get(p.club);
  if (arr) arr.push(p);
  else ACTIVE_PLAYERS_BY_CLUB.set(p.club, [p]);
}
for (const arr of ACTIVE_PLAYERS_BY_CLUB.values()) {
  arr.sort((a, b) => b.ovr - a.ovr);
}

/**
 * Returns a club's full real squad depth pool (typically 18-24 players),
 * excluding any globally owned/departed IDs, for AI rotation & injury cover.
 */
export function getClubRealDepthPool(
  clubName: string,
  excludeIds?: Set<string>,
): Player[] {
  const list = ACTIVE_PLAYERS_BY_CLUB.get(clubName) ?? [];
  if (!excludeIds || excludeIds.size === 0) return list;
  return list.filter((p) => !excludeIds.has(p.id));
}

export function getLeagueById(leagueId: LeagueId): LeagueData {
  const league = LEAGUES.find((l) => l.id === leagueId);
  if (!league) {
    throw new Error(`Unknown leagueId: ${leagueId}`);
  }
  return league;
}

export function getWeakestClub(league: LeagueData): Club {
  let weakest = league.clubs[league.clubs.length - 1];
  let lowestScore = Number.POSITIVE_INFINITY;

  for (const club of league.clubs) {
    const score = club.att + club.mid + club.def;
    if (score <= lowestScore) {
      lowestScore = score;
      weakest = club;
    }
  }
  return weakest;
}

const LEAGUE_NAT_POOL: Record<
  LeagueId,
  { nat: string; code: string; surnames: string[]; firstNames: string[] }
> = {
  epl: {
    nat: '잉글랜드',
    code: 'GB',
    firstNames: ['잭', '올리버', '해리', '루이스', '벤', '칼럼', '조', '샘', '리암', '제임스', '알피', '노아'],
    surnames: ['워커', '테일러', '브라운', '클라크', '해리스', '화이트', '우드', '베이커', '그린', '영', '터너', '워드로'],
  },
  laliga: {
    nat: '스페인',
    code: 'ES',
    firstNames: ['파블로', '카를로스', '마르크', '디에고', '하비', '세르히오', '우나이', '알바로', '이반', '루벤', '아드리안', '우고'],
    surnames: ['가르시아', '로페스', '마르티네스', '산체스', '페레스', '고메스', '토레스', '나바로', '루이스', '디아스', '모레노', '라모스'],
  },
  seriea: {
    nat: '이탈리아',
    code: 'IT',
    firstNames: ['마르코', '루카', '마테오', '로렌초', '안드레아', '파비오', '시모네', '다비데', '알레시오', '니콜라', '필리포', '에마누엘레'],
    surnames: ['로시', '콘티', '비안키', '페라리', '리치', '마리노', '그레코', '롬바르디', '모레티', '갈로', '코스타', '폰타나'],
  },
  bundesliga: {
    nat: '독일',
    code: 'DE',
    firstNames: ['루카스', '막시밀리안', '니클라스', '요나스', '율리안', '펠릭스', '레온', '팀', '얀', '세바스티안', '파울', '모리츠'],
    surnames: ['뮐러', '슈미트', '베버', '바그너', '베커', '호프만', '슐츠', '코흐', '리히터', '클라인', '크라우스', '브라운'],
  },
  ligue1: {
    nat: '프랑스',
    code: 'FR',
    firstNames: ['뤼카', '테오', '위고', '로맹', '막심', '바티스', '클레망', '줄리앙', '마티외', '앙투안', '엔조', '나탕'],
    surnames: ['마르탱', '베르나르', '토마', '로베르', '리샤르', '뒤랑', '모로', '시몽', '로랑', '미셸', '르페브르', '메르시에'],
  },
};

function defaultPlaystylesForSub(sub: SubPosition, variant = 0): PlaystyleId[] {
  switch (sub) {
    case 'GK':
      return variant % 2 === 0 ? ['shot_stopper'] : ['sweeper_keeper'];
    case 'CB':
      return variant % 2 === 0 ? ['stopper_cb'] : ['ball_playing_cb'];
    case 'LB':
    case 'RB':
    case 'LWB':
    case 'RWB':
      return ['attacking_wingback'];
    case 'CDM':
      return variant % 2 === 0 ? ['ball_winner'] : ['deep_playmaker'];
    case 'CM':
      return variant % 2 === 0 ? ['box_to_box'] : ['deep_playmaker'];
    case 'CAM':
      return ['playmaker_10'];
    case 'LM':
    case 'RM':
      return ['classic_winger'];
    case 'LW':
    case 'RW':
      return variant % 2 === 0 ? ['inverted_winger'] : ['classic_winger'];
    case 'ST':
    default:
      return variant % 2 === 0 ? ['poacher'] : ['line_breaker'];
  }
}

function defaultSecondaryForSub(sub: SubPosition): SubPosition[] {
  switch (sub) {
    case 'LB':
      return ['LWB'];
    case 'RB':
      return ['RWB'];
    case 'LWB':
      return ['LB'];
    case 'RWB':
      return ['RB'];
    case 'CDM':
      return ['CM'];
    case 'CM':
      return ['CDM'];
    case 'CAM':
      return ['CM'];
    case 'LM':
      return ['LW'];
    case 'RM':
      return ['RW'];
    case 'LW':
      return ['LM'];
    case 'RW':
      return ['RM'];
    default:
      return [];
  }
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Generates a realistic club-affiliated rotation player scaled to the club's ATT/MID/DEF (+/- 3).
 * Used both as a fallback in the multi-candidate 3-club roulette (ensuring 2-3 candidates per club)
 * and to complete AI 11-man rosters.
 */
export function generateClubRotationPlayer(params: {
  club: Club;
  leagueId: LeagueId;
  subPosition: SubPosition;
  customName?: string;
  seedKey?: string;
  excludeNames?: Set<string>;
  rng?: () => number;
}): Player {
  const {
    club,
    leagueId,
    subPosition,
    customName,
    seedKey,
    excludeNames,
    rng = Math.random,
  } = params;
  const broadPos: Position = getLineForSubPosition(subPosition);
  const pool = LEAGUE_NAT_POOL[leagueId];

  const baseRating =
    broadPos === 'FW'
      ? club.att
      : broadPos === 'MF'
        ? club.mid
        : club.def;

  // Spread +/- 3 around club line rating
  const jitter = Math.floor(rng() * 7) - 3;
  const ovr = Math.max(70, Math.min(85, baseRating + jitter));

  let seed = seedKey ? hashString(seedKey) : Math.floor(rng() * 100000);
  let name = customName;
  if (!name) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const firstName = pool.firstNames[(seed + attempt) % pool.firstNames.length];
      const surname =
        pool.surnames[Math.floor((seed + attempt * 7) / 10) % pool.surnames.length];
      const candidateName = `${firstName} ${surname}`;
      if (!excludeNames || !excludeNames.has(candidateName)) {
        name = candidateName;
        seed += attempt;
        break;
      }
    }
    if (!name) {
      name = `${pool.firstNames[seed % pool.firstNames.length]} ${pool.surnames[(seed + 3) % pool.surnames.length]}`;
    }
  }

  const att =
    broadPos === 'FW'
      ? Math.min(89, ovr + 1)
      : broadPos === 'MF'
        ? Math.round(ovr * 0.92)
        : broadPos === 'DF'
          ? Math.round(ovr * 0.74)
          : 30;
  const mid =
    broadPos === 'MF'
      ? Math.min(89, ovr + 1)
      : broadPos === 'GK'
        ? Math.round(ovr * 0.76)
        : Math.round(ovr * 0.88);
  const def =
    broadPos === 'DF' || broadPos === 'GK'
      ? Math.min(89, ovr + 1)
      : broadPos === 'MF'
        ? Math.round(ovr * 0.86)
        : Math.round(ovr * 0.52);

  const generatedPlaystyles = defaultPlaystylesForSub(subPosition, seed);
  const baseStamina =
    broadPos === 'GK'
      ? 75
      : ['CM', 'CDM', 'LWB', 'RWB', 'LB', 'RB'].includes(subPosition)
        ? 83
        : ['LW', 'RW', 'LM', 'RM'].includes(subPosition)
          ? 81
          : 78;
  const stamina = Math.max(
    68,
    Math.min(89, baseStamina + ((seed % 7) - 3)),
  );

  return {
    id: `gen-${club.id}-${subPosition.toLowerCase()}-${seed}`,
    name,
    position: broadPos,
    mainPositions: [subPosition],
    secondaryPositions: defaultSecondaryForSub(subPosition),
    ovr,
    nationality: pool.nat,
    nationalityCode: pool.code,
    leagueId,
    club: club.name,
    att,
    mid,
    def,
    stamina,
    playstyles: generatedPlaystyles,
    scoutNote: `${club.name} 1군 로테이션 스쿼드 자원`,
    isLegend: false,
    isGenerated: true,
  };
}

/**
 * Builds a complete 11-player starting roster for an AI club in its formation,
 * preferring real 2026-27 players sorted by OVR desc while strictly excluding globally owned/departed players
 * so every player exists at most once worldwide.
 */
export function buildAiClubRoster(
  club: Club,
  leagueId: LeagueId,
  excludeIds?: Set<string>,
): Player[] {
  const formation = FORMATIONS[club.formation] ?? FORMATIONS['4-3-3'];
  const blockedIds = excludeIds ?? new Set<string>();
  const blockedNames = new Set<string>();
  if (blockedIds.size > 0) {
    for (const p of ALL_PLAYERS) {
      if (blockedIds.has(p.id)) blockedNames.add(p.name);
    }
  }

  const clubRealPlayers = ACTIVE_PLAYERS.filter(
    (p) => p.club === club.name && !blockedIds.has(p.id),
  ).sort(
    (a, b) =>
      b.ovr - a.ovr || b.att + b.mid + b.def - (a.att + a.mid + a.def),
  );
  const usedIds = new Set<string>(blockedIds);
  const usedNames = new Set<string>(blockedNames);
  const roster: Player[] = [];

  for (let i = 0; i < formation.slots.length; i += 1) {
    const slot = formation.slots[i];

    // 1) Exact mainPositions match among club's real players (highest OVR first)
    let found = clubRealPlayers.find(
      (p) => !usedIds.has(p.id) && p.mainPositions.includes(slot.subPosition),
    );
    // 2) Secondary match
    if (!found) {
      found = clubRealPlayers.find(
        (p) =>
          !usedIds.has(p.id) &&
          p.secondaryPositions.includes(slot.subPosition),
      );
    }
    // 3) Same broad line
    if (!found) {
      found = clubRealPlayers.find(
        (p) => !usedIds.has(p.id) && p.position === slot.position,
      );
    }

    if (found) {
      usedIds.add(found.id);
      usedNames.add(found.name);
      roster.push(found);
      continue;
    }

    // Use one of club.topScorers for FW/MF slots only if not already owned/excluded
    let customName: string | undefined;
    if (slot.position === 'FW' || slot.position === 'MF') {
      const unusedScorer = club.topScorers.find((sc) => !usedNames.has(sc));
      if (unusedScorer) {
        customName = unusedScorer;
        usedNames.add(unusedScorer);
      }
    }

    // Deterministic pseudo-rng for consistent AI rosters
    const seedVal = hashString(`${club.id}-${i}-${slot.subPosition}`);
    const detRng = () => (seedVal % 97) / 97;

    const gen = generateClubRotationPlayer({
      club,
      leagueId,
      subPosition: slot.subPosition,
      customName,
      seedKey: `${club.id}-slot-${i}`,
      excludeNames: usedNames,
      rng: detRng,
    });
    usedIds.add(gen.id);
    usedNames.add(gen.name);
    roster.push(gen);
  }

  return roster;
}

/**
 * Selects a balanced replacement player when an AI club loses a player to a mid-season user transfer:
 * 1) Unused real player of the same club & broad position (highest OVR)
 * 2) Compatible non-Legend outPlayer from the trade swap (if matching broad position and not excluded)
 * 3) Any unused real player of the same club
 * 4) Deterministic club rotation player filling the departed slot's subPosition
 */
export function pickReplacementForAiClub(params: {
  club: Club;
  leagueId: LeagueId;
  departedPlayer: Player;
  currentRoster: Player[];
  excludeIds: Set<string>;
  swapOutPlayer?: Player | null;
  round?: number;
}): Player {
  const {
    club,
    leagueId,
    departedPlayer,
    currentRoster,
    excludeIds,
    swapOutPlayer,
    round = 0,
  } = params;

  const rosterIds = new Set<string>(currentRoster.map((p) => p.id));
  const blockedIds = new Set<string>([...excludeIds, ...rosterIds, departedPlayer.id]);
  const blockedNames = new Set<string>(currentRoster.map((p) => p.name));
  blockedNames.add(departedPlayer.name);
  for (const p of ALL_PLAYERS) {
    if (blockedIds.has(p.id)) blockedNames.add(p.name);
  }

  const targetSub = departedPlayer.mainPositions[0] ?? 'CM';
  const targetBroad = departedPlayer.position;

  // 1) Real bench/depth player of the same club matching position
  const clubDepth = ACTIVE_PLAYERS.filter(
    (p) => p.club === club.name && !blockedIds.has(p.id),
  ).sort((a, b) => b.ovr - a.ovr);

  const exactSub = clubDepth.find((p) => p.mainPositions.includes(targetSub));
  if (exactSub) return exactSub;

  const sameBroad = clubDepth.find((p) => p.position === targetBroad);
  if (sameBroad) return sameBroad;

  // 2) Trade-swap outgoing non-Legend player if same broad position & not already on this club
  if (
    swapOutPlayer &&
    !swapOutPlayer.isLegend &&
    swapOutPlayer.position === targetBroad &&
    !rosterIds.has(swapOutPlayer.id)
  ) {
    return {
      ...swapOutPlayer,
      club: club.name,
      leagueId,
    };
  }

  // 3) Any real depth player of this club
  if (clubDepth[0]) return clubDepth[0];

  // 4) Fallback generated club rotation player
  const seedKey = `repl-${club.id}-${departedPlayer.id}-r${round}`;
  const seedVal = hashString(seedKey);
  const detRng = () => (seedVal % 97) / 97;
  return generateClubRotationPlayer({
    club,
    leagueId,
    subPosition: targetSub,
    seedKey,
    excludeNames: blockedNames,
    rng: detRng,
  });
}

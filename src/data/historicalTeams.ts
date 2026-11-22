import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { computeSeasonScore } from '../engine/legacyEngine';
import { USER_CLUB_ID } from '../engine/matchEngine';
import type { CupStageId, DomesticCupState } from '../types/cup';
import type {
  FormationId,
  ManagerAvatarConfig,
  ManagerTraitId,
  UserClubProfile,
} from '../types/game';
import type {
  BestXiEntry,
  Club,
  GlobalSeasonAwards,
  LeagueId,
  PlayerSeasonStats,
  SeasonAwards,
  TacticId,
} from '../types/league';
import type {
  HallOfFameEntry,
  HistoricalBestXiPlayer,
  HistoricalTeamEntry,
  UnifiedLeaderboardEntry,
} from '../types/legacy';
import type { Player } from '../types/player';
import type { UclKnockoutStage, UclTournamentState } from '../types/ucl';
import { FORMATIONS } from './formations';
import { HISTORICAL_SQUADS } from './historicalSquadsData';
import { evaluateManagerPlayerSynergy } from './managerTraits';

interface RawHistoricalTeamSpec {
  id: string;
  seasonLabel: string;
  displayName: string;
  nickname: string;
  managerName: string;
  managerTraitId: ManagerTraitId;
  managerRating: number; // 91..99 real-world managerial stature
  managerStyleNote: string;
  managerAvatar: ManagerAvatarConfig;
  userClub: UserClubProfile;
  leagueId: LeagueId;
  leagueKoreanName: string;
  formation: FormationId;
  defaultTactic: TacticId;
  finalLeagueRank: number;
  leaguePoints: number;
  leagueTotalRounds: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  cupName: string;
  cupOutcome: 'winner' | CupStageId | 'early';
  cupResultLabel: string;
  uclOutcome: 'winner' | UclKnockoutStage | 'league_phase' | 'none';
  uclResultLabel: string;
  uclPerfectWin?: boolean;
  uclUnbeatenWin?: boolean;
  summaryNote: string;
  ballonDorWinnerName?: string;
  worldBestXiCount: number;
  leagueMvpName?: string;
  leagueBestXiCount: number;
  bestXiNotes?: Record<string, string>;
}

function makeDummyStat(name: string, idx: number): PlayerSeasonStats {
  return {
    playerId: `hist-p-${idx}`,
    playerName: name,
    teamId: USER_CLUB_ID,
    teamName: 'Historical',
    teamShortName: 'HST',
    teamPrimaryColor: '#f59e0b',
    teamSecondaryColor: '#0f172a',
    isUserTeam: true,
    position: 'FW',
    mainPositions: ['ST'],
    ovr: 90,
    appearances: 35,
    starts: 35,
    subAppearances: 0,
    minutesPlayed: 3000,
    goals: 20,
    assists: 10,
    xgSum: 18,
    cleanSheets: 10,
    momCount: 8,
    ratingSum: 280,
    avgRating: 8.0,
    positionCounts: { ST: 35 },
    isLegend: true,
  };
}

function buildHistoricalEntry(spec: RawHistoricalTeamSpec): HistoricalTeamEntry {
  const cupWon = spec.cupOutcome === 'winner';
  const uclWon = spec.uclOutcome === 'winner';
  const isLeagueChampion = spec.finalLeagueRank === 1;
  const isTreble = isLeagueChampion && cupWon && uclWon;

  const squadBundle = HISTORICAL_SQUADS[spec.id];
  const starters: Player[] = squadBundle ? squadBundle.starters : [];
  const bench: Player[] = squadBundle ? squadBundle.bench : [];
  const formationCfg = FORMATIONS[spec.formation];

  // Calculate genuine team OVR, chemistry, and manager synergy using the EXACT user engines!
  const chemResult = calculateChemistry(
    spec.formation,
    starters,
    spec.defaultTactic,
    spec.managerTraitId,
    spec.managerRating,
  );
  const rawStarterAvgOvr =
    starters.length > 0
      ? starters.reduce((sum, p) => sum + p.ovr, 0) / starters.length
      : 86;
  const teamAvgOvr = Math.round(rawStarterAvgOvr * 10) / 10;

  const slotSynValues = Object.values(chemResult.slotSynergies);
  const avgSynergyOvrBonus =
    slotSynValues.length > 0
      ? Math.round(
          (slotSynValues.reduce((sum, s) => sum + s.totalBonus, 0) /
            slotSynValues.length) *
            100,
        ) / 100
      : 0;
  const managerSynergyCount = starters.filter(
    (p) => evaluateManagerPlayerSynergy(p, spec.managerTraitId, spec.managerRating).isMatch,
  ).length;

  const bestXi: HistoricalBestXiPlayer[] = starters.map((p, idx) => ({
    position: formationCfg.slots[idx]?.label ?? p.mainPositions[0] ?? p.position,
    name: p.name,
    ovr: p.ovr,
    note: spec.bestXiNotes?.[p.name],
  }));

  // Synthesize minimal Cup & UCL states so computeSeasonScore applies the exact same user formula
  const syntheticCup: DomesticCupState | null =
    spec.cupOutcome === 'early'
      ? null
      : {
          meta: {
            leagueId: spec.leagueId,
            id: `hist-cup-${spec.id}`,
            name: spec.cupName,
            koreanName: spec.cupName,
            accentColor: '#f59e0b',
          },
          triggerRounds: [8, 16, 24, 32],
          participantIds: [USER_CLUB_ID],
          currentStage: 'final',
          pendingStage: null,
          rounds: { r16: [], qf: [], sf: [], final: [] },
          userEliminatedAt:
            spec.cupOutcome === 'winner' ? null : spec.cupOutcome,
          championTeamId: cupWon ? USER_CLUB_ID : 'other',
          completed: true,
        };

  const syntheticUcl: UclTournamentState | null =
    spec.uclOutcome === 'none'
      ? null
      : {
          stage: 'completed',
          teams: [],
          clubs: [],
          aiRosters: {},
          leaguePhaseFixtures: [],
          leaguePhaseRound: 8,
          standings: [],
          userLeaguePhaseRank: 1,
          enteredViaPlayoff: false,
          knockoutLeg: 1,
          ties: { playoff: [], r16: [], qf: [], sf: [], final: [] },
          userEliminatedAt:
            spec.uclOutcome === 'winner' ? null : spec.uclOutcome,
          championTeamId: uclWon ? USER_CLUB_ID : 'other',
          lastUserMatch: null,
          completed: true,
        };

  const leagueBestXi: BestXiEntry[] = Array.from(
    { length: spec.leagueBestXiCount },
    (_, i) => ({
      slotIndex: i,
      slotLabel: 'CM',
      stats: makeDummyStat(`LeagueXI-${i}`, i),
    }),
  );

  const syntheticAwards: SeasonAwards = {
    topScorers: [],
    topAssisters: [],
    topCleanSheets: [],
    topRatings: [],
    bestXi: leagueBestXi,
    poty: spec.leagueMvpName ? makeDummyStat(spec.leagueMvpName, 99) : null,
  };

  const worldBestXi: BestXiEntry[] = Array.from(
    { length: spec.worldBestXiCount },
    (_, i) => ({
      slotIndex: i,
      slotLabel: 'CM',
      stats: makeDummyStat(`WorldXI-${i}`, 200 + i),
    }),
  );

  const syntheticGlobalAwards: GlobalSeasonAwards = {
    ballonDorWinner: spec.ballonDorWinnerName
      ? {
          rank: 1,
          stats: makeDummyStat(spec.ballonDorWinnerName, 300),
          ballonScore: 220,
          trophies: [],
          reason: '역대급 시즌',
        }
      : null,
    ballonDorTop5: [],
    worldBestXi,
  };

  const leagueGoalDifference = spec.goalsFor - spec.goalsAgainst;

  // Evaluate with the EXACT same function used for user seasons
  const seasonScore = computeSeasonScore({
    leaguePoints: spec.leaguePoints,
    leaguePlayed: spec.leagueTotalRounds,
    leagueGoalDifference,
    leagueLosses: spec.lost,
    leagueGoalsFor: spec.goalsFor,
    leagueGoalsAgainst: spec.goalsAgainst,
    finalLeagueRank: spec.finalLeagueRank,
    cup: syntheticCup,
    ucl: syntheticUcl,
    uclPerfectWin: spec.uclPerfectWin,
    uclUnbeatenWin: spec.uclUnbeatenWin,
    teamAvgOvr,
    chemistry: chemResult.total,
    avgSynergyOvrBonus,
    managerSynergyCount,
    managerRating: spec.managerRating,
    awards: syntheticAwards,
    globalAwards: syntheticGlobalAwards,
    userClubId: USER_CLUB_ID,
  });

  const trophies: string[] = [];
  if (isLeagueChampion) trophies.push(`${spec.leagueKoreanName} 우승`);
  if (cupWon) trophies.push(`${spec.cupName} 우승`);
  if (uclWon) trophies.push('UEFA 챔피언스리그 우승');

  return {
    id: spec.id,
    seasonLabel: spec.seasonLabel,
    displayName: spec.displayName,
    nickname: spec.nickname,
    managerName: spec.managerName,
    managerTraitId: spec.managerTraitId,
    managerRating: spec.managerRating,
    managerStyleNote: spec.managerStyleNote,
    managerAvatar: spec.managerAvatar,
    userClub: spec.userClub,
    leagueId: spec.leagueId,
    leagueKoreanName: spec.leagueKoreanName,
    formation: spec.formation,
    defaultTactic: spec.defaultTactic,
    finalLeagueRank: spec.finalLeagueRank,
    leaguePoints: spec.leaguePoints,
    leagueTotalRounds: spec.leagueTotalRounds,
    leagueRecord: `${spec.won}승 ${spec.drawn}무 ${spec.lost}패`,
    leagueGoalDifference,
    goalsFor: spec.goalsFor,
    goalsAgainst: spec.goalsAgainst,
    cupName: spec.cupName,
    cupResultLabel: spec.cupResultLabel,
    cupWon,
    uclResultLabel: spec.uclResultLabel,
    uclWon,
    uclPerfectWin: spec.uclPerfectWin,
    uclUnbeatenWin: spec.uclUnbeatenWin,
    isTreble,
    isLeagueChampion,
    teamAvgOvr,
    chemistry: chemResult.total,
    avgSynergyOvrBonus,
    managerSynergyCount,
    seasonScore,
    trophies,
    summaryNote: spec.summaryNote,
    ballonDorWinnerName: spec.ballonDorWinnerName,
    worldBestXiCount: spec.worldBestXiCount,
    leagueMvpName: spec.leagueMvpName,
    leagueBestXiCount: spec.leagueBestXiCount,
    bestXi,
    starters,
    bench,
  };
}

const RAW_HISTORICAL_TEAMS: RawHistoricalTeamSpec[] = [
  {
    id: 'hist-1920-bayern',
    seasonLabel: '19-20',
    displayName: '19-20 바이에른 뮌헨',
    nickname: 'UCL 전승 트레블 · 6관왕',
    managerName: '한지 플릭',
    managerTraitId: 'gegenpress_guru',
    managerRating: 95,
    managerStyleNote: '초고강도 하이 라인과 전방 3인 압박 트랩으로 유럽을 초토화한 게겐프레싱의 정점.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'parted',
      hairColor: 'silver',
      outfit: 'team_tracksuit',
    },
    userClub: {
      name: '19-20 바이에른 뮌헨',
      shortName: 'FCB',
      primaryColor: '#dc052d',
      secondaryColor: '#ffffff',
      pattern: 'solid',
    },
    leagueId: 'bundesliga',
    leagueKoreanName: '분데스리가',
    formation: '4-2-3-1',
    defaultTactic: 'gegenpressing',
    finalLeagueRank: 1,
    leaguePoints: 82,
    leagueTotalRounds: 34,
    won: 26,
    drawn: 4,
    lost: 4,
    goalsFor: 100,
    goalsAgainst: 32,
    cupName: 'DFB-포칼',
    cupOutcome: 'winner',
    cupResultLabel: '우승',
    uclOutcome: 'winner',
    uclResultLabel: '전승 우승 (11승)',
    uclPerfectWin: true,
    uclUnbeatenWin: true,
    summaryNote:
      '분데스리가 100득점 + DFB-포칼 + 사상 초유의 UCL 11전 전승 우승으로 트레블을 완성한 압박 축구의 정점.',
    ballonDorWinnerName: '로베르트 레반도프스키 (FIFA 올해의 선수)',
    worldBestXiCount: 4,
    leagueMvpName: '로베르트 레반도프스키',
    leagueBestXiCount: 6,
    bestXiNotes: {
      '토마스 뮐러': '리그 21도움',
      '킹슬리 코망': '결승 결승골',
      '로베르트 레반도프스키': '시즌 55골',
    },
  },
  {
    id: 'hist-1213-bayern',
    seasonLabel: '12-13',
    displayName: '12-13 바이에른 뮌헨',
    nickname: '분데스리가 역대 최다 승점 트레블',
    managerName: '유프 하인케스',
    managerTraitId: 'wing_bomber',
    managerRating: 96,
    managerStyleNote: '로베리 양 측면 폭격과 완벽한 공수 밸런스로 독일 최초 트레블을 완성한 대명장.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'parted',
      hairColor: 'silver',
      outfit: 'navy_coat',
    },
    userClub: {
      name: '12-13 바이에른 뮌헨',
      shortName: 'FCB',
      primaryColor: '#dc052d',
      secondaryColor: '#f5f5f5',
      pattern: 'solid',
    },
    leagueId: 'bundesliga',
    leagueKoreanName: '분데스리가',
    formation: '4-2-3-1',
    defaultTactic: 'wingplay',
    finalLeagueRank: 1,
    leaguePoints: 91,
    leagueTotalRounds: 34,
    won: 29,
    drawn: 4,
    lost: 1,
    goalsFor: 98,
    goalsAgainst: 18,
    cupName: 'DFB-포칼',
    cupOutcome: 'winner',
    cupResultLabel: '우승',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    summaryNote:
      '분데스리가 34R 91점·단 1패·18실점이라는 압도적 기록과 로베리 좌우 윙어 듀오로 독일 구단 최초 트레블 달성.',
    worldBestXiCount: 3,
    leagueMvpName: '프랑크 리베리',
    leagueBestXiCount: 6,
    bestXiNotes: {
      '아르옌 로벤': '결승 결승골',
      '프랑크 리베리': 'UEFA 올해의 선수',
    },
  },
  {
    id: 'hist-1415-barca',
    seasonLabel: '14-15',
    displayName: '14-15 FC 바르셀로나',
    nickname: 'MSN 122골 · 유럽 최초 2회 트레블',
    managerName: '루이스 엔리케',
    managerTraitId: 'galactico_manager',
    managerRating: 95,
    managerStyleNote: '티키타카 점유율에 MSN 삼각 편대의 초고속 직선 역습을 결합한 완성형 공격 축구.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'buzz',
      hairColor: 'brown',
      outfit: 'classic_suit',
    },
    userClub: {
      name: '14-15 FC 바르셀로나',
      shortName: 'FCB',
      primaryColor: '#a50044',
      secondaryColor: '#004d98',
      pattern: 'stripes',
    },
    leagueId: 'laliga',
    leagueKoreanName: '라리가',
    formation: '4-3-3',
    defaultTactic: 'possession',
    finalLeagueRank: 1,
    leaguePoints: 94,
    leagueTotalRounds: 38,
    won: 30,
    drawn: 4,
    lost: 4,
    goalsFor: 110,
    goalsAgainst: 21,
    cupName: '코파 델 레이',
    cupOutcome: 'winner',
    cupResultLabel: '우승',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    summaryNote:
      '메시·수아레스·네이마르(MSN) 트리오가 합작 122골을 폭발시키며 라리가 94점·코파 델 레이·UCL을 석권.',
    ballonDorWinnerName: '리오넬 메시',
    worldBestXiCount: 4,
    leagueMvpName: '리오넬 메시',
    leagueBestXiCount: 6,
    bestXiNotes: {
      '리오넬 메시': '발롱도르 · 58골',
      '네이마르': '39골',
      '루이스 수아레스': '결승 결승골',
    },
  },
  {
    id: 'hist-0809-barca',
    seasonLabel: '08-09',
    displayName: '08-09 FC 바르셀로나',
    nickname: '티키타카 탄생 · 스페인 최초 트레블',
    managerName: '펩 과르디올라',
    managerTraitId: 'tiki_taka',
    managerRating: 98,
    managerStyleNote: '현대 축구의 패러다임을 영원히 바꾼 포지셔널 플레이·펄스 나인·티키타카의 창시자.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'bald',
      hairColor: 'black',
      outfit: 'classic_suit',
    },
    userClub: {
      name: '08-09 FC 바르셀로나',
      shortName: 'FCB',
      primaryColor: '#a50044',
      secondaryColor: '#004d98',
      pattern: 'stripes',
    },
    leagueId: 'laliga',
    leagueKoreanName: '라리가',
    formation: '4-3-3',
    defaultTactic: 'possession',
    finalLeagueRank: 1,
    leaguePoints: 87,
    leagueTotalRounds: 38,
    won: 27,
    drawn: 6,
    lost: 5,
    goalsFor: 105,
    goalsAgainst: 35,
    cupName: '코파 델 레이',
    cupOutcome: 'winner',
    cupResultLabel: '우승',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    summaryNote:
      '펩 과르디올라 데뷔 시즌에 티키타카 점유율 축구로 라리가 105득점·코파 델 레이·UCL을 모두 제패하며 6관왕의 서막을 염.',
    ballonDorWinnerName: '리오넬 메시',
    worldBestXiCount: 4,
    leagueMvpName: '리오넬 메시',
    leagueBestXiCount: 5,
    bestXiNotes: {
      '리오넬 메시': '발롱도르 · 38골',
      '사무엘 에투': '36골',
      '티에리 앙리': '26골',
    },
  },
  {
    id: 'hist-2223-mancity',
    seasonLabel: '22-23',
    displayName: '22-23 맨체스터 시티',
    nickname: '홀란 52골 · 3-2-4-1 트레블',
    managerName: '펩 과르디올라',
    managerTraitId: 'tiki_taka',
    managerRating: 98,
    managerStyleNote: '존 스톤스 하이브리드 3-2-4-1 박스 미드필드로 유럽 최초 개인 2회 트레블을 달성한 전술 천재.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'bald',
      hairColor: 'black',
      outfit: 'navy_coat',
    },
    userClub: {
      name: '22-23 맨체스터 시티',
      shortName: 'MCI',
      primaryColor: '#6cabdd',
      secondaryColor: '#ffffff',
      pattern: 'solid',
    },
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    formation: '3-4-2-1',
    defaultTactic: 'possession',
    finalLeagueRank: 1,
    leaguePoints: 89,
    leagueTotalRounds: 38,
    won: 28,
    drawn: 5,
    lost: 5,
    goalsFor: 94,
    goalsAgainst: 33,
    cupName: 'FA컵',
    cupOutcome: 'winner',
    cupResultLabel: '우승',
    uclOutcome: 'winner',
    uclResultLabel: '무패 우승',
    uclUnbeatenWin: true,
    summaryNote:
      '존 스톤스의 센터백-볼란치 하이브리드 전술과 홀란(EPL 36골)·더 브라위너·로드리의 조합으로 구단 최초 트레블 완성.',
    worldBestXiCount: 5,
    leagueMvpName: '엘링 홀란',
    leagueBestXiCount: 5,
    bestXiNotes: {
      '로드리': 'UCL 결승 결승골',
      '엘링 홀란': '시즌 52골',
      '케빈 더 브라위너': '31도움',
    },
  },
  {
    id: 'hist-0910-inter',
    seasonLabel: '09-10',
    displayName: '09-10 인터 밀란',
    nickname: '이탈리아 최초 트레블 · 무리뉴 실리 축구',
    managerName: '조제 무리뉴',
    managerTraitId: 'catenaccio',
    managerRating: 96,
    managerStyleNote: '극한의 수비 조직력과 면도날 역습, 선수단 멘탈 장악으로 빅매치를 집어삼킨 스페셜 원.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'warm',
      hairStyle: 'parted',
      hairColor: 'silver',
      outfit: 'navy_coat',
    },
    userClub: {
      name: '09-10 인터 밀란',
      shortName: 'INT',
      primaryColor: '#010e80',
      secondaryColor: '#0a0a0a',
      pattern: 'stripes',
    },
    leagueId: 'seriea',
    leagueKoreanName: '세리에 A',
    formation: '4-2-3-1',
    defaultTactic: 'counter',
    finalLeagueRank: 1,
    leaguePoints: 82,
    leagueTotalRounds: 38,
    won: 24,
    drawn: 10,
    lost: 4,
    goalsFor: 75,
    goalsAgainst: 34,
    cupName: '코파 이탈리아',
    cupOutcome: 'winner',
    cupResultLabel: '우승',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    summaryNote:
      '철벽 수비와 면도날 역습으로 바르셀로나와 바이에른을 차례로 꺾고 이탈리아 클럽 사상 유일의 트레블 달성.',
    worldBestXiCount: 3,
    leagueMvpName: '디에고 밀리토',
    leagueBestXiCount: 5,
    bestXiNotes: {
      '디에고 밀리토': '결승 멀티골',
      '베슬러이 스네이더르': 'UCL 도움왕',
    },
  },
  {
    id: 'hist-9899-manutd',
    seasonLabel: '98-99',
    displayName: '98-99 맨체스터 유나이티드',
    nickname: '캄프 누의 기적 · 잉글랜드 최초 트레블',
    managerName: '알렉스 퍼거슨',
    managerTraitId: 'super_sub',
    managerRating: 99,
    managerStyleNote: '‘퍼기 타임’과 전설의 교체 용병술, 불굴의 위닝 멘탈리티를 상징하는 축구 역사상 최고 명장.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'slick',
      hairColor: 'silver',
      outfit: 'classic_suit',
    },
    userClub: {
      name: '98-99 맨체스터 유나이티드',
      shortName: 'MUN',
      primaryColor: '#da291c',
      secondaryColor: '#111111',
      pattern: 'solid',
    },
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    formation: '4-4-2',
    defaultTactic: 'wingplay',
    finalLeagueRank: 1,
    leaguePoints: 79,
    leagueTotalRounds: 38,
    won: 22,
    drawn: 13,
    lost: 3,
    goalsFor: 80,
    goalsAgainst: 37,
    cupName: 'FA컵',
    cupOutcome: 'winner',
    cupResultLabel: '우승',
    uclOutcome: 'winner',
    uclResultLabel: '무패 우승',
    uclUnbeatenWin: true,
    summaryNote:
      '클래스 오브 92와 요크-콜 투톱, 그리고 캄프 누 후반 추가시간 대역전극으로 잉글랜드 축구 사상 첫 트레블을 기록.',
    worldBestXiCount: 2,
    leagueMvpName: '드와이트 요크',
    leagueBestXiCount: 5,
    bestXiNotes: {
      '데이비드 베컴': '발롱도르 2위',
      '드와이트 요크': 'EPL MVP · 29골',
    },
  },
  {
    id: 'hist-2324-leverkusen',
    seasonLabel: '23-24',
    displayName: '23-24 바이어 레버쿠젠',
    nickname: '네버루젠 · 분데스리가 사상 첫 무패 우승',
    managerName: '사비 알론소',
    managerTraitId: 'total_football',
    managerRating: 93,
    managerStyleNote: '윙백·하프스페이스 스위칭과 끝까지 포기하지 않는 90+ 극장골 철학으로 51경기 무패 신화 창조.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'parted',
      hairColor: 'brown',
      outfit: 'navy_coat',
    },
    userClub: {
      name: '23-24 바이어 레버쿠젠',
      shortName: 'B04',
      primaryColor: '#e32221',
      secondaryColor: '#111111',
      pattern: 'sash',
    },
    leagueId: 'bundesliga',
    leagueKoreanName: '분데스리가',
    formation: '3-4-2-1',
    defaultTactic: 'possession',
    finalLeagueRank: 1,
    leaguePoints: 90,
    leagueTotalRounds: 34,
    won: 28,
    drawn: 6,
    lost: 0,
    goalsFor: 89,
    goalsAgainst: 24,
    cupName: 'DFB-포칼',
    cupOutcome: 'winner',
    cupResultLabel: '우승',
    uclOutcome: 'none',
    uclResultLabel: '미출전 (UEL 준우승)',
    summaryNote:
      '분데스리가 역사상 최초 무패 우승(28승 6무 0패 · 90점)과 DFB-포칼 우승으로 국내 무패 더블을 달성한 사비 알론소의 마법.',
    worldBestXiCount: 1,
    leagueMvpName: '플로리안 비르츠',
    leagueBestXiCount: 6,
    bestXiNotes: {
      '플로리안 비르츠': '분데스리가 MVP',
      '알레한드로 그리말도': '12G 20A',
    },
  },
  {
    id: 'hist-1718-mancity',
    seasonLabel: '17-18',
    displayName: '17-18 맨체스터 시티',
    nickname: '센추리온즈 · EPL 최초 승점 100점',
    managerName: '펩 과르디올라',
    managerTraitId: 'tiki_taka',
    managerRating: 98,
    managerStyleNote: '프리롤 더블 8번(실바·KDB)과 인버티드 풀백으로 EPL 승점·승수·득점 기록을 모조리 경신.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'bald',
      hairColor: 'black',
      outfit: 'puffer_jacket',
    },
    userClub: {
      name: '17-18 맨체스터 시티',
      shortName: 'MCI',
      primaryColor: '#6cabdd',
      secondaryColor: '#ffffff',
      pattern: 'solid',
    },
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    formation: '4-3-3',
    defaultTactic: 'possession',
    finalLeagueRank: 1,
    leaguePoints: 100,
    leagueTotalRounds: 38,
    won: 32,
    drawn: 4,
    lost: 2,
    goalsFor: 106,
    goalsAgainst: 27,
    cupName: 'FA컵',
    cupOutcome: 'r16',
    cupResultLabel: '16강',
    uclOutcome: 'qf',
    uclResultLabel: '8강',
    summaryNote:
      '프리미어리그 역사상 최초 승점 100점, 최다승(32승), 최다골(106골), 최대 득실(+79)을 기록한 센추리온즈.',
    worldBestXiCount: 1,
    leagueBestXiCount: 5,
    bestXiNotes: {
      '케빈 더 브라위너': '도움왕 16A',
      '세르히오 아구에로': '21골',
    },
  },
  {
    id: 'hist-1112-realmadrid',
    seasonLabel: '11-12',
    displayName: '11-12 레알 마드리드',
    nickname: '승점 100점 · 라리가 역대 최다 121득점',
    managerName: '조제 무리뉴',
    managerTraitId: 'direct_football',
    managerRating: 96,
    managerStyleNote: '5초 만에 자기 진영에서 골망을 흔드는 세계 역사상 가장 치명적인 직선 역습 축구 완성.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'warm',
      hairStyle: 'parted',
      hairColor: 'silver',
      outfit: 'classic_suit',
    },
    userClub: {
      name: '11-12 레알 마드리드',
      shortName: 'RMA',
      primaryColor: '#f8fafc',
      secondaryColor: '#f59e0b',
      pattern: 'solid',
    },
    leagueId: 'laliga',
    leagueKoreanName: '라리가',
    formation: '4-2-3-1',
    defaultTactic: 'counter',
    finalLeagueRank: 1,
    leaguePoints: 100,
    leagueTotalRounds: 38,
    won: 32,
    drawn: 4,
    lost: 2,
    goalsFor: 121,
    goalsAgainst: 32,
    cupName: '코파 델 레이',
    cupOutcome: 'qf',
    cupResultLabel: '8강',
    uclOutcome: 'sf',
    uclResultLabel: '4강',
    summaryNote:
      '전광석화 같은 역습 축구로 라리가 사상 최초 승점 100점과 역대 최다 121골(+89 득실)을 기록.',
    worldBestXiCount: 4,
    leagueMvpName: '크리스티아누 호날두',
    leagueBestXiCount: 5,
    bestXiNotes: {
      '메수트 외질': '도움왕 17A',
      '크리스티아누 호날두': '리그 46골',
    },
  },
  {
    id: 'hist-1314-juventus',
    seasonLabel: '13-14',
    displayName: '13-14 유벤투스',
    nickname: '유럽 5대 리그 역대 최다 승점 102점',
    managerName: '안토니오 콘테',
    managerTraitId: 'defensive_architect',
    managerRating: 93,
    managerStyleNote: 'BBC 스리백과 피를로 레지스타 보호 시스템으로 홈 19전 전승·102점 철벽을 세운 전술가.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'fluffy',
      hairColor: 'black',
      outfit: 'classic_suit',
    },
    userClub: {
      name: '13-14 유벤투스',
      shortName: 'JUV',
      primaryColor: '#f8fafc',
      secondaryColor: '#0f172a',
      pattern: 'stripes',
    },
    leagueId: 'seriea',
    leagueKoreanName: '세리에 A',
    formation: '3-5-2',
    defaultTactic: 'possession',
    finalLeagueRank: 1,
    leaguePoints: 102,
    leagueTotalRounds: 38,
    won: 33,
    drawn: 3,
    lost: 2,
    goalsFor: 80,
    goalsAgainst: 23,
    cupName: '코파 이탈리아',
    cupOutcome: 'qf',
    cupResultLabel: '8강',
    uclOutcome: 'league_phase',
    uclResultLabel: '조별리그 탈락',
    summaryNote:
      '홈 19전 전승 포함 33승 3무 2패, 유럽 5대 리그 역사상 단일 시즌 최고 승점인 102점을 달성한 BBC 스리백.',
    worldBestXiCount: 0,
    leagueMvpName: '안드레아 피를로',
    leagueBestXiCount: 6,
    bestXiNotes: {
      '카를로스 테베스': '19골',
      '안드레아 피를로': '세리에 A MVP',
    },
  },
  {
    id: 'hist-0304-arsenal',
    seasonLabel: '03-04',
    displayName: '03-04 아스널',
    nickname: '인빈시블 · EPL 유일 무패 우승',
    managerName: '아르센 벵거',
    managerTraitId: 'midfield_maestro',
    managerRating: 95,
    managerStyleNote: '‘벵거볼’ 원터치 고속 패스워크와 피지컬·기술의 완벽한 조화로 EPL 유일 38R 무패 신화 완성.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'parted',
      hairColor: 'silver',
      outfit: 'puffer_jacket',
    },
    userClub: {
      name: '03-04 아스널',
      shortName: 'ARS',
      primaryColor: '#ef0107',
      secondaryColor: '#ffffff',
      pattern: 'solid',
    },
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    formation: '4-4-2',
    defaultTactic: 'counter',
    finalLeagueRank: 1,
    leaguePoints: 90,
    leagueTotalRounds: 38,
    won: 26,
    drawn: 12,
    lost: 0,
    goalsFor: 73,
    goalsAgainst: 26,
    cupName: 'FA컵',
    cupOutcome: 'sf',
    cupResultLabel: '4강',
    uclOutcome: 'qf',
    uclResultLabel: '8강',
    summaryNote:
      '프리미어리그 출범 이후 유일한 38경기 무패 우승(26승 12무 0패)으로 황금 트로피를 수여받은 전설의 무패 군단.',
    worldBestXiCount: 2,
    leagueMvpName: '티에리 앙리',
    leagueBestXiCount: 6,
    bestXiNotes: {
      '티에리 앙리': 'EPL 득점왕 30골',
      '파트리크 비에이라': '무패 주장',
    },
  },
  {
    id: 'hist-0405-chelsea',
    seasonLabel: '04-05',
    displayName: '04-05 첼시',
    nickname: '38경기 15실점 · EPL 역대 최소 실점 철벽',
    managerName: '조제 무리뉴',
    managerTraitId: 'catenaccio',
    managerRating: 96,
    managerStyleNote: '마켈렐레 롤과 4-3-3 수비 블록으로 38경기 단 15실점이라는 불멸의 기록을 세운 수비의 예술가.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'warm',
      hairStyle: 'fluffy',
      hairColor: 'brown',
      outfit: 'navy_coat',
    },
    userClub: {
      name: '04-05 첼시',
      shortName: 'CHE',
      primaryColor: '#034694',
      secondaryColor: '#ffffff',
      pattern: 'solid',
    },
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    formation: '4-3-3',
    defaultTactic: 'counter',
    finalLeagueRank: 1,
    leaguePoints: 95,
    leagueTotalRounds: 38,
    won: 29,
    drawn: 8,
    lost: 1,
    goalsFor: 72,
    goalsAgainst: 15,
    cupName: 'FA컵',
    cupOutcome: 'r16',
    cupResultLabel: '16강',
    uclOutcome: 'sf',
    uclResultLabel: '4강',
    summaryNote:
      '체흐-테리-카르발류-마켈렐레의 철벽 수비로 38경기 15실점·25클린시트·단 1패라는 불멸의 수비 기록을 수립.',
    worldBestXiCount: 2,
    leagueMvpName: '프랭크 램파드',
    leagueBestXiCount: 4,
    bestXiNotes: {
      '페트르 체흐': '24클린시트',
      '존 테리': 'PFA 올해의 선수',
      '프랭크 램파드': '발롱도르 2위',
    },
  },
  {
    id: 'hist-1516-leicester',
    seasonLabel: '15-16',
    displayName: '15-16 레스터 시티',
    nickname: '5000분의 1 동화 · 축구 역사상 최고의 언더독',
    managerName: '클라우디오 라니에리',
    managerTraitId: 'underdog_killer',
    managerRating: 91,
    managerStyleNote: '‘딜리-딩 딜리-동’ 완벽한 4-4-2 컴팩트 블록과 번개 역습으로 5000:1 기적을 빚어낸 노장 명장.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'parted',
      hairColor: 'silver',
      outfit: 'navy_coat',
    },
    userClub: {
      name: '15-16 레스터 시티',
      shortName: 'LEI',
      primaryColor: '#003090',
      secondaryColor: '#fdbe11',
      pattern: 'solid',
    },
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    formation: '4-4-2',
    defaultTactic: 'counter',
    finalLeagueRank: 1,
    leaguePoints: 81,
    leagueTotalRounds: 38,
    won: 23,
    drawn: 12,
    lost: 3,
    goalsFor: 68,
    goalsAgainst: 36,
    cupName: 'FA컵',
    cupOutcome: 'early',
    cupResultLabel: '조기 탈락',
    uclOutcome: 'none',
    uclResultLabel: '미출전',
    summaryNote:
      '강등 1순위·우승 배당 5000배를 뒤집고 바디·마레즈·캉테의 완벽한 4-4-2 역습으로 프리미어리그 정상에 오른 기적의 시즌.',
    worldBestXiCount: 0,
    leagueMvpName: '리야드 마레즈',
    leagueBestXiCount: 4,
    bestXiNotes: {
      '리야드 마레즈': 'EPL MVP · 17G 11A',
      '제이미 바디': '11경기 연속골 · 24G',
    },
  },
];

export const HISTORICAL_BENCHMARK_TEAMS: HistoricalTeamEntry[] =
  RAW_HISTORICAL_TEAMS.map(buildHistoricalEntry).sort(
    (a, b) => b.seasonScore.totalScore - a.seasonScore.totalScore,
  );

export function getHistoricalTeamById(id: string): HistoricalTeamEntry | null {
  return HISTORICAL_BENCHMARK_TEAMS.find((t) => t.id === id) ?? null;
}

/**
 * Converts a HistoricalTeamEntry into a full match-ready Club + 16~18 player roster
 * whose ATT/MID/DEF ratings reflect its genuine starters, chemistry & legendary manager synergy.
 */
export function buildHistoricalClubForMatch(team: HistoricalTeamEntry): {
  club: Club;
  starters: Player[];
  bench: Player[];
  fullRoster: Player[];
} {
  // Use baseline pre-synergy ratings on the Club object so matchEngine computes
  // the exact same 4-pillar synergy + legendary manager OVR lift without double-counting.
  const baseRatings = calculateTeamRatings(
    team.formation,
    team.starters,
    50,
    team.managerTraitId,
  );
  const topAttackers = [...team.starters]
    .sort((a, b) => b.att - a.att || b.ovr - a.ovr)
    .slice(0, 3)
    .map((p) => p.name);

  const club: Club = {
    id: team.id,
    name: team.displayName,
    shortName: team.userClub.shortName,
    primaryColor: team.userClub.primaryColor,
    secondaryColor: team.userClub.secondaryColor,
    pattern: team.userClub.pattern,
    formation: team.formation,
    defaultTactic: team.defaultTactic,
    att: Math.round(baseRatings.att),
    mid: Math.round(baseRatings.mid),
    def: Math.round(baseRatings.def),
    topScorers: [
      topAttackers[0] ?? team.starters[10]?.name ?? '에이스',
      topAttackers[1] ?? team.starters[9]?.name ?? '공격수',
      topAttackers[2] ?? team.starters[8]?.name ?? '미드필더',
    ],
    manager: {
      name: team.managerName,
      ovr: team.managerRating,
      traitId: team.managerTraitId,
      preferredFormations: [team.formation, '4-2-3-1', '3-5-2-dm'],
      preferredTactics: [team.defaultTactic, 'counter', 'gegenpressing'],
    },
  };

  return {
    club,
    starters: team.starters,
    bench: team.bench,
    fullRoster: [...team.starters, ...team.bench],
  };
}

/**
 * Merges User Hall of Fame entries, Historical Benchmark Teams, and future Phase 3 Global entries
 * into a single unified leaderboard sorted by total season score (or completion date).
 */
export function buildUnifiedLeaderboard(params: {
  userEntries: HallOfFameEntry[];
  globalEntries?: UnifiedLeaderboardEntry[];
  filter: 'all' | 'user' | 'historical';
  sortBy: 'score' | 'date';
}): UnifiedLeaderboardEntry[] {
  const { userEntries, globalEntries = [], filter, sortBy } = params;
  const rows: UnifiedLeaderboardEntry[] = [];

  if (filter === 'all' || filter === 'user') {
    for (const u of userEntries) {
      rows.push({
        id: u.id,
        source: 'user',
        displayName: u.userClub.name,
        subtitle: `${u.leagueKoreanName} ${u.finalLeagueRank}위 · ${u.cupName} ${u.cupResultLabel} · UCL ${u.uclResultLabel}`,
        completedAt: u.completedAt,
        totalScore: u.seasonScore.totalScore,
        grade: u.seasonScore.grade,
        userEntry: u,
      });
    }
    for (const g of globalEntries) {
      rows.push(g);
    }
  }

  if (filter === 'all' || filter === 'historical') {
    for (const h of HISTORICAL_BENCHMARK_TEAMS) {
      rows.push({
        id: h.id,
        source: 'historical',
        displayName: h.displayName,
        subtitle: `${h.leagueKoreanName} ${h.leaguePoints}점 우승 · ${h.cupName} ${h.cupResultLabel} · UCL ${h.uclResultLabel}`,
        completedAt: `2000-01-01T00:00:00.000Z`,
        totalScore: h.seasonScore.totalScore,
        grade: h.seasonScore.grade,
        historicalEntry: h,
      });
    }
  }

  if (sortBy === 'date' && filter === 'user') {
    rows.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  } else {
    rows.sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        b.completedAt.localeCompare(a.completedAt),
    );
  }

  return rows;
}

export interface HistoricalRankComparison {
  rankAmongAll: number; // 1 .. HISTORICAL_BENCHMARK_TEAMS.length + 1
  totalTeams: number;
  teamBelow: HistoricalTeamEntry | null; // Highest historical team we beat
  teamAbove: HistoricalTeamEntry | null; // Lowest historical team still above us
  feedbackText: string;
}

/**
 * Generates a one-line historical comparison sentence for the Season Summary card.
 */
export function compareScoreWithHistoricalTeams(
  userScore: number,
): HistoricalRankComparison {
  const sorted = HISTORICAL_BENCHMARK_TEAMS;
  let higherCount = 0;
  for (const h of sorted) {
    if (h.seasonScore.totalScore > userScore) {
      higherCount += 1;
    }
  }
  const rankAmongAll = higherCount + 1;
  const totalTeams = sorted.length + 1;
  const teamAbove = higherCount > 0 ? sorted[higherCount - 1] : null;
  const teamBelow = higherCount < sorted.length ? sorted[higherCount] : null;

  let feedbackText: string;
  if (!teamAbove && teamBelow) {
    feedbackText = `역대 최강 1위 등극! ${teamBelow.displayName}(${teamBelow.seasonScore.totalScore.toLocaleString()}점)을 넘어 축구 역사상 최고 점수를 세웠습니다!`;
  } else if (teamAbove && teamBelow) {
    feedbackText = `역대 랭킹 ${rankAmongAll}위! ${teamBelow.displayName}을(를) 넘고 ${teamAbove.displayName} 바로 아래에 자리했습니다.`;
  } else if (teamAbove) {
    const gap = teamAbove.seasonScore.totalScore - userScore;
    feedbackText = `역대 랭킹 ${rankAmongAll}위! 다음 목표 ${teamAbove.displayName}까지 ${gap.toLocaleString()}점 남았습니다.`;
  } else {
    feedbackText = `역대 랭킹 ${rankAmongAll}위에 기록되었습니다.`;
  }

  return {
    rankAmongAll,
    totalTeams,
    teamBelow,
    teamAbove,
    feedbackText,
  };
}

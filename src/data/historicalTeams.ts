import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { computeSeasonScore } from '../engine/legacyEngine';
import { USER_CLUB_ID } from '../engine/matchEngine';
import { evaluateTeamTacticalProfile } from '../engine/unifiedTacticsEngine';
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
import { ERA_BEST_XI_DREAM_TEAMS } from './eraBestXiTeams';
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
  const benchAvgOvr =
    bench.length > 0
      ? Math.round(
          (bench.reduce((sum, p) => sum + p.ovr, 0) / bench.length) * 10,
        ) / 10
      : undefined;

  const tacticalFit =
    starters.length > 0
      ? evaluateTeamTacticalProfile({
          starters,
          formation: spec.formation,
          tactic: spec.defaultTactic,
          managerTraitId: spec.managerTraitId,
          managerOvr: spec.managerRating,
        }).tacticalFit
      : undefined;

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
    benchAvgOvr,
    chemistry: chemResult.total,
    avgSynergyOvrBonus,
    managerSynergyCount,
    managerRating: spec.managerRating,
    tacticalFit,
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
  {
    id: 'hist-7172-ajax',
    seasonLabel: '71-72',
    displayName: '71-72 AFC 아약스',
    nickname: '토탈 풋볼 트레블 · 유럽 2연패',
    managerName: '슈테판 코바치',
    managerTraitId: 'total_football',
    managerRating: 96,
    managerStyleNote:
      '리누스 미헬스의 토탈 풋볼에 자유로운 창의성을 더해 포지션 경계를 완전히 허문 혁명적 지휘.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'slick',
      hairColor: 'silver',
      outfit: 'classic_suit',
    },
    userClub: {
      name: '71-72 AFC 아약스',
      shortName: 'AJA',
      primaryColor: '#d2122e',
      secondaryColor: '#ffffff',
      pattern: 'stripes',
    },
    leagueId: 'bundesliga',
    leagueKoreanName: '에레디비시',
    formation: '4-3-3',
    defaultTactic: 'possession',
    finalLeagueRank: 1,
    leaguePoints: 93, // 30승 3무 1패 (당시 2점제 63점 → 현행 3점제 환산 93점)
    leagueTotalRounds: 34,
    won: 30,
    drawn: 3,
    lost: 1,
    goalsFor: 104,
    goalsAgainst: 20,
    cupName: 'KNVB 베커르',
    cupOutcome: 'winner',
    cupResultLabel: '우승',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    uclUnbeatenWin: true,
    summaryNote:
      '크루이프·네스켄스·크롤을 앞세워 에레디비시 34경기 104득점 20실점(30승 3무 1패), KNVB 컵, 유러피언 컵 무패 우승까지 휩쓴 축구사 최초의 토탈 풋볼 트레블.',
    ballonDorWinnerName: '요한 크루이프',
    worldBestXiCount: 5,
    leagueMvpName: '요한 크루이프',
    leagueBestXiCount: 8,
    bestXiNotes: {
      '요한 크루이프': '발롱도르 · 리그 25G · 결승 2G',
      '요한 네스켄스': '토탈 풋볼 압박 엔진',
      '뤼트 크롤': '현대 풀백·스위퍼의 원형',
    },
  },
  {
    id: 'hist-1011-barca',
    seasonLabel: '10-11',
    displayName: '10-11 FC 바르셀로나',
    nickname: '티키타카 완성체 · 웸블리의 걸작',
    managerName: '펩 과르디올라',
    managerTraitId: 'tiki_taka',
    managerRating: 98,
    managerStyleNote:
      '펄스 나인 메시와 사비·이니에스타·부스케츠 중원으로 축구 역사상 가장 완벽한 점유율 축구를 구현.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'bald',
      hairColor: 'black',
      outfit: 'classic_suit',
    },
    userClub: {
      name: '10-11 FC 바르셀로나',
      shortName: 'BAR',
      primaryColor: '#a50044',
      secondaryColor: '#004d98',
      pattern: 'stripes',
    },
    leagueId: 'laliga',
    leagueKoreanName: '라리가',
    formation: '4-3-3',
    defaultTactic: 'possession',
    finalLeagueRank: 1,
    leaguePoints: 96,
    leagueTotalRounds: 38,
    won: 30,
    drawn: 6,
    lost: 2,
    goalsFor: 95,
    goalsAgainst: 21,
    cupName: '코파 델 레이',
    cupOutcome: 'final',
    cupResultLabel: '준우승',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    summaryNote:
      '라리가 96점 우승(21실점)과 웸블리 UCL 결승 3-1 완승(MVP 삼총사 전원 득점·세 얼간이 전원 도움). 수많은 전문가들이 역대 최고 완성도로 꼽는 팀.',
    ballonDorWinnerName: '리오넬 메시',
    worldBestXiCount: 6,
    leagueMvpName: '리오넬 메시',
    leagueBestXiCount: 7,
    bestXiNotes: {
      '리오넬 메시': '발롱도르 · 공식전 53G · UCL 12G',
      '사비 에르난데스': '티키타카의 절대 지휘자',
      '안드레스 이니에스타': '결승전 지배 · 발롱도르 2위',
    },
  },
  {
    id: 'hist-1617-realmadrid',
    seasonLabel: '16-17',
    displayName: '16-17 레알 마드리드',
    nickname: 'UCL 최초 2연패 · 쓰리핏 최강 시즌',
    managerName: '지네딘 지단',
    managerTraitId: 'galactico_manager',
    managerRating: 97,
    managerStyleNote:
      '크카모+이스코 4-4-2 다이아몬드와 역대급 로테이션으로 라리가와 UCL 더블을 동시 제패한 마스터클래스.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'bald',
      hairColor: 'black',
      outfit: 'classic_suit',
    },
    userClub: {
      name: '16-17 레알 마드리드',
      shortName: 'RMA',
      primaryColor: '#f8fafc',
      secondaryColor: '#d4af37',
      pattern: 'solid',
    },
    leagueId: 'laliga',
    leagueKoreanName: '라리가',
    formation: '4-4-2-diamond',
    defaultTactic: 'balanced',
    finalLeagueRank: 1,
    leaguePoints: 93,
    leagueTotalRounds: 38,
    won: 29,
    drawn: 6,
    lost: 3,
    goalsFor: 106,
    goalsAgainst: 41,
    cupName: '코파 델 레이',
    cupOutcome: 'qf',
    cupResultLabel: '8강',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    summaryNote:
      '라리가 106득점(93점) 우승과 카디프 UCL 결승 유벤투스전 4-1 완승. 호날두의 토너먼트 10골 폭격과 크카모·이스코 다이아몬드가 완성한 쓰리핏 시대 최강 버전.',
    ballonDorWinnerName: '크리스티아누 호날두',
    worldBestXiCount: 5,
    leagueMvpName: '크리스티아누 호날두',
    leagueBestXiCount: 6,
    bestXiNotes: {
      '크리스티아누 호날두': '발롱도르 · UCL 8강~결승 10G',
      '루카 모드리치': '카디프 결승 중원 완벽 지배',
      '이스코': '4-4-2 다이아몬드의 핵심',
    },
  },
  {
    id: 'hist-2425-psg',
    seasonLabel: '24-25',
    displayName: '24-25 파리 생제르맹',
    nickname: '프랑스 최초 트레블 · 결승 5-0 대승',
    managerName: '루이스 엔리케',
    managerTraitId: 'gegenpress_guru',
    managerRating: 96,
    managerStyleNote:
      '슈퍼스타 의존을 벗고 젊은 압박 머신과 유동적 4-3-3 로테이션으로 파리의 숙원을 역대급으로 완성.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'parted',
      hairColor: 'silver',
      outfit: 'team_tracksuit',
    },
    userClub: {
      name: '24-25 파리 생제르맹',
      shortName: 'PSG',
      primaryColor: '#004170',
      secondaryColor: '#da291c',
      pattern: 'stripes',
    },
    leagueId: 'ligue1',
    leagueKoreanName: '리그 1',
    formation: '4-3-3',
    defaultTactic: 'gegenpressing',
    finalLeagueRank: 1,
    leaguePoints: 84,
    leagueTotalRounds: 34,
    won: 26,
    drawn: 6,
    lost: 2,
    goalsFor: 92,
    goalsAgainst: 35,
    cupName: '쿠프 드 프랑스',
    cupOutcome: 'winner',
    cupResultLabel: '우승',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    summaryNote:
      '리그 1(34R 84점·92득점), 쿠프 드 프랑스, 그리고 뮌헨 UCL 결승 인터 밀란전 사상 최다 점수차 5-0 완승으로 프랑스 축구 최초의 대륙 트레블 달성.',
    ballonDorWinnerName: '우스만 뎀벨레',
    worldBestXiCount: 5,
    leagueMvpName: '우스만 뎀벨레',
    leagueBestXiCount: 8,
    bestXiNotes: {
      '우스만 뎀벨레': '2025 발롱도르 · 공식전 35G',
      '비티냐': '트레블 중원의 지휘자',
      '데지레 두에': 'UCL 결승 2G 1A 최우수 선수',
    },
  },
  {
    id: 'hist-8889-milan',
    seasonLabel: '88-89',
    displayName: '88-89 AC 밀란',
    nickname: '불멸의 밀란 · 존 프레싱 혁명',
    managerName: '아리고 사키',
    managerTraitId: 'gegenpress_guru',
    managerRating: 97,
    managerStyleNote:
      '압축된 25m 간격의 존 프레싱과 오프사이드 트랩 4-4-2로 현대 축구의 전술 지형을 완전히 바꾼 혁명가.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'bald',
      hairColor: 'silver',
      outfit: 'navy_coat',
    },
    userClub: {
      name: '88-89 AC 밀란',
      shortName: 'ACM',
      primaryColor: '#c8102e',
      secondaryColor: '#111827',
      pattern: 'stripes',
    },
    leagueId: 'seriea',
    leagueKoreanName: '세리에 A',
    formation: '4-4-2',
    defaultTactic: 'gegenpressing',
    finalLeagueRank: 3,
    leaguePoints: 62, // 16승 14무 4패 (당시 2점제 46점 → 현행 3점제 환산 62점)
    leagueTotalRounds: 34,
    won: 16,
    drawn: 14,
    lost: 4,
    goalsFor: 61,
    goalsAgainst: 25,
    cupName: '코파 이탈리아',
    cupOutcome: 'early',
    cupResultLabel: '조별 탈락',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    uclUnbeatenWin: true,
    summaryNote:
      '오렌지 삼총사(판 바스턴·굴리트·레이카르트)와 바레시·말디니 4백으로 4강 레알 5-0·결승 슈테아우아 4-0 완승 및 무패 유러피언 컵 우승을 일군 불멸의 팀.',
    ballonDorWinnerName: '마르코 판 바스턴',
    worldBestXiCount: 6,
    leagueMvpName: '마르코 판 바스턴',
    leagueBestXiCount: 5,
    bestXiNotes: {
      '마르코 판 바스턴': '발롱도르 2연패 · 결승 2G',
      '루드 굴리트': '결승 2G · 압도적 피지컬',
      '프랑코 바레시': '오프사이드 트랩의 절대 지휘관',
    },
  },
  {
    id: 'hist-0708-manutd',
    seasonLabel: '07-08',
    displayName: '07-08 맨체스터 유나이티드',
    nickname: '황금 삼각편대 · EPL+UCL 무패 더블',
    managerName: '알렉스 퍼거슨',
    managerTraitId: 'big_game_hunter',
    managerRating: 99,
    managerStyleNote:
      '호날두·루니·테베스의 유동적 스위칭 역습과 퍼디난드·비디치 철벽 수비로 잉글랜드와 유럽을 동시 제패.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'parted',
      hairColor: 'silver',
      outfit: 'navy_coat',
    },
    userClub: {
      name: '07-08 맨체스터 유나이티드',
      shortName: 'MUN',
      primaryColor: '#da291c',
      secondaryColor: '#ffffff',
      pattern: 'solid',
    },
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    formation: '4-3-3',
    defaultTactic: 'counter',
    finalLeagueRank: 1,
    leaguePoints: 87,
    leagueTotalRounds: 38,
    won: 27,
    drawn: 6,
    lost: 5,
    goalsFor: 80,
    goalsAgainst: 22,
    cupName: 'FA컵',
    cupOutcome: 'qf',
    cupResultLabel: '8강',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    uclUnbeatenWin: true,
    summaryNote:
      '호날두(42골·발롱도르)·루니·테베스 황금 삼각편대와 EPL 최소 22실점 수비벽, 스콜스·캐릭·박지성의 헌신으로 EPL과 UCL 무패 우승 더블 달성.',
    ballonDorWinnerName: '크리스티아누 호날두',
    worldBestXiCount: 3,
    leagueMvpName: '크리스티아누 호날두',
    leagueBestXiCount: 5,
    bestXiNotes: {
      '크리스티아누 호날두': '발롱도르 · 공식전 42G · EPL 31G',
      '리오 퍼디난드': '최소 22실점 철벽의 리더',
      '웨인 루니': '스위칭 공격의 핵심 심장',
    },
  },
  {
    id: 'hist-1920-liverpool',
    seasonLabel: '19-20',
    displayName: '19-20 리버풀',
    nickname: '헤비메탈 압박 머신 · 30년 만의 99점 우승',
    managerName: '위르겐 클롭',
    managerTraitId: 'gegenpress_guru',
    managerRating: 96,
    managerStyleNote:
      '양 풀백의 창조적 크로스와 마누라 스리톱의 전방 압박·직선 역습으로 프리미어리그를 조기 평정.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'fluffy',
      hairColor: 'blonde',
      outfit: 'team_tracksuit',
    },
    userClub: {
      name: '19-20 리버풀',
      shortName: 'LIV',
      primaryColor: '#c8102e',
      secondaryColor: '#00b2a9',
      pattern: 'solid',
    },
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    formation: '4-3-3',
    defaultTactic: 'gegenpressing',
    finalLeagueRank: 1,
    leaguePoints: 99,
    leagueTotalRounds: 38,
    won: 32,
    drawn: 3,
    lost: 3,
    goalsFor: 85,
    goalsAgainst: 33,
    cupName: 'FA컵',
    cupOutcome: 'r16',
    cupResultLabel: '16강',
    uclOutcome: 'r16',
    uclResultLabel: '16강',
    summaryNote:
      '개막 27경기 26승 1무·홈 18승 1무 무패의 압도적 질주로 승점 99점(32승 3무 3패)을 쌓으며 리버풀에 30년 만의 리그 우승을 안긴 클롭의 정점.',
    worldBestXiCount: 3,
    leagueMvpName: '조던 헨더슨',
    leagueBestXiCount: 5,
    bestXiNotes: {
      '모하메드 살라': 'EPL 19G 10A · 팀 최다 득점',
      '버질 판 다이크': '38R 전 경기 풀타임 철벽',
      '트렌트 알렉산더아놀드': 'EPL 13도움 · 풀백 혁명',
    },
  },
  {
    id: 'hist-0607-milan',
    seasonLabel: '06-07',
    displayName: '06-07 AC 밀란',
    nickname: '카카 발롱도르 · 아테네의 복수',
    managerName: '카를로 안첼로티',
    managerTraitId: 'midfield_maestro',
    managerRating: 97,
    managerStyleNote:
      '피를로·가투소·세도르프·암브로시니의 황금 중원으로 카카에게 절대적 자유를 부여한 4-4-2 다이아몬드/크리스마스 트리 명장.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'parted',
      hairColor: 'black',
      outfit: 'classic_suit',
    },
    userClub: {
      name: '06-07 AC 밀란',
      shortName: 'ACM',
      primaryColor: '#c8102e',
      secondaryColor: '#111827',
      pattern: 'stripes',
    },
    leagueId: 'seriea',
    leagueKoreanName: '세리에 A',
    formation: '4-4-2-diamond',
    defaultTactic: 'possession',
    finalLeagueRank: 4,
    leaguePoints: 61, // 19승 12무 7패 (승점 -8 삭감 반영 공식 61점 / 필드 승점 69점)
    leagueTotalRounds: 38,
    won: 19,
    drawn: 12,
    lost: 7,
    goalsFor: 57,
    goalsAgainst: 36,
    cupName: '코파 이탈리아',
    cupOutcome: 'sf',
    cupResultLabel: '4강',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    summaryNote:
      '칼치오폴리 승점 -8 삭감의 역경을 딛고 바이에른·맨유·리버풀을 연파하며 아테네에서 통산 7번째 빅이어를 들어 올린 카카·피를로·네스타·말디니의 전설.',
    ballonDorWinnerName: '카카',
    worldBestXiCount: 3,
    leagueMvpName: '카카',
    leagueBestXiCount: 4,
    bestXiNotes: {
      '카카': '2007 발롱도르 · UCL 10G 득점왕',
      '필리포 인자기': '결승 리버풀전 멀티골 MOM',
      '안드레아 피를로': '레지스타의 교과서',
    },
  },
  {
    id: 'hist-0102-realmadrid',
    seasonLabel: '01-02',
    displayName: '01-02 레알 마드리드',
    nickname: '갈락티코스 1기 · 지단의 왼발 발리 라 노베나',
    managerName: '비센테 델 보스케',
    managerTraitId: 'galactico_manager',
    managerRating: 96,
    managerStyleNote:
      '지단·피구·라울·카를루스 등 초호화 갈락티코 스타 군단을 마켈렐레 중심의 유연한 균형으로 하나로 묶어낸 명장.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'parted',
      hairColor: 'silver',
      outfit: 'classic_suit',
    },
    userClub: {
      name: '01-02 레알 마드리드',
      shortName: 'RMA',
      primaryColor: '#f8fafc',
      secondaryColor: '#1e3a8a',
      pattern: 'solid',
    },
    leagueId: 'laliga',
    leagueKoreanName: '라리가',
    formation: '4-4-2-diamond',
    defaultTactic: 'balanced',
    finalLeagueRank: 3,
    leaguePoints: 66,
    leagueTotalRounds: 38,
    won: 19,
    drawn: 9,
    lost: 10,
    goalsFor: 69,
    goalsAgainst: 44,
    cupName: '코파 델 레이',
    cupOutcome: 'final',
    cupResultLabel: '준우승',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    summaryNote:
      '구단 창단 100주년에 바이에른·바르셀로나·레버쿠젠을 차례로 격파하고 지단의 역사적 왼발 발리슛과 카시야스의 신들린 선방으로 통산 9번째 UCL(라 노베나) 제패.',
    worldBestXiCount: 4,
    leagueBestXiCount: 4,
    bestXiNotes: {
      '지네딘 지단': '결승전 역사상 최고의 왼발 발리',
      '라울 곤살레스': '결승 선제골 · 공식전 29G',
      '클로드 마켈렐레': '갈락티코스의 대체 불가 엔진',
    },
  },
  {
    id: 'hist-9495-ajax',
    seasonLabel: '94-95',
    displayName: '94-95 AFC 아약스',
    nickname: '판 할의 황금 세대 · 리그+UCL 전 경기 무패 더블',
    managerName: '루이 판 할',
    managerTraitId: 'total_football',
    managerRating: 96,
    managerStyleNote:
      '평균 연령 23세 아약스 유스 황금 세대를 정교한 3-3-3-1 포지셔닝 플레이로 조련해 리그와 UCL 동시 무패 우승 달성.',
    managerAvatar: {
      gender: 'male',
      skinTone: 'light',
      hairStyle: 'parted',
      hairColor: 'brown',
      outfit: 'navy_coat',
    },
    userClub: {
      name: '94-95 AFC 아약스',
      shortName: 'AJA',
      primaryColor: '#d2122e',
      secondaryColor: '#ffffff',
      pattern: 'stripes',
    },
    leagueId: 'bundesliga',
    leagueKoreanName: '에레디비시',
    formation: '3-3-3-1',
    defaultTactic: 'possession',
    finalLeagueRank: 1,
    leaguePoints: 88, // 27승 7무 0패 (당시 2점제 61점 → 현행 3점제 환산 88점)
    leagueTotalRounds: 34,
    won: 27,
    drawn: 7,
    lost: 0,
    goalsFor: 106,
    goalsAgainst: 28,
    cupName: 'KNVB 베커르',
    cupOutcome: 'qf',
    cupResultLabel: '8강',
    uclOutcome: 'winner',
    uclResultLabel: '우승',
    uclUnbeatenWin: true,
    summaryNote:
      '에레디비시 34경기 무패 106득점 우승 + UCL 11경기 무패(4실점)로 디펜딩 챔피언 AC 밀란을 시즌 3전 전승으로 격파한 유일무이한 리그·UCL 동시 무패 더블.',
    worldBestXiCount: 4,
    leagueMvpName: '야리 리트마넨',
    leagueBestXiCount: 8,
    bestXiNotes: {
      '야리 리트마넨': '공식전 27G · UCL 6G · 3-3-3-1의 10번',
      '파트릭 클라위버르트': '18세 리그 18G · UCL 결승 결승골',
      '에드윈 판 데르 사르': 'UCL 11경기 4실점 철벽',
    },
  },
];

export { ERA_BEST_XI_DREAM_TEAMS };

export const HISTORICAL_BENCHMARK_TEAMS: HistoricalTeamEntry[] =
  RAW_HISTORICAL_TEAMS.map(buildHistoricalEntry).sort(
    (a, b) => b.seasonScore.totalScore - a.seasonScore.totalScore,
  );

export function getHistoricalTeamById(id: string): HistoricalTeamEntry | null {
  return (
    HISTORICAL_BENCHMARK_TEAMS.find((t) => t.id === id) ??
    ERA_BEST_XI_DREAM_TEAMS.find((t) => t.id === id) ??
    null
  );
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
  // Compute genuine 4-pillar player synergy + legendary manager OVR compatibility
  // so HOF teams carry exact fair effective ATT/MID/DEF identical to user teams.
  const hofChem = calculateChemistry(
    team.formation,
    team.starters,
    team.defaultTactic,
    team.managerTraitId,
    team.managerRating,
  );
  const effRatings = calculateTeamRatings(
    team.formation,
    team.starters,
    hofChem.total,
    team.managerTraitId,
    hofChem.slotSynergies,
    team.defaultTactic,
  );
  const topAttackers = [...team.starters]
    .sort((a, b) => b.att - a.att || b.ovr - a.ovr)
    .slice(0, 3)
    .map((p) => p.name);

  // Legendary era prestige lift (+1.4 base + up to +0.7 for 91..99 iconic managers)
  // keeps all 24 Historical HOF squads clearly above buffed current top-4 league AI (87.2~89.1).
  const eraPrestigeLift =
    1.4 + Math.min(0.7, Math.max(0, (team.managerRating - 90) * 0.09));
  const club: Club = {
    id: team.id,
    name: team.displayName,
    shortName: team.userClub.shortName,
    primaryColor: team.userClub.primaryColor,
    secondaryColor: team.userClub.secondaryColor,
    pattern: team.userClub.pattern,
    formation: team.formation,
    defaultTactic: team.defaultTactic,
    att: Math.min(99, Math.round(effRatings.effectiveAtt + eraPrestigeLift)),
    mid: Math.min(99, Math.round(effRatings.effectiveMid + eraPrestigeLift)),
    def: Math.min(99, Math.round(effRatings.effectiveDef + eraPrestigeLift)),
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
      const leagueSummary = h.isLeagueChampion
        ? `${h.leagueKoreanName} ${h.leaguePoints}점 우승`
        : `${h.leagueKoreanName} ${h.finalLeagueRank}위(${h.leaguePoints}점)`;
      rows.push({
        id: h.id,
        source: 'historical',
        displayName: h.displayName,
        subtitle: `${leagueSummary} · ${h.cupName} ${h.cupResultLabel} · UCL ${h.uclResultLabel}`,
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

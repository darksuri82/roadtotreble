import { computeSeasonScore } from '../engine/legacyEngine';
import { USER_CLUB_ID } from '../engine/matchEngine';
import type { CupStageId, DomesticCupState } from '../types/cup';
import type { FormationId, UserClubProfile } from '../types/game';
import type {
  BestXiEntry,
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
import type { UclKnockoutStage, UclTournamentState } from '../types/ucl';

interface RawHistoricalTeamSpec {
  id: string;
  seasonLabel: string;
  displayName: string;
  nickname: string;
  managerName: string;
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
  teamAvgOvr: number;
  summaryNote: string;
  ballonDorWinnerName?: string;
  worldBestXiCount: number;
  leagueMvpName?: string;
  leagueBestXiCount: number;
  bestXi: HistoricalBestXiPlayer[];
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
    finalLeagueRank: spec.finalLeagueRank,
    cup: syntheticCup,
    ucl: syntheticUcl,
    teamAvgOvr: spec.teamAvgOvr,
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
    cupName: spec.cupName,
    cupResultLabel: spec.cupResultLabel,
    cupWon,
    uclResultLabel: spec.uclResultLabel,
    uclWon,
    isTreble,
    isLeagueChampion,
    teamAvgOvr: spec.teamAvgOvr,
    seasonScore,
    trophies,
    summaryNote: spec.summaryNote,
    ballonDorWinnerName: spec.ballonDorWinnerName,
    worldBestXiCount: spec.worldBestXiCount,
    leagueMvpName: spec.leagueMvpName,
    leagueBestXiCount: spec.leagueBestXiCount,
    bestXi: spec.bestXi,
  };
}

const RAW_HISTORICAL_TEAMS: RawHistoricalTeamSpec[] = [
  {
    id: 'hist-1920-bayern',
    seasonLabel: '19-20',
    displayName: '19-20 바이에른 뮌헨',
    nickname: 'UCL 전승 트레블 · 6관왕',
    managerName: '한지 플릭',
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
    teamAvgOvr: 88.4,
    summaryNote: '분데스리가 100득점 + DFB-포칼 + 사상 초유의 UCL 11전 전승 우승으로 트레블을 완성한 압박 축구의 정점.',
    ballonDorWinnerName: '로베르트 레반도프스키 (FIFA 올해의 선수)',
    worldBestXiCount: 4,
    leagueMvpName: '로베르트 레반도프스키',
    leagueBestXiCount: 6,
    bestXi: [
      { position: 'GK', name: '마누엘 노이어' },
      { position: 'RB', name: '요주아 키미히' },
      { position: 'CB', name: '제롬 보아텡' },
      { position: 'CB', name: '다비드 알라바' },
      { position: 'LB', name: '알폰소 데이비스' },
      { position: 'CDM', name: '레온 고레츠카' },
      { position: 'CDM', name: '티아고 알칸타라' },
      { position: 'RW', name: '세르주 그나브리' },
      { position: 'CAM', name: '토마스 뮐러', note: '리그 21도움' },
      { position: 'LW', name: '킹슬리 코망', note: '결승 결승골' },
      { position: 'ST', name: '로베르트 레반도프스키', note: '시즌 55골' },
    ],
  },
  {
    id: 'hist-1213-bayern',
    seasonLabel: '12-13',
    displayName: '12-13 바이에른 뮌헨',
    nickname: '분데스리가 역대 최다 승점 트레블',
    managerName: '유프 하인케스',
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
    teamAvgOvr: 88.2,
    summaryNote: '분데스리가 34R 91점·단 1패·18실점이라는 압도적 기록과 로베리 좌우 윙어 듀오로 독일 구단 최초 트레블 달성.',
    worldBestXiCount: 3,
    leagueMvpName: '프랑크 리베리',
    leagueBestXiCount: 6,
    bestXi: [
      { position: 'GK', name: '마누엘 노이어' },
      { position: 'RB', name: '필립 람' },
      { position: 'CB', name: '제롬 보아텡' },
      { position: 'CB', name: '단테' },
      { position: 'LB', name: '다비드 알라바' },
      { position: 'CDM', name: '하비 마르티네스' },
      { position: 'CDM', name: '바스티안 슈바인슈타이거' },
      { position: 'RW', name: '아르옌 로벤', note: '결승 결승골' },
      { position: 'CAM', name: '토마스 뮐러' },
      { position: 'LW', name: '프랑크 리베리', note: 'UEFA 올해의 선수' },
      { position: 'ST', name: '마리오 만주키치' },
    ],
  },
  {
    id: 'hist-1415-barca',
    seasonLabel: '14-15',
    displayName: '14-15 FC 바르셀로나',
    nickname: 'MSN 122골 · 유럽 최초 2회 트레블',
    managerName: '루이스 엔리케',
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
    teamAvgOvr: 89.2,
    summaryNote: '메시·수아레스·네이마르(MSN) 트리오가 합작 122골을 폭발시키며 라리가 94점·코파 델 레이·UCL을 석권.',
    ballonDorWinnerName: '리오넬 메시',
    worldBestXiCount: 4,
    leagueMvpName: '리오넬 메시',
    leagueBestXiCount: 6,
    bestXi: [
      { position: 'GK', name: '마르크안드레 테어 슈테겐' },
      { position: 'RB', name: '다니 알베스' },
      { position: 'CB', name: '제라르 피케' },
      { position: 'CB', name: '하비에르 마스체라노' },
      { position: 'LB', name: '조르디 알바' },
      { position: 'CDM', name: '세르히오 부스케츠' },
      { position: 'CM', name: '이반 라키티치' },
      { position: 'CM', name: '안드레스 이니에스타' },
      { position: 'RW', name: '리오넬 메시', note: '발롱도르 · 58골' },
      { position: 'ST', name: '루이스 수아레스' },
      { position: 'LW', name: '네이마르', note: '39골' },
    ],
  },
  {
    id: 'hist-0809-barca',
    seasonLabel: '08-09',
    displayName: '08-09 FC 바르셀로나',
    nickname: '티키타카 탄생 · 스페인 최초 트레블',
    managerName: '펩 과르디올라',
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
    teamAvgOvr: 88.5,
    summaryNote: '펩 과르디올라 데뷔 시즌에 티키타카 점유율 축구로 라리가 105득점·코파 델 레이·UCL을 모두 제패하며 6관왕의 서막을 염.',
    ballonDorWinnerName: '리오넬 메시',
    worldBestXiCount: 4,
    leagueMvpName: '리오넬 메시',
    leagueBestXiCount: 5,
    bestXi: [
      { position: 'GK', name: '빅토르 발데스' },
      { position: 'RB', name: '다니 알베스' },
      { position: 'CB', name: '카를레스 푸욜' },
      { position: 'CB', name: '제라르 피케' },
      { position: 'LB', name: '에릭 아비달' },
      { position: 'CDM', name: '세르히오 부스케츠' },
      { position: 'CM', name: '사비 에르난데스' },
      { position: 'CM', name: '안드레스 이니에스타' },
      { position: 'RW', name: '리오넬 메시', note: '발롱도르 · 38골' },
      { position: 'ST', name: '사무엘 에투', note: '36골' },
      { position: 'LW', name: '티에리 앙리', note: '26골' },
    ],
  },
  {
    id: 'hist-2223-mancity',
    seasonLabel: '22-23',
    displayName: '22-23 맨체스터 시티',
    nickname: '홀란 52골 · 3-2-4-1 트레블',
    managerName: '펩 과르디올라',
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
    uclResultLabel: '우승',
    teamAvgOvr: 88.8,
    summaryNote: '존 스톤스의 센터백-볼란치 하이브리드 전술과 홀란(EPL 36골)·더 브라위너·로드리의 조합으로 구단 최초 트레블 완성.',
    worldBestXiCount: 5,
    leagueMvpName: '엘링 홀란',
    leagueBestXiCount: 5,
    bestXi: [
      { position: 'GK', name: '에데르송' },
      { position: 'CB', name: '카일 워커' },
      { position: 'CB', name: '후벵 디아스' },
      { position: 'CB', name: '마누엘 아칸지' },
      { position: 'CDM', name: '존 스톤스' },
      { position: 'CDM', name: '로드리', note: 'UCL 결승 결승골' },
      { position: 'RM', name: '베르나르두 실바' },
      { position: 'LM', name: '잭 그릴리시' },
      { position: 'CAM', name: '케빈 더 브라위너' },
      { position: 'CAM', name: '일카이 귄도안' },
      { position: 'ST', name: '엘링 홀란', note: '시즌 52골' },
    ],
  },
  {
    id: 'hist-0910-inter',
    seasonLabel: '09-10',
    displayName: '09-10 인터 밀란',
    nickname: '이탈리아 최초 트레블 · 무리뉴 실리 축구',
    managerName: '조제 무리뉴',
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
    teamAvgOvr: 86.2,
    summaryNote: '철벽 수비와 면도날 역습으로 바르셀로나와 바이에른을 차례로 꺾고 이탈리아 클럽 사상 유일의 트레블 달성.',
    worldBestXiCount: 3,
    leagueMvpName: '디에고 밀리토',
    leagueBestXiCount: 5,
    bestXi: [
      { position: 'GK', name: '줄리우 세자르' },
      { position: 'RB', name: '마이콩' },
      { position: 'CB', name: '루시우' },
      { position: 'CB', name: '발테르 사무엘' },
      { position: 'LB', name: '하비에르 사네티' },
      { position: 'CDM', name: '에스테반 캄비아소' },
      { position: 'CDM', name: '티아고 모타' },
      { position: 'RW', name: '사무엘 에투' },
      { position: 'CAM', name: '베슬러이 스네이더르' },
      { position: 'LW', name: '고란 판데프' },
      { position: 'ST', name: '디에고 밀리토', note: '결승 멀티골' },
    ],
  },
  {
    id: 'hist-9899-manutd',
    seasonLabel: '98-99',
    displayName: '98-99 맨체스터 유나이티드',
    nickname: '캄프 누의 기적 · 잉글랜드 최초 트레블',
    managerName: '알렉스 퍼거슨',
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
    uclResultLabel: '우승',
    teamAvgOvr: 85.4,
    summaryNote: '클래스 오브 92와 요크-콜 투톱, 그리고 캄프 누 후반 추가시간 대역전극으로 잉글랜드 축구 사상 첫 트레블을 기록.',
    worldBestXiCount: 2,
    leagueMvpName: '드와이트 요크',
    leagueBestXiCount: 5,
    bestXi: [
      { position: 'GK', name: '피터 슈마이켈' },
      { position: 'RB', name: '게리 네빌' },
      { position: 'CB', name: '야프 스탐' },
      { position: 'CB', name: '로니 욘센' },
      { position: 'LB', name: '데니스 어윈' },
      { position: 'RM', name: '데이비드 베컴', note: '발롱도르 2위' },
      { position: 'CM', name: '로이 킨' },
      { position: 'CM', name: '폴 스콜스' },
      { position: 'LM', name: '라이언 긱스' },
      { position: 'ST', name: '드와이트 요크' },
      { position: 'ST', name: '앤디 콜' },
    ],
  },
  {
    id: 'hist-2324-leverkusen',
    seasonLabel: '23-24',
    displayName: '23-24 바이어 레버쿠젠',
    nickname: '네버루젠 · 분데스리가 사상 첫 무패 우승',
    managerName: '사비 알론소',
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
    teamAvgOvr: 83.4,
    summaryNote: '분데스리가 역사상 최초 무패 우승(28승 6무 0패 · 90점)과 DFB-포칼 우승으로 국내 무패 더블을 달성한 사비 알론소의 마법.',
    worldBestXiCount: 1,
    leagueMvpName: '플로리안 비르츠',
    leagueBestXiCount: 6,
    bestXi: [
      { position: 'GK', name: '루카시 흐라데츠키' },
      { position: 'CB', name: '에드몽 탑소바' },
      { position: 'CB', name: '요나탄 타' },
      { position: 'CB', name: '피에로 인카피에' },
      { position: 'RWB', name: '제레미 프림퐁' },
      { position: 'CM', name: '그라니트 자카' },
      { position: 'CM', name: '에세키엘 팔라시오스' },
      { position: 'LWB', name: '알레한드로 그리말도' },
      { position: 'CAM', name: '플로리안 비르츠', note: '분데스리가 MVP' },
      { position: 'CAM', name: '요나스 호프만' },
      { position: 'ST', name: '빅터 보니페이스' },
    ],
  },
  {
    id: 'hist-1718-mancity',
    seasonLabel: '17-18',
    displayName: '17-18 맨체스터 시티',
    nickname: '센추리온즈 · EPL 최초 승점 100점',
    managerName: '펩 과르디올라',
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
    teamAvgOvr: 87.6,
    summaryNote: '프리미어리그 역사상 최초 승점 100점, 최다승(32승), 최다골(106골), 최대 득실(+79)을 기록한 센추리온즈.',
    worldBestXiCount: 1,
    leagueBestXiCount: 5,
    bestXi: [
      { position: 'GK', name: '에데르송' },
      { position: 'RB', name: '카일 워커' },
      { position: 'CB', name: '뱅상 콤파니' },
      { position: 'CB', name: '니콜라스 오타멘디' },
      { position: 'LB', name: '파비안 델프' },
      { position: 'CDM', name: '페르난지뉴' },
      { position: 'CM', name: '케빈 더 브라위너', note: '도움왕 16A' },
      { position: 'CM', name: '다비드 실바' },
      { position: 'RW', name: '라힘 스털링' },
      { position: 'ST', name: '세르히오 아구에로' },
      { position: 'LW', name: '르로이 자네' },
    ],
  },
  {
    id: 'hist-1112-realmadrid',
    seasonLabel: '11-12',
    displayName: '11-12 레알 마드리드',
    nickname: '승점 100점 · 라리가 역대 최다 121득점',
    managerName: '조제 무리뉴',
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
    teamAvgOvr: 88.4,
    summaryNote: '전광석화 같은 역습 축구로 라리가 사상 최초 승점 100점과 역대 최다 121골(+89 득실)을 기록.',
    worldBestXiCount: 4,
    leagueMvpName: '크리스티아누 호날두',
    leagueBestXiCount: 5,
    bestXi: [
      { position: 'GK', name: '이케르 카시야스' },
      { position: 'RB', name: '알바로 아르벨로아' },
      { position: 'CB', name: '페페' },
      { position: 'CB', name: '세르히오 라모스' },
      { position: 'LB', name: '마르셀루' },
      { position: 'CDM', name: '사비 알론소' },
      { position: 'CDM', name: '사미 케디라' },
      { position: 'RW', name: '앙헬 디 마리아' },
      { position: 'CAM', name: '메수트 외질', note: '도움왕 17A' },
      { position: 'LW', name: '크리스티아누 호날두', note: '리그 46골' },
      { position: 'ST', name: '카림 벤제마' },
    ],
  },
  {
    id: 'hist-1314-juventus',
    seasonLabel: '13-14',
    displayName: '13-14 유벤투스',
    nickname: '유럽 5대 리그 역대 최다 승점 102점',
    managerName: '안토니오 콘테',
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
    teamAvgOvr: 86.0,
    summaryNote: '홈 19전 전승 포함 33승 3무 2패, 유럽 5대 리그 역사상 단일 시즌 최고 승점인 102점을 달성한 BBC 스리백.',
    worldBestXiCount: 0,
    leagueMvpName: '안드레아 피를로',
    leagueBestXiCount: 6,
    bestXi: [
      { position: 'GK', name: '잔루이지 부폰' },
      { position: 'CB', name: '안드레아 바르찰리' },
      { position: 'CB', name: '레오나르도 보누치' },
      { position: 'CB', name: '조르조 키엘리니' },
      { position: 'RM', name: '슈테판 리히트슈타이너' },
      { position: 'CM', name: '아르투로 비달' },
      { position: 'CDM', name: '안드레아 피를로' },
      { position: 'CM', name: '폴 포그바' },
      { position: 'LM', name: '콰드워 아사모아' },
      { position: 'ST', name: '카를로스 테베스', note: '19골' },
      { position: 'ST', name: '페르난도 요렌테' },
    ],
  },
  {
    id: 'hist-0304-arsenal',
    seasonLabel: '03-04',
    displayName: '03-04 아스널',
    nickname: '인빈시블 · EPL 유일 무패 우승',
    managerName: '아르센 벵거',
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
    teamAvgOvr: 86.2,
    summaryNote: '프리미어리그 출범 이후 유일한 38경기 무패 우승(26승 12무 0패)으로 황금 트로피를 수여받은 전설의 무패 군단.',
    worldBestXiCount: 2,
    leagueMvpName: '티에리 앙리',
    leagueBestXiCount: 6,
    bestXi: [
      { position: 'GK', name: '옌스 레만' },
      { position: 'RB', name: '로랑' },
      { position: 'CB', name: '솔 캠벨' },
      { position: 'CB', name: '콜로 투레' },
      { position: 'LB', name: '애슐리 콜' },
      { position: 'RM', name: '프레드리크 융베리' },
      { position: 'CM', name: '파트리크 비에이라' },
      { position: 'CM', name: '질베르투 실바' },
      { position: 'LM', name: '로베르 피레스' },
      { position: 'ST', name: '데니스 베르캄프' },
      { position: 'ST', name: '티에리 앙리', note: 'EPL 득점왕 30골' },
    ],
  },
  {
    id: 'hist-0405-chelsea',
    seasonLabel: '04-05',
    displayName: '04-05 첼시',
    nickname: '38경기 15실점 · EPL 역대 최소 실점 철벽',
    managerName: '조제 무리뉴',
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
    teamAvgOvr: 86.5,
    summaryNote: '체흐-테리-카르발류-마켈렐레의 철벽 수비로 38경기 15실점·25클린시트·단 1패라는 불멸의 수비 기록을 수립.',
    worldBestXiCount: 2,
    leagueMvpName: '프랭크 램파드',
    leagueBestXiCount: 4,
    bestXi: [
      { position: 'GK', name: '페트르 체흐', note: '24클린시트' },
      { position: 'RB', name: '파울루 페헤이라' },
      { position: 'CB', name: '존 테리', note: 'PFA 올해의 선수' },
      { position: 'CB', name: '히카르두 카르발류' },
      { position: 'LB', name: '윌리암 갈라스' },
      { position: 'CDM', name: '클로드 마켈렐레' },
      { position: 'CM', name: '프랭크 램파드', note: '발롱도르 2위' },
      { position: 'CM', name: '티아구 멘데스' },
      { position: 'RW', name: '아르옌 로벤' },
      { position: 'ST', name: '디디에 드로그바' },
      { position: 'LW', name: '데미안 더프' },
    ],
  },
  {
    id: 'hist-1516-leicester',
    seasonLabel: '15-16',
    displayName: '15-16 레스터 시티',
    nickname: '5000분의 1 동화 · 축구 역사상 최고의 언더독',
    managerName: '클라우디오 라니에리',
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
    teamAvgOvr: 78.2,
    summaryNote: '강등 1순위·우승 배당 5000배를 뒤집고 바디·마레즈·캉테의 완벽한 4-4-2 역습으로 프리미어리그 정상에 오른 기적의 시즌.',
    worldBestXiCount: 0,
    leagueMvpName: '리야드 마레즈',
    leagueBestXiCount: 4,
    bestXi: [
      { position: 'GK', name: '카스페르 슈마이켈' },
      { position: 'RB', name: '대니 심슨' },
      { position: 'CB', name: '웨스 모건' },
      { position: 'CB', name: '로베르트 후트' },
      { position: 'LB', name: '크리스티안 푸흐스' },
      { position: 'RM', name: '리야드 마레즈', note: 'EPL MVP · 17G 11A' },
      { position: 'CM', name: '은골로 캉테' },
      { position: 'CM', name: '대니 드링크워터' },
      { position: 'LM', name: '마크 올브라이턴' },
      { position: 'ST', name: '오카자키 신지' },
      { position: 'ST', name: '제이미 바디', note: '11경기 연속골 · 24G' },
    ],
  },
];

export const HISTORICAL_BENCHMARK_TEAMS: HistoricalTeamEntry[] =
  RAW_HISTORICAL_TEAMS.map(buildHistoricalEntry).sort(
    (a, b) => b.seasonScore.totalScore - a.seasonScore.totalScore,
  );

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

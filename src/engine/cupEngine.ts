import type { PlayerConditionMap } from '../types/condition';
import type {
  CupMatchNode,
  CupMeta,
  CupStageId,
  DomesticCupState,
} from '../types/cup';
import type {
  Club,
  Fixture,
  LeagueId,
  MatchResult,
  PlayerSeasonStats,
} from '../types/league';
import type { Player } from '../types/player';
import {
  commitAiClubPostMatchConditions,
  prepareAiClubLineupForMatch,
} from './conditionEngine';
import {
  simulateExtraTimeAndPenalties,
  simulateMatch,
  USER_CLUB_ID,
  type UserMatchContext,
} from './matchEngine';
import { accumulateCompetitionPlayerStats } from './standingsEngine';

export const CUP_STAGE_ORDER: CupStageId[] = ['r16', 'qf', 'sf', 'final'];

export const CUP_STAGE_LABELS: Record<CupStageId, string> = {
  r16: '16강',
  qf: '8강',
  sf: '4강',
  final: '결승',
};

export const CUP_META_BY_LEAGUE: Record<LeagueId, CupMeta> = {
  epl: {
    leagueId: 'epl',
    id: 'fa-cup',
    name: 'FA Cup',
    koreanName: 'FA 컵',
    accentColor: '#ef4444',
  },
  laliga: {
    leagueId: 'laliga',
    id: 'copa-del-rey',
    name: 'Copa del Rey',
    koreanName: '코파 델 레이',
    accentColor: '#f59e0b',
  },
  seriea: {
    leagueId: 'seriea',
    id: 'coppa-italia',
    name: 'Coppa Italia',
    koreanName: '코파 이탈리아',
    accentColor: '#10b981',
  },
  bundesliga: {
    leagueId: 'bundesliga',
    id: 'dfb-pokal',
    name: 'DFB-Pokal',
    koreanName: 'DFB-포칼',
    accentColor: '#eab308',
  },
  ligue1: {
    leagueId: 'ligue1',
    id: 'coupe-de-france',
    name: 'Coupe de France',
    koreanName: '쿠프 드 프랑스',
    accentColor: '#3b82f6',
  },
};

function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createDomesticCupState(
  leagueId: LeagueId,
  clubs: Club[],
  totalRounds: number,
  rng: () => number = Math.random,
  userClubId = USER_CLUB_ID,
): DomesticCupState {
  const meta = CUP_META_BY_LEAGUE[leagueId];
  const triggerRounds: [number, number, number, number] =
    totalRounds <= 34 ? [7, 14, 22, 29] : [8, 16, 24, 32];

  const userClub = clubs.find((c) => c.id === userClubId);
  const others = shuffleArray(
    clubs.filter((c) => c.id !== userClubId),
    rng,
  ).slice(0, userClub ? 15 : 16);

  const selected = userClub ? [userClub, ...others] : others;
  const seededDraw = shuffleArray(selected, rng);
  const participantIds = seededDraw.map((c) => c.id);

  const r16: CupMatchNode[] = [];
  for (let i = 0; i < 8; i += 1) {
    const home = seededDraw[i * 2];
    const away = seededDraw[i * 2 + 1];
    if (!home || !away) continue;
    r16.push({
      id: `${meta.id}-r16-${i}`,
      stage: 'r16',
      matchIndex: i,
      homeTeamId: home.id,
      awayTeamId: away.id,
      played: false,
    });
  }

  return {
    meta,
    triggerRounds,
    participantIds,
    currentStage: 'r16',
    pendingStage: null,
    rounds: {
      r16,
      qf: [],
      sf: [],
      final: [],
    },
    userEliminatedAt: null,
    championTeamId: null,
    completed: false,
  };
}

export function getNextCupStage(stage: CupStageId): CupStageId | null {
  const idx = CUP_STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx >= CUP_STAGE_ORDER.length - 1) return null;
  return CUP_STAGE_ORDER[idx + 1];
}

export function checkCupStageTrigger(
  cup: DomesticCupState | null,
  currentLeagueRound: number,
): CupStageId | null {
  if (!cup || cup.completed) return null;
  for (let i = 0; i < CUP_STAGE_ORDER.length; i += 1) {
    const stage = CUP_STAGE_ORDER[i];
    const triggerRound = cup.triggerRounds[i];
    const matches = cup.rounds[stage];
    const allPlayed = matches.length > 0 && matches.every((m) => m.played);
    if (!allPlayed) {
      if (currentLeagueRound >= triggerRound && matches.length > 0) {
        return stage;
      }
      return null;
    }
  }
  return null;
}

export function findUserCupMatch(
  cup: DomesticCupState | null,
  stage: CupStageId,
  userClubId = USER_CLUB_ID,
): CupMatchNode | null {
  if (!cup) return null;
  const matches = cup.rounds[stage] ?? [];
  return (
    matches.find(
      (m) =>
        !m.played &&
        (m.homeTeamId === userClubId || m.awayTeamId === userClubId),
    ) ?? null
  );
}

export function resolveKnockoutWinnerId(result: MatchResult): string {
  if (result.extraTime) {
    return result.extraTime.winnerTeamId;
  }
  if (result.homeGoals > result.awayGoals) return result.homeTeamId;
  if (result.awayGoals > result.homeGoals) return result.awayTeamId;
  return result.homeTeamId;
}

export function cupNodeToFixture(
  node: CupMatchNode,
  stageNumber: number,
): Fixture {
  return {
    id: node.id,
    round: stageNumber,
    homeTeamId: node.homeTeamId,
    awayTeamId: node.awayTeamId,
    played: node.played,
    result: node.result,
  };
}

export interface AdvanceCupStageResult {
  cup: DomesticCupState;
  cupPlayerStats: Record<string, PlayerSeasonStats>;
  stageResults: MatchResult[];
  userResult: MatchResult | null;
}

/**
 * Resolves an entire Domestic Cup stage (r16 / qf / sf / final):
 * - Uses `precomputedUserResult` if the user played live, or simulates user's match with auto-subs + ET/PK.
 * - Simulates all AI matches in the stage (with ET/PK on draws).
 * - Advances winners to the next round bracket or crowns the Cup Champion.
 */
export function advanceCupStage(params: {
  cup: DomesticCupState;
  stage: CupStageId;
  clubsById: Record<string, Club>;
  aiRosters: Record<string, Player[]>;
  cupPlayerStats: Record<string, PlayerSeasonStats>;
  userContext?: UserMatchContext;
  precomputedUserResult?: MatchResult | null;
  /** Multi league: fully resolved results (incl. ET/PK) keyed by cup node id */
  precomputedResults?: Record<string, MatchResult>;
  userClubId?: string;
  conditionMap?: PlayerConditionMap;
  excludeIds?: Set<string>;
  rng?: () => number;
}): AdvanceCupStageResult {
  const {
    cup,
    stage,
    clubsById,
    aiRosters,
    cupPlayerStats,
    userContext,
    precomputedUserResult = null,
    precomputedResults,
    userClubId = USER_CLUB_ID,
    conditionMap,
    excludeIds,
    rng = Math.random,
  } = params;

  const stageIndex = CUP_STAGE_ORDER.indexOf(stage);
  const stageNum = stageIndex + 1;
  const competitionLabel = `${cup.meta.koreanName} ${CUP_STAGE_LABELS[stage]}`;
  const existingMatches = cup.rounds[stage];

  const updatedMatches: CupMatchNode[] = [];
  const stageResults: MatchResult[] = [];
  let userResult: MatchResult | null = null;
  let userEliminatedAt = cup.userEliminatedAt;

  for (const node of existingMatches) {
    if (node.played && node.result && node.winnerId) {
      updatedMatches.push(node);
      continue;
    }

    const preResolved = precomputedResults?.[node.id];
    if (preResolved) {
      const taggedPre: MatchResult = {
        ...preResolved,
        competition: 'cup',
        competitionLabel,
      };
      stageResults.push(taggedPre);
      updatedMatches.push({
        ...node,
        played: true,
        result: taggedPre,
        winnerId: resolveKnockoutWinnerId(taggedPre),
      });
      continue;
    }

    const involvesUser =
      node.homeTeamId === userClubId || node.awayTeamId === userClubId;
    const homeClub = clubsById[node.homeTeamId];
    const awayClub = clubsById[node.awayTeamId];
    const homeIsUser = node.homeTeamId === userClubId && Boolean(userContext);
    const awayIsUser = node.awayTeamId === userClubId && Boolean(userContext);

    const homePrep = homeIsUser
      ? null
      : prepareAiClubLineupForMatch({
          club: homeClub,
          baseRoster: aiRosters[node.homeTeamId] ?? [],
          conditionMap,
          excludeIds,
        });
    const awayPrep = awayIsUser
      ? null
      : prepareAiClubLineupForMatch({
          club: awayClub,
          baseRoster: aiRosters[node.awayTeamId] ?? [],
          conditionMap,
          excludeIds,
        });

    const homeRoster = homeIsUser && userContext
      ? userContext.starters
      : homePrep?.effectiveStarters ?? aiRosters[node.homeTeamId] ?? [];
    const awayRoster = awayIsUser && userContext
      ? userContext.starters
      : awayPrep?.effectiveStarters ?? aiRosters[node.awayTeamId] ?? [];

    let finalResult: MatchResult;
    if (involvesUser && precomputedUserResult) {
      finalResult = {
        ...precomputedUserResult,
        competition: 'cup',
        competitionLabel,
      };
      // Safety net: ensure knockout draw is resolved via ET/PK
      if (
        finalResult.homeGoals === finalResult.awayGoals &&
        !finalResult.extraTime
      ) {
        finalResult = simulateExtraTimeAndPenalties({
          baseResult: finalResult,
          homeClub,
          awayClub,
          homeRoster,
          awayRoster,
          userContext,
          rng,
        });
      }
    } else {
      const fixture = cupNodeToFixture(node, stageNum);
      const base = simulateMatch(
        fixture,
        homeClub,
        awayClub,
        homeRoster,
        awayRoster,
        involvesUser ? userContext : undefined,
        rng,
      );
      const tagged: MatchResult = {
        ...base,
        competition: 'cup',
        competitionLabel,
      };
      finalResult =
        tagged.homeGoals === tagged.awayGoals
          ? simulateExtraTimeAndPenalties({
              baseResult: tagged,
              homeClub,
              awayClub,
              homeRoster,
              awayRoster,
              userContext: involvesUser ? userContext : undefined,
              rng,
            })
          : tagged;
    }

    const wentToEt = Boolean(finalResult.extraTime);
    if (homePrep) {
      commitAiClubPostMatchConditions({
        club: homeClub,
        rawStarters: homePrep.rawStarters,
        fullClubSquad: homePrep.fullClubSquad,
        conditionMap,
        competition: 'cup',
        round: stageNum,
        isShortRest: true,
        isExtraTime: wentToEt,
        outcome:
          finalResult.homeGoals > finalResult.awayGoals
            ? 'W'
            : finalResult.homeGoals < finalResult.awayGoals
              ? 'L'
              : 'D',
        goalDiff: finalResult.homeGoals - finalResult.awayGoals,
        cleanSheet: finalResult.awayGoals === 0,
        rng,
      });
    }
    if (awayPrep) {
      commitAiClubPostMatchConditions({
        club: awayClub,
        rawStarters: awayPrep.rawStarters,
        fullClubSquad: awayPrep.fullClubSquad,
        conditionMap,
        competition: 'cup',
        round: stageNum,
        isShortRest: true,
        isExtraTime: wentToEt,
        outcome:
          finalResult.awayGoals > finalResult.homeGoals
            ? 'W'
            : finalResult.awayGoals < finalResult.homeGoals
              ? 'L'
              : 'D',
        goalDiff: finalResult.awayGoals - finalResult.homeGoals,
        cleanSheet: finalResult.homeGoals === 0,
        rng,
      });
    }

    const winnerId = resolveKnockoutWinnerId(finalResult);
    if (involvesUser) {
      userResult = finalResult;
      if (winnerId !== userClubId) {
        userEliminatedAt = stage;
      }
    }

    stageResults.push(finalResult);
    updatedMatches.push({
      ...node,
      played: true,
      result: finalResult,
      winnerId,
    });
  }

  const nextStage = getNextCupStage(stage);
  const nextRounds: Record<CupStageId, CupMatchNode[]> = {
    ...cup.rounds,
    [stage]: updatedMatches,
  };

  let championTeamId = cup.championTeamId;
  let completed = cup.completed;
  let currentStage: CupStageId = stage;

  if (nextStage) {
    const nextNodes: CupMatchNode[] = [];
    for (let i = 0; i < updatedMatches.length; i += 2) {
      const w1 = updatedMatches[i]?.winnerId;
      const w2 = updatedMatches[i + 1]?.winnerId;
      if (!w1 || !w2) continue;
      // Randomly determine home/away for single-leg knockout (Final is neutral label)
      const swapHome = nextStage !== 'final' && rng() < 0.5;
      nextNodes.push({
        id: `${cup.meta.id}-${nextStage}-${i / 2}`,
        stage: nextStage,
        matchIndex: i / 2,
        homeTeamId: swapHome ? w2 : w1,
        awayTeamId: swapHome ? w1 : w2,
        played: false,
      });
    }
    nextRounds[nextStage] = nextNodes;
    currentStage = nextStage;
  } else {
    championTeamId = updatedMatches[0]?.winnerId ?? null;
    completed = true;
  }

  const nextCupPlayerStats = accumulateCompetitionPlayerStats(
    cupPlayerStats,
    stageResults,
    clubsById,
    userClubId,
  );

  return {
    cup: {
      ...cup,
      currentStage,
      pendingStage: null,
      rounds: nextRounds,
      userEliminatedAt,
      championTeamId,
      completed,
    },
    cupPlayerStats: nextCupPlayerStats,
    stageResults,
    userResult,
  };
}

export function getUserCupResultLabel(
  cup: DomesticCupState | null,
  userClubId = USER_CLUB_ID,
): string {
  if (!cup) return '미참가';
  if (cup.championTeamId === userClubId) return '우승';
  if (cup.userEliminatedAt === 'final') return '준우승';
  if (cup.userEliminatedAt === 'sf') return '4강';
  if (cup.userEliminatedAt === 'qf') return '8강';
  if (cup.userEliminatedAt === 'r16') return '16강';
  return cup.completed ? '탈락' : '진행 중';
}

export function didUserWinCup(
  cup: DomesticCupState | null,
  userClubId = USER_CLUB_ID,
): boolean {
  return Boolean(cup && cup.championTeamId === userClubId);
}

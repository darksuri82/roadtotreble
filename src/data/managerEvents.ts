import {
  clampMorale,
  getPlayerCondition,
  getPositionGroup,
  isPlayerActivelyInjured,
  isPlayerRecoveringRust,
  isPlayerUnavailable,
  POSITION_GROUP_LABELS,
} from '../engine/conditionEngine';
import type {
  ActiveManagerEvent,
  ManagerEventChoiceDef,
  ManagerEventMatchContext,
  ManagerEventOutcomeItem,
  ManagerEventPlayerMatchStat,
  ManagerEventResolution,
  ManagerEventSceneId,
  ManagerEventsState,
  ManagerEventTemplate,
  ManagerEventTriggerType,
  PlayerConditionMap,
} from '../types/condition';
import type { MatchResult } from '../types/league';
import type { Player } from '../types/player';
import { LOCKER_ROOM_EVENTS } from './managerEventsLocker';
import { PRESS_CONFERENCE_EVENTS } from './managerEventsPress';

export const ALL_MANAGER_EVENTS: ManagerEventTemplate[] = [
  ...PRESS_CONFERENCE_EVENTS,
  ...LOCKER_ROOM_EVENTS,
];

export interface ManagerEventContextVars {
  teamName: string;
  opponentName: string;
  managerName: string;
  rank: number;
  streak: number;
  playerName?: string;
  positionGroup?: string;
}

export function interpolateEventText(
  text: string,
  vars: ManagerEventContextVars,
): string {
  return text
    .replaceAll('{teamName}', vars.teamName)
    .replaceAll('{opponentName}', vars.opponentName)
    .replaceAll('{managerName}', vars.managerName)
    .replaceAll('{rank}', String(vars.rank))
    .replaceAll('{streak}', String(Math.max(2, vars.streak)))
    .replaceAll('{playerName}', vars.playerName ?? '핵심 선수')
    .replaceAll('{positionGroup}', vars.positionGroup ?? '선수단');
}

export interface ManagerEventSelectionInput {
  eventsState: ManagerEventsState;
  starters: (Player | null)[];
  bench: (Player | null)[];
  conditionMap: PlayerConditionMap;
  teamName: string;
  managerName: string;
  nextOpponentName: string;
  nextOpponentRank?: number;
  userRank: number;
  isCupOrUclNext?: boolean;
  lastMatch?: MatchResult | null;
  lastMatchOpponentName?: string;
  lastMatchWasUserHome?: boolean;
  lastMatchMomPlayerId?: string | null;
  lastMatchRatings?: Record<string, number>;
  recentInjuryJustOccurred?: boolean;
  rng?: () => number;
}

function getAllSquadPlayers(
  starters: (Player | null)[],
  bench: (Player | null)[],
): Player[] {
  const out: Player[] = [];
  for (const p of starters) if (p) out.push(p);
  for (const p of bench) if (p) out.push(p);
  return out;
}

function getContextBadge(tpl: ManagerEventTemplate): string {
  const scopeLabel =
    tpl.targetScope === 'player'
      ? '개인 타겟'
      : tpl.targetScope === 'position_group'
        ? POSITION_GROUP_LABELS[tpl.positionGroup ?? 'FW']
        : '팀 전체';
  const catLabel = tpl.category === 'press_conference' ? '기자회견' : '라커룸 연설';
  return `${catLabel} · ${scopeLabel}`;
}

/**
 * Automatically selects the most atmospheric pixel-art scene among 8 distinct environments
 * based on event category, target scope, trigger context, speaker label, and competition.
 */
export function resolveManagerEventSceneId(params: {
  template: ManagerEventTemplate;
  isCupOrUclNext?: boolean;
  lastMatch?: MatchResult | null;
}): ManagerEventSceneId {
  const { template, isCupOrUclNext = false, lastMatch = null } = params;
  const sp = template.speakerLabel;
  const tr = template.trigger;

  if (template.category === 'press_conference') {
    if (
      tr === 'cup_or_ucl' ||
      tr === 'big_match' ||
      tr === 'title_race' ||
      tr === 'player_big_game_ace' ||
      isCupOrUclNext ||
      lastMatch?.competition === 'ucl'
    ) {
      return 'press_ucl_night';
    }
    if (
      sp.includes('경기 후') ||
      sp.includes('방송사') ||
      tr === 'big_win' ||
      tr === 'heavy_loss' ||
      tr === 'comeback_win' ||
      tr === 'player_mom_or_hattrick' ||
      tr === 'player_poor_rating' ||
      tr === 'xg_underperform' ||
      tr === 'conceded_many' ||
      tr === 'win_streak' ||
      tr === 'lose_streak'
    ) {
      return 'press_mixed_zone';
    }
    return 'press_official';
  }

  // Locker room / Club internal scenes (5 distinct environments)
  if (
    sp.includes('훈련장') ||
    sp.includes('훈련 후') ||
    tr === 'player_goal_drought' ||
    template.id.includes('training')
  ) {
    return 'training_pitch';
  }

  if (template.targetScope === 'position_group') {
    if (tr === 'big_win' || tr === 'clean_sheet_streak') {
      return 'celebration_locker';
    }
    if (tr === 'big_match' || tr === 'cup_or_ucl') {
      return 'stadium_tunnel';
    }
    return 'training_pitch';
  }

  if (template.targetScope === 'player') {
    if (tr === 'player_mom_or_hattrick') {
      return 'celebration_locker';
    }
    if (tr === 'player_big_game_ace' || tr === 'cup_or_ucl' || sp.includes('경기 직전')) {
      return 'stadium_tunnel';
    }
    return 'manager_office';
  }

  // Team-wide locker room scenes
  if (
    tr === 'big_win' ||
    tr === 'comeback_win' ||
    tr === 'win_streak' ||
    tr === 'clean_sheet_streak' ||
    tr === 'unbeaten_run'
  ) {
    return 'celebration_locker';
  }
  if (
    tr === 'big_match' ||
    tr === 'cup_or_ucl' ||
    tr === 'title_race' ||
    sp.includes('경기 직전') ||
    sp.includes('터널') ||
    template.title.includes('터널')
  ) {
    return 'stadium_tunnel';
  }
  return 'locker_home';
}

/**
 * Extracts a concise, high-immersion last-match & individual player stat card snapshot
 * for press conference / locker room popups.
 */
export function buildManagerEventMatchContext(params: {
  lastMatch?: MatchResult | null;
  lastMatchWasUserHome?: boolean;
  teamName: string;
  opponentName?: string;
  targetPlayer?: Player;
  squad: Player[];
}): ManagerEventMatchContext | null {
  const {
    lastMatch,
    lastMatchWasUserHome = true,
    teamName,
    opponentName,
    targetPlayer,
    squad,
  } = params;
  if (!lastMatch) return null;

  const isHome = lastMatchWasUserHome;
  const userGoals = isHome ? lastMatch.homeGoals : lastMatch.awayGoals;
  const oppGoals = isHome ? lastMatch.awayGoals : lastMatch.homeGoals;
  const userTeamId = isHome ? lastMatch.homeTeamId : lastMatch.awayTeamId;

  let outcome: 'W' | 'D' | 'L' =
    userGoals > oppGoals ? 'W' : userGoals < oppGoals ? 'L' : 'D';
  let note: string | undefined;
  if (lastMatch.extraTime?.penalties) {
    const penWon = lastMatch.extraTime.penalties.winnerTeamId === userTeamId;
    outcome = penWon ? 'W' : 'L';
    const uPen = isHome
      ? lastMatch.extraTime.penalties.homePenGoals
      : lastMatch.extraTime.penalties.awayPenGoals;
    const oPen = isHome
      ? lastMatch.extraTime.penalties.awayPenGoals
      : lastMatch.extraTime.penalties.homePenGoals;
    note = `PK ${uPen}-${oPen}`;
  } else if (lastMatch.extraTime) {
    note = '연장';
  }

  const competitionLabel =
    lastMatch.competitionLabel ??
    (lastMatch.competition === 'cup'
      ? '자국 컵'
      : lastMatch.competition === 'ucl'
        ? `UCL ${lastMatch.round}R`
        : `리그 ${lastMatch.round}R`);

  const allEvents = [
    ...lastMatch.events,
    ...(lastMatch.extraTime?.etEvents ?? []),
  ];

  // Focus player: explicit target player first, otherwise user MOM if user won/starred
  let focusPlayer: Player | undefined = targetPlayer;
  if (!focusPlayer && lastMatch.momPlayerId) {
    focusPlayer = squad.find((p) => p.id === lastMatch.momPlayerId);
  }

  let playerStats: ManagerEventPlayerMatchStat | null = null;
  if (focusPlayer) {
    const pr = lastMatch.playerRatings.find((r) => r.playerId === focusPlayer.id);
    if (pr) {
      let dribbleBeats = 0;
      let savesCount = 0;
      for (const ev of allEvents) {
        if (
          (ev.scorerId === focusPlayer.id || ev.assistId === focusPlayer.id) &&
          ev.dribbleBeatCount &&
          ev.dribbleBeatCount > 0
        ) {
          dribbleBeats += ev.dribbleBeatCount;
        }
        if (
          focusPlayer.position === 'GK' &&
          ev.type === 'save' &&
          ev.teamId !== userTeamId
        ) {
          savesCount += 1;
        }
      }

      const keyMoments: string[] = [];
      const isMom = lastMatch.momPlayerId === focusPlayer.id;
      if (isMom) keyMoments.push('경기 MOM');
      if (pr.goals >= 3) keyMoments.push(`해트트릭 (${pr.goals}골)`);
      else if (pr.goals === 2) keyMoments.push('멀티골');
      if (pr.assists >= 2) keyMoments.push(`멀티 어시스트 (${pr.assists}도움)`);
      if (dribbleBeats >= 2) keyMoments.push(`드리블 돌파 ${dribbleBeats}회`);
      if (focusPlayer.position === 'GK' && oppGoals === 0) {
        keyMoments.push('클린시트');
      }
      if (savesCount >= 2) keyMoments.push(`결정적 선방 ${savesCount}회`);
      if (pr.rating <= 5.9) keyMoments.push('평점 부진');

      playerStats = {
        playerId: focusPlayer.id,
        playerName: focusPlayer.name,
        position: focusPlayer.position,
        subPosition: pr.subPosition,
        ovr: focusPlayer.ovr,
        rating: Math.round(pr.rating * 10) / 10,
        goals: pr.goals,
        assists: pr.assists,
        xg: Math.round(pr.xg * 100) / 100,
        minutesPlayed: pr.minutesPlayed,
        isMom,
        dribbleBeats,
        savesCount,
        keyMoments,
      };
    }
  }

  return {
    competitionLabel,
    userTeamName: teamName,
    opponentName: opponentName || '상대팀',
    userGoals,
    oppGoals,
    outcome,
    note,
    userXg: Math.round((isHome ? lastMatch.homeXg : lastMatch.awayXg) * 100) / 100,
    oppXg: Math.round((isHome ? lastMatch.awayXg : lastMatch.homeXg) * 100) / 100,
    userPossession: Math.round(
      isHome ? lastMatch.homePossession : 100 - lastMatch.homePossession,
    ),
    userShots: isHome ? lastMatch.homeShots : lastMatch.awayShots,
    userShotsOnTarget: isHome
      ? lastMatch.homeShotsOnTarget
      : lastMatch.awayShotsOnTarget,
    momPlayerName: lastMatch.momPlayerName || undefined,
    momRating:
      typeof lastMatch.momRating === 'number'
        ? Math.round(lastMatch.momRating * 10) / 10
        : undefined,
    playerStats,
  };
}

/**
 * Picks a context-aware, non-repeating manager event when cooldown allows.
 * Guarantees no event template repeats within the same season.
 */
export function pickNextManagerEvent(
  input: ManagerEventSelectionInput,
): ActiveManagerEvent | null {
  const {
    eventsState,
    starters,
    bench,
    conditionMap,
    teamName,
    managerName,
    nextOpponentName,
    nextOpponentRank = 8,
    userRank,
    isCupOrUclNext = false,
    lastMatch = null,
    lastMatchOpponentName,
    lastMatchWasUserHome = true,
    lastMatchMomPlayerId = null,
    lastMatchRatings = {},
    recentInjuryJustOccurred = false,
    rng = Math.random,
  } = input;

  const squad = getAllSquadPlayers(starters, bench);
  if (squad.length === 0) return null;

  // Cooldown gate:
  // - Minimum 2 matches between popups
  // - At 2 matches: 30% if strong dramatic context exists
  // - At 3 matches: 65% chance
  // - At 4+ matches: 100% chance
  const since = eventsState.matchesSinceLastEvent;
  if (since < 2) return null;

  const usedSet = new Set(eventsState.usedEventIds);
  const available = ALL_MANAGER_EVENTS.filter((e) => !usedSet.has(e.id));
  if (available.length === 0) return null;

  // Detect active contextual triggers + best matching player for player-scoped triggers
  const triggerCandidates: {
    trigger: ManagerEventTriggerType;
    priority: number;
    player?: Player;
    streakOverride?: number;
  }[] = [];

  // Last match derived signals
  let userGoals = 0;
  let oppGoals = 0;
  let userXg = 0;
  let wasComeback = false;
  if (lastMatch) {
    userGoals = lastMatchWasUserHome ? lastMatch.homeGoals : lastMatch.awayGoals;
    oppGoals = lastMatchWasUserHome ? lastMatch.awayGoals : lastMatch.homeGoals;
    userXg = lastMatchWasUserHome ? lastMatch.homeXg : lastMatch.awayXg;
    const goalEvents = lastMatch.events.filter((e) => e.type === 'goal');
    if (userGoals > oppGoals && goalEvents.length >= 2) {
      const userTeamId = lastMatchWasUserHome
        ? lastMatch.homeTeamId
        : lastMatch.awayTeamId;
      const firstGoalTeamId = goalEvents[0]?.teamId;
      if (firstGoalTeamId && firstGoalTeamId !== userTeamId) {
        wasComeback = true;
      }
    }
  }

  // Individual player triggers
  const activeStarters = starters.filter((p): p is Player => Boolean(p));
  const activeBench = bench.filter((p): p is Player => Boolean(p));

  // 1. Poor rating player (<= 5.9)
  const poorPlayers = squad
    .filter((p) => {
      const r = lastMatchRatings[p.id];
      return typeof r === 'number' && r <= 5.9 && !isPlayerUnavailable(conditionMap[p.id]);
    })
    .sort((a, b) => (lastMatchRatings[a.id] ?? 7) - (lastMatchRatings[b.id] ?? 7));
  if (poorPlayers[0]) {
    triggerCandidates.push({
      trigger: 'player_poor_rating',
      priority: 10,
      player: poorPlayers[0],
    });
  }

  // 2. MOM / Hat-trick star
  if (lastMatchMomPlayerId) {
    const momP = squad.find((p) => p.id === lastMatchMomPlayerId);
    if (momP) {
      triggerCandidates.push({
        trigger: 'player_mom_or_hattrick',
        priority: 9,
        player: momP,
      });
    }
  }

  // 3. Injury cover backup player
  const hasInjuredStarter =
    recentInjuryJustOccurred ||
    squad.some((p) => isPlayerActivelyInjured(conditionMap[p.id]));
  if (hasInjuredStarter && activeBench.length > 0) {
    const healthyBench = activeBench
      .filter((p) => !isPlayerUnavailable(conditionMap[p.id]))
      .sort((a, b) => b.ovr - a.ovr);
    if (healthyBench[0]) {
      triggerCandidates.push({
        trigger: 'player_injury_cover',
        priority: 9,
        player: healthyBench[0],
      });
    }
  }

  // 4. Returning from injury
  const returningPlayer = squad.find((p) => isPlayerRecoveringRust(conditionMap[p.id]));
  if (returningPlayer) {
    triggerCandidates.push({
      trigger: 'player_returning_injury',
      priority: 8,
      player: returningPlayer,
    });
  }

  // 5. Unhappy continuously benched player
  const unhappyBench = activeBench
    .filter((p) => {
      const c = conditionMap[p.id];
      return c && c.consecutiveBenchMatches >= 3 && !isPlayerUnavailable(c);
    })
    .sort((a, b) => b.ovr - a.ovr);
  if (unhappyBench[0]) {
    triggerCandidates.push({
      trigger: 'player_bench_unhappy',
      priority: 8,
      player: unhappyBench[0],
    });
  }

  // 6. Goal drought FW
  const droughtFw = activeStarters
    .filter((p) => {
      const c = conditionMap[p.id];
      return p.position === 'FW' && c && c.recentGoalDrought >= 3;
    })
    .sort((a, b) => (conditionMap[b.id]?.recentGoalDrought ?? 0) - (conditionMap[a.id]?.recentGoalDrought ?? 0));
  if (droughtFw[0]) {
    triggerCandidates.push({
      trigger: 'player_goal_drought',
      priority: 8,
      player: droughtFw[0],
    });
  }

  // Team & position-line triggers
  if (eventsState.recentLossStreak >= 2) {
    triggerCandidates.push({
      trigger: 'lose_streak',
      priority: 9,
      streakOverride: eventsState.recentLossStreak,
    });
  }
  if (lastMatch && userGoals - oppGoals <= -3) {
    triggerCandidates.push({ trigger: 'heavy_loss', priority: 9 });
  }
  if (lastMatch && userGoals - oppGoals >= 3) {
    triggerCandidates.push({ trigger: 'big_win', priority: 8 });
  }
  if (wasComeback) {
    triggerCandidates.push({ trigger: 'comeback_win', priority: 8 });
  }
  if (isCupOrUclNext) {
    triggerCandidates.push({ trigger: 'cup_or_ucl', priority: 8 });
  }
  if (eventsState.recentWinStreak >= 3) {
    triggerCandidates.push({
      trigger: 'win_streak',
      priority: 7,
      streakOverride: eventsState.recentWinStreak,
    });
  }
  if (eventsState.recentCleanSheetStreak >= 2) {
    triggerCandidates.push({
      trigger: 'clean_sheet_streak',
      priority: 7,
      streakOverride: eventsState.recentCleanSheetStreak,
    });
  }
  if (lastMatch && oppGoals >= 3) {
    triggerCandidates.push({ trigger: 'conceded_many', priority: 7 });
  }
  if (lastMatch && userXg >= 1.9 && userGoals <= 1) {
    triggerCandidates.push({ trigger: 'xg_underperform', priority: 8 });
  }
  const ironmanStarters = activeStarters.filter(
    (p) => (conditionMap[p.id]?.consecutiveMatchesPlayed ?? 0) >= 4,
  );
  if (ironmanStarters.length >= 3) {
    triggerCandidates.push({
      trigger: 'fatigue_overload',
      priority: 7,
      player: ironmanStarters[0],
    });
  }
  if (userRank <= 4 && nextOpponentRank <= 4) {
    triggerCandidates.push({ trigger: 'title_race', priority: 8 });
    triggerCandidates.push({ trigger: 'big_match', priority: 7 });
    const ace = [...activeStarters].sort((a, b) => b.ovr - a.ovr)[0];
    if (ace) {
      triggerCandidates.push({
        trigger: 'player_big_game_ace',
        priority: 7,
        player: ace,
      });
    }
  } else if (nextOpponentRank <= 5) {
    triggerCandidates.push({ trigger: 'big_match', priority: 6 });
  }
  if (eventsState.recentUnbeatenStreak >= 5) {
    triggerCandidates.push({
      trigger: 'unbeaten_run',
      priority: 6,
      streakOverride: eventsState.recentUnbeatenStreak,
    });
  }

  // Decide whether to trigger on this match based on cooldown + drama
  const hasHighDrama = triggerCandidates.some((c) => c.priority >= 8);
  const triggerChance =
    since >= 4 ? 1.0 : since === 3 ? 0.68 : hasHighDrama ? 0.36 : 0;
  if (rng() > triggerChance) return null;

  // Pick matching template (prefer contextual triggers, fallback to 'any' / 'transfer_rumor')
  const sortedTriggers = [...triggerCandidates].sort((a, b) => b.priority - a.priority);
  let chosenTemplate: ManagerEventTemplate | null = null;
  let targetPlayer: Player | undefined;
  let streakVal = Math.max(
    eventsState.recentWinStreak,
    eventsState.recentLossStreak,
    eventsState.recentCleanSheetStreak,
    eventsState.recentUnbeatenStreak,
    2,
  );

  for (const tc of sortedTriggers) {
    const matching = available.filter((e) => e.trigger === tc.trigger);
    if (matching.length > 0) {
      chosenTemplate = matching[Math.floor(rng() * matching.length)];
      targetPlayer = tc.player;
      if (tc.streakOverride) streakVal = tc.streakOverride;
      break;
    }
  }

  if (!chosenTemplate) {
    const generalPool = available.filter(
      (e) => e.trigger === 'any' || e.trigger === 'transfer_rumor',
    );
    const pool = generalPool.length > 0 ? generalPool : available;
    chosenTemplate = pool[Math.floor(rng() * pool.length)];
  }

  // Ensure a concrete target player for player-scoped templates
  if (chosenTemplate.targetScope === 'player' && !targetPlayer) {
    const healthySquad = squad.filter((p) => !isPlayerUnavailable(conditionMap[p.id]));
    const pickPool = healthySquad.length > 0 ? healthySquad : squad;
    // Prefer top OVR stars or starters
    const weighted = [...pickPool].sort((a, b) => b.ovr - a.ovr).slice(0, 8);
    targetPlayer = weighted[Math.floor(rng() * weighted.length)] ?? pickPool[0];
  }

  const vars: ManagerEventContextVars = {
    teamName,
    opponentName: nextOpponentName || '다음 상대팀',
    managerName,
    rank: Math.max(1, userRank),
    streak: streakVal,
    playerName: targetPlayer?.name,
    positionGroup: chosenTemplate.positionGroup
      ? POSITION_GROUP_LABELS[chosenTemplate.positionGroup]
      : undefined,
  };

  const interpolatedChoices: ManagerEventChoiceDef[] = chosenTemplate.choices.map((c) => ({
    ...c,
    label: interpolateEventText(c.label, vars),
    quote: interpolateEventText(c.quote, vars),
    successEffect: {
      ...c.successEffect,
      reactionText: interpolateEventText(c.successEffect.reactionText, vars),
    },
    failEffect: c.failEffect
      ? {
          ...c.failEffect,
          reactionText: interpolateEventText(c.failEffect.reactionText, vars),
        }
      : undefined,
  }));

  const sceneId = resolveManagerEventSceneId({
    template: chosenTemplate,
    isCupOrUclNext,
    lastMatch,
  });

  const targetCond = targetPlayer ? conditionMap[targetPlayer.id] : undefined;
  const matchContext = buildManagerEventMatchContext({
    lastMatch,
    lastMatchWasUserHome,
    teamName,
    opponentName: lastMatchOpponentName,
    targetPlayer,
    squad,
  });

  return {
    templateId: chosenTemplate.id,
    category: chosenTemplate.category,
    sceneId,
    targetScope: chosenTemplate.targetScope,
    positionGroup: chosenTemplate.positionGroup,
    targetPlayerId: targetPlayer?.id,
    targetPlayerName: targetPlayer?.name,
    targetPlayerNationality: targetPlayer?.nationality,
    targetPlayerNationalityCode: targetPlayer?.nationalityCode,
    targetPlayerOvr: targetPlayer?.ovr,
    targetPlayerPosition: targetPlayer?.position,
    targetPlayerMainPosition: targetPlayer?.mainPositions[0],
    targetPlayerMorale: targetCond?.morale ?? 0,
    targetPlayerInjured: Boolean(targetCond && isPlayerActivelyInjured(targetCond)),
    title: interpolateEventText(chosenTemplate.title, vars),
    speakerLabel: interpolateEventText(chosenTemplate.speakerLabel, vars),
    contextBadge: getContextBadge(chosenTemplate),
    prompt: interpolateEventText(chosenTemplate.prompt, vars),
    choices: interpolatedChoices,
    matchContext,
  };
}

function moraleNote(delta: number, isRiskSuccess: boolean, wasRisky: boolean): string {
  if (delta >= 3) return wasRisky && isRiskSuccess ? '충격 각성!' : '사기 폭발!';
  if (delta === 2) return wasRisky && isRiskSuccess ? '강력 각성!' : '사기 급상승';
  if (delta === 1) return '사기 상승';
  if (delta === -1) return '압박감 증가';
  if (delta <= -2) return '멘탈 위축';
  return '변동 없음';
}

/**
 * Applies the selected choice of an ActiveManagerEvent to player conditions & team morale,
 * returning updated conditionMap, updated teamMorale, and an intuitive ManagerEventResolution.
 */
export function resolveManagerEventChoice(params: {
  event: ActiveManagerEvent;
  choiceId: string;
  starters: (Player | null)[];
  bench: (Player | null)[];
  conditionMap: PlayerConditionMap;
  currentTeamMorale: number;
  rng?: () => number;
}): {
  nextConditionMap: PlayerConditionMap;
  nextTeamMorale: number;
  resolution: ManagerEventResolution;
} {
  const {
    event,
    choiceId,
    starters,
    bench,
    conditionMap,
    currentTeamMorale,
    rng = Math.random,
  } = params;

  const choice =
    event.choices.find((c) => c.id === choiceId) ?? event.choices[0];
  const wasRisky = typeof choice.successChance === 'number' && Boolean(choice.failEffect);
  const riskSucceeded = !wasRisky || rng() < (choice.successChance ?? 1);
  const effect = riskSucceeded
    ? choice.successEffect
    : (choice.failEffect ?? choice.successEffect);

  const nextMap: PlayerConditionMap = { ...conditionMap };
  const starterPlayers = starters.filter((p): p is Player => Boolean(p));
  const benchPlayers = bench.filter((p): p is Player => Boolean(p));
  const allPlayers = [...starterPlayers, ...benchPlayers];

  const applyDeltaToPlayer = (
    playerId: string,
    delta: number,
    options?: { allowFireIgnition?: boolean; capAt?: number },
  ) => {
    if (delta === 0) return;
    const prev = getPlayerCondition(nextMap, playerId);
    let next = clampMorale(prev.morale + delta);
    if (delta > 0) {
      const allowFire = options?.allowFireIgnition ?? true;
      if (!allowFire && prev.morale < 4 && next >= 4) {
        next = 3;
      }
      if (typeof options?.capAt === 'number' && prev.morale <= options.capAt && next > options.capAt) {
        next = options.capAt;
      }
    }
    nextMap[playerId] = {
      ...prev,
      morale: next,
    };
  };

  const outcomes: ManagerEventOutcomeItem[] = [];
  let nextTeamMorale = currentTeamMorale;

  // 1. Primary target effect (player or position_group)
  if (effect.targetMoraleDelta && effect.targetMoraleDelta !== 0) {
    if (event.targetScope === 'player' && event.targetPlayerId) {
      // Individual target can always ignite solo 🔥 (or freeze ❄️ on fail/backlash)
      applyDeltaToPlayer(event.targetPlayerId, effect.targetMoraleDelta, {
        allowFireIgnition: true,
      });
      outcomes.push({
        label: event.targetPlayerName ?? '대상 선수',
        delta: effect.targetMoraleDelta,
        note: moraleNote(effect.targetMoraleDelta, riskSucceeded, wasRisky),
      });
    } else if (event.targetScope === 'position_group' && event.positionGroup) {
      const canIgniteLine = effect.targetMoraleDelta >= 2;
      for (const p of allPlayers) {
        if (getPositionGroup(p.position) === event.positionGroup) {
          applyDeltaToPlayer(p.id, effect.targetMoraleDelta, {
            allowFireIgnition: canIgniteLine,
            capAt: canIgniteLine ? 4 : undefined,
          });
        }
      }
      outcomes.push({
        label: POSITION_GROUP_LABELS[event.positionGroup],
        delta: effect.targetMoraleDelta,
        note: moraleNote(effect.targetMoraleDelta, riskSucceeded, wasRisky),
      });
    }
  }

  // 2. Whole-team effect
  if (effect.teamMoraleDelta && effect.teamMoraleDelta !== 0) {
    const canIgniteTeam = effect.teamMoraleDelta >= 2;
    for (const p of allPlayers) {
      applyDeltaToPlayer(p.id, effect.teamMoraleDelta, {
        allowFireIgnition: canIgniteTeam,
        capAt: canIgniteTeam ? 4 : undefined,
      });
    }
    nextTeamMorale = clampMorale(nextTeamMorale + effect.teamMoraleDelta);
    outcomes.push({
      label: '팀 전체',
      delta: effect.teamMoraleDelta,
      note: moraleNote(effect.teamMoraleDelta, riskSucceeded, wasRisky),
    });
  }

  // 3. Starter-only / Bench-only effects
  if (effect.starterMoraleDelta && effect.starterMoraleDelta !== 0) {
    const canIgniteStarters = effect.starterMoraleDelta >= 2;
    for (const p of starterPlayers) {
      applyDeltaToPlayer(p.id, effect.starterMoraleDelta, {
        allowFireIgnition: canIgniteStarters,
        capAt: canIgniteStarters ? 4 : undefined,
      });
    }
    outcomes.push({
      label: '선발 11인',
      delta: effect.starterMoraleDelta,
      note: moraleNote(effect.starterMoraleDelta, riskSucceeded, wasRisky),
    });
  }

  if (effect.benchMoraleDelta && effect.benchMoraleDelta !== 0) {
    const canIgniteBench = effect.benchMoraleDelta >= 2;
    for (const p of benchPlayers) {
      applyDeltaToPlayer(p.id, effect.benchMoraleDelta, {
        allowFireIgnition: canIgniteBench,
        capAt: canIgniteBench ? 4 : undefined,
      });
    }
    outcomes.push({
      label: '벤치 멤버',
      delta: effect.benchMoraleDelta,
      note: moraleNote(effect.benchMoraleDelta, riskSucceeded, wasRisky),
    });
  }

  // 4. Secondary position-group bonus
  if (effect.secondaryGroup && effect.secondaryGroupDelta && effect.secondaryGroupDelta !== 0) {
    for (const p of allPlayers) {
      if (getPositionGroup(p.position) === effect.secondaryGroup) {
        applyDeltaToPlayer(p.id, effect.secondaryGroupDelta, {
          allowFireIgnition: effect.secondaryGroupDelta >= 2,
          capAt: 4,
        });
      }
    }
    outcomes.push({
      label: POSITION_GROUP_LABELS[effect.secondaryGroup],
      delta: effect.secondaryGroupDelta,
      note: moraleNote(effect.secondaryGroupDelta, riskSucceeded, wasRisky),
    });
  }

  // 5. Frozen morale relief bonus
  if (effect.frozenReliefBonus && effect.frozenReliefBonus > 0) {
    let relievedCount = 0;
    for (const p of allPlayers) {
      const prev = getPlayerCondition(conditionMap, p.id);
      if (prev.morale <= -3) {
        applyDeltaToPlayer(p.id, effect.frozenReliefBonus, { allowFireIgnition: false });
        relievedCount += 1;
      }
    }
    if (relievedCount > 0) {
      outcomes.push({
        label: `침체 선수 ${relievedCount}명`,
        delta: effect.frozenReliefBonus,
        note: '빙결 집중 회복',
      });
    }
  }

  return {
    nextConditionMap: nextMap,
    nextTeamMorale,
    resolution: {
      eventTitle: event.title,
      category: event.category,
      sceneId: event.sceneId,
      chosenLabel: choice.label,
      chosenQuote: choice.quote,
      wasRisky,
      riskSucceeded,
      reactionText: effect.reactionText,
      outcomes,
    },
  };
}

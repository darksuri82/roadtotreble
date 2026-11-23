import { FORMATIONS } from '../data/formations';
import { pickNextManagerEvent, resolveManagerEventChoice } from '../data/managerEvents';
import type { InjuryAlertItem, PlayerConditionMap } from '../types/condition';
import type { CupStageId, DomesticCupState } from '../types/cup';
import type { IncomingTradeOffer } from '../types/game';
import type {
  Club,
  Fixture,
  LeagueId,
  MatchResult,
  PlayerSeasonStats,
  StandingRow,
} from '../types/league';
import type {
  MpCastMatch,
  MpH2HSpec,
  MpHumanLive,
  MpHumanSeasonState,
  MpLeagueHostState,
  MpLeagueHuman,
  MpLeagueLive,
  MpLeagueSettings,
  MpLeagueStep,
  MpLiteMatch,
  MpSquadInput,
  MpTradeResultNote,
  MpUclLive,
} from '../types/mpLeague';
import type { Player, SubPosition } from '../types/player';
import type { UclKnockoutStage, UclKnockoutTie } from '../types/ucl';
import { computeSeasonAwards } from './awardsEngine';
import { calculateChemistry, calculateTeamRatings } from './chemistryEngine';
import {
  applyConditionToPlayers,
  clampMorale,
  commitAiClubPostMatchConditions,
  createDefaultManagerEventsState,
  isPlayerUnavailable,
  prepareAiClubLineupForMatch,
  updateSquadConditionsAfterMatch,
} from './conditionEngine';
import {
  advanceCupStage,
  checkCupStageTrigger,
  createDomesticCupState,
  cupNodeToFixture,
} from './cupEngine';
import { buildAiClubRoster, buildAiClubSquad16, getLeagueById } from './dataLoader';
import type { UserMatchContext } from './matchEngine';
import { simulateExtraTimeAndPenalties, simulateMatch } from './matchEngine';
import { finalizeMpLeagueSeason } from './mpLeagueScore';
import {
  advanceOtherLeaguesToProgress,
  createOtherLeaguesState,
} from './otherLeaguesEngine';
import { generateDoubleRoundRobin } from './scheduleEngine';
import {
  applyRoundResults,
  createInitialPlayerStatsMap,
  createInitialStandings,
} from './standingsEngine';
import {
  analyzeClubPositionNeeds,
  ATTEMPTS_PER_WINDOW,
  checkTransferWindowTrigger,
  evaluateTradePackage,
  generateIncomingTradeOffers,
} from './transferEngine';
import {
  advanceUclKnockoutLeg,
  createUclTournamentState,
  simulateUclLeaguePhaseRound,
  simulateUclToCompletion,
  UCL_KNOCKOUT_ORDER,
  UCL_STAGE_LABELS,
} from './uclEngine';

/** Never matches a real club: disables the single-user branches inside shared engines. */
export const MP_NO_USER_ID = 'mp-league-no-user';
const MAX_OFFERS_PER_HUMAN = 3;
const CUP_STAGE_ORDER: CupStageId[] = ['r16', 'qf', 'sf', 'final'];

export interface MpLeagueEnv {
  squads: Record<string, MpSquadInput>;
  rng?: () => number;
}

export function mpHumanClubId(index: number): string {
  return `mpl-club-${index + 1}`;
}

function squadPlayers(squad: MpSquadInput | undefined): Player[] {
  if (!squad) return [];
  return [...squad.starters, ...squad.bench];
}

function allHumanPlayerIds(
  squads: Record<string, MpSquadInput>,
  exceptClubId?: string,
): string[] {
  const ids: string[] = [];
  for (const [clubId, squad] of Object.entries(squads)) {
    if (clubId === exceptClubId) continue;
    for (const p of squadPlayers(squad)) ids.push(p.id);
  }
  return ids;
}

function buildExcludeIds(
  state: MpLeagueHostState,
  squads: Record<string, MpSquadInput>,
): Set<string> {
  return new Set<string>([...allHumanPlayerIds(squads), ...state.departedIds]);
}

/** Swaps an unavailable (injured-out) starter with the best fit bench player for this match only. */
export function resolveAvailableLineup(
  squad: MpSquadInput,
  conditions: PlayerConditionMap,
): { starters: Player[]; bench: Player[] } {
  const starters = [...squad.starters];
  const bench = [...squad.bench];
  for (let i = 0; i < starters.length; i += 1) {
    const starter = starters[i];
    if (!starter || !isPlayerUnavailable(conditions[starter.id])) continue;
    let bestIdx = -1;
    let bestScore = -1;
    bench.forEach((b, bIdx) => {
      if (!b || isPlayerUnavailable(conditions[b.id])) return;
      const samePos = b.position === starter.position;
      if (starter.position === 'GK' && !samePos) return;
      if (starter.position !== 'GK' && b.position === 'GK') return;
      const score = b.ovr + (samePos ? 100 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = bIdx;
      }
    });
    if (bestIdx !== -1) {
      const replacement = bench[bestIdx];
      bench[bestIdx] = starter;
      starters[i] = replacement;
    }
  }
  return { starters, bench };
}

export interface MpHumanMatchSetup {
  club: Club;
  ctx: UserMatchContext;
  rawStarters: Player[];
  rawBench: Player[];
}

/** Builds a human club's live Club entry + match context from its current squad, conditions & morale. */
export function buildHumanMatchSetup(params: {
  human: MpLeagueHuman;
  squad: MpSquadInput;
  conditions: PlayerConditionMap;
  teamMorale: number;
  competition: 'league' | 'cup' | 'ucl';
  opponentRank?: number;
  allowAutoSubs?: boolean;
}): MpHumanMatchSetup {
  const { human, squad, conditions, teamMorale, competition, opponentRank } = params;
  const lineup = resolveAvailableLineup(squad, conditions);
  const effStarters = applyConditionToPlayers(lineup.starters, conditions, teamMorale);
  const effBench = applyConditionToPlayers(lineup.bench, conditions, teamMorale);
  const chem = calculateChemistry(
    squad.formation,
    effStarters,
    squad.tactic,
    human.managerTraitId,
  );
  const ratings = calculateTeamRatings(
    squad.formation,
    effStarters,
    chem.total,
    human.managerTraitId,
    chem.slotSynergies,
  );
  const top3 = [...effStarters]
    .sort((a, b) => b.att - a.att)
    .slice(0, 3)
    .map((p) => p.name);
  const club: Club = {
    id: human.clubId,
    name: human.profile.name || human.nickname,
    shortName: human.profile.shortName || 'FC',
    primaryColor: human.profile.primaryColor || '#10b981',
    secondaryColor: human.profile.secondaryColor || '#f8fafc',
    pattern: human.profile.pattern || 'solid',
    formation: squad.formation,
    defaultTactic: squad.tactic,
    att: ratings.att,
    mid: ratings.mid,
    def: ratings.def,
    topScorers: [top3[0] ?? '공격수 1', top3[1] ?? '공격수 2', top3[2] ?? '미드필더 1'],
    isUser: false,
  };
  return {
    club,
    rawStarters: lineup.starters,
    rawBench: lineup.bench,
    ctx: {
      userClubId: human.clubId,
      starters: effStarters,
      bench: effBench,
      formation: squad.formation,
      tactic: squad.tactic,
      chemistry: chem.total,
      ratings,
      slotSynergies: chem.slotSynergies,
      managerTraitId: human.managerTraitId,
      competition,
      opponentRank,
      allowAutoSubs: params.allowAutoSubs ?? true,
    },
  };
}

export function toLiteMatch(
  result: MatchResult,
  competition: 'league' | 'cup' | 'ucl',
  label: string,
  isH2H = false,
): MpLiteMatch {
  return {
    competition,
    label,
    homeTeamId: result.homeTeamId,
    awayTeamId: result.awayTeamId,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    etWinnerId: result.extraTime?.winnerTeamId ?? null,
    penalties: Boolean(result.extraTime?.penalties),
    isH2H,
  };
}

function outcomeOf(result: MatchResult, clubId: string): 'W' | 'D' | 'L' {
  const isHome = result.homeTeamId === clubId;
  const gf = isHome ? result.homeGoals : result.awayGoals;
  const ga = isHome ? result.awayGoals : result.homeGoals;
  if (result.extraTime) return result.extraTime.winnerTeamId === clubId ? 'W' : 'L';
  if (gf > ga) return 'W';
  if (gf < ga) return 'L';
  return 'D';
}

function emptyHumanSeason(): MpHumanSeasonState {
  return {
    events: createDefaultManagerEventsState(),
    alerts: [],
    history: [],
    uclHistory: [],
    h2h: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 },
    offers: [],
    attemptsLeft: 0,
    tradeNote: null,
    lastMatch: null,
  };
}

function buildEventRounds(
  totalRounds: number,
  transferWindows: [number, number, number],
): number[] {
  const blocked = new Set<number>(transferWindows);
  const rounds: number[] = [];
  for (let r = 4; r < totalRounds; r += 5) {
    let pick = r;
    while (blocked.has(pick) && pick < totalRounds - 1) pick += 1;
    if (!blocked.has(pick)) rounds.push(pick);
  }
  return rounds;
}

/**
 * Creates the shared season for 2~4 human clubs: they replace the N weakest clubs of the chosen league,
 * and every drafted player is removed from all AI rosters (worldwide unique players).
 */
export function createMpLeagueSeason(params: {
  roomId: string;
  seasonKey: string;
  settings: MpLeagueSettings;
  draftLeaguePool: LeagueId[];
  humans: MpLeagueHuman[];
  squads: Record<string, MpSquadInput>;
  rng?: () => number;
}): MpLeagueHostState {
  const { roomId, seasonKey, settings, draftLeaguePool, humans, squads } = params;
  const rng = params.rng ?? Math.random;
  const league = getLeagueById(settings.leagueId);
  const conditions: PlayerConditionMap = {};

  const weakest = [...league.clubs]
    .sort((a, b) => a.att + a.mid + a.def - (b.att + b.mid + b.def))
    .slice(0, humans.length);
  const replaceIds = weakest.map((c) => c.id);

  const humanClubs = humans.map(
    (h) =>
      buildHumanMatchSetup({
        human: h,
        squad: squads[h.clubId],
        conditions,
        teamMorale: 0,
        competition: 'league',
      }).club,
  );

  let humanCursor = 0;
  const clubs: Club[] = league.clubs.map((c) => {
    if (!replaceIds.includes(c.id)) return c;
    const next = humanClubs[humanCursor];
    humanCursor += 1;
    return next ?? c;
  });

  const draftedIds = new Set<string>(allHumanPlayerIds(squads));
  const humanIdSet = new Set(humans.map((h) => h.clubId));
  const aiRosters: Record<string, Player[]> = {};
  for (const c of clubs) {
    if (humanIdSet.has(c.id)) continue;
    aiRosters[c.id] = buildAiClubRoster(c, league.id, draftedIds);
  }

  const statRosters: Record<string, Player[]> = { ...aiRosters };
  for (const h of humans) statRosters[h.clubId] = squadPlayers(squads[h.clubId]);

  const fixtures = generateDoubleRoundRobin(clubs, rng);
  const standings = createInitialStandings(clubs);
  const statSeed = {
    clubs,
    userClub: humanClubs[0],
    userSquad: [] as Player[],
    aiRosters: statRosters,
  };

  let cup = createDomesticCupState(
    league.id,
    clubs,
    league.totalRounds,
    rng,
    humans[0].clubId,
  );
  cup = ensureHumansInCup(cup, humans, rng);

  const perHuman: Record<string, MpHumanSeasonState> = {};
  for (const h of humans) perHuman[h.clubId] = emptyHumanSeason();

  return {
    version: 1,
    roomId,
    seasonKey,
    settings,
    draftLeaguePool,
    stage: 'league',
    flow: { kind: 'auto' },
    todo: [{ t: 'league_round' }],
    humans,
    replacedClubNames: weakest.map((c) => c.name),
    clubs,
    aiRosters,
    fixtures,
    round: 0,
    totalRounds: league.totalRounds,
    transferWindows: league.transferWindows,
    completedWindows: [],
    transferWindowIndex: null,
    eventRounds: buildEventRounds(league.totalRounds, league.transferWindows),
    standings,
    allPlayerStats: createInitialPlayerStatsMap(statSeed),
    cup,
    cupPlayerStats: createInitialPlayerStatsMap(statSeed),
    otherLeagues: createOtherLeaguesState(league.id, draftedIds, rng),
    conditions,
    departedIds: [],
    perHuman,
    h2hQueue: [],
    h2hResults: {},
    h2hLive: null,
    lastRound: null,
    cupNews: [],
    ucl: null,
    uclPlayerStats: {},
    uclHumanClubIds: [],
    uclLastScores: [],
    uclConsentedStage: null,
    cast: null,
    awards: null,
    globalAwards: null,
    final: null,
    squads,
    rev: 1,
  };
}

/** createDomesticCupState only guarantees one human club: swap the others in for random AI entrants. */
function ensureHumansInCup(
  cup: DomesticCupState,
  humans: MpLeagueHuman[],
  rng: () => number,
): DomesticCupState {
  const humanIds = new Set(humans.map((h) => h.clubId));
  const missing = humans
    .map((h) => h.clubId)
    .filter((id) => !cup.participantIds.includes(id));
  if (missing.length === 0) return cup;

  const replaceable = cup.participantIds.filter((id) => !humanIds.has(id));
  const swaps = new Map<string, string>();
  for (const humanId of missing) {
    if (replaceable.length === 0) break;
    const idx = Math.floor(rng() * replaceable.length);
    const [outId] = replaceable.splice(idx, 1);
    swaps.set(outId, humanId);
  }
  const swapId = (id: string) => swaps.get(id) ?? id;
  return {
    ...cup,
    participantIds: cup.participantIds.map(swapId),
    rounds: {
      ...cup.rounds,
      r16: cup.rounds.r16.map((n) => ({
        ...n,
        homeTeamId: swapId(n.homeTeamId),
        awayTeamId: swapId(n.awayTeamId),
      })),
    },
  };
}

function humanById(state: MpLeagueHostState, clubId: string): MpLeagueHuman | undefined {
  return state.humans.find((h) => h.clubId === clubId);
}

function isHumanClub(state: MpLeagueHostState, clubId: string): boolean {
  return state.humans.some((h) => h.clubId === clubId);
}

function rankOf(standings: StandingRow[], clubId: string): number | undefined {
  const idx = standings.findIndex((r) => r.teamId === clubId);
  return idx === -1 ? undefined : idx + 1;
}

/** Ports the single-player post-match condition update for one human club (injuries, morale, streaks). */
function applyPostHumanMatch(params: {
  state: MpLeagueHostState;
  conditions: PlayerConditionMap;
  human: MpLeagueHuman;
  setup: MpHumanMatchSetup;
  squad: MpSquadInput;
  result: MatchResult;
  competition: 'league' | 'cup' | 'ucl';
  round: number;
  isBigMatch: boolean;
  label: string;
  isH2H: boolean;
  rng: () => number;
}): MpHumanSeasonState {
  const { state, conditions, human, setup, squad, result, competition, round, rng } = params;
  const prev = state.perHuman[human.clubId] ?? emptyHumanSeason();
  const clubId = human.clubId;
  const isHome = result.homeTeamId === clubId;
  const gf = isHome ? result.homeGoals : result.awayGoals;
  const ga = isHome ? result.awayGoals : result.homeGoals;
  const outcome = outcomeOf(result, clubId);
  const totalMins = result.extraTime ? 120 : 90;

  const formCfg = FORMATIONS[squad.formation] ?? FORMATIONS['4-3-3'];
  const starterIds = new Set<string>();
  const starterSlotIndexByPlayerId: Record<string, number> = {};
  const subPositionByPlayerId: Record<string, SubPosition> = {};
  const minutesByPlayerId: Record<string, number> = {};
  setup.rawStarters.forEach((p, idx) => {
    starterIds.add(p.id);
    starterSlotIndexByPlayerId[p.id] = idx;
    const slotSub = formCfg.slots[idx]?.subPosition;
    if (slotSub) subPositionByPlayerId[p.id] = slotSub;
    minutesByPlayerId[p.id] = totalMins;
  });
  for (const p of setup.rawBench) minutesByPlayerId[p.id] = 0;

  const goalScorerIds = new Set<string>();
  const assisterIds = new Set<string>();
  const goalsByPlayerId: Record<string, number> = {};
  const assistsByPlayerId: Record<string, number> = {};
  const ratingsByPlayerId: Record<string, number> = {};
  for (const pr of result.playerRatings) {
    if (pr.teamId !== clubId) continue;
    ratingsByPlayerId[pr.playerId] = pr.rating;
    if (typeof pr.minutesPlayed === 'number' && pr.minutesPlayed > 0) {
      minutesByPlayerId[pr.playerId] = pr.minutesPlayed;
    }
    if (pr.goals > 0) {
      goalScorerIds.add(pr.playerId);
      goalsByPlayerId[pr.playerId] = pr.goals;
    }
    if (pr.assists > 0) {
      assisterIds.add(pr.playerId);
      assistsByPlayerId[pr.playerId] = pr.assists;
    }
  }

  const nextWinStreak = outcome === 'W' ? prev.events.recentWinStreak + 1 : 0;
  const nextLossStreak = outcome === 'L' ? prev.events.recentLossStreak + 1 : 0;

  const update = updateSquadConditionsAfterMatch({
    squad: [...setup.rawStarters, ...setup.rawBench],
    starterIds,
    minutesByPlayerId,
    subPositionByPlayerId,
    tactic: squad.tactic,
    conditionMap: conditions,
    competition,
    round,
    isShortRest: competition !== 'league',
    outcome,
    goalDiff: gf - ga,
    isBigMatch: params.isBigMatch,
    momPlayerId: result.momPlayerId ?? null,
    goalScorerIds,
    assisterIds,
    goalsByPlayerId,
    assistsByPlayerId,
    cleanSheet: ga === 0,
    ratingsByPlayerId,
    teamWinStreak: nextWinStreak,
    teamLossStreak: nextLossStreak,
    trackUserAlerts: true,
    starterSlotIndexByPlayerId,
    rng,
  });
  Object.assign(conditions, update.conditionMap);

  let baseMorale = prev.events.teamMorale;
  if (baseMorale >= 4 && update.teamMoraleDelta <= 0) baseMorale = 3;
  else if (baseMorale >= 2 && outcome !== 'W' && update.teamMoraleDelta <= 0) {
    baseMorale -= 1;
  } else if (baseMorale <= -4 && outcome === 'W' && update.teamMoraleDelta >= 0) {
    baseMorale += 1;
  }

  const lite = toLiteMatch(result, competition, params.label, params.isH2H);
  return {
    ...prev,
    events: {
      ...prev.events,
      matchesSinceLastEvent: prev.events.matchesSinceLastEvent + 1,
      teamMorale: clampMorale(baseMorale + update.teamMoraleDelta),
      recentWinStreak: nextWinStreak,
      recentLossStreak: nextLossStreak,
      recentCleanSheetStreak: ga === 0 ? prev.events.recentCleanSheetStreak + 1 : 0,
      recentUnbeatenStreak: outcome !== 'L' ? prev.events.recentUnbeatenStreak + 1 : 0,
    },
    alerts:
      update.newInjuries.length > 0
        ? [...prev.alerts, ...update.newInjuries]
        : prev.alerts,
    history: [...prev.history, lite],
    uclHistory: competition === 'ucl' ? [...prev.uclHistory, lite] : prev.uclHistory,
    lastMatch: result,
  };
}

function commitAiSide(params: {
  club: Club;
  prep: ReturnType<typeof prepareAiClubLineupForMatch>;
  conditions: PlayerConditionMap;
  competition: 'league' | 'cup' | 'ucl';
  round: number;
  result: MatchResult;
  isHome: boolean;
  rng: () => number;
}): void {
  const { club, prep, conditions, competition, round, result, isHome, rng } = params;
  const gf = isHome ? result.homeGoals : result.awayGoals;
  const ga = isHome ? result.awayGoals : result.homeGoals;
  commitAiClubPostMatchConditions({
    club,
    rawStarters: prep.rawStarters,
    fullClubSquad: prep.fullClubSquad,
    conditionMap: conditions,
    competition,
    round,
    isShortRest: competition !== 'league',
    isExtraTime: Boolean(result.extraTime),
    outcome: gf > ga ? 'W' : gf < ga ? 'L' : 'D',
    goalDiff: gf - ga,
    cleanSheet: ga === 0,
    rng,
  });
}

interface HumanVsAiOutcome {
  result: MatchResult;
  setup: MpHumanMatchSetup;
  human: MpLeagueHuman;
}

/** Instantly resolves one human-vs-AI match with the human's live tactics (and ET/PK when it is a decider). */
function simulateHumanVsAi(params: {
  state: MpLeagueHostState;
  env: MpLeagueEnv;
  conditions: PlayerConditionMap;
  fixture: Fixture;
  aiClub: Club;
  aiBaseRoster: Player[];
  human: MpLeagueHuman;
  competition: 'league' | 'cup' | 'ucl';
  opponentRank?: number;
  excludeIds: Set<string>;
  decider?: { aggHomeBefore?: number; aggAwayBefore?: number } | null;
}): HumanVsAiOutcome {
  const { state, env, conditions, fixture, aiClub, human, competition } = params;
  const rng = env.rng ?? Math.random;
  const squad = env.squads[human.clubId];
  const setup = buildHumanMatchSetup({
    human,
    squad,
    conditions,
    teamMorale: state.perHuman[human.clubId]?.events.teamMorale ?? 0,
    competition,
    opponentRank: params.opponentRank,
  });
  const prep = prepareAiClubLineupForMatch({
    club: aiClub,
    baseRoster: params.aiBaseRoster,
    conditionMap: conditions,
    excludeIds: params.excludeIds,
  });
  const humanIsHome = fixture.homeTeamId === human.clubId;
  const homeClub = humanIsHome ? setup.club : aiClub;
  const awayClub = humanIsHome ? aiClub : setup.club;
  const homeRoster = humanIsHome ? setup.ctx.starters : prep.effectiveStarters;
  const awayRoster = humanIsHome ? prep.effectiveStarters : setup.ctx.starters;

  let result = simulateMatch(
    fixture,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    setup.ctx,
    rng,
  );
  if (params.decider) {
    const aggH = (params.decider.aggHomeBefore ?? 0) + result.homeGoals;
    const aggA = (params.decider.aggAwayBefore ?? 0) + result.awayGoals;
    if (aggH === aggA) {
      result = simulateExtraTimeAndPenalties({
        baseResult: result,
        homeClub,
        awayClub,
        homeRoster,
        awayRoster,
        userContext: setup.ctx,
        aggHomeBeforeMatch: params.decider.aggHomeBefore,
        aggAwayBeforeMatch: params.decider.aggAwayBefore,
        rng,
      });
    }
  }
  commitAiSide({
    club: aiClub,
    prep,
    conditions,
    competition,
    round: fixture.round,
    result,
    isHome: !humanIsHome,
    rng,
  });
  return { result, setup, human };
}

function buildH2HSetups(
  state: MpLeagueHostState,
  env: MpLeagueEnv,
  conditions: PlayerConditionMap,
  result: MatchResult,
  competition: 'league' | 'cup' | 'ucl',
): { human: MpLeagueHuman; setup: MpHumanMatchSetup }[] {
  const out: { human: MpLeagueHuman; setup: MpHumanMatchSetup }[] = [];
  for (const clubId of [result.homeTeamId, result.awayTeamId]) {
    const human = humanById(state, clubId);
    const squad = env.squads[clubId];
    if (!human || !squad) continue;
    out.push({
      human,
      setup: buildHumanMatchSetup({
        human,
        squad,
        conditions,
        teamMorale: state.perHuman[clubId]?.events.teamMorale ?? 0,
        competition,
      }),
    });
  }
  return out;
}

function openH2H(state: MpLeagueHostState, specs: MpH2HSpec[]): MpLeagueHostState {
  return {
    ...state,
    flow: { kind: 'h2h' },
    h2hQueue: specs,
    h2hLive: { spec: specs[0], match: null, openedAt: new Date().toISOString() },
  };
}

function refreshHumanClubs(
  state: MpLeagueHostState,
  env: MpLeagueEnv,
  conditions: PlayerConditionMap,
): Club[] {
  return state.clubs.map((c) => {
    const human = humanById(state, c.id);
    const squad = env.squads[c.id];
    if (!human || !squad) return c;
    return buildHumanMatchSetup({
      human,
      squad,
      conditions,
      teamMorale: state.perHuman[c.id]?.events.teamMorale ?? 0,
      competition: 'league',
    }).club;
  });
}

// ── Step: one league round ───────────────────────────────────────────────────

function stepLeagueRound(state: MpLeagueHostState, env: MpLeagueEnv): MpLeagueHostState {
  const rng = env.rng ?? Math.random;
  const nextRound = state.round + 1;
  if (nextRound > state.totalRounds) {
    return { ...state, todo: [{ t: 'finish_league' }] };
  }

  const roundFixtures = state.fixtures.filter(
    (f) => f.round === nextRound && !f.played,
  );
  const missingH2H = roundFixtures.filter(
    (f) =>
      isHumanClub(state, f.homeTeamId) &&
      isHumanClub(state, f.awayTeamId) &&
      !state.h2hResults[f.id],
  );
  if (missingH2H.length > 0) {
    return openH2H(
      state,
      missingH2H.map((f) => ({
        key: f.id,
        ctx: 'league',
        label: `리그 ${nextRound}R 맞대결`,
        homeClubId: f.homeTeamId,
        awayClubId: f.awayTeamId,
        round: nextRound,
        knockout: false,
        speed: 4,
      })),
    );
  }

  const conditions: PlayerConditionMap = { ...state.conditions };
  const clubs = refreshHumanClubs(state, env, conditions);
  const clubsById: Record<string, Club> = Object.fromEntries(clubs.map((c) => [c.id, c]));
  const excludeIds = buildExcludeIds(state, env.squads);

  const results: MatchResult[] = [];
  const humanOutcomes: {
    human: MpLeagueHuman;
    setup: MpHumanMatchSetup;
    result: MatchResult;
    isH2H: boolean;
  }[] = [];
  const usedKeys: string[] = [];

  for (const fixture of roundFixtures) {
    const homeHuman = humanById(state, fixture.homeTeamId);
    const awayHuman = humanById(state, fixture.awayTeamId);

    if (homeHuman && awayHuman) {
      const pre = state.h2hResults[fixture.id];
      usedKeys.push(fixture.id);
      const tagged: MatchResult = {
        ...pre,
        fixtureId: fixture.id,
        round: nextRound,
        competition: 'league',
        competitionLabel: `리그 ${nextRound}R`,
      };
      results.push(tagged);
      for (const side of buildH2HSetups(state, env, conditions, tagged, 'league')) {
        humanOutcomes.push({ ...side, result: tagged, isH2H: true });
      }
      continue;
    }

    if (homeHuman || awayHuman) {
      const human = (homeHuman ?? awayHuman) as MpLeagueHuman;
      const aiId = homeHuman ? fixture.awayTeamId : fixture.homeTeamId;
      const sim = simulateHumanVsAi({
        state,
        env,
        conditions,
        fixture,
        aiClub: clubsById[aiId],
        aiBaseRoster: state.aiRosters[aiId] ?? [],
        human,
        competition: 'league',
        opponentRank: rankOf(state.standings, aiId),
        excludeIds,
      });
      results.push(sim.result);
      humanOutcomes.push({ ...sim, isH2H: false });
      continue;
    }

    const homeClub = clubsById[fixture.homeTeamId];
    const awayClub = clubsById[fixture.awayTeamId];
    const homePrep = prepareAiClubLineupForMatch({
      club: homeClub,
      baseRoster: state.aiRosters[fixture.homeTeamId] ?? [],
      conditionMap: conditions,
      excludeIds,
    });
    const awayPrep = prepareAiClubLineupForMatch({
      club: awayClub,
      baseRoster: state.aiRosters[fixture.awayTeamId] ?? [],
      conditionMap: conditions,
      excludeIds,
    });
    const result = simulateMatch(
      fixture,
      homeClub,
      awayClub,
      homePrep.effectiveStarters,
      awayPrep.effectiveStarters,
      undefined,
      rng,
    );
    commitAiSide({
      club: homeClub,
      prep: homePrep,
      conditions,
      competition: 'league',
      round: nextRound,
      result,
      isHome: true,
      rng,
    });
    commitAiSide({
      club: awayClub,
      prep: awayPrep,
      conditions,
      competition: 'league',
      round: nextRound,
      result,
      isHome: false,
      rng,
    });
    results.push(result);
  }

  const applied = applyRoundResults(
    state.standings,
    results,
    clubsById,
    state.allPlayerStats,
    MP_NO_USER_ID,
  );

  const perHuman = { ...state.perHuman };
  let working: MpLeagueHostState = { ...state, perHuman };
  for (const o of humanOutcomes) {
    const oppId =
      o.result.homeTeamId === o.human.clubId ? o.result.awayTeamId : o.result.homeTeamId;
    const oppRank = rankOf(state.standings, oppId);
    perHuman[o.human.clubId] = applyPostHumanMatch({
      state: working,
      conditions,
      human: o.human,
      setup: o.setup,
      squad: env.squads[o.human.clubId],
      result: o.result,
      competition: 'league',
      round: nextRound,
      isBigMatch: o.isH2H || (oppRank !== undefined && oppRank <= 4),
      label: `리그 ${nextRound}R`,
      isH2H: o.isH2H,
      rng,
    });
    working = { ...working, perHuman };
  }

  const playedIds = new Set(roundFixtures.map((f) => f.id));
  const nextH2HResults = { ...state.h2hResults };
  for (const k of usedKeys) delete nextH2HResults[k];

  const followUps: MpLeagueStep[] = [{ t: 'cup_stage' }];
  if (state.eventRounds.includes(nextRound)) followUps.push({ t: 'events' });
  followUps.push({ t: 'transfer' });
  followUps.push(
    nextRound >= state.totalRounds ? { t: 'finish_league' } : { t: 'league_round' },
  );

  return {
    ...working,
    clubs,
    conditions,
    fixtures: state.fixtures.map((f) =>
      playedIds.has(f.id) ? { ...f, played: true, result: undefined } : f,
    ),
    round: nextRound,
    standings: applied.standings,
    allPlayerStats: applied.allPlayerStats,
    otherLeagues: advanceOtherLeaguesToProgress(
      state.otherLeagues,
      nextRound,
      state.totalRounds,
      rng,
      excludeIds,
      conditions,
    ),
    h2hResults: nextH2HResults,
    lastRound: {
      round: nextRound,
      scores: results.map((r) =>
        toLiteMatch(
          r,
          'league',
          `리그 ${nextRound}R`,
          isHumanClub(state, r.homeTeamId) && isHumanClub(state, r.awayTeamId),
        ),
      ),
    },
    cupNews: [],
    todo: followUps,
  };
}

// ── Step: domestic cup stage ─────────────────────────────────────────────────

const CUP_STAGE_LABEL: Record<CupStageId, string> = {
  r16: '16강',
  qf: '8강',
  sf: '4강',
  final: '결승',
};

function stepCupStage(state: MpLeagueHostState, env: MpLeagueEnv): MpLeagueHostState {
  const rng = env.rng ?? Math.random;
  const cup = state.cup;
  const stage = cup ? checkCupStageTrigger(cup, state.round) : null;
  if (!cup || !stage) return { ...state, todo: state.todo.slice(1) };

  const stageNum = CUP_STAGE_ORDER.indexOf(stage) + 1;
  const label = `${cup.meta.koreanName} ${CUP_STAGE_LABEL[stage]}`;
  const nodes = cup.rounds[stage].filter((n) => !n.played);

  const missingH2H = nodes.filter(
    (n) =>
      isHumanClub(state, n.homeTeamId) &&
      isHumanClub(state, n.awayTeamId) &&
      !state.h2hResults[n.id],
  );
  if (missingH2H.length > 0) {
    return openH2H(
      state,
      missingH2H.map((n) => ({
        key: n.id,
        ctx: 'cup',
        label: `${label} 맞대결`,
        homeClubId: n.homeTeamId,
        awayClubId: n.awayTeamId,
        round: stageNum,
        knockout: true,
        speed: 4,
      })),
    );
  }

  const conditions: PlayerConditionMap = { ...state.conditions };
  const clubs = refreshHumanClubs(state, env, conditions);
  const clubsById: Record<string, Club> = Object.fromEntries(clubs.map((c) => [c.id, c]));
  const excludeIds = buildExcludeIds(state, env.squads);

  const precomputed: Record<string, MatchResult> = {};
  const humanOutcomes: {
    human: MpLeagueHuman;
    setup: MpHumanMatchSetup;
    result: MatchResult;
    isH2H: boolean;
  }[] = [];
  const usedKeys: string[] = [];

  for (const node of nodes) {
    const homeHuman = humanById(state, node.homeTeamId);
    const awayHuman = humanById(state, node.awayTeamId);
    if (homeHuman && awayHuman) {
      const pre: MatchResult = {
        ...state.h2hResults[node.id],
        fixtureId: node.id,
        round: stageNum,
      };
      precomputed[node.id] = pre;
      usedKeys.push(node.id);
      for (const side of buildH2HSetups(state, env, conditions, pre, 'cup')) {
        humanOutcomes.push({ ...side, result: pre, isH2H: true });
      }
    } else if (homeHuman || awayHuman) {
      const human = (homeHuman ?? awayHuman) as MpLeagueHuman;
      const aiId = homeHuman ? node.awayTeamId : node.homeTeamId;
      const sim = simulateHumanVsAi({
        state,
        env,
        conditions,
        fixture: cupNodeToFixture(node, stageNum),
        aiClub: clubsById[aiId],
        aiBaseRoster: state.aiRosters[aiId] ?? [],
        human,
        competition: 'cup',
        opponentRank: rankOf(state.standings, aiId),
        excludeIds,
        decider: {},
      });
      precomputed[node.id] = sim.result;
      humanOutcomes.push({ ...sim, isH2H: false });
    }
  }

  const res = advanceCupStage({
    cup,
    stage,
    clubsById,
    aiRosters: state.aiRosters,
    cupPlayerStats: state.cupPlayerStats,
    precomputedResults: precomputed,
    userClubId: MP_NO_USER_ID,
    conditionMap: conditions,
    excludeIds,
    rng,
  });

  const perHuman = { ...state.perHuman };
  let working: MpLeagueHostState = { ...state, perHuman };
  for (const o of humanOutcomes) {
    perHuman[o.human.clubId] = applyPostHumanMatch({
      state: working,
      conditions,
      human: o.human,
      setup: o.setup,
      squad: env.squads[o.human.clubId],
      result: o.result,
      competition: 'cup',
      round: state.round,
      isBigMatch: true,
      label,
      isH2H: o.isH2H,
      rng,
    });
    working = { ...working, perHuman };
  }

  const nextH2HResults = { ...state.h2hResults };
  for (const k of usedKeys) delete nextH2HResults[k];

  const news = res.stageResults
    .filter(
      (r) =>
        stage === 'final' ||
        isHumanClub(state, r.homeTeamId) ||
        isHumanClub(state, r.awayTeamId),
    )
    .map((r) =>
      toLiteMatch(
        r,
        'cup',
        label,
        isHumanClub(state, r.homeTeamId) && isHumanClub(state, r.awayTeamId),
      ),
    );

  return {
    ...working,
    conditions,
    cup: res.cup,
    cupPlayerStats: res.cupPlayerStats,
    h2hResults: nextH2HResults,
    cupNews: news,
    todo: state.todo.slice(1),
  };
}

// ── Step: synchronised press conference / locker room round ──────────────────

function stepEvents(state: MpLeagueHostState, env: MpLeagueEnv): MpLeagueHostState {
  const rng = env.rng ?? Math.random;
  const perHuman = { ...state.perHuman };
  let anyActive = false;

  for (const human of state.humans) {
    const squad = env.squads[human.clubId];
    const hs = perHuman[human.clubId];
    if (!squad || !hs) continue;
    if (hs.events.activeEvent) {
      anyActive = true;
      continue;
    }
    const nextFixture = state.fixtures.find(
      (f) =>
        f.round === state.round + 1 &&
        (f.homeTeamId === human.clubId || f.awayTeamId === human.clubId),
    );
    const nextOppId = nextFixture
      ? nextFixture.homeTeamId === human.clubId
        ? nextFixture.awayTeamId
        : nextFixture.homeTeamId
      : null;
    const nextOpp = state.clubs.find((c) => c.id === nextOppId);
    const last = hs.lastMatch;
    const lastOppId = last
      ? last.homeTeamId === human.clubId
        ? last.awayTeamId
        : last.homeTeamId
      : null;
    const ratings: Record<string, number> = {};
    if (last) {
      for (const pr of last.playerRatings) {
        if (pr.teamId === human.clubId) ratings[pr.playerId] = pr.rating;
      }
    }
    const picked = pickNextManagerEvent({
      // Every friend answers in the SAME round: bypass the per-club random cooldown gate
      eventsState: { ...hs.events, matchesSinceLastEvent: 99 },
      starters: squad.starters,
      bench: squad.bench,
      conditionMap: state.conditions,
      teamName: human.profile.name,
      managerName: human.nickname,
      nextOpponentName: nextOpp?.name ?? '다음 상대팀',
      nextOpponentRank: nextOppId ? rankOf(state.standings, nextOppId) : undefined,
      userRank: rankOf(state.standings, human.clubId) ?? 10,
      lastMatch: last,
      lastMatchOpponentName: state.clubs.find((c) => c.id === lastOppId)?.name,
      lastMatchWasUserHome: last ? last.homeTeamId === human.clubId : true,
      lastMatchMomPlayerId: last?.momPlayerId ?? null,
      lastMatchRatings: ratings,
      rng,
    });
    if (!picked) continue;
    anyActive = true;
    perHuman[human.clubId] = {
      ...hs,
      events: {
        ...hs.events,
        usedEventIds: [...hs.events.usedEventIds, picked.templateId],
        matchesSinceLastEvent: 0,
        activeEvent: picked,
        lastResolution: null,
      },
    };
  }

  if (!anyActive) return { ...state, perHuman, todo: state.todo.slice(1) };
  return {
    ...state,
    perHuman,
    flow: { kind: 'event', key: `event-r${state.round}` },
  };
}

/** A friend answered the interview: applies morale effects and releases the round once everyone answered. */
export function resolveMpLeagueEvent(
  state: MpLeagueHostState,
  env: MpLeagueEnv,
  clubId: string,
  choiceId: string,
): MpLeagueHostState {
  const hs = state.perHuman[clubId];
  const squad = env.squads[clubId];
  if (!hs?.events.activeEvent || !squad) return state;
  const resolved = resolveManagerEventChoice({
    event: hs.events.activeEvent,
    choiceId,
    starters: squad.starters,
    bench: squad.bench,
    conditionMap: state.conditions,
    currentTeamMorale: hs.events.teamMorale,
    rng: env.rng,
  });
  const perHuman = {
    ...state.perHuman,
    [clubId]: {
      ...hs,
      events: {
        ...hs.events,
        teamMorale: resolved.nextTeamMorale,
        activeEvent: null,
        lastResolution: resolved.resolution,
      },
    },
  };
  const stillActive = Object.values(perHuman).some((h) => h.events.activeEvent);
  const next: MpLeagueHostState = {
    ...state,
    perHuman,
    conditions: resolved.nextConditionMap,
  };
  if (stillActive || state.flow.kind !== 'event') return next;
  return {
    ...next,
    flow: { kind: 'auto' },
    todo: state.todo[0]?.t === 'events' ? state.todo.slice(1) : state.todo,
  };
}

export function acknowledgeMpLeagueInjuries(
  state: MpLeagueHostState,
  clubId: string,
): MpLeagueHostState {
  const hs = state.perHuman[clubId];
  if (!hs || hs.alerts.length === 0) return state;
  return {
    ...state,
    perHuman: { ...state.perHuman, [clubId]: { ...hs, alerts: [] } },
  };
}

// ── Step: transfer window (incoming offers + counter offers only) ────────────

function stepTransfer(state: MpLeagueHostState, env: MpLeagueEnv): MpLeagueHostState {
  const rng = env.rng ?? Math.random;
  const trigger = checkTransferWindowTrigger(
    state.round,
    state.transferWindows,
    state.completedWindows,
  );
  if (!trigger) return { ...state, todo: state.todo.slice(1) };

  const leagueClubIds = new Set(state.clubs.map((c) => c.id));
  const replaced = new Set(state.replacedClubNames);
  const usedClubIds = new Set<string>();
  const usedAiPlayerIds = new Set<string>();
  const perHuman = { ...state.perHuman };

  for (const human of state.humans) {
    const squad = env.squads[human.clubId];
    const hs = perHuman[human.clubId];
    if (!squad || !hs) continue;
    const raw = generateIncomingTradeOffers({
      windowIndex: trigger.windowIndex,
      currentRound: state.round,
      userLeagueId: state.settings.leagueId,
      userStarters: squad.starters,
      userBench: squad.bench,
      standings: state.standings,
      otherLeagues: state.otherLeagues,
      aiRosters: state.aiRosters,
      allPlayerStats: state.allPlayerStats,
      conditionMap: state.conditions,
      departedPlayerIds: [
        ...state.departedIds,
        ...allHumanPlayerIds(env.squads, human.clubId),
      ],
      rng,
    });
    const offers: IncomingTradeOffer[] = [];
    for (const offer of raw) {
      if (offers.length >= MAX_OFFERS_PER_HUMAN) break;
      // One AI club never negotiates with two friends at once (no duplicate players possible)
      if (usedClubIds.has(offer.club.id)) continue;
      if (replaced.has(offer.club.name)) continue;
      if (
        offer.leagueId === state.settings.leagueId &&
        !leagueClubIds.has(offer.club.id)
      ) {
        continue;
      }
      if (offer.aiOffersPlayers.some((p) => usedAiPlayerIds.has(p.id))) continue;
      if (offer.aiOffersPlayers.length !== 1 || offer.userRequestedPlayers.length !== 1) {
        continue;
      }
      usedClubIds.add(offer.club.id);
      for (const p of offer.aiOffersPlayers) usedAiPlayerIds.add(p.id);
      offers.push({ ...offer, id: `${human.clubId}-${offer.id}` });
    }
    perHuman[human.clubId] = {
      ...hs,
      offers,
      attemptsLeft: ATTEMPTS_PER_WINDOW,
      tradeNote: null,
    };
  }

  return {
    ...state,
    perHuman,
    transferWindowIndex: trigger.windowIndex,
    flow: { kind: 'transfer', key: `transfer-w${trigger.windowIndex}` },
  };
}

export function closeMpLeagueTransferWindow(state: MpLeagueHostState): MpLeagueHostState {
  if (state.flow.kind !== 'transfer' || state.transferWindowIndex === null) return state;
  const perHuman: Record<string, MpHumanSeasonState> = {};
  for (const [clubId, hs] of Object.entries(state.perHuman)) {
    perHuman[clubId] = { ...hs, offers: [], attemptsLeft: 0, tradeNote: null };
  }
  return {
    ...state,
    perHuman,
    completedWindows: Array.from(
      new Set([...state.completedWindows, state.transferWindowIndex]),
    ),
    transferWindowIndex: null,
    flow: { kind: 'auto' },
    todo: state.todo[0]?.t === 'transfer' ? state.todo.slice(1) : state.todo,
  };
}

export interface MpTradeOutcome {
  state: MpLeagueHostState;
  /** New squad for the trading friend (host writes it back to their row) */
  squad: MpSquadInput | null;
  note: MpTradeResultNote;
}

function setTradeNote(
  state: MpLeagueHostState,
  clubId: string,
  note: MpTradeResultNote,
  patch?: Partial<MpHumanSeasonState>,
): MpLeagueHostState {
  const hs = state.perHuman[clubId];
  if (!hs) return state;
  return {
    ...state,
    perHuman: { ...state.perHuman, [clubId]: { ...hs, ...patch, tradeNote: note } },
  };
}

function retagStats(
  stats: Record<string, PlayerSeasonStats>,
  player: Player,
  club: { id: string; name: string; shortName: string; primaryColor: string; secondaryColor: string },
): Record<string, PlayerSeasonStats> {
  const existing = stats[player.id];
  if (!existing) return stats;
  return {
    ...stats,
    [player.id]: {
      ...existing,
      teamId: club.id,
      teamName: club.name,
      teamShortName: club.shortName,
      teamPrimaryColor: club.primaryColor,
      teamSecondaryColor: club.secondaryColor,
    },
  };
}

/** Swaps players between one friend and one AI club everywhere (rosters, 5 leagues, stats) with zero duplicates. */
function executeMpTrade(params: {
  state: MpLeagueHostState;
  human: MpLeagueHuman;
  squad: MpSquadInput;
  offer: IncomingTradeOffer;
  sent: Player;
  incoming: Player;
}): { state: MpLeagueHostState; squad: MpSquadInput } {
  const { state, human, squad, offer, sent, incoming } = params;
  const incomingForHuman: Player = {
    ...incoming,
    club: human.profile.name,
    leagueId: state.settings.leagueId,
  };
  const sentForPartner: Player = {
    ...sent,
    club: offer.club.name,
    leagueId: offer.leagueId,
  };
  const replace = (list: Player[]) =>
    list.map((p) => (p.id === sent.id ? incomingForHuman : p));
  const nextSquad: MpSquadInput = {
    ...squad,
    starters: replace(squad.starters),
    bench: replace(squad.bench),
  };

  const moved = new Set([sent.id, incoming.id]);
  const scrub = (roster: Player[]) => roster.filter((p) => !moved.has(p.id));

  const aiRosters: Record<string, Player[]> = {};
  for (const [cid, roster] of Object.entries(state.aiRosters)) {
    const cleaned = scrub(roster);
    aiRosters[cid] =
      offer.leagueId === state.settings.leagueId && cid === offer.club.id
        ? [...cleaned, sentForPartner]
        : cleaned;
  }

  const otherLeagues = { ...state.otherLeagues };
  for (const lid of Object.keys(otherLeagues) as LeagueId[]) {
    const ol = otherLeagues[lid];
    if (!ol?.aiRosters) continue;
    const rosters: Record<string, Player[]> = {};
    for (const [cid, roster] of Object.entries(ol.aiRosters)) {
      const cleaned = scrub(roster);
      rosters[cid] =
        lid === offer.leagueId && cid === offer.club.id
          ? [...cleaned, sentForPartner]
          : cleaned;
    }
    otherLeagues[lid] = { ...ol, aiRosters: rosters };
  }

  const humanClub = state.clubs.find((c) => c.id === human.clubId);
  let allPlayerStats = state.allPlayerStats;
  if (humanClub) allPlayerStats = retagStats(allPlayerStats, incoming, humanClub);
  allPlayerStats = retagStats(allPlayerStats, sent, offer.club);

  return {
    squad: nextSquad,
    state: {
      ...state,
      aiRosters,
      otherLeagues,
      allPlayerStats,
      departedIds: Array.from(new Set([...state.departedIds, sent.id, incoming.id])),
    },
  };
}

function findOffer(
  state: MpLeagueHostState,
  clubId: string,
  offerId: string,
): IncomingTradeOffer | null {
  return (
    state.perHuman[clubId]?.offers.find(
      (o) => o.id === offerId && o.status === 'pending',
    ) ?? null
  );
}

function markOffer(
  hs: MpHumanSeasonState,
  offerId: string,
  status: IncomingTradeOffer['status'],
): IncomingTradeOffer[] {
  return hs.offers.map((o) => (o.id === offerId ? { ...o, status } : o));
}

export function rejectMpLeagueOffer(
  state: MpLeagueHostState,
  clubId: string,
  offerId: string,
): MpLeagueHostState {
  const hs = state.perHuman[clubId];
  if (!hs) return state;
  return {
    ...state,
    perHuman: {
      ...state.perHuman,
      [clubId]: { ...hs, offers: markOffer(hs, offerId, 'rejected') },
    },
  };
}

/**
 * Accepts an incoming offer as-is (sendPlayerId omitted) or sends a counter offer
 * that swaps in a different player of mine for the same AI player.
 */
export function submitMpLeagueTrade(params: {
  state: MpLeagueHostState;
  env: MpLeagueEnv;
  clubId: string;
  offerId: string;
  sendPlayerId?: string;
}): MpTradeOutcome {
  const { state, env, clubId, offerId, sendPlayerId } = params;
  const rng = env.rng ?? Math.random;
  const human = humanById(state, clubId);
  const squad = env.squads[clubId];
  const hs = state.perHuman[clubId];
  const offer = findOffer(state, clubId, offerId);
  const fail = (message: string): MpTradeOutcome => ({
    state: setTradeNote(state, clubId, { success: false, message }),
    squad: null,
    note: { success: false, message },
  });

  if (!human || !squad || !hs || state.flow.kind !== 'transfer') {
    return fail('지금은 트레이드를 진행할 수 없습니다.');
  }
  if (!offer) return fail('이미 처리된 제안입니다.');
  if (hs.attemptsLeft <= 0) return fail('이번 이적시장의 협상 기회를 모두 사용했습니다.');

  const incoming = offer.aiOffersPlayers[0];
  const mySquad = squadPlayers(squad);
  const isCounter = Boolean(
    sendPlayerId && sendPlayerId !== offer.userRequestedPlayers[0]?.id,
  );
  const sent = mySquad.find(
    (p) => p.id === (sendPlayerId ?? offer.userRequestedPlayers[0]?.id),
  );
  if (!incoming || !sent) return fail('제안 대상 선수가 스쿼드에 없습니다.');

  // Worldwide unique players: the incoming player must not already belong to any friend
  if (allHumanPlayerIds(env.squads).includes(incoming.id)) {
    return fail('해당 선수는 이미 다른 팀 소속입니다.');
  }

  const gkAfter =
    mySquad.filter((p) => p.id !== sent.id && p.position === 'GK').length +
    (incoming.position === 'GK' ? 1 : 0);
  if (gkAfter < 1) {
    return fail('골키퍼를 최소 1명 남겨야 해서 이 트레이드는 진행할 수 없습니다.');
  }

  let probability = 100;
  if (isCounter) {
    const ownedIds = new Set(mySquad.map((p) => p.id));
    const liveAiRoster =
      offer.leagueId === state.settings.leagueId
        ? state.aiRosters[offer.club.id] ?? []
        : state.otherLeagues[offer.leagueId]?.aiRosters?.[offer.club.id] ?? [];
    const partner16 = buildAiClubSquad16({
      club: offer.club,
      leagueId: offer.leagueId,
      liveAiRoster,
      ownedIds,
      excludeIds: buildExcludeIds(state, env.squads),
    }).all16;
    const evaluation = evaluateTradePackage({
      userSentPlayers: [sent],
      aiTargetPlayers: [incoming],
      aiFillerPlayers: [],
      aiClub: offer.club,
      aiRoster: partner16,
      aiNeeds: analyzeClubPositionNeeds(partner16),
      userSquad: mySquad,
      userRank: rankOf(state.standings, clubId) ?? 10,
      userLeagueSize: state.standings.length || 20,
      aiClubRank: offer.clubRank,
      aiLeagueSize: offer.leagueSize,
      allPlayerStats: state.allPlayerStats,
      conditionMap: state.conditions,
    });
    if (evaluation.blockedReason) return fail(evaluation.blockedReason);
    probability = evaluation.acceptanceChance;
    if (rng() * 100 >= probability) {
      const left = Math.max(0, hs.attemptsLeft - 1);
      const note: MpTradeResultNote = {
        success: false,
        probability,
        message: `${offer.club.name} 측이 역제안을 거절했습니다. (성사 확률 ${probability}%)`,
      };
      return {
        state: setTradeNote(state, clubId, note, { attemptsLeft: left }),
        squad: null,
        note,
      };
    }
  }

  const traded = executeMpTrade({ state, human, squad, offer, sent, incoming });
  const note: MpTradeResultNote = {
    success: true,
    probability,
    message: `${sent.name} ↔ ${incoming.name} 트레이드 성사 (${offer.club.name})`,
  };
  const nextHs = traded.state.perHuman[clubId];
  return {
    squad: traded.squad,
    note,
    state: {
      ...traded.state,
      perHuman: {
        ...traded.state.perHuman,
        [clubId]: {
          ...nextHs,
          offers: markOffer(nextHs, offerId, 'accepted'),
          attemptsLeft: Math.max(0, nextHs.attemptsLeft - 1),
          tradeNote: note,
        },
      },
    },
  };
}

// ── Step: league finished → Champions League or final summary ────────────────

function stepFinishLeague(state: MpLeagueHostState, env: MpLeagueEnv): MpLeagueHostState {
  const rng = env.rng ?? Math.random;
  const excludeIds = buildExcludeIds(state, env.squads);
  const otherLeagues = advanceOtherLeaguesToProgress(
    state.otherLeagues,
    state.totalRounds,
    state.totalRounds,
    rng,
    excludeIds,
  );
  const awards = computeSeasonAwards(
    state.allPlayerStats,
    state.standings,
    state.totalRounds,
  );

  const clubs = refreshHumanClubs(state, env, state.conditions);
  const top4 = state.standings.slice(0, 4).map((r) => r.teamId);
  const uclHumanClubIds = state.settings.uclEnabled
    ? state.humans.map((h) => h.clubId).filter((id) => top4.includes(id))
    : [];

  const uclRosters: Record<string, Player[]> = { ...state.aiRosters };
  for (const h of state.humans) {
    const squad = env.squads[h.clubId];
    if (squad) uclRosters[h.clubId] = squad.starters;
  }

  const created = createUclTournamentState({
    userLeagueId: state.settings.leagueId,
    userClub: clubs[0],
    userSquad: [],
    userLeagueClubs: clubs,
    userLeagueStandings: state.standings,
    userAiRosters: uclRosters,
    otherLeagues,
    excludeIds,
    userParticipated: false,
    rng,
  });

  const base: MpLeagueHostState = {
    ...state,
    clubs,
    otherLeagues,
    awards,
    uclHumanClubIds,
  };

  if (uclHumanClubIds.length === 0) {
    // No friend qualified (or UCL is OFF): finish Europe in the background for fair global awards
    const bg = simulateUclToCompletion({
      ucl: created.ucl,
      uclPlayerStats: created.uclPlayerStats,
    });
    return {
      ...base,
      ucl: stripUclResults(bg.ucl),
      uclPlayerStats: bg.uclPlayerStats,
      todo: [{ t: 'finalize' }],
    };
  }

  return {
    ...base,
    stage: 'ucl',
    ucl: created.ucl,
    uclPlayerStats: created.uclPlayerStats,
    uclLastScores: [],
    uclConsentedStage: null,
    todo: [{ t: 'ucl_lp_round' }],
  };
}

function stripUclResults(
  ucl: NonNullable<MpLeagueHostState['ucl']>,
): NonNullable<MpLeagueHostState['ucl']> {
  return {
    ...ucl,
    leaguePhaseFixtures: ucl.leaguePhaseFixtures.map((f) =>
      f.result ? { ...f, result: undefined } : f,
    ),
    lastUserMatch: null,
  };
}

// ── Step: UCL league phase round ─────────────────────────────────────────────

function stepUclLeaguePhase(state: MpLeagueHostState, env: MpLeagueEnv): MpLeagueHostState {
  const rng = env.rng ?? Math.random;
  const ucl = state.ucl;
  if (!ucl) return { ...state, todo: [{ t: 'finalize' }] };
  const target = ucl.leaguePhaseRound + 1;
  if (target > 8 || ucl.stage !== 'league_phase') {
    return { ...state, todo: [{ t: 'ucl_ko_leg' }] };
  }
  const label = `UCL 리그 페이즈 ${target}R`;
  const fixtures = ucl.leaguePhaseFixtures.filter(
    (f) => f.round === target && !f.played,
  );
  const missingH2H = fixtures.filter(
    (f) =>
      isHumanClub(state, f.homeTeamId) &&
      isHumanClub(state, f.awayTeamId) &&
      !state.h2hResults[f.id],
  );
  if (missingH2H.length > 0) {
    return openH2H(
      state,
      missingH2H.map((f) => ({
        key: f.id,
        ctx: 'ucl_lp',
        label: `${label} 맞대결`,
        homeClubId: f.homeTeamId,
        awayClubId: f.awayTeamId,
        round: target,
        knockout: false,
        speed: 4,
      })),
    );
  }

  const conditions: PlayerConditionMap = { ...state.conditions };
  const uclClubsById: Record<string, Club> = Object.fromEntries(
    ucl.clubs.map((c) => [c.id, c]),
  );
  const excludeIds = buildExcludeIds(state, env.squads);
  const precomputed: Record<string, MatchResult> = {};
  const humanOutcomes: {
    human: MpLeagueHuman;
    setup: MpHumanMatchSetup;
    result: MatchResult;
    isH2H: boolean;
  }[] = [];
  const usedKeys: string[] = [];

  for (const fix of fixtures) {
    const homeHuman = humanById(state, fix.homeTeamId);
    const awayHuman = humanById(state, fix.awayTeamId);
    if (homeHuman && awayHuman) {
      const pre: MatchResult = {
        ...state.h2hResults[fix.id],
        fixtureId: fix.id,
        round: target,
      };
      precomputed[fix.id] = pre;
      usedKeys.push(fix.id);
      for (const side of buildH2HSetups(state, env, conditions, pre, 'ucl')) {
        humanOutcomes.push({ ...side, result: pre, isH2H: true });
      }
    } else if (homeHuman || awayHuman) {
      const human = (homeHuman ?? awayHuman) as MpLeagueHuman;
      const aiId = homeHuman ? fix.awayTeamId : fix.homeTeamId;
      const sim = simulateHumanVsAi({
        state,
        env,
        conditions,
        fixture: fix,
        aiClub: uclClubsById[aiId],
        aiBaseRoster: ucl.aiRosters[aiId] ?? [],
        human,
        competition: 'ucl',
        opponentRank: rankOf(ucl.standings, aiId) ?? 12,
        excludeIds,
      });
      precomputed[fix.id] = sim.result;
      humanOutcomes.push({ ...sim, isH2H: false });
    }
  }

  const sim = simulateUclLeaguePhaseRound({
    ucl,
    uclPlayerStats: state.uclPlayerStats,
    precomputedResults: precomputed,
    userClubId: MP_NO_USER_ID,
    conditionMap: conditions,
    excludeIds,
    rng,
  });

  const perHuman = { ...state.perHuman };
  let working: MpLeagueHostState = { ...state, perHuman };
  for (const o of humanOutcomes) {
    perHuman[o.human.clubId] = applyPostHumanMatch({
      state: working,
      conditions,
      human: o.human,
      setup: o.setup,
      squad: env.squads[o.human.clubId],
      result: o.result,
      competition: 'ucl',
      round: target,
      isBigMatch: true,
      label,
      isH2H: o.isH2H,
      rng,
    });
    working = { ...working, perHuman };
  }

  const nextH2HResults = { ...state.h2hResults };
  for (const k of usedKeys) delete nextH2HResults[k];

  return {
    ...working,
    conditions,
    ucl: stripUclResults(sim.ucl),
    uclPlayerStats: sim.uclPlayerStats,
    h2hResults: nextH2HResults,
    uclLastScores: humanOutcomes
      .filter((o, idx, arr) => arr.findIndex((x) => x.result === o.result) === idx)
      .map((o) => toLiteMatch(o.result, 'ucl', label, o.isH2H)),
    todo: [sim.ucl.leaguePhaseRound >= 8 ? { t: 'ucl_ko_leg' } : { t: 'ucl_lp_round' }],
  };
}

// ── Step: UCL knockout leg (all-friends consent per stage + live multicast) ──

function humansAliveInUcl(state: MpLeagueHostState): string[] {
  const ucl = state.ucl;
  if (!ucl || ucl.completed) return [];
  if (ucl.stage === 'league_phase' || ucl.stage === 'special_transfer') {
    return state.uclHumanClubIds;
  }
  if (ucl.stage === 'completed') return [];
  const ties = ucl.ties[ucl.stage] ?? [];
  let alive = state.uclHumanClubIds.filter((id) =>
    ties.some((t) => t.winnerId === null && (t.teamAId === id || t.teamBId === id)),
  );
  if (ucl.stage === 'playoff') {
    // Top 8 skip the playoff round but are still alive for the Round of 16
    const top8 = ucl.standings.slice(0, 8).map((r) => r.teamId);
    alive = Array.from(
      new Set([...alive, ...state.uclHumanClubIds.filter((id) => top8.includes(id))]),
    );
  }
  return alive;
}

function tieFixture(
  tie: UclKnockoutTie,
  leg: 1 | 2,
  isFinal: boolean,
): { fixture: Fixture; key: string; aggHomeBefore?: number; aggAwayBefore?: number } {
  const stageIdx = UCL_KNOCKOUT_ORDER.indexOf(tie.stage);
  if (isFinal) {
    const key = `${tie.id}-final`;
    return {
      key,
      fixture: {
        id: key,
        round: 16,
        homeTeamId: tie.teamAId,
        awayTeamId: tie.teamBId,
        played: false,
      },
    };
  }
  if (leg === 1) {
    const key = `${tie.id}-leg1`;
    return {
      key,
      fixture: {
        id: key,
        round: 9 + stageIdx * 2,
        homeTeamId: tie.teamBId,
        awayTeamId: tie.teamAId,
        played: false,
      },
    };
  }
  const key = `${tie.id}-leg2`;
  return {
    key,
    aggHomeBefore: tie.aggTeamA,
    aggAwayBefore: tie.aggTeamB,
    fixture: {
      id: key,
      round: 10 + stageIdx * 2,
      homeTeamId: tie.teamAId,
      awayTeamId: tie.teamBId,
      played: false,
    },
  };
}

function toCastMatch(
  result: MatchResult,
  key: string,
  label: string,
  humanClubIds: string[],
  agg: { aggHomeBefore?: number; aggAwayBefore?: number },
  winnerId: string | null,
): MpCastMatch {
  const goalEvents = [...result.events, ...(result.extraTime?.etEvents ?? [])]
    .filter((e) => e.type === 'goal')
    .map((e) => ({
      minute: e.minute,
      teamId: e.teamId,
      scorer: e.scorerName ?? '',
    }))
    .sort((a, b) => a.minute - b.minute);
  return {
    key,
    label,
    homeTeamId: result.homeTeamId,
    awayTeamId: result.awayTeamId,
    aggHomeBefore: agg.aggHomeBefore,
    aggAwayBefore: agg.aggAwayBefore,
    goals: goalEvents,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    extraTime: Boolean(result.extraTime),
    penalties: result.extraTime?.penalties
      ? {
          home: result.extraTime.penalties.homePenGoals,
          away: result.extraTime.penalties.awayPenGoals,
          winnerId: result.extraTime.penalties.winnerTeamId,
        }
      : null,
    winnerId,
    humanClubIds,
  };
}

function stepUclKnockoutLeg(state: MpLeagueHostState, env: MpLeagueEnv): MpLeagueHostState {
  const rng = env.rng ?? Math.random;
  const ucl = state.ucl;
  if (!ucl || ucl.completed || ucl.stage === 'completed') {
    return { ...state, todo: [{ t: 'finalize' }] };
  }
  if (ucl.stage === 'league_phase' || ucl.stage === 'special_transfer') {
    return { ...state, todo: [{ t: 'ucl_lp_round' }] };
  }
  const stage: UclKnockoutStage = ucl.stage;
  const isFinal = stage === 'final';
  const leg: 1 | 2 = isFinal ? 1 : ucl.knockoutLeg;
  const stageLabel = UCL_STAGE_LABELS[stage];
  const label = isFinal ? `UCL ${stageLabel}` : `UCL ${stageLabel} ${leg}차전`;

  if (humansAliveInUcl(state).length === 0) {
    const done = simulateUclToCompletion({
      ucl,
      uclPlayerStats: state.uclPlayerStats,
    });
    return {
      ...state,
      ucl: stripUclResults(done.ucl),
      uclPlayerStats: done.uclPlayerStats,
      todo: [{ t: 'finalize' }],
    };
  }

  // Every friend must agree before each knockout stage starts
  if (state.uclConsentedStage !== stage) {
    return {
      ...state,
      flow: { kind: 'consent', key: `ucl-consent-${stage}`, label: `UCL ${stageLabel}` },
    };
  }

  const ties = ucl.ties[stage].filter((t) => t.winnerId === null);
  const h2hSpecs: MpH2HSpec[] = [];
  for (const tie of ties) {
    if (!isHumanClub(state, tie.teamAId) || !isHumanClub(state, tie.teamBId)) continue;
    const tf = tieFixture(tie, leg, isFinal);
    if (state.h2hResults[tf.key]) continue;
    h2hSpecs.push({
      key: tf.key,
      ctx: 'ucl_ko',
      label: `${label} 맞대결`,
      homeClubId: tf.fixture.homeTeamId,
      awayClubId: tf.fixture.awayTeamId,
      round: tf.fixture.round,
      knockout: isFinal || leg === 2,
      aggHomeBefore: tf.aggHomeBefore,
      aggAwayBefore: tf.aggAwayBefore,
      speed: 2,
    });
  }
  if (h2hSpecs.length > 0) return openH2H(state, h2hSpecs);

  const conditions: PlayerConditionMap = { ...state.conditions };
  const uclClubsById: Record<string, Club> = Object.fromEntries(
    ucl.clubs.map((c) => [c.id, c]),
  );
  const excludeIds = buildExcludeIds(state, env.squads);
  const precomputed: Record<string, MatchResult> = {};
  const humanOutcomes: {
    human: MpLeagueHuman;
    setup: MpHumanMatchSetup;
    result: MatchResult;
    isH2H: boolean;
  }[] = [];
  const usedKeys: string[] = [];
  const castSeeds: {
    key: string;
    result: MatchResult;
    humans: string[];
    agg: { aggHomeBefore?: number; aggAwayBefore?: number };
    tieId: string;
  }[] = [];

  for (const tie of ties) {
    const aHuman = humanById(state, tie.teamAId);
    const bHuman = humanById(state, tie.teamBId);
    if (!aHuman && !bHuman) continue;
    const tf = tieFixture(tie, leg, isFinal);
    if (aHuman && bHuman) {
      const pre: MatchResult = {
        ...state.h2hResults[tf.key],
        fixtureId: tf.key,
        round: tf.fixture.round,
      };
      precomputed[tf.key] = pre;
      usedKeys.push(tf.key);
      for (const side of buildH2HSetups(state, env, conditions, pre, 'ucl')) {
        humanOutcomes.push({ ...side, result: pre, isH2H: true });
      }
      continue;
    }
    const human = (aHuman ?? bHuman) as MpLeagueHuman;
    const aiId = aHuman ? tie.teamBId : tie.teamAId;
    const sim = simulateHumanVsAi({
      state,
      env,
      conditions,
      fixture: tf.fixture,
      aiClub: uclClubsById[aiId],
      aiBaseRoster: ucl.aiRosters[aiId] ?? [],
      human,
      competition: 'ucl',
      opponentRank: 3,
      excludeIds,
      decider:
        isFinal || leg === 2
          ? { aggHomeBefore: tf.aggHomeBefore, aggAwayBefore: tf.aggAwayBefore }
          : null,
    });
    precomputed[tf.key] = sim.result;
    humanOutcomes.push({ ...sim, isH2H: false });
    castSeeds.push({
      key: tf.key,
      result: sim.result,
      humans: [human.clubId],
      agg: { aggHomeBefore: tf.aggHomeBefore, aggAwayBefore: tf.aggAwayBefore },
      tieId: tie.id,
    });
  }

  const advanced = advanceUclKnockoutLeg({
    ucl,
    uclPlayerStats: state.uclPlayerStats,
    precomputedResults: precomputed,
    userClubId: MP_NO_USER_ID,
    conditionMap: conditions,
    excludeIds,
    rng,
  });

  const perHuman = { ...state.perHuman };
  let working: MpLeagueHostState = { ...state, perHuman };
  for (const o of humanOutcomes) {
    perHuman[o.human.clubId] = applyPostHumanMatch({
      state: working,
      conditions,
      human: o.human,
      setup: o.setup,
      squad: env.squads[o.human.clubId],
      result: o.result,
      competition: 'ucl',
      round: o.result.round,
      isBigMatch: true,
      label,
      isH2H: o.isH2H,
      rng,
    });
    working = { ...working, perHuman };
  }

  const nextH2HResults = { ...state.h2hResults };
  for (const k of usedKeys) delete nextH2HResults[k];

  const resolvedTies = advanced.ucl.ties[stage];
  const castMatches = castSeeds.map((seed) => {
    const tieAfter = resolvedTies.find((t) => t.id === seed.tieId);
    return toCastMatch(
      seed.result,
      seed.key,
      label,
      seed.humans,
      seed.agg,
      tieAfter?.winnerId ?? null,
    );
  });

  const completed = advanced.ucl.completed;
  const nextState: MpLeagueHostState = {
    ...working,
    conditions,
    ucl: advanced.ucl,
    uclPlayerStats: advanced.uclPlayerStats,
    h2hResults: nextH2HResults,
    uclLastScores: humanOutcomes
      .filter((o, idx, arr) => arr.findIndex((x) => x.result === o.result) === idx)
      .map((o) => toLiteMatch(o.result, 'ucl', label, o.isH2H)),
    todo: [completed ? { t: 'finalize' } : { t: 'ucl_ko_leg' }],
  };

  if (castMatches.length === 0) return nextState;
  const castKey = `cast-${stage}-${leg}`;
  return {
    ...nextState,
    cast: { key: castKey, title: label, matches: castMatches },
    flow: { kind: 'cast', key: castKey },
  };
}

/** How long the host keeps the multicast board up before moving on (ms). */
export function getMpCastDurationMs(state: MpLeagueHostState): number {
  if (!state.cast) return 0;
  const hasEt = state.cast.matches.some((m) => m.extraTime);
  const hasPens = state.cast.matches.some((m) => m.penalties);
  return 7000 + (hasEt ? 2500 : 0) + (hasPens ? 1500 : 0) + 2500;
}

export function endMpLeagueCast(state: MpLeagueHostState): MpLeagueHostState {
  if (state.flow.kind !== 'cast') return state;
  return { ...state, cast: null, flow: { kind: 'auto' } };
}

export function grantMpLeagueConsent(state: MpLeagueHostState): MpLeagueHostState {
  if (state.flow.kind !== 'consent' || !state.ucl) return state;
  return {
    ...state,
    uclConsentedStage: state.ucl.stage,
    flow: { kind: 'auto' },
  };
}

// ── H2H bookkeeping ──────────────────────────────────────────────────────────

/** Stores a finished friend-vs-friend result; the pending step then consumes it as a precomputed result. */
export function completeMpLeagueH2H(
  state: MpLeagueHostState,
  result: MatchResult,
): MpLeagueHostState {
  const live = state.h2hLive;
  if (!live || state.flow.kind !== 'h2h') return state;
  const spec = live.spec;
  const perHuman = { ...state.perHuman };
  for (const clubId of [spec.homeClubId, spec.awayClubId]) {
    const hs = perHuman[clubId];
    if (!hs) continue;
    const isHome = result.homeTeamId === clubId;
    const gf = isHome ? result.homeGoals : result.awayGoals;
    const ga = isHome ? result.awayGoals : result.homeGoals;
    // Two-legged first legs & league games may be drawn; deciders use the ET/PK winner
    const outcome = outcomeOf(result, clubId);
    perHuman[clubId] = {
      ...hs,
      h2h: {
        played: hs.h2h.played + 1,
        won: hs.h2h.won + (outcome === 'W' ? 1 : 0),
        drawn: hs.h2h.drawn + (outcome === 'D' ? 1 : 0),
        lost: hs.h2h.lost + (outcome === 'L' ? 1 : 0),
        goalsFor: hs.h2h.goalsFor + gf,
        goalsAgainst: hs.h2h.goalsAgainst + ga,
      },
    };
  }
  const queue = state.h2hQueue.slice(1);
  const base: MpLeagueHostState = {
    ...state,
    perHuman,
    h2hResults: { ...state.h2hResults, [spec.key]: result },
    h2hQueue: queue,
  };
  if (queue.length > 0) {
    return {
      ...base,
      h2hLive: { spec: queue[0], match: null, openedAt: new Date().toISOString() },
    };
  }
  return { ...base, h2hLive: null, flow: { kind: 'auto' } };
}

// ── Main driver ──────────────────────────────────────────────────────────────

const PACED_STEPS: MpLeagueStep['t'][] = ['league_round', 'ucl_lp_round', 'ucl_ko_leg'];

/**
 * Advances the shared season until it needs outside input (friend match, interviews, transfer window,
 * stage consent, multicast) or until ONE paced step (a league / UCL round) has been simulated.
 */
export function runMpLeague(
  state: MpLeagueHostState,
  env: MpLeagueEnv,
  options: { allowPaced?: boolean } = {},
): MpLeagueHostState {
  let current = state;
  let pacedBudget = options.allowPaced === false ? 0 : 1;

  for (let guard = 0; guard < 24; guard += 1) {
    if (current.flow.kind !== 'auto') break;
    const step = current.todo[0];
    if (!step) break;

    if (PACED_STEPS.includes(step.t)) {
      if (pacedBudget <= 0) break;
      const before = current;
      if (step.t === 'league_round') current = stepLeagueRound(current, env);
      else if (step.t === 'ucl_lp_round') current = stepUclLeaguePhase(current, env);
      else current = stepUclKnockoutLeg(current, env);
      // A paced step that actually simulated something consumes the budget
      const simulated =
        current.round !== before.round ||
        current.ucl?.leaguePhaseRound !== before.ucl?.leaguePhaseRound ||
        current.ucl?.knockoutLeg !== before.ucl?.knockoutLeg ||
        current.ucl?.stage !== before.ucl?.stage;
      if (simulated) pacedBudget -= 1;
      continue;
    }

    if (step.t === 'cup_stage') current = stepCupStage(current, env);
    else if (step.t === 'events') current = stepEvents(current, env);
    else if (step.t === 'transfer') current = stepTransfer(current, env);
    else if (step.t === 'finish_league') current = stepFinishLeague(current, env);
    else if (step.t === 'finalize') {
      current = finalizeMpLeagueSeason(current, env.squads);
      break;
    }
  }

  return current === state ? state : { ...current, rev: state.rev + 1 };
}

// ── Public snapshot for every client ─────────────────────────────────────────

function pickConditions(
  conditions: PlayerConditionMap,
  squad: MpSquadInput | undefined,
): PlayerConditionMap {
  const out: PlayerConditionMap = {};
  for (const p of squadPlayers(squad)) {
    const cond = conditions[p.id];
    if (cond) out[p.id] = cond;
  }
  return out;
}

function topBy(
  stats: Record<string, PlayerSeasonStats>,
  key: 'goals' | 'assists',
): PlayerSeasonStats[] {
  return Object.values(stats)
    .filter((s) => s[key] > 0)
    .sort((a, b) => b[key] - a[key] || b.avgRating - a.avgRating)
    .slice(0, 8);
}

function slimCup(cup: DomesticCupState | null): DomesticCupState | null {
  if (!cup) return null;
  const slim = (stage: CupStageId) =>
    cup.rounds[stage].map((n) =>
      n.result ? { ...n, result: { ...n.result, events: [], playerRatings: [] } } : n,
    );
  return {
    ...cup,
    rounds: { r16: slim('r16'), qf: slim('qf'), sf: slim('sf'), final: slim('final') },
  };
}

function slimTies(ties: UclKnockoutTie[]): UclKnockoutTie[] {
  const slim = (r: MatchResult | undefined) =>
    r ? { ...r, events: [], playerRatings: [] } : r;
  return ties.map((t) => ({ ...t, leg1: slim(t.leg1), leg2: slim(t.leg2) }));
}

function buildUclLive(state: MpLeagueHostState): MpUclLive | null {
  const ucl = state.ucl;
  if (!ucl || state.stage === 'league') return null;
  return {
    stage: ucl.stage,
    knockoutLeg: ucl.knockoutLeg,
    leaguePhaseRound: ucl.leaguePhaseRound,
    clubs: ucl.clubs,
    standings: ucl.standings,
    ties: {
      playoff: slimTies(ucl.ties.playoff),
      r16: slimTies(ucl.ties.r16),
      qf: slimTies(ucl.ties.qf),
      sf: slimTies(ucl.ties.sf),
      final: slimTies(ucl.ties.final),
    },
    championTeamId: ucl.championTeamId,
    humanClubIds: state.uclHumanClubIds,
    lastScores: state.uclLastScores,
  };
}

export function buildMpLeagueLive(
  state: MpLeagueHostState,
  squads: Record<string, MpSquadInput>,
): MpLeagueLive {
  const byClub: Record<string, MpHumanLive> = {};
  for (const human of state.humans) {
    const hs = state.perHuman[human.clubId] ?? emptyHumanSeason();
    const nextFixture = state.fixtures.find(
      (f) =>
        f.round === state.round + 1 &&
        (f.homeTeamId === human.clubId || f.awayTeamId === human.clubId),
    );
    byClub[human.clubId] = {
      clubId: human.clubId,
      morale: hs.events.teamMorale,
      conditions: pickConditions(state.conditions, squads[human.clubId]),
      alerts: hs.alerts as InjuryAlertItem[],
      event: hs.events.activeEvent,
      resolution: hs.events.lastResolution,
      offers: hs.offers,
      attemptsLeft: hs.attemptsLeft,
      tradeNote: hs.tradeNote,
      h2h: hs.h2h,
      recent: hs.history.slice(-5),
      nextOpponentId: nextFixture
        ? nextFixture.homeTeamId === human.clubId
          ? nextFixture.awayTeamId
          : nextFixture.homeTeamId
        : null,
    };
  }

  return {
    rev: state.rev,
    seasonKey: state.seasonKey,
    stage: state.stage,
    flow: state.flow,
    draft: null,
    leagueId: state.settings.leagueId,
    uclEnabled: state.settings.uclEnabled,
    autoMs: state.settings.autoMs,
    round: state.round,
    totalRounds: state.totalRounds,
    humans: state.humans,
    clubs: state.clubs,
    standings: state.standings,
    lastRound: state.lastRound,
    cup: slimCup(state.cup),
    cupNews: state.cupNews,
    topScorers: topBy(state.allPlayerStats, 'goals'),
    topAssisters: topBy(state.allPlayerStats, 'assists'),
    byClub,
    h2h: state.h2hLive,
    ucl: buildUclLive(state),
    cast: state.cast,
    final: state.final,
    transferWindowIndex: state.transferWindowIndex,
    updatedAt: new Date().toISOString(),
  };
}

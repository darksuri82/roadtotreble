import { getPlayerFormerClubs } from '../data/formerClubs';
import { getStoryScenarioMeta } from '../data/story/storyRegistry';
import type { SeasonState } from '../types/game';
import type {
  Club,
  LeagueId,
  PlayerSeasonStats,
  StandingRow,
} from '../types/league';
import type { GoalkeeperAttributes, Player, PlayerAttributes } from '../types/player';
import type {
  StoryChecklistEvalItem,
  StoryChecklistSummary,
  StoryClubSeed,
  StoryCodexRecord,
  StoryCodexStorage,
  StoryModeRuntimeState,
  StoryPlayerSeed,
  StoryScenarioDataBundle,
  StoryTransferPoolClub,
  StoryUclR16Prepared,
} from '../types/storyMode';
import { getPlayerAttributes } from './attributeEngine';
import { didUserWinCup } from './cupEngine';
import { USER_CLUB_ID } from './matchEngine';
import { getUserRank } from './standingsEngine';
import { didUserWinUcl } from './uclEngine';

export const STORY_CODEX_STORAGE_KEY = 'rtt_story_mode_codex_v1';
export const STORY_ACTIVE_SAVE_KEY = 'rtt_story_mode_active_save_v1';

/**
 * Hydrates a compact JSON `StoryPlayerSeed` into a full immutable `Player`
 * compatible with all match, chemistry, attribute, transfer, and awakening engines.
 */
export function buildStoryPlayerFromSeed(
  seed: StoryPlayerSeed,
  clubName: string,
  leagueId: LeagueId | 'other',
): Player {
  const effectiveLeagueId: LeagueId = leagueId === 'other' ? 'epl' : leagueId;

  let explicitAttrs: PlayerAttributes | undefined;
  if (seed.f) {
    const [sho, pas, cro, dri, aer, defAttr, phy] = seed.f;
    const gkAttrs: GoalkeeperAttributes | undefined = seed.gk
      ? {
          div: seed.gk[0],
          han: seed.gk[1],
          ref: seed.gk[2],
          kic: seed.gk[3],
          pos: seed.gk[4],
        }
      : undefined;
    explicitAttrs = {
      sho,
      pas,
      cro,
      dri,
      aer,
      def: defAttr,
      phy,
      ...(gkAttrs ? { gk: gkAttrs } : {}),
    };
  }

  const baseStub: Player = {
    id: seed.id,
    name: seed.name,
    position: seed.pos,
    mainPositions: [...seed.main],
    secondaryPositions: seed.sec ? [...seed.sec] : [],
    ovr: seed.ovr,
    nationality: seed.nat,
    nationalityCode: seed.code,
    leagueId: effectiveLeagueId,
    club: clubName,
    att: seed.ovr,
    mid: seed.ovr,
    def: seed.ovr,
    stamina: seed.sta,
    playstyles: [...seed.styles],
    scoutNote: seed.note ?? `${clubName} 핵심 자원`,
    isLegend: false,
    ...(explicitAttrs ? { attrs: explicitAttrs } : {}),
  };

  const attrs = explicitAttrs ?? getPlayerAttributes(baseStub);
  let att: number;
  let mid: number;
  let def: number;
  if (seed.pos === 'GK' && attrs.gk) {
    att = Math.round(attrs.gk.kic * 0.65);
    mid = Math.round(attrs.gk.kic * 0.78);
    def = seed.ovr;
  } else if (seed.pos === 'FW') {
    att = Math.min(
      99,
      Math.round(seed.ovr * 0.65 + (attrs.sho * 0.55 + attrs.dri * 0.45) * 0.35),
    );
    mid = Math.round(attrs.pas * 0.5 + attrs.dri * 0.3 + attrs.cro * 0.2);
    def = Math.round(attrs.def * 0.75 + attrs.phy * 0.25);
  } else if (seed.pos === 'MF') {
    att = Math.round(attrs.sho * 0.45 + attrs.dri * 0.35 + attrs.pas * 0.2);
    mid = Math.min(
      99,
      Math.round(seed.ovr * 0.65 + (attrs.pas * 0.55 + attrs.dri * 0.45) * 0.35),
    );
    def = Math.round(attrs.def * 0.72 + attrs.phy * 0.28);
  } else {
    att = Math.round(attrs.sho * 0.35 + attrs.cro * 0.4 + attrs.dri * 0.25);
    mid = Math.round(attrs.pas * 0.55 + attrs.cro * 0.25 + attrs.phy * 0.2);
    def = Math.min(
      99,
      Math.round(
        seed.ovr * 0.65 +
          (attrs.def * 0.6 + attrs.aer * 0.2 + attrs.phy * 0.2) * 0.35,
      ),
    );
  }

  const playerWithRatings: Player = {
    ...baseStub,
    att,
    mid,
    def,
    attrs,
  };
  const formerClubs = getPlayerFormerClubs(playerWithRatings);
  return formerClubs.length > 0
    ? { ...playerWithRatings, formerClubs }
    : playerWithRatings;
}

function buildClubFromSeed(seed: StoryClubSeed, roster: Player[]): Club {
  const topScorersList = [...roster]
    .filter((p) => p.position === 'FW' || p.position === 'MF')
    .sort((a, b) => b.att - a.att || b.ovr - a.ovr)
    .slice(0, 3)
    .map((p) => p.name);
  const topScorers: [string, string, string] = [
    topScorersList[0] ?? roster[0]?.name ?? seed.shortName,
    topScorersList[1] ?? roster[1]?.name ?? seed.shortName,
    topScorersList[2] ?? roster[2]?.name ?? seed.shortName,
  ];
  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    primaryColor: seed.primaryColor,
    secondaryColor: seed.secondaryColor,
    pattern: seed.pattern ?? 'solid',
    formation: seed.formation,
    defaultTactic: seed.defaultTactic,
    att: seed.att,
    mid: seed.mid,
    def: seed.def,
    topScorers,
    manager: { ...seed.manager },
  };
}

export interface HydratedStoryScenario {
  meta: ReturnType<typeof getStoryScenarioMeta>;
  userClub: Club;
  userStarters: Player[];
  userBench: Player[];
  domesticClubs: Club[];
  domesticAiRosters: Record<string, Player[]>;
  transferPoolClubs: StoryTransferPoolClub[];
  uclR16Prepared: StoryUclR16Prepared | null;
  runtimeState: StoryModeRuntimeState;
}

/**
 * Hydrates a loaded dynamic `StoryScenarioDataBundle` into ready-to-play season objects,
 * 35-club 5-league direct scouting pool, and optional 16-team UCL R16 package.
 */
export function hydrateStoryScenarioBundle(
  bundle: StoryScenarioDataBundle,
): HydratedStoryScenario {
  const meta = getStoryScenarioMeta(bundle.scenarioId);

  const clubById = new Map<string, { club: Club; roster: Player[]; leagueId: LeagueId | 'other' }>();

  const domesticClubs: Club[] = [];
  const domesticAiRosters: Record<string, Player[]> = {};
  const transferPoolClubs: StoryTransferPoolClub[] = [];

  let userClub: Club | null = null;
  let userFullRoster: Player[] = [];

  for (const seed of bundle.domesticClubs) {
    const roster = seed.roster.map((p) =>
      buildStoryPlayerFromSeed(p, seed.name, seed.leagueId),
    );
    const club = buildClubFromSeed(seed, roster);
    clubById.set(seed.id, { club, roster, leagueId: seed.leagueId });

    if (seed.id === bundle.userClubId) {
      userClub = { ...club, id: USER_CLUB_ID, isUser: true };
      userFullRoster = roster;
      domesticClubs.push(userClub);
    } else {
      domesticClubs.push(club);
      domesticAiRosters[club.id] = roster;
      if (seed.leagueId !== 'other') {
        transferPoolClubs.push({
          club,
          leagueId: seed.leagueId,
          roster,
        });
      }
    }
  }

  if (!userClub) {
    throw new Error(`Story scenario user club not found: ${bundle.userClubId}`);
  }

  const userRosterMap = new Map(userFullRoster.map((p) => [p.id, p]));
  const userStarters: Player[] = bundle.userStarterIds
    .map((id) => userRosterMap.get(id))
    .filter((p): p is Player => Boolean(p));
  const userBench: Player[] = bundle.userBenchIds
    .map((id) => userRosterMap.get(id))
    .filter((p): p is Player => Boolean(p));

  // Hydrate foreign Top-4 clubs from the other 4 major European leagues
  for (const seed of bundle.foreignTop4Clubs) {
    const roster = seed.roster.map((p) =>
      buildStoryPlayerFromSeed(p, seed.name, seed.leagueId),
    );
    const club = buildClubFromSeed(seed, roster);
    clubById.set(seed.id, { club, roster, leagueId: seed.leagueId });
    if (seed.leagueId !== 'other') {
      transferPoolClubs.push({
        club,
        leagueId: seed.leagueId,
        roster,
      });
    }
  }

  // Hydrate non-Top-5 UCL R16 extra clubs (e.g. Celtic, Porto, Fenerbahce, Olympiacos)
  for (const seed of bundle.uclR16ExtraClubs ?? []) {
    const roster = seed.roster.map((p) =>
      buildStoryPlayerFromSeed(p, seed.name, seed.leagueId),
    );
    const club = buildClubFromSeed(seed, roster);
    clubById.set(seed.id, { club, roster, leagueId: seed.leagueId });
  }

  // Prepare 16-team direct UCL R16 package if scenario includes UCL
  let uclR16Prepared: StoryUclR16Prepared | null = null;
  if (meta.hasUcl && bundle.uclR16) {
    const uclClubs: Club[] = [];
    const uclAiRosters: Record<string, Player[]> = {};
    const seenIds = new Set<string>();

    const remappedPairings: [string, string][] = bundle.uclR16.pairings.map(
      ([a, b]) => [
        a === bundle.userClubId ? USER_CLUB_ID : a,
        b === bundle.userClubId ? USER_CLUB_ID : b,
      ],
    );

    const remappedOrigins: Record<string, string> = {};
    for (const [cid, label] of Object.entries(bundle.uclR16.originLabels)) {
      remappedOrigins[cid === bundle.userClubId ? USER_CLUB_ID : cid] = label;
    }

    for (const [rawA, rawB] of bundle.uclR16.pairings) {
      for (const rawId of [rawA, rawB]) {
        const mappedId = rawId === bundle.userClubId ? USER_CLUB_ID : rawId;
        if (seenIds.has(mappedId)) continue;
        seenIds.add(mappedId);
        if (mappedId === USER_CLUB_ID) {
          uclClubs.push(userClub);
        } else {
          const found = clubById.get(rawId);
          if (found) {
            uclClubs.push(found.club);
            uclAiRosters[found.club.id] = found.roster;
          }
        }
      }
    }

    uclR16Prepared = {
      seasonLabel: bundle.uclR16.seasonLabel,
      clubs: uclClubs,
      aiRosters: uclAiRosters,
      pairings: remappedPairings,
      originLabels: remappedOrigins,
    };
  }

  const runtimeState: StoryModeRuntimeState = {
    scenarioId: meta.id,
    seasonLabel: meta.seasonLabel,
    title: meta.title,
    hasUcl: meta.hasUcl,
    uclLabel: meta.uclLabel,
    transferRule: meta.transferRule,
    transferRuleLabel: meta.transferRuleLabel,
    transferRuleReason: meta.transferRuleReason,
    winterMaxSignings: meta.winterMaxSignings,
    allowUclTransferWindow: meta.allowUclTransferWindow ?? meta.hasUcl,
    signingsThisWindow: 0,
    initialCashBudgetM: meta.cashBudgetM,
    transferPoolClubs,
    uclR16Prepared,
    bigMatchClubIds: [...bundle.bigMatchClubIds],
    missionKeyPlayerIds: [...bundle.missionKeyPlayerIds],
    awakeningFocusPlayerIds: [...bundle.awakeningFocusPlayerIds],
    missionTargets: { ...bundle.missionTargets },
    codexRecorded: false,
  };

  return {
    meta,
    userClub,
    userStarters,
    userBench,
    domesticClubs,
    domesticAiRosters,
    transferPoolClubs,
    uclR16Prepared,
    runtimeState,
  };
}

// =============================================================================
// 3-Star Checklist Live & Final Evaluator (All 5 Scenarios)
// =============================================================================

function getCombinedGoalContributions(
  playerId: string,
  leagueStats: Record<string, PlayerSeasonStats>,
  cupStats: Record<string, PlayerSeasonStats>,
  uclStats: Record<string, PlayerSeasonStats>,
): { goals: number; assists: number; total: number } {
  const ls = leagueStats[playerId];
  const cs = cupStats[playerId];
  const us = uclStats[playerId];
  const goals = (ls?.goals ?? 0) + (cs?.goals ?? 0) + (us?.goals ?? 0);
  const assists = (ls?.assists ?? 0) + (cs?.assists ?? 0) + (us?.assists ?? 0);
  return { goals, assists, total: goals + assists };
}

function getMinLeagueGoalsAgainst(standings: StandingRow[]): number {
  if (standings.length === 0) return 999;
  return Math.min(...standings.map((r) => r.goalsAgainst));
}

export function evaluateStoryChecklist(params: {
  storyMode: StoryModeRuntimeState;
  season: SeasonState;
  starters: (Player | null)[];
  bench: (Player | null)[];
}): StoryChecklistSummary {
  const { storyMode, season, starters, bench } = params;
  const meta = getStoryScenarioMeta(storyMode.scenarioId);
  const leagueFinished = season.currentRound >= season.totalRounds;
  const userRank = getUserRank(season.standings, USER_CLUB_ID);
  const userRow = season.standings.find((r) => r.teamId === USER_CLUB_ID);
  const wonLeague = leagueFinished && userRank === 1;
  const wonCup = didUserWinCup(season.cup, USER_CLUB_ID);
  const cupFinished = Boolean(season.cup?.completed);
  const cupUserEliminated =
    Boolean(season.cup?.userEliminatedAt) || (cupFinished && !wonCup);
  const wonUcl = didUserWinUcl(season.ucl, USER_CLUB_ID);
  const uclFinished = Boolean(season.ucl?.completed);
  const uclUserEliminated =
    Boolean(season.ucl?.userEliminatedAt) || (uclFinished && !wonUcl);

  const awakenedMap = season.awakenedPlayers ?? {};
  const allUserPlayers = [...starters, ...bench].filter(
    (p): p is Player => p !== null,
  );
  const isPlayerAwakened = (id: string): boolean =>
    Boolean(
      awakenedMap[id] ||
        allUserPlayers.find((p) => p.id === id)?.awakening,
    );

  const remainingLeagueMatches = Math.max(
    0,
    season.totalRounds - season.currentRound,
  );
  const maxPossiblePoints = (userRow?.points ?? 0) + remainingLeagueMatches * 3;
  const leaderPoints = season.standings[0]?.points ?? 0;
  const cannotWinLeague =
    leagueFinished ? !wonLeague : maxPossiblePoints < leaderPoints;

  const items: StoryChecklistEvalItem[] = [];
  const defs = meta.checklist;

  if (storyMode.scenarioId === '1516_leicester') {
    // 1) EPL Title
    items.push({
      ...defs[0],
      status: wonLeague
        ? 'achieved'
        : cannotWinLeague
          ? 'failed'
          : 'in_progress',
      progressText: wonLeague
        ? `우승 확정 (${userRow?.points ?? 0}점)`
        : `현재 ${userRank}위 · ${userRow?.points ?? 0}점 (${season.currentRound}/${season.totalRounds}R)`,
    });

    // 2) Vardy/Mahrez/Kante >=1 awakening AND Vardy league 20+ goals
    const trioIds = storyMode.missionTargets.leicesterTrioIds ?? [];
    const vardyId = storyMode.missionTargets.vardyId ?? '';
    const awakenedCount = trioIds.filter(isPlayerAwakened).length;
    const vardyGoals = season.allPlayerStats[vardyId]?.goals ?? 0;
    const star2Ok = awakenedCount >= 1 && vardyGoals >= 20;
    items.push({
      ...defs[1],
      status: star2Ok
        ? 'achieved'
        : leagueFinished
          ? 'failed'
          : 'in_progress',
      progressText: `3인방 각성 ${awakenedCount}/1 · 바디 리그 ${vardyGoals}/20골`,
    });

    // 3) FA Cup Double OR League 85+ points
    const pts = userRow?.points ?? 0;
    const star3Ok = (wonLeague && wonCup) || pts >= 85;
    const canReach85 = maxPossiblePoints >= 85;
    const canDouble = !cannotWinLeague && !cupUserEliminated;
    items.push({
      ...defs[2],
      status: star3Ok
        ? 'achieved'
        : !canReach85 && !canDouble
          ? 'failed'
          : 'in_progress',
      progressText:
        wonLeague && wonCup
          ? 'EPL·FA컵 더블 달성!'
          : pts >= 85
            ? `리그 승점 ${pts}점 (85+ 달성)`
            : `승점 ${pts}/85 · FA컵 ${wonCup ? '우승' : cupUserEliminated ? '탈락' : '진행 중'}`,
    });
  } else if (storyMode.scenarioId === '0708_manutd') {
    // 1) League + UCL Double
    const star1Ok = wonLeague && wonUcl;
    const star1Failed = cannotWinLeague || uclUserEliminated;
    items.push({
      ...defs[0],
      status: star1Ok
        ? 'achieved'
        : star1Failed
          ? 'failed'
          : 'in_progress',
      progressText: `EPL ${wonLeague ? '우승' : `${userRank}위`} · UCL ${wonUcl ? '우승' : uclUserEliminated ? '탈락' : season.ucl ? '토너먼트 진행' : '16강 대기'}`,
    });

    // 2) Park Ji-sung Awakening + All-competition 15+ G+A
    const parkId = storyMode.missionTargets.parkId ?? '';
    const parkAwakened = isPlayerAwakened(parkId);
    const parkContrib = getCombinedGoalContributions(
      parkId,
      season.allPlayerStats,
      season.cupPlayerStats,
      season.uclPlayerStats,
    );
    const star2Ok = parkAwakened && parkContrib.total >= 15;
    const seasonTotallyDone = leagueFinished && (!storyMode.hasUcl || uclFinished);
    items.push({
      ...defs[1],
      status: star2Ok
        ? 'achieved'
        : seasonTotallyDone
          ? 'failed'
          : 'in_progress',
      progressText: `박지성 각성 ${parkAwakened ? '완료' : '미달성'} · 공격P ${parkContrib.total}/15 (${parkContrib.goals}골 ${parkContrib.assists}도움)`,
    });

    // 3) Park Ji-sung selected to World Best XI (globalAwards.worldBestXi)
    const worldBestXi = season.globalAwards?.worldBestXi ?? null;
    const parkLeagueSt = season.allPlayerStats[parkId];
    const parkAvgRating = parkLeagueSt?.avgRating ?? 0;
    let star3Status: StoryChecklistEvalItem['status'] = 'in_progress';
    let star3Text =
      parkAvgRating > 0
        ? `시즌 진행 중 (박지성 평균 평점 ${parkAvgRating.toFixed(2)} · 공격P ${parkContrib.total})`
        : '월드 베스트 XI 결산 대기 중';

    if (worldBestXi && worldBestXi.length > 0) {
      const inWorldBestXi = worldBestXi.some(
        (entry) => entry.stats.playerId === parkId,
      );
      if (inWorldBestXi) {
        star3Status = 'achieved';
        star3Text = `박지성 월드 베스트 XI 선정 달성! (공격P ${parkContrib.total})`;
      } else {
        star3Status = 'failed';
        star3Text = `월드 베스트 XI 미선정 (평균 평점 ${parkAvgRating.toFixed(2)} · 공격P ${parkContrib.total})`;
      }
    }

    items.push({
      ...defs[2],
      status: star3Status,
      progressText: star3Text,
    });
  } else if (storyMode.scenarioId === '1819_tottenham') {
    // 1) EPL Title
    items.push({
      ...defs[0],
      status: wonLeague
        ? 'achieved'
        : cannotWinLeague
          ? 'failed'
          : 'in_progress',
      progressText: wonLeague
        ? `우승 확정 (${userRow?.points ?? 0}점)`
        : `현재 ${userRank}위 · ${userRow?.points ?? 0}점`,
    });

    // 2) DESK combined league G+A >= 60
    const deskIds = storyMode.missionTargets.deskIds ?? [];
    const deskTotal = deskIds.reduce((sum, id) => {
      const s = season.allPlayerStats[id];
      return sum + (s?.goals ?? 0) + (s?.assists ?? 0);
    }, 0);
    items.push({
      ...defs[1],
      status:
        deskTotal >= 60
          ? 'achieved'
          : leagueFinished
            ? 'failed'
            : 'in_progress',
      progressText: `DESK 리그 공격P ${deskTotal}/60`,
    });

    // 3) 18-19 UCL + (EPL or FA Cup) Double/Treble
    const star3Ok = wonUcl && (wonLeague || wonCup);
    const cannotDouble = uclUserEliminated || (cannotWinLeague && cupUserEliminated);
    items.push({
      ...defs[2],
      status: star3Ok
        ? 'achieved'
        : cannotDouble
          ? 'failed'
          : 'in_progress',
      progressText: `UCL ${wonUcl ? '우승' : uclUserEliminated ? '탈락' : '진행/대기'} · 국내 ${wonLeague || wonCup ? '트로피 확보' : '도전 중'}`,
    });
  } else if (storyMode.scenarioId === '0304_arsenal') {
    const losses = userRow?.lost ?? 0;
    const unbeatenLeagueTitle = wonLeague && losses === 0;
    items.push({
      ...defs[0],
      status: wonLeague
        ? 'achieved'
        : cannotWinLeague
          ? 'failed'
          : 'in_progress',
      progressText: wonLeague
        ? `우승 확정 (${userRow?.points ?? 0}점)`
        : `현재 ${userRank}위 · ${userRow?.points ?? 0}점`,
    });
    items.push({
      ...defs[1],
      status: unbeatenLeagueTitle
        ? 'achieved'
        : losses > 0 || cannotWinLeague
          ? 'failed'
          : 'in_progress',
      progressText:
        losses === 0
          ? `무패 행진 중 (${userRow?.won ?? 0}승 ${userRow?.drawn ?? 0}무 0패)`
          : `${losses}패 기록 (무패 실패)`,
    });
    items.push({
      ...defs[2],
      status:
        unbeatenLeagueTitle && wonUcl
          ? 'achieved'
          : losses > 0 || cannotWinLeague || uclUserEliminated
            ? 'failed'
            : 'in_progress',
      progressText: `리그 ${losses}패 · UCL ${wonUcl ? '우승' : uclUserEliminated ? '탈락' : '진행/대기'}`,
    });
  } else if (storyMode.scenarioId === '2324_leverkusen') {
    // 1) Bundesliga Title
    items.push({
      ...defs[0],
      status: wonLeague
        ? 'achieved'
        : cannotWinLeague
          ? 'failed'
          : 'in_progress',
      progressText: wonLeague
        ? `분데스리가 우승 (${userRow?.points ?? 0}점)`
        : `현재 ${userRank}위 · ${userRow?.points ?? 0}점 (${season.currentRound}/${season.totalRounds}R)`,
    });

    // 2) Wirtz / Grimaldo / Boniface >= 1 Awakening AND Wirtz league G+A >= 18
    const levTrioIds = storyMode.missionTargets.leverkusenTrioIds ?? [];
    const wirtzId = storyMode.missionTargets.wirtzId ?? '';
    const levAwakenedCount = levTrioIds.filter(isPlayerAwakened).length;
    const wirtzStat = season.allPlayerStats[wirtzId];
    const wirtzGa = (wirtzStat?.goals ?? 0) + (wirtzStat?.assists ?? 0);
    const star2Ok = levAwakenedCount >= 1 && wirtzGa >= 18;
    items.push({
      ...defs[1],
      status: star2Ok
        ? 'achieved'
        : leagueFinished
          ? 'failed'
          : 'in_progress',
      progressText: `핵심 3인방 각성 ${levAwakenedCount}/1 · 비르츠 리그 공격P ${wirtzGa}/18`,
    });

    // 3) Unbeaten Bundesliga Title OR Bundesliga + DFB-Pokal Double
    const losses = userRow?.lost ?? 0;
    const unbeatenLeague = wonLeague && losses === 0;
    const domesticDouble = wonLeague && wonCup;
    const star3Ok = unbeatenLeague || domesticDouble;
    const cannotUnbeaten = losses > 0 || cannotWinLeague;
    const cannotDouble = cannotWinLeague || cupUserEliminated;
    items.push({
      ...defs[2],
      status: star3Ok
        ? 'achieved'
        : cannotUnbeaten && cannotDouble
          ? 'failed'
          : 'in_progress',
      progressText: unbeatenLeague
        ? '분데스리가 34경기 무패 우승 달성!'
        : domesticDouble
          ? '분데스리가 · DFB-포칼 더블 달성!'
          : `리그 ${losses}패 · 포칼 ${wonCup ? '우승' : cupUserEliminated ? '탈락' : '진행 중'}`,
    });
  } else if (storyMode.scenarioId === '0910_inter') {
    // 1) Serie A Title
    items.push({
      ...defs[0],
      status: wonLeague
        ? 'achieved'
        : cannotWinLeague
          ? 'failed'
          : 'in_progress',
      progressText: wonLeague
        ? `세리에 A 우승 (${userRow?.points ?? 0}점)`
        : `현재 ${userRank}위 · ${userRow?.points ?? 0}점 (${season.currentRound}/${season.totalRounds}R)`,
    });

    // 2) Milito / Sneijder / Eto'o combined league G+A >= 45 AND >= 1 Awakening (or Milito 18+ goals)
    const interTrioIds = storyMode.missionTargets.interTrioIds ?? [];
    const militoId = storyMode.missionTargets.militoId ?? '';
    const trioGa = interTrioIds.reduce((sum, id) => {
      const s = season.allPlayerStats[id];
      return sum + (s?.goals ?? 0) + (s?.assists ?? 0);
    }, 0);
    const militoGoals = season.allPlayerStats[militoId]?.goals ?? 0;
    const star2Ok = trioGa >= 45 && militoGoals >= 18;
    items.push({
      ...defs[1],
      status: star2Ok
        ? 'achieved'
        : leagueFinished
          ? 'failed'
          : 'in_progress',
      progressText: `트리오 리그 공격P ${trioGa}/45 · 밀리토 ${militoGoals}/18골`,
    });

    // 3) Historic Italian Treble (Serie A + Coppa Italia + 09-10 UCL)
    const trebleOk = wonLeague && wonCup && wonUcl;
    const cannotTreble = cannotWinLeague || cupUserEliminated || uclUserEliminated;
    items.push({
      ...defs[2],
      status: trebleOk
        ? 'achieved'
        : cannotTreble
          ? 'failed'
          : 'in_progress',
      progressText: `리그 ${wonLeague ? '우승' : `${userRank}위`} · 코파 ${wonCup ? '우승' : cupUserEliminated ? '탈락' : '진행 중'} · UCL ${wonUcl ? '우승' : uclUserEliminated ? '탈락' : '진행/대기'}`,
    });
  } else {
    // 1314_atletico
    const ga = userRow?.goalsAgainst ?? 0;
    const minGa = getMinLeagueGoalsAgainst(season.standings);
    const isBestDefense = ga <= 28 && ga <= minGa;
    items.push({
      ...defs[0],
      status: wonLeague
        ? 'achieved'
        : cannotWinLeague
          ? 'failed'
          : 'in_progress',
      progressText: wonLeague
        ? `라리가 우승 (${userRow?.points ?? 0}점)`
        : `현재 ${userRank}위 · ${userRow?.points ?? 0}점`,
    });
    items.push({
      ...defs[1],
      status:
        leagueFinished && isBestDefense
          ? 'achieved'
          : ga > 28 || leagueFinished
            ? 'failed'
            : 'in_progress',
      progressText: `실점 ${ga}/28 (리그 최소 ${minGa}실점)`,
    });
    items.push({
      ...defs[2],
      status:
        wonLeague && wonUcl
          ? 'achieved'
          : cannotWinLeague || uclUserEliminated
            ? 'failed'
            : 'in_progress',
      progressText: `라리가 ${wonLeague ? '우승' : `${userRank}위`} · UCL ${wonUcl ? '우승' : uclUserEliminated ? '탈락' : '진행/대기'}`,
    });
  }

  const starsEarned = items.filter((i) => i.status === 'achieved').length;
  return {
    scenarioId: storyMode.scenarioId,
    items,
    starsEarned,
    isAllClear: starsEarned === 3,
  };
}

// =============================================================================
// Story Mode Codex & Isolated Active Save Storage
// =============================================================================

export function createEmptyStoryCodex(): StoryCodexStorage {
  return { version: 1, records: {} };
}

export function loadStoryCodex(): StoryCodexStorage {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createEmptyStoryCodex();
    }
    const raw = window.localStorage.getItem(STORY_CODEX_STORAGE_KEY);
    if (!raw) return createEmptyStoryCodex();
    const parsed = JSON.parse(raw) as StoryCodexStorage;
    if (parsed && parsed.version === 1 && parsed.records) {
      return parsed;
    }
    return createEmptyStoryCodex();
  } catch {
    return createEmptyStoryCodex();
  }
}

export function saveStoryCodex(codex: StoryCodexStorage): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORY_CODEX_STORAGE_KEY, JSON.stringify(codex));
  } catch {
    // ignore quota errors
  }
}

export function recordStoryCompletionInCodex(params: {
  codex: StoryCodexStorage;
  summary: StoryChecklistSummary;
  bestSummaryText: string;
}): { nextCodex: StoryCodexStorage; isNewBest: boolean } {
  const { codex, summary, bestSummaryText } = params;
  const prev = codex.records[summary.scenarioId];
  const prevBestStars = prev?.bestStars ?? 0;
  const achievedNow = summary.items
    .filter((i) => i.status === 'achieved')
    .map((i) => i.id);
  const mergedIds = Array.from(
    new Set([...(prev?.achievedChecklistIds ?? []), ...achievedNow]),
  );
  const isNewBest = summary.starsEarned > prevBestStars || !prev;

  const nextRecord: StoryCodexRecord = {
    scenarioId: summary.scenarioId,
    bestStars: Math.max(prevBestStars, summary.starsEarned),
    achievedChecklistIds: mergedIds,
    clearCount: (prev?.clearCount ?? 0) + (summary.starsEarned >= 1 ? 1 : 0),
    attempts: (prev?.attempts ?? 0) + 1,
    bestSummaryText:
      summary.starsEarned >= prevBestStars
        ? bestSummaryText
        : (prev?.bestSummaryText ?? bestSummaryText),
    lastPlayedAt: new Date().toISOString(),
  };

  const nextCodex: StoryCodexStorage = {
    version: 1,
    records: {
      ...codex.records,
      [summary.scenarioId]: nextRecord,
    },
  };
  saveStoryCodex(nextCodex);
  return { nextCodex, isNewBest };
}

export function getTotalStoryStars(codex: StoryCodexStorage): number {
  return Object.values(codex.records).reduce(
    (sum, rec) => sum + (rec?.bestStars ?? 0),
    0,
  );
}

export function hasActiveStorySave(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(STORY_ACTIVE_SAVE_KEY);
    return Boolean(raw && raw.length > 20);
  } catch {
    return false;
  }
}

export function clearActiveStorySave(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(STORY_ACTIVE_SAVE_KEY);
  } catch {
    // ignore
  }
}

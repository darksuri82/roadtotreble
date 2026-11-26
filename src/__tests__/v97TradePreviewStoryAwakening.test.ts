import { describe, expect, it } from 'vitest';
import { WHATS_NEW_HIGHLIGHT_RANGE } from '../components/common/WhatsNewModal';
import { FORMATIONS } from '../data/formations';
import { CURRENT_APP_VERSION, PATCH_NOTES } from '../data/patchNotes';
import {
  AWAKENING_OVR_HARD_CAP,
  AWAKENING_SUPERSTAR_MAX_GAIN,
  AWAKENING_SUPERSTAR_RATE_MULT,
  computeAwakeningCandidateProbability,
  evaluatePostMatchAwakening,
  getAwakeningMinMatchRating,
  getAwakeningTierRateMultiplier,
  rollAwakeningOvrGain,
} from '../engine/awakeningEngine';
import { computeTradeSwapPreview } from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS, LEGEND_PLAYERS } from '../engine/dataLoader';
import { USER_CLUB_ID } from '../engine/matchEngine';
import {
  generateCompactTeamIntro,
  generateSoloSeasonTeamStory,
} from '../engine/teamStoryEngine';
import type {
  Club,
  Fixture,
  MatchResult,
  PlayerSeasonStats,
  StandingRow,
} from '../types/league';
import type { Player } from '../types/player';

function buildFittedSquad(formationId: '4-3-3' | '3-2-4-1' = '4-3-3'): {
  starters: Player[];
  bench: Player[];
} {
  const slots = FORMATIONS[formationId].slots;
  const used = new Set<string>();
  const starters: Player[] = slots.map((slot) => {
    const match =
      ACTIVE_PLAYERS.find(
        (p) =>
          !used.has(p.id) &&
          p.ovr >= 78 &&
          p.ovr <= 85 &&
          p.mainPositions.includes(slot.subPosition),
      ) ??
      ACTIVE_PLAYERS.find(
        (p) => !used.has(p.id) && p.position === slot.position,
      )!;
    used.add(match.id);
    return match;
  });
  const bench = ACTIVE_PLAYERS.filter((p) => !used.has(p.id)).slice(0, 5);
  return { starters, bench };
}

function makeStats(
  p: Player,
  overrides: Partial<PlayerSeasonStats> = {},
): PlayerSeasonStats {
  return {
    playerId: p.id,
    playerName: p.name,
    teamId: USER_CLUB_ID,
    teamName: 'FC 회고',
    teamShortName: 'DOC',
    teamPrimaryColor: '#10b981',
    teamSecondaryColor: '#0f172a',
    isUserTeam: true,
    position: p.position,
    mainPositions: [...p.mainPositions],
    ovr: p.ovr,
    appearances: 30,
    starts: 28,
    subAppearances: 2,
    minutesPlayed: 2520,
    goals: 4,
    assists: 4,
    xgSum: 3.8,
    cleanSheets: 10,
    momCount: 2,
    ratingSum: 216,
    avgRating: 7.2,
    positionCounts: {},
    isLegend: p.isLegend,
    ...overrides,
  };
}

describe('v9.7.0 Trade Virtual Swap Preview, Diverse Team Intros, Crisis/Rebound Storytelling & Awakening Calibration', () => {
  it('1) computes live Before -> After trade swap preview deltas without mutating squad arrays and prioritizes starter slots for primary targets', () => {
    const { starters, bench } = buildFittedSquad('4-3-3');
    const origStarterIds = starters.map((p) => p.id);
    const origBenchIds = bench.map((p) => p.id);

    // Pick a strong ST incoming target to replace our ST slot (index 9 in 4-3-3)
    const stSlotIdx = FORMATIONS['4-3-3'].slots.findIndex(
      (s) => s.subPosition === 'ST',
    );
    expect(stSlotIdx).toBeGreaterThanOrEqual(0);
    const usedIds = new Set([...origStarterIds, ...origBenchIds]);
    const starStriker = ACTIVE_PLAYERS.find(
      (p) =>
        !usedIds.has(p.id) &&
        p.mainPositions.includes('ST') &&
        p.ovr >= 88,
    )!;
    const fillerPlayer = ACTIVE_PLAYERS.find(
      (p) =>
        !usedIds.has(p.id) &&
        p.id !== starStriker.id &&
        p.ovr <= 79 &&
        p.position !== 'GK',
    )!;

    // Inactive preview when either side is empty
    const inactive = computeTradeSwapPreview({
      formationId: '4-3-3',
      starters,
      bench,
      outSlots: [{ area: 'starter', index: stSlotIdx }],
      inItems: [],
      tactic: 'possession',
      managerTraitId: 'tiki_taka',
      cashBeforeM: 120,
      cashOfferM: 30,
    });
    expect(inactive.isActive).toBe(false);
    expect(inactive.chemDelta).toBe(0);
    expect(inactive.ovrDelta).toBe(0);
    expect(inactive.cashAfterM).toBe(90);

    // 1:1 starter swap preview
    const preview1v1 = computeTradeSwapPreview({
      formationId: '4-3-3',
      starters,
      bench,
      outSlots: [{ area: 'starter', index: stSlotIdx }],
      inItems: [{ player: starStriker, isFiller: false }],
      tactic: 'possession',
      managerTraitId: 'tiki_taka',
      cashBeforeM: 120,
      cashOfferM: 35,
    });

    expect(preview1v1.isActive).toBe(true);
    expect(preview1v1.previewStarters[stSlotIdx]?.id).toBe(starStriker.id);
    expect(preview1v1.previewSlotKeys.has(`starter:${stSlotIdx}`)).toBe(true);
    expect(preview1v1.swapPairs).toHaveLength(1);
    expect(preview1v1.swapPairs[0].inPlayer.id).toBe(starStriker.id);
    expect(preview1v1.swapPairs[0].outPlayer.id).toBe(starters[stSlotIdx].id);
    expect(preview1v1.swapPairs[0].inPositionFit?.penalty).toBe(0);
    expect(preview1v1.attDelta).toBeGreaterThanOrEqual(0);
    expect(preview1v1.cashBeforeM).toBe(120);
    expect(preview1v1.cashAfterM).toBe(85);
    expect(preview1v1.cashDeltaM).toBe(-35);
    expect(preview1v1.chemDelta).toBe(
      preview1v1.afterChemistry.total - preview1v1.beforeChemistry.total,
    );
    expect(preview1v1.totalLinesDelta).toBe(
      preview1v1.totalLinesAfter - preview1v1.totalLinesBefore,
    );
    expect(preview1v1.managerFitDelta).toBe(
      preview1v1.managerFitAfter - preview1v1.managerFitBefore,
    );

    // Asymmetric 2:1 explicit preview (2 outgoing slots + 1 clicked target, no auto-filler):
    // starStriker must land in the starter ST slot, NOT blindly bench:0
    const preview2to1Explicit = computeTradeSwapPreview({
      formationId: '4-3-3',
      starters,
      bench,
      outSlots: [
        { area: 'bench', index: 0 },
        { area: 'starter', index: stSlotIdx },
      ],
      inItems: [{ player: starStriker, isFiller: false }],
      tactic: 'possession',
      managerTraitId: 'tiki_taka',
    });
    expect(preview2to1Explicit.isActive).toBe(true);
    expect(preview2to1Explicit.swapPairs).toHaveLength(1);
    expect(preview2to1Explicit.previewStarters[stSlotIdx]?.id).toBe(
      starStriker.id,
    );
    expect(preview2to1Explicit.previewBench[0]?.id).toBe(bench[0].id);

    // 2:2 swap: primary target MUST land in starter slot, second piece in bench slot
    const preview2v2 = computeTradeSwapPreview({
      formationId: '4-3-3',
      starters,
      bench,
      outSlots: [
        { area: 'bench', index: 0 },
        { area: 'starter', index: stSlotIdx },
      ],
      inItems: [
        { player: fillerPlayer, isFiller: true },
        { player: starStriker, isFiller: false },
      ],
      tactic: 'possession',
      managerTraitId: 'tiki_taka',
    });
    expect(preview2v2.isActive).toBe(true);
    expect(preview2v2.previewStarters[stSlotIdx]?.id).toBe(starStriker.id);
    expect(preview2v2.previewBench[0]?.id).toBe(fillerPlayer.id);
    expect(preview2v2.previewSlotKeys.size).toBe(2);

    // Original arrays remain completely untouched
    expect(starters.map((p) => p.id)).toEqual(origStarterIds);
    expect(bench.map((p) => p.id)).toEqual(origBenchIds);
  });

  it('2) generates diverse compact team intros including player-name-free tactical identity, duo/trio axes, and distinct season archetypes', () => {
    // Pure player-name-free tactical/manager/coach/rotation identity
    const tacticalOnlyIntro = generateCompactTeamIntro({
      clubName: 'FC 시스템',
      managerName: '최전술',
      managerTraitId: 'tiki_taka',
      staffCoachId: 'tactic_possession',
      formation: '3-2-4-1',
      tactic: 'possession',
      baseAvgOvr: 84.0,
      effectiveOvr: 87.2,
      chemistry: 95,
      leagueName: '프리미어리그',
      finalRank: 1,
      leaguePoints: 89,
      leaguePlayed: 38,
      goalsFor: 76,
      goalsAgainst: 32,
      rotationBenchContributors: 4,
      managerSynergyCount: 9,
      // Explicitly no star/ace/awakened/classic names needed
    });
    expect(tacticalOnlyIntro.length).toBeGreaterThan(35);
    expect(tacticalOnlyIntro).not.toContain('undefined');

    // Duo/Trio spine focus
    const duoIntro = generateCompactTeamIntro({
      clubName: 'FC 쌍포',
      managerTraitId: 'gegenpress_guru',
      formation: '4-3-3',
      tactic: 'gegenpressing',
      baseAvgOvr: 84.5,
      effectiveOvr: 85.4,
      chemistry: 76,
      leagueName: '분데스리가',
      finalRank: 2,
      leaguePoints: 74,
      leaguePlayed: 34,
      goalsFor: 68,
      goalsAgainst: 34,
      attackDuoNames: ['해리 케인', '자말 무시알라'],
      midfieldAxisNames: ['요주아 키미히', '알렉산다르 파블로비치'],
      trioNames: ['해리 케인', '자말 무시알라', '요주아 키미히'],
    });
    expect(
      duoIntro.includes('케인') ||
        duoIntro.includes('무시알라') ||
        duoIntro.includes('키미히'),
    ).toBe(true);

    // Awakening corps focus
    const awakeningIntro = generateCompactTeamIntro({
      clubName: 'FC 원석',
      managerTraitId: 'midfield_maestro',
      staffCoachId: 'sys_potential_dev',
      formation: '4-2-3-1',
      tactic: 'balanced',
      baseAvgOvr: 80.5,
      effectiveOvr: 84.0,
      chemistry: 88,
      awakenedCount: 3,
      awakenedNames: ['엘리엇 앤더슨', '파블로비치', '페르브뤼헌'],
      leagueName: '프리미어리그',
      finalRank: 2,
      leaguePoints: 82,
      leaguePlayed: 38,
    });
    expect(awakeningIntro).toContain('각성');

    // FFP defiance focus
    const ffpIntro = generateCompactTeamIntro({
      clubName: 'FC 돌파',
      managerTraitId: 'big_game_hunter',
      formation: '4-3-3',
      tactic: 'counter',
      baseAvgOvr: 86.2,
      effectiveOvr: 87.0,
      chemistry: 74,
      ffpTier: 2,
      leagueName: '라리가',
      finalRank: 1,
      leaguePoints: 88,
      leaguePlayed: 38,
      cupWon: true,
      cupName: '코파 델 레이',
    });
    expect(ffpIntro.length).toBeGreaterThan(35);

    // Diversity sweep across 10 varied seasons -> high uniqueness (zero clone repetition)
    const variants = [
      tacticalOnlyIntro,
      duoIntro,
      awakeningIntro,
      ffpIntro,
      generateCompactTeamIntro({
        clubName: 'FC 철벽',
        managerTraitId: 'defensive_architect',
        formation: '3-5-2',
        tactic: 'counter',
        baseAvgOvr: 83.2,
        chemistry: 89,
        leagueName: '세리에 A',
        finalRank: 1,
        leaguePoints: 91,
        leaguePlayed: 38,
        goalsFor: 62,
        goalsAgainst: 19,
        defenseLineNames: ['알레산드로 바스토니', '글레이송 브레메르'],
      }),
      generateCompactTeamIntro({
        clubName: 'FC 화력',
        managerTraitId: 'wing_bomber',
        formation: '4-3-3',
        tactic: 'wingplay',
        baseAvgOvr: 85.0,
        chemistry: 82,
        leagueName: '리그 1',
        finalRank: 1,
        leaguePoints: 84,
        leaguePlayed: 34,
        goalsFor: 92,
        goalsAgainst: 33,
        attackDuoNames: ['킬리안 음바페', '우슴만 뎀벨레'],
      }),
      generateCompactTeamIntro({
        clubName: 'FC 반란',
        managerTraitId: 'underdog_killer',
        formation: '4-4-2',
        tactic: 'counter',
        baseAvgOvr: 79.4,
        effectiveOvr: 83.2,
        chemistry: 90,
        leagueName: '프리미어리그',
        finalRank: 2,
        expectedRank: 11,
        leaguePoints: 80,
        leaguePlayed: 38,
      }),
      generateCompactTeamIntro({
        clubName: 'FC 신구조화',
        managerTraitId: 'galactico_manager',
        formation: '4-3-3',
        tactic: 'possession',
        baseAvgOvr: 86.0,
        chemistry: 86,
        classicCount: 2,
        classicNames: ['지네딘 지단 (00s)', '파올로 말디니 (90s)'],
        leagueName: '세리에 A',
        finalRank: 1,
        leaguePoints: 87,
        leaguePlayed: 38,
      }),
    ];
    expect(new Set(variants).size).toBe(variants.length);
  });

  it('3) extracts adversity (slump, blown lead/heavy loss, injury, tactical counter, rank drop, early cup/UCL heartbreak) and weaves rebound documentary story', () => {
    const { starters, bench } = buildFittedSquad('4-3-3');
    const awakenedStarter: Player = {
      ...starters[6],
      ovr: starters[6].ovr + 5,
      awakening: {
        originalOvr: starters[6].ovr,
        ovrGain: 5,
        round: 21,
        competition: 'league',
        statDeltas: [{ key: 'pas', label: '패스', before: 79, after: 85 }],
      },
    };
    const storyStarters = starters.map((p, idx) =>
      idx === 6 ? awakenedStarter : p,
    );

    const clubs: Club[] = [
      {
        id: USER_CLUB_ID,
        name: 'FC 회고',
        shortName: 'DOC',
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
        att: 83,
        mid: 83,
        def: 83,
        formation: '4-3-3',
        defaultTactic: 'possession',
        topScorers: ['A', 'B', 'C'],
        isUser: true,
      },
      {
        id: 'ai-city',
        name: '맨체스터 시티',
        shortName: 'MCI',
        primaryColor: '#38bdf8',
        secondaryColor: '#0f172a',
        att: 88,
        mid: 88,
        def: 87,
        formation: '4-3-3',
        defaultTactic: 'possession',
        topScorers: ['X', 'Y', 'Z'],
      },
      {
        id: 'ai-ars',
        name: '아스널',
        shortName: 'ARS',
        primaryColor: '#ef4444',
        secondaryColor: '#ffffff',
        att: 86,
        mid: 86,
        def: 86,
        formation: '4-3-3',
        defaultTactic: 'gegenpressing',
        topScorers: ['X', 'Y', 'Z'],
      },
      {
        id: 'ai-mid',
        name: '아스톤 빌라',
        shortName: 'AVL',
        primaryColor: '#991b1b',
        secondaryColor: '#38bdf8',
        att: 81,
        mid: 81,
        def: 80,
        formation: '4-4-2',
        defaultTactic: 'balanced',
        topScorers: ['X', 'Y', 'Z'],
      },
    ];

    const makeMatch = (
      round: number,
      oppId: string,
      ug: number,
      og: number,
      htU: number,
      htO: number,
    ): MatchResult => ({
      fixtureId: `f-${round}`,
      round,
      competition: 'league',
      homeTeamId: USER_CLUB_ID,
      awayTeamId: oppId,
      homeGoals: ug,
      awayGoals: og,
      halftimeHomeGoals: htU,
      halftimeAwayGoals: htO,
      homePossession: 54,
      homeShots: 12,
      awayShots: 10,
      homeShotsOnTarget: 6,
      awayShotsOnTarget: 5,
      homeXg: 1.8,
      awayXg: 1.5,
      homeTactic: 'possession',
      awayTactic: 'balanced',
      homeFormation: '4-3-3',
      awayFormation: '4-3-3',
      homeTacticBonus: 0,
      awayTacticBonus: 0,
      events: [],
      playerRatings: [],
      momPlayerId: awakenedStarter.id,
      momPlayerName: awakenedStarter.name,
      momRating: 7.9,
    });

    // Season arc: strong start (R1-4) -> slump & heavy defeat + blown lead (R11-14) -> rebound (R22-27)
    const userHistory: MatchResult[] = [
      makeMatch(1, 'ai-mid', 2, 0, 1, 0),
      makeMatch(2, 'ai-ars', 2, 1, 1, 0),
      makeMatch(3, 'ai-mid', 3, 0, 2, 0),
      makeMatch(4, 'ai-mid', 1, 0, 0, 0),
      // Slump + heavy defeat + blown lead
      makeMatch(11, 'ai-city', 0, 4, 0, 2),
      makeMatch(12, 'ai-ars', 2, 3, 2, 0), // blown 2-goal halftime lead!
      makeMatch(13, 'ai-mid', 0, 1, 0, 0),
      makeMatch(14, 'ai-mid', 1, 1, 1, 0),
      // Rebound streak after mid-season coach & awakening
      makeMatch(22, 'ai-mid', 2, 0, 1, 0),
      makeMatch(23, 'ai-ars', 3, 1, 1, 0),
      makeMatch(24, 'ai-city', 2, 1, 0, 1),
      makeMatch(25, 'ai-mid', 4, 0, 2, 0),
      makeMatch(26, 'ai-mid', 2, 0, 1, 0),
      makeMatch(27, 'ai-mid', 3, 0, 2, 0),
    ];

    const fixtures: Fixture[] = userHistory.map((m) => ({
      id: m.fixtureId,
      round: m.round,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      played: true,
      result: m,
    }));

    const standings: StandingRow[] = [
      {
        teamId: USER_CLUB_ID,
        teamName: 'FC 회고',
        shortName: 'DOC',
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
        isUser: true,
        played: 38,
        won: 25,
        drawn: 7,
        lost: 6,
        goalsFor: 76,
        goalsAgainst: 32,
        goalDifference: 44,
        points: 82,
        form: ['W', 'W', 'W', 'W', 'W'],
      },
      {
        teamId: 'ai-city',
        teamName: '맨체스터 시티',
        shortName: 'MCI',
        primaryColor: '#38bdf8',
        secondaryColor: '#0f172a',
        isUser: false,
        played: 38,
        won: 24,
        drawn: 8,
        lost: 6,
        goalsFor: 74,
        goalsAgainst: 34,
        goalDifference: 40,
        points: 80,
        form: ['W', 'D', 'W', 'W', 'L'],
      },
    ];

    const story = generateSoloSeasonTeamStory({
      userClubName: 'FC 회고',
      managerName: '김회고',
      managerTraitId: 'tiki_taka',
      managerRating: 91,
      staffCoachId: 'line_midfield',
      formation: '4-3-3',
      tactic: 'possession',
      leagueName: '프리미어리그',
      clubs,
      standings,
      fixtures,
      totalRounds: 38,
      userMatchHistory: userHistory,
      userCupMatchHistory: [
        {
          ...makeMatch(8, 'ai-ars', 1, 2, 1, 1),
          fixtureId: 'cup-r16',
          competition: 'cup',
          competitionLabel: 'FA컵 16강',
        },
      ],
      userUclMatchHistory: [],
      cup: {
        meta: {
          leagueId: 'epl',
          id: 'fa-cup',
          name: 'FA Cup',
          koreanName: 'FA컵',
          accentColor: '#ef4444',
        },
        triggerRounds: [8, 16, 24, 32],
        participantIds: [USER_CLUB_ID, 'ai-ars', 'ai-city', 'ai-mid'],
        currentStage: 'final',
        pendingStage: null,
        rounds: {
          r16: [
            {
              id: 'cup-r16',
              stage: 'r16',
              matchIndex: 0,
              homeTeamId: USER_CLUB_ID,
              awayTeamId: 'ai-ars',
              played: true,
              winnerId: 'ai-ars',
            },
          ],
          qf: [],
          sf: [],
          final: [],
        },
        userEliminatedAt: 'r16',
        championTeamId: 'ai-ars',
        completed: true,
      },
      ucl: null,
      starters: storyStarters,
      bench,
      combinedStatsMap: {
        [storyStarters[9].id]: makeStats(storyStarters[9], {
          goals: 22,
          assists: 7,
          avgRating: 7.7,
        }),
        [awakenedStarter.id]: makeStats(awakenedStarter, {
          goals: 9,
          assists: 13,
          avgRating: 7.6,
        }),
      },
      baseAvgOvr: 82.8,
      effectiveOvr: 86.2,
      chemistry: 90,
      ffpTier: 0,
      userClubId: USER_CLUB_ID,
      storyCrisisLog: {
        keyInjuries: [
          {
            round: 15,
            competition: 'league',
            playerId: storyStarters[9].id,
            playerName: storyStarters[9].name,
            ovr: storyStarters[9].ovr,
            severity: 'moderate',
            matchesMissed: 4,
          },
        ],
        tacticalCrises: [
          {
            round: 16,
            competition: 'league',
            formation: '4-3-3',
            tactic: 'possession',
            exposureScore: 84,
          },
        ],
      },
    });

    const crisisHighlights = story.highlights.filter(
      (h) => h.kind === 'slump' || h.kind === 'setback',
    );
    expect(crisisHighlights.length).toBeGreaterThanOrEqual(3);
    // Must capture slump, injury/tactical crisis, and early cup exit
    expect(story.highlights.some((h) => h.kind === 'slump')).toBe(true);
    expect(story.highlights.some((h) => h.kind === 'setback')).toBe(true);
    expect(
      story.highlights.some(
        (h) =>
          h.tag === '핵심 부상 악재' &&
          h.detail.includes(storyStarters[9].name),
      ),
    ).toBe(true);
    expect(
      story.highlights.some(
        (h) =>
          h.tag.includes('전술') ||
          h.title.includes('노출') ||
          h.detail.includes('파훼'),
      ),
    ).toBe(true);
    // Opening first, epilogue last, and curated timeline stays readable (<= 10)
    expect(story.highlights.length).toBeLessThanOrEqual(10);
    expect(story.highlights[0].kind).toBe('opening');
    expect(story.highlights[story.highlights.length - 1].period).toBe('에필로그');

    // Focused domestic cup early-exit setback scenario
    const cupHeartbreakStory = generateSoloSeasonTeamStory({
      userClubName: 'FC 컵아쉬움',
      managerName: '박감독',
      managerTraitId: null,
      managerRating: 86,
      formation: '4-3-3',
      tactic: 'balanced',
      leagueName: '프리미어리그',
      clubs,
      standings,
      fixtures: [],
      totalRounds: 38,
      userMatchHistory: userHistory.slice(0, 4),
      userCupMatchHistory: [
        {
          ...makeMatch(8, 'ai-ars', 1, 2, 1, 1),
          fixtureId: 'cup-r16',
          competition: 'cup',
          competitionLabel: 'FA컵 16강',
        },
      ],
      userUclMatchHistory: [],
      cup: {
        meta: {
          leagueId: 'epl',
          id: 'fa-cup',
          name: 'FA Cup',
          koreanName: 'FA컵',
          accentColor: '#ef4444',
        },
        triggerRounds: [8, 16, 24, 32],
        participantIds: [USER_CLUB_ID, 'ai-ars', 'ai-city', 'ai-mid'],
        currentStage: 'final',
        pendingStage: null,
        rounds: {
          r16: [
            {
              id: 'cup-r16',
              stage: 'r16',
              matchIndex: 0,
              homeTeamId: USER_CLUB_ID,
              awayTeamId: 'ai-ars',
              played: true,
              winnerId: 'ai-ars',
            },
          ],
          qf: [],
          sf: [],
          final: [],
        },
        userEliminatedAt: 'r16',
        championTeamId: 'ai-ars',
        completed: true,
      },
      ucl: null,
      starters: starters,
      bench,
      combinedStatsMap: {},
      baseAvgOvr: 82.0,
      effectiveOvr: 84.0,
      chemistry: 84,
      userClubId: USER_CLUB_ID,
    });
    expect(
      cupHeartbreakStory.highlights.some(
        (h) => h.detail.includes('FA컵') && h.kind === 'setback',
      ),
    ).toBe(true);
  });

  it('4) resolves consecutive-match & neighborBonus===1 awakening bottlenecks while preserving low-util suppression, Classic 0%, 88+ anti-inflation, and v9.7.0 version sync', () => {
    // Calibrated tier multipliers & OVR-relative min ratings
    expect(getAwakeningTierRateMultiplier(75)).toBe(2.3);
    expect(getAwakeningTierRateMultiplier(78)).toBe(2.0);
    expect(getAwakeningTierRateMultiplier(80)).toBe(1.65);
    expect(getAwakeningTierRateMultiplier(83)).toBe(1.4);
    expect(getAwakeningTierRateMultiplier(86)).toBe(0.78);
    expect(getAwakeningTierRateMultiplier(88)).toBe(AWAKENING_SUPERSTAR_RATE_MULT);

    expect(getAwakeningMinMatchRating(76, true)).toBe(6.75);
    expect(getAwakeningMinMatchRating(79, true)).toBe(6.9);
    expect(getAwakeningMinMatchRating(82, true)).toBe(7.1);
    expect(getAwakeningMinMatchRating(85, true)).toBe(7.25);
    expect(getAwakeningMinMatchRating(88, true)).toBe(7.4);

    // Regular starter (20 consecutive matches) must NOT collapse to 0.45x of fresh starter
    const dfGem = ACTIVE_PLAYERS.find(
      (p) => !p.isLegend && p.position === 'DF' && p.ovr >= 78 && p.ovr <= 82,
    )!;
    const baseInput = {
      player: dfGem,
      rating: 7.5,
      goals: 0,
      assists: 0,
      minutes: 90,
      cleanSheet: false,
      seasonStats: makeStats(dfGem, {
        appearances: 18,
        starts: 18,
        minutesPlayed: 1620,
        goals: 0,
        assists: 1,
        cleanSheets: 7,
        avgRating: 7.25,
      }),
      synergy: {
        slotIndex: 2,
        playerId: dfGem.id,
        baseEffectiveOvr: dfGem.ovr,
        effectiveOvrWithSynergy: dfGem.ovr + 2,
        neighborBonus: 1, // 2-3 lines (+1): must now qualify for resonance!
        managerBonus: 1,
        totalBonus: 2,
        reasons: ['시너지'],
        lineCount: 3,
      },
      hasSynergyContext: true,
      managerTraitId: 'defensive_architect' as const,
      positionPenalty: 0,
      teamCountMult: 1.0,
      coachMult: 1.0,
    };

    const fresh = computeAwakeningCandidateProbability({
      ...baseInput,
      condition: {
        morale: 3,
        injury: null,
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 3,
        recentGoalDrought: 0,
      },
    });
    const regularStarter = computeAwakeningCandidateProbability({
      ...baseInput,
      condition: {
        morale: 3,
        injury: null,
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 20,
        recentGoalDrought: 0,
      },
    });
    const injured = computeAwakeningCandidateProbability({
      ...baseInput,
      condition: {
        morale: 3,
        injury: {
          id: 'knock',
          name: '타박상',
          severity: 'minor',
          matchesRemaining: 1,
          initialMatches: 1,
          canPlayThrough: true,
          playThroughPenalty: -3,
          recoveryMatchesRemaining: 0,
        },
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 3,
        recentGoalDrought: 0,
      },
    });
    const noSynergy = computeAwakeningCandidateProbability({
      ...baseInput,
      synergy: {
        ...baseInput.synergy,
        neighborBonus: 0,
        managerBonus: 0,
        totalBonus: 0,
        lineCount: 0,
      },
      condition: {
        morale: -2,
        injury: null,
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 20,
        recentGoalDrought: 0,
      },
      positionPenalty: -5,
    });

    expect(regularStarter.finalProb).toBeGreaterThanOrEqual(fresh.finalProb * 0.72);
    expect(injured.finalProb).toBeLessThan(fresh.finalProb * 0.35);
    expect(fresh.finalProb).toBeGreaterThan(noSynergy.finalProb * 5);

    // Classic players remain strictly 0%; 88+ superstars stay capped
    const classic = LEGEND_PLAYERS[0];
    const classicAttempt = evaluatePostMatchAwakening({
      starters: [classic],
      bench: [],
      matchPlayedNumber: 20,
      round: 20,
      competition: 'league',
      ratingsByPlayerId: { [classic.id]: 9.8 },
      goalsByPlayerId: { [classic.id]: 3 },
      assistsByPlayerId: {},
      minutesByPlayerId: { [classic.id]: 90 },
      cleanSheet: true,
      allPlayerStats: {},
      managerTraitId: null,
      rng: () => 0,
    });
    expect(classicAttempt.triggered).toBe(false);

    const gain90 = rollAwakeningOvrGain(90, () => 0.99);
    expect(gain90).toBeLessThanOrEqual(AWAKENING_SUPERSTAR_MAX_GAIN);
    expect(90 + gain90).toBeLessThanOrEqual(AWAKENING_OVR_HARD_CAP);

    // Release version sync
    expect(CURRENT_APP_VERSION).toBe('v9.7.2');
    expect(PATCH_NOTES[0].version).toBe('v9.7.2');
    expect(WHATS_NEW_HIGHLIGHT_RANGE).toContain('v9.7.2');
  });
});

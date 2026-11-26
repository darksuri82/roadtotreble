import { describe, expect, it } from 'vitest';
import seasonSummarySrc from '../components/league/SeasonSummary.tsx?raw';
import legacyHubSrc from '../components/legacy/LegacyHubModal.tsx?raw';
import mpFinalBoardSrc from '../components/multiplayer/league/MpLeagueFinalBoard.tsx?raw';
import { computeSeasonAwards } from '../engine/awardsEngine';
import {
  FFP_TIER1_SCORE_MULTIPLIER,
  FFP_TIER1_SCORE_PENALTY_PCT,
  FFP_TIER2_SCORE_MULTIPLIER,
  FFP_TIER2_SCORE_PENALTY_PCT,
  formatFfpScorePenaltyLabel,
  resolveFfpPenaltyTier,
} from '../engine/budgetEngine';
import { buildAiClubRoster, getLeagueById } from '../engine/dataLoader';
import { DEFAULT_ROULETTE_LEGEND_RATE } from '../engine/draftEngine';
import { computeSeasonScore } from '../engine/legacyEngine';
import { USER_CLUB_ID } from '../engine/matchEngine';
import { createInitialStandings } from '../engine/standingsEngine';
import {
  createClosedTransferState,
  createOpenTransferState,
  rollIncomingOfferTargetCount,
  spinTransferClubs,
  TRANSFER_ROULETTE_LEGEND_RATE,
} from '../engine/transferEngine';
import type { PlayerSeasonStats } from '../types/league';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeStats(overrides: Partial<PlayerSeasonStats>): PlayerSeasonStats {
  return {
    playerId: overrides.playerId ?? 'p-1',
    playerName: overrides.playerName ?? '테스트 선수',
    teamId: overrides.teamId ?? USER_CLUB_ID,
    teamName: overrides.teamName ?? '내 팀',
    teamShortName: overrides.teamShortName ?? 'MYT',
    teamPrimaryColor: '#10b981',
    teamSecondaryColor: '#0f172a',
    isUserTeam: overrides.isUserTeam ?? true,
    position: overrides.position ?? 'DF',
    mainPositions: overrides.mainPositions ?? ['RB'],
    ovr: overrides.ovr ?? 85,
    isLegend: overrides.isLegend ?? false,
    appearances: overrides.appearances ?? 34,
    starts: overrides.starts ?? 34,
    subAppearances: 0,
    minutesPlayed: 3000,
    goals: overrides.goals ?? 3,
    assists: overrides.assists ?? 5,
    xgSum: 2.1,
    cleanSheets: overrides.cleanSheets ?? 18,
    momCount: overrides.momCount ?? 4,
    ratingSum: (overrides.avgRating ?? 7.6) * (overrides.appearances ?? 34),
    avgRating: overrides.avgRating ?? 7.6,
    positionCounts: { RB: 34 },
  };
}

describe('v9.2.3 — Best GK/DF separation, FFP Tier 1/2 penalty labels & transfer rank tuning', () => {
  it('never assigns a defender (e.g. Timber) as bestGoalkeeper and awards bestDefender separately', () => {
    const epl = getLeagueById('epl');
    const standings = createInitialStandings(epl.clubs);
    standings[0].teamId = USER_CLUB_ID;
    standings[0].isUser = true;

    const timber = makeStats({
      playerId: 'df-timber',
      playerName: '위리엔 팀버',
      position: 'DF',
      mainPositions: ['RB', 'CB'],
      cleanSheets: 20,
      avgRating: 7.95,
      goals: 4,
      assists: 7,
      momCount: 6,
    });
    const raya = makeStats({
      playerId: 'gk-raya',
      playerName: '다비드 라야',
      position: 'GK',
      mainPositions: ['GK'],
      cleanSheets: 20,
      avgRating: 7.45,
      goals: 0,
      assists: 0,
      momCount: 3,
    });
    const rivalGk = makeStats({
      playerId: 'gk-rival',
      playerName: '상대 키퍼',
      teamId: standings[1].teamId,
      isUserTeam: false,
      position: 'GK',
      mainPositions: ['GK'],
      cleanSheets: 16,
      avgRating: 7.5,
      goals: 0,
      assists: 0,
      momCount: 2,
    });

    const awards = computeSeasonAwards(
      {
        [timber.playerId]: timber,
        [raya.playerId]: raya,
        [rivalGk.playerId]: rivalGk,
      },
      standings,
      38,
    );

    // Even when Timber leads combined topCleanSheets on rating tiebreak,
    // bestGoalkeeper MUST be a GK and bestDefender MUST be Timber.
    expect(awards.topCleanSheets[0]?.playerId).toBe('df-timber');
    expect(awards.bestGoalkeeper?.playerId).toBe('gk-raya');
    expect(awards.bestGoalkeeper?.position).toBe('GK');
    expect(awards.bestDefender?.playerId).toBe('df-timber');
    expect(awards.bestDefender?.position).toBe('DF');
  });

  it('distinguishes FFP Tier 1 vs Tier 2 labels accurately (including legacy records without ffpTier)', () => {
    expect(resolveFfpPenaltyTier(FFP_TIER1_SCORE_PENALTY_PCT)).toBe(1);
    expect(resolveFfpPenaltyTier(FFP_TIER2_SCORE_PENALTY_PCT)).toBe(2);
    expect(resolveFfpPenaltyTier(12)).toBe(2);

    expect(formatFfpScorePenaltyLabel(FFP_TIER1_SCORE_PENALTY_PCT)).toBe(
      `FFP 1단계 예산 초과 감점 (-${FFP_TIER1_SCORE_PENALTY_PCT}%)`,
    );
    expect(formatFfpScorePenaltyLabel(FFP_TIER2_SCORE_PENALTY_PCT)).toBe(
      `FFP 2단계 예산 초과 감점 (-${FFP_TIER2_SCORE_PENALTY_PCT}%)`,
    );

    const tier1Score = computeSeasonScore({
      leaguePoints: 88,
      leaguePlayed: 38,
      leagueGoalDifference: 48,
      leagueLosses: 4,
      leagueGoalsFor: 80,
      leagueGoalsAgainst: 32,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 86,
      chemistry: 88,
      ffpTier: 1,
      ffpScoreMultiplier: FFP_TIER1_SCORE_MULTIPLIER,
    });
    expect(tier1Score.ffpTier).toBe(1);
    expect(tier1Score.ffpPenaltyPct).toBe(FFP_TIER1_SCORE_PENALTY_PCT);
    expect(
      formatFfpScorePenaltyLabel(tier1Score.ffpPenaltyPct, tier1Score.ffpTier),
    ).toContain('FFP 1단계');

    const tier2Score = computeSeasonScore({
      leaguePoints: 88,
      leaguePlayed: 38,
      leagueGoalDifference: 48,
      leagueLosses: 4,
      leagueGoalsFor: 80,
      leagueGoalsAgainst: 32,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 86,
      chemistry: 88,
      ffpTier: 2,
      ffpScoreMultiplier: FFP_TIER2_SCORE_MULTIPLIER,
    });
    expect(tier2Score.ffpTier).toBe(2);
    expect(tier2Score.ffpPenaltyPct).toBe(FFP_TIER2_SCORE_PENALTY_PCT);
    expect(
      formatFfpScorePenaltyLabel(tier2Score.ffpPenaltyPct, tier2Score.ffpTier),
    ).toContain('FFP 2단계');

    // Guard against regression to hardcoded "FFP 2단계 예산 초과 감점" in UI files
    for (const src of [legacyHubSrc, seasonSummarySrc, mpFinalBoardSrc]) {
      expect(src).not.toContain('FFP 2단계 예산 초과 감점');
      expect(src).toContain('formatFfpScorePenaltyLabel');
    }
  });

  it('keeps transfer roulette Legend FA rate fixed at 2.5% regardless of Top 4 / League Champion status', () => {
    expect(TRANSFER_ROULETTE_LEGEND_RATE).toBe(DEFAULT_ROULETTE_LEGEND_RATE);

    const prev = createClosedTransferState();
    const openedTop1 = createOpenTransferState(1, 10, 1, prev, {
      isUclSpecial: true,
      championBonusActive: true,
    });
    expect(openedTop1.legendBonusActive).toBe(false);

    const epl = getLeagueById('epl');
    const standings = createInitialStandings(epl.clubs);
    const aiRosters: Record<string, ReturnType<typeof buildAiClubRoster>> = {};
    for (const c of epl.clubs) aiRosters[c.id] = buildAiClubRoster(c, 'epl');

    // rng returning 0.03 is above 2.5% (0.025) and below old 4.0% / 5.5% boosts:
    // must NOT roll Legend even when userRank === 1 & championBonusActive === true.
    const offers = spinTransferClubs({
      currentRound: 38,
      totalRounds: 38,
      windowIndex: 4,
      userLeagueId: 'epl',
      userRank: 1,
      standings,
      allPlayerStats: {},
      aiRosters,
      ownedIds: new Set(),
      legendBonusActive: true,
      championBonusActive: true,
      rng: () => 0.03,
    });
    expect(offers.some((o) => o.isLegendSlot)).toBe(false);
  });

  it('increases incoming AI trade offer receive probability and average volume as league standing rises', () => {
    const samples = 4000;
    const measure = (rank: number) => {
      const rng = makeSeededRng(1000 + rank * 37);
      let sum = 0;
      let nonZero = 0;
      let minVal = 99;
      for (let i = 0; i < samples; i += 1) {
        const c = rollIncomingOfferTargetCount(rank, 20, rng);
        sum += c;
        if (c > 0) nonZero += 1;
        if (c < minVal) minVal = c;
      }
      return {
        avg: sum / samples,
        receiveRate: nonZero / samples,
        minVal,
      };
    };

    const r1 = measure(1);
    const r3 = measure(3);
    const r6 = measure(6);
    const r11 = measure(11);
    const r18 = measure(18);

    // 1st guarantees >= 2 offers; Top 4 guarantees >= 1 offer
    expect(r1.receiveRate).toBe(1);
    expect(r1.minVal).toBeGreaterThanOrEqual(2);
    expect(r3.receiveRate).toBe(1);
    expect(r3.minVal).toBeGreaterThanOrEqual(1);

    // Strictly monotonic increase from bottom -> mid -> upper -> top4 -> 1st
    expect(r1.avg).toBeGreaterThan(r3.avg);
    expect(r3.avg).toBeGreaterThan(r6.avg);
    expect(r6.avg).toBeGreaterThan(r11.avg);
    expect(r11.avg).toBeGreaterThan(r18.avg);
    expect(r6.receiveRate).toBeGreaterThan(r11.receiveRate);
    expect(r11.receiveRate).toBeGreaterThan(r18.receiveRate);
  });
});

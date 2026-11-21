import { describe, expect, it } from 'vitest';
import {
  buildUnifiedLeaderboard,
  compareScoreWithHistoricalTeams,
  HISTORICAL_BENCHMARK_TEAMS,
} from '../data/historicalTeams';
import { computeMatchesOnlyAnalytics } from '../engine/analyticsEngine';
import { getLeagueById } from '../engine/dataLoader';
import { USER_CLUB_ID } from '../engine/matchEngine';
import {
  createInitialStandings,
  getUserRank,
} from '../engine/standingsEngine';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type { Club } from '../types/league';
import { normalizeManagerAvatar } from '../utils/clubPresets';

describe('v2.4 Features: Historical Benchmarks, 0-Rank Bug Fix & Manager Avatar Gender/Bald', () => {
  it('computes all 14 historical benchmark teams fairly using the exact same season score engine', () => {
    expect(HISTORICAL_BENCHMARK_TEAMS).toHaveLength(14);

    // Every historical team must have 11 representative Best XI players & positive score breakdown
    for (const team of HISTORICAL_BENCHMARK_TEAMS) {
      expect(team.bestXi).toHaveLength(11);
      expect(team.seasonScore.totalScore).toBeGreaterThan(2000);
      expect(team.seasonScore.leagueConvertedScore).toBeGreaterThan(1500);
      expect(team.seasonScore.leagueRankBonus).toBe(1200);
      expect(team.trophies.length).toBeGreaterThanOrEqual(1);
    }

    // Treble winners should naturally rank above single-league champions
    const trebleBayern = HISTORICAL_BENCHMARK_TEAMS.find(
      (t) => t.id === 'hist-1920-bayern',
    )!;
    const leicester = HISTORICAL_BENCHMARK_TEAMS.find(
      (t) => t.id === 'hist-1516-leicester',
    )!;
    expect(trebleBayern.seasonScore.totalScore).toBeGreaterThan(
      leicester.seasonScore.totalScore,
    );
    // 15-16 Leicester (OVR 78.2) should receive meaningful underdog bonus!
    expect(leicester.seasonScore.underdogBonus).toBeGreaterThan(400);

    // 03-04 Arsenal & 23-24 Leverkusen unbeaten bonuses should be applied
    const arsenal = HISTORICAL_BENCHMARK_TEAMS.find(
      (t) => t.id === 'hist-0304-arsenal',
    )!;
    const leverkusen = HISTORICAL_BENCHMARK_TEAMS.find(
      (t) => t.id === 'hist-2324-leverkusen',
    )!;
    expect(arsenal.seasonScore.honorsBonus).toBeGreaterThanOrEqual(750);
    expect(leverkusen.seasonScore.honorsBonus).toBeGreaterThanOrEqual(1300); // Double + Unbeaten
  });

  it('merges user & historical entries into unified leaderboard and produces accurate comparison text', () => {
    const histOnly = buildUnifiedLeaderboard({
      userEntries: [],
      filter: 'historical',
      sortBy: 'score',
    });
    expect(histOnly).toHaveLength(14);
    expect(histOnly[0].totalScore).toBeGreaterThanOrEqual(histOnly[1].totalScore);

    const topScore = HISTORICAL_BENCHMARK_TEAMS[0].seasonScore.totalScore;
    const midScore = HISTORICAL_BENCHMARK_TEAMS[6].seasonScore.totalScore + 5;

    const beatAll = compareScoreWithHistoricalTeams(topScore + 500);
    expect(beatAll.rankAmongAll).toBe(1);
    expect(beatAll.teamAbove).toBeNull();
    expect(beatAll.feedbackText).toContain('1위');

    const midComp = compareScoreWithHistoricalTeams(midScore);
    expect(midComp.rankAmongAll).toBe(7);
    expect(midComp.teamAbove).not.toBeNull();
    expect(midComp.teamBelow).not.toBeNull();
    expect(midComp.feedbackText).toContain('역대 랭킹 7위');
  });

  it('never returns 0 rank from getUserRank or computeMatchesOnlyAnalytics', () => {
    // Empty standings guard
    expect(getUserRank([], USER_CLUB_ID)).toBeGreaterThanOrEqual(1);

    // Fallback by isUser flag even if teamId differs
    const epl = getLeagueById('epl');
    const customUserClub: Club = {
      ...epl.clubs[0],
      id: 'custom-legacy-id',
      name: 'FC Custom',
      shortName: 'FCC',
      isUser: true,
    };
    const standings = createInitialStandings([
      customUserClub,
      ...epl.clubs.slice(1),
    ]);
    const idx = standings.findIndex((r) => r.isUser);
    expect(getUserRank(standings, USER_CLUB_ID)).toBe(idx + 1);
    expect(getUserRank(standings, USER_CLUB_ID)).toBeGreaterThanOrEqual(1);

    // computeMatchesOnlyAnalytics never outputs finalRank === 0
    const cupAnalytics = computeMatchesOnlyAnalytics({
      matches: [],
      clubs: epl.clubs,
      finalRank: 2,
      rankLabel: '우승',
    });
    expect(cupAnalytics.finalRank).toBe(2);
    expect(cupAnalytics.rankLabel).toBe('우승');

    const fallbackAnalytics = computeMatchesOnlyAnalytics({
      matches: [],
      clubs: epl.clubs,
    });
    expect(fallbackAnalytics.finalRank).toBeGreaterThanOrEqual(1);
  });

  it('safely normalizes legacy manager avatars missing gender and supports female & bald options', () => {
    const legacySaved = normalizeManagerAvatar({
      skinTone: 'warm',
      hairStyle: 'parted',
      hairColor: 'black',
      outfit: 'navy_coat',
    });
    expect(legacySaved.gender).toBe('male');
    expect(legacySaved.hairStyle).toBe('parted');

    const maleBald = normalizeManagerAvatar({
      gender: 'male',
      skinTone: 'peach',
      hairStyle: 'bald',
      hairColor: 'brown',
      outfit: 'team_tracksuit',
    });
    expect(maleBald.gender).toBe('male');
    expect(maleBald.hairStyle).toBe('bald');

    const femaleLegacy = normalizeManagerAvatar({
      gender: 'female',
      skinTone: 'peach',
      hairStyle: 'bald',
      hairColor: 'brown',
      outfit: 'team_tracksuit',
    });
    expect(femaleLegacy.gender).toBe('female');
    expect(femaleLegacy.hairStyle).toBe('bob');
    expect(femaleLegacy.outfit).toBe('female_tracksuit');

    expect(DEFAULT_MANAGER_AVATAR.gender).toBe('male');
  });
});

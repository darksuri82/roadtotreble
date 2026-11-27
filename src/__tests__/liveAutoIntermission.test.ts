import { describe, expect, it } from 'vitest';
import { SOLO_LIVE_INTERMISSION_MS } from '../components/common/SoloLiveScoreboard';
import scoreboardSrc from '../components/common/SoloLiveScoreboard.tsx?raw';
import finaleBannerSrc from '../components/league/LeagueFinaleBannerModal.tsx?raw';
import seasonDashSrc from '../components/league/SeasonDashboard.tsx?raw';
import seasonSummarySrc from '../components/league/SeasonSummary.tsx?raw';
import uclDashSrc from '../components/ucl/UclDashboard.tsx?raw';
import { getStoryNoUclReason } from '../data/story/storyRegistry';
import { USER_CLUB_ID } from '../engine/matchEngine';
import { createInitialState, gameReducer } from '../store/GameContext';
import type { GameState } from '../types/game';

describe('Solo Live Auto-Advance 3-second intermission & immediate next-match tactic application', () => {
  it('uses a 3000ms (3s) between-match intermission constant across League and UCL League Phase', () => {
    expect(SOLO_LIVE_INTERMISSION_MS).toBe(3000);
    expect(seasonDashSrc).toContain('SOLO_LIVE_INTERMISSION_MS');
    expect(seasonDashSrc).not.toContain('}, 620);');
    expect(uclDashSrc).toContain(
      'const LP_NEXT_ROUND_COUNTDOWN_MS = SOLO_LIVE_INTERMISSION_MS;',
    );
  });

  it('applies tactic and formation edits made during the between-match intermission immediately to the next streamed match', () => {
    let st = createInitialState();
    st = gameReducer(st, { type: 'START_NEW_CAREER' });
    st = gameReducer(st, { type: 'START_DRAFT' });
    st = gameReducer(st, { type: 'AUTO_COMPLETE_DRAFT' });
    st = gameReducer(st, { type: 'SELECT_LEAGUE', payload: { leagueId: 'epl' } });

    // Round 1 plays with initial tactic/formation
    const r1Stream = gameReducer(st, { type: 'START_SOLO_STREAM_MATCH' });
    expect(r1Stream.season?.liveHalftime?.streamAutoMode).toBe(true);
    const r1Committed = gameReducer(r1Stream, { type: 'COMMIT_LIVE_MATCH' });
    expect(r1Committed.season?.currentRound).toBe(1);
    expect(r1Committed.season?.liveHalftime).toBeNull();

    // Clear any post-match blocking modal so Round 2 can start cleanly
    let intermissionState: GameState = {
      ...r1Committed,
      season: {
        ...r1Committed.season!,
        pendingInjuryAlerts: [],
        pendingAwakeningAlerts: [],
        tacticalAdaptation: r1Committed.season!.tacticalAdaptation
          ? {
              ...r1Committed.season!.tacticalAdaptation,
              pendingAlert: null,
            }
          : undefined,
        managerEvents: r1Committed.season!.managerEvents
          ? {
              ...r1Committed.season!.managerEvents,
              activeEvent: null,
              lastResolution: null,
            }
          : undefined,
      },
    };

    // During the 3s intermission before Round 2, user adjusts tactics (nextMatchTactic) & formation
    intermissionState = gameReducer(intermissionState, {
      type: 'SET_NEXT_MATCH_TACTIC',
      payload: { tactic: 'counter' },
    });
    intermissionState = gameReducer(intermissionState, {
      type: 'CHANGE_FORMATION',
      payload: { formation: '3-5-2' },
    });

    // Round 2 kicks off immediately using the intermission edits
    const r2Stream = gameReducer(intermissionState, {
      type: 'START_SOLO_STREAM_MATCH',
    });
    expect(r2Stream.season?.liveHalftime?.streamAutoMode).toBe(true);
    expect(r2Stream.season?.liveHalftime?.userTacticAtKickoff).toBe('counter');

    const r2Res = r2Stream.season!.liveHalftime!.fullMatchResult!;
    const userIsHomeR2 = r2Res.homeTeamId === USER_CLUB_ID;
    expect(userIsHomeR2 ? r2Res.homeTactic : r2Res.awayTactic).toBe('counter');
    expect(userIsHomeR2 ? r2Res.homeFormation : r2Res.awayFormation).toBe('3-5-2');
  });

  it('clears stale nextMatchTactic when changing defaultTactic in Squad tab so the new default applies immediately', () => {
    let st = createInitialState();
    st = gameReducer(st, { type: 'START_NEW_CAREER' });
    st = gameReducer(st, { type: 'START_DRAFT' });
    st = gameReducer(st, { type: 'AUTO_COMPLETE_DRAFT' });
    st = gameReducer(st, { type: 'SELECT_LEAGUE', payload: { leagueId: 'epl' } });

    st = gameReducer(st, {
      type: 'SET_NEXT_MATCH_TACTIC',
      payload: { tactic: 'counter' },
    });
    expect(st.season?.nextMatchTactic).toBe('counter');

    st = gameReducer(st, {
      type: 'SET_DEFAULT_TACTIC',
      payload: { tactic: 'gegenpressing' },
    });
    expect(st.season?.defaultTactic).toBe('gegenpressing');
    expect(st.season?.nextMatchTactic).toBeNull();

    const streaming = gameReducer(st, { type: 'START_SOLO_STREAM_MATCH' });
    expect(streaming.season?.liveHalftime?.userTacticAtKickoff).toBe(
      'gegenpressing',
    );
  });

  it('wires loading indicator UI, unlocked intermission tactics room, and UCL LP quick tactics', () => {
    // Scoreboard intermission loading UI
    expect(scoreboardSrc).toContain('solo-live-intermission-card');
    expect(scoreboardSrc).toContain('solo-live-intermission-timer');
    expect(scoreboardSrc).toContain('solo-live-intermission-start-now-btn');

    // League dashboard unlocks MatchDayTacticsRoom during intermission & tracks live tactic touches
    expect(seasonDashSrc).toContain('isLiveAutoIntermission');
    expect(seasonDashSrc).toContain('solo-live-intermission-tactics-banner');
    expect(seasonDashSrc).toContain('handleIntermissionTacticTouch');
    expect(seasonDashSrc).toContain('handleConfirmLiveTacticEdit');

    // UCL League Phase popup renders 3s loading indicator + quick 5-tactic switch
    expect(uclDashSrc).toContain('solo-ucl-lp-intermission-card');
    expect(uclDashSrc).toContain('solo-ucl-lp-start-now-btn');
    expect(uclDashSrc).toContain('즉시 전술 변경');
  });

  it('explains historical previous-season no-UCL reason for 15-16 Leicester and 23-24 Leverkusen instead of missed UCL qualification', () => {
    const leiReason = getStoryNoUclReason('1516_leicester');
    const levReason = getStoryNoUclReason('2324_leverkusen');
    expect(leiReason).toContain('14-15 EPL 14위');
    expect(leiReason).toContain('챔피언스리그');
    expect(levReason).toContain('22-23 분데스리가 6위');
    expect(levReason).toContain('챔피언스리그');
    expect(getStoryNoUclReason('0708_manutd')).toBeNull();
    expect(getStoryNoUclReason('0910_inter')).toBeNull();

    expect(seasonSummarySrc).toContain('storyNoUclReason');
    expect(seasonSummarySrc).toContain('story-no-ucl-reason-note');
    expect(seasonSummarySrc).toContain('!qualifiedForUcl && !storyNoUclReason && fourthRow');
    expect(finaleBannerSrc).toContain('storyNoUclReason');
  });
});

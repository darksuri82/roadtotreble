import { describe, expect, it } from 'vitest';
import schemaSql from '../../supabase/schema.sql?raw';
import { WHATS_NEW_HIGHLIGHT_RANGE } from '../components/common/WhatsNewModal';
import { CURRENT_APP_VERSION, PATCH_NOTES } from '../data/patchNotes';
import { STORY_SCENARIOS } from '../data/story/storyRegistry';
import {
  computeStoryCompletionRates,
  fetchStoryGlobalStats,
  isValidStoryScenarioId,
  reportStoryModeEvent,
  STORY_STATS_SENT_KEY,
} from '../services/storyStatsService';

describe('v10.1.6 Story Mode Anonymous Challenge & Clear Telemetry', () => {
  it('validates all 7 official Story Mode scenario IDs and rejects unknown IDs', () => {
    expect(STORY_SCENARIOS).toHaveLength(7);
    for (const sc of STORY_SCENARIOS) {
      expect(isValidStoryScenarioId(sc.id)).toBe(true);
    }
    expect(isValidStoryScenarioId('invalid_scenario')).toBe(false);
    expect(isValidStoryScenarioId('')).toBe(false);
  });

  it('computes completion and 3-star rates accurately without division-by-zero', () => {
    expect(computeStoryCompletionRates(undefined)).toEqual({
      startedCount: 0,
      completedCount: 0,
      clearRatePct: null,
      star3RatePct: null,
    });

    expect(
      computeStoryCompletionRates({
        scenarioId: '1516_leicester',
        startedCount: 10,
        completedCount: 0,
        clearedAnyCount: 0,
        star3Count: 0,
        lastPlayedAt: null,
      }),
    ).toEqual({
      startedCount: 10,
      completedCount: 0,
      clearRatePct: null,
      star3RatePct: null,
    });

    expect(
      computeStoryCompletionRates({
        scenarioId: '0708_manutd',
        startedCount: 25,
        completedCount: 12,
        clearedAnyCount: 9,
        star3Count: 3,
        lastPlayedAt: '2026-11-27T10:00:00Z',
      }),
    ).toEqual({
      startedCount: 25,
      completedCount: 12,
      clearRatePct: 75,
      star3RatePct: 25,
    });
  });

  it('deduplicates already-sent runId events locally and fails safely when Supabase is unconfigured', async () => {
    const store = new Map<string, string>();
    const prevWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => store.set(k, v),
          removeItem: (k: string) => store.delete(k),
        },
      },
    });
    try {
      // Pre-mark a run event as sent -> must short-circuit as duplicate without touching network
      store.set(STORY_STATS_SENT_KEY, JSON.stringify(['story_run_123:start']));
      const dupRes = await reportStoryModeEvent({
        scenarioId: '1516_leicester',
        eventType: 'start',
        runId: 'story_run_123',
      });
      expect(dupRes.ok).toBe(true);
      expect(dupRes.duplicate).toBe(true);
      expect(dupRes.recorded).toBe(false);

      // Invalid runId rejected immediately
      const emptyRes = await reportStoryModeEvent({
        scenarioId: '1516_leicester',
        eventType: 'start',
        runId: '   ',
      });
      expect(emptyRes.ok).toBe(false);

      // Unconfigured/offline fetch never throws
      const fetched = await fetchStoryGlobalStats();
      expect(typeof fetched.ok).toBe('boolean');
      expect(fetched.statsByScenario).toBeDefined();
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: prevWindow,
      });
    }
  });

  it('defines story_mode_stats, story_mode_run_events, and record_story_mode_event for all 7 scenarios in supabase/schema.sql', () => {
    expect(schemaSql).toContain('create table if not exists public.story_mode_stats');
    expect(schemaSql).toContain('create table if not exists public.story_mode_run_events');
    expect(schemaSql).toContain('create or replace function public.record_story_mode_event');
    expect(schemaSql).toContain('grant execute on function public.record_story_mode_event');
    for (const sc of STORY_SCENARIOS) {
      expect(schemaSql).toContain(`'${sc.id}'`);
    }
  });

  it('synchronizes v10.1.6 patch notes and WhatsNewModal highlight range', () => {
    expect(PATCH_NOTES[0].version).toBe(CURRENT_APP_VERSION);
    expect(PATCH_NOTES.some((p) => p.version === 'v10.1.6')).toBe(true);
    expect(WHATS_NEW_HIGHLIGHT_RANGE).toContain(CURRENT_APP_VERSION);
  });
});

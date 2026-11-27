import { STORY_SCENARIO_BY_ID } from '../data/story/storyRegistry';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import type { StoryScenarioId } from '../types/storyMode';

export const STORY_STATS_SENT_KEY = 'rtt_story_stats_sent_events_v1';

export type StoryTelemetryEventType = 'start' | 'complete';

export interface StoryScenarioGlobalStats {
  scenarioId: StoryScenarioId;
  startedCount: number;
  completedCount: number;
  clearedAnyCount: number;
  star3Count: number;
  lastPlayedAt: string | null;
}

export interface FetchStoryGlobalStatsResult {
  ok: boolean;
  statsByScenario: Partial<Record<StoryScenarioId, StoryScenarioGlobalStats>>;
  totalStarted: number;
  totalCompleted: number;
  totalStar3: number;
  error?: string;
}

export interface ReportStoryEventResult {
  ok: boolean;
  recorded: boolean;
  duplicate?: boolean;
  skipped?: boolean;
  error?: string;
}

interface StoryStatsRow {
  scenario_id: string;
  started_count: number;
  completed_count: number;
  cleared_any_count: number;
  star3_count: number;
  last_played_at: string | null;
}

export function isValidStoryScenarioId(id: string): id is StoryScenarioId {
  return Object.prototype.hasOwnProperty.call(STORY_SCENARIO_BY_ID, id);
}

function loadSentEventKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORY_STATS_SENT_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function markEventKeySent(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = Array.from(loadSentEventKeys());
    if (existing.includes(key)) return;
    // Keep bounded history (most recent 200 run events) so localStorage stays tiny
    const next = [...existing.slice(-199), key];
    window.localStorage.setItem(STORY_STATS_SENT_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function computeStoryCompletionRates(
  stat: StoryScenarioGlobalStats | undefined,
): {
  startedCount: number;
  completedCount: number;
  clearRatePct: number | null;
  star3RatePct: number | null;
} {
  if (!stat) {
    return {
      startedCount: 0,
      completedCount: 0,
      clearRatePct: null,
      star3RatePct: null,
    };
  }
  const startedCount = Math.max(0, stat.startedCount);
  const completedCount = Math.max(0, stat.completedCount);
  const denom = Math.max(completedCount, 0);
  return {
    startedCount,
    completedCount,
    clearRatePct:
      denom > 0
        ? Math.min(100, Math.round((stat.clearedAnyCount / denom) * 100))
        : null,
    star3RatePct:
      denom > 0
        ? Math.min(100, Math.round((stat.star3Count / denom) * 100))
        : null,
  };
}

/**
 * Fetches anonymous aggregate challenge/completion stats across all Story Mode scenarios.
 * Completely isolated from `global_hof_rankings`; fails silently when offline or unconfigured.
 */
export async function fetchStoryGlobalStats(): Promise<FetchStoryGlobalStatsResult> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      statsByScenario: {},
      totalStarted: 0,
      totalCompleted: 0,
      totalStar3: 0,
      error: 'Supabase 미연결 환경',
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      statsByScenario: {},
      totalStarted: 0,
      totalCompleted: 0,
      totalStar3: 0,
      error: 'Supabase 클라이언트 초기화 불가',
    };
  }

  try {
    const { data, error } = await client
      .from('story_mode_stats')
      .select(
        'scenario_id, started_count, completed_count, cleared_any_count, star3_count, last_played_at',
      );

    if (error) {
      return {
        ok: false,
        statsByScenario: {},
        totalStarted: 0,
        totalCompleted: 0,
        totalStar3: 0,
        error: error.message,
      };
    }

    const statsByScenario: Partial<
      Record<StoryScenarioId, StoryScenarioGlobalStats>
    > = {};
    let totalStarted = 0;
    let totalCompleted = 0;
    let totalStar3 = 0;

    for (const row of (data ?? []) as StoryStatsRow[]) {
      if (!isValidStoryScenarioId(row.scenario_id)) continue;
      const entry: StoryScenarioGlobalStats = {
        scenarioId: row.scenario_id,
        startedCount: Math.max(0, Number(row.started_count) || 0),
        completedCount: Math.max(0, Number(row.completed_count) || 0),
        clearedAnyCount: Math.max(0, Number(row.cleared_any_count) || 0),
        star3Count: Math.max(0, Number(row.star3_count) || 0),
        lastPlayedAt: row.last_played_at ?? null,
      };
      statsByScenario[entry.scenarioId] = entry;
      totalStarted += entry.startedCount;
      totalCompleted += entry.completedCount;
      totalStar3 += entry.star3Count;
    }

    return {
      ok: true,
      statsByScenario,
      totalStarted,
      totalCompleted,
      totalStar3,
    };
  } catch (err) {
    return {
      ok: false,
      statsByScenario: {},
      totalStarted: 0,
      totalCompleted: 0,
      totalStar3: 0,
      error: err instanceof Error ? err.message : '스토리 통계 조회 실패',
    };
  }
}

/**
 * Records an anonymous Story Mode start or completion event via `record_story_mode_event` RPC.
 * Deduplicated both client-side (localStorage) and server-side (`primary key (run_id, event_type)`).
 */
export async function reportStoryModeEvent(params: {
  scenarioId: StoryScenarioId;
  eventType: StoryTelemetryEventType;
  runId: string;
  starsEarned?: number;
}): Promise<ReportStoryEventResult> {
  const { scenarioId, eventType, runId, starsEarned = 0 } = params;
  const cleanRunId = runId.trim();

  if (!isValidStoryScenarioId(scenarioId) || !cleanRunId) {
    return { ok: false, recorded: false, error: 'Invalid story event payload' };
  }

  const dedupKey = `${cleanRunId}:${eventType}`;
  if (loadSentEventKeys().has(dedupKey)) {
    return { ok: true, recorded: false, duplicate: true, skipped: true };
  }

  if (!isSupabaseConfigured) {
    return { ok: false, recorded: false, skipped: true, error: 'Supabase 미연결' };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, recorded: false, skipped: true, error: 'Supabase 미초기화' };
  }

  const clampedStars = Math.max(0, Math.min(3, Math.round(starsEarned)));

  try {
    const { data, error } = await client.rpc('record_story_mode_event', {
      p_scenario_id: scenarioId,
      p_event_type: eventType,
      p_run_id: cleanRunId,
      p_stars: clampedStars,
    });

    if (error) {
      return { ok: false, recorded: false, error: error.message };
    }

    markEventKeySent(dedupKey);
    const payload = (data ?? {}) as { recorded?: boolean; duplicate?: boolean };
    return {
      ok: true,
      recorded: Boolean(payload.recorded),
      duplicate: Boolean(payload.duplicate),
    };
  } catch (err) {
    return {
      ok: false,
      recorded: false,
      error: err instanceof Error ? err.message : '스토리 이벤트 기록 실패',
    };
  }
}

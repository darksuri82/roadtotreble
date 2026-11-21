import type { LeagueId, MatchResult } from './league';

export type CupStageId = 'r16' | 'qf' | 'sf' | 'final';

export interface CupMeta {
  leagueId: LeagueId;
  id: string;
  name: string;
  koreanName: string;
  accentColor: string;
}

export interface CupMatchNode {
  id: string;
  stage: CupStageId;
  matchIndex: number; // 0..7 for r16, 0..3 for qf, 0..1 for sf, 0 for final
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  result?: MatchResult;
  winnerId?: string;
}

export interface DomesticCupState {
  meta: CupMeta;
  triggerRounds: [number, number, number, number]; // e.g. [8, 16, 24, 32] or [7, 14, 22, 29]
  participantIds: string[]; // 16 clubs
  currentStage: CupStageId;
  pendingStage: CupStageId | null; // non-null when user must play/resolve this cup stage before next league round
  rounds: Record<CupStageId, CupMatchNode[]>;
  userEliminatedAt: CupStageId | null;
  championTeamId: string | null;
  completed: boolean;
}

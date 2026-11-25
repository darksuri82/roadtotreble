import type { Club } from '../../../types/league';
import type { MpCastLive, MpLeagueHuman } from '../../../types/mpLeague';
import type { UclKnockoutTie } from '../../../types/ucl';
import type { LiveTieOverlay } from '../../ucl/UclBracketTree';
import { UclMulticastPopupBoard } from '../../ucl/UclMulticastPopupBoard';

export interface MpUclMulticastBoardProps {
  cast: MpCastLive;
  clubsById: Record<string, Club>;
  humans: MpLeagueHuman[];
  myClubId: string | null;
  /** Render inline inside the dashboard (above the live bracket) instead of a blocking full-screen modal */
  inline?: boolean;
  /** Pre-match ties used to map home/away goals to Team A / Team B for live bracket overlays */
  bracketTies?: UclKnockoutTie[];
  /** Emits live bracket tie overlays as the wall-clock match stream progresses */
  onLiveOverlays?: (overlays: Record<string, LiveTieOverlay>, settled: boolean) => void;
}

/**
 * Multiplayer UCL live multicast scoreboard.
 * Thin wrapper around the shared UclMulticastPopupBoard with NO solo pause/takeover controls,
 * preserving exact host-synchronized wall-clock timing & PK reveal cadence.
 */
export function MpUclMulticastBoard(props: MpUclMulticastBoardProps) {
  return (
    <UclMulticastPopupBoard
      cast={props.cast}
      clubsById={props.clubsById}
      humans={props.humans}
      myClubId={props.myClubId}
      inline={props.inline}
      bracketTies={props.bracketTies}
      onLiveOverlays={props.onLiveOverlays}
      backdropZClass="z-[75]"
      boardId="mp-ucl-multicast-board"
    />
  );
}

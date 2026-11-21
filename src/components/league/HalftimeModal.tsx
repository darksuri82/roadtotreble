import type { Club } from '../../types/league';
import { LiveMatchBroadcast } from './LiveMatchBroadcast';

interface HalftimeModalProps {
  clubsById: Record<string, Club>;
}

/**
 * Legacy export preserved for backwards compatibility; delegates to LiveMatchBroadcast
 * which seamlessly handles 1st Half (0'->45'), Halftime Locker Room, and 2nd Half (46'->90').
 */
export function HalftimeModal({ clubsById }: HalftimeModalProps) {
  return <LiveMatchBroadcast clubsById={clubsById} />;
}

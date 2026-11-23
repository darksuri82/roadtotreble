import { X } from 'lucide-react';
import { ModalBodyLock } from '../../../hooks/useBodyScrollLock';
import type { MpFriendRankRow, MpLeagueHuman } from '../../../types/mpLeague';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { PixelTrophySvg } from '../../common/PixelTrophySvg';

interface MpLeagueDuelResultPopupProps {
  /** Sorted: rank 1 then rank 2 */
  rows: MpFriendRankRow[];
  humans: MpLeagueHuman[];
  myClubId: string | null;
  onClose: () => void;
}

const DUEL_KEYFRAMES = `
@keyframes mplDuelSob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(1.5px); }
}
`;

interface DuelLineCtx {
  winner: string;
  loser: string;
  club: string;
  diff: number;
}

type DuelLine = (ctx: DuelLineCtx) => string;

const WINNER_LINES: DuelLine[] = [
  () => '최종 승자는 저입니다!',
  ({ club }) => `${club}, 정상에 섰습니다!`,
  () => '시즌 내내 한 수 위였죠',
  () => '트로피는 제가 챙겨 갑니다',
  () => '이것이 명장의 클래스죠',
  () => '둘 중 하나는 웃어야죠, 저요!',
];

const TEASE_LINES: DuelLine[] = [
  ({ loser }) => `${loser} 감독님, 전술판 거꾸로 드셨죠?`,
  ({ loser }) => `${loser} 감독님, 다음 시즌엔 분발하세요~`,
  () => '둘 중에 2등이면 꼴찌 맞죠?',
  ({ loser }) => `${loser} 감독님, 수업료는 안 받을게요`,
  () => '울지 마요, 준우승도 상은 상이죠',
  ({ loser }) => `${loser} 감독님, 따라오다 지치셨나요?`,
];

function findHuman(
  humans: MpLeagueHuman[],
  row: MpFriendRankRow,
): MpLeagueHuman | undefined {
  return (
    humans.find((h) => h.playerId === row.playerId) ??
    humans.find((h) => h.clubId === row.clubId)
  );
}

/** Same seed on every client: char codes of clubId + total score. */
function lineSeed(row: MpFriendRankRow): number {
  let sum = 0;
  for (let i = 0; i < row.clubId.length; i += 1) {
    sum += row.clubId.charCodeAt(i);
  }
  const total = Number.isFinite(row.total) ? Math.abs(Math.round(row.total)) : 0;
  return sum + total;
}

function MeChip() {
  return (
    <span className="shrink-0 rounded border border-sky-400/45 bg-sky-500/15 px-1 text-[9px] font-black leading-4 text-sky-200">
      나
    </span>
  );
}

function RecordLine({ row }: { row: MpFriendRankRow }) {
  return (
    <div className="font-mono text-[10px] font-bold tabular-nums text-slate-400">
      {row.h2h.won}승 {row.h2h.drawn}무 {row.h2h.lost}패
    </div>
  );
}

export function MpLeagueDuelResultPopup({
  rows,
  humans,
  myClubId,
  onClose,
}: MpLeagueDuelResultPopupProps) {
  if (rows.length !== 2) return null;

  const [winRow, loseRow] = rows;
  const winner = findHuman(humans, winRow);
  const loser = findHuman(humans, loseRow);
  const winnerNick = winner?.nickname ?? '감독';
  const loserNick = loser?.nickname ?? '감독';
  const diff = Math.max(0, Math.round(winRow.total - loseRow.total));

  const ctx: DuelLineCtx = {
    winner: winnerNick,
    loser: loserNick,
    club: winner?.profile.name ?? '우리 팀',
    diff,
  };
  const cheerLine = WINNER_LINES[lineSeed(winRow) % WINNER_LINES.length](ctx);
  const teaseLine = TEASE_LINES[lineSeed(loseRow) % TEASE_LINES.length](ctx);

  const iWon = myClubId !== null && myClubId === winRow.clubId;
  const iLost = myClubId !== null && myClubId === loseRow.clubId;
  const cardBorder = iWon
    ? 'border-emerald-500/45'
    : iLost
      ? 'border-rose-500/45'
      : 'border-slate-800';

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/88 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="최종 결과"
    >
      <ModalBodyLock />
      <style>{DUEL_KEYFRAMES}</style>
      <div
        className={`modal-panel modal-scroll w-full max-w-lg overflow-y-auto rounded-2xl border bg-[#0d131c] p-4 shadow-2xl ${cardBorder}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="text-sm font-extrabold text-white">최종 결과</h3>
            {iWon && (
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-black text-emerald-300">
                우승
              </span>
            )}
            {iLost && (
              <span className="rounded-md border border-rose-500/40 bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-black text-rose-300">
                패배
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="cursor-pointer rounded-lg border border-slate-800 bg-[#111822] p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
          {/* Winner */}
          <div className="flex min-w-0 flex-col items-center text-center">
            <div
              className="mb-1"
              style={{ animation: 'pixelFloat 2.4s ease-in-out infinite' }}
            >
              <PixelTrophySvg variant="league" size={26} />
            </div>
            <div
              className="leading-none"
              style={{ animation: 'pixelFloat 2.4s ease-in-out infinite' }}
            >
              <PixelManagerAvatar
                avatar={winner?.avatar}
                clubPrimaryColor={winner?.profile.primaryColor}
                clubSecondaryColor={winner?.profile.secondaryColor}
                size={84}
                className="block"
                expression="cheer_grin"
                pose="arms_up_cheer"
              />
            </div>
            <div className="mt-2 flex max-w-full items-center justify-center gap-1">
              <span className="min-w-0 truncate text-xs font-extrabold text-white">
                {winnerNick}
              </span>
              {iWon && <MeChip />}
            </div>
            <div className="max-w-full truncate text-[10px] font-bold text-amber-300/85">
              {winner?.profile.name ?? '-'}
            </div>
            <div className="mt-0.5 font-mono text-base font-black tabular-nums text-amber-300">
              {winRow.total.toLocaleString()}
            </div>
            <RecordLine row={winRow} />
          </div>

          {/* Gap */}
          <div className="flex flex-col items-center self-center px-1">
            <span className="text-[9px] font-bold text-slate-500">점수 차</span>
            <span className="font-mono text-lg font-black tabular-nums text-emerald-300">
              +{diff.toLocaleString()}
            </span>
          </div>

          {/* Loser */}
          <div className="flex min-w-0 flex-col items-center text-center">
            <div
              className="leading-none"
              style={{ animation: 'mplDuelSob 0.5s ease-in-out infinite' }}
            >
              <PixelManagerAvatar
                avatar={loser?.avatar}
                clubPrimaryColor={loser?.profile.primaryColor}
                clubSecondaryColor={loser?.profile.secondaryColor}
                size={72}
                className="block"
                expression="crying_wail"
                pose="hands_on_head_despair"
              />
            </div>
            <div className="mt-2 flex max-w-full items-center justify-center gap-1">
              <span className="min-w-0 truncate text-xs font-extrabold text-slate-200">
                {loserNick}
              </span>
              {iLost && <MeChip />}
            </div>
            <div className="max-w-full truncate text-[10px] font-bold text-slate-500">
              {loser?.profile.name ?? '-'}
            </div>
            <div className="mt-0.5 font-mono text-base font-black tabular-nums text-slate-300">
              {loseRow.total.toLocaleString()}
            </div>
            <RecordLine row={loseRow} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-lg border border-amber-400/35 bg-[#111822] px-2 py-1.5 text-center text-[11px] font-bold leading-snug break-keep text-amber-100">
            {cheerLine}
          </div>
          <div className="min-w-0 rounded-lg border border-slate-700 bg-[#111822] px-2 py-1.5 text-center text-[11px] font-bold leading-snug break-keep text-slate-200">
            <div className="truncate text-[9px] font-black text-amber-300/80">
              {winnerNick} →
            </div>
            {teaseLine}
          </div>
        </div>
      </div>
    </div>
  );
}

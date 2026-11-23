import { X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { ModalBodyLock } from '../../../hooks/useBodyScrollLock';
import type { MpFriendRankRow, MpLeagueHuman } from '../../../types/mpLeague';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { PixelTrophySvg } from '../../common/PixelTrophySvg';

interface MpLeaguePodiumPopupProps {
  rows: MpFriendRankRow[];
  humans: MpLeagueHuman[];
  onClose: () => void;
}

const PODIUM_KEYFRAMES = `
@keyframes mplTearFall {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  18% { transform: translateY(1px) scale(1); opacity: 1; }
  100% { transform: translateY(var(--mpl-tear-drop, 18px)) scale(0.85); opacity: 0; }
}
@keyframes mplSob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(1.5px); }
}
`;

type PodiumRank = 1 | 2 | 3 | 4;

interface PodiumLineCtx {
  /** Nickname of the friend ranked directly above */
  up: string;
  /** Nickname of the friend ranked directly below */
  down: string;
}

type PodiumLine = (ctx: PodiumLineCtx) => string;

const PODIUM_LINES: Record<3 | 4, Partial<Record<PodiumRank, PodiumLine[]>>> = {
  3: {
    1: [
      () => '트로피는 내 겁니다!',
      () => '이게 바로 클래스죠',
      ({ down }) => `${down}, 잘 보고 배워요`,
      () => '1위 자리 공기 좋네요',
      () => '다들 수고, 우승은 나',
    ],
    2: [
      () => '한 끗 차이였는데...',
      ({ up }) => `${up}, 다음엔 내 차례`,
      () => '아깝다, 딱 한 걸음',
      () => '은메달도 메달이죠..',
      ({ up }) => `${up} 운이 좋았네요`,
    ],
    3: [
      () => '으아앙 꼴찌라니!',
      () => '내 시즌 돌려줘요..',
      () => '한 판만 더 해요 제발',
      ({ up }) => `${up}한테도 지다니..`,
      () => '흑흑 단상 끝자리..',
    ],
  },
  4: {
    1: [
      () => '넷 중에 내가 최고!',
      () => '왕좌는 역시 내 자리',
      ({ down }) => `${down}, 아쉽겠네요~`,
      () => '우승컵 무겁네요 하하',
      () => '셋 다 한 수 배웠죠?',
    ],
    2: [
      () => '거의 다 잡았는데...',
      ({ up }) => `${up}, 딱 기다려요`,
      () => '2위라니, 분하다..',
      () => '우승이 눈앞이었는데',
      ({ up }) => `${up}만 없었어도..`,
    ],
    3: [
      () => '휴, 꼴찌는 면했다..',
      ({ down }) => `${down}보단 낫잖아요`,
      () => '단상이라 다행인데..',
      () => '웃어야 할지 울지..',
      () => '3위도 눈물은 나네요',
    ],
    4: [
      () => '바닥이 참 차갑네요..',
      () => '단상이 저리 높았나..',
      ({ up }) => `${up}, 자리 바꿔요..`,
      () => '다 끝났어, 다 끝..',
      () => '꼴찌라니, 꿈이죠?',
    ],
  },
};

function shortNick(human: MpLeagueHuman | undefined): string {
  const nick = (human?.nickname ?? '').trim() || '감독';
  return nick.length > 6 ? nick.slice(0, 6) : nick;
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

function pickPodiumLine(
  rows: MpFriendRankRow[],
  humans: MpLeagueHuman[],
  index: number,
): string {
  const count: 3 | 4 = rows.length >= 4 ? 4 : 3;
  const row = rows[index];
  const pool = PODIUM_LINES[count][(index + 1) as PodiumRank];
  if (!row || !pool || pool.length === 0) return '';
  const upRow = rows[index - 1];
  const downRow = index + 1 < count ? rows[index + 1] : undefined;
  return pool[lineSeed(row) % pool.length]({
    up: shortNick(upRow ? findHuman(humans, upRow) : undefined),
    down: shortNick(downRow ? findHuman(humans, downRow) : undefined),
  });
}

const BUBBLE_TONE: Record<PodiumRank, string> = {
  1: 'border-amber-400/40 text-amber-100',
  2: 'border-slate-600 text-slate-200',
  3: 'border-sky-400/35 text-sky-100',
  4: 'border-sky-400/35 text-sky-100',
};

function SpeechBubble({ text, rank }: { text: string; rank: PodiumRank }) {
  if (!text) return null;
  return (
    <div
      className={`relative mb-2 max-w-full rounded-lg border bg-[#111822] px-1.5 py-1 text-center text-[10px] font-bold leading-tight break-keep ${BUBBLE_TONE[rank]}`}
    >
      {text}
      <span
        className="absolute left-1/2 top-full -mt-[4px] h-1.5 w-1.5 -translate-x-1/2 rotate-45 border-b border-r border-inherit bg-[#111822]"
        aria-hidden="true"
      />
    </div>
  );
}

function findHuman(
  humans: MpLeagueHuman[],
  row: MpFriendRankRow,
): MpLeagueHuman | undefined {
  return (
    humans.find((h) => h.playerId === row.playerId) ??
    humans.find((h) => h.clubId === row.clubId)
  );
}

/** Tear overlay placed over the avatar's eye area (avatar art itself is untouched). */
function TearOverlay({
  avatarSize,
  strong = false,
}: {
  avatarSize: number;
  strong?: boolean;
}) {
  const tearW = Math.max(3, Math.round(avatarSize * 0.07));
  const tearH = Math.round(tearW * 1.5);
  const drop = Math.round(avatarSize * (strong ? 0.5 : 0.36));
  const duration = strong ? 0.8 : 1.5;
  const eyes = [36, 64];
  const tears: { left: number; delay: number }[] = [];
  eyes.forEach((left, eyeIdx) => {
    const perEye = strong ? 2 : 1;
    for (let i = 0; i < perEye; i += 1) {
      tears.push({
        left: left + (strong ? (i === 0 ? -2 : 2) : 0),
        delay: eyeIdx * (duration / 3) + i * (duration / 2),
      });
    }
  });

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {tears.map((t, idx) => (
        <span
          key={idx}
          className="absolute bg-sky-300"
          style={
            {
              left: `${t.left}%`,
              top: '44%',
              width: tearW,
              height: tearH,
              marginLeft: -tearW / 2,
              borderRadius: '50% 50% 50% 50% / 65% 65% 35% 35%',
              opacity: 0,
              animation: `mplTearFall ${duration}s ease-in ${t.delay.toFixed(2)}s infinite`,
              '--mpl-tear-drop': `${drop}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function NameAndScore({
  human,
  row,
  rankLabel,
}: {
  human: MpLeagueHuman | undefined;
  row: MpFriendRankRow;
  rankLabel?: string;
}) {
  return (
    <div className="mt-1.5 w-full text-center">
      <div className="truncate text-[11px] font-extrabold text-white">
        {human?.nickname ?? '감독'}
      </div>
      {rankLabel && (
        <div className="text-[10px] font-bold text-slate-500">{rankLabel}</div>
      )}
      <div className="font-mono text-[11px] font-bold text-slate-300">
        {row.total.toLocaleString()}
      </div>
    </div>
  );
}

const STEP_STYLE: Record<1 | 2 | 3, { height: string; border: string; text: string }> = {
  1: { height: 'h-24', border: 'border-t-amber-400', text: 'text-amber-300' },
  2: { height: 'h-16', border: 'border-t-slate-300', text: 'text-slate-300' },
  3: { height: 'h-10', border: 'border-t-orange-700', text: 'text-orange-400' },
};

function PodiumColumn({
  place,
  row,
  human,
  line,
}: {
  place: 1 | 2 | 3;
  row: MpFriendRankRow;
  human: MpLeagueHuman | undefined;
  line: string;
}) {
  const size = place === 1 ? 64 : 56;
  const step = STEP_STYLE[place];
  return (
    <div className="flex w-24 min-w-0 flex-col items-center sm:w-28">
      <SpeechBubble text={line} rank={place} />
      {place === 1 && (
        <div
          className="mb-1"
          style={{ animation: 'pixelFloat 2.4s ease-in-out infinite' }}
        >
          <PixelTrophySvg variant="league" size={26} />
        </div>
      )}
      <div className="relative leading-none">
        <PixelManagerAvatar
          avatar={human?.avatar}
          clubPrimaryColor={human?.profile.primaryColor}
          clubSecondaryColor={human?.profile.secondaryColor}
          size={size}
          className="block"
          expression={place === 1 ? 'cheer_grin' : place === 3 ? 'crying_wail' : 'default'}
          pose={place === 1 ? 'arms_up_cheer' : 'default'}
        />
        {place === 3 && <TearOverlay avatarSize={size} />}
      </div>
      <div
        className={`flex w-full items-center justify-center rounded-t-md border border-t-4 border-slate-800 bg-[#111822] ${step.height} ${step.border}`}
      >
        <span className={`font-mono text-2xl font-black ${step.text}`}>
          {place}
        </span>
      </div>
      <NameAndScore human={human} row={row} />
    </div>
  );
}

function FloorCharacter({
  row,
  human,
  line,
}: {
  row: MpFriendRankRow;
  human: MpLeagueHuman | undefined;
  line: string;
}) {
  const size = 54;
  const fullH = Math.round((size * 34) / 28);
  const visibleH = Math.round(fullH * 0.8);
  return (
    <div className="flex w-24 min-w-0 flex-col items-center">
      <SpeechBubble text={line} rank={4} />
      {/* Floor line clips the lower body so the character reads as sitting on the ground */}
      <div
        className="relative w-full overflow-hidden border-b-2 border-slate-700"
        style={{ height: visibleH + 6 }}
      >
        <div
          className="absolute left-1/2 top-0"
          style={{ width: size, height: fullH, marginLeft: -size / 2 }}
        >
          <div style={{ animation: 'mplSob 0.5s ease-in-out infinite' }}>
            <div
              className="relative leading-none"
              style={{
                transform: `translateY(${Math.round(fullH * 0.1)}px) rotate(10deg)`,
                transformOrigin: '50% 100%',
              }}
            >
              <PixelManagerAvatar
                avatar={human?.avatar}
                clubPrimaryColor={human?.profile.primaryColor}
                clubSecondaryColor={human?.profile.secondaryColor}
                size={size}
                className="block"
                expression="crying_wail"
                pose="hands_on_head_despair"
              />
              <TearOverlay avatarSize={size} strong />
            </div>
          </div>
        </div>
      </div>
      {/* Puddle */}
      <div
        className="mt-0.5 rounded-[50%] bg-sky-400/35"
        style={{ width: size + 14, height: 7 }}
        aria-hidden="true"
      />
      <NameAndScore human={human} row={row} rankLabel="4위" />
    </div>
  );
}

export function MpLeaguePodiumPopup({
  rows,
  humans,
  onClose,
}: MpLeaguePodiumPopupProps) {
  if (rows.length < 3) return null;

  const [first, second, third] = rows;
  const fourth = rows.length >= 4 ? rows[3] : null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/88 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="최종 시상식"
    >
      <ModalBodyLock />
      <style>{PODIUM_KEYFRAMES}</style>
      <div className="modal-panel modal-scroll w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-[#0d131c] p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white">최종 시상식</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="cursor-pointer rounded-lg border border-slate-800 bg-[#111822] p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-end sm:justify-center sm:gap-4">
          <div className="flex items-end justify-center">
            <PodiumColumn
              place={2}
              row={second}
              human={findHuman(humans, second)}
              line={pickPodiumLine(rows, humans, 1)}
            />
            <PodiumColumn
              place={1}
              row={first}
              human={findHuman(humans, first)}
              line={pickPodiumLine(rows, humans, 0)}
            />
            <PodiumColumn
              place={3}
              row={third}
              human={findHuman(humans, third)}
              line={pickPodiumLine(rows, humans, 2)}
            />
          </div>
          {fourth && (
            <FloorCharacter
              row={fourth}
              human={findHuman(humans, fourth)}
              line={pickPodiumLine(rows, humans, 3)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

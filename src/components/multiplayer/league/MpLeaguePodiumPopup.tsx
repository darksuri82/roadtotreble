import { X } from 'lucide-react';
import type { CSSProperties } from 'react';
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
}: {
  place: 1 | 2 | 3;
  row: MpFriendRankRow;
  human: MpLeagueHuman | undefined;
}) {
  const size = place === 1 ? 64 : 56;
  const step = STEP_STYLE[place];
  return (
    <div className="flex w-24 min-w-0 flex-col items-center sm:w-28">
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
}: {
  row: MpFriendRankRow;
  human: MpLeagueHuman | undefined;
}) {
  const size = 54;
  const fullH = Math.round((size * 34) / 28);
  const visibleH = Math.round(fullH * 0.8);
  return (
    <div className="flex w-24 min-w-0 flex-col items-center">
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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/88 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="최종 시상식"
    >
      <style>{PODIUM_KEYFRAMES}</style>
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-[#0d131c] p-4 shadow-2xl">
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
            <PodiumColumn place={2} row={second} human={findHuman(humans, second)} />
            <PodiumColumn place={1} row={first} human={findHuman(humans, first)} />
            <PodiumColumn place={3} row={third} human={findHuman(humans, third)} />
          </div>
          {fourth && (
            <FloorCharacter row={fourth} human={findHuman(humans, fourth)} />
          )}
        </div>
      </div>
    </div>
  );
}

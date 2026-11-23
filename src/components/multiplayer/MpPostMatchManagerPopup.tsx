import {
  Flame,
  MessageSquareQuote,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { ModalBodyLock } from '../../hooks/useBodyScrollLock';
import type { ManagerAvatarConfig } from '../../types/game';
import { DEFAULT_MANAGER_AVATAR } from '../../types/game';
import type { MatchResult } from '../../types/league';
import type { MpRoomPlayerRow } from '../../types/multiplayer';
import { JerseySvg } from '../common/JerseySvg';
import {
  type ManagerExpressionId,
  type ManagerPoseId,
  PixelManagerAvatar,
  resolveManagerPalette,
} from '../common/PixelManagerAvatar';

export type MpMatchOutcome = 'WIN' | 'LOSS' | 'DRAW';

export type MpPostMatchSceneVariantId =
  | 'trophy_vs_turf_pound'
  | 'shades_vs_kneel_wail'
  | 'fireworks_vs_flat_soul'
  | 'crown_vs_otl_faceplant';

export interface MpPostMatchSceneMeta {
  id: MpPostMatchSceneVariantId;
  winnerCaption: string;
  loserCaption: string;
  winnerExpression: ManagerExpressionId;
  winnerPose: ManagerPoseId;
  loserMotion: 'turf_pound' | 'kneel_wail' | 'flat_soul_out' | 'otl_faceplant';
}

export const MP_POST_MATCH_SCENES: MpPostMatchSceneMeta[] = [
  {
    id: 'trophy_vs_turf_pound',
    winnerCaption: '🏆 트로피 번쩍 환호',
    loserCaption: '😭 엎드려 땅 치며 오열',
    winnerExpression: 'cheer_grin',
    winnerPose: 'arms_up_cheer',
    loserMotion: 'turf_pound',
  },
  {
    id: 'shades_vs_kneel_wail',
    winnerCaption: '😎 선글라스 팔짱 여유',
    loserCaption: '😱 무릎 꿇고 전술판 파손',
    winnerExpression: 'cool_shades',
    winnerPose: 'arms_crossed_smug',
    loserMotion: 'kneel_wail',
  },
  {
    id: 'fireworks_vs_flat_soul',
    winnerCaption: '✨ 어퍼컷 세리머니 & 축포',
    loserCaption: '👻 대자로 뻗어 영혼 가출',
    winnerExpression: 'smug_wink',
    winnerPose: 'fist_pump',
    loserMotion: 'flat_soul_out',
  },
  {
    id: 'crown_vs_otl_faceplant',
    winnerCaption: '👑 왕관 대관식 & 샴페인',
    loserCaption: '💦 땅에 얼굴 파묻고 좌절 (OTL)',
    winnerExpression: 'cheer_grin',
    winnerPose: 'arms_up_cheer',
    loserMotion: 'otl_faceplant',
  },
];

export function buildPostMatchDialoguePool(params: {
  outcome: MpMatchOutcome;
  myNickname: string;
  myClubName: string;
  oppNickname: string;
  oppClubName: string;
  myGoals: number;
  oppGoals: number;
  decidedByPenalties?: boolean;
}): string[] {
  const {
    outcome,
    myNickname,
    myClubName,
    oppNickname,
    oppClubName,
    myGoals,
    oppGoals,
    decidedByPenalties,
  } = params;

  if (outcome === 'WIN') {
    const margin = Math.max(0, myGoals - oppGoals);
    return [
      `전술판 위에서 이미 끝난 승부였습니다. 오늘 밤 주인공은 우리 ${myClubName}입니다!`,
      `${oppNickname} 감독님, 땅 치고 후회하셔도 늦었습니다! 오늘 수업료는 ${myGoals}골로 받겠습니다!`,
      decidedByPenalties
        ? `승부차기 마지막 키커까지 심장 쫄깃했네요! 결국 강심장은 우리 ${myClubName} 쪽이었습니다!`
        : margin >= 3
          ? `${myGoals}:${oppGoals} 대승! ${oppClubName} 수비진이 우리 공격수들 그림자만 밟다 끝났군요!`
          : `드래프트부터 전술 수싸움까지 단 한 순간도 밀리지 않은 완벽한 승리입니다!`,
      `완벽한 빌드업, 완벽한 마무리! 이것이 바로 명장 ${myNickname}의 클래스입니다.`,
      `${oppNickname} 감독님, 다음 판엔 포메이션 다시 짜오셔야겠습니다. 트로피는 제가 챙겨갑니다! 🏆`,
      `선수들이 전술 지시를 200% 수행해 줬습니다. ${myClubName} 팬들에게 바치는 승리입니다!`,
      `저기 잔디 치고 계신 ${oppNickname} 감독님께 위로의 박수 한 번 부탁드립니다!`,
    ];
  }

  if (outcome === 'LOSS') {
    const margin = Math.max(0, oppGoals - myGoals);
    return [
      `${myNickname} 감독님, 잔디 구멍 나겠습니다! 혹시 전술판 거꾸로 들고 계신 건 아니죠? 😎`,
      `연습 경기인 줄 알았습니다! ${myClubName} 수비 맛집이네요, 골 넣기 참 편했습니다~`,
      `드래프트 운 탓하기 없기입니다? 순수 전술 차이로 깔끔하게 한 수 가르쳐 드렸습니다!`,
      decidedByPenalties
        ? `승부차기에서 떨리는 거 여기까지 다 보였습니다! 멘탈 관리 좀 더 하고 오세요~ 🤭`
        : margin >= 3
          ? `${oppGoals}:${myGoals} 실화입니까? 오늘 경기 하이라이트 저장해 두셨다가 수비 교과서로 쓰세요!`
          : `이 스쿼드로 지는 것도 능력인데... 바로 재대결 버튼 누를 용기는 있으신가요? 🤭`,
      `아~ 숨도 안 차네요! ${myNickname} 감독님, 냉수 한 잔 마시고 전술 다시 짜오세요!`,
      `우리 ${oppClubName} 공격수들이 아직 몸도 덜 풀렸는데 경기가 끝나버렸네요. 한 판 더 하시죠?`,
      `땅 친다고 들어간 골이 취소되진 않습니다! 억울하면 리매치로 설욕해 보시죠!`,
    ];
  }

  return [
    `90분 동안 치열한 수싸움이었습니다! ${oppNickname} 감독님, 다음 판에서 진짜 승부를 가립시다!`,
    `한 치의 양보도 없는 명승부였네요. 바로 재대결로 끝장을 봅시다!`,
    `${myClubName} vs ${oppClubName}, 무승부로 끝내기엔 너무 아쉬운 매치업입니다!`,
  ];
}

export function pickPostMatchDialogue(
  pool: string[],
  seedText?: string,
  offset = 0,
): string {
  if (pool.length === 0) return '';
  if (!seedText) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  let hash = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  const idx = (hash + Math.max(0, offset)) % pool.length;
  return pool[idx];
}

/**
 * Renders the Losing Custom Manager in 4 hilarious full-body defeated pixel-art motions
 * (1: Turf-pounding on hands & knees, 2: Kneeling wail + snapped tactic board,
 *  3: Laid out flat on back with ghost soul escaping, 4: OTL face-planted in tears)
 * using the manager's exact custom skin tone, hair color/bald gleam, and outfit colors!
 */
function PixelDefeatedManagerMotionSvg({
  avatar,
  clubPrimaryColor,
  clubSecondaryColor,
  motion,
  width = 128,
}: {
  avatar?: Partial<ManagerAvatarConfig> | null;
  clubPrimaryColor: string;
  clubSecondaryColor: string;
  motion: MpPostMatchSceneMeta['loserMotion'];
  width?: number;
}) {
  const pal = resolveManagerPalette(
    avatar,
    clubPrimaryColor,
    clubSecondaryColor,
  );
  const { cfg, skin, hair, topMain, topShade, bottomMain, shoeMain } = pal;
  const isBald = cfg.hairStyle === 'bald';
  const O = '#141016';

  const W = 44;
  const H = 36;
  const pixels: (string | null)[][] = Array.from({ length: H }, () =>
    Array<string | null>(W).fill(null),
  );

  const px = (x: number, y: number, color: string) => {
    if (x >= 0 && x < W && y >= 0 && y < H) {
      pixels[y][x] = color;
    }
  };

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        px(x + dx, y + dy, color);
      }
    }
  };

  // Pitch turf strip at bottom (y=30..34)
  rect(2, 31, 40, 3, '#0f291e');
  rect(4, 31, 36, 1, '#10b981');

  if (motion === 'turf_pound') {
    // =======================================================================
    // MOTION 1: ON HANDS & KNEES POUNDING THE TURF (엎드려 땅 치며 오열)
    // =======================================================================
    // Dark storm cloud & rain drops overhead (y=2..11)
    rect(12, 2, 16, 4, '#334155');
    rect(10, 3, 20, 3, '#475569');
    rect(14, 1, 10, 2, '#64748b');
    px(13, 8, '#38bdf8');
    px(13, 9, '#38bdf8');
    px(19, 7, '#38bdf8');
    px(19, 8, '#38bdf8');
    px(25, 8, '#38bdf8');
    px(25, 9, '#38bdf8');

    // Tear puddle on the turf under face (x=6..15, y=30..32)
    rect(6, 30, 10, 2, '#38bdf8');
    rect(8, 30, 6, 1, '#bae6fd');

    // Horizontal torso on all fours (x=17..29, y=20..26)
    rect(17, 19, 13, 1, O);
    rect(17, 20, 12, 6, topMain);
    rect(18, 24, 11, 2, topShade);
    rect(17, 26, 12, 1, O);

    // Kneeling legs & shoes at right (x=28..38, y=23..31)
    rect(28, 22, 7, 5, bottomMain);
    rect(29, 27, 6, 4, bottomMain);
    rect(28, 30, 6, 1, O);
    rect(35, 25, 3, 6, shoeMain);
    rect(35, 24, 3, 1, O);

    // Back supporting arm planted on turf (x=17..19, y=26..31)
    rect(17, 26, 3, 3, topMain);
    rect(17, 29, 3, 2, skin.base);

    // Lowered head facing down toward turf (x=7..17, y=17..27)
    rect(8, 17, 9, 9, skin.base);
    rect(7, 18, 10, 7, skin.base);
    rect(8, 16, 9, 1, O);
    rect(7, 17, 1, 8, O);
    rect(8, 26, 9, 1, O);

    // Hair / Bald crown on top-left of lowered head
    if (isBald) {
      rect(9, 17, 7, 3, skin.base);
      rect(10, 18, 2, 1, '#ffffff');
    } else {
      rect(7, 16, 10, 5, hair.base);
      rect(9, 17, 6, 2, hair.highlight);
      rect(7, 18, 3, 6, hair.base);
      if (cfg.hairStyle === 'long_wave' || cfg.hairStyle === 'ponytail') {
        rect(14, 16, 6, 4, hair.base);
      }
    }

    // Crying face & waterfall tears pouring straight into the turf puddle!
    rect(10, 22, 3, 1, O); // shut crying eye
    rect(10, 23, 2, 7, '#38bdf8'); // tear stream 1
    px(11, 25, '#bae6fd');
    rect(14, 23, 2, 7, '#38bdf8'); // tear stream 2
    rect(12, 24, 2, 2, '#881337'); // wailing mouth

    // Raised/slamming left arm & fist pounding the ground! (x=3..8, y=22..30)
    rect(5, 23, 3, 4, topMain);
    rect(3, 27, 4, 3, skin.base);
    rect(3, 26, 4, 1, O);
    rect(3, 30, 4, 1, O);

    // Turf impact shockwaves & flying grass tufts around slamming fist!
    px(1, 27, '#fbbf24');
    px(2, 26, '#fde68a');
    px(1, 29, '#10b981');
    px(8, 28, '#fbbf24');
    px(9, 27, '#fde68a');
    px(2, 24, '#f43f5e');
    px(3, 23, '#f43f5e');
  } else if (motion === 'kneel_wail') {
    // =======================================================================
    // MOTION 2: KNEELING HEAD-CLUTCH WAIL + SNAPPED TACTIC BOARD (무릎 꿇고 절규)
    // =======================================================================
    // Purple gloom lines overhead (x=14..26, y=1..5)
    rect(14, 1, 1, 4, '#a855f7');
    rect(18, 2, 1, 4, '#9333ea');
    rect(22, 1, 1, 4, '#a855f7');
    rect(26, 2, 1, 4, '#9333ea');

    // Head (x=14..25, y=7..17)
    rect(14, 7, 12, 10, skin.base);
    rect(14, 6, 12, 1, O);
    rect(13, 8, 1, 8, O);
    rect(26, 8, 1, 8, O);
    rect(15, 17, 10, 1, O);

    if (isBald) {
      rect(16, 8, 3, 1, '#ffffff');
    } else {
      rect(14, 6, 12, 4, hair.base);
      rect(16, 7, 8, 1, hair.highlight);
    }

    // Crying eyes + sideways fountain tears shooting left & right!
    rect(16, 12, 3, 1, O);
    rect(21, 12, 3, 1, O);
    // Fountain tear arcs
    rect(9, 12, 5, 2, '#38bdf8');
    rect(7, 14, 3, 4, '#38bdf8');
    rect(26, 12, 5, 2, '#38bdf8');
    rect(30, 14, 3, 4, '#38bdf8');
    // Wailing mouth
    rect(18, 14, 4, 2, '#881337');
    rect(18, 14, 4, 1, '#ffffff');

    // Both hands clutching sides of head (x=11..13 & x=26..28, y=9..18)
    rect(11, 12, 2, 7, topMain);
    rect(11, 9, 2, 3, skin.base);
    rect(27, 12, 2, 7, topMain);
    rect(27, 9, 2, 3, skin.base);

    // Torso (x=14..25, y=18..26)
    rect(14, 18, 12, 8, topMain);
    rect(19, 18, 2, 6, clubSecondaryColor);

    // Folded kneeling legs on the turf (x=12..27, y=26..31)
    rect(12, 26, 16, 4, bottomMain);
    rect(11, 29, 3, 2, shoeMain);
    rect(26, 29, 3, 2, shoeMain);

    // Broken tactic board snapped in two on the grass (x=31..41, y=27..31)
    rect(31, 27, 4, 4, '#e2e8f0');
    rect(32, 28, 2, 2, '#0f172a');
    rect(37, 28, 4, 3, '#e2e8f0');
    rect(38, 29, 2, 1, '#ef4444');
  } else if (motion === 'flat_soul_out') {
    // =======================================================================
    // MOTION 3: LAID FLAT ON BACK ON GRASS + GHOST SOUL FLOATING OUT (영혼 가출)
    // =======================================================================
    // Floating translucent white/cyan pixel ghost soul rising above body! (x=18..27, y=2..14)
    rect(20, 3, 6, 7, '#e0f2fe');
    rect(19, 5, 8, 5, '#bae6fd');
    rect(21, 10, 4, 3, '#7dd3fc');
    px(22, 13, '#7dd3fc');
    px(23, 15, '#38bdf8');
    // Soul eyes
    px(21, 6, '#0f172a');
    px(24, 6, '#0f172a');
    rect(22, 8, 2, 1, '#0f172a');

    // Manager lying flat horizontally on back on the pitch (x=6..38, y=22..31)
    // Head on left (x=6..15, y=21..30)
    rect(7, 21, 9, 9, skin.base);
    rect(6, 22, 1, 7, O);
    rect(7, 20, 9, 1, O);
    rect(7, 30, 9, 1, O);

    if (isBald) {
      rect(7, 22, 3, 7, skin.base);
      px(8, 23, '#ffffff');
    } else {
      rect(6, 21, 4, 9, hair.base);
      rect(7, 20, 6, 2, hair.base);
    }

    // Dizzy X-eyes & open gasping mouth facing up
    px(11, 23, O);
    px(13, 23, O);
    px(12, 24, O);
    px(11, 25, O);
    px(13, 25, O);
    rect(14, 24, 2, 3, '#881337');

    // Horizontal torso on back (x=16..28, y=23..30)
    rect(16, 23, 12, 7, topMain);
    rect(16, 22, 12, 1, O);
    rect(16, 30, 12, 1, O);
    // Arms splayed flat
    rect(18, 28, 8, 2, topShade);
    rect(25, 28, 2, 2, skin.base);

    // Legs & shoes pointing up at right (x=28..38, y=24..30)
    rect(28, 24, 7, 6, bottomMain);
    rect(28, 23, 7, 1, O);
    rect(35, 22, 3, 8, shoeMain);
    rect(35, 21, 3, 1, O);
  } else {
    // =======================================================================
    // MOTION 4: OTL FACE-PLANTED ON THE TURF (땅에 얼굴 파묻고 좌절 OTL)
    // =======================================================================
    // Despair lightning & dark cloud overhead (x=14..28, y=2..10)
    rect(15, 2, 12, 4, '#1e1b4b');
    rect(13, 3, 16, 3, '#312e81');
    px(20, 7, '#facc15');
    px(19, 8, '#facc15');
    px(20, 9, '#facc15');
    px(19, 10, '#facc15');

    // Face planted flat on the grass (x=7..16, y=23..31)
    rect(7, 30, 11, 2, '#38bdf8'); // tear puddle
    rect(8, 23, 8, 7, skin.base);
    rect(8, 22, 8, 1, O);
    if (!isBald) {
      rect(8, 22, 8, 4, hair.base);
      rect(9, 23, 5, 1, hair.highlight);
    } else {
      rect(10, 23, 2, 1, '#ffffff');
    }
    // Hands planted flat beside head (x=5..8, y=29..31)
    rect(5, 29, 3, 2, skin.base);

    // Arched back / torso sloping upward toward hips (x=16..28, y=18..27)
    rect(16, 20, 6, 7, topMain);
    rect(21, 18, 8, 8, topMain);
    rect(16, 19, 6, 1, O);
    rect(21, 17, 8, 1, O);
    // Arms reaching down to ground
    rect(14, 24, 3, 6, topShade);

    // Bent kneeling legs & shoes at right (x=28..37, y=20..31)
    rect(28, 20, 5, 10, bottomMain);
    rect(33, 28, 4, 3, shoeMain);
    rect(28, 30, 9, 1, O);
  }

  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  for (let y = 0; y < H; y += 1) {
    let x = 0;
    while (x < W) {
      const col = pixels[y][x];
      if (!col) {
        x += 1;
        continue;
      }
      let w = 1;
      while (x + w < W && pixels[y][x + w] === col) {
        w += 1;
      }
      rects.push({ x, y, w, fill: col });
      x += w;
    }
  }

  return (
    <svg
      width={width}
      height={Math.round((width * H) / W)}
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      className="pixel-crisp select-none"
      aria-label="패장 좌절 도트 모션"
    >
      {rects.map((r, idx) => (
        <rect
          key={idx}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={r.fill}
        />
      ))}
    </svg>
  );
}

interface MpPostMatchManagerPopupProps {
  matchId: string;
  outcome: MpMatchOutcome;
  myRow: MpRoomPlayerRow;
  oppRow: MpRoomPlayerRow;
  myGoals: number;
  oppGoals: number;
  finalResult: MatchResult;
  seriesSummaryText: string;
  onClose: () => void;
}

export function MpPostMatchManagerPopup({
  matchId,
  outcome,
  myRow,
  oppRow,
  myGoals,
  oppGoals,
  finalResult,
  seriesSummaryText,
  onClose,
}: MpPostMatchManagerPopupProps) {
  const pen = finalResult.extraTime?.penalties;
  const myPenScore = pen
    ? finalResult.homeTeamId === 'mp-host'
      ? myRow.seat === 0 || myRow.seat === 1
        ? pen.homePenGoals
        : pen.awayPenGoals
      : pen.homePenGoals
    : null;
  const oppPenScore = pen
    ? myPenScore === pen.homePenGoals
      ? pen.awayPenGoals
      : pen.homePenGoals
    : null;

  const pool = buildPostMatchDialoguePool({
    outcome,
    myNickname: myRow.nickname,
    myClubName: myRow.club_profile.name,
    oppNickname: oppRow.nickname,
    oppClubName: oppRow.club_profile.name,
    myGoals,
    oppGoals,
    decidedByPenalties: Boolean(pen),
  });

  // Pick a random dialogue quote AND a random pixel-art scene variation once per popup mount!
  const [randomQuote] = useState<string>(() => {
    void matchId;
    if (pool.length === 0) return '';
    return pool[Math.floor(Math.random() * pool.length)];
  });

  const [randomScene] = useState<MpPostMatchSceneMeta>(() => {
    const idx = Math.floor(Math.random() * MP_POST_MATCH_SCENES.length);
    return MP_POST_MATCH_SCENES[idx];
  });

  const winnerRow = outcome === 'LOSS' ? oppRow : myRow;
  const loserRow = outcome === 'LOSS' ? myRow : oppRow;
  const speakerRow = outcome === 'LOSS' ? oppRow : myRow;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-3 sm:p-4">
      <ModalBodyLock />
      <div
        className={`modal-panel modal-scroll relative w-full max-w-xl overflow-y-auto overflow-x-hidden rounded-2xl border shadow-2xl ${
          outcome === 'WIN'
            ? 'border-amber-400/55 bg-gradient-to-b from-[#17160d] via-[#0e1520] to-[#0b1018] shadow-[0_0_32px_rgba(251,191,36,0.22)]'
            : outcome === 'LOSS'
              ? 'border-rose-500/50 bg-gradient-to-b from-[#211017] via-[#0e141e] to-[#0b1018] shadow-[0_0_32px_rgba(244,63,94,0.20)]'
              : 'border-sky-400/45 bg-gradient-to-b from-[#0e1b29] via-[#0d141f] to-[#0b1018]'
        }`}
      >
        {/* Top Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-lg border border-slate-700/80 bg-slate-900/90 p-1.5 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Header Badge & Scoreboard */}
          <div className="flex flex-col items-center text-center space-y-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${
                outcome === 'WIN'
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                  : outcome === 'LOSS'
                    ? 'border-rose-400/50 bg-rose-500/15 text-rose-300'
                    : 'border-sky-400/45 bg-sky-500/15 text-sky-300'
              }`}
            >
              {outcome === 'WIN' ? (
                <>
                  <Trophy className="h-3.5 w-3.5" />
                  VICTORY · 1대1 대전 승리!
                </>
              ) : outcome === 'LOSS' ? (
                <>
                  <Flame className="h-3.5 w-3.5" />
                  RIVAL TAUNT · 상대 감독의 도발!
                </>
              ) : (
                <>
                  <Swords className="h-3.5 w-3.5" />
                  FULL TIME · 치열한 무승부
                </>
              )}
            </span>

            {/* Scoreboard Strip */}
            <div className="mt-1 flex items-center justify-center gap-3 rounded-xl border border-slate-800/90 bg-slate-950/75 px-4 py-2">
              <div className="flex items-center gap-1.5">
                <JerseySvg
                  primaryColor={myRow.club_profile.primaryColor}
                  secondaryColor={myRow.club_profile.secondaryColor}
                  pattern={myRow.club_profile.pattern}
                  label={myRow.club_profile.shortName}
                  size={24}
                />
                <span className="max-w-[110px] truncate text-xs font-extrabold text-white">
                  {myRow.club_profile.name}
                </span>
              </div>

              <div className="font-display text-xl sm:text-2xl font-black text-white tabular-nums px-1.5">
                <span
                  className={
                    outcome === 'WIN' ? 'text-emerald-400' : 'text-white'
                  }
                >
                  {myGoals}
                </span>
                <span className="mx-1 text-slate-500">:</span>
                <span
                  className={
                    outcome === 'LOSS' ? 'text-rose-400' : 'text-white'
                  }
                >
                  {oppGoals}
                </span>
                {pen && myPenScore !== null && oppPenScore !== null && (
                  <div className="text-[10px] font-bold text-amber-300">
                    (PK {myPenScore}:{oppPenScore})
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="max-w-[110px] truncate text-xs font-extrabold text-white">
                  {oppRow.club_profile.name}
                </span>
                <JerseySvg
                  primaryColor={oppRow.club_profile.primaryColor}
                  secondaryColor={oppRow.club_profile.secondaryColor}
                  pattern={oppRow.club_profile.pattern}
                  label={oppRow.club_profile.shortName}
                  size={24}
                />
              </div>
            </div>
          </div>

          {/* Dual Custom Manager Stage: Winner Celebrating vs Loser Defeated Motion! */}
          {outcome === 'DRAW' ? (
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800/90 bg-[#090e15] p-4">
              <div className="flex flex-col items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-[#101824] p-3">
                <PixelManagerAvatar
                  avatar={myRow.avatar_json ?? DEFAULT_MANAGER_AVATAR}
                  clubPrimaryColor={myRow.club_profile.primaryColor}
                  clubSecondaryColor={myRow.club_profile.secondaryColor}
                  expression="fierce_glare"
                  pose="arms_crossed_smug"
                  size={74}
                />
                <div className="text-xs font-extrabold text-white">
                  {myRow.nickname} 감독
                </div>
                <div className="text-[10px] text-slate-400">
                  {myRow.club_profile.name}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1.5 rounded-xl border border-sky-500/35 bg-[#101824] p-3">
                <PixelManagerAvatar
                  avatar={oppRow.avatar_json ?? DEFAULT_MANAGER_AVATAR}
                  clubPrimaryColor={oppRow.club_profile.primaryColor}
                  clubSecondaryColor={oppRow.club_profile.secondaryColor}
                  expression="fierce_glare"
                  pose="arms_crossed_smug"
                  size={74}
                />
                <div className="text-xs font-extrabold text-white">
                  {oppRow.nickname} 감독
                </div>
                <div className="text-[10px] text-slate-400">
                  {oppRow.club_profile.name}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Left: Winning Custom Manager Celebrating */}
              <div className="relative flex flex-col items-center justify-between rounded-2xl border border-amber-400/50 bg-gradient-to-b from-amber-950/25 via-[#0e1622] to-[#090e15] p-3.5 shadow-[0_0_20px_rgba(251,191,36,0.16)]">
                <div className="flex w-full items-center justify-between text-[10px] font-extrabold">
                  <span className="rounded bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-amber-300">
                    🏆 WINNER · 승장
                  </span>
                  <span className="text-amber-200/90">
                    {randomScene.winnerCaption}
                  </span>
                </div>

                {/* Celebration Stage with Confetti & Custom Posed Winner Avatar */}
                <div className="relative my-2 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border border-amber-400/25 bg-[#0b121c]">
                  {/* Pixel Confetti Dots */}
                  <span className="pointer-events-none absolute top-2 left-3 h-1.5 w-1.5 bg-amber-300" />
                  <span className="pointer-events-none absolute top-4 left-9 h-1.5 w-1.5 bg-emerald-400" />
                  <span className="pointer-events-none absolute top-2 right-4 h-1.5 w-1.5 bg-sky-400" />
                  <span className="pointer-events-none absolute top-5 right-10 h-1.5 w-1.5 bg-rose-400" />
                  <span className="pointer-events-none absolute bottom-4 left-5 h-1.5 w-1.5 bg-amber-400" />
                  <span className="pointer-events-none absolute bottom-3 right-6 h-1.5 w-1.5 bg-emerald-300" />

                  <PixelManagerAvatar
                    avatar={winnerRow.avatar_json ?? DEFAULT_MANAGER_AVATAR}
                    clubPrimaryColor={winnerRow.club_profile.primaryColor}
                    clubSecondaryColor={winnerRow.club_profile.secondaryColor}
                    expression={randomScene.winnerExpression}
                    pose={randomScene.winnerPose}
                    size={80}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <JerseySvg
                    primaryColor={winnerRow.club_profile.primaryColor}
                    secondaryColor={winnerRow.club_profile.secondaryColor}
                    pattern={winnerRow.club_profile.pattern}
                    label={winnerRow.club_profile.shortName}
                    size={22}
                  />
                  <div className="text-left min-w-0">
                    <div className="truncate text-xs font-black text-white">
                      {winnerRow.nickname} 감독
                    </div>
                    <div className="truncate text-[10px] font-semibold text-amber-300/85">
                      {winnerRow.club_profile.name}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Losing Custom Manager in Defeated Motion (엎드려 땅치기 / 오열 / 영혼가출 / OTL) */}
              <div className="relative flex flex-col items-center justify-between rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/90 via-[#0b1018] to-[#080c12] p-3.5">
                <div className="flex w-full items-center justify-between text-[10px] font-extrabold">
                  <span className="rounded bg-rose-500/15 border border-rose-400/35 px-2 py-0.5 text-rose-300">
                    💦 LOSER · 패장
                  </span>
                  <span className="text-slate-300">
                    {randomScene.loserCaption}
                  </span>
                </div>

                {/* Defeated Custom Pixel Motion Stage */}
                <div className="relative my-2 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-[#080c12]">
                  <PixelDefeatedManagerMotionSvg
                    avatar={loserRow.avatar_json ?? DEFAULT_MANAGER_AVATAR}
                    clubPrimaryColor={loserRow.club_profile.primaryColor}
                    clubSecondaryColor={loserRow.club_profile.secondaryColor}
                    motion={randomScene.loserMotion}
                    width={126}
                  />
                </div>

                <div className="flex items-center gap-2 opacity-90">
                  <JerseySvg
                    primaryColor={loserRow.club_profile.primaryColor}
                    secondaryColor={loserRow.club_profile.secondaryColor}
                    pattern={loserRow.club_profile.pattern}
                    label={loserRow.club_profile.shortName}
                    size={22}
                  />
                  <div className="text-left min-w-0">
                    <div className="truncate text-xs font-black text-slate-200">
                      {loserRow.nickname} 감독
                    </div>
                    <div className="truncate text-[10px] font-semibold text-slate-400">
                      {loserRow.club_profile.name}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Single Random Dialogue Bubble (No manual reroll button) */}
          <div
            className={`relative rounded-2xl border p-4 ${
              outcome === 'WIN'
                ? 'border-amber-400/35 bg-amber-950/15'
                : outcome === 'LOSS'
                  ? 'border-rose-400/35 bg-rose-950/15'
                  : 'border-sky-400/35 bg-sky-950/15'
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold">
              <span
                className={
                  outcome === 'WIN'
                    ? 'text-amber-300'
                    : outcome === 'LOSS'
                      ? 'text-rose-300'
                      : 'text-sky-300'
                }
              >
                {speakerRow.nickname} ({speakerRow.club_profile.name} 감독)
              </span>
              <span className="text-[10px] text-slate-400 tabular-nums">
                {seriesSummaryText}
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <MessageSquareQuote
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  outcome === 'WIN'
                    ? 'text-amber-300'
                    : outcome === 'LOSS'
                      ? 'text-rose-300'
                      : 'text-sky-300'
                }`}
              />
              <p className="text-sm font-extrabold leading-relaxed text-white">
                “{randomQuote}”
              </p>
            </div>
          </div>

          {/* Primary Action */}
          <button
            id="mp-close-postmatch-popup-btn"
            type="button"
            onClick={onClose}
            className={`w-full rounded-xl py-3 text-sm font-extrabold transition cursor-pointer ${
              outcome === 'WIN'
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : outcome === 'LOSS'
                  ? 'border border-rose-400/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30'
                  : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
            }`}
          >
            {outcome === 'WIN'
              ? '경기 리포트 & 재대결로 이동'
              : outcome === 'LOSS'
                ? '설욕전 준비하러 가기 (경기 리포트)'
                : '경기 리포트 확인'}
          </button>
        </div>
      </div>
    </div>
  );
}

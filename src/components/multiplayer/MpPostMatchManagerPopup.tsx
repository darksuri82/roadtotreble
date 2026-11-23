import {
  Flame,
  MessageSquareQuote,
  RefreshCw,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_MANAGER_AVATAR } from '../../types/game';
import type { MatchResult } from '../../types/league';
import type { MpRoomPlayerRow } from '../../types/multiplayer';
import { JerseySvg } from '../common/JerseySvg';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';

export type MpMatchOutcome = 'WIN' | 'LOSS' | 'DRAW';

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
      `${oppNickname} 감독님, 오늘 전술 수업료는 ${myGoals}골로 받았습니다. 언제든 재도전 환영합니다!`,
      decidedByPenalties
        ? `승부차기 마지막 키커까지 심장 쫄깃했네요! 결국 강심장은 우리 ${myClubName} 쪽이었습니다!`
        : margin >= 3
          ? `${myGoals}:${oppGoals} 대승! ${oppClubName} 수비진이 우리 공격수들 그림자만 밟다 끝났군요!`
          : `드래프트부터 전술 수싸움까지 단 한 순간도 밀리지 않은 완벽한 승리입니다!`,
      `완벽한 빌드업, 완벽한 마무리! 이것이 바로 명장 ${myNickname}의 클래스입니다.`,
      `${oppNickname} 감독님, 다음 판엔 포메이션 다시 짜오셔야겠습니다. 트로피는 제가 챙겨갑니다! 🏆`,
      `선수들이 전술 지시를 200% 수행해 줬습니다. ${myClubName} 팬들에게 바치는 승리입니다!`,
    ];
  }

  if (outcome === 'LOSS') {
    const margin = Math.max(0, oppGoals - myGoals);
    return [
      `${myNickname} 감독님, 혹시 전술판 거꾸로 들고 계신 건 아니죠? 다음 판엔 핸디캡 드릴까요? 😎`,
      `연습 경기인 줄 알았습니다! ${myClubName} 수비 맛집이네요, 골 넣기 참 편했습니다~`,
      `드래프트 운 탓하기 없기입니다? 순수 전술 차이로 깔끔하게 한 수 가르쳐 드렸습니다!`,
      decidedByPenalties
        ? `승부차기에서 떨리는 거 여기까지 다 보였습니다! 멘탈 관리 좀 더 하고 오세요~ 🤭`
        : margin >= 3
          ? `${oppGoals}:${myGoals} 실화입니까? 오늘 경기 하이라이트 저장해 두셨다가 수비 교과서로 쓰세요!`
          : `이 스쿼드로 지는 것도 능력인데... 바로 재대결 버튼 누를 용기는 있으신가요? 🤭`,
      `아~ 숨도 안 차네요! ${myNickname} 감독님, 냉수 한 잔 마시고 전술 다시 짜오세요!`,
      `우리 ${oppClubName} 공격수들이 아직 몸도 덜 풀렸는데 경기가 끝나버렸네요. 한 판 더 하시죠?`,
      `${myNickname} 감독님 표정 관리 안 되시는데, 리매치로 설욕하실 기회를 드릴게요!`,
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
  seedText: string,
  offset = 0,
): string {
  if (pool.length === 0) return '';
  let hash = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  const idx = (hash + Math.max(0, offset)) % pool.length;
  return pool[idx];
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
  const [quoteOffset, setQuoteOffset] = useState<number>(0);

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

  const activeQuote = pickPostMatchDialogue(pool, matchId, quoteOffset);

  // For WIN -> spotlight MY manager; for LOSS -> spotlight OPPONENT manager taunting me!
  const speakerRow = outcome === 'LOSS' ? oppRow : myRow;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-3 sm:p-4 backdrop-blur-sm">
      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${
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

        <div className="p-5 sm:p-6 space-y-4">
          {/* Header Badge */}
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

          {/* Spotlight Manager Character Stage */}
          {outcome === 'DRAW' ? (
            <div className="flex items-center justify-center gap-6 rounded-2xl border border-slate-800/90 bg-[#090e15] py-4 px-4">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-22 w-20 items-center justify-center rounded-xl border border-emerald-500/40 bg-[#111925]">
                  <PixelManagerAvatar
                    avatar={myRow.avatar_json ?? DEFAULT_MANAGER_AVATAR}
                    clubPrimaryColor={myRow.club_profile.primaryColor}
                    clubSecondaryColor={myRow.club_profile.secondaryColor}
                    size={68}
                  />
                </div>
                <span className="text-xs font-extrabold text-white">
                  {myRow.nickname}
                </span>
              </div>
              <Swords className="h-6 w-6 text-sky-400" />
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-22 w-20 items-center justify-center rounded-xl border border-sky-500/40 bg-[#111925]">
                  <PixelManagerAvatar
                    avatar={oppRow.avatar_json ?? DEFAULT_MANAGER_AVATAR}
                    clubPrimaryColor={oppRow.club_profile.primaryColor}
                    clubSecondaryColor={oppRow.club_profile.secondaryColor}
                    size={68}
                  />
                </div>
                <span className="text-xs font-extrabold text-white">
                  {oppRow.nickname}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-2xl border border-slate-800/90 bg-[#090e15] p-4">
              <div
                className={`relative flex h-24 w-22 shrink-0 items-center justify-center rounded-2xl border ${
                  outcome === 'WIN'
                    ? 'border-amber-400/60 bg-amber-950/20 shadow-[0_0_16px_rgba(251,191,36,0.25)]'
                    : 'border-rose-400/60 bg-rose-950/20 shadow-[0_0_16px_rgba(244,63,94,0.25)]'
                }`}
              >
                <PixelManagerAvatar
                  avatar={speakerRow.avatar_json ?? DEFAULT_MANAGER_AVATAR}
                  clubPrimaryColor={speakerRow.club_profile.primaryColor}
                  clubSecondaryColor={speakerRow.club_profile.secondaryColor}
                  size={78}
                />
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <JerseySvg
                    primaryColor={speakerRow.club_profile.primaryColor}
                    secondaryColor={speakerRow.club_profile.secondaryColor}
                    pattern={speakerRow.club_profile.pattern}
                    label={speakerRow.club_profile.shortName}
                    size={22}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">
                      {speakerRow.nickname} 감독
                    </div>
                    <div className="truncate text-[11px] font-semibold text-slate-400">
                      {speakerRow.club_profile.name} ·{' '}
                      {outcome === 'WIN' ? '승장 인터뷰' : '승자의 여유로운 한마디'}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] font-bold text-slate-400 tabular-nums">
                  {seriesSummaryText}
                </div>
              </div>
            </div>
          )}

          {/* Dialogue Bubble */}
          <div
            className={`relative rounded-2xl border p-4 ${
              outcome === 'WIN'
                ? 'border-amber-400/35 bg-amber-950/15'
                : outcome === 'LOSS'
                  ? 'border-rose-400/35 bg-rose-950/15'
                  : 'border-sky-400/35 bg-sky-950/15'
            }`}
          >
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
                “{activeQuote}”
              </p>
            </div>

            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                onClick={() => setQuoteOffset((c) => c + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                다른 멘트 보기
              </button>
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

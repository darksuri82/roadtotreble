import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Loader2,
  Send,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { calculateChemistry } from '../../../engine/chemistryEngine';
import type {
  FormationId,
  IncomingTradeOffer,
  ManagerTraitId,
} from '../../../types/game';
import type { TacticId } from '../../../types/league';
import type { MpTradeResultNote } from '../../../types/mpLeague';
import type { Player } from '../../../types/player';
import { JerseySvg } from '../../common/JerseySvg';
import { PitchBoard } from '../../common/PitchBoard';
import type { SlotRef } from '../../common/PitchBoard';

export interface MpLeagueTransferModalProps {
  windowIndex: number;
  offers: IncomingTradeOffer[];
  attemptsLeft: number;
  tradeNote: MpTradeResultNote | null;
  myStarters: Player[];
  myBench: Player[];
  busy: boolean;
  done: boolean;
  waitingNames: string[];
  onAccept: (offerId: string) => void;
  onReject: (offerId: string) => void;
  onCounter: (offerId: string, sendPlayerId: string) => void;
  onFinish: () => void;
  /** When set, the counter-offer picker shows my squad on a pitch */
  myFormation?: FormationId;
  myTactic?: TacticId;
  managerTraitId?: ManagerTraitId | null;
}

function positionLabel(player: Player): string {
  return player.mainPositions[0] ?? player.position;
}

function SwapPlayerRow({
  label,
  tone,
  player,
}: {
  label: string;
  tone: 'in' | 'out';
  player: Player | undefined;
}) {
  const Icon = tone === 'in' ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-[#0b1018] px-2.5 py-2">
      <div
        className={`flex items-center gap-1 text-[10px] font-bold ${
          tone === 'in' ? 'text-emerald-300' : 'text-sky-300'
        }`}
      >
        <Icon className="h-3 w-3" />
        {label}
      </div>
      {player ? (
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-black text-slate-300">
            {positionLabel(player)}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">
            {player.name}
          </span>
          <span className="shrink-0 font-display text-sm font-bold tabular-nums text-amber-300">
            {player.ovr}
          </span>
        </div>
      ) : (
        <div className="mt-1 text-xs font-bold text-slate-600">-</div>
      )}
    </div>
  );
}

export function MpLeagueTransferModal({
  windowIndex,
  offers,
  attemptsLeft,
  tradeNote,
  myStarters,
  myBench,
  busy,
  done,
  waitingNames,
  onAccept,
  onReject,
  onCounter,
  onFinish,
  myFormation,
  myTactic,
  managerTraitId,
}: MpLeagueTransferModalProps) {
  const [picker, setPicker] = useState<{
    offerId: string;
    playerId: string | null;
  } | null>(null);

  const locked = busy || done;
  const noAttempts = attemptsLeft <= 0;
  const squad = [...myStarters, ...myBench];

  const chemistry = useMemo(
    () =>
      myFormation
        ? calculateChemistry(
            myFormation,
            myStarters,
            myTactic ?? 'balanced',
            managerTraitId ?? null,
          )
        : null,
    [myFormation, myStarters, myTactic, managerTraitId],
  );

  const btnBase =
    'inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-extrabold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div
      id="mp-league-transfer-modal"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-4"
    >
      <div className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-800 bg-[#0d131c] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-1.5 font-display text-base font-bold tracking-wide text-white sm:text-lg">
              <ArrowLeftRight className="h-4 w-4 shrink-0 text-sky-300" />
              {windowIndex}차 이적시장 · 받은 제안
            </h2>
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-black tabular-nums ${
                noAttempts
                  ? 'border-slate-700 bg-slate-900/80 text-slate-500'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-300'
              }`}
            >
              남은 협상 {attemptsLeft}
            </span>
          </div>

          {done ? (
            <div className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0b1018] px-3 py-2 text-xs font-bold text-slate-300">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-300" />
              <span className="shrink-0">다른 감독 대기 중</span>
              {waitingNames.length > 0 && (
                <span className="min-w-0 truncate text-slate-500">
                  {waitingNames.join(', ')}
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onFinish}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-400/45 bg-emerald-500/20 px-3.5 py-2 text-xs font-extrabold text-emerald-100 transition-colors hover:bg-emerald-500/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" />
              이적시장 끝내기
            </button>
          )}
        </div>

        <div className="space-y-2.5 p-3 sm:p-4">
          {tradeNote && (
            <div
              className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2 text-xs font-bold ${
                tradeNote.success
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              }`}
            >
              <span className="min-w-0 break-words">{tradeNote.message}</span>
              {tradeNote.probability !== undefined &&
                tradeNote.probability < 100 && (
                  <span className="shrink-0 tabular-nums opacity-80">
                    성사 확률 {tradeNote.probability}%
                  </span>
                )}
            </div>
          )}

          {offers.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#111822] px-4 py-8 text-center text-xs font-bold text-slate-500">
              받은 제안 없음
            </div>
          ) : (
            offers.map((offer) => {
              const incoming = offer.aiOffersPlayers[0];
              const requested = offer.userRequestedPlayers[0];
              const pending = offer.status === 'pending';
              const pickerOpen = pending && !locked && picker?.offerId === offer.id;
              const selectedId = pickerOpen ? (picker?.playerId ?? null) : null;
              const candidates = squad.filter((p) => p.id !== requested?.id);
              const selectedPlayer =
                selectedId === null
                  ? null
                  : (squad.find((p) => p.id === selectedId) ?? null);
              const starterIdx =
                selectedId === null
                  ? -1
                  : myStarters.findIndex((p) => p.id === selectedId);
              const benchIdx =
                selectedId === null
                  ? -1
                  : myBench.findIndex((p) => p.id === selectedId);
              const selectedSlot: SlotRef | null =
                starterIdx >= 0
                  ? { area: 'starter', index: starterIdx }
                  : benchIdx >= 0
                    ? { area: 'bench', index: benchIdx }
                    : null;

              return (
                <div
                  key={offer.id}
                  title={offer.aiPitch}
                  className={`rounded-xl border border-slate-800 bg-[#111822] p-3 ${
                    pending ? '' : 'opacity-55'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <JerseySvg
                        primaryColor={offer.club.primaryColor}
                        secondaryColor={offer.club.secondaryColor}
                        pattern={offer.club.pattern}
                        size={30}
                      />
                      <span className="min-w-0 truncate text-sm font-extrabold text-white">
                        {offer.club.name}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {offer.isBlockbusterBargain && (
                        <span className="rounded-md border border-amber-500/40 bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                          급매
                        </span>
                      )}
                      {offer.status === 'accepted' && (
                        <span className="rounded-md border border-emerald-500/40 bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-black text-emerald-300">
                          성사
                        </span>
                      )}
                      {offer.status === 'rejected' && (
                        <span className="rounded-md border border-slate-700 bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-black text-slate-400">
                          거절
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SwapPlayerRow label="받는 선수" tone="in" player={incoming} />
                    <SwapPlayerRow
                      label="보내는 선수"
                      tone="out"
                      player={requested}
                    />
                  </div>

                  {pending && (
                    <div className="mt-2.5 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => onAccept(offer.id)}
                        disabled={locked || noAttempts}
                        className={`${btnBase} border-emerald-400/45 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        수락
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPicker(
                            pickerOpen
                              ? null
                              : { offerId: offer.id, playerId: null },
                          )
                        }
                        disabled={locked || noAttempts}
                        aria-expanded={pickerOpen}
                        className={`${btnBase} ${
                          pickerOpen
                            ? 'border-sky-400/60 bg-sky-500/25 text-sky-100'
                            : 'border-sky-400/40 bg-sky-500/12 text-sky-100 hover:bg-sky-500/22'
                        }`}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        역제안
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (picker?.offerId === offer.id) setPicker(null);
                          onReject(offer.id);
                        }}
                        disabled={locked}
                        className={`${btnBase} border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white`}
                      >
                        <X className="h-3.5 w-3.5" />
                        거절
                      </button>
                    </div>
                  )}

                  {pickerOpen && !noAttempts && (
                    <div className="mt-2.5 rounded-lg border border-slate-800 bg-[#0b1018] p-2">
                      {myFormation && chemistry ? (
                        <div className="mx-auto w-full max-w-[420px]">
                          <PitchBoard
                            formation={myFormation}
                            starters={myStarters}
                            bench={myBench}
                            chemistry={chemistry}
                            managerTraitId={managerTraitId ?? null}
                            conditionByPlayerId={{}}
                            selectedSlot={selectedSlot}
                            disabledBenchIds={
                              requested ? new Set([requested.id]) : undefined
                            }
                            onSlotClick={(area, index) => {
                              const p =
                                area === 'starter'
                                  ? myStarters[index]
                                  : myBench[index];
                              if (!p || p.id === requested?.id) return;
                              setPicker({
                                offerId: offer.id,
                                playerId: selectedId === p.id ? null : p.id,
                              });
                            }}
                            showBench
                            showChemBreakdown={false}
                            compact
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
                          {candidates.map((p) => {
                            const selected = selectedId === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  setPicker({ offerId: offer.id, playerId: p.id })
                                }
                                aria-pressed={selected}
                                className={`flex min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-1.5 text-left transition-colors cursor-pointer ${
                                  selected
                                    ? 'border-sky-400/60 bg-sky-500/15'
                                    : 'border-slate-800 bg-[#111822] hover:border-slate-600'
                                }`}
                              >
                                <span className="shrink-0 text-[9px] font-black text-slate-400">
                                  {positionLabel(p)}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-100">
                                  {p.name}
                                </span>
                                <span className="shrink-0 text-[11px] font-bold tabular-nums text-amber-300">
                                  {p.ovr}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-slate-800 bg-[#111822] px-2 py-2">
                          {selectedPlayer ? (
                            <>
                              <span className="shrink-0 text-[9px] font-black text-slate-400">
                                {positionLabel(selectedPlayer)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">
                                {selectedPlayer.name}
                              </span>
                              <span className="shrink-0 font-display text-sm font-bold tabular-nums text-amber-300">
                                {selectedPlayer.ovr}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-bold text-slate-600">
                              보낼 선수 선택
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={selectedId === null}
                          onClick={() => {
                            if (selectedId === null) return;
                            onCounter(offer.id, selectedId);
                            setPicker(null);
                          }}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-sky-400/45 bg-sky-500/20 px-3 py-2 text-xs font-extrabold text-sky-100 transition-colors hover:bg-sky-500/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Send className="h-3.5 w-3.5" />
                          역제안 보내기
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

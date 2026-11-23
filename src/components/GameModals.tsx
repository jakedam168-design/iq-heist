import { ArrowLeftRight, Play, RotateCcw, Trophy } from 'lucide-react';
import type { HudSnapshot, RoundSummary } from '../game/types';

interface GameModalsProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestartSolo: () => void;
  onStartRound2: () => void;
  onRematch: () => void;
  onReturnLobby: () => void;
}

function outcomeLabel(r: RoundSummary): string {
  if (r.outcome === 'robber_escaped') return 'Robber Escaped!';
  if (r.outcome === 'police_arrested') return 'Robber Arrested!';
  return 'Time Expired (Police Win)';
}

export function GameModals({
  hud,
  onResume,
  onRestartSolo,
  onStartRound2,
  onRematch,
  onReturnLobby,
}: GameModalsProps) {
  if (hud.screen === 'lobby' || hud.screen === 'playing') return null;

  const isGuest = hud.matchType === 'multiplayer_guest';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#060911]/82 p-4"
    >
      {/* PAUSE MODAL */}
      {hud.screen === 'paused' && (
        <div
          data-testid="pause-modal"
          className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#101827] p-5 text-center shadow-2xl"
        >
          <div className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-amber-400">
            Heist Paused
          </div>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-wide text-white">
            Round {hud.roundNumber} / 2
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Playing as <span className="font-bold uppercase text-white">{hud.localRole}</span> ·{' '}
            {hud.currentRoom}
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-amber-300 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              Resume Heist
            </button>

            {hud.matchType === 'solo' && (
              <button
                type="button"
                onClick={onRestartSolo}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wider text-white hover:border-amber-400 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Restart Solo Match
              </button>
            )}

            <button
              type="button"
              onClick={onReturnLobby}
              className="w-full rounded-xl border border-slate-700 bg-[#0b101b] px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}

      {/* ROUND 1 COMPLETE -> ROLE SWAP MODAL */}
      {hud.screen === 'round_end' && hud.roundSummary && (
        <div
          data-testid="round-end-modal"
          className="w-full max-w-md rounded-2xl border border-amber-400/50 bg-[#101827] p-5 text-center shadow-2xl"
        >
          <div className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-amber-400">
            Round 1 Complete
          </div>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-wide text-white">
            {outcomeLabel(hud.roundSummary)}
          </h2>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-700 bg-[#0b111d] p-2.5">
              <div className="text-[10px] font-bold uppercase text-slate-400">Winner</div>
              <div className="mt-0.5 text-sm font-black uppercase text-amber-300">
                {hud.roundSummary.winnerRole}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-[#0b111d] p-2.5">
              <div className="text-[10px] font-bold uppercase text-slate-400">Time</div>
              <div className="mt-0.5 text-sm font-black tabular-nums text-white">
                {hud.roundSummary.elapsedSeconds.toFixed(1)}s
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-[#0b111d] p-2.5">
              <div className="text-[10px] font-bold uppercase text-slate-400">Gold Stolen</div>
              <div className="mt-0.5 text-sm font-black tabular-nums text-amber-300">
                {hud.roundSummary.goldCollected}/3
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-sky-500/35 bg-[#0e1b2d] px-3 py-2 text-xs font-bold text-sky-200">
            Next Up: Roles Swap! You will play{' '}
            <span className="font-black uppercase text-white">
              {hud.localRole === 'robber' ? 'Police' : 'Robber'}
            </span>{' '}
            in Round 2.
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {!isGuest ? (
              <button
                type="button"
                data-start="true"
                onClick={onStartRound2}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-amber-300 cursor-pointer"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Start Round 2 (Swap Roles)
              </button>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-[#0b101b] px-4 py-2.5 text-xs font-bold text-slate-300">
                Waiting for Host to launch Round 2...
              </div>
            )}
          </div>
        </div>
      )}

      {/* END OF MATCH SUMMARY MODAL */}
      {hud.screen === 'match_end' && hud.matchSummary && (
        <div
          data-testid="match-end-modal"
          className="w-full max-w-lg rounded-2xl border border-amber-400/60 bg-[#101827] p-5 text-center shadow-2xl"
        >
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/15 text-amber-300">
            <Trophy className="h-6 w-6" />
          </div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-amber-400">
            2-Round Match Complete
          </div>
          <h2 className="mt-0.5 text-2xl sm:text-3xl font-black uppercase tracking-wide text-white">
            {hud.matchSummary.headline}
          </h2>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-300">
            {hud.matchSummary.reason}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5 text-left">
            {hud.matchSummary.rounds.map((r) => (
              <div
                key={r.roundNumber}
                className="rounded-xl border border-slate-700/90 bg-[#0b111d] p-3"
              >
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <span>Round {r.roundNumber}</span>
                  <span
                    className={r.winnerSide === 'local' ? 'text-emerald-400' : 'text-sky-400'}
                  >
                    {r.winnerSide === 'local'
                      ? `${hud.matchSummary!.localLabel} Won`
                      : `${hud.matchSummary!.remoteLabel} Won`}
                  </span>
                </div>
                <div className="mt-1 text-xs font-black text-white">{outcomeLabel(r)}</div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] font-bold tabular-nums text-slate-300">
                  <span>Robber: {r.robberLabel}</span>
                  <span>
                    {r.elapsedSeconds.toFixed(1)}s · {r.goldCollected}/3 Gold
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-2.5">
            {!isGuest ? (
              <button
                type="button"
                data-start="true"
                onClick={onRematch}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-amber-300 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Play Again
              </button>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-700 bg-[#0b101b] px-3 py-2.5 text-xs font-bold text-slate-300">
                Waiting for Host...
              </div>
            )}

            <button
              type="button"
              onClick={onReturnLobby}
              className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white hover:border-amber-400 cursor-pointer"
            >
              Change Mode / Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { Pause, Volume2, VolumeX } from 'lucide-react';
import { PROP_LABELS } from '../game/gameModes';
import type { HudSnapshot } from '../game/types';

interface GameplayHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
}

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

export function GameplayHud({ hud, muted, onToggleMute, onPause }: GameplayHudProps) {
  const isRobber = hud.localRole === 'robber';
  const lowTime = hud.roundStage === 'chase' && hud.timeRemaining <= 15;

  return (
    <div
      data-testid="gameplay-hud"
      className="fixed inset-0 z-10 pointer-events-none select-none"
    >
      {/* RED PENALTY VIGNETTE FLASH WHEN POLICE TAGS INNOCENT PROP */}
      {hud.penaltyFlash && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 110px 32px rgba(239, 68, 68, 0.72)',
          }}
        />
      )}

      {/* TOP BAR LAYOUT: Left Room Tag | Center Compact Heist HUD | Right Utility Icons */}
      <div className="flex items-start justify-between px-3 pt-2.5 sm:px-5 sm:pt-3.5 gap-2">
        {/* TOP-LEFT: Room Location + Active Disguise Status */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-[#0d1422]/90 px-2.5 py-1.5 shadow-lg">
            <span className={`h-2 w-2 rounded-xs ${isRobber ? 'bg-amber-400' : 'bg-sky-400'}`} />
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-100">
              {hud.currentRoom}
            </span>
          </div>

          {isRobber && hud.disguiseProp && (
            <div
              data-testid="disguise-badge"
              className="rounded-lg border border-amber-400/60 bg-[#231a0d]/92 px-2.5 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-300 shadow-lg"
            >
              Morphed: {PROP_LABELS[hud.disguiseProp]}
            </div>
          )}

          {!isRobber && hud.penaltyRemaining > 0 && (
            <div
              data-testid="penalty-badge"
              className="rounded-lg border border-rose-500 bg-[#2b0f14]/95 px-2.5 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-rose-300 tabular-nums shadow-lg"
            >
              Wrong Prop Freeze · {hud.penaltyRemaining.toFixed(1)}s
            </div>
          )}
        </div>

        {/* TOP-CENTER: SLEEK COMPACT HUD BAR */}
        <div className="flex items-center gap-2 sm:gap-3.5 rounded-xl border border-slate-700/90 bg-[#0d1422]/92 px-3 py-1.5 sm:px-4 sm:py-2 shadow-2xl">
          {/* Round Indicator */}
          <div className="flex flex-col items-center leading-none">
            <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
              Round
            </span>
            <span className="mt-0.5 text-sm sm:text-base font-black tabular-nums text-white">
              {hud.roundNumber}/2
            </span>
          </div>

          <div className="h-6 w-px bg-slate-700/80" />

          {/* Countdown Timer */}
          <div className="flex flex-col items-center leading-none min-w-[46px]">
            <span
              className={`text-[9px] font-extrabold uppercase tracking-[0.18em] ${
                hud.roundStage === 'hide'
                  ? 'text-amber-400'
                  : lowTime
                    ? 'text-rose-400'
                    : 'text-slate-400'
              }`}
            >
              {hud.roundStage === 'hide' ? 'Hide' : 'Time'}
            </span>
            <span
              data-testid="hud-timer"
              className={`mt-0.5 text-base sm:text-xl font-black tabular-nums ${
                hud.roundStage === 'hide'
                  ? 'text-amber-300'
                  : lowTime
                    ? 'text-rose-400'
                    : 'text-white'
              }`}
            >
              {hud.roundStage === 'hide'
                ? `${Math.ceil(hud.hideCountdown)}s`
                : formatTimer(hud.timeRemaining)}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-700/80" />

          {/* Role Badge */}
          <div
            data-testid="role-badge"
            className={`rounded-md border px-2 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider ${
              isRobber
                ? 'border-amber-400/70 bg-amber-500/20 text-amber-300'
                : 'border-sky-400/70 bg-sky-500/20 text-sky-300'
            }`}
          >
            {isRobber ? 'Robber' : 'Police'}
          </div>

          <div className="h-6 w-px bg-slate-700/80" />

          {/* Gold Bars Objective Counter with bespoke SVG bullion pips */}
          <div
            className="flex items-center gap-1.5"
            aria-label={`Gold Bars ${hud.goldCollected} of ${hud.goldTotal}`}
          >
            <div className="flex items-center gap-1">
              {Array.from({ length: hud.goldTotal }).map((_, idx) => {
                const filled = idx < hud.goldCollected;
                return (
                  <svg
                    key={idx}
                    viewBox="0 0 24 18"
                    className="h-4 w-5 sm:h-4.5 sm:w-5.5"
                    aria-hidden="true"
                  >
                    <polygon
                      points="4,4 20,4 23,15 1,15"
                      fill={filled ? '#fbbf24' : '#1e293b'}
                      stroke={filled ? '#fef08a' : '#475569'}
                      strokeWidth="1.6"
                    />
                    {filled && (
                      <polygon points="6,6 18,6 16,9 8,9" fill="#fef9c3" opacity="0.7" />
                    )}
                  </svg>
                );
              })}
            </div>
            <span
              data-testid="gold-counter"
              className={`text-xs sm:text-sm font-black tabular-nums ${
                hud.exitUnlocked ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {hud.exitUnlocked ? 'EXIT OPEN' : `${hud.goldCollected}/${hud.goldTotal}`}
            </span>
          </div>
        </div>

        {/* TOP-RIGHT: Mute & Pause Square Utility Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Unmute sound (M)' : 'Mute sound (M)'}
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-slate-700/90 bg-[#0d1422]/90 text-slate-200 hover:border-amber-400/70 hover:text-amber-300 shadow-lg cursor-pointer"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pause game (P)"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-slate-700/90 bg-[#0d1422]/90 text-slate-200 hover:border-amber-400/70 hover:text-amber-300 shadow-lg cursor-pointer"
          >
            <Pause className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      {/* POLICE HIDE-PHASE COUNTDOWN BANNER (Top-offset, keeps center clear) */}
      {!isRobber && hud.roundStage === 'hide' && (
        <div className="mt-4 flex justify-center px-4">
          <div className="rounded-xl border border-sky-400/70 bg-[#0d1829]/95 px-5 py-2.5 text-center shadow-2xl">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-sky-400">
              Hide Phase · Entrance Locked
            </div>
            <div className="mt-0.5 text-lg sm:text-xl font-black tabular-nums text-white">
              Releasing in {Math.ceil(hud.hideCountdown)}s
            </div>
          </div>
        </div>
      )}

      {/* EPHEMERAL EVENT BANNER (Top-under-HUD, keeps center 100% clear) */}
      {hud.statusBanner && (isRobber || hud.roundStage === 'chase') && (
        <div className="mt-2.5 flex justify-center px-4">
          <div
            className={`rounded-lg border px-3.5 py-1 text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-lg ${
              hud.statusBannerTone === 'danger'
                ? 'border-rose-500/80 bg-[#2b0f14]/92 text-rose-200'
                : hud.statusBannerTone === 'gold'
                  ? 'border-amber-400/80 bg-[#23190c]/92 text-amber-200'
                  : hud.statusBannerTone === 'success'
                    ? 'border-emerald-400/80 bg-[#0d261c]/92 text-emerald-200'
                    : 'border-sky-400/70 bg-[#0f1d30]/92 text-sky-100'
            }`}
          >
            {hud.statusBanner}
          </div>
        </div>
      )}
    </div>
  );
}

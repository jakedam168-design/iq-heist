import { useEffect, useState } from 'react';
import { Check, Copy, Lock, Play, Shield, UserCheck, Users, Volume2, VolumeX } from 'lucide-react';
import { gameModes } from '../game/gameModes';
import { normalizeRoomCode, type NetworkStatus } from '../game/networkManager';
import type { GameModeId, PlayerRole } from '../game/types';

interface LobbyOverlayProps {
  selectedModeId: GameModeId;
  onSelectMode: (id: GameModeId) => void;
  hostRoleRound1: PlayerRole;
  onChangeHostRole: (role: PlayerRole) => void;
  onStartSolo: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onCancelRoom: () => void;
  onStartMultiplayer: () => void;
  networkStatus: NetworkStatus;
  networkDetail: string;
  roomCode: string | null;
  isHost: boolean;
  muted: boolean;
  onToggleMute: () => void;
}

export function LobbyOverlay({
  selectedModeId,
  onSelectMode,
  hostRoleRound1,
  onChangeHostRole,
  onStartSolo,
  onCreateRoom,
  onJoinRoom,
  onCancelRoom,
  onStartMultiplayer,
  networkStatus,
  networkDetail,
  roomCode,
  isHost,
  muted,
  onToggleMute,
}: LobbyOverlayProps) {
  const [joinInput, setJoinInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const modes = gameModes.getAll();
  const activeMode = gameModes.getById(selectedModeId);

  // Enter / Space starts Solo Test immediately from Title/Lobby when not typing in an input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        if (networkStatus === 'connected' && isHost) {
          e.preventDefault();
          onStartMultiplayer();
        } else if (
          networkStatus === 'idle' ||
          networkStatus === 'error' ||
          networkStatus === 'disconnected'
        ) {
          e.preventDefault();
          onStartSolo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [networkStatus, isHost, onStartSolo, onStartMultiplayer]);

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeRoomCode(joinInput);
    if (cleaned.length !== 4) {
      setJoinError('Enter a 4-digit room code');
      return;
    }
    setJoinError(null);
    onJoinRoom(cleaned);
  };

  const inRoomFlow =
    networkStatus === 'creating' ||
    networkStatus === 'waiting_for_guest' ||
    networkStatus === 'joining' ||
    networkStatus === 'connected';

  return (
    <div
      data-testid="lobby-overlay"
      className="fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-4 lg:p-6 pointer-events-none"
      style={{
        background:
          'linear-gradient(105deg, rgba(8,12,20,0.84) 0%, rgba(8,12,20,0.36) 48%, rgba(8,12,20,0.82) 100%)',
      }}
    >
      {/* TOP BAR: Bespoke SVG Title Lockup + Mute Button */}
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-3">
          <svg
            viewBox="0 0 330 54"
            className="h-8 sm:h-10 lg:h-12 w-auto"
            role="img"
            aria-label="IQ HEIST: Cops & Robbers"
          >
            <polygon
              points="24,4 44,12 41,36 24,48 7,36 4,12"
              fill="#111927"
              stroke="#f59e0b"
              strokeWidth="2.5"
            />
            <polygon points="15,29 24,18 33,29 24,35" fill="#fbbf24" />
            <circle cx="24" cy="14" r="3" fill="#38bdf8" />
            <text
              x="56"
              y="30"
              fill="#ffffff"
              fontSize="27"
              fontWeight="900"
              letterSpacing="2.4"
            >
              IQ HEIST
            </text>
            <text
              x="57"
              y="46"
              fill="#cbd5e1"
              fontSize="10.5"
              fontWeight="800"
              letterSpacing="3.1"
            >
              COPS &amp; ROBBERS · 3D ARENA
            </text>
          </svg>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="pointer-events-auto flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-[#101726]/90 text-slate-200 hover:border-amber-400/70 hover:text-amber-300 transition-colors cursor-pointer"
        >
          {muted ? <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" /> : <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />}
        </button>
      </div>

      {/* MAIN LANDSCAPE SPLIT: Left 5-Mode Selector | Right Play & Room Panel */}
      <div className="my-auto grid grid-cols-12 gap-2.5 sm:gap-4 items-center max-w-6xl w-full mx-auto">
        {/* LEFT: MODULAR 5-MODE SELECTOR */}
        <section
          aria-label="Game Modes"
          className="col-span-7 pointer-events-auto flex flex-col gap-1.5 lg:gap-2.5"
        >
          <div className="flex items-baseline justify-between px-0.5">
            <h2 className="text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.22em] text-amber-400">
              Select Heist Mode
            </h2>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-300">
              Mode 3 Live · 2-Round Role Swap
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {modes.map((mode) => {
              const isSelected = mode.id === selectedModeId;
              return (
                <button
                  key={mode.id}
                  type="button"
                  disabled={!mode.unlocked}
                  onClick={() => {
                    if (mode.unlocked) onSelectMode(mode.id);
                  }}
                  aria-label={
                    mode.unlocked
                      ? `Mode ${mode.slotNumber}: ${mode.name} (Playable)`
                      : `Mode ${mode.slotNumber}: ${mode.name} (Coming Soon)`
                  }
                  className={`relative flex flex-col justify-between rounded-xl border p-2 sm:p-2.5 text-left transition-transform ${
                    mode.unlocked
                      ? isSelected
                        ? 'border-amber-400 bg-[#182133]/95 text-white shadow-[0_0_24px_rgba(245,158,11,0.22)] cursor-pointer'
                        : 'border-slate-600 bg-[#111827]/90 text-slate-200 hover:border-amber-400/70 cursor-pointer'
                      : 'border-slate-800 bg-[#0d1320]/82 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-black tabular-nums ${
                        mode.unlocked ? 'text-amber-400' : 'text-slate-600'
                      }`}
                    >
                      0{mode.slotNumber}
                    </span>
                    {mode.unlocked ? (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-300">
                        Play
                      </span>
                    ) : (
                      <Lock className="h-3 w-3 text-slate-600" aria-hidden="true" />
                    )}
                  </div>

                  <div className="mt-1.5 sm:mt-3">
                    <div className="text-[10px] sm:text-xs font-extrabold leading-tight">
                      {mode.name}
                    </div>
                    <div className="mt-0.5 text-[9px] sm:text-[10px] font-medium leading-tight opacity-80">
                      {mode.unlocked ? 'Unlocked' : 'Coming Soon'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Mode Tactical Briefing Card */}
          <div className="rounded-xl border border-slate-700/80 bg-[#101827]/92 p-2.5 sm:p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-amber-400" />
                <h3 className="text-xs sm:text-base font-black tracking-wide text-white uppercase">
                  {activeMode.name}
                </h3>
              </div>
              <span className="text-[10px] sm:text-xs font-bold tabular-nums text-slate-300">
                90s Round · 6s Hide · 3 Gold Bars
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
              <div className="rounded-lg border border-amber-500/25 bg-[#1b1917]/85 px-2.5 py-1.5">
                <div className="font-extrabold uppercase tracking-wider text-amber-400 text-[9px] sm:text-[10px]">
                  Robber
                </div>
                <p className="mt-0.5 text-slate-200 leading-snug">{activeMode.robberBrief}</p>
              </div>
              <div className="rounded-lg border border-sky-500/25 bg-[#111c2d]/85 px-2.5 py-1.5">
                <div className="font-extrabold uppercase tracking-wider text-sky-400 text-[9px] sm:text-[10px]">
                  Police
                </div>
                <p className="mt-0.5 text-slate-200 leading-snug">{activeMode.policeBrief}</p>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: SOLO TEST + PEERJS MULTIPLAYER ROOM PANEL */}
        <section
          aria-label="Play and Multiplayer Room"
          className="col-span-5 pointer-events-auto rounded-2xl border border-slate-700/90 bg-[#101827]/95 p-3 sm:p-4 shadow-2xl"
        >
          {/* Round 1 Starting Role Selector */}
          <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-300">
              Round 1 Role
            </span>
            <div className="flex rounded-lg border border-slate-700 bg-[#0b101b] p-0.5">
              <button
                type="button"
                onClick={() => onChangeHostRole('robber')}
                disabled={inRoomFlow && !isHost}
                className={`rounded-md px-2.5 py-1 text-[10px] sm:text-xs font-extrabold uppercase transition-colors cursor-pointer ${
                  hostRoleRound1 === 'robber'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Robber
              </button>
              <button
                type="button"
                onClick={() => onChangeHostRole('police')}
                disabled={inRoomFlow && !isHost}
                className={`rounded-md px-2.5 py-1 text-[10px] sm:text-xs font-extrabold uppercase transition-colors cursor-pointer ${
                  hostRoleRound1 === 'police'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Police
              </button>
            </div>
          </div>

          {!inRoomFlow ? (
            <div className="flex flex-col gap-2 sm:gap-2.5">
              {/* Primary CTA: Solo Test (Bot) */}
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onStartSolo();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2 sm:py-3 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-amber-300 active:scale-[0.99] transition-all shadow-[0_6px_20px_rgba(245,158,11,0.3)] cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                Solo Test (Bot)
              </button>

              <div className="flex items-center gap-2 py-0.5">
                <div className="h-px flex-1 bg-slate-700/80" />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  2P Room Code (WebRTC)
                </span>
                <div className="h-px flex-1 bg-slate-700/80" />
              </div>

              {/* Create Room Button */}
              <button
                type="button"
                onClick={onCreateRoom}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-[#122640] px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-extrabold uppercase tracking-wide text-sky-200 hover:bg-[#173254] hover:border-sky-300 transition-colors cursor-pointer"
              >
                <Users className="h-4 w-4" />
                Create Room
              </button>

              {/* Join Room Form */}
              <form onSubmit={handleJoinSubmit} className="flex gap-1.5">
                <label htmlFor="room-code-input" className="sr-only">
                  4-Digit Room Code
                </label>
                <input
                  id="room-code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={joinInput}
                  onChange={(e) => {
                    setJoinInput(normalizeRoomCode(e.target.value));
                    setJoinError(null);
                  }}
                  placeholder="4-Digit Code"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b101b] px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-black tracking-[0.25em] tabular-nums text-white placeholder:tracking-normal placeholder:font-semibold placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Join
                </button>
              </form>

              {(joinError ||
                (networkStatus === 'error' && networkDetail) ||
                (networkStatus === 'disconnected' && networkDetail)) && (
                <p role="alert" className="text-[11px] font-semibold text-rose-400 leading-tight">
                  {joinError ?? networkDetail}
                </p>
              )}
            </div>
          ) : (
            /* ACTIVE ROOM CONNECTION PANEL */
            <div className="flex flex-col gap-2.5">
              <div className="rounded-xl border border-sky-500/40 bg-[#0b1322] p-3 text-center">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-400">
                  {isHost ? 'Share Room Code' : 'Connecting to Room'}
                </div>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span
                    data-testid="room-code-display"
                    className="text-2xl sm:text-3xl font-black tracking-[0.28em] tabular-nums text-white"
                  >
                    {roomCode ?? '----'}
                  </span>
                  {isHost && roomCode && (
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      aria-label="Copy room code"
                      className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-200 hover:border-amber-400 hover:text-amber-300 cursor-pointer"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold">
                  {networkStatus === 'connected' ? (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <UserCheck className="h-4 w-4" />
                      Friend Connected!
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Shield className="h-4 w-4 text-sky-400" />
                      {networkStatus === 'creating'
                        ? 'Registering PeerJS room...'
                        : networkStatus === 'joining'
                          ? 'Joining friend...'
                          : 'Waiting for friend to enter code...'}
                    </span>
                  )}
                </div>
              </div>

              {networkStatus === 'connected' && isHost && (
                <button
                  type="button"
                  data-start="true"
                  onClick={onStartMultiplayer}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-emerald-300 transition-colors cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Start 2-Round Heist
                </button>
              )}

              {networkStatus === 'connected' && !isHost && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-center text-xs font-bold text-emerald-200">
                  Connected! Waiting for Host to start...
                </div>
              )}

              <button
                type="button"
                onClick={onCancelRoom}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
              >
                Leave Room
              </button>
            </div>
          )}
        </section>
      </div>

      {/* BOTTOM SAFE MARGIN: Flat Single-Line Control Hint */}
      <div className="text-center text-[10px] sm:text-xs font-semibold tracking-wide text-slate-300/90 hud-text-shadow">
        Thumbstick / WASD Move · Drag Screen Look · E Disguise / Tag · Q Snap Align 90° · Shift Sprint · P Pause
      </div>
    </div>
  );
}

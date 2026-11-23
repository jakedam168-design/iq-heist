import { useRef, useState } from 'react';
import type { HudSnapshot } from '../game/types';

interface MobileControlsProps {
  hud: HudSnapshot;
  onJoystickMove: (x: number, y: number) => void;
  onCameraDrag: (dx: number, dy: number) => void;
  onPrimaryAction: () => void;
  onSnapAlign: () => void;
  onSprintJump: () => void;
}

const JOY_MAX_RADIUS = 44;

function RadialCooldown({ pct, color }: { pct: number; color: string }) {
  if (pct <= 0.01) return null;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(1, pct));
  return (
    <svg
      viewBox="0 0 72 72"
      className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx="36"
        cy="36"
        r={radius}
        fill="rgba(8, 12, 20, 0.58)"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Multi-touch ergonomic Mobile Landscape controls:
 * - Left half: responsive floating virtual thumbstick (360° analog movement)
 * - Right half: touch-and-drag 3rd-person orbit camera rotation
 * - Bottom-right: role-dynamic circular thumb action cluster with radial cooldown overlays
 */
export function MobileControls({
  hud,
  onJoystickMove,
  onCameraDrag,
  onPrimaryAction,
  onSnapAlign,
  onSprintJump,
}: MobileControlsProps) {
  const isRobber = hud.localRole === 'robber';

  const joyPointerId = useRef<number | null>(null);
  const joyOrigin = useRef({ x: 0, y: 0 });
  const lookPointerId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  const [joyActive, setJoyActive] = useState(false);
  const [joyAnchor, setJoyAnchor] = useState({ x: 84, y: 0 });
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });

  const handleLeftPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    joyOrigin.current = { x: e.clientX, y: e.clientY };
    setJoyAnchor({ x: e.clientX, y: e.clientY });
    setJoyKnob({ x: 0, y: 0 });
    setJoyActive(true);
    onJoystickMove(0, 0);
  };

  const handleLeftPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    const dx = e.clientX - joyOrigin.current.x;
    const dy = e.clientY - joyOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, JOY_MAX_RADIUS);
    const nx = dist > 0.01 ? (dx / dist) * (clamped / JOY_MAX_RADIUS) : 0;
    const ny = dist > 0.01 ? (dy / dist) * (clamped / JOY_MAX_RADIUS) : 0;
    setJoyKnob({ x: nx * JOY_MAX_RADIUS, y: ny * JOY_MAX_RADIUS });
    onJoystickMove(nx, -ny);
  };

  const handleLeftPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    setJoyActive(false);
    setJoyKnob({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  const handleRightPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (lookPointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointerId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
  };

  const handleRightPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    onCameraDrag(dx, dy);
  };

  const handleRightPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    lookPointerId.current = null;
  };

  const canDisguise = isRobber && (hud.disguiseProp !== null || hud.nearbyProp !== null);
  const canSnapAlign = isRobber && hud.disguiseProp !== null;
  const policeLocked = !isRobber && (hud.roundStage === 'hide' || hud.penaltyRemaining > 0);

  return (
    <div
      data-testid="mobile-controls"
      className="fixed inset-0 z-10 pointer-events-none select-none"
    >
      {/* LEFT HALF TOUCH ZONE: Floating Virtual Thumbstick */}
      <div
        aria-label="Movement thumbstick zone"
        onPointerDown={handleLeftPointerDown}
        onPointerMove={handleLeftPointerMove}
        onPointerUp={handleLeftPointerUp}
        onPointerCancel={handleLeftPointerUp}
        className="pointer-events-auto fixed bottom-0 left-0 top-16 w-[46%]"
      >
        {!joyActive && (
          <div className="pointer-events-none absolute bottom-5 left-6 sm:bottom-7 sm:left-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-slate-400/35 bg-[#0d1422]/45">
            <div className="h-10 w-10 rounded-full border border-slate-200/45 bg-slate-200/20" />
          </div>
        )}

        {joyActive && (
          <div
            className="pointer-events-none fixed flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-400/65 bg-[#0d1422]/65"
            style={{ left: joyAnchor.x, top: joyAnchor.y }}
          >
            <div
              className="h-11 w-11 rounded-full border-2 border-white/80 bg-amber-400/80 shadow-lg"
              style={{
                transform: `translate3d(${joyKnob.x}px, ${joyKnob.y}px, 0)`,
              }}
            />
          </div>
        )}
      </div>

      {/* RIGHT HALF TOUCH ZONE: Drag to Orbit 3rd-Person Camera */}
      <div
        aria-label="Camera look drag zone"
        onPointerDown={handleRightPointerDown}
        onPointerMove={handleRightPointerMove}
        onPointerUp={handleRightPointerUp}
        onPointerCancel={handleRightPointerUp}
        className="pointer-events-auto fixed bottom-0 right-0 top-16 w-[54%]"
      />

      {/* BOTTOM-RIGHT ACTION CLUSTER: Large Circular Role-Dynamic Thumb Buttons */}
      <div className="pointer-events-auto fixed bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-end gap-2.5 sm:gap-3.5">
        {isRobber ? (
          <>
            {/* Robber Button 2: SNAP ALIGN 90° */}
            <button
              type="button"
              tabIndex={-1}
              disabled={!canSnapAlign}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (canSnapAlign) onSnapAlign();
              }}
              aria-label="Snap Align 90 degrees (Q)"
              className={`relative flex h-14 w-14 sm:h-16 sm:w-16 flex-col items-center justify-center rounded-full border-2 shadow-xl transition-transform active:scale-95 ${
                canSnapAlign
                  ? 'border-amber-300 bg-[#182234]/92 text-amber-200 cursor-pointer'
                  : 'border-slate-700/80 bg-[#0d1422]/72 text-slate-500 cursor-not-allowed'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M4 12h4m8 0h4M12 4v4m0 8v4" strokeLinecap="round" />
                <rect x="8" y="8" width="8" height="8" rx="1" />
              </svg>
              <span className="mt-0.5 text-[9px] font-black uppercase tracking-wider leading-none">
                90° [Q]
              </span>
            </button>

            {/* Robber Button 3: SPRINT / JUMP */}
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSprintJump();
              }}
              aria-label="Sprint and Jump (Shift)"
              className={`relative flex h-15 w-15 sm:h-17 sm:w-17 flex-col items-center justify-center rounded-full border-2 shadow-xl transition-transform active:scale-95 cursor-pointer ${
                hud.sprintActive
                  ? 'border-emerald-300 bg-emerald-600/90 text-white'
                  : 'border-slate-400/70 bg-[#121c2e]/92 text-slate-100'
              }`}
            >
              <RadialCooldown pct={hud.sprintCooldownPct} color="#fbbf24" />
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
              >
                <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" strokeLinejoin="round" />
              </svg>
              <span className="mt-0.5 text-[9px] font-black uppercase tracking-wider leading-none">
                Sprint
              </span>
            </button>

            {/* Robber Button 1 (Primary): DISGUISE / PROP SHIFT */}
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPrimaryAction();
              }}
              aria-label={
                hud.disguiseProp ? 'Revert to human form (E)' : 'Disguise as nearby prop (E)'
              }
              className={`relative flex h-20 w-20 sm:h-22 sm:w-22 flex-col items-center justify-center rounded-full border-2 shadow-2xl transition-transform active:scale-95 cursor-pointer ${
                hud.disguiseProp
                  ? 'border-amber-200 bg-amber-500 text-slate-950'
                  : canDisguise
                    ? 'border-amber-300 bg-[#271d0c]/95 text-amber-200'
                    : 'border-slate-600 bg-[#101827]/88 text-slate-300'
              }`}
            >
              <RadialCooldown pct={hud.disguiseCooldownPct} color="#f59e0b" />
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" strokeLinejoin="round" />
                <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" strokeLinejoin="round" />
              </svg>
              <span className="mt-0.5 text-[10px] font-black uppercase tracking-wider leading-none">
                {hud.disguiseProp ? 'Human' : 'Shift [E]'}
              </span>
              {hud.nearbyProp && !hud.disguiseProp && (
                <span className="mt-0.5 max-w-[68px] truncate text-[8px] font-extrabold text-amber-300">
                  {hud.nearbyProp.label}
                </span>
              )}
            </button>
          </>
        ) : (
          <>
            {/* Police Button 2: SPRINT */}
            <button
              type="button"
              tabIndex={-1}
              disabled={policeLocked}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (!policeLocked) onSprintJump();
              }}
              aria-label="Police Sprint (Shift)"
              className={`relative flex h-15 w-15 sm:h-17 sm:w-17 flex-col items-center justify-center rounded-full border-2 shadow-xl transition-transform active:scale-95 ${
                policeLocked
                  ? 'border-slate-700 bg-[#0d1422]/75 text-slate-500 cursor-not-allowed'
                  : hud.sprintActive
                    ? 'border-sky-200 bg-sky-500 text-slate-950 cursor-pointer'
                    : 'border-slate-400/70 bg-[#121c2e]/92 text-slate-100 cursor-pointer'
              }`}
            >
              <RadialCooldown pct={hud.sprintCooldownPct} color="#38bdf8" />
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
              >
                <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" strokeLinejoin="round" />
              </svg>
              <span className="mt-0.5 text-[9px] font-black uppercase tracking-wider leading-none">
                Sprint
              </span>
            </button>

            {/* Police Button 1 (Primary): ARREST / TAG PULSE */}
            <button
              type="button"
              tabIndex={-1}
              disabled={policeLocked}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (!policeLocked) onPrimaryAction();
              }}
              aria-label="Arrest or Tag Scanner Pulse (E)"
              className={`relative flex h-20 w-20 sm:h-22 sm:w-22 flex-col items-center justify-center rounded-full border-2 shadow-2xl transition-transform active:scale-95 ${
                hud.penaltyRemaining > 0
                  ? 'border-rose-400 bg-[#3a1219]/95 text-rose-200 cursor-not-allowed'
                  : hud.roundStage === 'hide'
                    ? 'border-slate-700 bg-[#0e1726]/85 text-slate-500 cursor-not-allowed'
                    : 'border-sky-300 bg-[#0f294a]/95 text-sky-100 cursor-pointer'
              }`}
            >
              <RadialCooldown
                pct={hud.tagCooldownPct}
                color={hud.penaltyRemaining > 0 ? '#ef4444' : '#38bdf8'}
              />
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
              </svg>
              <span className="mt-0.5 text-[10px] font-black uppercase tracking-wider leading-none">
                {hud.penaltyRemaining > 0 ? `${hud.penaltyRemaining.toFixed(1)}s` : 'Tag [E]'}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

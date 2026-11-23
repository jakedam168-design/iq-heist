import { useEffect, useState } from 'react';

export function PortraitGuard() {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsPortraitMobile(h > w && w < 900);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!isPortraitMobile) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rotate device to landscape"
      data-testid="portrait-guard"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0f17] px-8 text-center text-slate-100"
    >
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-amber-400/40 bg-[#131b2b] shadow-2xl">
        <svg
          viewBox="0 0 64 64"
          className="h-14 w-14 text-amber-400 animate-rotate-phone"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="18"
            y="8"
            width="28"
            height="48"
            rx="5"
            stroke="currentColor"
            strokeWidth="3.2"
          />
          <line
            x1="28"
            y1="49"
            x2="36"
            y2="49"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M49 20a18 18 0 0 1 4 12"
            stroke="#38bdf8"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M50 30l3 3 3-3"
            stroke="#38bdf8"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="text-xl font-black tracking-wide uppercase text-white">
        Rotate Phone to Landscape
      </h2>
      <p className="mt-2 max-w-xs text-sm text-slate-300 leading-relaxed">
        IQ HEIST is built for mobile landscape play with dual-thumb controls. Turn your device sideways to enter the museum.
      </p>
    </div>
  );
}

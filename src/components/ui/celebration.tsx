"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Particle = {
  id: number;
  tx: number;
  ty: number;
  color: string;
  size: number;
  delay: number;
};

// Gold is the app's "accent only, used sparingly" color (see
// tailwind.config.ts) -- a birdie is exactly the sparing, special
// moment it's for, so it leads here. Forest and cream round out the
// existing brand palette rather than reaching for arbitrary confetti
// colors.
const PARTICLE_COLORS = ["#C9A24E", "#DAB86D", "#5C8768", "#84A68D", "#FDFBF6"];
const PARTICLE_COUNT = 14;
const BURST_MS = 900;
const LABEL_MS = 1300;

function makeParticles(seed: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const distance = 46 + Math.random() * 42;
    particles.push({
      id: seed * 100 + i,
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      size: 4 + Math.random() * 3,
      delay: Math.random() * 60,
    });
  }
  return particles;
}

/**
 * A brief particle burst plus a pop-in label, fired once per change to
 * `trigger` (pass a counter, or any value that's new each time -- a
 * repeat of the same value is ignored so re-renders don't replay it).
 * Purely decorative: renders nothing between bursts, and nothing at all
 * under prefers-reduced-motion, the same convention PhonePreview's tour
 * animation already follows.
 *
 * Sizes itself to fill its nearest positioned ancestor (`position:
 * relative`/`absolute` by default, or the whole viewport with
 * `fixed`) and never intercepts clicks, so it can be dropped in
 * anywhere -- the phone screen in the marketing preview, the live
 * scorecard -- without affecting layout or interaction.
 */
export function ScoreCelebration({
  trigger,
  label,
  fixed = false,
}: {
  trigger: string | number | null;
  label: string;
  fixed?: boolean;
}) {
  const [burst, setBurst] = useState<{ id: number; particles: Particle[] } | null>(null);
  const lastTrigger = useRef<string | number | null>(null);
  const seed = useRef(0);

  useEffect(() => {
    if (trigger == null || trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    seed.current += 1;
    const id = seed.current;
    setBurst({ id, particles: makeParticles(id) });
    const timer = window.setTimeout(() => {
      setBurst((current) => (current?.id === id ? null : current));
    }, LABEL_MS);
    return () => window.clearTimeout(timer);
  }, [trigger]);

  if (!burst) return null;

  return (
    <div
      aria-hidden="true"
      className={
        fixed
          ? "pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
          : "pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden"
      }
    >
      <style>{`
        @keyframes sf-celebration-particle {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--sf-tx), var(--sf-ty)) scale(0.3); opacity: 0; }
        }
        @keyframes sf-celebration-label {
          0% { transform: translateY(6px) scale(0.75); opacity: 0; }
          25% { transform: translateY(0) scale(1.08); opacity: 1; }
          40% { transform: scale(1); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-6px) scale(1); opacity: 0; }
        }
      `}</style>
      <div className="relative h-0 w-0">
        {burst.particles.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full"
            style={
              {
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                "--sf-tx": `${p.tx}px`,
                "--sf-ty": `${p.ty}px`,
                animation: `sf-celebration-particle ${BURST_MS}ms ease-out ${p.delay}ms forwards`,
              } as CSSProperties
            }
          />
        ))}
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-forest-900 px-3 py-1 font-serif text-sm text-cream-50 shadow-card"
          style={{ animation: `sf-celebration-label ${LABEL_MS}ms ease-out forwards` }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

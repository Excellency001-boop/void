"use client";

import { useEffect, useId, useState } from "react";

export type RingState = "building" | "sealed" | "dead";

const COLOR: Record<RingState, { arc: string; glow: string; lock: string }> = {
  building: { arc: "#8b84ff", glow: "#6c63ff", lock: "#a9a4ff" },
  sealed: { arc: "#34d399", glow: "#34d399", lock: "#34d399" },
  dead: { arc: "#6b6b76", glow: "#6b6b76", lock: "#6b6b76" },
};

/// The hero's policy perimeter as a reusable gauge. It is the same idea everywhere it appears: the
/// ring closes as the policy becomes real (create page), closes once and locks (success screen), and
/// shows how much of a live session is left (vault cards). A dead vault is a broken, dashed ring
/// with a cross, so "ended" reads at a glance without any text.
export function PerimeterRing({
  progress,
  size = 120,
  state = "building",
  duration = 1.4,
  showLock = true,
}: {
  progress: number;
  size?: number;
  state?: RingState;
  duration?: number;
  showLock?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const target = Math.max(0, Math.min(1, progress)) * 100;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const c = COLOR[state];
  const closed = state === "sealed" || (state === "building" && target >= 99.5);

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" className="overflow-visible">
      <defs>
        <filter id={`g${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <circle cx="60" cy="60" r="48" fill="none" stroke="#6c63ff" strokeOpacity={state === "dead" ? 0.08 : 0.22} strokeDasharray="2 6" />

      {state === "dead" ? (
        <circle cx="60" cy="60" r="48" fill="none" stroke={c.arc} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="5 7" />
      ) : (
        <>
          {closed && (
            <circle cx="60" cy="60" r="48" fill="none" stroke={c.glow} strokeWidth="7" opacity="0.5" filter={`url(#g${uid})`} />
          )}
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke={c.arc}
            strokeWidth="3"
            strokeLinecap="round"
            pathLength="100"
            transform="rotate(-90 60 60)"
            style={{
              strokeDasharray: `${shown} 100`,
              transition: `stroke-dasharray ${duration}s cubic-bezier(0.2, 0.8, 0.2, 1)`,
            }}
          />
        </>
      )}

      {showLock && state !== "dead" && (
        <g stroke={c.lock} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g style={{ transform: closed ? "translateY(0)" : "translateY(-5px)", transition: "transform 0.45s 0.9s cubic-bezier(0.3, 1.6, 0.5, 1)" }}>
            <path d="M52 56v-7a8 8 0 0 1 16 0v7" />
          </g>
          <rect x="45" y="56" width="30" height="22" rx="5" fill="#0f1613" fillOpacity="0.9" />
          <circle cx="60" cy="67" r="2.6" fill={c.lock} stroke="none" />
        </g>
      )}
      {state === "dead" && (
        <path d="M50 50l20 20M70 50L50 70" stroke={c.arc} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      )}
    </svg>
  );
}

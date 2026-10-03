import { PerimeterRing } from "@/components/PerimeterRing";

const COLORS = ["#34d399", "#6c63ff", "#ff6b2c", "#a5f3d0", "#8b84ff"];
const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2 + (i % 2 ? 0.15 : -0.1);
  const dist = 110 + (i % 4) * 26;
  return {
    x: Math.round(Math.cos(angle) * dist),
    y: Math.round(Math.sin(angle) * dist),
    color: COLORS[i % COLORS.length],
    delay: (i % 5) * 40,
    size: 4 + (i % 3) * 2,
  };
});

/// The success moment: the policy perimeter draws itself shut around the vault, the lock snaps
/// closed, and the room lights up green. Confetti fires when the ring completes. Decorative, so
/// hidden from assistive tech; reduced-motion users get the final frame.
export function VaultSeal() {
  return (
    <div className="relative flex h-52 w-52 items-center justify-center" aria-hidden="true">
      <span className="pointer-events-none absolute -inset-20 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(52,211,153,0.34),transparent)] blur-2xl" />
      <span className="absolute inset-6 animate-seal-ring rounded-full border border-void-success/50 [animation-delay:1.3s]" />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 animate-burst rounded-[2px] motion-reduce:hidden"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            animationDelay: `${1300 + p.delay}ms`,
            ["--bx" as string]: `${p.x}px`,
            ["--by" as string]: `${p.y}px`,
          }}
        />
      ))}
      <PerimeterRing progress={1} size={190} state="sealed" duration={1.5} />
    </div>
  );
}

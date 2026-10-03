/// The post-deploy mark: a shield with a lock-check that draws itself in while two rings pulse
/// outward once. Decorative, so hidden from assistive tech; reduced-motion users get it static.
const COLORS = ["#34d399", "#6c63ff", "#ff6b2c", "#a5f3d0", "#8b84ff"];
const PARTICLES = Array.from({ length: 20 }, (_, i) => {
  const angle = (i / 20) * Math.PI * 2 + (i % 2 ? 0.15 : -0.1);
  const dist = 70 + (i % 4) * 22;
  return {
    x: Math.round(Math.cos(angle) * dist),
    y: Math.round(Math.sin(angle) * dist),
    color: COLORS[i % COLORS.length],
    delay: (i % 5) * 40,
    size: 4 + (i % 3) * 2,
  };
});

export function VaultSeal() {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden="true">
      <span className="pointer-events-none absolute -inset-16 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(52,211,153,0.28),transparent)] blur-xl" />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 animate-burst rounded-[2px] motion-reduce:hidden"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            animationDelay: `${0.35 + p.delay}ms`,
            ["--bx" as string]: `${p.x}px`,
            ["--by" as string]: `${p.y}px`,
          }}
        />
      ))}
      <span className="absolute inset-4 animate-seal-ring rounded-full border border-void-success/60" />
      <span className="absolute inset-4 animate-seal-ring rounded-full border border-void-success/40 [animation-delay:0.5s]" />
      <svg width="76" height="76" viewBox="0 0 40 40" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M20 4 34 10v9c0 9-6 14-14 17-8-3-14-8-14-17v-9Z"
          className="fill-void-successDim/60 stroke-void-success"
          strokeWidth="1.4"
        />
        <path
          d="M13.5 20.5l4.5 4.5 8.5-9.5"
          className="animate-draw stroke-void-success"
          strokeWidth="2.2"
          strokeDasharray="30"
        />
      </svg>
    </div>
  );
}

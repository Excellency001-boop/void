/// The post-deploy mark: a shield with a lock-check that draws itself in while two rings pulse
/// outward once. Decorative, so hidden from assistive tech; reduced-motion users get it static.
export function VaultSeal() {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden="true">
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

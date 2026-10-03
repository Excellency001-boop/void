/// Fixed light sources behind every page. Pure black reads as flat; a dark room reads as deep once
/// something in it is lit. Indigo from above (the policy), a warm ember to the right (the hard stop),
/// and a faint red low-left so the dark has an undertone of danger rather than being neutral.
export function Atmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute left-1/2 top-[-20rem] h-[46rem] w-[96rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(108,99,255,0.26),transparent)] blur-3xl" />
      <div className="absolute right-[-10rem] top-16 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,107,44,0.17),transparent)] blur-3xl" />
      <div className="absolute bottom-[-16rem] left-[-12rem] h-[34rem] w-[44rem] rounded-full bg-[radial-gradient(closest-side,rgba(240,71,92,0.1),transparent)] blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,107,44,0.55),transparent)]" />
    </div>
  );
}

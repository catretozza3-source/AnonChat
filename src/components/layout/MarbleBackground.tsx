export function MarbleBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_26%),linear-gradient(135deg,#050505_0%,#0a0a0a_25%,#111111_50%,#0b0b0b_75%,#050505_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:90px_90px]" />
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-zinc-200/5 blur-3xl" />
    </>
  );
}

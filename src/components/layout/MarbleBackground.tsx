export function MarbleBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_26%),linear-gradient(135deg,#050505_0%,#0a0a0a_25%,#111111_50%,#0b0b0b_75%,#050505_100%)] dark:block" />
      <div className="pointer-events-none absolute inset-0 block bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_30%),radial-gradient(circle_at_top_right,rgba(232,235,244,0.95),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(227,232,241,0.82),transparent_28%),linear-gradient(135deg,#f8fafc_0%,#edf2f7_28%,#f7f8fb_52%,#eceff5_78%,#f8fafc_100%)] dark:hidden" />
      <div className="pointer-events-none absolute inset-0 hidden opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:90px_90px] dark:block" />
      <div className="pointer-events-none absolute inset-0 block opacity-60 [background-image:linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:90px_90px] dark:hidden" />
      <div className="pointer-events-none absolute -left-24 top-0 hidden h-80 w-80 rounded-full bg-white/10 blur-3xl dark:block" />
      <div className="pointer-events-none absolute -left-24 top-0 block h-80 w-80 rounded-full bg-white/90 blur-3xl dark:hidden" />
      <div className="pointer-events-none absolute bottom-0 right-0 hidden h-96 w-96 rounded-full bg-white/5 blur-3xl dark:block" />
      <div className="pointer-events-none absolute bottom-0 right-0 block h-96 w-96 rounded-full bg-slate-200/70 blur-3xl dark:hidden" />
      <div className="pointer-events-none absolute left-1/3 top-1/4 hidden h-72 w-72 rounded-full bg-zinc-200/5 blur-3xl dark:block" />
      <div className="pointer-events-none absolute left-1/3 top-1/4 block h-72 w-72 rounded-full bg-white/80 blur-3xl dark:hidden" />
    </>
  );
}

/**
 * Tonal divider between sections — a thin line with a soft glow at centre, so
 * each block reads as its own moment rather than as a scroll of one surface.
 * Lifted verbatim from the homepage's inline helper so the new pages sit on the
 * same visual system instead of a lookalike of it.
 */
export function SectionHairline({
  tone = "blue",
}: {
  tone?: "blue" | "amber" | "moonlight";
}) {
  const color =
    tone === "amber"
      ? "rgba(255,183,3,0.40)"
      : tone === "moonlight"
        ? "rgba(91,124,255,0.40)"
        : "rgba(114,149,181,0.40)";

  return (
    <div className="absolute inset-x-0 top-0 h-px pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
        }}
      />
    </div>
  );
}

/**
 * The space's "Inspired by" credit, `{ kind: "x" | "hold", handle }`, as the
 * backend takes it (services/ad-space/inspired-by-rules.ts), and the
 * `?inspiredBy=x:<handle>` / `hold:<handle>` a link from Inspire carries.
 * No "use client": the new-listing page reads the param on the server.
 */

export type InspiredByInput = { kind: "x" | "hold"; handle: string };

/** `?inspiredBy=x:someone` back into the field; null when absent or malformed. */
export function parseInspiredByParam(v: string | null | undefined): InspiredByInput | null {
  const m = (v ?? "").match(/^(x|hold):@?([A-Za-z0-9_.]{1,40})$/);
  if (!m) return null;
  if (m[1] === "x" && !/^[A-Za-z0-9_]{1,15}$/.test(m[2])) return null;
  return { kind: m[1] as "x" | "hold", handle: m[2] };
}

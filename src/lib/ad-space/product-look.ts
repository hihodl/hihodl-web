/**
 * The product in the creator's colours: the palette, and the maths that keeps
 * every spot legible on whatever colour they pick.
 *
 * The backend stores `{ body, accent }` as any #RRGGBB (product-look-rules.ts);
 * the palette here is what the editor offers first, with a custom hex beside
 * it. The drawing fills the body with `body` and draws the handle, wheels and
 * trim in `accent`. Its outline, and the plate under every price, take their
 * ink from the body's lightness, so a white suitcase and a black one both read.
 */

export interface ProductLook {
  body: string;
  accent: string;
}

/** Body colours: dark to light, never a red. */
export const BODY_PALETTE: readonly { name: string; hex: string }[] = [
  { name: "Graphite", hex: "#2B2F36" },
  { name: "Midnight", hex: "#1E2A44" },
  { name: "HOLD navy", hex: "#023047" },
  { name: "Ocean", hex: "#219EBC" },
  { name: "Sky", hex: "#8ECAE6" },
  { name: "Forest", hex: "#2F5D50" },
  { name: "Sage", hex: "#8FAE8B" },
  { name: "Lilac", hex: "#A78BFA" },
  { name: "Blush", hex: "#E8C4C4" },
  { name: "Sand", hex: "#D8C3A5" },
  { name: "Silver", hex: "#C3CAD4" },
  { name: "Cream", hex: "#F2EBDD" },
  { name: "White", hex: "#FAFAFA" },
  { name: "Amber", hex: "#FFB703" },
];

/** Handle, wheels and trim. */
export const ACCENT_PALETTE: readonly { name: string; hex: string }[] = [
  { name: "Black", hex: "#111418" },
  { name: "Charcoal", hex: "#3A3F47" },
  { name: "Silver", hex: "#B8C0CC" },
  { name: "White", hex: "#F4F6FA" },
  { name: "Gold", hex: "#C9A227" },
  { name: "Amber", hex: "#FFB703" },
  { name: "Navy", hex: "#023047" },
];

export const DEFAULT_LOOK: ProductLook = { body: "#1E2A44", accent: "#B8C0CC" };

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(v: string): boolean {
  return HEX.test(v);
}

/** "1e3a5f", "#1E3A5F" or "#1e3a5f" to "#1E3A5F"; null when it is not a colour. */
export function normalHex(v: string): string | null {
  const t = v.trim();
  const withHash = t.startsWith("#") ? t : `#${t}`;
  return HEX.test(withHash) ? withHash.toUpperCase() : null;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two #RRGGBB. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const INK_DARK = "#0A141E";
export const INK_LIGHT = "#F4F6FA";

/** The ink that reads on a colour: whichever of our dark and light inks contrasts more. */
export function inkOn(hex: string): string {
  return contrast(hex, INK_DARK) >= contrast(hex, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}

/** Whether a colour is light, i.e. dark ink is the one that reads on it. */
export function isLight(hex: string): boolean {
  return inkOn(hex) === INK_DARK;
}

/**
 * Whether an outline path is a closed shape (fillable): it ends in Z, or it is
 * one of the catalog's circles (two half arcs back to where they started).
 * An open path (a handle's two uprights, a seam) is drawn as a line.
 */
export function isClosedPath(d: string): boolean {
  if (/[zZ]\s*$/.test(d.trim())) return true;
  return (d.match(/a[\d.\s-]+ 0 1 0/gi) ?? []).length >= 2;
}

/** A stored look, or null when there is none or it is not two colours. */
export function lookOf(v: unknown): ProductLook | null {
  if (!v || typeof v !== "object") return null;
  const { body, accent } = v as Partial<ProductLook>;
  return typeof body === "string" && typeof accent === "string" && isHex(body) && isHex(accent) ? { body, accent } : null;
}

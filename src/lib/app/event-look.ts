/**
 * What an event looks like in a 32px slot: its country's flag, on its
 * country's colour.
 *
 * A card for TOKEN2049 and a card for ETHDenver used to carry the same grey
 * chart glyph, so the only thing telling them apart was the word. A flag is
 * read before a word is, which is the whole point of the slot.
 *
 * ── The colours are the eSIM shelf's ──
 * The app tints each destination tile with its own flag's colour (`FLAG_COLOUR`
 * / `washFor` in hihodl-wallet's `src/features/travel/esimDestinations.ts`) so
 * Japan reads red and Spain reads yellow before you have read a word. The same
 * table is used here, with the same rule that came with it: red is a hard
 * error everywhere else in this product, so the colour is spent as a WASH
 * behind the badge and never as ink or as a fill.
 *
 * ── When there is no country ──
 * A listing worked for somebody else carries only the event's name, and an
 * older server sends no country at all. Rather than fall back to the glyph
 * that started this, the badge takes a colour from the same table, chosen by
 * the event's own key, and draws the event's initial on it. Two events still
 * differ at a glance; they just do not claim a country nobody told us.
 */

/** Flag colours per country: [dominant] or [dominant, second], the flags' own. */
const FLAG_COLOUR: Record<string, string> = {
  // One colour and a neutral.
  JP: "#BC002D",
  ID: "#CE1126",
  PE: "#D91023",
  CA: "#FF0000",
  CH: "#D52B1E",
  AT: "#ED2939",
  SG: "#EF3340",
  TR: "#E30A17",
  GR: "#0D5EAF",
  // Two strong colours: the hero is the one that lights a dark card.
  TH: "#A51931",
  US: "#3C3B6E",
  ES: "#FFC400",
  IT: "#009246",
  MX: "#006847",
  FR: "#0055A4",
  GB: "#012169",
  PT: "#046A38",
  NL: "#21468B",
  BR: "#009C3B",
  AR: "#74ACDF",
  CO: "#FCD116",
  CL: "#0039A6",
  AE: "#00732F",
  VN: "#DA251D",
  PH: "#0038A8",
  IN: "#FF9933",
  KR: "#003478",
  MY: "#010066",
  ZA: "#007A4D",
  MA: "#C1272D",
  EG: "#C09300",
  KE: "#006600",
  AU: "#00008B",
  NZ: "#00247D",
  // Black and red both die on a dark card, so the gold leads.
  DE: "#FFCE00",
};

/** The app's own teal, for a country with no colour on file. */
const DEFAULT_TINT = "#8ECAE6";

/** The colours an event with no country may be given, in a fixed order. */
const UNKNOWN_TINTS: readonly string[] = ["#8ECAE6", "#FFC400", "#0E9B68", "#74ACDF", "#B07CD6", "#F08C4B", "#4EA8DE", "#E8A0BF"];

/** `#RRGGBB` at `alpha`. */
export function tintRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** An ISO 3166-1 alpha-2 code as its flag, or null when it is not one. */
export function flagEmoji(country: string | null | undefined): string | null {
  const code = (country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  // Regional indicator symbols: A is U+1F1E6, 65 code points after "A".
  return String.fromCodePoint(...[...code].map((c) => c.codePointAt(0)! + 0x1f1e6 - 65));
}

/** Every letter and digit of a key, added up: the same event always gets the same colour. */
function hashOf(key: string): number {
  let n = 0;
  for (let i = 0; i < key.length; i += 1) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return n;
}

export interface EventLook {
  /** The country's flag, when there is a country. */
  flag: string | null;
  /** The wash behind the badge: the country's colour, else this event's own. */
  tint: string;
  /** Drawn when there is no flag: the event's initial. */
  initial: string;
}

export function eventLook(event: { key?: string | null; name?: string | null; country?: string | null } | null | undefined): EventLook {
  const flag = flagEmoji(event?.country);
  const code = (event?.country ?? "").trim().toUpperCase();
  const initial = (event?.name ?? "").trim().charAt(0).toUpperCase() || "·";
  if (flag) return { flag, tint: FLAG_COLOUR[code] ?? DEFAULT_TINT, initial };
  const key = event?.key || event?.name || "";
  return { flag: null, tint: key ? UNKNOWN_TINTS[hashOf(key) % UNKNOWN_TINTS.length] : DEFAULT_TINT, initial };
}

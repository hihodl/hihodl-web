// src/lib/app/spending/categorize.ts: ported VERBATIM from the app's
// hihodl-wallet src/features/spending/categorize.ts. Change the app first, then this.
//
// On-device categorization for spending. There is no backend MCC / merchant
// tag, so we assign every spend a CONCRETE best-guess category from whatever
// signal the transfer carries (counterparty alias, address shape, merchant
// name in the note, payment method). Per Alex: never default to
// "uncategorized" — infer a real category; `other` is the rare last resort.
//
// The user can correct any category; corrections are LEARNED per-counterparty
// (spendingCategories.store.ts) so the same merchant/person auto-adopts the
// chosen category next time. Resolution order:
//   1. explicit per-transaction override
//   2. learned rule for this counterparty
//   3. heuristic inference (this file)

import type { SpendTransfer as Transfer } from "./types";
import type { CategoryId } from "./categories";
import {
  categoryFromCounterpartyType,
  inferCounterpartyType,
  isBankRail,
  isFiatCounterparty,
} from "./counterparty";
import { categoryFromMcc } from "./mcc";

// ─── Spend classification ────────────────────────────────────────────────────
// A "spend" is real consumption: an outbound payment via a spending rail
// (card / crypto). Fiat off-ramps (iban / pix / spei / nuban / …) are payouts
// to a bank, NOT spend, and internal moves/swaps aren't in/out at all. The set
// of bank rails lives in counterparty.ts (`BANK_RAILS`) as the single source of
// truth, shared here so the two files can never drift apart.

/**
 * True when an outbound transfer is a PAYOUT to a bank (fiat off-ramp), not
 * consumption. Uses the rail first, then the counterparty type: a `bank`
 * counterparty is a payout even on a rail we didn't enumerate.
 */
export function isPayoutTransfer(t: Transfer): boolean {
  if (t.direction !== "out") return false;
  if (isBankRail(t.method)) return true;
  return inferCounterpartyType(t) === "bank";
}

/** True when a transfer is categorizable consumption (a real spend). */
export function isSpendTransfer(
  t: Pick<Transfer, "direction" | "method" | "status" | "counterpartyType">,
): boolean {
  if (t.status && t.status !== "confirmed") return false;
  if (t.direction !== "out") return false;
  if (isBankRail(t.method)) return false;
  // A bank counterparty on any rail is a payout, not spend.
  if (t.counterpartyType === "bank") return false;
  return true;
}

// ─── Counterparty key ────────────────────────────────────────────────────────
// Stable identity for "who this payment was with", used to learn corrections.
// Mirrors usePaymentHistory's grouping: outbound → recipient, inbound → sender.
// Prefers @alias, then address, lowercased.
export function counterpartyKey(t: Transfer): string {
  const inbound = t.direction === "in";
  const alias = inbound ? t.fromAlias : t.toAlias;
  const addr = inbound ? t.fromAddress : t.toAddress;
  const raw = (alias || addr || t.id || "").toString().trim().toLowerCase();
  return raw || t.id;
}

/**
 * A short, human label for the counterparty (merchant/person name).
 *
 * `merchantName` comes first, ahead of the alias, because it is the only field
 * that says what was BOUGHT. A stay and an eSIM both settle to an address we
 * own, so before this the fallback printed our own collection address into the
 * guest's Activity — a truncated 0x that names nobody, tells the guest nothing
 * and publishes where we collect. The hotel's name is the honest answer to the
 * same question.
 */
export function counterpartyLabel(t: Transfer): string {
  const merchant = t.merchantName?.trim();
  if (merchant) return merchant;
  const inbound = t.direction === "in";
  const alias = inbound ? t.fromAlias : t.toAlias;
  if (alias && alias.trim()) return alias.trim();
  const addr = (inbound ? t.fromAddress : t.toAddress) || "";
  if (addr.startsWith("0x") && addr.length > 12) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  if (addr.length >= 32 && addr.length <= 44) return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  if (t.note && t.note.trim()) return t.note.trim();
  return addr || "Payment";
}

// ─── Weighted keyword evidence ───────────────────────────────────────────────
// Each category carries STRONG terms (a named brand/merchant → almost certain)
// and WEAK terms (a generic word → a hint). Unlike the old "first hit wins"
// scan, ALL terms are scored and accumulated per category, so more signal =
// better guess (Alex's rule: "contra más info, mejor categorizamos"). A note
// like "uber eats dinner" scores eating_out twice (uber eats + dinner) and
// transport once (uber) → eating_out wins, correctly.
const STRONG = 5;
const WEAK = 2;

interface KeywordRule {
  cat: CategoryId;
  strong: string[];
  weak: string[];
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    cat: "groceries",
    strong: ["walmart", "carrefour", "kroger", "aldi", "lidl", "tesco", "whole foods", "trader joe", "costco", "oxxo", "soriana", "chedraui", "la comer", "jumbo", "d1 ", "ara ", "sainsbury", "mercadona", "dia %", "supermarket", "supermercado"],
    weak: ["grocery", "groceries", "market", "mercado", "abarrotes", "minimarket", "bodega"],
  },
  {
    cat: "eating_out",
    strong: ["starbucks", "mcdonald", "burger king", "kfc", "domino", "pizza hut", "uber eats", "ubereats", "doordash", "deliveroo", "rappi", "grubhub", "just eat", "glovo", "pedidosya", "ifood", "foodpanda", "grabfood"],
    weak: ["restaurant", "restaurante", "cafe", "café", "coffee", "burger", "pizza", "taco", "sushi", "pub", "diner", "bakery", "panaderia", "deli", "food", "dinner", "lunch", "brunch", "comida"],
  },
  {
    cat: "transport",
    strong: ["uber", "lyft", "cabify", "didi", "bolt", "grab", "shell", "chevron", "exxon", "repsol", "pemex", "ypf", "petrobras", "metrocard", "oyster", "clipper"],
    weak: ["taxi", "metro", "transit", "railway", "train", "gasoline", "fuel", "petrol", "gasolina", "parking", "parqueo", "toll", "peaje", "estacionamiento"],
  },
  {
    cat: "subscriptions",
    strong: ["netflix", "spotify", "disney+", "disney plus", "hbo", "hulu", "youtube premium", "apple.com/bill", "apple music", "icloud", "prime video", "amazon prime", "patreon", "substack", "notion", "figma", "adobe", "dropbox", "google one", "openai", "chatgpt", "canva", "linkedin premium"],
    weak: ["subscription", "suscripcion", "membership", "membresia", "recurring", "premium plan"],
  },
  {
    cat: "bills",
    strong: ["at&t", "verizon", "t-mobile", "vodafone", "movistar", "telcel", "claro", "tigo", "orange", "cfe", "edenor", "aysa", "landlord", "sunat", "hacienda"],
    weak: ["electric", "electricidad", "utility", "utilities", "water", "internet", "broadband", "telecom", "phone bill", "mobile plan", "rent", "renta", "alquiler", "arriendo", "insurance", "seguro", "tax ", "impuesto", "recibo", "factura"],
  },
  {
    cat: "entertainment",
    strong: ["ticketmaster", "steam", "playstation", "xbox", "nintendo", "twitch", "cinemark", "cinepolis", "primark cinema"],
    weak: ["cinema", "cine ", "movie", "theater", "theatre", "concert", "concierto", "game", "gaming", "arcade", "bowling"],
  },
  {
    cat: "travel",
    strong: ["airbnb", "booking.com", "expedia", "ryanair", "easyjet", "iberia", "vueling", "latam", "aeromexico", "avianca", "copa air", "hostelworld", "trip.com", "kayak", "despegar"],
    weak: ["hotel", "hostel", "airline", "airlines", "airport", "aeropuerto", "flight", "vuelo", "resort", "motel"],
  },
  {
    cat: "health",
    strong: ["cvs", "walgreens", "farmacias del ahorro", "farmacia guadalajara", "farmacity", "boots", "superpharm"],
    weak: ["pharmacy", "farmacia", "drugstore", "clinic", "clinica", "hospital", "doctor", "dentist", "dentista", "gym", "fitness", "yoga", "wellness", "medic"],
  },
  {
    cat: "shopping",
    strong: ["amazon", "ebay", "aliexpress", "shein", "temu", "zara", "h&m", "nike", "adidas", "apple store", "best buy", "target", "ikea", "mercadolibre", "mercado libre", "falabella", "liverpool", "coppel", "elektra"],
    weak: ["store", "shop", "tienda", "boutique", "mall", "retail", "outlet"],
  },
];

function normalize(s: string | null | undefined): string {
  return (s || "").toString().toLowerCase();
}

export interface CategoryGuess {
  category: CategoryId;
  /** 0..1 rough certainty — 1 = an exact signal (MCC / peer), lower = keyword vote. */
  confidence: number;
  /** Where the guess came from, for tx-detail transparency ("Auto · card code"). */
  reason: "mcc" | "counterparty" | "peer" | "keywords" | "shape";
}

/**
 * Score a spend across EVERY available signal and return the best category with
 * a confidence + reason. Exact signals (MCC, an in-network peer) short-circuit
 * with confidence 1; otherwise keyword evidence is tallied and the argmax wins,
 * with a shape-based fallback so we never emit an "uncategorized" state.
 */
export function classifyCategory(t: Transfer): CategoryGuess {
  // 1. MCC is the exact signal for card spend — trust it over everything else.
  const byMcc = categoryFromMcc(t.mcc);
  if (byMcc) return { category: byMcc, confidence: 1, reason: "mcc" };

  // 2. Counterparty type, when it maps cleanly (peer / mobile money → people).
  const cpType = inferCounterpartyType(t);
  const byType = categoryFromCounterpartyType(cpType);
  if (byType) return { category: byType, confidence: 1, reason: "counterparty" };

  // Peer payments to a HOLD @username are almost always "people".
  const toAlias = normalize(t.toAlias);
  const fromAlias = normalize(t.fromAlias);
  if (toAlias.startsWith("@") || fromAlias.startsWith("@")) {
    return { category: "people", confidence: 1, reason: "peer" };
  }

  // 3. Evidence scan over every text field we carry. More fields + more hits →
  // a higher score. Merchant name is the most trustworthy, so it counts double.
  const merchant = normalize(t.merchantName);
  const rest = [t.toAlias, t.fromAlias, t.note, t.description, t.toAddress]
    .map(normalize)
    .join(" ");

  const scores = new Map<CategoryId, number>();
  const bump = (cat: CategoryId, n: number) => scores.set(cat, (scores.get(cat) ?? 0) + n);

  for (const rule of KEYWORD_RULES) {
    for (const term of rule.strong) {
      if (merchant.includes(term)) bump(rule.cat, STRONG * 2);
      else if (rest.includes(term)) bump(rule.cat, STRONG);
    }
    for (const term of rule.weak) {
      if (merchant.includes(term)) bump(rule.cat, WEAK * 2);
      else if (rest.includes(term)) bump(rule.cat, WEAK);
    }
  }

  if (scores.size > 0) {
    let best: CategoryId = "other";
    let bestScore = 0;
    let total = 0;
    for (const [cat, s] of scores) {
      total += s;
      if (s > bestScore) {
        bestScore = s;
        best = cat;
      }
    }
    // Confidence = how dominant the winner is over the field, capped below 1 so
    // an exact MCC/peer always outranks a keyword vote.
    const confidence = Math.min(0.9, 0.4 + 0.5 * (bestScore / Math.max(total, 1)));
    return { category: best, confidence, reason: "keywords" };
  }

  // 4. No keyword evidence. Fall back on the SHAPE of the payment rather than a
  // generic "uncategorized" bucket:
  //  • Card / any fiat merchant with no name → shopping (typical retail).
  //  • A raw crypto-address send with no name → people (a transfer to someone).
  const addr = normalize(t.toAddress);
  if (t.method === "card" || isFiatCounterparty(cpType)) {
    return { category: "shopping", confidence: 0.3, reason: "shape" };
  }
  if (cpType === "crypto_wallet") return { category: "people", confidence: 0.3, reason: "shape" };
  if (addr.startsWith("0x") || (addr.length >= 32 && addr.length <= 44)) {
    return { category: "people", confidence: 0.3, reason: "shape" };
  }
  return { category: "other", confidence: 0.2, reason: "shape" };
}

/**
 * Best-guess category id for a spend. Thin wrapper over `classifyCategory` for
 * the many call sites that only need the winning category. Never returns a
 * "none" state (Alex's rule).
 */
export function inferCategory(t: Transfer): CategoryId {
  return classifyCategory(t).category;
}

// ─── Layered resolver ────────────────────────────────────────────────────────
export interface CategoryOverrideMaps {
  /** Explicit per-transaction category chosen by the user (built-in or custom id). */
  tx: Record<string, string>;
  /** Learned rule per counterparty key (from past corrections). */
  learned: Record<string, string>;
}

/**
 * Final category for a transfer: per-tx override → learned rule → inference.
 * Returns a string id: a user override may point at a custom category, while
 * inference only ever yields a built-in CategoryId.
 */
export function resolveCategory(t: Transfer, maps: CategoryOverrideMaps): string {
  const byTx = maps.tx[t.id];
  if (byTx) return byTx;
  const byLearned = maps.learned[counterpartyKey(t)];
  if (byLearned) return byLearned;
  return inferCategory(t);
}

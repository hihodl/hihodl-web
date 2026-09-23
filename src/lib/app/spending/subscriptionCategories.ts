// src/lib/app/spending/subscriptionCategories.ts: ported VERBATIM from the app's
// hihodl-wallet src/features/spending/subscriptionCategories.ts. Change the app first, then this.
//
// A FINER taxonomy just for recurring payments. A subscription isn't only
// "Subscriptions" — Alex wants each one tagged as what it actually is: home,
// phone, internet, music, streaming, gym, insurance, water, electricity,
// transport, software… This drives the subscription tiles and lets the user
// reassign a subscription's kind (learned per counterparty).
//
// Inference runs on the merchant/alias/note text (+ a light MCC nudge). Like the
// main categorizer there is no "unknown" default — everything gets a best guess;
// `other` is the last resort.

import type { IonName } from "@/components/app/ion";

import type { SpendTransfer as Transfer } from "./types";

type IoniconName = IonName;

export type SubscriptionCategoryId =
  | "home" // rent / mortgage / HOA
  | "phone"
  | "internet"
  | "streaming" // TV / video
  | "music"
  | "gym"
  | "insurance"
  | "water"
  | "electricity"
  | "transport" // train / metro / transit pass
  | "software" // apps / cloud / productivity
  | "other";

export interface SubscriptionCategoryDef {
  id: SubscriptionCategoryId;
  label: string;
  icon: IoniconName;
}

export const SUBSCRIPTION_CATEGORIES: Record<SubscriptionCategoryId, SubscriptionCategoryDef> = {
  home: { id: "home", label: "Home", icon: "home-outline" },
  phone: { id: "phone", label: "Phone", icon: "call-outline" },
  internet: { id: "internet", label: "Internet", icon: "wifi-outline" },
  streaming: { id: "streaming", label: "Streaming", icon: "tv-outline" },
  music: { id: "music", label: "Music", icon: "musical-notes-outline" },
  gym: { id: "gym", label: "Gym", icon: "barbell-outline" },
  insurance: { id: "insurance", label: "Insurance", icon: "shield-checkmark-outline" },
  water: { id: "water", label: "Water", icon: "water-outline" },
  electricity: { id: "electricity", label: "Electricity", icon: "flash-outline" },
  transport: { id: "transport", label: "Transport", icon: "train-outline" },
  software: { id: "software", label: "Software", icon: "apps-outline" },
  other: { id: "other", label: "Other", icon: "repeat-outline" },
};

export const SUBSCRIPTION_CATEGORY_IDS = Object.keys(
  SUBSCRIPTION_CATEGORIES,
) as SubscriptionCategoryId[];

export function subscriptionCategoryDef(
  id: SubscriptionCategoryId,
): SubscriptionCategoryDef {
  return SUBSCRIPTION_CATEGORIES[id] ?? SUBSCRIPTION_CATEGORIES.other;
}

// Ordered most-specific → most-general; first keyword hit wins. English +
// Spanish (LATAM-first). Extend freely — this is the upgradeable "detection"
// layer, same idea as categorize.ts KEYWORDS.
const KEYWORDS: Array<[SubscriptionCategoryId, string[]]> = [
  ["music", ["spotify", "apple music", "tidal", "deezer", "youtube music", "soundcloud", "musica", "música"]],
  ["streaming", ["netflix", "disney", "hbo", "max ", "hulu", "prime video", "amazon prime", "paramount", "star+", "apple tv", "crunchyroll", "youtube premium", "dazn", "mubi", "vix"]],
  ["gym", ["gym", "fitness", "smartfit", "smart fit", "anytime fitness", "planet fitness", "crossfit", "yoga", "pilates", "gimnasio"]],
  ["insurance", ["insurance", "seguro", "aseguradora", "gnp", "axa", "mapfre", "allianz", "metlife", "sura", "life insurance"]],
  ["water", ["water bill", "agua", "aguas", "sedapal", "aqualia", "saur", "acueducto"]],
  ["electricity", ["electric", "electricidad", "luz", "cfe", "iberdrola", "endesa", "enel", "edp", "power company", "energia", "energía"]],
  ["internet", ["internet", "fibra", "fiber", "broadband", "izzi", "totalplay", "megacable", "comcast", "xfinity", "spectrum", "wifi"]],
  ["phone", ["movistar", "claro", "telcel", "at&t", "verizon", "t-mobile", "vodafone", "orange", "tigo", "entel", "personal ", "phone bill", "mobile", "wireless", "movil", "móvil", "celular", "prepago", "recarga"]],
  ["transport", ["metro", "subway", "transit", "tren", "train", "railway", "bus pass", "transport", "movilidad", "bip!", "sube", "oyster", "clipper", "ez pass", "renfe", "cercanias"]],
  ["home", ["rent", "alquiler", "renta", "arriendo", "landlord", "mortgage", "hipoteca", "condo", "hoa", "administracion", "administración"]],
  ["software", ["adobe", "notion", "figma", "dropbox", "google one", "icloud", "apple.com/bill", "microsoft", "office 365", "github", "openai", "chatgpt", "canva", "1password", "app store"]],
];

function normalize(s: string | null | undefined): string {
  return (s || "").toString().toLowerCase();
}

/** Best-guess subscription kind from a transfer's merchant/alias/note text. */
export function inferSubscriptionCategory(t: Transfer): SubscriptionCategoryId {
  const hay = [t.merchantName, t.toAlias, t.fromAlias, t.note, t.toAddress]
    .map(normalize)
    .join(" ");
  for (const [cat, words] of KEYWORDS) {
    for (const w of words) {
      if (hay.includes(w)) return cat;
    }
  }
  return "other";
}

/**
 * The backend's rules, checked here first.
 *
 * WHY THIS FILE EXISTS
 *
 * A form that lets a creator build a listing the server then refuses is worse
 * than no form: they have spent an evening on a ladder and get back a code.
 * So every rule the API enforces on a draft or at publish is mirrored here,
 * keyed to the field it belongs to, and the wizard shows it beside that field
 * as the creator types.
 *
 * It is a mirror, never the authority. The server checks all of it again and
 * its answer wins; `describeProblem` in ./problems is what turns that answer
 * into words when this file has missed something.
 *
 * THE RULE WORTH READING TWICE
 *
 * A rung's way of selling is NOT the board's. A ladder can be `fixed` overall
 * with one rung out to bids, and the controls for that rung must come from the
 * rung — deriving them from the board was a whole family of bugs, and the
 * shape of this file is what keeps it from coming back: everything about a
 * rung is decided from `saleModeOf(draft, rung.saleMode)`.
 */

import { t } from "@/lib/app/i18n";

import {
  BRAND_GETS_LIMITS,
  LIMITS,
  WHOLE_ZONE_KEY,
  anyRungBids,
  centsFromDollars,
  isCustomServiceTemplate,
  isProductionTemplate,
  isSessionTemplate,
  PRODUCTION_DELIVERABLE_MAX,
  PRODUCTION_DELIVERABLES,
  PRODUCTION_TURNAROUNDS,
  modeKeepsFloor,
  modeShowsPrice,
  requiredAttestations,
  saleModeOf,
  usd,
  VENUES_WITH_RULES,
  type ListingDraft,
  type Template,
} from "./listing";

/**
 * Which card of the editor a problem belongs to, so the pager can point at it.
 *
 * One step is one card, and a card is meant to fit on a screen. That is why
 * there are seven of these and not four: "name and dates" was three questions
 * in a wall, and "go live" was everything a listing promises plus everything
 * it declares.
 */
export type Step = "name" | "event" | "dates" | "includes" | "sell" | "promise" | "publish";

/** The cards in the order they are swiped through. */
export const STEP_ORDER: readonly Step[] = ["name", "event", "dates", "includes", "sell", "promise", "publish"];

export interface Problem {
  /** The field this sits next to: "title", "rung:tier-2:price", "attestations". */
  where: string;
  step: Step;
  message: string;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

function dayStart(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

/** An amount box: null when empty, NaN-ish when it is not a number at all. */
function amount(text: string): number | null | "bad" {
  if (!text.trim()) return null;
  const cents = centsFromDollars(text);
  return cents === null ? "bad" : cents;
}

/**
 * Everything wrong with this draft, all at once.
 *
 * All of them rather than the first, because the creator is filling in a form:
 * telling them one field at a time turns one correction into six round trips.
 * That is the same reason the backend's own `draftProblems` collects.
 */
export function listingProblems(draft: ListingDraft, template: Template, now = Date.now()): Problem[] {
  const out: Problem[] = [];
  const add = (where: string, step: Step, message: string) => out.push({ where, step, message });
  const session = isSessionTemplate(template);
  const production = isProductionTemplate(template);
  const service = template.kind === "service";

  /* ── What it is called, and when it closes ─────────────────────── */

  const title = draft.title.trim();
  if (title.length < LIMITS.TITLE_MIN) {
    add("title", "name", t("listings.rules.titleTooShort", { min: LIMITS.TITLE_MIN }));
  } else if (title.length > LIMITS.TITLE_MAX) {
    add("title", "name", t("listings.rules.titleTooLong", { length: title.length, max: LIMITS.TITLE_MAX }));
  }
  if (draft.reason.trim().length > LIMITS.REASON_MAX) {
    add("reason", "name", t("listings.rules.keepUnder", { max: LIMITS.REASON_MAX }));
  }

  const goal = amount(draft.fundingGoalDollars);
  if (goal === "bad") {
    add("goal", "name", t("listings.rules.goalNotAmount"));
  } else if (goal !== null && (goal < LIMITS.GOAL_MIN_CENTS || goal > LIMITS.GOAL_MAX_CENTS)) {
    add(
      "goal",
      "name",
      t("listings.rules.goalOutOfRange", { min: usd(LIMITS.GOAL_MIN_CENTS), max: usd(LIMITS.GOAL_MAX_CENTS) }),
    );
  }

  const closesMs = draft.closesAt ? new Date(draft.closesAt).getTime() : NaN;
  if (!Number.isFinite(closesMs)) {
    add("closesAt", "dates", t("listings.rules.closesRequired"));
  } else if (closesMs - now < LIMITS.MIN_CAMPAIGN_HOURS * HOUR) {
    add("closesAt", "dates", t("listings.rules.closesTooSoon", { hours: LIMITS.MIN_CAMPAIGN_HOURS }));
  } else if (closesMs - now > LIMITS.MAX_CAMPAIGN_DAYS * DAY) {
    add("closesAt", "dates", t("listings.problems.closesTooLate", { days: LIMITS.MAX_CAMPAIGN_DAYS }));
  }

  if (draft.keyDates.length > LIMITS.KEY_DATES_MAX) {
    add("keyDates", "dates", t("listings.rules.tooManyKeyDates", { max: LIMITS.KEY_DATES_MAX }));
  }
  draft.keyDates.forEach((k, i) => {
    if (k.label.trim() && !k.date) add(`keyDate:${i}`, "dates", t("listings.rules.keyDateNeedsDay"));
    if (k.date && !k.label.trim()) add(`keyDate:${i}`, "dates", t("listings.rules.keyDateNeedsLabel"));
  });

  /* ── The event ─────────────────────────────────────────────────── */

  // The venue is derived from the event answers (`venueFor`), so this only
  // fires for a draft saved before those answers existed, or one whose product
  // was swapped underneath it.
  if (!template.allowedVenues.includes(draft.venueType)) {
    add("venueType", "event", t("listings.rules.venueNotAllowed"));
  }
  if (VENUES_WITH_RULES.includes(draft.venueType) && !draft.eventId && !draft.eventName.trim()) {
    add("event", "event", t("listings.problems.eventNameRequired"));
  }
  if (session && !draft.eventId) {
    add(
      "event",
      "event",
      t("listings.rules.sessionNeedsEvent"),
    );
  }

  if (production && !draft.eventId) {
    add(
      "event",
      "event",
      t("listings.rules.productionNeedsEvent"),
    );
  }

  /* ── What a spot includes (content production) ─────────────────── */

  if (production) {
    const pkg = draft.production;
    const counts = PRODUCTION_DELIVERABLES.map((k) => pkg.deliverables[k]);
    if (counts.some((n) => !Number.isInteger(n) || n < 0 || n > PRODUCTION_DELIVERABLE_MAX)) {
      add("production:deliverables", "includes", t("listings.rules.productionLineRange", { max: PRODUCTION_DELIVERABLE_MAX }));
    } else if (counts.every((n) => n === 0)) {
      add("production:deliverables", "includes", t("listings.rules.productionEmpty"));
    }
    if (!(PRODUCTION_TURNAROUNDS as readonly number[]).includes(pkg.turnaroundHours)) {
      add("production:turnaround", "includes", t("listings.rules.productionTurnaround"));
    }
  }

  /* ── How it sells ──────────────────────────────────────────────── */

  if (draft.acceptsOffers && draft.pricingMode !== "fixed") {
    add("pricing", "sell", t("listings.problems.offersOnlyOnFixed"));
  }
  if (production && draft.pricingMode !== "fixed") {
    add("pricing", "sell", t("listings.rules.productionSellsAtPrice"));
  }
  if (session && draft.pricingMode === "takeover") {
    add("pricing", "sell", t("listings.rules.takeoverNotForSessions"));
  }
  if (draft.pricingMode === "takeover" && !draft.chains.includes("solana")) {
    add("chains", "sell", t("listings.rules.takeoverNeedsSolana"));
  }
  if (draft.pricingMode === "bids" && service && draft.sells !== "ladder") {
    add("pricing", "sell", t("listings.rules.bidsNeedLadder"));
  }
  if (draft.chains.length === 0) {
    add("chains", "sell", t("listings.problems.chainsRequired"));
  }

  const needsCountdown = draft.pricingMode === "bids" || anyRungBids(draft);
  if (needsCountdown) {
    const endMs = draft.biddingEndsAt ? new Date(draft.biddingEndsAt).getTime() : NaN;
    const latest = closesMs - LIMITS.BIDDING_MIN_BEFORE_CLOSE_HOURS * HOUR;
    if (!Number.isFinite(endMs)) {
      add(
        "biddingEndsAt",
        "sell",
        anyRungBids(draft)
          ? t("listings.rules.rungNeedsBiddingEnd")
          : t("listings.rules.biddingEndRequired"),
      );
    } else if (Number.isFinite(closesMs) && endMs > latest) {
      add(
        "biddingEndsAt",
        "sell",
        t("listings.rules.biddingEndTooLate", { hours: LIMITS.BIDDING_MIN_BEFORE_CLOSE_HOURS }),
      );
    } else if (endMs < now + LIMITS.BIDDING_MIN_AFTER_PUBLISH_HOURS * HOUR) {
      add(
        "biddingEndsAt",
        "sell",
        t("listings.rules.biddingEndTooSoon", { hours: LIMITS.BIDDING_MIN_AFTER_PUBLISH_HOURS }),
      );
    }
  } else if (draft.biddingEndsAt) {
    add("biddingEndsAt", "sell", t("listings.rules.noBidding"));
  }

  /* ── What is for sale ──────────────────────────────────────────── */

  if (service) {
    const maxSlots = template.service?.maxSlots ?? 0;
    if (draft.sells === "ladder") {
      ladderProblems(draft, template, maxSlots, session, add);
    } else {
      const mode = saleModeOf(draft, null);
      if (!Number.isInteger(draft.slots) || draft.slots < 1 || draft.slots > maxSlots) {
        add("slots", "sell", t("listings.rules.slotsRange", { max: maxSlots }));
      }
      priceProblems({
        add,
        where: "slotPrice",
        floorWhere: "slotFloor",
        mode,
        priceText: draft.slotPriceDollars,
        floorText: draft.slotMinOfferDollars,
        session,
        what: t("listings.rules.whatSlots"),
      });
    }
  } else {
    const on = draft.zones.filter((z) => z.on);
    if (on.length === 0) {
      add("zones", "sell", t("listings.rules.noZones"));
    }
    if (on.length > LIMITS.MAX_POSITIONS) {
      add("zones", "sell", t("listings.problems.tooManyPositions", { max: LIMITS.MAX_POSITIONS }));
    }
    const mode = saleModeOf(draft, null);

    /* One brand takes everything (ad-space-whole-listing-v0.md), mirrored from
       `draftProblems` in the backend's rules.ts so the creator reads it while
       they type instead of when they publish. Both rules are about the whole
       listing NEXT TO the squares it replaces, so neither has anything to say
       on a listing that does not sell one. */
    const whole = on.find((z) => z.zoneKey === WHOLE_ZONE_KEY) ?? null;
    const squares = on.filter((z) => z.zoneKey !== WHOLE_ZONE_KEY);
    if (whole && squares.length === 0) {
      add(
        "zones",
        "sell",
        t("listings.rules.wholeNeedsSquares"),
      );
    }
    if (whole) {
      // Skipped where the board shows no prices (offers, bids): there is
      // nothing to compare, exactly as the server skips it.
      const all = centsFromDollars(whole.priceDollars);
      const each = squares.map((z) => centsFromDollars(z.priceDollars));
      const parts = each.every((c) => c !== null) ? each.reduce<number>((sum, c) => sum + (c ?? 0), 0) : null;
      if (all !== null && parts !== null && squares.length > 0 && all < parts) {
        add(
          `zone:${WHOLE_ZONE_KEY}:price`,
          "sell",
          t("listings.rules.wholeBelowParts", { amount: usd(parts) }),
        );
      }
    }

    for (const zone of on) {
      const label =
        zone.zoneKey === WHOLE_ZONE_KEY
          ? t("listings.rules.allOfIt")
          : (template.zones.find((z) => z.zoneKey === zone.zoneKey)?.label ?? zone.zoneKey);
      if (zone.accepts.length === 0) {
        add(`zone:${zone.zoneKey}:accepts`, "sell", t("listings.rules.zoneAccepts", { label: label.toLowerCase() }));
      }
      priceProblems({
        add,
        where: `zone:${zone.zoneKey}:price`,
        floorWhere: `zone:${zone.zoneKey}:floor`,
        mode,
        priceText: zone.priceDollars,
        floorText: zone.minOfferDollars,
        session: false,
        what: t("listings.rules.whatZone", { label: label.toLowerCase() }),
      });
      if (zone.pitch.trim().length > LIMITS.PITCH_MAX) {
        add(`zone:${zone.zoneKey}:pitch`, "sell", t("listings.rules.keepUnder", { max: LIMITS.PITCH_MAX }));
      }
    }
  }

  /* ── What you promise ──────────────────────────────────────────── */

  const closeDay = Number.isFinite(closesMs) ? closesMs : now;
  const todayStart = Math.floor(now / DAY) * DAY;
  const latestDue = closeDay + LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE * DAY;

  if (service) {
    if (!session && !production) {
      const by = draft.deliverBy ? dayStart(draft.deliverBy) : null;
      if (!draft.deliverBy) {
        add("deliverBy", "promise", t("listings.rules.deliverByRequired"));
      } else if (by === null || by < todayStart || by > latestDue) {
        add(
          "deliverBy",
          "promise",
          t("listings.problems.dayInRange", { days: LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE }),
        );
      }
    }
  } else {
    if (draft.deliverables.length === 0) {
      add(
        "deliverables",
        "promise",
        t("listings.rules.noDeliverables"),
      );
    } else if (!draft.deliverables.some((d) => d.kind !== "in_person")) {
      add(
        "deliverables",
        "promise",
        t("listings.rules.noContentDeliverable"),
      );
    }
    if (draft.deliverables.length > LIMITS.DELIVERABLES_MAX) {
      add("deliverables", "promise", t("listings.problems.tooManyDeliverables", { max: LIMITS.DELIVERABLES_MAX }));
    }
    draft.deliverables.forEach((d, i) => {
      if (!Number.isInteger(d.count) || d.count < 1 || d.count > LIMITS.DELIVERABLE_COUNT_MAX) {
        add(`deliverable:${i}:count`, "promise", t("listings.problems.deliverableCount", { max: LIMITS.DELIVERABLE_COUNT_MAX }));
      }
      const due = d.dueDate ? dayStart(d.dueDate) : null;
      if (due === null || due < todayStart || due > latestDue) {
        add(
          `deliverable:${i}:dueDate`,
          "promise",
          t("listings.problems.dayInRange", { days: LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE }),
        );
      }
      const note = d.note.trim();
      if (d.kind === "custom" && (note.length < LIMITS.NOTE_MIN || note.length > LIMITS.NOTE_MAX)) {
        add(
          `deliverable:${i}:note`,
          "promise",
          t("listings.rules.customNoteLength", { min: LIMITS.NOTE_MIN, max: LIMITS.NOTE_MAX }),
        );
      }
      if (note.length > LIMITS.NOTE_MAX) {
        add(`deliverable:${i}:note`, "promise", t("listings.rules.keepUnder", { max: LIMITS.NOTE_MAX }));
      }
    });
  }

  if (production && draft.fallback !== "creator_refund" && draft.fallback !== "next_event") {
    add(
      "fallback",
      "promise",
      t("listings.problems.fallbackNotForProduction"),
    );
  }
  if (session && draft.fallback !== "creator_refund" && draft.fallback !== "next_event") {
    add(
      "fallback",
      "promise",
      t("listings.problems.fallbackNotForSessions"),
    );
  }
  if (draft.fallback === "next_event" && draft.fallbackNote.trim().length < 5) {
    add("fallbackNote", "promise", t("listings.rules.fallbackNeedsDetails"));
  }
  if (draft.fallbackNote.trim().length > LIMITS.REASON_MAX) {
    add("fallbackNote", "promise", t("listings.rules.keepUnder", { max: LIMITS.REASON_MAX }));
  }

  if (isCustomServiceTemplate(template)) {
    const name = draft.serviceName.trim();
    const summary = draft.serviceSummary.trim();
    if (name.length < LIMITS.SERVICE_NAME_MIN || name.length > LIMITS.SERVICE_NAME_MAX) {
      add("serviceName", "promise", t("listings.problems.serviceNameLength", { min: LIMITS.SERVICE_NAME_MIN, max: LIMITS.SERVICE_NAME_MAX }));
    }
    if (summary.length < LIMITS.SERVICE_SUMMARY_MIN || summary.length > LIMITS.SERVICE_SUMMARY_MAX) {
      add(
        "serviceSummary",
        "promise",
        t("listings.rules.serviceSummaryLength", { min: LIMITS.SERVICE_SUMMARY_MIN, max: LIMITS.SERVICE_SUMMARY_MAX }),
      );
    }
  }

  if (draft.brandGets) {
    if (draft.brandGets.length > BRAND_GETS_LIMITS.MAX_LINES) {
      add("brandGets", "promise", t("listings.rules.brandGetsTooMany", { max: BRAND_GETS_LIMITS.MAX_LINES }));
    }
    draft.brandGets.forEach((l, i) => {
      if (l.kind !== "text") return;
      const text = l.text.trim();
      if (text && (text.length < BRAND_GETS_LIMITS.TEXT_MIN || text.length > BRAND_GETS_LIMITS.TEXT_MAX)) {
        add(`brandGets:${i}`, "promise", t("listings.problems.charsRange", { min: BRAND_GETS_LIMITS.TEXT_MIN, max: BRAND_GETS_LIMITS.TEXT_MAX }));
      }
    });
  }

  const required = requiredAttestations(template.requiredAttestations, draft.venueType, template.kind, session, production);
  if (required.some((a) => !draft.attestations.includes(a))) {
    add("attestations", "publish", t("listings.rules.missingAttestation"));
  }

  return out;
}

/* ── The ladder ───────────────────────────────────────────────────── */

function ladderProblems(
  draft: ListingDraft,
  template: Template,
  maxSlots: number,
  session: boolean,
  add: (where: string, step: Step, message: string) => void,
) {
  if (draft.rungs.length === 0) {
    add("ladder", "sell", t("listings.rules.ladderEmpty"));
    return;
  }
  if (draft.rungs.length > LIMITS.MAX_TIERS) {
    add("ladder", "sell", t("listings.rules.tooManyTiers", { max: LIMITS.MAX_TIERS }));
  }
  const copies = draft.rungs.reduce((sum, r) => sum + (Number.isInteger(r.available) ? Math.max(0, r.available) : 0), 0);
  if (copies < 1 || copies > maxSlots) {
    add("ladder", "sell", t("listings.rules.ladderCopies", { copies, max: maxSlots }));
  }

  for (const rung of draft.rungs) {
    const where = `rung:${rung.key}`;
    const mode = saleModeOf(draft, rung.saleMode);
    const named = rung.title.trim() || t("listings.rules.thisOne");

    const title = rung.title.trim();
    if (!title) {
      add(`${where}:title`, "sell", t("listings.rules.rungTitleRequired"));
    } else if (title.length > LIMITS.TIER_TITLE_MAX) {
      add(`${where}:title`, "sell", t("listings.rules.rungTitleTooLong", { max: LIMITS.TIER_TITLE_MAX }));
    }

    const perks = rung.perks.map((p) => p.trim()).filter(Boolean);
    if (perks.length === 0) {
      add(`${where}:perks`, "sell", t("listings.rules.perksRequired"));
    }
    if (perks.length > LIMITS.TIER_PERKS_MAX) {
      add(`${where}:perks`, "sell", t("listings.rules.tooManyPerks", { max: LIMITS.TIER_PERKS_MAX }));
    }
    if (perks.some((p) => p.length > LIMITS.TIER_PERK_MAX)) {
      add(`${where}:perks`, "sell", t("listings.rules.perkTooLong", { max: LIMITS.TIER_PERK_MAX }));
    }

    // THE RUNG RULE: a rung sold to the highest bid sells exactly one thing.
    //
    // Read the RESOLVED mode, not `rung.saleMode`, because the rule is about
    // substitutes and not about who named the mode. Every copy of a rung is
    // priced alike and buys the same thing, so five of them under one
    // countdown are five auctions of the same lot: the bidders scatter across
    // them and all five clear under what one would have fetched. That is true
    // whether the rung chose bidding or the whole listing did.
    //
    // It is also why this has never applied to the spots on a product: a lid
    // and a front are not substitutes, so each of those really is its own
    // bidding. `saleModeOf` is the line between the two.
    if (!Number.isInteger(rung.available) || rung.available < 1 || rung.available > maxSlots) {
      add(`${where}:available`, "sell", t("listings.rules.availableRange", { max: maxSlots }));
    } else if (mode === "bids" && rung.available !== 1) {
      add(
        `${where}:available`,
        "sell",
        t("listings.rules.bidRungSellsOne", { name: named }),
      );
    }

    priceProblems({
      add,
      where: `${where}:price`,
      floorWhere: `${where}:floor`,
      mode,
      priceText: rung.priceDollars,
      floorText: rung.minOfferDollars,
      session,
      what: named,
    });

    if (rung.pitch.trim().length > LIMITS.PITCH_MAX) {
      add(`${where}:pitch`, "sell", t("listings.rules.keepUnder", { max: LIMITS.PITCH_MAX }));
    }
  }
}

/* ── One thing's price and its floor ──────────────────────────────── */

/**
 * The price rules for one thing sold one way, wherever it sits.
 *
 * The same function for a rung, a slot and a zone, because on the backend it
 * is the same function: `offerModeProblem` is applied per rung on a ladder and
 * per position on a board, and there is no second pricing engine anywhere.
 */
function priceProblems(args: {
  add: (where: string, step: Step, message: string) => void;
  where: string;
  floorWhere: string;
  mode: ReturnType<typeof saleModeOf>;
  priceText: string;
  floorText: string;
  session: boolean;
  what: string;
}) {
  const { add, where, floorWhere, mode, session, what } = args;
  const offerFloor = session ? Math.max(LIMITS.OFFER_MIN_CENTS, LIMITS.SESSION_MIN_CENTS) : LIMITS.OFFER_MIN_CENTS;
  const price = amount(args.priceText);
  const floor = amount(args.floorText);

  if (price === "bad") add(where, "sell", t("listings.rules.priceNotAmount"));
  if (floor === "bad") add(floorWhere, "sell", t("listings.rules.floorNotAmount"));

  if (!modeShowsPrice(mode)) {
    // Nothing to check: the price box is not shown, and anything typed into it
    // before the mode changed is dropped by `bodyOf`.
  } else if (price === null) {
    add(where, "sell", mode === "bids" ? t("listings.rules.openingBidRequired", { what }) : t("listings.rules.priceRequired", { what }));
  } else if (typeof price === "number") {
    const min = mode === "bids" ? offerFloor : session ? LIMITS.SESSION_MIN_CENTS : LIMITS.PRICE_MIN_CENTS;
    if (price < min || price > LIMITS.PRICE_MAX_CENTS) {
      add(where, "sell", t("listings.problems.priceOutOfRange", { min: usd(min), max: usd(LIMITS.PRICE_MAX_CENTS) }));
    }
  }

  if (!modeKeepsFloor(mode) || typeof floor !== "number") return;
  if (floor < offerFloor || floor > LIMITS.PRICE_MAX_CENTS) {
    add(floorWhere, "sell", t("listings.rules.floorOutOfRange", { min: usd(offerFloor), max: usd(LIMITS.PRICE_MAX_CENTS) }));
    return;
  }
  if (typeof price !== "number") return;
  if (mode === "bids" && floor < price) {
    add(floorWhere, "sell", t("listings.rules.reserveBelowOpening", { amount: usd(price) }));
  }
  if (mode === "fixed_with_offers" && floor >= price) {
    add(floorWhere, "sell", t("listings.rules.floorAbovePrice", { amount: usd(price) }));
  }
}

/** The first step that still has something wrong on it, or null. */
export function firstStepWithProblem(problems: readonly Problem[]): Step | null {
  for (const step of STEP_ORDER) {
    if (problems.some((p) => p.step === step)) return step;
  }
  return null;
}

/** The problems sitting on one field, as sentences. */
export function problemsAt(problems: readonly Problem[], where: string): string[] {
  return problems.filter((p) => p.where === where).map((p) => p.message);
}

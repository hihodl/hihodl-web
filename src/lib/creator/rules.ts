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
    add("title", "name", `Give the listing a name of at least ${LIMITS.TITLE_MIN} characters. It is the headline a brand reads first.`);
  } else if (title.length > LIMITS.TITLE_MAX) {
    add("title", "name", `That name is ${title.length} characters. ${LIMITS.TITLE_MAX} is the most a listing can carry.`);
  }
  if (draft.reason.trim().length > LIMITS.REASON_MAX) {
    add("reason", "name", `Keep this under ${LIMITS.REASON_MAX} characters.`);
  }

  const goal = amount(draft.fundingGoalDollars);
  if (goal === "bad") {
    add("goal", "name", "Write the goal as an amount in dollars, like 2400.");
  } else if (goal !== null && (goal < LIMITS.GOAL_MIN_CENTS || goal > LIMITS.GOAL_MAX_CENTS)) {
    add(
      "goal",
      "name",
      `A goal runs from ${usd(LIMITS.GOAL_MIN_CENTS)} to ${usd(LIMITS.GOAL_MAX_CENTS)}. We do not round it into range — a page asking for a figure you did not type would be worse than this line.`,
    );
  }

  const closesMs = draft.closesAt ? new Date(draft.closesAt).getTime() : NaN;
  if (!Number.isFinite(closesMs)) {
    add("closesAt", "dates", "Say when the listing stops taking sponsors.");
  } else if (closesMs - now < LIMITS.MIN_CAMPAIGN_HOURS * HOUR) {
    add("closesAt", "dates", `A listing runs for at least ${LIMITS.MIN_CAMPAIGN_HOURS} hours, so pick a time at least a day from now.`);
  } else if (closesMs - now > LIMITS.MAX_CAMPAIGN_DAYS * DAY) {
    add("closesAt", "dates", `A listing runs for at most ${LIMITS.MAX_CAMPAIGN_DAYS} days.`);
  }

  if (draft.keyDates.length > LIMITS.KEY_DATES_MAX) {
    add("keyDates", "dates", `${LIMITS.KEY_DATES_MAX} dates is the most a listing shows.`);
  }
  draft.keyDates.forEach((k, i) => {
    if (k.label.trim() && !k.date) add(`keyDate:${i}`, "dates", "Give this date a day.");
    if (k.date && !k.label.trim()) add(`keyDate:${i}`, "dates", "Say what happens on this day.");
  });

  /* ── The event ─────────────────────────────────────────────────── */

  // The venue is derived from the event answers (`venueFor`), so this only
  // fires for a draft saved before those answers existed, or one whose product
  // was swapped underneath it.
  if (!template.allowedVenues.includes(draft.venueType)) {
    add("venueType", "event", "This product cannot be sold at that kind of event. Answer the event question again.");
  }
  if (VENUES_WITH_RULES.includes(draft.venueType) && !draft.eventId && !draft.eventName.trim()) {
    add("event", "event", "Name the event. A sponsor buying a spot at a conference is buying that conference.");
  }
  if (session && !draft.eventId) {
    add(
      "event",
      "event",
      "Time in person is always sold at an event, and it has to be one from the list — the last day of the event is what sets your delivery date.",
    );
  }

  if (production && !draft.eventId) {
    add(
      "event",
      "event",
      "Content production is filmed at an event, and it has to be one from the list: its dates are your shoot window.",
    );
  }

  /* ── What a spot includes (content production) ─────────────────── */

  if (production) {
    const pkg = draft.production;
    const counts = PRODUCTION_DELIVERABLES.map((k) => pkg.deliverables[k]);
    if (counts.some((n) => !Number.isInteger(n) || n < 0 || n > PRODUCTION_DELIVERABLE_MAX)) {
      add("production:deliverables", "includes", `Each line runs from 0 to ${PRODUCTION_DELIVERABLE_MAX}.`);
    } else if (counts.every((n) => n === 0)) {
      add("production:deliverables", "includes", "Tick at least one thing a spot includes. A brand is buying the package, so it has to hold something.");
    }
    if (!(PRODUCTION_TURNAROUNDS as readonly number[]).includes(pkg.turnaroundHours)) {
      add("production:turnaround", "includes", "Pick how soon after each shoot day you deliver.");
    }
  }

  /* ── How it sells ──────────────────────────────────────────────── */

  if (draft.acceptsOffers && draft.pricingMode !== "fixed") {
    add("pricing", "sell", "Sponsors can only be allowed to offer less on a listing that has a fixed price.");
  }
  if (production && draft.pricingMode !== "fixed") {
    add("pricing", "sell", "A production spot is sold at a price. You can still let brands offer less.");
  }
  if (session && draft.pricingMode === "takeover") {
    add("pricing", "sell", "A booking a stranger can take off you by paying double is not a booking, so time in person is never sold that way.");
  }
  if (draft.pricingMode === "takeover" && !draft.chains.includes("solana")) {
    add("chains", "sell", "Taking a spot over repays the sponsor being displaced inside the same payment, and only Solana carries that today. Accept Solana, or sell another way.");
  }
  if (draft.pricingMode === "bids" && service && draft.sells !== "ladder") {
    add("pricing", "sell", "Identical slots cannot all be sold to one highest bid. Build a ladder and put the rung you want bid on out to bids, or sell these at a price.");
  }
  if (draft.chains.length === 0) {
    add("chains", "sell", "Pick at least one network a sponsor can pay you on.");
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
          ? "One of your rungs is sold to the highest bid, so the listing needs a moment when bidding stops."
          : "Say when bidding stops.",
      );
    } else if (Number.isFinite(closesMs) && endMs > latest) {
      add(
        "biddingEndsAt",
        "sell",
        `Bidding has to stop at least ${LIMITS.BIDDING_MIN_BEFORE_CLOSE_HOURS} hours before the listing closes. That is the room the winner needs: a day for you to decide, a day for them to pay, and a little slack.`,
      );
    } else if (endMs < now + LIMITS.BIDDING_MIN_AFTER_PUBLISH_HOURS * HOUR) {
      add(
        "biddingEndsAt",
        "sell",
        `Bidding runs for at least ${LIMITS.BIDDING_MIN_AFTER_PUBLISH_HOURS} hours once the listing is live, so pick a time at least a day from now.`,
      );
    }
  } else if (draft.biddingEndsAt) {
    add("biddingEndsAt", "sell", "Nothing here is sold by bidding, so there is no bidding to stop.");
  }

  /* ── What is for sale ──────────────────────────────────────────── */

  if (service) {
    const maxSlots = template.service?.maxSlots ?? 0;
    if (draft.sells === "ladder") {
      ladderProblems(draft, template, maxSlots, session, add);
    } else {
      const mode = saleModeOf(draft, null);
      if (!Number.isInteger(draft.slots) || draft.slots < 1 || draft.slots > maxSlots) {
        add("slots", "sell", `You can offer between 1 and ${maxSlots} of these.`);
      }
      priceProblems({
        add,
        where: "slotPrice",
        floorWhere: "slotFloor",
        mode,
        priceText: draft.slotPriceDollars,
        floorText: draft.slotMinOfferDollars,
        session,
        what: "these slots",
      });
    }
  } else {
    const on = draft.zones.filter((z) => z.on);
    if (on.length === 0) {
      add("zones", "sell", "Pick at least one spot on the product to sell.");
    }
    if (on.length > LIMITS.MAX_POSITIONS) {
      add("zones", "sell", `${LIMITS.MAX_POSITIONS} spots is the most one listing can carry.`);
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
        `Pick the spots a brand could buy one at a time as well. On its own, "one brand takes everything" is a single spot with a long name — there is nothing for it to take.`,
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
          `All of it has to cost at least ${usd(parts)}, what the spots come to together. The brand going all in should never pay less than the brand buying one spot.`,
        );
      }
    }

    for (const zone of on) {
      const label =
        zone.zoneKey === WHOLE_ZONE_KEY
          ? "all of it"
          : (template.zones.find((z) => z.zoneKey === zone.zoneKey)?.label ?? zone.zoneKey);
      if (zone.accepts.length === 0) {
        add(`zone:${zone.zoneKey}:accepts`, "sell", `Say what a sponsor may put on the ${label.toLowerCase()}.`);
      }
      priceProblems({
        add,
        where: `zone:${zone.zoneKey}:price`,
        floorWhere: `zone:${zone.zoneKey}:floor`,
        mode,
        priceText: zone.priceDollars,
        floorText: zone.minOfferDollars,
        session: false,
        what: `the ${label.toLowerCase()}`,
      });
      if (zone.pitch.trim().length > LIMITS.PITCH_MAX) {
        add(`zone:${zone.zoneKey}:pitch`, "sell", `Keep this under ${LIMITS.PITCH_MAX} characters.`);
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
        add("deliverBy", "promise", "Say the day every sponsor has their work by. It is the promise the whole listing rests on.");
      } else if (by === null || by < todayStart || by > latestDue) {
        add(
          "deliverBy",
          "promise",
          `Pick a day between today and ${LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE} days after the listing closes.`,
        );
      }
    }
  } else {
    if (draft.deliverables.length === 0) {
      add(
        "deliverables",
        "promise",
        "Promise at least one thing a venue cannot take away. A sponsor who bought a spot on your suitcase and nothing else has bought something the organiser can cancel.",
      );
    } else if (!draft.deliverables.some((d) => d.kind !== "in_person")) {
      add(
        "deliverables",
        "promise",
        "At least one of these has to be something you post — a photo, a video, a story, a mention. Being there in person is not something a sponsor can be shown afterwards.",
      );
    }
    if (draft.deliverables.length > LIMITS.DELIVERABLES_MAX) {
      add("deliverables", "promise", `${LIMITS.DELIVERABLES_MAX} promises is the most one listing can carry.`);
    }
    draft.deliverables.forEach((d, i) => {
      if (!Number.isInteger(d.count) || d.count < 1 || d.count > LIMITS.DELIVERABLE_COUNT_MAX) {
        add(`deliverable:${i}:count`, "promise", `Between 1 and ${LIMITS.DELIVERABLE_COUNT_MAX} of them.`);
      }
      const due = d.dueDate ? dayStart(d.dueDate) : null;
      if (due === null || due < todayStart || due > latestDue) {
        add(
          `deliverable:${i}:dueDate`,
          "promise",
          `Pick a day between today and ${LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE} days after the listing closes.`,
        );
      }
      const note = d.note.trim();
      if (d.kind === "custom" && (note.length < LIMITS.NOTE_MIN || note.length > LIMITS.NOTE_MAX)) {
        add(
          `deliverable:${i}:note`,
          "promise",
          `Say what this is, in ${LIMITS.NOTE_MIN} to ${LIMITS.NOTE_MAX} characters. "Something custom" is not a promise anybody can check.`,
        );
      }
      if (note.length > LIMITS.NOTE_MAX) {
        add(`deliverable:${i}:note`, "promise", `Keep this under ${LIMITS.NOTE_MAX} characters.`);
      }
    });
  }

  if (production && draft.fallback !== "creator_refund" && draft.fallback !== "next_event") {
    add(
      "fallback",
      "promise",
      "Without the event there is nothing to film, so the answer has to be a refund from you or the same spot at your next event.",
    );
  }
  if (session && draft.fallback !== "creator_refund" && draft.fallback !== "next_event") {
    add(
      "fallback",
      "promise",
      "Time in person leaves nothing behind if it does not happen, so the answer has to be a refund from you or the same session at your next event.",
    );
  }
  if (draft.fallback === "next_event" && draft.fallbackNote.trim().length < 5) {
    add("fallbackNote", "promise", "Name the event you would carry sponsors to, and when it is. Otherwise it promises nothing.");
  }
  if (draft.fallbackNote.trim().length > LIMITS.REASON_MAX) {
    add("fallbackNote", "promise", `Keep this under ${LIMITS.REASON_MAX} characters.`);
  }

  if (isCustomServiceTemplate(template)) {
    const name = draft.serviceName.trim();
    const summary = draft.serviceSummary.trim();
    if (name.length < LIMITS.SERVICE_NAME_MIN || name.length > LIMITS.SERVICE_NAME_MAX) {
      add("serviceName", "promise", `Name what you are selling, in ${LIMITS.SERVICE_NAME_MIN} to ${LIMITS.SERVICE_NAME_MAX} characters.`);
    }
    if (summary.length < LIMITS.SERVICE_SUMMARY_MIN || summary.length > LIMITS.SERVICE_SUMMARY_MAX) {
      add(
        "serviceSummary",
        "promise",
        `Say what a brand gets, in ${LIMITS.SERVICE_SUMMARY_MIN} to ${LIMITS.SERVICE_SUMMARY_MAX} characters. This is not in our catalogue, so your words are the only description there is.`,
      );
    }
  }

  if (draft.brandGets) {
    if (draft.brandGets.length > BRAND_GETS_LIMITS.MAX_LINES) {
      add("brandGets", "promise", `${BRAND_GETS_LIMITS.MAX_LINES} lines is the most the list can carry.`);
    }
    draft.brandGets.forEach((l, i) => {
      if (l.kind !== "text") return;
      const text = l.text.trim();
      if (text && (text.length < BRAND_GETS_LIMITS.TEXT_MIN || text.length > BRAND_GETS_LIMITS.TEXT_MAX)) {
        add(`brandGets:${i}`, "promise", `${BRAND_GETS_LIMITS.TEXT_MIN} to ${BRAND_GETS_LIMITS.TEXT_MAX} characters.`);
      }
    });
  }

  const required = requiredAttestations(template.requiredAttestations, draft.venueType, template.kind, session, production);
  if (required.some((a) => !draft.attestations.includes(a))) {
    add("attestations", "publish", "Tick every line below. Each one is something you are telling sponsors is true.");
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
    add("ladder", "sell", "Add at least one thing to sell.");
    return;
  }
  if (draft.rungs.length > LIMITS.MAX_TIERS) {
    add("ladder", "sell", `${LIMITS.MAX_TIERS} is the most a ladder can hold. More than that is a pricing page, and a pricing page is what a sponsor leaves.`);
  }
  const copies = draft.rungs.reduce((sum, r) => sum + (Number.isInteger(r.available) ? Math.max(0, r.available) : 0), 0);
  if (copies < 1 || copies > maxSlots) {
    add("ladder", "sell", `Everything on the ladder together comes to ${copies}. This product sells between 1 and ${maxSlots} at once.`);
  }

  for (const rung of draft.rungs) {
    const where = `rung:${rung.key}`;
    const mode = saleModeOf(draft, rung.saleMode);
    const named = rung.title.trim() || "this one";

    const title = rung.title.trim();
    if (!title) {
      add(`${where}:title`, "sell", "Name it. This is the line a brand reads before the price.");
    } else if (title.length > LIMITS.TIER_TITLE_MAX) {
      add(`${where}:title`, "sell", `${LIMITS.TIER_TITLE_MAX} characters is the most a name can be.`);
    }

    const perks = rung.perks.map((p) => p.trim()).filter(Boolean);
    if (perks.length === 0) {
      add(`${where}:perks`, "sell", "Say what the brand gets for this, one plain line at a time. A price with nothing under it does not sell.");
    }
    if (perks.length > LIMITS.TIER_PERKS_MAX) {
      add(`${where}:perks`, "sell", `${LIMITS.TIER_PERKS_MAX} lines is the most one rung shows.`);
    }
    if (perks.some((p) => p.length > LIMITS.TIER_PERK_MAX)) {
      add(`${where}:perks`, "sell", `Each line is at most ${LIMITS.TIER_PERK_MAX} characters.`);
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
      add(`${where}:available`, "sell", `Between 1 and ${maxSlots} of these.`);
    } else if (mode === "bids" && rung.available !== 1) {
      add(
        `${where}:available`,
        "sell",
        `${named} is sold to the highest bid, and bidding is one thing going to one winner. Five identical copies under one countdown are five auctions of the same thing: the brands spread across them and every one of the five ends under what a single one would have fetched. Set it to 1, or sell it another way.`,
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
      add(`${where}:pitch`, "sell", `Keep this under ${LIMITS.PITCH_MAX} characters.`);
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

  if (price === "bad") add(where, "sell", "Write the price as an amount in dollars, like 1300.");
  if (floor === "bad") add(floorWhere, "sell", "Write this as an amount in dollars, like 900.");

  if (!modeShowsPrice(mode)) {
    // Nothing to check: the price box is not shown, and anything typed into it
    // before the mode changed is dropped by `bodyOf`.
  } else if (price === null) {
    add(where, "sell", mode === "bids" ? `Say where bidding opens for ${what}.` : `Give ${what} a price.`);
  } else if (typeof price === "number") {
    const min = mode === "bids" ? offerFloor : session ? LIMITS.SESSION_MIN_CENTS : LIMITS.PRICE_MIN_CENTS;
    if (price < min || price > LIMITS.PRICE_MAX_CENTS) {
      add(where, "sell", `A price runs from ${usd(min)} to ${usd(LIMITS.PRICE_MAX_CENTS)}.`);
    }
  }

  if (!modeKeepsFloor(mode) || typeof floor !== "number") return;
  if (floor < offerFloor || floor > LIMITS.PRICE_MAX_CENTS) {
    add(floorWhere, "sell", `Your floor runs from ${usd(offerFloor)} to ${usd(LIMITS.PRICE_MAX_CENTS)}. Nobody can offer less than ${usd(offerFloor)} anyway.`);
    return;
  }
  if (typeof price !== "number") return;
  if (mode === "bids" && floor < price) {
    add(floorWhere, "sell", `Your reserve is under the opening bid, so it would never stop anything. Set it above ${usd(price)}, or leave it empty.`);
  }
  if (mode === "fixed_with_offers" && floor >= price) {
    add(floorWhere, "sell", `Your floor is at or above the price, so an offer could never beat buying it. Set it under ${usd(price)}, or leave it empty.`);
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

/**
 * The server's refusals, in the creator's words, next to the field they are about.
 *
 * WHY NOT JUST PRINT THE CODE
 *
 * `bid_tier_sells_one` means something to whoever wrote the rule and nothing
 * at all to a creator who has just spent an evening on a ladder. Worse, a
 * screen full of codes reads like a crash, and a creator who thinks they broke
 * something stops rather than fixes it. So every code we can meet has a
 * sentence, and every sentence says what to do next.
 *
 * WHERE A REFUSAL LANDS
 *
 * The API answers in three shapes, and the difference matters:
 *   - `invalid_positions` (422) with `details.problems`, each carrying a
 *     `zoneKey` and, on a ladder, a `tierKey`: the spot it is about;
 *   - `policy_problems` (422) with `details.problems`, some carrying an
 *     `index` into the deliverables or the name of a missing declaration;
 *   - a bare code, which is most of the rest — `bid_tier_sells_one`,
 *     `bidding_end_invalid`, `x_not_verified`. These carry no details at all,
 *     so where they belong is decided here.
 * `where` is the field key the wizard renders them under, the same keys
 * ./rules produces, so a server refusal and our own mirror of it land in
 * exactly the same place on screen.
 */

import { CreatorApiError } from "./api";
import { usd, LIMITS, type ListingDraft, type Template } from "./listing";
import type { Problem, Step } from "./rules";

export interface Refusal {
  /** Sentences that belong beside a field. */
  problems: Problem[];
  /** A sentence about the whole thing, when no single field owns it. */
  message: string | null;
  /** Where in the console this is fixed, when it is fixed somewhere else. */
  fix: { href: string; label: string } | null;
}

const ACCOUNT_FIX = { href: "/creator", label: "Go to your account" };

/**
 * A `zoneKey` (and on a ladder a `tierKey`) as a field on this form.
 *
 * A ladder's rungs are the rows on screen and its slots are not, so a problem
 * carrying a `tierKey` goes to the rung; everything else goes to the zone it
 * names, and a service selling identical slots has one price box for all of
 * them.
 */
function fieldFor(draft: ListingDraft | null, zoneKey: string | undefined, tierKey: string | undefined, part: string): string {
  if (tierKey) return `rung:${tierKey}:${part}`;
  if (draft?.sells === "slots") return part === "price" ? "slotPrice" : "slots";
  return zoneKey ? `zone:${zoneKey}:${part}` : "ladder";
}

/** A refusal carrying a list of problems, each turned into a sentence. */
function detailedProblems(
  list: readonly Record<string, unknown>[],
  draft: ListingDraft | null,
  template: Template | null,
): Problem[] {
  const out: Problem[] = [];
  const at = (where: string, step: Step, message: string) => out.push({ where, step, message });

  for (const p of list) {
    const code = String(p.code ?? "");
    const zoneKey = typeof p.zoneKey === "string" ? p.zoneKey : undefined;
    const tierKey = typeof p.tierKey === "string" ? p.tierKey : undefined;
    const index = typeof p.index === "number" ? p.index : undefined;
    const max = typeof p.max === "number" ? p.max : undefined;
    const field = (part: string) => fieldFor(draft, zoneKey, tierKey, part);

    switch (code) {
      /* what is for sale */
      case "no_positions":
        at("ladder", "sell", "There is nothing on this listing to sell yet.");
        break;
      case "too_many_tiers":
        at("ladder", "sell", `${max ?? LIMITS.MAX_TIERS} is the most a ladder can hold.`);
        break;
      case "slots_out_of_range":
        at("ladder", "sell", `Everything on the ladder together has to come to between 1 and ${max ?? "the product's limit"}.`);
        break;
      case "too_many_positions":
        at("zones", "sell", `${max ?? LIMITS.MAX_POSITIONS} spots is the most one listing can carry.`);
        break;
      case "tier_quantity_invalid":
        at(field("available"), "sell", "That is not a number of copies this can be sold in.");
        break;
      case "tier_title_invalid":
        at(field("title"), "sell", `Name it, in at most ${LIMITS.TIER_TITLE_MAX} characters.`);
        break;
      case "tier_perks_invalid":
        at(
          field("perks"),
          "sell",
          `Say what the brand gets: up to ${LIMITS.TIER_PERKS_MAX} plain lines of at most ${LIMITS.TIER_PERK_MAX} characters each.`,
        );
        break;
      case "unknown_zone":
        at("zones", "sell", "One of these spots is not one this product has. Start the listing again.");
        break;
      case "duplicate_zone":
        at("zones", "sell", "The same spot is listed twice.");
        break;
      case "price_out_of_range":
        at(field("price"), "sell", `A price runs from ${usd(LIMITS.PRICE_MIN_CENTS)} to ${usd(LIMITS.PRICE_MAX_CENTS)}.`);
        break;
      case "no_content_kind":
        at(field("accepts"), "sell", "Say what a sponsor may put here.");
        break;
      case "unknown_content_kind":
        at(field("accepts"), "sell", "That is not something a sponsor can put on a spot.");
        break;

      /* what you promise */
      case "venue_not_allowed_for_product":
        at("venueType", "basics", "This product cannot be sold for that kind of occasion.");
        break;
      case "event_name_required":
        at("event", "basics", "Name the event. A sponsor buying a spot at a conference is buying that conference.");
        break;
      case "no_deliverables":
        at("deliverables", "publish", "Promise at least one thing a venue cannot take away.");
        break;
      case "no_content_deliverable":
        at("deliverables", "publish", "At least one promise has to be something you post, not only being there in person.");
        break;
      case "too_many_deliverables":
        at("deliverables", "publish", `${max ?? LIMITS.DELIVERABLES_MAX} promises is the most one listing can carry.`);
        break;
      case "unknown_deliverable_kind":
        at(`deliverable:${index}:kind`, "publish", "That is not something a listing can promise.");
        break;
      case "unknown_platform":
        at(`deliverable:${index}:platform`, "publish", "That is not a platform we know.");
        break;
      case "deliverable_count_out_of_range":
        at(`deliverable:${index}:count`, "publish", `Between 1 and ${LIMITS.DELIVERABLE_COUNT_MAX} of them.`);
        break;
      case "deliverable_date_out_of_range":
        at(
          `deliverable:${index}:dueDate`,
          "publish",
          `Pick a day between today and ${LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE} days after the listing closes.`,
        );
        break;
      case "deliverable_note_required":
        at(
          `deliverable:${index}:note`,
          "publish",
          `Say what this is, in ${LIMITS.NOTE_MIN} to ${LIMITS.NOTE_MAX} characters.`,
        );
        break;
      case "deliver_by_required":
        at("deliverBy", "publish", "Say the day every sponsor has their work by.");
        break;
      case "deliver_by_out_of_range":
        at(
          "deliverBy",
          "publish",
          `Pick a day between today and ${LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE} days after the listing closes.`,
        );
        break;
      case "funding_goal_out_of_range":
        at("goal", "basics", `A goal runs from ${usd(LIMITS.GOAL_MIN_CENTS)} to ${usd(LIMITS.GOAL_MAX_CENTS)}.`);
        break;
      case "service_name_required":
        at("serviceName", "publish", `Name what you are selling, in ${LIMITS.SERVICE_NAME_MIN} to ${LIMITS.SERVICE_NAME_MAX} characters.`);
        break;
      case "service_summary_required":
        at(
          "serviceSummary",
          "publish",
          `Say what a brand gets, in ${LIMITS.SERVICE_SUMMARY_MIN} to ${LIMITS.SERVICE_SUMMARY_MAX} characters.`,
        );
        break;
      case "text_not_allowed": {
        const field2 =
          p.field === "serviceName" ? "serviceName" : p.field === "serviceSummary" ? "serviceSummary" : `deliverable:${index}:note`;
        at(
          field2,
          "publish",
          "Those words are ones HiSpace does not carry: no investment advice, no introductions to investors, no token deals. Say what you make and post instead.",
        );
        break;
      }
      case "unknown_fallback":
        at("fallback", "publish", "Pick one of the three answers.");
        break;
      case "fallback_needs_details":
        at("fallbackNote", "publish", "Name the event you would carry sponsors to, and when it is.");
        break;
      case "missing_attestation":
        at("attestations", "publish", "Tick every line. Each one is something you are telling sponsors is true.");
        break;

      default:
        at("form", "sell", "Something in this listing is not one we can publish. Check the prices and the dates.");
    }
  }
  // The publish gate reports one missing declaration per line; one sentence is
  // enough, and nine copies of it is not an error message, it is a wall.
  return out.filter((p, i) => out.findIndex((q) => q.where === p.where && q.message === p.message) === i);
}

/**
 * The bare codes, which carry no details: the field each belongs to is decided
 * here because the server has no way to say it.
 */
function bareProblem(code: string, draft: ListingDraft | null): Problem | null {
  const sell = (where: string, message: string): Problem => ({ where, step: "sell", message });
  switch (code) {
    case "offers_only_on_fixed":
      return sell("pricing", "Sponsors can only be allowed to offer less on a listing that has a fixed price.");
    case "bids_need_placement":
      return sell(
        "pricing",
        "Identical slots cannot all go to one highest bid. Build a ladder and put one rung out to bids instead.",
      );
    case "bid_tier_sells_one":
      return sell(
        "ladder",
        "A rung sold to the highest bid sells exactly one thing. Set the one you are bidding out to a single copy, or sell it another way.",
      );
    case "bidding_end_invalid":
      return sell(
        "biddingEndsAt",
        `Bidding has to stop at least ${LIMITS.BIDDING_MIN_AFTER_PUBLISH_HOURS} hours after the listing goes live and at least ${LIMITS.BIDDING_MIN_BEFORE_CLOSE_HOURS} hours before it closes.`,
      );
    case "reserve_below_opening_bid":
      return sell("ladder", "A reserve under the opening bid would never stop anything. Put it above the opening bid, or take it off.");
    case "minimum_not_below_price":
      return sell("ladder", "A floor at or above the price means an offer could never beat buying it. Put it under the price, or take it off.");
    case "offer_price_invalid":
      return sell("ladder", "One of these prices does not fit the way it is being sold. Check the price and the floor on each one.");
    case "chains_required":
      return sell("chains", "Pick at least one network a sponsor can pay you on.");
    case "takeover_needs_a_takeover_chain":
      return sell(
        "chains",
        "Taking a spot over repays the displaced sponsor inside the same payment, and only Solana carries that. Accept Solana, or sell another way.",
      );
    case "closes_too_soon":
      return { where: "closesAt", step: "basics", message: `A listing runs for at least ${LIMITS.MIN_CAMPAIGN_HOURS} hours.` };
    case "closes_too_late":
      return { where: "closesAt", step: "basics", message: `A listing runs for at most ${LIMITS.MAX_CAMPAIGN_DAYS} days.` };
    case "room_needs_an_event":
      return { where: "event", step: "basics", message: "Time in person is always sold at an event. Pick one from the list." };
    case "fallback_not_for_sessions":
      return {
        where: "fallback",
        step: "publish",
        message: "Time in person leaves nothing behind if it does not happen, so the answer has to be a refund from you or the same session at your next event.",
      };
    case "takeover_not_for_sessions":
      return sell("pricing", "A booking a stranger can take off you by paying double is not a booking.");
    case "price_below_minimum":
      return sell(draft?.sells === "ladder" ? "ladder" : "slotPrice", `Time in person starts at ${usd(LIMITS.SESSION_MIN_CENTS)} a slot.`);
    case "session_closes_after_event":
      return {
        where: "closesAt",
        step: "basics",
        message: "This closes after the event is over, and a slot sold then is time that no longer exists. Close it by the day after the event ends.",
      };
    case "no_positions":
      return sell("ladder", "There is nothing on this listing to sell yet.");
    default:
      return null;
  }
}

/**
 * A publish refusal that is not about the listing at all, but about the
 * account behind it: the X handle it would be published under, and the address
 * it would be paid to. Each says where it is fixed, because it is not here.
 */
function accountRefusal(code: string): Refusal | null {
  const fixed = (message: string): Refusal => ({ problems: [], message, fix: ACCOUNT_FIX });
  switch (code) {
    case "x_not_linked":
      return fixed(
        "A listing is published under your X account, and there is no X account on this HOLD account yet. Connect one and come back — nothing here is lost.",
      );
    case "x_not_verified":
      return fixed(
        "A listing is published under a verified X account, and X shows no check mark on yours that we can see. X Premium, business and government all count.",
      );
    case "x_account_too_new":
      return fixed(
        "A listing is published under an X account at least 90 days old, and we cannot see that age on yours. A check mark is a subscription anybody can buy in an afternoon; three months of history is not.",
      );
    case "x_relink_needed":
      return fixed(
        "It has been a while since X last confirmed your account for us, and we will not publish on a copy we cannot check. Connect X again and it is settled.",
      );
    case "no_solana_address":
      return fixed("This listing takes Solana and there is no Solana address on your account to pay it to.");
    case "no_evm_address":
      return fixed("This listing takes Base or Polygon and there is no address on your account to pay it to.");
    case "creator_cannot_receive_usdc":
      return {
        problems: [],
        message:
          "Your Solana wallet has no USDC account yet, so a sponsor paying from the HOLD app could pay and never reach you — our relayer is never allowed to open somebody else's token account. Two things fix it: publish on Base and Polygon instead, or have any amount of USDC sent to you on Solana once, which opens it for good.",
        fix: ACCOUNT_FIX,
      };
    default:
      return null;
  }
}

/** A refusal the console can do nothing about, said without pretending otherwise. */
const PLAIN: Record<string, string> = {
  not_a_draft: "This listing is already live, so it cannot be changed here any more.",
  not_found: "We cannot find this listing. It may have been deleted.",
  unknown_template: "That product is no longer in our catalogue. Start the listing again on another one.",
  service_offer_required: "Something went wrong building this listing. Start it again.",
  zones_required: "Something went wrong building this listing. Start it again.",
  slug_exhausted: "You already have a lot of listings by this name. Give this one a different one.",
  address_not_yours: "That is not an address on your account.",
  chain_unavailable: "We could not read Solana just now, so we will not say yes or no about your wallet. Try again in a minute.",
  chain_not_available: "One of the networks this listing accepts is not taking payments right now. Take it off, or try again later.",
  fee_address_not_configured: "This is ours, not yours: HiSpace is not set up to take a payment on one of these networks. Tell us and we will fix it.",
  country_invalid: "Use the two-letter country code, like SG.",
  event_unavailable: "That event is not one HiSpace carries listings for any more. Pick another one.",
  event_name_invalid: "Give the event a name.",
  time_zone_invalid: "We do not know that time zone.",
  space_not_live: "This listing is not live, so there is nothing to post about yet.",
  update_empty: "Write something, or add nothing at all.",
  image_not_yours: "That image is not one you uploaded.",
  not_live: "This listing is not live yet, so it has no page to share.",
};

/**
 * A refusal on a listing that is already live, as one sentence.
 *
 * Running a listing has no form to hang a problem on: there is a button, and
 * what comes back is either done or a reason. Every one of these is a race the
 * creator did not lose through carelessness — a sponsor who withdrew while the
 * page sat open, a bid that was outbid a second ago, a spot somebody else
 * bought — so each says what happened rather than what they did wrong.
 */
export function describeRunError(e: unknown): string {
  if (!(e instanceof CreatorApiError)) return "Something went wrong. Try again.";
  switch (e.code) {
    case "network":
      return "We could not reach HOLD. Check your connection and try again.";
    case "UNAUTHORIZED":
    case "ACCOUNT_DELETED":
      return "Your sign-in has expired. Sign in again and pick up where you left off.";
    case "rate_limited":
    case "RATE_LIMIT_EXCEEDED":
      return "That is more than we allow in a minute. Wait a moment and try again.";
    case "offer_changed":
      return "This moved while you were reading it — they raised it, withdrew it, or the clock ran out. Refresh and look again before you answer.";
    case "offer_not_open":
      return "This one is already settled, so there is nothing left to answer.";
    case "offer_expired":
      return "The time on this one ran out. Nothing was agreed and nothing is owed.";
    case "not_for_bids":
      return "There is no countering a bid. Bidding is one number going up against a clock; you can take the highest or leave it.";
    case "too_many_rounds":
      return "Three counters is as far as one negotiation goes. Take it, or pass.";
    case "counter_not_above_offer":
      return "A counter has to be more than they offered. Anything less is just saying yes for less.";
    case "counter_above_price":
      return "Your counter is above the price on the page, and buying it outright has to stay the better deal. Ask for less than the listed price.";
    case "offer_too_low":
      return "That is under the least anyone can be asked for on HiSpace, which is $25.";
    case "offer_too_high":
      return "That is more than a HiSpace spot can cost.";
    case "space_closed":
      return "This listing has closed, so nothing more can be agreed on it.";
    case "too_close_to_closing":
      return "There is not enough time left before this closes for a sponsor to pay. Nothing can be accepted this late.";
    case "position_sold":
      return "Somebody bought that spot while you were reading this.";
    case "position_reserved":
      return "That spot is already held for another accepted offer. It comes back if they do not pay.";
    case "position_held":
      return "Somebody is paying for that spot right now. If it lapses, it comes back.";
    case "nothing_to_review":
      return "There is nothing waiting on this one — you have already answered it, or the sponsor took it back.";
    case "reason_required":
      return "Say why, in a line. The sponsor gets it and sends something else; without it they are guessing.";
    case "content_changed":
      return "The sponsor swapped in something different since you looked. Refresh and read the new one before you answer.";
    case "position_not_sold":
    case "order_not_paid":
      return "Nobody has paid for this yet, so there is nothing to deliver.";
    case "not_for_sessions":
      return "Time in person is confirmed by the person who booked it, not by a link — there is nothing for you to mark here.";
    case "offers_not_accepted":
      return "This one does not take offers, so a floor would never be read.";
    case "offer_price_invalid":
    case "minimum_not_below_price":
    case "reserve_below_opening_bid":
      return "A floor has to sit under the price on a listing that has one, and above the opening bid on one that is bid for. It is never the price itself.";
    case "offer_target_invalid":
      return "That floor belongs on the other one: a listing selling identical slots keeps one floor for all of them, and everything else keeps its own.";
    case "not_live":
      return "This listing is not live yet, so it has no page to share.";
    case "space_not_live":
      return "This listing is not live, so there is nothing to post about yet.";
    case "update_empty":
      return "Write something first.";
    case "min_offer_invalid":
      return "A floor runs from $25 up to the price, and never above it.";
    case "not_found":
      return "We cannot find that any more.";
    default:
      return "Something went wrong. Try again.";
  }
}

/**
 * A refusal about one whole listing, as a single sentence.
 *
 * The wizard can put a refusal beside the box it is about because the boxes are
 * on screen. A row in a list of listings has no boxes: it is one line saying
 * what happened to that listing. So the same machinery runs and its sentences
 * are joined, rather than a second, thinner set of words being written for the
 * same codes.
 */
export function refusalSentence(e: unknown, template: Template | null): string {
  const refusal = refusalOf(e, template, null);
  if (refusal.problems.length > 0) return refusal.problems.map((p) => p.message).join(" ");
  return refusal.message ?? describeRunError(e);
}

/**
 * Taking a listing to more events, refused.
 *
 * Five of these belong to the series itself. Everything else is a copy being
 * refused by the same rules that made the original — a close date out of range,
 * a price that no longer fits — so the rest falls through to `refusalSentence`
 * rather than being written out again here.
 */
export function describeSeriesError(e: unknown, template: Template | null): string {
  if (e instanceof CreatorApiError) {
    switch (e.code) {
      case "series_events_required":
        return "Pick at least one event first.";
      case "series_event_repeated":
        return "One of those is an event this listing already has a page at. Two pages at the same event only compete with each other, so take that one off the list and send the rest.";
      case "series_too_large": {
        const max = typeof e.details.max === "number" ? e.details.max : LIMITS.SERIES_MAX;
        return `${max} events is as far as one listing goes, counting the one it is at now. Take some off the list.`;
      }
      case "event_unavailable":
        return "One of those events is not taking listings any more. Take it off the list and send the rest.";
      case "space_delisted":
        return "This listing has been taken down, so there is nothing to copy from it.";
      case "zones_required":
        return "There is nothing on this listing to sell yet, so there would be nothing on the copies either. Finish it first.";
      case "VALIDATION_ERROR":
      case "validation_error":
        return `Check the list: every event needs a day it stops selling, and one go adds at most ${LIMITS.SERIES_MAX - 1} of them.`;
      default:
        break;
    }
  }
  return refusalSentence(e, template);
}

/**
 * Everything a refusal means, ready to render.
 *
 * `draft` is only used to decide which box a spot-level problem sits in, so a
 * refusal on a listing the form is not holding still comes back readable.
 */
export function refusalOf(e: unknown, template: Template | null, draft: ListingDraft | null): Refusal {
  if (!(e instanceof CreatorApiError)) {
    return { problems: [], message: "Something went wrong. Try again.", fix: null };
  }

  if (e.code === "network") {
    return {
      problems: [],
      message: "We could not reach HOLD. Check your connection and try again.",
      fix: null,
    };
  }
  if (e.code === "UNAUTHORIZED" || e.code === "ACCOUNT_DELETED") {
    return { problems: [], message: "Your sign-in has expired. Sign in again and pick up where you left off.", fix: ACCOUNT_FIX };
  }
  if (e.code === "rate_limited" || e.code === "RATE_LIMIT_EXCEEDED") {
    return { problems: [], message: "That is more saves than we allow in a minute. Wait a moment and try again.", fix: null };
  }

  if (e.code === "invalid_positions" || e.code === "policy_problems") {
    const list = Array.isArray(e.details.problems) ? (e.details.problems as Record<string, unknown>[]) : [];
    const problems = detailedProblems(list, draft, template);
    return {
      problems,
      message: problems.length ? null : "Something in this listing is not one we can publish.",
      fix: null,
    };
  }

  const account = accountRefusal(e.code);
  if (account) return account;

  const bare = bareProblem(e.code, draft);
  if (bare) return { problems: [bare], message: null, fix: null };

  return { problems: [], message: PLAIN[e.code] ?? "Something went wrong. Try again.", fix: null };
}

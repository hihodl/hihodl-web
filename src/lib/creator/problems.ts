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

import { t, type MessageKey } from "@/lib/app/i18n";
import { clientProductBase } from "@/lib/app/paths";

import { CreatorApiError } from "./api";
import { usd, LIMITS, type ListingDraft, type Template } from "./listing";
import type { Problem, Step } from "./rules";
import { TEAM_LIMITS } from "./team";

export interface Refusal {
  /** Sentences that belong beside a field. */
  problems: Problem[];
  /** A sentence about the whole thing, when no single field owns it. */
  message: string | null;
  /** Where in the console this is fixed, when it is fixed somewhere else. */
  fix: { href: string; label: string } | null;
}

/**
 * Built when a refusal is read, in the browser, so it points at this host's
 * product. Account is the person's (/account), opened on the card that fixes it.
 */
function accountFix(view?: "x" | "payout"): { href: string; label: string } {
  return { href: `${clientProductBase()}/account${view ? `?view=${view}` : ""}`, label: t("listings.problems.openAccount") };
}

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
        at("ladder", "sell", t("listings.problems.noPositions"));
        break;
      case "too_many_tiers":
        at("ladder", "sell", t("listings.problems.tooManyTiers", { max: max ?? LIMITS.MAX_TIERS }));
        break;
      case "slots_out_of_range":
        at("ladder", "sell", t("listings.problems.slotsOutOfRange", { max: max ?? t("listings.problems.productLimit") }));
        break;
      case "too_many_positions":
        at("zones", "sell", t("listings.problems.tooManyPositions", { max: max ?? LIMITS.MAX_POSITIONS }));
        break;
      case "tier_quantity_invalid":
        at(field("available"), "sell", t("listings.problems.tierQuantityInvalid"));
        break;
      case "tier_title_invalid":
        at(field("title"), "sell", t("listings.problems.tierTitleInvalid", { max: LIMITS.TIER_TITLE_MAX }));
        break;
      case "tier_perks_invalid":
        at(
          field("perks"),
          "sell",
          t("listings.problems.tierPerksInvalid", { lines: LIMITS.TIER_PERKS_MAX, chars: LIMITS.TIER_PERK_MAX }),
        );
        break;
      case "unknown_zone":
        at("zones", "sell", t("listings.problems.unknownZone"));
        break;
      case "duplicate_zone":
        at("zones", "sell", t("listings.problems.duplicateZone"));
        break;
      case "price_out_of_range":
        at(field("price"), "sell", t("listings.problems.priceOutOfRange", { min: usd(LIMITS.PRICE_MIN_CENTS), max: usd(LIMITS.PRICE_MAX_CENTS) }));
        break;
      case "no_content_kind":
        at(field("accepts"), "sell", t("listings.problems.noContentKind"));
        break;
      case "unknown_content_kind":
        at(field("accepts"), "sell", t("listings.problems.unknownContentKind"));
        break;

      /* what you promise */
      case "venue_not_allowed_for_product":
        at("venueType", "event", t("listings.problems.venueNotAllowed"));
        break;
      case "event_name_required":
        at("event", "event", t("listings.problems.eventNameRequired"));
        break;
      case "no_deliverables":
        at("deliverables", "promise", t("listings.problems.noDeliverables"));
        break;
      case "no_content_deliverable":
        at("deliverables", "promise", t("listings.problems.noContentDeliverable"));
        break;
      case "too_many_deliverables":
        at("deliverables", "promise", t("listings.problems.tooManyDeliverables", { max: max ?? LIMITS.DELIVERABLES_MAX }));
        break;
      case "unknown_deliverable_kind":
        at(`deliverable:${index}:kind`, "promise", t("listings.problems.unknownDeliverableKind"));
        break;
      case "unknown_platform":
        at(`deliverable:${index}:platform`, "promise", t("listings.problems.unknownPlatform"));
        break;
      case "deliverable_count_out_of_range":
        at(`deliverable:${index}:count`, "promise", t("listings.problems.deliverableCount", { max: LIMITS.DELIVERABLE_COUNT_MAX }));
        break;
      case "deliverable_date_out_of_range":
        at(
          `deliverable:${index}:dueDate`,
          "promise",
          t("listings.problems.dayInRange", { days: LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE }),
        );
        break;
      case "deliverable_note_required":
        at(
          `deliverable:${index}:note`,
          "promise",
          t("listings.problems.noteLength", { min: LIMITS.NOTE_MIN, max: LIMITS.NOTE_MAX }),
        );
        break;
      case "deliver_by_required":
        at("deliverBy", "promise", t("listings.problems.deliverByRequired"));
        break;
      case "deliver_by_out_of_range":
        at(
          "deliverBy",
          "promise",
          t("listings.problems.dayInRange", { days: LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE }),
        );
        break;
      case "funding_goal_out_of_range":
        at("goal", "name", t("listings.problems.goalOutOfRange", { min: usd(LIMITS.GOAL_MIN_CENTS), max: usd(LIMITS.GOAL_MAX_CENTS) }));
        break;
      case "service_name_required":
        at("serviceName", "promise", t("listings.problems.serviceNameLength", { min: LIMITS.SERVICE_NAME_MIN, max: LIMITS.SERVICE_NAME_MAX }));
        break;
      case "service_summary_required":
        at(
          "serviceSummary",
          "promise",
          t("listings.problems.serviceSummaryLength", { min: LIMITS.SERVICE_SUMMARY_MIN, max: LIMITS.SERVICE_SUMMARY_MAX }),
        );
        break;
      case "brand_gets_too_many":
      case "brand_gets_invalid":
        at("brandGets", "promise", t("listings.problems.brandGetsLines", { max: 8 }));
        break;
      case "brand_gets_line_invalid":
      case "brand_gets_line_length":
        at(`brandGets:${index}`, "promise", t("listings.problems.charsRange", { min: 3, max: 120 }));
        break;
      case "text_not_allowed": {
        const field2 =
          p.field === "serviceName"
            ? "serviceName"
            : p.field === "serviceSummary"
              ? "serviceSummary"
              : p.field === "brandGets"
                ? `brandGets:${index}`
                : `deliverable:${index}:note`;
        at(
          field2,
          "promise",
          t("listings.problems.textNotAllowed"),
        );
        break;
      }
      case "unknown_fallback":
        at("fallback", "promise", t("listings.problems.unknownFallback"));
        break;
      case "fallback_needs_details":
        at("fallbackNote", "promise", t("listings.problems.fallbackNeedsDetails"));
        break;
      case "missing_attestation":
        at("attestations", "publish", t("listings.problems.missingAttestation"));
        break;

      default:
        at("form", "sell", t("listings.problems.cannotPublishCheck"));
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
      return sell("pricing", t("listings.problems.offersOnlyOnFixed"));
    case "bids_need_placement":
      return sell(
        "pricing",
        t("listings.problems.bidsNeedPlacement"),
      );
    case "bid_tier_sells_one":
      return sell(
        "ladder",
        t("listings.problems.bidTierSellsOne"),
      );
    case "bidding_end_invalid":
      return sell(
        "biddingEndsAt",
        t("listings.problems.biddingEndInvalid", { after: LIMITS.BIDDING_MIN_AFTER_PUBLISH_HOURS, before: LIMITS.BIDDING_MIN_BEFORE_CLOSE_HOURS }),
      );
    case "reserve_below_opening_bid":
      return sell("ladder", t("listings.problems.reserveBelowOpeningBid"));
    case "minimum_not_below_price":
      return sell("ladder", t("listings.problems.minimumNotBelowPrice"));
    case "offer_price_invalid":
      return sell("ladder", t("listings.problems.offerPriceInvalid"));
    case "chains_required":
      return sell("chains", t("listings.problems.chainsRequired"));
    case "takeover_needs_a_takeover_chain":
      return sell(
        "chains",
        t("listings.problems.takeoverNeedsSolana"),
      );
    case "inspired_by_invalid":
    case "inspired_by_handle_invalid":
      return { where: "inspiredBy", step: "name", message: t("listings.problems.inspiredByInvalid") };
    case "inspired_by_not_found":
      return { where: "inspiredBy", step: "name", message: t("listings.problems.inspiredByNotFound") };
    case "inspired_by_self":
      return { where: "inspiredBy", step: "name", message: t("listings.problems.inspiredBySelf") };
    case "closes_too_soon":
      return { where: "closesAt", step: "dates", message: t("listings.problems.closesTooSoon", { hours: LIMITS.MIN_CAMPAIGN_HOURS }) };
    case "closes_too_late":
      return { where: "closesAt", step: "dates", message: t("listings.problems.closesTooLate", { days: LIMITS.MAX_CAMPAIGN_DAYS }) };
    case "production_needs_an_event":
      return { where: "event", step: "event", message: t("listings.problems.productionNeedsEvent") };
    case "production_package_invalid":
    case "production_package_empty":
      return {
        where: "production:deliverables",
        step: "includes",
        message: t("listings.problems.productionPackageInvalid"),
      };
    case "production_sells_at_a_price":
      return { where: "pricing", step: "sell", message: t("listings.problems.productionSellsAtPrice") };
    case "fallback_not_for_production":
      return {
        where: "fallback",
        step: "promise",
        message: t("listings.problems.fallbackNotForProduction"),
      };
    case "production_closes_after_event":
      return {
        where: "closesAt",
        step: "dates",
        message: t("listings.problems.productionClosesAfterEvent"),
      };
    case "room_needs_an_event":
      return { where: "event", step: "event", message: t("listings.problems.roomNeedsEvent") };
    case "fallback_not_for_sessions":
      return {
        where: "fallback",
        step: "promise",
        message: t("listings.problems.fallbackNotForSessions"),
      };
    case "takeover_not_for_sessions":
      return sell("pricing", t("listings.problems.takeoverNotForSessions"));
    case "price_below_minimum":
      return sell(draft?.sells === "ladder" ? "ladder" : "slotPrice", t("listings.problems.priceBelowMinimum", { amount: usd(LIMITS.SESSION_MIN_CENTS) }));
    case "session_closes_after_event":
      return {
        where: "closesAt",
        step: "dates",
        message: t("listings.problems.sessionClosesAfterEvent"),
      };
    case "no_positions":
      return sell("ladder", t("listings.problems.noPositions"));
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
  const fixed = (message: string): Refusal => ({
    problems: [],
    message,
    fix: accountFix(code.startsWith("x_") ? "x" : "payout"),
  });
  switch (code) {
    case "x_not_linked":
      return fixed(
        t("listings.account.xNotLinked"),
      );
    case "x_not_verified":
      return fixed(
        t("listings.account.xNotVerified"),
      );
    case "x_account_too_new":
      return fixed(
        t("listings.account.xAccountTooNew", { days: 90 }),
      );
    case "x_relink_needed":
      return fixed(
        t("listings.account.xRelinkNeeded"),
      );
    case "no_solana_address":
      return fixed(t("listings.account.noSolanaAddress"));
    case "no_evm_address":
      // Said beside the networks, where it is fixed: the web sets up Solana only.
      return {
        problems: [
          {
            where: "chains",
            step: "sell",
            message: t("listings.account.noEvmAddress"),
          },
        ],
        message: null,
        fix: null,
      };
    case "creator_cannot_receive_usdc":
      return {
        problems: [],
        message: t("listings.account.cannotReceiveUsdc"),
        fix: accountFix("payout"),
      };
    default:
      return null;
  }
}

/** A refusal the console can do nothing about, said without pretending otherwise. */
const PLAIN: Record<string, MessageKey> = {
  not_a_draft: "listings.plain.notADraft",
  not_found: "listings.plain.notFound",
  unknown_template: "listings.plain.unknownTemplate",
  service_offer_required: "listings.plain.serviceOfferRequired",
  zones_required: "listings.plain.zonesRequired",
  slug_exhausted: "listings.plain.slugExhausted",
  address_not_yours: "listings.plain.addressNotYours",
  chain_unavailable: "listings.plain.chainUnavailable",
  chain_not_available: "listings.plain.chainNotAvailable",
  fee_address_not_configured: "listings.plain.feeAddressNotConfigured",
  country_invalid: "listings.plain.countryInvalid",
  event_unavailable: "listings.plain.eventUnavailable",
  event_name_invalid: "listings.plain.eventNameInvalid",
  time_zone_invalid: "listings.plain.timeZoneInvalid",
  space_not_live: "listings.plain.spaceNotLive",
  update_empty: "listings.plain.updateEmpty",
  image_not_yours: "listings.plain.imageNotYours",
  not_live: "listings.plain.notLive",
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
  if (!(e instanceof CreatorApiError)) return t("common.somethingWentWrong");
  switch (e.code) {
    case "network":
      return t("listings.run.network");
    case "UNAUTHORIZED":
    case "ACCOUNT_DELETED":
      return t("listings.run.unauthorized");
    case "rate_limited":
    case "RATE_LIMIT_EXCEEDED":
      return t("listings.run.rateLimited");
    case "delivery_link_invalid":
      return t("listings.run.deliveryLinkInvalid");
    case "checklist_invalid":
      return t("listings.run.checklistInvalid");
    case "already_accepted":
      return t("listings.run.alreadyAccepted");
    case "shoot_day_outside_event":
      return t("listings.run.shootDayOutsideEvent");
    case "already_delivered":
      return t("listings.run.alreadyDelivered");
    case "offer_changed":
      return t("listings.run.offerChanged");
    case "offer_not_open":
      return t("listings.run.offerNotOpen");
    case "offer_expired":
      return t("listings.run.offerExpired");
    case "not_for_bids":
      return t("listings.run.notForBids");
    case "too_many_rounds":
      return t("listings.run.tooManyRounds");
    case "counter_not_above_offer":
      return t("listings.run.counterNotAboveOffer");
    case "counter_above_price":
      return t("listings.run.counterAbovePrice");
    case "offer_too_low":
      return t("listings.run.offerTooLow");
    case "offer_too_high":
      return t("listings.run.offerTooHigh");
    case "space_closed":
      return t("listings.run.spaceClosed");
    case "too_close_to_closing":
      return t("listings.run.tooCloseToClosing");
    case "position_sold":
      return t("listings.run.positionSold");
    case "position_reserved":
      return t("listings.run.positionReserved");
    case "position_held":
      return t("listings.run.positionHeld");
    case "nothing_to_review":
      return t("listings.run.nothingToReview");
    case "reason_required":
      return t("listings.run.reasonRequired");
    case "content_changed":
      return t("listings.run.contentChanged");
    case "position_not_sold":
    case "order_not_paid":
      return t("listings.run.positionNotSold");
    case "not_for_sessions":
      return t("listings.run.notForSessions");
    case "offers_not_accepted":
      return t("listings.run.offersNotAccepted");
    case "offer_price_invalid":
    case "minimum_not_below_price":
    case "reserve_below_opening_bid":
      return t("listings.run.offerPriceInvalid");
    case "offer_target_invalid":
      return t("listings.run.offerTargetInvalid");
    case "not_live":
      return t("listings.run.notLive");
    case "space_not_live":
      return t("listings.run.spaceNotLive");
    case "update_empty":
      return t("listings.run.updateEmpty");
    case "min_offer_invalid":
      return t("listings.run.minOfferInvalid");
    case "not_found":
      return t("listings.run.notFound");
    default:
      return t("common.somethingWentWrong");
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
 * Two kinds of refusal arrive here and both are read the same way. The ones
 * about the SOURCE listing were thrown by the call — it is delisted, it has
 * nothing to sell, the list was empty or too long. The ones about ONE EVENT
 * came back inside a 2xx, in `refused[]`, while the other copies were made
 * anyway; `seriesRefusalError` turns one of those into the error this reads.
 *
 * Everything else is a copy being refused by the same rules that made the
 * original — a close date outside the window, a session closing after its own
 * event — so the rest falls through to `refusalSentence` rather than being
 * written out a second time here.
 */
export function describeSeriesError(e: unknown, template: Template | null): string {
  if (e instanceof CreatorApiError) {
    switch (e.code) {
      /* about the whole call */
      case "series_events_required":
        return t("listings.series.eventsRequired");
      case "series_too_large": {
        const max = typeof e.details.max === "number" ? e.details.max : LIMITS.SERIES_MAX;
        return t("listings.series.tooLarge", { max });
      }
      case "space_delisted":
        return t("listings.series.delisted");
      case "zones_required":
        return t("listings.series.zonesRequired");
      case "VALIDATION_ERROR":
      case "validation_error":
        return t("listings.series.validation", { max: LIMITS.SERIES_MAX - 1 });

      /* about one event, and said beside that event */
      case "series_event_repeated":
        return t("listings.series.eventRepeated");
      case "event_unavailable":
        return t("listings.series.eventUnavailable");
      default:
        break;
    }
  }
  return refusalSentence(e, template);
}

/**
 * A refusal about the team, as one sentence.
 *
 * Same shape as the series: the team's own codes are said here, and anything
 * else — a dead connection, an expired sign-in, too many tries — falls through
 * to the sentences the rest of the console already uses, rather than being
 * written a second time.
 *
 * The client-side mirror of the share rules (`shareProblem` in ./team) builds
 * the SAME error and reads it here, so a share refused before it is sent and
 * one refused by the server get the same words.
 *
 * Nothing here says HOLD sends, holds or guarantees what a member is owed,
 * because we do none of the three: the creator pays their team themselves.
 */
export function describeTeamError(e: unknown): string {
  if (e instanceof CreatorApiError) {
    switch (e.code) {
      /* inviting */
      case "team_label_required":
        return t("listings.team.labelRequired", { max: TEAM_LIMITS.LABEL_MAX });
      case "team_role_unknown":
        return t("listings.team.roleUnknown");
      case "team_too_large": {
        const max = typeof e.details.max === "number" ? e.details.max : TEAM_LIMITS.MAX_MEMBERS;
        return t("listings.team.tooLarge", { max });
      }

      /* taking a seat */
      case "invite_not_found":
        return t("listings.team.inviteNotFound");
      case "invite_expired":
        return t("listings.team.inviteExpired", { days: TEAM_LIMITS.INVITE_DAYS });
      case "invite_is_your_own":
        return t("listings.team.inviteIsYourOwn");
      case "already_on_this_team":
        return t("listings.team.alreadyOnTeam");

      /* shares */
      case "member_not_active":
        return t("listings.team.memberNotActive");
      case "share_out_of_range":
        return t("listings.team.shareOutOfRange");
      case "shares_over_a_hundred":
        return t("listings.team.sharesOverHundred");

      case "VALIDATION_ERROR":
      case "validation_error":
        return t("listings.team.validation");
      case "not_found":
        return t("listings.team.notFound");
      default:
        break;
    }
  }
  return describeRunError(e);
}

/**
 * One entry of `refused[]` as the error the rest of this file already reads.
 *
 * The server sends a code and whatever details that code carries, which is
 * exactly what a thrown refusal carries too. Rebuilding it as one means a
 * per-event refusal and a thrown one get the same sentence from the same
 * `switch`, instead of a second table of words that drifts from the first.
 */
export function seriesRefusalError(refusal: { code: string; details?: unknown }): CreatorApiError {
  const details =
    refusal.details && typeof refusal.details === "object" && !Array.isArray(refusal.details)
      ? (refusal.details as Record<string, unknown>)
      : {};
  return new CreatorApiError(refusal.code, 422, details);
}

/**
 * Everything a refusal means, ready to render.
 *
 * `draft` is only used to decide which box a spot-level problem sits in, so a
 * refusal on a listing the form is not holding still comes back readable.
 */
export function refusalOf(e: unknown, template: Template | null, draft: ListingDraft | null): Refusal {
  if (!(e instanceof CreatorApiError)) {
    return { problems: [], message: t("common.somethingWentWrong"), fix: null };
  }

  if (e.code === "network") {
    return {
      problems: [],
      message: t("listings.run.network"),
      fix: null,
    };
  }
  if (e.code === "UNAUTHORIZED" || e.code === "ACCOUNT_DELETED") {
    return { problems: [], message: t("listings.run.unauthorized"), fix: accountFix() };
  }
  if (e.code === "rate_limited" || e.code === "RATE_LIMIT_EXCEEDED") {
    return { problems: [], message: t("listings.problems.rateLimitedSaves"), fix: null };
  }

  if (e.code === "invalid_positions" || e.code === "policy_problems") {
    const list = Array.isArray(e.details.problems) ? (e.details.problems as Record<string, unknown>[]) : [];
    const problems = detailedProblems(list, draft, template);
    return {
      problems,
      message: problems.length ? null : t("listings.problems.cannotPublish"),
      fix: null,
    };
  }

  const account = accountRefusal(e.code);
  if (account) return account;

  const bare = bareProblem(e.code, draft);
  if (bare) return { problems: [bare], message: null, fix: null };

  const plain = PLAIN[e.code];
  return { problems: [], message: plain ? t(plain) : t("common.somethingWentWrong"), fix: null };
}

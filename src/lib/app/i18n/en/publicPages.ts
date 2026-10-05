/** English: the source of the "publicPages" namespace. The words a creator's, an event's and a space's public pages drew in English only. */
const publicPages = {
  /* ── A creator's page and its event screens ── */
  "creator.unreachableTitle": "We couldn't load this creator just now.",
  "creator.whereTheySell": "Where they sell",
  "creator.nothingOnSale": "Nothing on sale right now.",
  "creator.listings": "Listings",
  "creator.showAll": "Show all {count}",
  "creator.missingTitle": "There's nothing on sale at this link.",
  "creator.missingBody":
    "Check the handle with whoever shared it. This creator may have nothing open right now, or may never have opened a space.",

  /* ── An event's page ── */
  "event.unreachableTitle": "We couldn't load this event just now.",
  "event.spaces": "Spaces",
  "event.nobodyYet": "Nobody has opened a space for {event} yet.",
  "event.allTaken": "Everything here is taken. Another tab still has open spots.",
  "event.notAffiliated": "HOLD is not affiliated with {event}.",
  "event.missingTitle": "There's no event at this link.",
  "event.missingBody":
    "Check the link with whoever shared it. If you are going to an event, you can add it from the HOLD app when you open your space.",

  /* ── A space's page ── */
  "space.goneTitle": "This one isn't on sale any more.",
  "space.missingTitle": "There's no HiSpace at this link.",
  "space.missingBody": "Check the link with whoever shared it. It may not be published yet, or it may have been taken down.",
  "space.footerNav": "HiSpace links",

  /* ── Shared ── */
  "goToHold": "Go to HOLD",
} as const;

export default publicPages;

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

  /* ── An organiser's sponsor page and the events index ── */
  "sponsor.eyebrow": "Sponsor this event",
  "sponsor.verifiedHost": "Verified host",
  "sponsor.verifiedHostAbout": "{name} showed on Luma that they host this event.",
  "sponsor.hostedBy": "Hosted by {name}",
  "sponsor.packages": "From the host",
  "sponsor.packagesSub": "Packages sold by {name}, paid in USDC.",
  "sponsor.noPackages": "The host has nothing open right now. The creators below still do.",
  "sponsor.buy": "Buy · {price}",
  "sponsor.makeOffer": "Make an offer",
  "sponsor.getQuote": "Get a quote",
  "sponsor.applyAsPartner": "Apply as partner",
  "sponsor.seePackage": "See package",
  "sponsor.noLongerOnSale": "This package is no longer on sale.",
  "sponsor.partners": "Partners",
  "sponsor.partnerPanelTitle": "Partner with this event",
  "sponsor.partnerPanelBody": "Bring your audience, your channel or your community. Tell {seller} who you reach and what you'd do for the event.",
  "sponsor.sendApplication": "Send application",
  "sponsor.partnerMessage": "What you bring",
  "sponsor.partnerMessagePlaceholder": "Your audience, your channels, what you'd do for the event.",
  "sponsor.open": "{open} of {total} open",
  "sponsor.creatorsGoing": "Creators going",
  "sponsor.creatorsSub": "Your brand on what they carry, in what they post, and in the room.",
  "sponsor.notOnHold.title": "Is this your event?",
  "sponsor.notOnHold.body": "Sell its sponsorship on HOLD",
  "sponsor.notOnHold.getHold": "Get HOLD",
  "eventsIndex.title": "Events to sponsor",
  "eventsIndex.sub": "Upcoming events with host packages or creators going.",
  "eventsIndex.filter": "Filter events",
  "eventsIndex.all": "All",
  "eventsIndex.withPackages": "Host packages",
  "eventsIndex.everyCity": "Every city",
  "eventsIndex.empty": "Nothing open here right now.",
  "eventsIndex.packages": "{count, plural, one {# package} other {# packages}}",
  "eventsIndex.openSpots": "{count, plural, one {# spot open} other {# spots open}}",
  "eventsIndex.unreachable": "We couldn't load the events just now.",

  /* ── Shared ── */
  "goToHold": "Go to HOLD",
} as const;

export default publicPages;

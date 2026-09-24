/** English: the source of the "shell" namespace. Keys are flat, dotted, camelCase. */
const shell = {
  // Navigation entries (nav.ts), main level
  "nav.home": "Home",
  "nav.invest": "Invest",
  "nav.analytics": "Analytics",
  "nav.payments": "Payments",
  "nav.benefits": "Benefits",
  "nav.stays": "Stays",
  "nav.esim": "eSIM",
  "nav.spaces": "Spaces",
  "nav.menu": "Menu",
  "nav.account": "Account",
  "nav.wallet": "Wallet",
  "nav.savings": "Savings",
  "nav.activity": "Activity",
  "nav.addMoney": "Add money",
  "nav.groups": "Groups",
  "nav.payLinks": "Pay links",
  // Navigation entries, Spaces level
  "nav.overview": "Overview",
  "nav.listings": "Listings",
  "nav.offers": "Offers & bids",
  "nav.sales": "Sales",
  "nav.deliveries": "Deliveries",
  "nav.board": "Find a spot",
  "nav.bought": "Your spots",
  "nav.team": "Team",
  "nav.crew": "Crew",
  "nav.insights": "Insights",
  "nav.inspire": "Inspire",
  "nav.spacesSettings": "Spaces settings",
  "navGroup.sponsor": "Sponsor",
  "navGroup.grow": "Grow",

  // The top bar's title for pages under a nav entry (nav.titleFor)
  "title.booking": "Booking",
  "title.yourTrips": "Your trips",
  "title.confirmAndPay": "Confirm and pay",
  "title.stay": "Stay",
  "title.group": "Group",
  "title.newListing": "New listing",
  "title.editDraft": "Edit draft",
  "title.listing": "Listing",
  "title.xAccount": "X account",
  "title.portfolio": "Portfolio",
  "title.realisedGains": "Realised gains",
  "title.whatYouPaid": "What you paid",
  "title.linkYourPhone": "Link your phone",

  // Sidebar and top bar
  "sidebar.closeMenu": "Close menu",
  "sidebar.expand": "Expand sidebar",
  "sidebar.collapse": "Collapse sidebar",
  "sidebar.dashboard": "Dashboard",
  "sidebar.backToHold": "Back to HOLD",
  "sidebar.searchShortcut": "Search (⌘K)",
  "topBar.openMenu": "Open menu",

  // The person at the foot of the column
  "role.creator": "Creator",
  "role.manager": "Manager",
  "role.rep": "Rep",
  "role.creativeDirector": "Creative Director",
  "user.signedIn": "Signed in",
  "user.aCreator": "a creator",
  "user.roleFor": "{role} · {creator}",
  "user.menuFor": "{name} — menu",

  // ⌘K
  "palette.closeSearch": "Close search",
  "palette.placeholder": "Search listings, offers, pages",
  "palette.noMatch": "No match for “{query}”",
  "palette.group.listings": "Listings",
  "palette.group.offers": "Offers",
  "palette.bid": "Bid",
  "palette.offer": "Offer",
  "palette.openInvitation": "Open team invitation",
  "palette.hintMove": "↑↓ move",
  "palette.hintOpen": "↵ open",
  "palette.hintClose": "ESC close",

  // HiPoints chip
  "points.short": "{points} pts",
  "points.title": "{text} · HiPoints",
  "points.aria": "{text} in HiPoints",

  // Base and Polygon come with the app
  "moreChains.oneStore": "Want Base or Polygon too? <link>Get the HOLD app</link>",
  "moreChains.bothStores":
    "Want Base or Polygon too? Get the HOLD app on the <appStore>App Store</appStore> or <play>Google Play</play>",

  // Shared parts (ui.tsx, hold.tsx)
  "ui.sections": "Sections",
  "hold.badgePending": "{count} pending",

  // describeCreatorError (lib/creator/api)
  "error.network": "We could not reach HOLD. Check your connection and try again.",
  "error.signInExpired": "Your sign-in has expired. Sign in again and pick up where you left off.",
  "error.rateLimited": "That is more tries than we allow in a minute. Wait a moment and try again.",
  "error.payoutAddressInvalid": "That is not an address we can pay. Copy it again from your wallet.",
  "error.payoutChainUnknown": "That network is not one HiSpace pays on.",
  "error.payoutNonceInvalid": "That request timed out or was already used. Start again and sign the new message.",
  "error.payoutSignatureInvalid":
    "That signature was not this address's. Make sure the wallet you signed with is the one you connected, and try again.",
  "error.xFrontsALiveSpace":
    "This X account is on a live listing, so it stays connected until that listing closes. Sponsors paid for that handle.",
} satisfies Record<string, string>;

export default shell;

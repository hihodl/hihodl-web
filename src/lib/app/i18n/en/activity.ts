/** English: the source of the "activity" namespace. Keys are flat, dotted, camelCase. */
const activity = {
  // The person's accounts, as a row and a move name them.
  "account.main": "Main",
  "account.savings": "Savings",
  "account.earning": "Earning",
  "account.fallback": "Account",

  // What a row says when the server sent nothing better.
  "row.deposit": "Deposit",
  "row.unknown": "Unknown",
  "row.open": "Open {name} transaction",
  processing: "Processing…",

  // The verb that headlines a row.
  "action.received": "Received",
  "action.sent": "Sent",
  "action.moved": "Moved",
  "action.swapped": "Swapped",
  "action.refunded": "Refunded",
  "action.activity": "Activity",

  // The screen.
  "scope.all": "All accounts",
  "scope.account": "{name} account",
  "balance.current": "Current balance",
  "balance.readFailed": "We could not read your balance just now.",
  "balance.venuesMissing": "{venues} did not answer, so anything earning there is missing from this balance.",
  when: "{day}, {time}",
  "search.placeholder": "Search activity...",
  "search.label": "Search activity",
  "filter.label": "Filter accounts. Showing {scope}",
  "filter.group": "Accounts",
  loadFailed: "We couldn't load your activity",
  empty: "No activity found.",
  "nextPage.failed": "The next page would not load.",
  end: "End of activity",

  // One transaction's panel.
  "details.dialog": "Transaction",
  "details.when": "When",
  "details.transaction": "Transaction",
  "details.note": "Note",
  "details.method": "Method",
  "details.readFailed": "We could not read the rest of this transaction just now.",
  "details.paidInParts": "Paid in {count, plural, one {# part} other {# parts}}",
  "details.part": "Part {n}",
  "details.inApp": "Categories and notes are set in the HOLD app.",
} satisfies Record<string, string>;

export default activity;

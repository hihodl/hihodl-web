/** English: the source of the "analytics" namespace. Keys are flat, dotted, camelCase. */
const analytics = {
  /* Spending categories (lib/app/spending/categories.ts, catalog.ts) */
  "category.groceries": "Groceries",
  "category.eatingOut": "Eating out",
  "category.transport": "Transport",
  "category.bills": "Bills",
  "category.shopping": "Shopping",
  "category.subscriptions": "Subscriptions",
  "category.health": "Health",
  "category.entertainment": "Entertainment",
  "category.travel": "Travel",
  "category.people": "People",
  "category.other": "Other",
  "category.transfers": "Transfers",

  /* Recurring-payment kinds (lib/app/spending/subscriptionCategories.ts) */
  "subCategory.home": "Home",
  "subCategory.phone": "Phone",
  "subCategory.internet": "Internet",
  "subCategory.streaming": "Streaming",
  "subCategory.music": "Music",
  "subCategory.gym": "Gym",
  "subCategory.insurance": "Insurance",
  "subCategory.water": "Water",
  "subCategory.electricity": "Electricity",
  "subCategory.transport": "Transport",
  "subCategory.software": "Software",
  "subCategory.other": "Other",

  /* Counterparty types (lib/app/spending/counterparty.ts) */
  "counterpartyType.hihodlUser": "HOLD user",
  "counterpartyType.cryptoWallet": "Crypto wallet",
  "counterpartyType.bank": "Bank account",
  "counterpartyType.card": "Card",
  "counterpartyType.mobileMoney": "Mobile money",
  "counterpartyType.unknown": "Unknown",

  /** A payment with no merchant, alias, address or note. */
  "counterparty.payment": "Payment",

  /* Range labels (lib/app/spending/range.ts) */
  "range.last12Months": "Last 12 months",
  "range.last90Days": "Last 90 days",
  "range.lastDays": "{count, plural, one {Last # day} other {Last # days}}",
  "range.span": "{start} – {end}",

  /* Overview */
  title: "Analytics",
  "recurring.title": "Recurring",
  "header.backToAnalytics": "Back to analytics",
  "header.recurringPayments": "Recurring payments",
  "readFailed.title": "We couldn't load your activity",
  "readFailed.overview": "Analytics is worked out from your activity, and it did not answer. Nothing has changed.",
  "readFailed.category": "This list is worked out from your activity, and it did not answer. Nothing has changed.",
  "readFailed.metric": "This is worked out from your activity, and it did not answer. Nothing has changed.",
  rangeButton: "Range",
  previousMonth: "Previous month",
  nextMonth: "Next month",
  "hero.youSaved": "You saved",
  "hero.saved": "Saved",
  "hero.delta": "{arrow} {amount} {period, select, month {vs last month} other {vs prior period}}",
  "hero.moneyIn": "Money in",
  "hero.spent": "Spent",
  "bucket.income": "Income",
  "bucket.spend": "Spend",
  "spending.label": "SPENDING",
  "spending.transfersNote": "Moving your own money — counted here, but not as spending.",
  "spending.empty": "No spending yet this period. When you pay for things, they’ll break down here by category.",
  "budgets.label": "BUDGETS",
  "budgets.inApp": "Budgets and your own categories live in the HOLD app.",
  "assets.label": "Assets",
  "assets.title": "Your investments",
  "note.excludedTransfers":
    "{amount} in transfers between your own accounts is excluded from spend — moving your money isn't income or spend.",
  "note.capped": "Showing your most recent activity. Older transactions in a long range may not be included yet.",

  /* Recurring payments */
  "recurring.emptyTitle": "No recurring payments detected yet",
  "recurring.emptyBody": "Recurring charges (Netflix, gym, rent…) show up here automatically.",
  "recurring.monthly": "Estimated monthly",
  "recurring.count": "{count, plural, one {# payment} other {# payments}} · swipe to browse",
  "recurring.note":
    "Amounts are estimated from past charges. Changing a payment's kind or hiding one happens in the HOLD app, so a payment you hid there still shows here.",
  "subTile.tomorrow": "Tomorrow",
  "subTile.inDays": "{count, plural, one {In # day} other {In # days}}",
  "subTile.billingDay": "Day {day}",
  "subTile.aria": "{name} subscription",

  /* Category detail */
  "categoryScreen.summary": "{count, plural, one {# payment} other {# payments}} · {range}",
  "categoryScreen.inApp": "Change categories in the HOLD app. Budgets and your own categories live there too.",
  "categoryScreen.empty": "Nothing in this category",

  /* Metric detail */
  "metric.spendTitle": "Spent",
  "metric.incomeTitle": "Income",
  "metric.cashflowTitle": "Net cashflow",
  "metric.pillWeek": "1W",
  "metric.pillMonth": "1M",
  "metric.pillSixMonths": "6M",
  "metric.pillYear": "1Y",
  "metric.timeframe": "Timeframe",
  "metric.cashflowSubtitle": "{income} in · {spend} out",
  "metric.deltaVsLastPeriod": "{arrow} {pct} vs last period",
  "metric.transactions": "{count, plural, one {# transaction} other {# transactions}}",
  "metric.byCategory": "BY CATEGORY",
  "metric.bySource": "BY SOURCE",
  "metric.moneyIn": "MONEY IN",
  "metric.moneyOut": "MONEY OUT",
  "metric.emptySpend": "No spending in this period.",
  "metric.emptyIncome": "No money in during this period.",
  "metric.emptyIn": "No money in.",
  "metric.emptyOut": "No spending.",
  "metric.payoutsNote":
    "{amount} in bank payouts (off-ramps) is tracked separately — money sent to a bank isn't consumption.",

  /* Shared parts: donut, chart, range sheet */
  "donut.spent": "spent",
  "donut.clearSelection": "Clear selection",
  "chart.spentSoFar": "{amount} spent so far",
  "chart.lastPeriod": "{amount} last period",
  "chart.in": "{amount} in",
  "chart.out": "{amount} out",
  "chart.ariaSpend": "Cumulative spending against the previous period",
  "chart.ariaIncome": "Income per period",
  "chart.ariaCashflow": "Money in and out per period",
  "rangeSheet.title": "Select range",
  "rangeSheet.days": "{count, plural, one {# day} other {# days}}",
  "rangeSheet.oneYear": "1 year",
  "rangeSheet.custom": "Custom",
  "rangeSheet.selected": "SELECTED",
  "rangeSheet.pickStart": "Pick a start day",
  "rangeSheet.summaryDays": "{label} · {count, plural, one {# day} other {# days}}",
  "rangeSheet.apply": "Apply",
} satisfies Record<string, string>;

export default analytics;

/** English: the source of the "money" namespace. Keys are flat, dotted, camelCase. */
const money = {
  // Shared across the portfolio screens
  "readFailed.body": "Nothing has changed. This screen just could not reach it.",
  acrossSales: "{count, plural, one {across # sale} other {across # sales}}",

  // The allocation ring
  "donut.aria": "Allocation by asset",
  "donut.sliceTitle": "{label} {share}",
  "donut.invested": "invested",

  // Invest
  "invest.title": "Invest",
  "invest.performance": "Performance",
  "invest.readFailed": "We couldn't load your investments",
  "invest.unvalued":
    "{count, plural, one {# holding is not in this total — no price available right now.} other {# holdings are not in this total — no price available right now.}}",
  "invest.action": "Invest",
  "invest.inApp": "Buying and exchanging happen in the HOLD app, where the trade is signed on your own device.",
  "invest.assets": "Assets",
  "invest.range.7d": "7D",
  "invest.range.30d": "30D",
  "invest.range.90d": "90D",
  "invest.range.1y": "1Y",
  "invest.range.7dShort": "7d",
  "invest.range.30dShort": "30d",
  "invest.range.90dShort": "90d",
  "invest.range.1yShort": "1y",
  "invest.hero.label": "Invested value",
  "invest.hero.delta": "{range}  {amount}{arrow} {percent}",
  "invest.hero.noHistory": "No price history for these assets",
  "invest.hero.curveAria": "Portfolio value over the chosen range",
  "invest.hero.since": "since {date}",
  "invest.hero.historyFailed": "We couldn't load the price history",
  "invest.hero.leftOut": "Chart leaves out {amount}: no reliable price history",
  "invest.hero.leftOutNamed": "Chart leaves out {amount} ({names}): no reliable price history",
  "invest.hero.leftOutMore": "{names} and {count, plural, one {# more} other {# more}}",
  "invest.empty.title": "Grow your wealth",
  "invest.empty.body": "Turn your dollars into Bitcoin, Solana and more — right from your balance.",
  "invest.row.sinceBought": "{amount} since you bought",
  "invest.row.dayAria": "{dir, select, up {up {amount} in 24 hours} other {down {amount} in 24 hours}}",
  "invest.row.day": "24h",

  // The Solana earning row
  "solEarn.earning": "{amount} earning",
  "solEarn.couldNotCheck": "Couldn't check your position",
  "solEarn.putToWork": "Put your Solana to work",
  "solEarn.aYear": "a year",

  // Buy and Stocks
  "buy.title": "Buy",
  "buy.via": "via {issuer}",
  "buy.wrappedAria": "{name}, wrapped by {issuer}",
  "buy.inApp": "Every one of these is one tap from a filled order in the HOLD app. The trade is signed on your phone.",
  "stocks.title": "Stocks",
  "stocks.subtitle": "Tokenized US stocks · buy with your dollars",
  "stocks.inApp": "Browsing and buying stocks happens in the HOLD app, where the order is signed.",

  // Savings
  "savings.dollars": "Dollars",
  "savings.earnUpTo": "Earn up to {apy}",
  "savings.lending": "Lending · {chain} · {token}",
  "savings.earning": "Earning",
  "savings.earningApy": "Earning {apy}",
  "savings.earnsApy": "Earns {apy} automatically",
  "savings.earnsAutomatically": "Earns automatically",
  "savings.perMonth": "≈ {amount}/mo",
  "savings.waysToEarn": "Ways to earn",
  "savings.ratesFailed": "We couldn't load the rates",
  "savings.comingSoon": "Savings is coming soon.",
  "savings.balance": "Savings balance",
  "savings.couldNotRefresh": "Couldn't refresh — reload to retry",
  "savings.renewal": "{line} Renew it in the HOLD app — it is a signature, so it happens on your phone.",
  "savings.earnMore": "Earn more",
  "savings.advanced": "Advanced yield & staking",
  "savings.advancedUpTo": "Advanced yield & staking · up to {apy}",
  "savings.cardAria": "{title}, earn {apy}",
  "savings.apyVariable": "APY · variable",
  "savings.trust": "Your money stays in your own wallet — HOLD never holds it. This isn't a bank deposit, and rates are variable.",

  // The credit card teaser
  "card.aria": "Credit card",
  "card.title": "Unlock your credit card",
  "card.body": "Spend against your savings without selling. Your balance keeps earning while you tap.",
  "card.depositTitle": "Deposit dollars",
  "card.depositSub": "Move dollars into Savings. They earn interest and back your credit line.",
  "card.connectTitle": "Connect assets from Invest",
  "card.connectSub": "Put the SOL or BTC you already hold to work as collateral — without selling.",
  "card.inApp": "Getting the card, and putting money behind it, happens in the HOLD app.",
  "card.buffer":
    "If your collateral drops in value, HOLD eases your spending first to keep a safe buffer — so a market dip doesn't force a sale. Rates are variable and this isn't a bank product.",

  // Performance
  "performance.title": "Portfolio",
  "performance.readFailed": "We couldn't load your portfolio",
  "performance.nothingInvested": "Nothing invested yet",
  "performance.yourInvestments": "Your investments",
  "performance.allTime": "All-time",
  "performance.basisFailed": "We couldn't read what these cost you just now, so there's no gain to show — only what they're worth today.",
  "performance.basisUnknown": "We don't know what these cost you, so there's no gain to show — only what they're worth today.",
  "performance.kaminoFailed": "Kamino didn't answer, so any Solana you have at work is not in this total.",
  "performance.section.overview": "Overview",
  "performance.section.earn": "Earn",
  "performance.section.sold": "Sold",
  "performance.column.holdings": "Holdings",
  "performance.column.profit": "All-time Profit",
  "performance.emptyTitle": "Nothing here yet",
  "performance.emptyBody":
    "Your dollars are on Home. When you buy something whose price moves — Solana, Ethereum, a stock — it shows up here with what you paid and what it's worth today.",
  "performance.uncosted":
    "{count, plural, one {# holding isn't in that figure — we don't have what it cost.} other {# holdings aren't in that figure — we don't have what they cost.}}",
  "performance.unpriced":
    "{count, plural, one {# holding has no price right now, so it's not in the total.} other {# holdings have no price right now, so they're not in the total.}}",
  "performance.asset": "Asset",
  "performance.price": "Price",
  "performance.paidForAria": "What you paid for {asset}",
  "performance.partOfIt": "(part of it)",
  "performance.costUnknown": "cost unknown",
  "performance.pastToggle": "Sold or sent elsewhere ({count})",
  "performance.pastLine": "{count, plural, one {# purchase} other {# purchases}} · last one {date}",
  "performance.ringOthers": "Others",
  "performance.namesAndOthers": "{names} and {count, plural, one {# other} other {# others}}",
  "performance.solEarned": "{amount} SOL earned so far",
  "performance.earnInApp": "Putting Solana to work, and taking it back, happens in the HOLD app, where it is signed on your phone.",
  "performance.notEarning":
    "{names} {count, plural, one {doesn't} other {don't}} earn anything yet — Solana is the one asset with a venue we can reach today.",
  "performance.nothingEarns": "Nothing you hold can earn yet. Solana is the one asset with a venue we can reach today.",
  "performance.soldFailed": "We couldn't load what you sold",
  "performance.soldFailedBody": "That's not the same as having sold nothing.",
  "performance.soldNothing": "You haven't sold anything yet",
  "performance.soldMade": "What you made on what you sold",
  "performance.soldEmptyBody": "A gain becomes real — and reportable — the day something leaves. Everything you still hold is under Overview.",
  "performance.taxYear": "Your tax year",
  "performance.taxYearSub": "The year in full, and the spreadsheet your accountant wants",

  // Realised gains
  "realised.title": "Realised gains",
  "realised.downloadPdf": "Download as PDF",
  "realised.previousYear": "Previous year",
  "realised.nextYear": "Next year",
  "realised.taxYear": "Tax year {year}",
  "realised.readFailed": "We couldn't load {year}",
  "realised.readFailedBody": "That's not the same as having sold nothing — we just couldn't reach the figures.",
  "realised.notCounted": "{count} not counted below",
  "realised.headline":
    "{kind, select, nothing {You sold nothing in {year}} dollarsOnly {Nothing to declare for {year}} even {In {year} you broke even} made {In {year} you made} other {In {year} you lost}}",
  "realised.nothingBody": "Anything you still hold is in your portfolio. A gain only becomes real when something leaves.",
  "realised.dollarsOnlyBody":
    "You moved {amount} this year, all of it in dollars. A dollar is worth a dollar when you spend it, so there's no gain or loss to report. That starts the day you sell something whose price moves.",
  "realised.brokeEven": "Broke even",
  "realised.evenSub":
    "{count, plural, one {across # sale} other {across # sales}} — what you sold was worth what you paid for it",
  "realised.feesOf": "{amount} of network fees",
  "realised.splitAria": "{up} up, {down} down",
  "realised.up": "{amount} up",
  "realised.down": "{amount} down",
  "realised.incomeTitle": "Plus {amount} earned",
  "realised.incomeBody":
    "Interest paid to you while you held. Most tax returns treat that as income rather than a gain, so it's kept separate.",
  "realised.whatYouSold": "What you sold",
  "realised.paidInDollars": "{amount} paid in dollars",
  "realised.paymentsSub":
    "{count, plural, one {# payment} other {# payments}} · a dollar is worth a dollar, so nothing to declare",
  "realised.networkFees": "Network fees",
  "realised.feesSub": "{count} paid to the blockchain, not to us",
  "realised.preparing": "Preparing…",
  "realised.preparingPdf": "Preparing the PDF…",
  "realised.exportCsv": "Export as a spreadsheet",
  "realised.downloadFailed": "We couldn't build the {format} just now. The figures above are the same ones — try again in a moment.",
  "realised.soldAtCost": "sold at {sold}, cost {cost}",
  "realised.soldAt": "sold at {sold}",

  // Why a year leaves a disposal out (lib/app/portfolio)
  "exclusion.unknownDecimals":
    "{count, plural, one {# disposal is} other {# disposals are}} of a token we can't measure precisely enough to value. Excluded rather than reported at the wrong scale.",
  "exclusion.incompleteBasis":
    "{count, plural, one {# disposal has no complete purchase history behind it} other {# disposals have no complete purchase history behind them}}, so there is nothing to measure the result against.",
  "exclusion.unpricedDisposal": "{count, plural, one {# disposal} other {# disposals}} went out without a recorded market price.",
  "exclusion.other": "{count} excluded ({reason}).",

  // What you paid
  "cost.title": "What you paid",
  "cost.readFailed": "We couldn't load your {asset}",
  "cost.readFailedBody": "That's not the same as having bought none.",
  "cost.emptyTitle": "Nothing to show for {asset}",
  "cost.emptyBody": "This is where every {asset} you received turns up, with what we think it cost you.",
  "cost.allChecked": "All {count} checked",
  "cost.provisionalCount": "{count, plural, one {# price is provisional} other {# prices are provisional}}",
  "cost.allYours": "Every price here is one you gave us.",
  "cost.pricedOnArrival": "Priced at what it was worth when it reached HOLD.",
  "cost.inApp": "Change what you paid in the HOLD app. Only the price moves — everything else here is an on-chain fact.",
  "cost.howItWorks": "How this works",
  "cost.info.whyTitle": "Why we ask",
  "cost.info.whyBody":
    "Every cost figure is the market price the moment your coin arrived here. For a swap we ran, that is the truth. For a coin you bought elsewhere and withdrew to HOLD, it is not — buy at {bought}, move it here at {moved}, sell at {sold}, and we would report a {reported} gain on a {real} one.",
  "cost.info.optionalTitle": "Nothing here is required",
  "cost.info.optionalBody":
    "Leave a price alone and we keep the one from the day it arrived. It is usable, it is in every total, and very often it is right.",
  "cost.info.priceTitle": "Only the price moves",
  "cost.info.priceBody":
    "What arrived, when it landed and on which network are on-chain facts, and nothing can edit them. The one number the chain never had is the one you are allowed to correct.",
  "cost.info.exportTitle": "Your export knows the difference",
  "cost.info.exportBody":
    "The tax file says line by line which prices came from the chain and which came from you, and carries both dates — the day you bought and the day it reached us.",
  "cost.bought": "Bought {date}",
  "cost.fromOutside": "From outside HOLD",
  "cost.inTotal": "{amount} in total",
  "cost.each": "each",
  "cost.yourPrice": "Your price",
  "cost.provisional": "Provisional",
} satisfies Record<string, string>;

export default money;

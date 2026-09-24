/** English: the source of the "home" namespace. Keys are flat, dotted, camelCase. */
const home = {
  /* ── Home ── */
  "scope.main": "Main",
  "scope.savings": "Savings",
  "token.usDollar": "US Dollar",
  "token.euro": "Euro",

  "balance.readFailed": "We could not read your balance just now.",
  "balance.show": "Show balances",
  "balance.hide": "Hide balances",
  "balance.venuesMissing": "{venues} did not answer, so anything earning there is missing from this total.",
  "balance.unpricedOne": "{symbol} has no price today, so it is not in this total.",
  "balance.unpricedMany": "{count} holdings have no price today, so they are not in this total.",
  "balance.delta24h": "24h",
  earned: "+{amount} earned",

  "actions.add": "Add",
  "actions.activity": "Activity",

  "cards.stables": "Stables",
  "cards.earning": "Earning",
  "cards.assets": "Assets",
  "cards.moreInApp": "More of these live in the app",

  "activity.title": "Activity",
  "activity.loadFailed": "We couldn't load your activity",
  "activity.emptyTitle": "Your moves will appear here",
  "activity.emptyBody": "Send or receive to see your history",

  "bento.moneyOut": "MONEY OUT",
  "bento.thisMonth": "This month",
  "bento.getPaid": "GET PAID",
  "bento.receiveDollars": "Receive dollars",
  "bento.receiveWays": "Account, handle or QR",

  "overview.title": "Overview",
  "overview.close": "Close overview",
  "overview.balances": "{count, plural, one {# balance} other {# balances}}",
  "overview.tokens": "{count, plural, one {# token} other {# tokens}}",
  "overview.summary": "{vaults, plural, one {# vault} other {# vaults}} · {holdings}",
  "overview.earning": "{holdings} · Earning",
  "overview.note": "Renaming a vault, changing its colour and creating a pocket all happen in the HOLD app.",

  "empty.title": "Ready to get started?",
  "empty.body": "Your Main and Savings accounts are here. Add money and it shows up on this screen.",
  "empty.cta": "Add money",

  /* ── Add money ── */
  "add.tile.bank": "Bank Transfer",
  "add.tile.bankSubLoading": "Wire, ACH or SEPA",
  "add.tile.bankSubHas": "Wire or ACH to your account",
  "add.tile.bankSubNone": "Get a personal bank account",
  "add.tile.setup": "SETUP",
  "add.tile.cash": "Add Cash",
  "add.tile.cashSub": "Debit or credit card",
  "add.tile.receive": "Receive Crypto",
  "add.tile.receiveSub": "QR & wallet addresses",
  "add.tile.request": "Request Link",
  "add.tile.requestSub": "Share your hi.me link",
  "add.tile.payLink": "Pay link",
  "add.tile.payLinkSub": "Get paid from any wallet",

  "add.cash.title": "Add cash",
  "add.cash.about":
    "Buying with a card goes through our on-ramp provider and its checkout. That flow lives in the app; the web never starts a card charge.",

  "add.receive.readFailed": "We could not read your addresses just now. Nothing has changed — try again in a moment.",

  "add.request.title": "Request via link",
  "add.request.lead": "Share your Hi.me link so anyone can pay you",
  "add.request.copyLink": "Copy link",
  "add.request.noUsername": "You have no username yet, so there is no link to share. <link>Choose one in Account</link>.",
  "add.request.share": "Share link",
  "add.request.amountInApp": "Asking for a specific amount, and the QR that carries it, happen in the HOLD app.",

  "add.bank.title": "Bank transfer",
  "add.bank.about":
    "An account number of your own, in your name. What arrives in it lands in your HOLD balance. Opening one starts with an identity check that reads your document and matches it to your face — that scanner only exists in the app, so this is the one thing here a browser cannot finish.",
  "add.bank.lead": "{count, plural, one {Your account.} other {Your accounts.}} Money sent here lands in your HOLD balance.",
  "add.bank.anotherCurrency": "Opening another currency happens in the app, where the identity check runs.",
  "add.bank.pendingDetails":
    "This account is open, but its deposit details have not come back from the provider yet. They appear here as soon as they do.",
  "add.bank.field.accountHolder": "Account holder",
  "add.bank.field.accountNumber": "Account number",
  "add.bank.field.routingNumber": "Routing number",
  "add.bank.field.sortCode": "Sort code",
  "add.bank.field.paymentCode": "Payment code",
  "add.bank.field.reference": "Reference",
  "add.bank.field.bank": "Bank",

  "add.inApp.title": "Available in the HOLD app for now",
  "add.inApp.body": "Sign in there with the same account. It comes to the web next.",
  "add.inApp.receiveHere": "Receiving crypto and your hi.me link work here, on the screen before this one.",

  /* ── Benefits and its products ── */
  "benefits.title": "Products",
  "benefits.lead": "What you can buy, and sell, through HOLD.",
  "benefits.onWeb": "On the web",
  "benefits.inApp": "In the app",
  "benefits.spacesStatus": "{live} live · <w>{waiting} waiting on you</w>",

  "products.stays.name": "Stays",
  "products.stays.door": "Find a stay",
  "products.stays.sub": "Search hotels wherever you're going",
  "products.stays.about": "Hotels wherever you're going, priced in the app, and HiPoints back on the nights you book.",
  "products.esim.door": "Data abroad",
  "products.esim.sub": "No roaming bill",
  "products.esim.about":
    "Mobile data for the country you're going to. Pick a plan in the app, install the eSIM, and you're online when you land.",
  "products.spaces.door": "Sell sponsor spots",
  "products.spaces.sub": "On your gear or your content, paid in USDC straight to you",

  /* ── Link your phone ── */
  "linkPhone.pay.title": "Link your phone to pay from here",
  "linkPhone.pay.bodyAndroid": "Open HOLD on this phone to link it. From then on, the app approves every payment you start here.",
  "linkPhone.later": "Later",

  /* ── Pay links (the owner's side) ── */
  "payLinks.title": "Pay links",
  "payLinks.introTitle": "Get paid by anyone, from any wallet",
  "payLinks.introBody":
    "Share a link with someone who doesn’t use HOLD. They pay in USDC from their own wallet, and it lands in yours. No fee.",
  "payLinks.madeInApp": "New links are made in the HOLD app. The ones you have are here.",
  "payLinks.loadFailed": "Your pay links aren't loading. They're unchanged; this screen just couldn't reach them. {reason}",
  "payLinks.empty": "No pay links yet. The first one takes a minute.",
  "payLinks.openSection": "Open ({count})",
  "payLinks.doneSection": "Paid, closed or expired",
  "payLinks.until": "Until {date}",

  "payLinks.status.active": "Open",
  "payLinks.status.paid": "Paid",
  "payLinks.status.closed": "Closed",
  "payLinks.status.expired": "Expired",
  "payLinks.status.disabled": "Taken down",
  "payLinks.payment.paid": "Paid",
  "payLinks.payment.paidDuplicate": "Paid twice",
  "payLinks.payment.awaiting": "Confirming",
  "payLinks.payment.unpaid": "Not paid",

  "payLinks.takenDown": "This link was taken down after a review. Payers see “This link is no longer available”.",
  "payLinks.kv.received": "Received",
  "payLinks.kv.networks": "Networks",
  "payLinks.kv.created": "Created",
  "payLinks.kv.openUntil": "Open until",
  "payLinks.kv.noEnd": "No end date",
  "payLinks.share": "Share link",
  "payLinks.close.title": "Close this link?",
  "payLinks.close.body": "Nobody can pay it after this. Payments already made stay in your wallet. A closed link can’t be opened again.",
  "payLinks.close.keep": "Keep it open",
  "payLinks.close.closing": "Closing…",
  "payLinks.close.cta": "Close link",
  "payLinks.paymentsSection": "Payments ({count})",
  "payLinks.noPaymentsOpen": "No payments yet. You'll get a notification when one lands.",
  "payLinks.noPaymentsClosed": "This link received no payments.",
  "payLinks.from": "From {address}",
  "payLinks.copyAddress": "Copy address",
  "payLinks.paidTwice":
    "Paid after this one-payment link was already paid. The money is in your wallet; if it wasn’t meant for you twice, send it back.",
  "payLinks.seeTx": "See the transaction",

  "payLinks.amount.upTo": "Payer chooses, up to {amount}",
  "payLinks.amount.open": "Payer chooses the amount",
  "payLinks.amount.line": "{amount} · {use, select, single {one payment} other {reusable}}",
  "payLinks.totals": "{count, plural, one {# payment} other {# payments}} · {amount} received",

  "payLinks.error.notActive": "This link isn't open any more.",
  "payLinks.error.notFound": "We couldn't find that link.",
  "payLinks.error.rateLimited": "Too many tries in a short time. Wait a moment and try again.",
  "payLinks.error.network": "No connection. Check your internet and try again.",
  "payLinks.error.unauthorized": "Your session ended. Sign in again.",
  "payLinks.error.other": "Something went wrong. Try again in a moment.",

  /* ── Pay links (the payer's side, lib/pay-links/client) ── */
  "payLinks.owner.fallback": "the link owner",
  "payLinks.owner.handleLine": "{handle} on HOLD",
  "payLinks.pay.previousPending": "Your previous attempt is still settling. Try again in {seconds, plural, one {# second} other {# seconds}}.",
  "payLinks.pay.previousSettled": "Your previous attempt has had time to settle. You can try again now.",
  "payLinks.pay.gone.paid":
    "This link has already been paid, so it takes no more payments. This attempt took nothing from your wallet; if an earlier one of yours paid it, it shows in your wallet's history.",
  "payLinks.pay.gone.closed": "Its owner closed this link while you were paying, so it takes no more payments. Nothing was paid.",
  "payLinks.pay.gone.expired": "This link expired while you were paying, so it takes no more payments. Nothing was paid.",
  "payLinks.pay.gone.disabled": "This link is no longer available. Nothing was paid.",
  "payLinks.pay.notActive": "This link can't take payments any more. It may have been paid, closed or expired. Nothing was paid.",
  "payLinks.pay.thisNetwork": "this network",
  "payLinks.pay.pausedTrySolana": "{where} payments are paused for today. Try Solana.",
  "payLinks.pay.pausedToday": "{where} payments on this link are paused for today. Nothing was paid; try again tomorrow.",
  "payLinks.pay.busy": "Someone else is paying this link right now. Try again in a couple of minutes.",
  "payLinks.pay.amountRange": "The amount has to be between {min} and {max}.",
  "payLinks.pay.amountOutside": "That amount is outside what this link accepts.",
  "payLinks.pay.chainNotAccepted": "This link doesn't take payments on {net}. Pick one of the other networks.",
  "payLinks.pay.receiverNotReady":
    "The person you're paying can't receive USDC on {net} right now. Nothing was paid. Try another network, or tell them.",
  "payLinks.pay.insufficientKnown":
    "This wallet has {have} USDC on {net} and this payment needs {need}. Add USDC or pay from another wallet.",
  "payLinks.pay.insufficient": "This wallet doesn't have enough USDC on {net} for this payment. Add USDC or pay from another wallet.",
  "payLinks.pay.pausedOurSide": "Payments are paused for a moment on our side. Nothing was paid; try again in a minute.",
  "payLinks.pay.limitLink": "This link has taken as many payments as it can today. Nothing was paid; try again tomorrow.",
  "payLinks.pay.limitOwner": "{payee} has received as many payments as they can today. Nothing was paid; try again tomorrow.",
  "payLinks.pay.personPaying": "The person you're paying",
  "payLinks.pay.limitPayer":
    "This wallet has started as many payments on {net} as it can today. Nothing was paid; try again tomorrow or pay from another wallet.",
  "payLinks.pay.openCheckouts":
    "Too many payments to this link are waiting to be signed right now. Nothing was paid; try again in a few minutes.",
  "payLinks.pay.tooManyRequests": "Too many requests from this connection. Nothing was paid; wait a moment and try again.",
  "payLinks.pay.ownAddress": "That wallet is the one this link pays. Pay from a different wallet.",
  "payLinks.pay.invalidAddress": "Your wallet gave us an address we can't use on {net}. Reconnect it and try again.",
  "payLinks.pay.badSignature": "That signature didn't match the payment, so we didn't send it. Nothing was paid.",
  "payLinks.pay.expired": "That payment took too long to sign, so it can't be sent any more. Nothing was paid; start again.",
  "payLinks.pay.keyReused": "This payment was started with a different wallet or network. Nothing was paid; start again.",
  "payLinks.pay.inFlight": "This page is already starting a payment. Wait a moment and try again.",
  "payLinks.pay.cantStart": "This payment couldn't be started from this page. Nothing was paid; refresh the page and try again.",
  "payLinks.pay.mismatch":
    "The payment we were given didn't match what this page shows, so nothing was sent to your wallet. Nothing was paid; refresh the page and try again.",
  "payLinks.pay.notFound": "We can't find this link or payment any more. Refresh the page.",
  "payLinks.pay.badRequest": "We can't find this link or payment. Check the link and refresh the page.",
  "add.receive.noneGetApp": "There is no address to be paid on yet. Your wallet is made in the HOLD app: get it, and the address appears here.",
  "linkPhone.pay.bodyComputer": "Your wallet's keys stay on your phone. Link it once and the HOLD app approves every payment you start here.",
} satisfies Record<string, string>;

export default home;

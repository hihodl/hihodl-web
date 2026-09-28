/**
 * English: the source of the "payPage" namespace, the public pay link page
 * (hihodl.xyz/pay/@handle and hihodl.xyz/pay/<code>). Somebody with no HOLD
 * account reads it, so every line is short and plain. Keys are flat, dotted,
 * camelCase.
 */
const payPage = {
  // The top bar
  "language": "Language",

  // Who is being paid, and how much
  "howMuch": "How much do you want to send?",
  "amountLabel": "Amount",
  "amountRange": "The amount has to be between {min} and {max}.",
  "currency": "Currency",
  "chooseCurrency": "Choose a currency",
  "searchCurrency": "Search currency",
  "noResults": "No results",

  // The note
  "note": "Note",
  "notePlaceholder": "What is it for? (optional)",

  // How to pay
  "howToPay": "How to pay",
  "hold": "HOLD",
  "holdSub": "Pay in the app, free",
  "card": "Debit or credit card",
  "cardSub": "Charged in {currency}",
  "stablecoins": "Stablecoins",
  "stablecoinsSub": "USDC from any wallet",

  // The HOLD row
  "holdTitle": "Pay with HOLD",
  "holdOpening": "Opening HOLD…",
  "holdScan": "Scan this code with your phone's camera. It opens this page there, and HOLD takes you straight to the payment.",
  "holdGetApp": "No HOLD yet? Get the app, it's free.",
  "downloadOn": "Download on the",
  "getItOn": "Get it on",

  // The stablecoin sheet

  // The card sheet
  "cardTitle": "Pay by card",
  "cardStarting": "Opening the secure checkout…",
  "cardOpenTab": "Open in a new tab",

  // After a card payment
  "paidAccepted": "Payment accepted",
  "paidSending": "Your card was accepted. We're sending the money to {name}.",
  "paidDone": "{amount} sent to {name}.",
  "paidDoneNoAmount": "Sent to {name}.",
  "paidSlow": "This is taking longer than usual. The money goes out as soon as your card clears; you can close this page.",
  "paidDeclined": "Your card was declined. Nothing was charged.",
  "paidFailed": "The payment didn't go through. Nothing was charged.",
  "paidRefunded": "This payment was refunded to your card.",
  "viewTx": "View the transaction",
  "tryAgain": "Try again",
  "payAgain": "Send another payment",

  // Card refusals
  "err.cardUnavailable": "Card payments aren't available right now. Try stablecoins.",
  "err.linkNotActive": "This link takes no more payments.",
  "err.amountOutOfRange": "Card payments go from {min} to {max}.",
  "err.amountOutOfRangePlain": "That amount is too small or too large for a card payment.",
  "err.currencyNotSupported": "That currency isn't available for cards. Choose another.",
  "err.cardLimitReached": "{name} can't take more card payments this week. Try stablecoins.",
  "err.linkBusy": "Someone is paying this link right now. Try again in a minute.",
  "err.rateLimited": "Too many tries. Wait a minute and try again.",
  "err.network": "No connection. Check your internet and try again.",
  "err.generic": "Something went wrong on our side. Nothing was charged. Try again.",

  // Links that take no more payments
  "gone.paidTitle": "This link has been paid.",
  "gone.paidBody": "It took one payment, and that payment has arrived.",
  "gone.closedTitle": "This link is closed.",
  "gone.closedBody": "Its owner closed it, so it takes no more payments.",
  "gone.expiredTitle": "This link has expired.",
  "gone.expiredBody": "It takes no more payments. Ask whoever sent it for a new one.",
  "gone.frozenTitle": "This link is paused.",
  "gone.frozenBody": "It takes no payments for now.",
  "gone.personalTitle": "This link takes no more payments.",
  "gone.personalBody": "Ask {name} for their new one.",
  "disabledTitle": "This link is no longer available.",
  "disabledBody": "Don't send money to whoever shared it.",
  "unavailableTitle": "We couldn't load this link just now.",
  "unavailableBody": "This is on our side. Give it a moment and refresh the page. Nothing has been paid.",
  "fallback.paid": "This link has been paid",
  "fallback.inactive": "This link is no longer active",
  "fallback.frozen": "This link is paused",
  "fallback.cta": "Pay {name} another amount",
  "notFound.title": "This link doesn't exist",
  "notFound.body": "Check the link with whoever sent it.",
  "notFound.label": "Pay someone on HOLD",
  "notFound.go": "Continue",
  "notFound.badHandle": "That isn't a HOLD handle.",

  // The foot
  "terms": "Terms",
  "privacy": "Privacy",
  "safety": "Only pay people you know.",

  // The link card a chat app draws for this page (og:title, og:description)
  "og.personalTitle": "Pay {name} in a minute",
  "og.linkDescription": "{name} is asking you to pay. It takes a minute, no account needed.",
  "og.cardApplePay": "Card or Apple Pay. No account or app needed.",
  "og.byCard": "Pay by card. No account or app needed.",
  "og.plain": "Fast and secure. No account needed.",
  "og.genericTitle": "Pay with HOLD",

  // Report
  "report.open": "Report this link",
  "report.label": "What's wrong with this link? (optional)",
  "report.placeholder": "It pretends to be a support team asking for a refund.",
  "report.send": "Send report",
  "report.sending": "Sending…",
  "report.thanks": "Thanks. We look at every report, and we take down links that are used to deceive people.",

  // The stablecoin flow, inside its sheet
  "stable.amountBetween": "The amount has to be between {min} and {max}.",
  "stable.connecting": "Connecting {wallet}…",
  "stable.preparing": "Preparing the payment…",
  "stable.approveIn": "Approve the payment in {wallet}…",
  "stable.freshOne": "That took a while, so here is a fresh one. Approve it in {wallet}…",
  "stable.makingCode": "Making your code…",
  "stable.switching": "Switching your wallet to {net}…",
  "stable.duplicateTitle": "Someone else paid this link first.",
  "stable.duplicateBody": "This link takes one payment, and another one arrived a moment before yours. We have told {payee}. Contact them with your transaction to sort it out; HOLD can't reverse a payment.",
  "stable.viewTx": "View the transaction",
  "stable.lapsedTitle": "No payment arrived.",
  "stable.lapsedBody": "Nothing left your wallet. Start again when you're ready.",
  "stable.startAgain": "Start again",
  "stable.qrTitle": "Solana Pay QR code",
  "stable.qrScan": "Scan with Phantom, Solflare or any Solana wallet.",
  "stable.qrMismatch": "The payment your wallet opened didn't match this page. Don't approve it; scan this new code instead.",
  "stable.qrExpired": "That code ran out before a payment arrived, so here is a new one. Nothing was paid.",
  "stable.qrScanned": "Your wallet has the payment. Approve it there, and this page updates.",
  "stable.signInWallet": "Sign in your wallet",
  "stable.sending": "Sending the payment…",
  "stable.signWithin": "Sign within {time}.",
  "stable.signExpired": "This signature request has expired. Close your wallet and start again.",
  "stable.confirming": "Confirming your payment on {net}…",
  "stable.updatesOwn": "This page updates on its own.",
  "stable.paidSent": "{amount} sent to {payee}.",
  "stable.paidIn": "In {token} on {net}.",
  "stable.receiptOpen": "Open the receipt",
  "stable.another": "Make another payment",
  // Round two: the amount first, EURC, the verified tick, the language search
  "amountFirst": "Type how much you want to send first.",
  "verified": "Verified",
  "searchLanguage": "Search language",
  "stablecoinsSubEur": "EURC on Base",
  "eurcUnavailable": "EURC isn't available for this link. Switch to USD to pay in USDC.",
  "eurcUnavailableShort": "EURC isn't available for this link",
  "payWithToken": "Pay with {token}",
  "sheetTo": "to {name}",
  "network": "Network",
  "onNetwork": "{token} on {net}",
  "payWithWallet": "Pay with {wallet}",
  "showCode": "Show the code",
  "wcScan": "Scan with any wallet on another phone or computer.",
  "orOpenWallet": "Or open your wallet",
  "openInWalletBrowser": "Open this page in your wallet's browser to pay.",

  // Bank transfer: the owner's own account and the link's reference
  "bank": "Bank transfer",
  "bankTitle": "Pay by bank transfer",
  "bankHolder": "Account holder",
  "bankAccountNumber": "Account number",
  "bankRouting": "Routing number",
  "bankReference": "Reference",
  "bankBusinessOnly": "Pay from a company account",
  "bankUseReference": "Use this reference so it reaches {name}",
  "bankCopy": "Copy {label}",
} as const;

export default payPage;

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
  "fixedAmount": "Amount to pay",
  "amountLabel": "Amount",
  "approx": "About {amount}",
  "limits": "From {min} to {max}",
  "amountInvalid": "Type an amount, like 25 or 25.50.",
  "amountRange": "The amount has to be between {min} and {max}.",
  "currency": "Currency",
  "chooseCurrency": "Choose a currency",
  "searchCurrency": "Search currency",
  "noResults": "No results",
  "usdOnly": "This link is paid in US dollars.",

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
  "warning": "Only pay people you know. A payment can't be reversed.",

  // The HOLD row
  "holdTitle": "Pay with HOLD",
  "holdOpening": "Opening HOLD…",
  "holdScan": "Scan this code with your phone's camera. It opens this page there, and HOLD takes you straight to the payment.",
  "holdGetApp": "No HOLD yet? Get the app, it's free.",
  "downloadOn": "Download on the",
  "getItOn": "Get it on",

  // The stablecoin sheet
  "stableTitle": "Pay with stablecoins",
  "stableUsd": "Stablecoin payments are in USDC, one US dollar each.",

  // The card sheet
  "cardTitle": "Pay by card",
  "cardStarting": "Opening the secure checkout…",
  "cardOpenTab": "Open in a new tab",
  "cardSecure": "Your card details go to Coinflow, not to HOLD.",

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
  "gone.personalTitle": "This link takes no more payments.",
  "gone.personalBody": "Ask {name} for their new one.",
  "disabledTitle": "This link is no longer available.",
  "disabledBody": "Don't send money to whoever shared it.",
  "unavailableTitle": "We couldn't load this link just now.",
  "unavailableBody": "This is on our side. Give it a moment and refresh the page. Nothing has been paid.",

  // The foot
  "coinflow": "Card payments are processed by Coinflow.",
  "about": "HOLD is a wallet. The money goes straight to {name}. HOLD never holds it.",
  "terms": "Terms",
  "privacy": "Privacy",

  // Report
  "report.open": "Report this link",
  "report.label": "What's wrong with this link? (optional)",
  "report.placeholder": "It pretends to be a support team asking for a refund.",
  "report.send": "Send report",
  "report.sending": "Sending…",
  "report.cancel": "Cancel",
  "report.thanks": "Thanks. We look at every report, and we take down links that are used to deceive people.",

  // The stablecoin flow, inside its sheet
  "stable.amountHow": "Type the amount in dollars, like 150 or 150.50.",
  "stable.amountBetween": "The amount has to be between {min} and {max}.",
  "stable.connecting": "Connecting {wallet}…",
  "stable.preparing": "Preparing the payment…",
  "stable.approveIn": "Approve the payment in {wallet}…",
  "stable.freshOne": "That took a while, so here is a fresh one. Approve it in {wallet}…",
  "stable.makingCode": "Making your code…",
  "stable.noBrowserWallet": "No browser wallet found. Open this page in MetaMask, Coinbase Wallet or Rabby, or pay another way.",
  "stable.chooseWallet": "Choose your wallet…",
  "stable.connectingWallet": "Connecting your wallet…",
  "stable.switching": "Switching your wallet to {net}…",
  "stable.duplicateTitle": "Someone else paid this link first.",
  "stable.duplicateBody": "This link takes one payment, and another one arrived a moment before yours. We have told {payee}. Contact them with your transaction to sort it out; HOLD can't reverse a payment.",
  "stable.viewTx": "View the transaction",
  "stable.lapsedTitle": "No payment arrived.",
  "stable.lapsedBody": "Nothing left your wallet. Start again when you're ready.",
  "stable.startAgain": "Start again",
  "stable.oneMoment": "One moment…",
  "stable.amountLabel": "Amount in US dollars (USDC)",
  "stable.amountRange": "From {min} to {max}.",
  "stable.evmIntro": "One signature, no gas. The whole amount goes to {payee}; HOLD takes nothing.",
  "stable.noWalletHere": "No browser wallet found here. Open this page in MetaMask, Coinbase Wallet or Rabby.",
  "stable.noWalletHereSolana": "No browser wallet found here. Open this page in MetaMask, Coinbase Wallet or Rabby, or pay on Solana by QR.",
  "stable.connectAndPay": "Connect wallet and pay",
  "stable.useAnother": "Use another wallet",
  "stable.chooseAndPay": "Choose your wallet and pay",
  "stable.direct": "You pay {payee} directly, in USDC on {net}. HOLD never holds the money, charges no fee and can't reverse the payment.",
  "stable.qrTitle": "Solana Pay QR code",
  "stable.qrScan": "Scan with Phantom, Solflare or any Solana wallet. It shows the exact amount before you approve.",
  "stable.qrMismatch": "The payment your wallet opened didn't match this page. Don't approve it; scan this new code instead.",
  "stable.qrExpired": "That code ran out before a payment arrived, so here is a new one. Nothing was paid.",
  "stable.qrScanned": "Your wallet has the payment. Approve it there, and this page updates.",
  "stable.openInWallet": "Open in my wallet",
  "stable.waitingWallet": "Waiting for your wallet…",
  "stable.back": "Back",
  "stable.signInWallet": "Sign in your wallet",
  "stable.sending": "Sending the payment…",
  "stable.signWithin": "Sign within {time}.",
  "stable.signExpired": "This signature request has expired. Close your wallet and start again.",
  "stable.confirming": "Confirming your payment on {net}…",
  "stable.updatesOwn": "This page updates on its own.",
  "stable.paid": "Paid",
  "stable.paidSent": "{amount} sent to {payee}.",
  "stable.paidIn": "In USDC on {net}.",
  "stable.receiptTitle": "Keep your receipt.",
  "stable.receiptBody": "Its link shows the amount, the network, the transaction and the time. Save it: you have no account here to find it in later.",
  "stable.receiptOpen": "Open the receipt",
  "stable.another": "Make another payment",
} as const;

export default payPage;

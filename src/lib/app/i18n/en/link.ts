/** English: the source of the "link" namespace. Keys are flat, dotted, camelCase. */
const link = {
  "linkYourPhone": "Link your phone",
  "notNow": "Not now",
  "later": "Later",
  "linking": "Linking...",
  "linkingPhone": "Linking your phone...",
  "sendingWallet": "Sending your wallet to your phone...",
  "getOnPlay": "Get HOLD on Google Play",
  "newCode": "Show a new code",
  "why": "A linked Android phone approves and signs, in the HOLD app, the payments you start on the web.",
  "mismatch": "The codes were different, so nothing was sent. That can happen when another phone scanned the code.",
  "expired": "That code expired. Codes last five minutes.",

  // Paying from a wallet made in the app, with no phone linked
  "pay.title": "Link your phone to pay from here",

  // The computer's side, waiting for the phone ({name} is iPhone or iPad)
  "waiting.qrPhone": "Scan with your phone",
  "waiting.status": "Waiting for your phone · <n>{left}</n>",
  "waiting.androidHere": "Open the HOLD app with this link. It shows a six-digit code: come back to this page to check it matches.",
  "waiting.validFor": "Code valid for {left}",
  "waiting.openInHold": "Open in HOLD",

  // Checking the six-digit code
  "confirm.joinedCarries": "Your phone joined. Before your wallet goes to it, check this is your phone.",
  "confirm.joined": "Your phone joined. Check this is your phone.",
  "confirm.codeLabel": "Code {digits}",
  "confirm.question": "Does your phone show this code?",
  "confirm.waitingPasskey": "Waiting for your passkey...",
  "confirm.yes": "Yes, it matches",
  "confirm.no": "No, it is different",
  "confirm.secretRequired": "Your wallet goes to this phone too. Confirm again with your passkey.",
  "confirm.stillReading": "Still reading your wallet. Try again in a moment.",

  "done.title": "Your phone is linked",
  "done.android": "Payments you start on the web are now approved and signed in the HOLD app on this phone.",

  // The phone's side (/link/<sessionId>)
  "phone.androidBody": "Your phone links in the HOLD app. It opens on a six-digit code: check it matches the one on your computer.",
  "phone.noApp": "No HOLD app yet? Install it, sign in with the same account, and it picks up this link where you left it.",
  "phone.computer": "This page is for your phone. Scan the code on your computer with your phone's camera.",

  // Approving a spot or a stay on the phone
  "approval.pending": "Approve on your phone",
  "approval.approved": "Approved on your phone. Sending…",
  "approval.submitted": "Approved. Sending…",
  "approval.toPay": "To pay",
  "approval.youPay": "You pay",
  "approval.leavesWallet": "Leaves your wallet",
  "approval.openHold": "Open HOLD",
  "approval.cancelling": "Cancelling…",
  "approval.footer": "A notification in the HOLD app on your phone asks you to approve it. No notification? Open HOLD and go to Withdrawals.",
  "approval.expiresIn": "It expires in <n>{left}</n>.",

  // Why the phone was not asked, or how it ended (nothing was charged)
  "refusal.declined": "You declined it on your phone. Nothing has been charged.",
  "refusal.expired": "It was not approved on your phone within ten minutes. Nothing has been charged.",
  "refusal.cancelled": "Cancelled. Nothing has been charged.",
  "refusal.validationSpot": "We couldn't ask your phone about this spot. Nothing has been charged. Try again.",
  "refusal.validationStay": "We couldn't ask your phone about this stay. Nothing has been charged. Try again.",
  "refusal.notFoundSpot": "We couldn't find that order any more. Nothing has been charged. Pick the spot again.",
  "refusal.notFoundStay": "We couldn't find that booking any more. Nothing has been charged. Pick the room again.",
  "refusal.alreadyPaidSpot": "This spot is already paid for.",
  "refusal.alreadyPaidStay": "This stay is already paid for.",
  "refusal.notPayableSpot": "This spot can't be paid from your phone right now. Nothing has been charged.",
  "refusal.notPayableStay": "This stay can't be paid from your phone right now. Nothing has been charged.",
  "refusal.notYourWallet": "This spot is held for another wallet. Nothing has been charged.",
  "refusal.noPaymentOpen": "The payment for this stay isn't open yet. Nothing has been charged. Try again.",
  "refusal.notPending": "Your phone already answered this one.",
  "refusal.notBuilt": "Your phone has to prepare the payment again. Nothing has been charged.",
  "refusal.mismatch": "Your phone's approval didn't match this payment, so it was not sent. Nothing has been charged.",
  "refusal.holdExpired": "The hold on this spot ran out. Nothing has been charged. Pick the spot again.",
  "refusal.spaceClosed": "That listing has closed. Nothing has been charged.",
  "refusal.unavailable": "Payments are briefly unavailable. Nothing has been charged. Try again in a moment.",
  "refusal.noRoute": "We couldn't find a way to move this payment right now. Nothing has been charged. Try again in a moment.",
  "refusal.rateLimited": "Too many tries in a row. Nothing has been charged. Wait a minute and try again.",
  "refusal.network": "We couldn't reach HOLD. Nothing has been charged. Check your connection and try again.",
  "refusal.defaultSpot": "We couldn't ask your phone to approve this spot. Nothing has been charged. Try again.",
  "refusal.defaultStay": "We couldn't ask your phone to approve this stay. Nothing has been charged. Try again.",
  "refusal.linkFirst": "Link your phone to pay from here. Nothing has been charged.",
  "refusal.approveOnPhone": "Your phone is linked: approve it in the HOLD app. Nothing has been charged.",
  "refusal.noWalletGetApp": "This account has no wallet to pay from yet. Get the HOLD app to make one. Nothing has been charged.",
  "pay.bodyComputerKeys": "Your wallet's keys stay on your phone. Link it once, and the HOLD app approves and signs every payment you start here. Until then, nothing can be paid from here.",
  "pay.bodyThisPhone": "Link this phone once, and the HOLD app approves and signs every payment you start here. Until then, nothing can be paid from here.",
  "getOnAppStore": "Get HOLD on the App Store",
  "waiting.scanAnyPhone": "Your linked phone approves and signs, in the HOLD app, every payment you start on the web. Scan this code with your phone's camera, or from the HOLD app.",
  "waiting.opensOnPhone": "HOLD opens on your iPhone or Android phone and shows a six-digit code. No HOLD yet? The code shows where to get it.",
} satisfies Record<string, string>;

export default link;

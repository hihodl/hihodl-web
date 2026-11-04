/**
 * English: the source of the "requests" namespace. Payment requests between
 * two people on HOLD: the bubble in a thread, its confirms, Request in Quick
 * Send, closing a request once it is paid, and the request errors
 * (lib/app/request-rules.ts). Keys are flat, dotted, camelCase.
 *
 * WHO ASKS, WHO PAYS: the requester asks, the payer pays. "They" in a
 * message is always the other person in the thread.
 */
const requests = {
  /* The bubble in a thread (payments/Chat.tsx) */
  "tag.requested": "Requested",
  "tag.paid": "Paid",
  "tag.declined": "Declined",
  "tag.cancelled": "Cancelled",
  pay: "Pay",
  decline: "Decline",
  remind: "Remind",
  cancel: "Cancel",
  reminded: "Reminded. They got a friendly nudge.",
  payInApp: "This one is on {chain}. Pay it in the HOLD app.",
  oneMoment: "One moment…",

  /* Decline and Cancel ask first */
  keep: "Keep it",
  declineTitle: "Decline this request?",
  declineBody: "{name} will see that you declined it.",
  declineIt: "Decline",
  cancelTitle: "Cancel this request?",
  cancelBody: "{name} won't be able to pay it any more.",
  cancelIt: "Cancel request",

  /* Request in Quick Send (payments/PaymentsScreen.tsx, wallet/QuickSend.tsx) */
  cta: "Request",
  requesting: "Requesting…",
  requestingFrom: "Requesting from {name}",

  /* Paying one, on the payment's result (wallet/Withdraw.tsx) */
  payingRequest: "Paying {name}'s request",
  "settle.pending": "Marking their request as paid…",
  "settle.done": "Their request is marked as paid.",
  "settle.closed": "Their request was already closed.",
  "settle.shortBy": "Your payment covered {amount} of what they asked, so their request stays open.",
  "settle.short": "Your payment covered less than they asked, so their request stays open.",
  "settle.unknown": "HOLD couldn't put a value on what you paid in, so their request stays open. They can see your payment in your conversation.",
  "settle.unproven": "We couldn't match this payment to their request, so it stays open. They can still see your payment in your conversation.",

  /* The Payments list: a request can be the first thing between two people */
  "inbox.youRequested": "Requested {amount}",
  "inbox.theyAsked": "Asked you for {amount}",

  /* Remind, once a day */
  "remind.tomorrow": "You already reminded them today. You can remind them again tomorrow.",
  "remind.at": "You already reminded them. You can remind them again at {time}.",
  "remind.tomorrowAt": "You already reminded them. You can remind them again tomorrow at {time}.",
  "remind.on": "You already reminded them. You can remind them again on {date} at {time}.",

  /* What went wrong, in words (lib/app/request-rules.ts) */
  "error.needsHoldUser": "You can only ask someone who is on HOLD.",
  "error.toSelf": "You can't ask yourself for money.",
  "error.invalidAmount": "Type an amount above zero.",
  "error.tooManyOpen": "You already have 3 open requests with them. Wait for one to be paid, or cancel one.",
  "error.rateLimited": "You've sent a lot of requests today. Try again tomorrow.",
  "error.notOpen": "This request isn't open any more.",
  "error.proofRequired": "We couldn't match your payment to this request.",
  "error.amountUnknown": "We couldn't value the token you paid in, so the request stays open.",
  "error.offline": "We could not reach HOLD. Check your connection and try again.",
  "error.notFound": "No one on HOLD goes by that name.",
  "error.sessionEnded": "Your session ended. Sign in again.",
  "error.tooMany": "Too many at once. Wait a moment and try again.",
  "error.generic": "That did not go through. Try again.",
} satisfies Record<string, string>;

export default requests;

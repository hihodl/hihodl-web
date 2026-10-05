/** English: the source of the "enquiries" namespace. Ask about a spot, the guest thread, and the business seller mark. */
const enquiries = {
  /* ── Buttons on the page ── */
  "ask.spot": "Ask about this spot",
  "ask.seller": "Ask the seller",
  "ask.panelTitle": "Questions before you buy?",
  "ask.panelBody": "Ask {seller} about sizes, timing, artwork or a bundle of spots. They answer you directly.",
  "ask.yours": "{count, plural, one {Your conversation here} other {Your conversations here}}",
  "ask.whole": "The whole space",

  /* ── The sheet ── */
  "sheet.eyebrow": "Ask the seller",
  "sheet.about": "About",
  "sheet.name": "Your name",
  "sheet.namePlaceholder": "Dana Lee",
  "sheet.company": "Company",
  "sheet.companyPlaceholder": "Acme Labs",
  "sheet.email": "Email",
  "sheet.emailPlaceholder": "you@company.com",
  "sheet.emailHint": "When {seller} replies, we email you a link to the conversation.",
  "sheet.message": "Your question",
  "sheet.messagePlaceholder": "What you want to know, your dates, your budget.",
  "sheet.send": "Send question",
  "sheet.sending": "Sending",
  "sheet.inApp": "You're signed in to HOLD, so this goes straight to your HOLD chat with {seller}.",
  "sheet.teamReads": "The team at {seller} can read this conversation.",

  /* ── Problems before sending ── */
  "problem.name": "Add your name.",
  "problem.nameMax": "Keep your name to {max} characters.",
  "problem.companyMax": "Keep the company name to {max} characters.",
  "problem.email": "That email doesn't look right. Use a full address, like you@company.com.",
  "problem.message": "Write your question.",
  "problem.messageMax": "Keep it to {max} characters.",

  /* ── What the server answered ── */
  "error.notFound": "This space isn't on HOLD any more. Refresh the page.",
  "error.positionNotFound": "That spot isn't on this space any more. Pick another one, or ask about the whole space.",
  "error.notTaking": "This space has closed, so it doesn't take questions any more.",
  "error.nameInvalid": "That name can't be used. Write your own name, up to {max} characters.",
  "error.companyInvalid": "That company name can't be used. Up to {max} characters, or leave it empty.",
  "error.messageInvalid": "The question can't be sent: write something, up to {max} characters.",
  "error.ownSpace": "This is your own space, so there's nobody to ask.",
  "error.rateLimited": "That's a lot of messages in a short time. Wait a little, then send it again.",
  "error.network": "We couldn't reach HOLD. Check your connection and send it again.",
  "error.checkFields": "Something in the form didn't go through. Check each field and send it again.",
  "error.generic": "That didn't go through. Send it again in a moment.",
  "error.signedOut": "Your HOLD session ended. Fill in your details and we'll start the conversation here.",

  /* ── After sending ── */
  "sent.title": "Question sent",
  "sent.body": "{seller} has it now. When they reply, we email you a link to read it and answer.",
  "sent.keep": "This is your conversation link. It opens the thread in any browser, so keep it to yourself.",
  "sent.open": "Open the conversation",
  "sent.copy": "Copy link",
  "sent.inAppTitle": "Sent to your HOLD chat",
  "sent.inAppBody": "The conversation with {seller} continues in HOLD, in Payments. Their reply lands there.",
  "sent.openInApp": "Open in HOLD",

  /* ── The thread page ── */
  "thread.eyebrow": "Your conversation",
  "thread.with": "With {seller}",
  "thread.about": "About {what}",
  "thread.you": "You",
  "thread.sentBy": "Sent by {name}",
  "thread.waiting": "{seller} hasn't replied yet. We email you when they do.",
  "thread.reply": "Your reply",
  "thread.replyPlaceholder": "Write to {seller}",
  "thread.send": "Send",
  "thread.seeSpace": "See the space",
  "thread.keep": "Keep this link to yourself: anyone who has it can read and write in this conversation.",
  "thread.missingTitle": "This conversation link doesn't work.",
  "thread.missingBody":
    "Check that you copied all of it. It's the link the page gave you when you asked, or the one in the email from HOLD when the seller replied.",
  "thread.unreachableTitle": "We couldn't load this conversation just now.",
  "thread.unreachableBody": "This is on our side, not your link. Give it a moment and refresh the page.",
  "thread.gone": "This conversation isn't available any more.",
  "thread.expiredTitle": "This link has expired.",
  "thread.expiredBody": "A link stops working after 90 days without a message. When {seller} replies, we email you a fresh one and the conversation picks up right here.",
  "thread.expiredBodyPlain": "A link stops working after 90 days without a message. When the seller replies, we email you a fresh one and the conversation picks up right here.",

  /* ── A company selling on HOLD ── */
  "business.verified": "Verified business",
  "business.verifiedAbout": "HOLD checked that this account belongs to {name}.",
} as const;

export default enquiries;

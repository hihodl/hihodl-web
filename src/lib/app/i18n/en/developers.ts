/**
 * English: the "developers" namespace. Settings › Developers (API keys,
 * webhooks, the quickstart) and a pay link's "Button for your site".
 * Translations come later; until then every language reads these in English.
 */
const developers = {
  "title": "Developers",
  "menuRow": "Developers",
  "menuRowSub": "API keys, webhooks and checkout",
  "intro": "Take payments on your own site. Your server makes a checkout, your buyer pays on HOLD, and the money lands in your wallet.",
  "comingSoon": "Coming soon.",
  "loadFailed": "Couldn't load this. Try again.",
  "tryAgain": "Try again",

  // API keys
  "keys.title": "API keys",
  "keys.empty": "No keys yet.",
  "keys.name": "Name",
  "keys.namePlaceholder": "My store",
  "keys.live": "Live",
  "keys.test": "Test",
  "keys.create": "Create key",
  "keys.creating": "Creating…",
  "keys.secretTitle": "Your new {mode} key",
  "keys.secretBody": "Copy it now. It is shown only once.",
  "keys.copy": "Copy",
  "keys.copied": "Copied",
  "keys.done": "Done",
  "keys.revoke": "Revoke",
  "keys.revokeConfirm": "Revoke {name}? Requests with it stop working.",
  "keys.revoking": "Revoking…",
  "keys.keep": "Keep",
  "keys.created": "Created {date}",
  "keys.lastUsed": "Last used {date}",
  "keys.failed": "That didn't work. Try again.",

  // Webhooks
  "hooks.title": "Webhook endpoints",
  "hooks.body": "We POST every checkout event (checkout.paid, checkout.failed, checkout.expired) to your URL, signed with HOLD-Signature.",
  "hooks.empty": "No endpoints yet.",
  "hooks.url": "Endpoint URL",
  "hooks.urlPlaceholder": "https://example.com/hold/webhook",
  "hooks.badUrl": "Use an https URL.",
  "hooks.add": "Add endpoint",
  "hooks.adding": "Adding…",
  "hooks.secretTitle": "Signing secret",
  "hooks.secretBody": "Copy it now. It is shown only once. Use it to check HOLD-Signature.",
  "hooks.delete": "Delete",
  "hooks.deleteConfirm": "Delete this endpoint? Events stop going to it.",
  "hooks.deleting": "Deleting…",
  "hooks.deliveries": "Recent deliveries",
  "hooks.hideDeliveries": "Hide deliveries",
  "hooks.noDeliveries": "Nothing sent yet.",
  "hooks.resend": "Resend",
  "hooks.resending": "Sending…",
  "hooks.resent": "Sent again",
  "hooks.delivered": "Delivered",
  "hooks.failedStatus": "Failed",
  "hooks.pending": "Pending",

  // Quickstart
  "quick.title": "Quickstart",
  "quick.create": "1. Create a checkout from your server",
  "quick.createBody": "Send the buyer to the url it returns. After paying they come back to successUrl with checkout_id and status.",
  "quick.verify": "2. Check each webhook in Node",
  "quick.verifyBody": "Compute the HMAC over the raw body, compare in constant time, and refuse anything older than five minutes.",

  // A pay link's button for a website
  "button.title": "Button for your site",
  "button.body": "Paste it into Carrd, Notion, Webflow, Linktree or any page. Buyers pay you in one tap.",
  "button.labelHold": "Pay with HOLD",
  "button.labelTitle": "Link title",
  "button.html": "HTML",
  "button.script": "Script",
  "button.htmlNote": "Opens your pay page in a new tab.",
  "button.scriptNote": "Opens your pay page in a popup on a computer, a new tab on a phone.",
  "button.preview": "Preview",
  "button.copy": "Copy code",
  "button.copied": "Copied",
} as const;

export default developers;

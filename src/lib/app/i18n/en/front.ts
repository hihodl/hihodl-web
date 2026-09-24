/** English: the source of the "front" namespace. Keys are flat, dotted, camelCase. */
const front = {
  // Shared by the step screens
  "saving": "Saving...",
  "sending": "Sending...",
  "creating": "Creating...",
  "notNow": "Not now",
  "step.about": "About {title}",
  "step.dismiss": "Dismiss",
  "step.skip": "Skip",

  // The auth callback
  "callback.notSetUp": "Sign-in is not set up on this deployment.",
  "callback.cancelled": "You closed the sign-in before it finished. Nothing changed.",
  "callback.failed": "That sign-in did not go through. It can happen when the page was opened in another browser. Try again from here.",
  "callback.backToSignIn": "Back to sign in",
  "callback.completing": "Completing sign in...",

  // The door: welcome and welcome back
  "door.signedOutElsewhere": "This browser was signed out from another device",
  "door.continueWith": "Continue with",
  "door.continueWithProvider": "Continue with {provider}",
  "door.opening": "Opening…",
  "door.email": "Email",
  "door.consent": "By continuing you agree to the <terms>Terms</terms> and <privacy>Privacy Policy</privacy>.",
  "door.tagline": "Your money, your rules",
  "door.letsGo": "Let's go",
  "door.emailMeACode": "Email me a code",
  "door.welcomeBack": "Welcome Back",
  "door.welcomeBackName": "Welcome Back, {name}",
  "door.otherWays": "Other ways to sign in",
  "door.notYou": "Not you?",

  // Email sign-in
  "email.title": "Continue with\nemail",
  "email.info": "Your email is used to create your HOLD account and for account recovery.",
  "email.invalid": "That does not look like an email address. Check it and try again.",
  "email.sendFailed": "We could not send that code. Try again.",
  "email.codeExpired": "That code has expired or is not the one we sent. Ask for a new one.",
  "email.verifyFailed": "We could not check that code. Try again.",
  "email.verifyTitle": "Verify your\nemail",
  "email.changeEmail": "Change email",
  "email.checkInbox": "Check your inbox",
  "email.sentTo": "We sent a code to <b>{email}</b>.",
  "email.codePlaceholder": "6-digit code",
  "email.codeLabel": "Code from the email",
  "email.checking": "Checking...",
  "email.resendIn": "Resend in {seconds}s",
  "email.resend": "Resend email",
  "email.addressLabel": "Email address",
  "email.code": "Code",

  // Onboarding steps
  "steps.username": "Username",
  "steps.usernameInfo": "Your unique @handle for receiving payments and being found by friends on HOLD.",
  "steps.profile": "Profile",
  "steps.profileInfo": "Your name and photo, shown to the people you pay and sell to. Both are optional.",
  "steps.passkey": "Passkey",
  "steps.passkeyInfo": "A secure key stored on your device. Uses Face ID or fingerprint to verify your identity — no passwords needed.",
  "steps.recovery": "Recovery Key",
  "steps.recoveryInfo": "We'll send 8 recovery codes to your email. These codes are the ONLY way to recover your account if you lose access to Google or Apple. Save them somewhere safe — each code works only once.",
  "steps.link": "Link your phone",

  // The onboarding flow
  "flow.title": "Protect\nyour wallet",
  "flow.incomplete": "Setup incomplete",
  "flow.checkConnection": "Check your connection and try again.",
  "flow.skipForNow": "Skip for now",
  "flow.slow": "Connection seems slow. Hang on…",

  "username.checking": "Checking...",
  "username.available": "Available",
  "username.connectionError": "Connection error",
  "username.notAvailable": "Not available",
  "username.rateLimited": "You changed your username recently. Try again later.",
  "username.placeholder": "username",

  "profile.photoFailed": "That photo could not be used. Try another, or skip it for now.",
  "profile.choosePhoto": "Choose another photo",
  "profile.addPhoto": "Add a photo",
  "profile.name": "Your name",

  "passkey.set": "Your passkey is set.",
  "passkey.desc": "Uses Face ID or fingerprint — no passwords needed.",
  "passkey.create": "Create Passkey",

  "recovery.sendFailed": "Failed to send recovery codes. Please check your email and try again.",
  "recovery.emailLabel": "Email for your recovery codes",
  "recovery.sent": "Sent",

  // The compact sign-in form (a team invitation)
  "signIn.providerFailed": "We could not open {provider} sign-in. Try again, or use your email.",
  "signIn.title": "Sign in to HOLD",
  "signIn.newHere": "New here? The same step makes your account.",
  "signIn.orEmail": "or with your email",
  "signIn.signIn": "Sign in",
  "signIn.sentTo": "We sent a code to <b>{email}</b>",
  "signIn.checking": "Checking…",
  "signIn.sending": "Sending…",
  "signIn.anotherEmail": "Use another email",
  "signIn.newCode": "Send a new code",
  "steps.linkInfoEvery": "Your linked phone, iPhone or Android, approves and signs in the HOLD app every payment you start on the web. Until one is linked, nothing can be paid from the web. You can link one later from Menu, Security.",
} satisfies Record<string, string>;

export default front;

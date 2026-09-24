/** English: the source of the "wallet" namespace. Keys are flat, dotted, camelCase. */
const wallet = {
  /* The screen */
  "screen.title": "Wallet",
  confirmWithPasskey: "Confirm with passkey",

  /* A web wallet kept under an older account */
  "anotherAccount.title": "Your wallet is on your previous account",
  "anotherAccount.body":
    "This email already has a web wallet, made under an earlier HOLD account, and the web never makes a second one. Write to support from this email and we will move you back to that account.",

  /* A wallet made in the app */
  "appWallet.linkedNote": "This wallet was made in the HOLD app. Your linked phone approves and signs every payment you start here.",
  "appWallet.linkFirstNote": "This wallet was made in the HOLD app, and its keys stay on your phone. Link the phone once to pay from here.",
  "appWallet.appOnlyNote": "This wallet was made in the HOLD app, which keeps its keys. Send and swap there.",
  "appWallet.openHold": "Open HOLD",

  /* No wallet, and the web does not make one yet */
  "noWallet.iosTitle": "No wallet yet",
  "noWallet.iosBody": "Making a wallet on the web is not open for this account yet. Nothing is lost: when it opens, it is made here with your passkey.",
  "noWallet.title": "Make your wallet in the HOLD app",
  "noWallet.body": "The HOLD app on Google Play makes your wallet with every chain. Sign in there with this account, and it shows here too.",
  "noWallet.getOnPlay": "Get HOLD on Google Play",

  /* Create */
  "create.readyTitle": "Your wallet is ready",
  "create.readyAddress": "Your Solana address:",
  "create.openWallet": "Open wallet",
  "create.readyNote": "Write down your 12 words from Security. They are the only way back if every passkey is lost.",
  "create.sealingTitle": "Creating your wallet",
  "create.sealingBody": "Making it in this browser and sealing it with your passkey.",
  "create.confirmTitle": "Confirm your new passkey",
  "create.confirmBody": "Once more, so it can seal your wallet.",
  "create.title": "Create your wallet",
  "create.body": "A Solana wallet for USDC and SOL, locked by a passkey: Face ID, Touch ID or your device PIN.",
  "create.newPasskey": "Create with a new passkey",
  "create.existingPasskey": "Use a passkey I already have",

  /* Unlock */
  "unlock.welcome": "Welcome Back, {name}",
  "unlock.button": "Unlock with passkey",

  /* Home */
  "home.fallbackName": "you",
  "home.lock": "Lock",
  "home.security": "Security",
  "home.networkFees": "Network fees",

  /* Security (Account recovery) */
  "security.title": "Account recovery",
  "security.heroTitle": "Your safety net",
  "security.heroBody":
    "HOLD is non-custodial — we cannot recover your funds if you lose access. Keep at least one backup factor active and stored somewhere safe.",
  "security.backupFactors": "Backup factors",
  "security.recoveryPhrase": "Recovery phrase",
  "security.passkeys": "Passkeys",

  /* Passkeys */
  "passkeys.title": "Passkeys",
  "passkeys.all": "All passkeys",
  "passkeys.defaultName": "Passkey {n}",
  "passkeys.added": "Added {date}",
  "passkeys.removeAria": "Remove {name}",
  "passkeys.removeConfirm": "Remove {name}? It won't open this wallet anymore. You can add it back any time from this screen.",
  "passkeys.add": "Add a passkey",
  "passkeys.lastNote": "Removing the last passkey is not allowed. To replace it, add a new one first, then remove the old.",

  /* Recovery Phrase */
  "export.title": "Recovery Phrase",
  "export.warning": "Never share your recovery phrase with anyone. Anyone with access to these words can control your wallet.",
  "export.hide": "I wrote them down, hide them",
  "export.paperNote": "Write them on paper, in order. They are never copied to your clipboard.",
  "export.heroTitle": "Recovery phrase",
  "export.heroBody": "Your 12 words open this wallet anywhere. Show them only where nobody can see your screen.",

  /* Add a passkey */
  "add.title": "Add passkey",
  "add.done": "That passkey now opens your wallet too.",
  "add.heroTitle": "Add a passkey",
  "add.heroBody": "One in another password manager too means losing one of them does not lock you out.",
  "add.stepCurrent": "Confirm with a passkey that opens your wallet",
  "add.stepCreate": "Create the new passkey",
  "add.stepConfirm": "Confirm the new passkey",
  "add.createNew": "Create new passkey",
  "add.confirmNew": "Confirm new passkey",

  /* Send (Withdraw) */
  "send.recipientGets": "Recipient gets",
  "send.recipientWallet": "Recipient wallet",
  "send.youSend": "You send",
  "send.networkFee": "Network fee",
  "send.free": "Free",
  "send.max": "MAX",
  "send.deleteKey": "Delete",
  "send.notSolanaEvm": "That is not a Solana address. Only Solana is supported.",
  "send.notSolana": "That is not a valid Solana address.",
  "send.pasteAddress": "Paste wallet address",
  "send.recipientAddressAria": "Recipient wallet address",
  "send.detected": "Detected",
  "send.walletRow": "Wallet · {address}",
  "send.emptyHint": "A Solana address, for USDC or SOL.",
  "send.mostYouCanSend": "Most you can send is {amount}",
  "send.available": "Available: {amount}",
  "send.confirmTitle": "Confirm payment",
  "send.preparing": "Preparing…",
  "send.cancelling": "Cancelling…",
  "send.openHold": "Open HOLD",
  "send.phoneNote":
    "A notification in the HOLD app on your phone asks you to approve it. No notification? Open HOLD and go to Withdrawals. It expires in <n>{left}</n>.",
  "send.waitingPasskey": "Waiting for your passkey…",
  "send.approveWithPasskey": "Approve with passkey",
  "send.passkeyNote": "Your passkey approves exactly this payment and signs it, in one step. Expires in <n>{left}</n>.",
  "send.sendingPayment": "Sending payment",
  "send.resultTo": "To {to} • {amount}",
  "send.seeOnSolscan": "See it on Solscan",
  "send.onPhone.pending": "Approve on your phone",
  "send.onPhone.approved": "Approved on your phone. Sending…",
  "send.onPhone.submitted": "Approved. Sending…",
  "send.next.phone": "A payment cannot be undone. Your linked phone approves and signs it next, in the HOLD app.",
  "send.next.passkey": "A payment cannot be undone. You approve it with your passkey next.",
  "send.next.unknown": "A payment cannot be undone. You approve it in the next step.",
  "send.result.confirmedTitle": "Payment sent",
  "send.result.confirmedText": "Confirmed on Solana",
  "send.result.rejectedTitle": "Declined on your phone",
  "send.result.rejectedText": "Nothing was sent.",
  "send.result.expiredTitle": "Not approved in time",
  "send.result.expiredText": "It was not approved within ten minutes. Nothing was sent.",
  "send.result.failedTitle": "Payment failed",
  "send.result.failedText": "The network did not take it. Nothing left your wallet.",
  "send.cancelled": "Cancelled. Nothing was sent.",
  "send.alreadyDecided": "Your phone already decided on this one, so it can no longer be cancelled.",
  "send.stillPreparing": "Still preparing. Try again in a moment.",
  "send.error.needsApproval": "That withdrawal was not approved. Nothing was sent. Start again.",
  "send.error.expired": "That withdrawal expired. Nothing was sent. Start again.",
  "send.error.insufficient": "Your wallet does not hold enough for that. Nothing was sent.",
  "send.error.noPasskey": "This account has no passkey, and a passkey is what approves a send. Add one from Menu → Passkeys. Nothing was sent.",
  "send.error.noWebWallet": "This wallet was made in the HOLD app, which sends it for now. Nothing was sent.",
  "send.error.challengeMismatch": "HOLD asked the passkey to approve something other than this transfer, so we stopped. Nothing was sent.",
  "send.error.wrongKey": "That passkey opened a different wallet. Nothing was sent.",

  /* Receive */
  "receive.selectTitle": "Select crypto",
  "receive.selectHint": "Choose which crypto you want to receive.",
  "receive.noAddress": "There is no address to be paid on yet. Open your wallet once and it appears here.",
  "receive.tokenAria": "Receive {symbol}",
  "receive.copyUsername": "Copy username",
  "receive.qrTitle": "Your {symbol} address on {network}",
  "receive.notAvailable": "{network} isn't available yet",
  "receive.copyAddress": "Copy address",
  "receive.anotherNetwork": "Receiving on another network?",
  "receive.on": "Receive {symbol} on",
  "receive.pickNetwork": "Pick the network your sender is using.",
  "receive.onlySend": "Only send {symbol} on {network}.",
  "receive.mayLose": "Sending on another network may lose your funds.",

  /* What the flows say (lib/wallet/explain.ts) */
  "explain.lossWarning":
    "If you lose every passkey on this wallet and never exported your 12 words, the funds in it cannot be recovered by anyone, including us. Your HOLD account can be; the money cannot.",
  "explain.passkey.cancelled": "The passkey prompt was closed before it finished. Nothing was saved.",
  "explain.passkey.exists": "This device already has a passkey for your account. Use that one instead.",
  "explain.passkey.noPrf":
    "This passkey cannot protect a wallet: its password manager does not support the PRF extension. Nothing was saved, and a passkey just created for it was not added to your account (you can delete it from your password manager). Use Safari with iCloud Keychain (iOS 18.4 / macOS 15.4 or later) or Chrome with Google Password Manager.",
  "explain.passkey.noPrfHere":
    "This browser cannot protect a wallet with a passkey: it does not support the PRF extension. Nothing was created. Use Safari with iCloud Keychain (iOS 18.4 / macOS 15.4 or later) or Chrome with Google Password Manager, or make your wallet in the HOLD app.",
  "explain.passkey.osTooOld":
    "Update this device before making a wallet here. iOS 18.0 to 18.3 can hand back a different key depending on how you unlock, which would leave a wallet nobody can open — Apple fixed it in 18.4. Nothing was created. You can still sign in, and you can make your wallet in the HOLD app or on a device that is up to date.",
  "explain.passkey.unavailable": "Passkeys for HOLD only work on app.hihodl.xyz, in a browser that supports them.",
  "explain.passkey.failed": "The passkey did not answer. Try again.",
  "explain.crypto.decryptFailed": "That passkey did not open this wallet. Nothing was changed.",
  "explain.crypto.unreadable": "The wallet backup could not be read. Nothing was changed.",
  "explain.flow.unknownPasskey": "That passkey is not one that opens this wallet. Choose another.",
  "explain.flow.selfCheckFailed": "A safety check failed before anything was saved. Nothing was written. Try again.",
  "explain.flow.notSaved": "The wallet could not be saved. Try again.",
  "explain.api.appWalletExists": "This account already has a wallet in the HOLD app. Nothing was saved.",
  "explain.api.seedBackupExists": "This account already has a web wallet. Nothing was overwritten.",
  "explain.api.emailNotVerified": "Confirm your email address before creating a wallet.",
  "explain.api.notEnabled": "The web wallet is not available on your account yet. Nothing was saved.",
  "explain.api.lastWrapping": "This is the only passkey that opens your wallet. Add another first.",
  "explain.api.wrappingExists": "That passkey already opens your wallet.",
  "explain.api.rateLimited": "Too many attempts. Wait a few minutes and try again.",
  "explain.api.offline": "Could not reach HOLD. Check your connection and try again.",
  "explain.api.server": "Something went wrong on our side. Nothing was changed.",
  "explain.unknown": "Something went wrong. Nothing was changed.",
} satisfies Record<string, string>;

export default wallet;

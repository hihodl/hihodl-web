# @hihodl/connect

HOLD on a computer, as a Solana [Wallet Standard](https://github.com/wallet-standard/wallet-standard) wallet. A site adds one line; its Connect modal lists **HOLD**; the person approves the connection and every signature in the HOLD app on their phone. No key is ever in the page.

Spec: `documentation/hold-connect-v0.md`, "The fourth door".

## Add it

Next to your `WalletProvider`, once, in the browser:

```ts
import { registerHoldConnect } from "@hihodl/connect";

registerHoldConnect({ appName: "SP3ND" });
```

That is all. `@solana/wallet-adapter-react` (and anything on `@wallet-standard/app`) picks it up with nothing else to add. Call it on the client only (in Next.js, inside a `useEffect` or a `"use client"` module); on the server it does nothing.

Options:

| Option | Default | |
|---|---|---|
| `appName` | none | Shown small under your host on the connect screen. Who you are is your origin, as the browser reports it. |
| `connectUrl` | `https://app.hihodl.xyz/connect` | The popup. |
| `apiUrl` | `https://api.hihodl.xyz/api/v1` | The HOLD API. |

Inside the HOLD app's own browser, HOLD is already injected, so `registerHoldConnect` does not register a second one (it returns `null`).

## How it works

- **Connect** opens a 420×640 popup on app.hihodl.xyz (from the click, so it is never blocked), which reads your origin from the browser, signs the person in if needed, and asks their default phone. On approval your page receives a connect token bound to your origin, kept in `localStorage` under `hold-connect:v1`. `connect({ silent: true })` reuses it.
- **Signing** (`solana:signTransaction`, `solana:signAndSendTransaction`, `solana:signMessage`, legacy and v0 transactions) posts the bytes to the HOLD API with `Authorization: HoldConnect <token>` and polls until the phone answers (every 1.5 s for the first 30 s, then every 3 s, until the request's `expiresAt`). No popup.
- **Sign In With Solana** (`solana:signIn` 1.0.0) connects first when needed (the popup opens from the click), writes the SIWS message exactly as `@solana/wallet-standard-util`'s `createSignInMessageText` does (`domain` defaults to `window.location.host`, `address` is always the connected account), and sends it to the phone as a `signMessage`. It returns `[{ account, signedMessage, signature, signatureType: "ed25519" }]`, which `verifySignIn` from `@solana/wallet-standard-util` checks.
- **Disconnect** revokes the token on the server and forgets it here.

Errors carry a `code`: `4001` the person said no (or closed the window), `4100` not connected any more (the token was revoked or expired: connect again), `-32002` another request is already waiting on the phone, `-32603` anything else (including no answer in time). When the popup never got to talk to your page, the error also carries a `reason`:

- `POPUP_BLOCKED`: the browser blocked the window. Message: "Allow pop-ups for this site to connect HOLD". Call `connect()` (or `signIn()`) straight from the click handler, before any `await`.
- `POPUP_SEVERED`: see the next section.

## Cross-Origin-Opener-Policy

The popup and your page talk through `window.opener` and `postMessage`. If your site sends

```
Cross-Origin-Opener-Policy: same-origin
```

the browser puts the popup in a separate browsing context group: it has no opener, and your page cannot see it (it reads as closed at once, or never says ready). HOLD cannot connect. Send this instead on the pages that show your Connect button:

```
Cross-Origin-Opener-Policy: same-origin-allow-popups
```

(or no COOP header at all). The SDK detects the cut, when the window reads as closed within 2 s of opening or says nothing for 20 s, and rejects with `reason: "POPUP_SEVERED"` and a message that names the header.

Your site must be served over **https**: HOLD connects to no other origin.

## Publishing

The package is ready for npm (`@hihodl/connect`, ESM + CJS + types through `exports`, `sideEffects: false`, only `dist` and this README in the tarball) but keeps `"private": true` so nothing is published by accident. The one-line change is to delete `"private": true` from `package.json` (and set `license` once it is decided; it is `UNLICENSED` now). Then:

```sh
cd packages/hold-connect
npm run build
npm pack --dry-run          # check the tarball: dist/esm, dist/cjs, README.md, package.json
npm login                   # an account in the @hihodl org
npm publish --access public # scoped packages are private on npm unless told otherwise
```

## Build

```sh
npm run build        # dist/esm (with .d.ts) and dist/cjs
```

Zero runtime dependencies. `example/index.html` is a framework-free test page: build, serve this folder, open `/example/`.

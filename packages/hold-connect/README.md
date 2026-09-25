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
- **Signing** (`solana:signTransaction`, `solana:signAndSendTransaction`, `solana:signMessage`, legacy and v0 transactions) posts the bytes to the HOLD API with `Authorization: HoldConnect <token>` and polls until the phone answers. No popup.
- **Disconnect** revokes the token on the server and forgets it here.

Errors carry a `code`: `4001` the person said no (or closed the window), `4100` not connected any more (the token was revoked or expired: connect again), `-32002` another request is already waiting on the phone, `-32603` anything else (including no answer in time).

Your site must be served over **https**: HOLD connects to no other origin.

## Build

```sh
npm run build        # dist/esm (with .d.ts) and dist/cjs
```

Zero runtime dependencies. `example/index.html` is a framework-free test page: build, serve this folder, open `/example/`.

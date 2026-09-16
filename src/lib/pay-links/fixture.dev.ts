/**
 * Development fixture for pay links. Loaded only when `AD_SPACE_FIXTURE=1` and
 * NODE_ENV is not production (see `./server`).
 *
 * Codes follow the backend rule: 8 characters, no 0, 1, i, l or o.
 *
 *   /pay/k7x2m9qa   active, fixed $150, Solana and Base
 *   /pay/dana4pay   active, open amount up to $1,000, every chain, an owner named with no handle
 *   /pay/n2wnerxy   active, fixed $20, an owner with no name and no handle
 *   /pay/pa2dpa2d   single use, already paid
 *   /pay/c2sedxyz   closed by its owner
 *   /pay/exp2red9   expired
 *   /pay/dsab2ed3   disabled by us after reports (everything the owner wrote is null)
 *   /pay/r/fixture_receipt_base
 *   /pay/r/fixture_receipt_disabled (the link was disabled since: no title)
 */

import type { PayLinkPublic, PayReceipt } from "./types";

const OWNER = { displayName: "Dana Okafor", handle: "dana", label: "@dana" };
const PAY_TO = { solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", evm: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B" };

const LINKS: Record<string, PayLinkPublic> = {
  k7x2m9qa: {
    code: "k7x2m9qa",
    title: "Pitch deck review",
    note: "Two rounds of comments on your deck, delivered within five working days of payment.",
    amount: { mode: "fixed", cents: 15000 },
    chains: ["solana", "base"],
    status: "active",
    owner: OWNER,
    payTo: PAY_TO,
  },
  dana4pay: {
    code: "dana4pay",
    title: "Consulting, pay what we agreed",
    note: null,
    amount: { mode: "open", maxCents: 100000 },
    chains: ["solana", "base", "polygon"],
    status: "active",
    // A handle the text filter refused: the label falls back to the display name.
    owner: { displayName: "Dana Okafor", handle: null, label: "Dana Okafor" },
    payTo: PAY_TO,
  },
  n2wnerxy: {
    code: "n2wnerxy",
    title: "Coffee from the meetup",
    note: null,
    amount: { mode: "fixed", cents: 2000 },
    chains: ["base"],
    status: "active",
    owner: { displayName: null, handle: null, label: "the link owner" },
    payTo: PAY_TO,
  },
  pa2dpa2d: {
    code: "pa2dpa2d",
    title: "Logo design, first half",
    note: null,
    amount: { mode: "fixed", cents: 40000 },
    chains: ["base"],
    status: "paid",
    owner: OWNER,
    payTo: PAY_TO,
  },
  c2sedxyz: {
    code: "c2sedxyz",
    title: "Workshop seat",
    note: null,
    amount: { mode: "fixed", cents: 5000 },
    chains: ["solana"],
    status: "closed",
    owner: OWNER,
    payTo: PAY_TO,
  },
  exp2red9: {
    code: "exp2red9",
    title: "Translation, 2,000 words",
    note: null,
    amount: { mode: "fixed", cents: 12000 },
    chains: ["polygon"],
    status: "expired",
    owner: OWNER,
    payTo: PAY_TO,
  },
  dsab2ed3: {
    code: "dsab2ed3",
    title: null,
    note: null,
    amount: null,
    chains: [],
    status: "disabled",
    owner: null,
    payTo: null,
  },
};

export function fixturePayLink(code: string): PayLinkPublic | null {
  return LINKS[code] ?? null;
}

export function fixtureReceipt(token: string): PayReceipt | null {
  if (token !== "fixture_receipt_base" && token !== "fixture_receipt_disabled") return null;
  const disabled = token === "fixture_receipt_disabled";
  return {
    amountCents: 15000,
    chain: "base",
    txHash: "0x5c1d2f9b7e0a4c3d8e6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d",
    explorerUrl: disabled
      ? null
      : "https://basescan.org/tx/0x5c1d2f9b7e0a4c3d8e6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d",
    paidAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    payerAddress: "0x1111111111111111111111111111111111111111",
    link: { code: disabled ? "dsab2ed3" : "k7x2m9qa", title: disabled ? null : "Pitch deck review", owner: OWNER },
  };
}

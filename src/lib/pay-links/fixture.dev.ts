/**
 * Development fixture for pay links. Loaded only when `AD_SPACE_FIXTURE=1` and
 * NODE_ENV is not production (see `./server`).
 *
 *   /pay/k7x2m9qa   active, fixed $150, Solana and Base
 *   /pay/open4dana  active, open amount up to $1,000, every chain
 *   /pay/paid1234   single use, already paid
 *   /pay/closed12   closed by its owner
 *   /pay/expired1   expired
 *   /pay/disabled1  disabled by us after reports
 *   /pay/r/fixture_receipt_base
 */

import type { PayLinkPublic, PayReceipt } from "./types";

const OWNER = { displayName: "Dana Okafor", handle: "dana" };
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
  open4dana: {
    code: "open4dana",
    title: "Consulting, pay what we agreed",
    note: null,
    amount: { mode: "open", maxCents: 100000 },
    chains: ["solana", "base", "polygon"],
    status: "active",
    owner: OWNER,
    payTo: PAY_TO,
  },
  paid1234: {
    code: "paid1234",
    title: "Logo design, first half",
    note: null,
    amount: { mode: "fixed", cents: 40000 },
    chains: ["base"],
    status: "paid",
    owner: OWNER,
    payTo: PAY_TO,
  },
  closed12: {
    code: "closed12",
    title: "Workshop seat",
    note: null,
    amount: { mode: "fixed", cents: 5000 },
    chains: ["solana"],
    status: "closed",
    owner: OWNER,
    payTo: PAY_TO,
  },
  expired1: {
    code: "expired1",
    title: "Translation, 2,000 words",
    note: null,
    amount: { mode: "fixed", cents: 12000 },
    chains: ["polygon"],
    status: "expired",
    owner: OWNER,
    payTo: PAY_TO,
  },
  disabled1: {
    code: "disabled1",
    title: "Something we took down",
    note: null,
    amount: { mode: "fixed", cents: 9900 },
    chains: ["solana"],
    status: "disabled",
    owner: OWNER,
    payTo: PAY_TO,
  },
};

export function fixturePayLink(code: string): PayLinkPublic | null {
  return LINKS[code] ?? null;
}

export function fixtureReceipt(token: string): PayReceipt | null {
  if (token !== "fixture_receipt_base") return null;
  return {
    amountCents: 15000,
    chain: "base",
    txHash: "0x5c1d2f9b7e0a4c3d8e6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d",
    explorerUrl: null,
    paidAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    payerAddress: "0x1111111111111111111111111111111111111111",
    link: { code: "k7x2m9qa", title: "Pitch deck review", owner: OWNER },
  };
}

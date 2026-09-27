/**
 * Development fixture for pay links. Loaded only when `AD_SPACE_FIXTURE=1` and
 * NODE_ENV is not production (see `./server`).
 *
 * Codes follow the backend rule: 8 characters, no 0, 1, i, l or o.
 *
 *   /pay/k7x2m9qa   active, fixed $150, Solana and Base
 *   /pay/dana4pay   active, open amount up to $1,000, every chain, an owner named with no handle,
 *                   bank transfer in EUR and USD (made-up account numbers)
 *   /pay/n2wnerxy   active, fixed $20, an owner with no name and no handle
 *   /pay/pa2dpa2d   single use, already paid (sends on to @demo, nothing carried)
 *   /pay/c2sedxyz   closed by its owner (sends on to @demo with $50 and its title)
 *   /pay/exp2red9   expired (no personal link: nowhere to send on)
 *   /pay/fr2zenpy   frozen, no ways to pay (sends on to @demo_creator with $75 and its title)
 *   /pay/dsab2ed3   disabled by us after reports (everything the owner wrote is null)
 *   /pay/@demo      a personal link: open amount, a verified private profile (initials), card, Apple Pay and Google Pay, USDC and EURC
 *   /pay/@demo_creator  the same, with a public profile photo
 *   /pay/r/fixture_receipt_base
 *   /pay/r/fixture_receipt_disabled (the link was disabled since: no title)
 */

import type { PayLinkCardOffer, PayLinkPublic, PayReceipt } from "./types";

const OWNER = { displayName: "Dana Okafor", handle: "dana", label: "@dana" };
const PAY_TO = { solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", evm: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B" };

const CARD: PayLinkCardOffer = {
  methods: ["card", "applePay", "googlePay"],
  currencies: ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "MXN", "BRL", "COP", "PEN"],
  minUsdCents: 100,
  maxUsdCents: 50_000,
};

/** Personal links by handle. Made-up people only: never a real person's handle. */
const PERSONAL: Record<string, PayLinkPublic> = {
  demo: {
    code: "demapays",
    personal: true,
    title: "Pay @demo",
    note: null,
    amount: { mode: "open", maxCents: null },
    chains: ["solana", "base", "polygon"],
    status: "active",
    // A private profile: no photo, so the page draws the initials.
    owner: { displayName: "Demo C.", handle: "demo", label: "@demo", face: { avatarUrl: null }, verified: true },
    payTo: PAY_TO,
    card: CARD,
    tokens: ["usdc", "eurc"],
  },
  demo_creator: {
    code: "demcrtr2",
    personal: true,
    title: "Pay @demo_creator",
    note: null,
    amount: { mode: "open", maxCents: null },
    chains: ["solana", "base"],
    status: "active",
    // The HOLD icon stands in for a photo: a picture of nobody.
    owner: {
      displayName: "Demo Creator",
      handle: "demo_creator",
      label: "@demo_creator",
      face: { avatarUrl: "https://hihodl.xyz/icon-512.png" },
    },
    payTo: PAY_TO,
    card: CARD,
  },
};

const DEMO = PERSONAL.demo.owner;

export function fixturePersonalPayLink(handle: string): PayLinkPublic | null {
  return PERSONAL[handle] ?? null;
}

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
    card: CARD,
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
    methods: [
      { kind: "hold" },
      { kind: "stablecoins" },
      { kind: "bank_transfer", currency: "EUR", payerMustBeBusiness: true },
      { kind: "bank_transfer", currency: "USD", payerMustBeBusiness: true },
    ],
    // Made-up numbers: the IBAN is the textbook example, the US ones are nobody's.
    bankTransfers: [
      {
        currency: "EUR",
        reference: "HOLD-DANA4PAY",
        payerMustBeBusiness: true,
        account: { iban: "DE89370400440532013000", bic: "COBADEFFXXX", holderName: "Dana Okafor" },
      },
      {
        currency: "USD",
        reference: "HOLD-DANA4PAY",
        payerMustBeBusiness: true,
        account: { accountNumber: "000123456789", routingNumber: "000000000", holderName: "Dana Okafor", rails: ["ach", "wire"] },
      },
    ],
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
    owner: DEMO,
    payTo: PAY_TO,
    fallback: { handle: "demo", path: "/pay/@demo" },
  },
  c2sedxyz: {
    code: "c2sedxyz",
    title: "Workshop seat",
    note: null,
    amount: { mode: "fixed", cents: 5000 },
    chains: ["solana"],
    status: "closed",
    owner: DEMO,
    payTo: PAY_TO,
    fallback: { handle: "demo", path: "/pay/@demo" },
  },
  fr2zenpy: {
    code: "fr2zenpy",
    title: "Sponsored post, one week",
    note: null,
    amount: { mode: "fixed", cents: 7500 },
    chains: ["solana", "base"],
    status: "frozen",
    owner: PERSONAL.demo_creator.owner,
    payTo: null,
    methods: [],
    fallback: { handle: "demo_creator", path: "/pay/@demo_creator" },
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

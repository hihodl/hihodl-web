/**
 * Paying a pay link from the browser (pay-links-v0.md).
 *
 * Built on the HiSpace public checkout: the same `X-Checkout-Key` (made per
 * link and kept in localStorage), the same Solana Pay transaction request, the
 * same error envelope. What differs is that nothing here carries a fee: one
 * transfer on Solana, one ERC-3009 authorization on Base and Polygon.
 */

import type * as SolanaWeb3 from "@solana/web3.js";

import { API_BASE } from "@/lib/ad-space/config";
import { CHAIN_LABEL, usdFromCents } from "@/lib/ad-space/format";
import { CheckoutError, apiRequest, describeError } from "@/lib/ad-space/checkout-client";
import type { Chain } from "@/lib/ad-space/types";
import { PUBLIC_CHAINS } from "@/lib/orders/chains.public";

import type { PayConfirm, PayLinkCheckout, PayLinkOwner, PayLinkPayment, PayLinkPublic } from "./types";

const PUBLIC = `${API_BASE}/pay-links/public`;

/** The checkout-key scope for a link, so its key never collides with a HiSpace position's. */
export function payKeyScope(code: string): string {
  return `pay:${code}`;
}

/**
 * Codes that mean "this key is spent": make a new one and ask once more. A
 * pay-link key is bound to one link, chain and wallet (`checkout_key_reused`),
 * and to a payment that can still land (`payment_expired` once it can't).
 */
export const PAY_SPENT_KEY_CODES: ReadonlySet<string> = new Set(["checkout_key_reused", "payment_expired"]);

export function startPayCheckout(
  code: string,
  key: string,
  body: { chain: Chain; payerAddress: string; amountCents?: number },
): Promise<PayLinkCheckout> {
  return apiRequest(`${PUBLIC}/${encodeURIComponent(code)}/checkout`, { key, json: body });
}

/** A Solana signature, as the confirm route accepts it. */
const SOLANA_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

/**
 * Ask the server to settle a payment. The signature is only a courtesy (the
 * server reads the transaction it issued), so it is sent only when it is one.
 */
export function confirmPayment(paymentId: string, key: string, signature?: unknown): Promise<PayConfirm> {
  return apiRequest(`${PUBLIC}/payments/${encodeURIComponent(paymentId)}/confirm`, {
    key,
    json: typeof signature === "string" && SOLANA_SIGNATURE_RE.test(signature) ? { signature } : {},
  });
}

export function submitPayAuthorization(
  paymentId: string,
  key: string,
  signature: string,
): Promise<PayConfirm & { txHash?: string | null }> {
  return apiRequest(`${PUBLIC}/payments/${encodeURIComponent(paymentId)}/authorization`, {
    key,
    json: { signature },
  });
}

/** The payment bound to this key, if this page or a scanned QR has opened one. */
export async function currentPayment(key: string): Promise<PayLinkPayment | null> {
  const data = await apiRequest<{ payment: PayLinkPayment | null }>(`${PUBLIC}/checkout`, { key });
  return data.payment ?? null;
}

/**
 * The Solana Pay transaction-request link. An open amount travels in the URL
 * the wallet fetches, since the wallet posts only its account.
 */
export function payLinkSolanaPay(code: string, c: string, amountCents: number | null): string {
  const amount = amountCents !== null ? `&amountCents=${amountCents}` : "";
  const url = `${PUBLIC}/solana-pay/${encodeURIComponent(code)}?c=${c}${amount}`;
  return `solana:${encodeURIComponent(url)}`;
}

export async function reportPayLink(code: string, note: string): Promise<void> {
  await apiRequest(`${PUBLIC}/${encodeURIComponent(code)}/report`, {
    json: note ? { note } : {},
  });
}

/** Only the path of a receipt link is used, so it always opens on this site. */
export function receiptPath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const m = new URL(url, "https://hihodl.xyz").pathname.match(/^\/pay\/r\/([A-Za-z0-9_-]{16,128})\/?$/);
    return m ? `/pay/r/${m[1]}` : null;
  } catch {
    return null;
  }
}

/** Explorer link for a transaction, when the server gives none. */
export function explorerTxUrl(chain: Chain, tx: string): string {
  if (chain === "solana") return `https://solscan.io/tx/${encodeURIComponent(tx)}`;
  if (chain === "base") return `https://basescan.org/tx/${encodeURIComponent(tx)}`;
  return `https://polygonscan.com/tx/${encodeURIComponent(tx)}`;
}

/** The server's explorer link when it sends one (only https), else ours. Null with no transaction. */
export function paymentExplorerUrl(p: { chain: Chain; txHash: string | null; explorerUrl?: string | null }): string | null {
  if (p.explorerUrl && /^https:\/\//.test(p.explorerUrl)) return p.explorerUrl;
  return p.txHash ? explorerTxUrl(p.chain, p.txHash) : null;
}

/* ── Who is being paid ─────────────────────────────────────────────── */

type Owner = PayLinkOwner | null | undefined;

/**
 * The server's `label`, the name the payer's wallet also signs against ("Pay
 * @dana 150.00 USDC"). Without one, the same rule the server uses: "@dana",
 * else "Dana Okafor", else "the link owner". Never empty.
 */
export function ownerName(owner: Owner): string {
  const label = owner?.label?.trim();
  if (label) return label;
  if (owner?.handle) return `@${owner.handle}`;
  const name = owner?.displayName?.trim();
  if (name) return name;
  return "the link owner";
}

/**
 * "@dana on HOLD" when the owner has a handle, or null when there is none or
 * the name above already is that handle (never a bare "@", never it twice).
 */
export function ownerHandleLine(owner: Owner): string | null {
  if (!owner?.handle) return null;
  const handle = `@${owner.handle}`;
  return ownerName(owner) === handle ? null : `${handle} on HOLD`;
}

/* ── Payments this page sent ───────────────────────────────────────── */

const SENT_PREFIX = "hihodl:pay-links:sent:";

/**
 * Remember, for this tab, that this page handed a payment to a wallet that
 * sent it (or to our relayer). Only then does a reload show "confirming": a
 * quote nobody signed is not a payment on its way.
 */
export function markSentHere(paymentId: string): void {
  try {
    window.sessionStorage.setItem(SENT_PREFIX + paymentId, "1");
  } catch {
    // Without storage a reload simply doesn't resume; the server still settles it.
  }
}

export function sentHere(paymentId: string): boolean {
  try {
    return window.sessionStorage.getItem(SENT_PREFIX + paymentId) === "1";
  } catch {
    return false;
  }
}

/* ── Checking what we are about to sign ────────────────────────────── */

/** USDC has 6 decimals: one cent is 10,000 base units. */
const BASE_PER_CENT = 10_000n;

const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const MEMO_PROGRAMS = new Set(["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo"]);
/** SPL Token `TransferChecked`: tag 12, u64 amount, u8 decimals. */
const TRANSFER_CHECKED = 12;

function sameEvm(a: unknown, b: unknown): boolean {
  return typeof a === "string" && typeof b === "string" && a.length > 0 && a.toLowerCase() === b.toLowerCase();
}

function bigintOf(v: unknown): bigint | null {
  try {
    return typeof v === "string" || typeof v === "number" ? BigInt(v) : null;
  } catch {
    return null;
  }
}

export interface ExpectedPayment {
  cents: number;
  chain: Chain;
  payerAddress: string;
  payTo: PayLinkPublic["payTo"];
}

/**
 * Why a checkout answer is not the payment this page showed, or null when it
 * is. Checked before anything reaches the wallet: the amount, the network, the
 * payer, the receiver, and on Base and Polygon the token contract the
 * signature is valid for.
 */
export function evmCheckoutProblem(res: PayLinkCheckout, expect: ExpectedPayment): string | null {
  if (!("evm" in res)) return "shape";
  if (expect.chain === "solana") return "chain";
  const meta = PUBLIC_CHAINS[expect.chain];
  if (res.payment.amountCents !== expect.cents) return "amount";
  if (res.payment.chain !== expect.chain) return "chain";
  const evm = res.evm;
  if (evm.authorizations.length !== 1) return "authorizations";
  const m = evm.authorizations[0].message;
  const value = bigintOf(m.value);
  if (value === null || value !== BigInt(expect.cents) * BASE_PER_CENT) return "value";
  if (!expect.payTo?.evm || !sameEvm(m.to, expect.payTo.evm)) return "receiver";
  if (!sameEvm(m.from, expect.payerAddress)) return "payer";
  if (Number(evm.domain.chainId) !== meta.chainId || evm.chainId !== meta.chainId) return "chain_id";
  if (!sameEvm(evm.domain.verifyingContract, meta.usdc)) return "token";
  // A quote with under 30 seconds left can't be signed and relayed in time: ask for a new one.
  if (!Number.isFinite(evm.validBefore) || evm.validBefore * 1000 <= Date.now() + 30_000) return "expired";
  return null;
}

function associatedTokenAccount(web3: typeof SolanaWeb3, owner: string, mint: string): string | null {
  try {
    const [ata] = web3.PublicKey.findProgramAddressSync(
      [new web3.PublicKey(owner).toBytes(), new web3.PublicKey(TOKEN_PROGRAM).toBytes(), new web3.PublicKey(mint).toBytes()],
      new web3.PublicKey(ATA_PROGRAM),
    );
    return ata.toBase58();
  } catch {
    return null;
  }
}

/**
 * The same check for a Solana checkout: exactly one USDC `TransferChecked`
 * from the payer's USDC account to the receiver's, of exactly the amount, and
 * nothing else but the compute budget and the memo.
 */
export function solanaCheckoutProblem(web3: typeof SolanaWeb3, tx: SolanaWeb3.VersionedTransaction, res: PayLinkCheckout, expect: ExpectedPayment): string | null {
  if (!("solana" in res)) return "shape";
  if (res.payment.amountCents !== expect.cents) return "amount";
  if (res.payment.chain !== "solana") return "chain";
  if (res.payment.payerAddress !== expect.payerAddress) return "payer";
  const receiver = expect.payTo?.solana;
  if (!receiver) return "receiver";

  const msg = tx.message;
  if (msg.addressTableLookups.length > 0) return "lookups";
  const keys = msg.staticAccountKeys.map((k) => k.toBase58());
  const transfers: SolanaWeb3.MessageCompiledInstruction[] = [];
  for (const ix of msg.compiledInstructions) {
    const program = keys[ix.programIdIndex];
    if (program === COMPUTE_BUDGET_PROGRAM || (program && MEMO_PROGRAMS.has(program))) continue;
    if (program !== TOKEN_PROGRAM || ix.data[0] !== TRANSFER_CHECKED || ix.data.length !== 10) return "instruction";
    transfers.push(ix);
  }
  if (transfers.length !== 1) return "transfers";
  const ix = transfers[0];
  let amount = 0n;
  for (let i = 8; i >= 1; i--) amount = (amount << 8n) | BigInt(ix.data[i]);
  if (amount !== BigInt(expect.cents) * BASE_PER_CENT) return "value";
  const [source, mint, destination, authority] = ix.accountKeyIndexes.slice(0, 4).map((i) => keys[i]);
  if (mint !== SOLANA_USDC_MINT) return "token";
  if (authority !== expect.payerAddress) return "payer";
  if (source !== associatedTokenAccount(web3, expect.payerAddress, SOLANA_USDC_MINT)) return "source";
  if (destination !== associatedTokenAccount(web3, receiver, SOLANA_USDC_MINT)) return "receiver";
  return null;
}

/* ── Errors in plain words ─────────────────────────────────────────── */

/** Thrown when the server's answer twice did not match the page. Nothing was signed. */
export const MISMATCH_CODE = "checkout_mismatch";

/**
 * Pay-link codes in plain words, falling back to the HiSpace sentences for the
 * checkout codes the two routers share (a paused chain, a wallet that closed,
 * a transfer that would fail).
 */
export function describePayError(e: unknown, chain: Chain | null, limits?: { minCents: number; maxCents: number }): string {
  const net = chain ? CHAIN_LABEL[chain] : "this network";
  if (e instanceof CheckoutError) {
    switch (e.code) {
      case "link_not_active":
        return "This link can't take payments any more. It may have been paid, closed or expired. Nothing was paid.";
      case "link_busy":
        return "Someone else is paying this link right now. Try again in a couple of minutes.";
      case "amount_out_of_range":
        return limits
          ? `The amount has to be between ${usdFromCents(limits.minCents)} and ${usdFromCents(limits.maxCents)}.`
          : "That amount is outside what this link accepts.";
      case "chain_not_accepted":
        return `This link doesn't take payments on ${net}. Pick one of the other networks.`;
      case "receiver_not_ready":
        return `The person you're paying can't receive USDC on ${net} right now. Nothing was paid. Try another network, or tell them.`;
      case "insufficient_funds": {
        const need = typeof e.details.neededUsdc === "string" ? e.details.neededUsdc : null;
        const have = typeof e.details.balanceUsdc === "string" ? e.details.balanceUsdc : null;
        return need && have
          ? `This wallet has ${have} USDC on ${net} and this payment needs ${need}. Add USDC or pay from another wallet.`
          : `This wallet doesn't have enough USDC on ${net} for this payment. Add USDC or pay from another wallet.`;
      }
      case "rate_limited":
        return e.status === 503
          ? "Payments are paused for a moment on our side. Nothing was paid; try again in a minute."
          : "This link or this wallet has reached its limit of payments for now. Nothing was paid; try again later.";
      case "own_address":
        return "That wallet is the one this link pays. Pay from a different wallet.";
      case "invalid_address":
        return `Your wallet gave us an address we can't use on ${net}. Reconnect it and try again.`;
      case "bad_signature":
        return "That signature didn't match the payment, so we didn't send it. Nothing was paid.";
      case "payment_expired":
        return "That payment took too long to sign, so it can't be sent any more. Nothing was paid; start again.";
      case "checkout_key_reused":
        return "This payment was started with a different wallet or network. Nothing was paid; start again.";
      case "checkout_in_flight":
        return "This page is already starting a payment. Wait a moment and try again.";
      case "checkout_key_required":
      case "invalid_checkout":
      case "not_an_evm_payment":
        return "This payment couldn't be started from this page. Nothing was paid; refresh the page and try again.";
      case MISMATCH_CODE:
        return "The payment we were given didn't match what this page shows, so nothing was sent to your wallet. Nothing was paid; refresh the page and try again.";
      case "not_found":
        return "We can't find this link or payment any more. Refresh the page.";
    }
    // A request the server couldn't read, such as a code in the wrong shape.
    if (e.status === 400) return "We can't find this link or payment. Check the link and refresh the page.";
  }
  return describeError(e, chain);
}

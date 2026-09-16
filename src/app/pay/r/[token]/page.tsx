import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SlimHeader } from "@/components/ad-space/sections";
import { btnSmallSecondary, card, eyebrow } from "@/components/ad-space/ui";
import { CHAIN_LABEL, instantUtc, usdFromCents } from "@/lib/ad-space/format";
import { explorerTxUrl } from "@/lib/pay-links/client";
import { payPageMetadata } from "@/lib/pay-links/metadata";
import { getReceipt } from "@/lib/pay-links/server";

/**
 * /pay/r/<token> — the payer's receipt for one pay-link payment.
 *
 * The token is the only key to it: never cached, never indexed, disallowed in
 * robots.txt, and never sent on as a Referer (so opening the explorer does not
 * hand it the link).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = payPageMetadata("Receipt");

export default async function ReceiptPage({ params }: { params: { token: string } }) {
  const found = await getReceipt(params.token, headers());
  if (found.kind === "missing") notFound();

  return (
    <>
      <SlimHeader />
      <main className="container-page max-w-2xl py-10 md:py-16">
        {found.kind === "unreachable" ? (
          <div className="flex min-h-[50vh] flex-col justify-center">
            <p className={`${eyebrow} text-amber`}>Receipt</p>
            <h1 className="mt-5 font-display text-h3 font-light text-text md:text-h2">
              We couldn&rsquo;t load this receipt just now.
            </h1>
            <p className="mt-5 max-w-xl text-body text-text-muted">
              This is on our side, not your link. Give it a moment and refresh the page.
            </p>
          </div>
        ) : (
          (() => {
            const r = found.value;
            const explorer = r.explorerUrl ?? explorerTxUrl(r.chain, r.txHash);
            return (
              <section className={`${card} flex flex-col gap-5 p-5 md:p-6`} aria-label="Receipt">
                <div>
                  <p className={`${eyebrow} text-success`}>Paid</p>
                  <h1 className="mt-2 font-display text-h3 font-light text-text">
                    {usdFromCents(r.amountCents)} USDC
                  </h1>
                  <p className="mt-1 break-words text-small text-text-muted [overflow-wrap:anywhere]">
                    To {r.link.owner.displayName} (@{r.link.owner.handle} on HOLD) for &ldquo;{r.link.title}&rdquo;
                  </p>
                </div>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 border-t border-[color:var(--color-hairline)] pt-4 text-small">
                  <dt className="text-text-faint">Network</dt>
                  <dd className="text-text">USDC on {CHAIN_LABEL[r.chain]}</dd>
                  <dt className="text-text-faint">Paid</dt>
                  <dd className="text-text">
                    <time dateTime={r.paidAt}>{instantUtc(r.paidAt)}</time>
                  </dd>
                  <dt className="text-text-faint">From</dt>
                  <dd className="break-all font-mono text-tiny text-text">{r.payerAddress}</dd>
                  <dt className="text-text-faint">Transaction</dt>
                  <dd className="break-all font-mono text-tiny text-text">{r.txHash}</dd>
                </dl>
                <div>
                  <a href={explorer} target="_blank" rel="noopener noreferrer" className={btnSmallSecondary}>
                    View the transaction
                  </a>
                </div>
                <p className="text-tiny text-text-faint">
                  The payment went straight to the recipient&rsquo;s wallet. HOLD charged no fee, never held the money
                  and can&rsquo;t reverse it.
                </p>
              </section>
            );
          })()
        )}
      </main>
    </>
  );
}

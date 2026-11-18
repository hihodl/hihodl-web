import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Ion } from "@/components/app/ion";
import { OwnerFace } from "@/components/pay-links/pay-parts";
import { CopyId, SaveReceipt } from "@/components/pay-links/ReceiptActions";
import { Wordmark } from "@/components/site/Wordmark";
import { CHAIN_LABEL, instantUtc } from "@/lib/ad-space/format";
import type { Chain } from "@/lib/ad-space/types";
import { ownerName, paymentExplorerUrl } from "@/lib/pay-links/client";
import { payPageMetadata } from "@/lib/pay-links/metadata";
import { getReceipt } from "@/lib/pay-links/server";

/**
 * /pay/r/<token> — the payer's receipt for one pay-link payment, drawn as the
 * pay page is (canvas "Payment links redesign", W2): the app's mesh, a mint
 * tick, the amount big, who got it, then the details on one glass card and
 * two buttons, Save receipt (the print dialog) and the explorer.
 *
 * The token is the only key to it: never cached, never indexed, disallowed in
 * robots.txt, and never sent on as a Referer (so opening the explorer does not
 * hand it the link).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = payPageMetadata("Receipt");

const MESH =
  "linear-gradient(236deg,rgba(255,183,3,0) 8%,rgba(255,183,3,0.13) 22%,rgba(255,183,3,0.04) 40%,rgba(255,183,3,0) 60%),linear-gradient(180deg,#1a5276 0%,#0f3555 37.5%,#0a1929 75%,#0a1929 100%)";

const NETWORK_LOGO: Record<Chain, string> = {
  solana: "/pay/solana.svg",
  base: "/pay/base.svg",
  polygon: "/pay/polygon.svg",
  arc: "/pay/arc.png",
};

const EXPLORER_NAME: Record<Chain, string> = {
  solana: "Solscan",
  base: "Basescan",
  polygon: "Polygonscan",
  arc: "the explorer",
};

const glassCta =
  "inline-flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[26px] border border-white/[0.26] bg-white/[0.14] px-4 text-[16px] font-extrabold text-white transition-colors hover:bg-white/[0.18]";

/** Saved as a PDF, the receipt keeps its ground: the browser would drop it. */
const PRINT_CSS = `
@media print {
  [data-receipt], [data-receipt] * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

/** "7U2w…rjcn": the start and the end of an address or a transaction. */
function short(id: string): string {
  return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

function money(cents: number): { whole: string; frac: string } {
  const [whole, frac] = (cents / 100).toFixed(2).split(".");
  return { whole: Number(whole).toLocaleString("en-US"), frac: `.${frac}` };
}

export default async function ReceiptPage({ params }: { params: { token: string } }) {
  const found = await getReceipt(params.token, headers());
  if (found.kind === "missing") notFound();

  return (
    <div data-receipt className="relative min-h-[100dvh] bg-[#0a1929] text-white">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: MESH }} />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <header className="flex h-14 items-center justify-between print:hidden">
          <Link href="/" aria-label="HOLD" className="text-white">
            <Wordmark className="h-[18px] w-auto" />
          </Link>
          <Link href="/" className="text-[14px] font-bold text-[#C8D0D9] hover:text-white">
            Get HOLD
          </Link>
        </header>

        {found.kind === "unreachable" ? (
          <main className="flex flex-1 flex-col items-center justify-center gap-3 pb-16 text-center">
            <Ion name="information-circle-outline" size={34} className="text-amber" />
            <h1 className="text-[22px] font-extrabold leading-[28px] tracking-[-0.3px]">We couldn&rsquo;t load this receipt just now.</h1>
            <p className="max-w-[340px] text-[15px] leading-[21px] text-[#CFE3EC]">This is on our side, not your link. Give it a moment and refresh the page.</p>
          </main>
        ) : (
          (() => {
            const r = found.value;
            const explorer = paymentExplorerUrl(r);
            const name = r.link.owner?.displayName?.trim() || ownerName(r.link.owner);
            const handle = r.link.owner?.handle ? `@${r.link.owner.handle}` : null;
            const amount = money(r.amountCents);
            return (
              <main className="flex flex-1 flex-col" aria-label="Receipt">
                <section className="mt-8 flex flex-col items-center text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(125,211,168,0.45)] bg-[rgba(125,211,168,0.16)] text-[#7DD3A8]">
                    <Ion name="checkmark" size={30} />
                  </span>
                  <p className="mt-3 text-[15px] font-bold text-[#7DD3A8]">Paid</p>
                  <h1 className="mt-2.5 leading-none tabular-nums" dir="ltr">
                    <span className="relative top-2 align-top text-[34px] font-bold text-[#DCE7EE]">$</span>
                    <span className="text-[72px] font-extrabold tracking-[-2px]">{amount.whole}</span>
                    <span className="text-[34px] font-bold text-[#AFBBC6]">{amount.frac}</span>
                  </h1>
                  <p className="mt-3.5 flex max-w-full items-center justify-center gap-2">
                    <OwnerFace owner={r.link.owner} size={26} plain />
                    <span className="min-w-0 truncate text-[16px] font-bold" dir="auto">
                      to {name}
                    </span>
                    {handle && handle !== name ? <span className="shrink-0 text-[15px] text-[#C8D0D9]">{handle}</span> : null}
                  </p>
                  {r.link.title ? (
                    <p className="mt-1.5 max-w-full break-words text-[14px] text-[#C8D0D9] [overflow-wrap:anywhere]" dir="auto">
                      {r.link.title}
                    </p>
                  ) : null}
                </section>

                <dl className="mt-8 divide-y divide-white/[0.07] rounded-[22px] border border-white/[0.12] bg-[rgba(13,24,32,0.66)] px-4 py-0.5 text-[15px] backdrop-blur-xl">
                  <Row label="From">
                    <CopyId value={r.payerAddress} shown={short(r.payerAddress)} label="Copy the address it came from" />
                  </Row>
                  <Row label="Network">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={NETWORK_LOGO[r.chain]} alt="" width={22} height={22} className="h-[22px] w-[22px] rounded-[6px]" />
                    USDC on {CHAIN_LABEL[r.chain]}
                  </Row>
                  {r.paidAt ? (
                    <Row label="When">
                      <time dateTime={r.paidAt}>{instantUtc(r.paidAt)}</time>
                    </Row>
                  ) : null}
                  {r.txHash ? (
                    <Row label="Transaction">
                      <CopyId value={r.txHash} shown={short(r.txHash)} label="Copy the transaction id" />
                    </Row>
                  ) : null}
                </dl>
                <p className="mt-3 px-1 text-center text-[12.5px] leading-[17px] text-[#9FB7C2]">
                  It went straight to {name}&rsquo;s wallet. HOLD never held it and can&rsquo;t reverse it.
                </p>

                <div className="mt-auto flex gap-2 pt-8 print:hidden">
                  <SaveReceipt className={`${glassCta} flex-none px-5`} />
                  {explorer ? (
                    <a href={explorer} target="_blank" rel="noopener noreferrer" className={glassCta}>
                      <span className="truncate">View on {EXPLORER_NAME[r.chain]}</span>
                      <Ion name="arrow-up-outline" size={14} className="shrink-0 rotate-45" />
                    </a>
                  ) : null}
                </div>
              </main>
            );
          })()
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[46px] items-center justify-between gap-4">
      <dt className="shrink-0 text-[#AFBBC6]">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 font-bold tabular-nums">{children}</dd>
    </div>
  );
}

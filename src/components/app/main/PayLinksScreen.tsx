"use client";

/**
 * Pay links, as the HOLD app has them:
 *
 *   the list      app/(drawer)/(internal)/payments/pay-links/index.tsx
 *   one link      app/(drawer)/(internal)/payments/pay-links/[linkId].tsx
 *   the parts     src/features/pay-links/components.tsx (LinkRow, the tags,
 *                 the amount line)
 *
 * Same information, same order, same words. A pay link is how somebody with
 * no HOLD account pays a HOLD user from any wallet — the payer's half of it
 * already lives in this repo at /pay/[code].
 *
 * WHAT THE WEB DOES HERE
 *
 * It lists, it opens one, it copies and shares the address, and it closes a
 * link. Every one of those is the person's own bearer token and nothing else
 * (lib/pay-links/mine). MAKING a link stays in the app: the create call sends
 * an `Idempotency-Key`, which the web's read() does not carry, and a create
 * that times out without one leaves a second link behind. So this screen says
 * where a new link is made instead of drawing a form that cannot be safe.
 *
 * ── A failed load is not an empty list ──
 * Somebody with open links being told they have none is a false state on a
 * screen about money, so the error is its own branch with a way back — the
 * app's rule, and Standing.tsx's on this side.
 */

import { useState } from "react";

import { instantIn, usdFromCents } from "@/lib/ad-space/format";
import { paymentExplorerUrl } from "@/lib/pay-links/client";
import {
  closeMyPayLink,
  describeMyPayLinkError,
  isOpenPayLink,
  payLinkAmountLine,
  payLinkTotalsLine,
  useMyPayLink,
  useMyPayLinks,
  type MyPayLink,
} from "@/lib/pay-links/mine";
import type { PayLinkPayment } from "@/lib/pay-links/types";
import { chainLabel } from "@/lib/app/payments";
import { showChainContext } from "@/lib/app/display-mode";

import { useShellPrefs } from "../Shell";
import { useProductHref } from "../base";
import { BackHeader, Column, Notice, ctaPrimary, ctaSecondary, btnGlass } from "../hold";
import { CopyButton, shortAddress } from "../front/kit";
import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { cardClass, SectionLabel, SUB } from "../wallet/app-kit";

/** The app's date line: "Wed 7 Oct, 10:00". */
function when(iso: string | null | undefined): string {
  return (iso && instantIn(iso)) || "—";
}

export function PayLinksScreen() {
  const [openId, setOpenId] = useState<string | null>(null);
  return openId ? (
    <PayLinkDetail id={openId} onBack={() => setOpenId(null)} />
  ) : (
    <PayLinkList onOpen={setOpenId} />
  );
}

/* ── The tags (features/pay-links/components: statusTag, paymentTag) ── */

type Tone = "good" | "caution" | "calm" | "dim";

/** The app's Tag: 22 high, its radius half of that, 11.5/800, colour only. */
function Tag({ label, tone = "calm" }: { label: string; tone?: Tone }) {
  const ink =
    tone === "good" ? "text-[#2FBE8A]" : tone === "caution" ? "text-amber" : tone === "dim" ? "text-white/70" : "text-white/[0.62]";
  const bg =
    tone === "good" ? "bg-[rgba(14,155,104,0.14)]" : tone === "caution" ? "bg-[rgba(255,183,3,0.12)]" : "bg-white/[0.07]";
  return (
    <span className={`inline-flex h-[22px] shrink-0 items-center rounded-[11px] px-[9px] text-[11.5px] font-strong tracking-[0.1px] ${bg} ${ink}`}>
      {label}
    </span>
  );
}

const LINK_TAG: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Open", tone: "good" },
  paid: { label: "Paid", tone: "good" },
  closed: { label: "Closed", tone: "dim" },
  expired: { label: "Expired", tone: "dim" },
  disabled: { label: "Taken down", tone: "caution" },
};

const PAYMENT_TAG: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "good" },
  paid_duplicate: { label: "Paid twice", tone: "caution" },
  awaiting_payment: { label: "Confirming", tone: "calm" },
  unpaid: { label: "Not paid", tone: "dim" },
};

function StatusTag({ status }: { status: string }) {
  const tag = LINK_TAG[status];
  return <Tag label={tag?.label ?? status} tone={tag?.tone ?? "dim"} />;
}

function PaymentTag({ status }: { status: string }) {
  const tag = PAYMENT_TAG[status];
  return <Tag label={tag?.label ?? status} tone={tag?.tone ?? "dim"} />;
}

/* ── The list ─────────────────────────────────────────────────────── */

function PayLinkList({ onOpen }: { onOpen: (id: string) => void }) {
  const links = useMyPayLinks();
  const href = useProductHref();
  const rows = links.data ?? [];
  const open = rows.filter((l) => l.status === "active");
  const done = rows.filter((l) => l.status !== "active");

  return (
    <Column>
      {/* The app opens this from Add money, and so does the web: back goes there. */}
      <BackHeader title="Pay links" backHref={href("/add")} />

      <section className={`${cardClass} flex flex-col gap-2.5 p-4`}>
        <h2 className="text-[17px] font-bold tracking-[-0.3px] text-white">Get paid by anyone, from any wallet</h2>
        <p className="text-[13.5px] leading-[19px] text-[#CFE3EC]">
          Share a link with someone who doesn&rsquo;t use HOLD. They pay in USDC from their own wallet, and it lands in yours. No
          fee.
        </p>
        <p className="flex items-center gap-2 text-[12.5px] leading-[17px] text-white/55">
          <Ion name="phone-portrait-outline" size={14} color={SUB} />
          New links are made in the HOLD app. The ones you have are here.
        </p>
      </section>

      {links.data === undefined && !links.error ? <Skeleton className="mt-3.5 h-[112px]" /> : null}

      {links.error && !links.data ? (
        <div className="mt-3.5 flex flex-col gap-2.5">
          <Notice icon="cloud-offline-outline">
            {`Your pay links aren't loading. They're unchanged; this screen just couldn't reach them. ${describeMyPayLinkError(links.error)}`}
          </Notice>
          <button type="button" className={ctaSecondary} onClick={() => void links.mutate()}>
            Try again
          </button>
        </div>
      ) : null}
      {links.error && links.data ? (
        <div className="mt-3.5">
          <Notice tone="calm">{describeMyPayLinkError(links.error)}</Notice>
        </div>
      ) : null}

      {links.data && rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] leading-[19px] text-white/55">No pay links yet. The first one takes a minute.</p>
      ) : null}

      {open.length > 0 ? (
        <section className="mt-4">
          <SectionLabel>{`Open (${open.length})`}</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {open.map((l) => (
              <LinkRow key={l.id} link={l} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ) : null}

      {done.length > 0 ? (
        <section className="mt-4">
          <SectionLabel>Paid, closed or expired</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {done.map((l) => (
              <LinkRow key={l.id} link={l} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ) : null}
    </Column>
  );
}

/** features/pay-links/components: LinkRow. */
function LinkRow({ link, onOpen }: { link: MyPayLink; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(link.id)}
      className={`${cardClass} flex w-full flex-col gap-1.5 p-3.5 text-left transition-colors hover:bg-white/[0.03]`}
    >
      <span className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold tracking-[-0.2px] text-white">{link.title}</span>
        <StatusTag status={link.status} />
      </span>
      <span className="text-[14px] font-strong text-white">{payLinkAmountLine(link)}</span>
      <span className="flex items-center justify-between gap-2.5">
        <span className="text-[12.5px] leading-[17px] text-white/[0.62]">{payLinkTotalsLine(link)}</span>
        {link.expiresAt && link.status === "active" ? (
          <span className="shrink-0 text-[12.5px] leading-[17px] text-white/[0.62]">{`Until ${when(link.expiresAt)}`}</span>
        ) : null}
      </span>
    </button>
  );
}

/* ── One link ─────────────────────────────────────────────────────── */

function PayLinkDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const detail = useMyPayLink(id);
  const { displayMode } = useShellPrefs();
  const withChains = showChainContext(displayMode);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  if (!detail.data) {
    return (
      <Column>
        <BackHeader title="Pay links" onBack={onBack} />
        {detail.error ? (
          <div className="flex flex-col gap-2.5 pt-2">
            <Notice icon="cloud-offline-outline">{describeMyPayLinkError(detail.error)}</Notice>
            <button type="button" className={ctaSecondary} onClick={() => void detail.mutate()}>
              Try again
            </button>
          </div>
        ) : (
          <Skeleton className="mt-2 h-[240px]" />
        )}
      </Column>
    );
  }

  const { link, payments } = detail.data;
  const open = isOpenPayLink(link.status);

  const share = async () => {
    const text = `${link.title}: ${link.url}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
      } catch {
        /* dismissed */
      }
      return;
    }
    // No share sheet: the link goes to the clipboard, which is what it was for.
    const copy = navigator.clipboard?.writeText(link.url);
    if (!copy) return;
    void copy.then(
      () => {
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      },
      () => setShared(false),
    );
  };

  const close = async () => {
    setClosing(true);
    setMessage(null);
    try {
      await closeMyPayLink(link.id);
    } catch (e) {
      setMessage(describeMyPayLinkError(e));
    } finally {
      setClosing(false);
      setConfirming(false);
      // Refused because it isn't active any more (paid, expired, taken down):
      // read it again, so the screen shows what it is now either way.
      void detail.mutate();
    }
  };

  return (
    <Column>
      <BackHeader title={link.title} onBack={onBack} />

      {link.status === "disabled" ? (
        <div className="mb-2.5">
          <Notice icon="eye-off-outline">
            This link was taken down after a review. Payers see &ldquo;This link is no longer available&rdquo;.
          </Notice>
        </div>
      ) : null}
      {message ? (
        <div className="mb-2.5">
          <Notice>{message}</Notice>
        </div>
      ) : null}

      <section className={`${cardClass} flex flex-col gap-2.5 p-4`}>
        <div className="flex items-start gap-2.5">
          <h2 className="min-w-0 flex-1 text-[18px] font-bold leading-[23px] tracking-[-0.3px] text-white">{link.title}</h2>
          <StatusTag status={link.status} />
        </div>
        {link.note ? <p className="text-[14px] leading-[19px] text-[#CFE3EC]">{link.note}</p> : null}
        <p className="text-[15px] font-bold text-white">{payLinkAmountLine(link)}</p>

        <div className="mt-1 h-px bg-white/[0.08]" />

        <KV k="Received" v={payLinkTotalsLine(link)} />
        {withChains ? <KV k="Networks" v={link.chains.map((c) => chainLabel(c)).join(", ")} /> : null}
        <KV k="Created" v={when(link.createdAt)} />
        <KV k="Open until" v={link.expiresAt ? when(link.expiresAt) : "No end date"} />

        <div className="mt-1 flex items-center gap-2.5 rounded-[12px] border border-white/[0.08] bg-black/[0.28] px-3 py-2.5">
          <Ion name="link-outline" size={15} color={SUB} />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-strong text-[#89D7FF]">
            {link.url.replace(/^https:\/\//, "")}
          </span>
          <CopyButton value={link.url} className="shrink-0 text-[13px] font-bold text-white hover:opacity-80" />
        </div>
      </section>

      {open ? (
        <div className="mt-3.5 flex flex-col gap-2.5">
          <button type="button" className={ctaPrimary} onClick={() => void share()}>
            <Ion name="share-outline" size={18} color="#0A1420" />
            {shared ? "Copied" : "Share link"}
          </button>

          {confirming ? (
            <div className={`${cardClass} flex flex-col gap-2.5 p-3.5`}>
              <p className="text-[14px] font-bold text-white">Close this link?</p>
              <p className="text-[13px] leading-[18px] text-[#CFE3EC]">
                Nobody can pay it after this. Payments already made stay in your wallet. A closed link can&rsquo;t be opened
                again.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" className={btnGlass} onClick={() => setConfirming(false)} disabled={closing}>
                  Keep it open
                </button>
                <button type="button" className={btnGlass} onClick={() => void close()} disabled={closing}>
                  <Ion name="lock-closed-outline" size={16} />
                  {closing ? "Closing…" : "Close link"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={`${btnGlass} self-start`} onClick={() => setConfirming(true)}>
              <Ion name="lock-closed-outline" size={16} />
              Close link
            </button>
          )}
        </div>
      ) : null}

      <section className="mt-4">
        <SectionLabel>{`Payments (${payments.length})`}</SectionLabel>
        {payments.length > 0 ? (
          <div className={`${cardClass} flex flex-col gap-3 p-3.5`}>
            {payments.map((p, i) => (
              <div key={p.id} className="flex flex-col gap-3">
                {i > 0 ? <div className="h-px bg-white/[0.08]" /> : null}
                <PaymentLine payment={p} withChain={withChains} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] leading-[17px] text-white/[0.62]">
            {open
              ? "No payments yet. You'll get a notification when one lands."
              : "This link received no payments."}
          </p>
        )}
      </section>
    </Column>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[13px] leading-[18px] text-white/[0.62]">{k}</span>
      <span className="min-w-0 text-right text-[13px] leading-[18px] font-strong text-white">{v}</span>
    </div>
  );
}

function PaymentLine({ payment, withChain }: { payment: PayLinkPayment; withChain: boolean }) {
  const tx = paymentExplorerUrl(payment);
  const paidAt = payment.paidAt ?? payment.createdAt ?? null;
  const line = [`From ${shortAddress(payment.payerAddress)}`, withChain ? chainLabel(payment.chain) : null, paidAt ? when(paidAt) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2.5">
        <p className="text-[15.5px] font-bold tabular-nums text-white">{usdFromCents(payment.amountCents)}</p>
        <PaymentTag status={payment.status} />
      </div>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[12.5px] leading-[17px] text-white/[0.62]">{line}</p>
        <CopyButton
          value={payment.payerAddress}
          label="Copy address"
          className="shrink-0 text-[12px] font-bold text-white/70 hover:text-white"
        />
      </div>
      {payment.status === "paid_duplicate" ? (
        <p className="text-[12.5px] leading-[17px] text-white/[0.62]">
          Paid after this one-payment link was already paid. The money is in your wallet; if it wasn&rsquo;t meant for you twice,
          send it back.
        </p>
      ) : null}
      {tx ? (
        <a
          href={tx}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[12.5px] font-bold text-white/[0.62] underline underline-offset-2 hover:text-white"
        >
          <Ion name="open-outline" size={13} />
          See the transaction
        </a>
      ) : null}
    </div>
  );
}

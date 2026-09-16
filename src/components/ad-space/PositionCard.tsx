"use client";

import { forwardRef } from "react";

import {
  CONTENT_KIND_LABEL,
  SESSION_STATUS_LABEL,
  STATUS_LABEL,
  calendarDate,
  handsLeftText,
  handsText,
  takeoverClosedText,
  takeoverVerb,
  usdFromCents,
} from "@/lib/ad-space/format";
import type { Position, Sponsor, Takeover } from "@/lib/ad-space/types";

import { QrCode } from "./qr";
import { btnSmall, pill } from "./ui";

/**
 * One spot: what it is, what it costs, who has it. The same card is the
 * position list under a product board and the slot grid of a service.
 */

type Props = {
  position: Position;
  sizeLabel: string | null;
  active: boolean;
  /** False once the space is closed: no spot can be bought. */
  buyable: boolean;
  /** What a takeover multiplies the last price by. Null on a fixed-price space. */
  takeoverMultiple: number | null;
  /**
   * A session in person (hispace-in-the-room-v0.md): it is booked, not
   * sponsored, and nothing about the buyer is ever shown on it.
   */
  session?: boolean;
  onHover: (id: string | null) => void;
  onSponsor: (p: Position) => void;
};

export const PositionCard = forwardRef<HTMLElement, Props>(function PositionCard(
  { position: p, sizeLabel, active, buyable, takeoverMultiple, session = false, onHover, onSponsor },
  ref,
) {
  return (
    <article
      ref={ref}
      id={`spot-${p.id}`}
      onPointerEnter={() => onHover(p.id)}
      onPointerLeave={() => onHover(null)}
      className={`flex scroll-mt-24 flex-col gap-4 rounded-card border p-5 transition-colors duration-180 ${
        active
          ? "border-amber/50 bg-amber/[0.05]"
          : "border-[color:var(--color-hairline)] bg-white/[0.03]"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body text-text">{p.label}</h3>
          {!session && (
            <p className="mt-1 text-tiny text-text-faint">
              {[sizeLabel, `Takes ${p.accepts.map((k) => CONTENT_KIND_LABEL[k]).join(", ")}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <span className={pill[p.status]}>{(session ? SESSION_STATUS_LABEL : STATUS_LABEL)[p.status]}</span>
      </header>

      {p.pitch && <p className="text-small text-text-muted">{p.pitch}</p>}

      {p.status === "sold" && session && (
        <p className="text-small text-text-muted">Booked. The creator and the buyer arrange the time and place.</p>
      )}

      {p.status === "sold" &&
        !session &&
        (p.sponsor ? (
          <SponsorLine sponsor={p.sponsor} />
        ) : (
          <p className="text-small text-text-muted">
            Sold. The sponsor&rsquo;s logo shows here once the creator approves it.
          </p>
        ))}

      {p.delivered && (
        <a
          href={p.delivered.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-small text-success hover:underline"
        >
          Delivered {calendarDate(p.delivered.at)}: see the post
        </a>
      )}

      {p.takeover && <TakeoverLines position={p} takeover={p.takeover} multiple={takeoverMultiple} />}

      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-[color:var(--color-hairline)] pt-4">
        {p.takeover ? (
          <TakeoverPrices position={p} takeover={p.takeover} />
        ) : (
          <dl className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2">
              <dt className="sr-only">{session ? "You pay" : "Sponsor pays"}</dt>
              <dd className="font-mono text-body text-text">{p.sponsorPaysUsdc} USDC</dd>
            </div>
            <div className="flex items-baseline gap-1 text-tiny text-text-faint">
              <dt>Creator receives</dt>
              <dd className="font-mono">{p.creatorReceivesUsdc}</dd>
            </div>
          </dl>
        )}

        {p.status === "open" && buyable && (
          <button type="button" className={btnSmall} onClick={() => onSponsor(p)}>
            {session ? "Book a session" : "Sponsor this spot"}
          </button>
        )}
        {/* A sold spot on a takeover board is still for sale — at double. The
            card already says what that costs and what goes back to the sponsor
            holding it, so the button only has to name the act. */}
        {p.status === "sold" && buyable && p.takeover && !p.takeover.closed && p.takeover.nextPriceUsdc && (
          <button type="button" className={btnSmall} onClick={() => onSponsor(p)}>
            Take this spot
          </button>
        )}
        {p.status === "held" && buyable && (
          <p className="max-w-[16rem] text-tiny text-amber">
            Someone is paying for this {session ? "session" : "spot"} right now. It opens again if they don&rsquo;t
            finish.
          </p>
        )}
      </div>
    </article>
  );
});

/**
 * The two figures a takeover spot leads with, each under its own visible label.
 *
 * At a multiple of two the price a spot last went for and the money a takeover
 * hands the creator are the SAME number, so the sr-only label the fixed-price
 * card uses is not enough here: a reader who sees one amount has to be told
 * which one it is without asking a screen reader.
 */
function TakeoverPrices({ position: p, takeover: t }: { position: Position; takeover: Takeover }) {
  const takeable = p.status === "sold" && !t.closed && t.nextSponsorPaysUsdc !== null;
  return (
    <dl className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <dt className="text-tiny text-text-faint">{p.status === "sold" ? "Sold at" : "You pay"}</dt>
        <dd className="font-mono text-body text-text">
          {p.status === "sold" ? t.priceUsdc : p.sponsorPaysUsdc} USDC
        </dd>
      </div>
      {takeable ? (
        <div className="flex items-baseline gap-1 text-tiny text-amber">
          <dt>Take it for</dt>
          <dd className="font-mono">{t.nextSponsorPaysUsdc} USDC</dd>
        </div>
      ) : (
        p.status !== "sold" && (
          <div className="flex items-baseline gap-1 text-tiny text-text-faint">
            <dt>Creator receives</dt>
            <dd className="font-mono">{p.creatorReceivesUsdc}</dd>
          </div>
        )
      )}
    </dl>
  );
}

/**
 * What the ladder has done to this spot and what happens next, in sentences.
 *
 * No amount here appears twice and none appears bare: the price, what a
 * takeover costs and the refund sit within two lines of each other, and at a
 * multiple of two a pair of them can be the same figure.
 */
function TakeoverLines({
  position: p,
  takeover: t,
  multiple,
}: {
  position: Position;
  takeover: Takeover;
  multiple: number | null;
}) {
  if (p.status !== "sold") {
    return (
      <p className="text-tiny text-text-muted">
        Bidding starts at {usdFromCents(t.floorPriceCents)}, and every takeover after that{" "}
        {takeoverVerb(multiple)}.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 text-tiny text-text-muted">
      {t.handsSoFar > 0 && (
        <p>
          {handsText(t.handsSoFar)} since bidding opened at {usdFromCents(t.floorPriceCents)}.
        </p>
      )}
      {t.closed ? (
        <p>{takeoverClosedText(t.closed)}</p>
      ) : (
        t.nextPriceUsdc &&
        t.refundsUsdc && (
          <p>
            Taking it moves the price to {t.nextPriceUsdc} USDC and sends {t.refundsUsdc} USDC straight back to the
            sponsor who has it now, in the same transaction. {handsLeftText(t.handsLeft)}
          </p>
        )
      )}
    </div>
  );
}

/** Only http(s) links are ever rendered from sponsor content. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function SponsorLine({ sponsor: s }: { sponsor: Sponsor }) {
  const href = safeHref(s.url);
  const handle = s.xHandle?.replace(/^@/, "");
  return (
    <div className="flex items-center gap-3">
      <SponsorMark sponsor={s} />
      <div className="min-w-0">
        <p className="truncate text-small text-text">
          {href ? (
            <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer" className="hover:underline">
              {s.name}
            </a>
          ) : (
            s.name
          )}
        </p>
        {handle && (
          <a
            href={`https://x.com/${encodeURIComponent(handle)}`}
            target="_blank"
            rel="nofollow ugc noopener noreferrer"
            className="text-tiny text-text-faint hover:text-text-muted"
          >
            @{handle}
          </a>
        )}
        {s.contentKind === "text" && s.contentText && (
          <p className="mt-0.5 truncate font-mono text-tiny text-text-muted">{s.contentText}</p>
        )}
      </div>
    </div>
  );
}

function SponsorMark({ sponsor: s }: { sponsor: Sponsor }) {
  const box = "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-tight bg-white";
  if (s.imageUrl) {
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- sponsor artwork from our own bucket, any host */}
        <img
          src={s.imageUrl}
          alt={`${s.name} logo`}
          className={s.contentKind === "photo" ? "h-full w-full object-cover" : "h-full w-full object-contain p-1"}
          loading="lazy"
        />
      </span>
    );
  }
  if (s.contentKind === "qr" && s.contentText) {
    return (
      <span className={box}>
        <QrCode text={s.contentText} title={`QR code for ${s.name}`} className="h-full w-full" />
      </span>
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-tight bg-amber text-body font-medium text-text-on-amber">
      {s.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

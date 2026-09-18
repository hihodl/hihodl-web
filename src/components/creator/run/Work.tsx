/**
 * What you owe, once somebody has paid.
 *
 * THREE DIFFERENT THINGS, IN THE ORDER THEY BITE
 *
 * 1. Artwork waiting on you. A sponsor has paid and sent a logo, a line of
 *    text or a photo, and nobody sees it until you say yes. Until then their
 *    money is spent and their brand is nowhere, so this comes first.
 * 2. The spots themselves. Each sale is delivered with a public link — the
 *    post, the video, the photo — and that link is what the buyer, and anybody
 *    reading your track record afterwards, actually checks.
 * 3. The listing's own promises. The posts you said you would make, with their
 *    dates. Past the date and its grace, a promise with no link against it is
 *    counted as missed on your public record.
 *
 * SAYING NO IS NOT A FAILURE AND IS NOT SHOWN AS ONE
 *
 * A rejection needs a reason because the sponsor reads it and sends something
 * else; that is the whole mechanism. Nothing here is red, including a missed
 * deliverable: it is a fact on a page, and a creator who has just been told
 * their record slipped does not need it shouted.
 */

"use client";

import { useState } from "react";

import { btnSmall, btnSmallSecondary, card, pill } from "@/components/ad-space/ui";
import { calendarDate } from "@/lib/ad-space/format";
import type { DeliverableView, PositionView, SpaceView } from "@/lib/creator/listing";
import { markDeliverableDelivered, markPositionDelivered, reviewContent } from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Text } from "../listing/parts";

const DELIVERABLE_STATE: Record<DeliverableView["state"], string> = {
  delivered: "Delivered",
  upcoming: "Coming up",
  overdue: "Past its date",
  missed: "Counted as missed",
};

export function Work({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const waiting = space.positions.filter((p) => p.content?.status === "pending" && p.sponsor);
  const sold = space.positions.filter((p) => p.status === "sold");

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-body text-text">What sponsors have sent you</h3>
          <p className="text-small text-text-muted">
            Nobody sees a sponsor&apos;s artwork until you say yes. They have paid, so the sooner you answer the sooner
            they have what they bought — and saying no with a reason is how they know what to send instead.
          </p>
        </div>
        {waiting.length === 0 ? (
          <p className="text-small text-text-muted">Nothing waiting on you.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {waiting.map((p) => (
              <li key={p.id}>
                <Review position={p} onChanged={onChanged} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-body text-text">The spots you have sold</h3>
          <p className="text-small text-text-muted">
            Each one is delivered with a public link: the post, the video, the photo. It is what the sponsor checks and
            what your record is built from.
          </p>
        </div>
        {sold.length === 0 ? (
          <p className="text-small text-text-muted">Nothing sold yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sold.map((p) => (
              <li key={p.id}>
                <SoldSpot position={p} onChanged={onChanged} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {space.deliverables.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-body text-text">What you promised the whole listing</h3>
            <p className="text-small text-text-muted">
              These are on your page, with their dates. A week past a date with no link against it and it is counted as
              missed on your public record, so put the link up as soon as it exists.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {space.deliverables.map((d) => (
              <li key={d.id}>
                <Promise deliverable={d} onChanged={onChanged} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ── A sponsor's artwork ──────────────────────────────────────────── */

function Review({ position, onChanged }: { position: PositionView; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saying, setSaying] = useState(false);
  const [reason, setReason] = useState("");
  const submittedAt = position.content?.submittedAt ?? null;

  async function answer(approve: boolean) {
    if (!submittedAt) return;
    setBusy(true);
    setNotice(null);
    try {
      await reviewContent(position.id, approve, submittedAt, approve ? null : reason.trim());
      setSaying(false);
      setReason("");
      onChanged();
    } catch (e) {
      setNotice(describeRunError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${card} flex flex-col gap-4 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body text-text">{position.title ?? position.label}</p>
          <p className="mt-1 text-tiny text-text-muted">
            From {position.sponsor?.name ?? "a sponsor"}
            {position.sponsor?.xHandle ? ` · @${position.sponsor.xHandle}` : ""}
          </p>
        </div>
        <span className={pill.attention}>Waiting on you</span>
      </div>

      {position.sponsor?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={position.sponsor.imageUrl}
          alt={`What ${position.sponsor.name ?? "the sponsor"} sent`}
          className="max-h-64 w-auto max-w-full rounded-input border border-[color:var(--color-hairline)] bg-white/5 object-contain"
        />
      ) : null}
      {position.sponsor?.contentText ? (
        <p className="rounded-input border border-[color:var(--color-hairline)] px-4 py-3 text-body text-text">
          {position.sponsor.contentText}
        </p>
      ) : null}
      {position.sponsor?.url ? <p className="break-all text-tiny text-text-muted">{position.sponsor.url}</p> : null}

      {saying ? (
        <div className="flex flex-col gap-3">
          <p className="text-small text-text-muted">
            Say what is wrong with it, in a line. The sponsor reads exactly this and sends something else.
          </p>
          <Text value={reason} onChange={setReason} maxLength={200} placeholder="The logo is too small to read on the strip" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSmall} disabled={busy || !reason.trim()} onClick={() => void answer(false)}>
              {busy ? "Sending…" : "Send it back"}
            </button>
            <button type="button" className={btnSmallSecondary} onClick={() => setSaying(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSmall} disabled={busy} onClick={() => void answer(true)}>
            {busy ? "Working…" : "Approve it"}
          </button>
          <button type="button" className={btnSmallSecondary} disabled={busy} onClick={() => setSaying(true)}>
            Ask for a different one
          </button>
        </div>
      )}

      <p className="text-tiny text-text-muted">
        Approving puts it on the public page. It applies to this version only — if they swap it after you look, you are
        asked again.
      </p>

      {notice ? <Line>{notice}</Line> : null}
    </div>
  );
}

/* ── A sold spot, and the link that delivers it ───────────────────── */

function SoldSpot({ position, onChanged }: { position: PositionView; onChanged: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className={`${card} flex flex-col gap-3 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body text-text">{position.title ?? position.label}</p>
          <p className="mt-1 text-tiny text-text-muted">
            {position.sponsor?.name ?? "Sold"}
            {position.creatorReceivesUsdc ? ` · ${position.creatorReceivesUsdc} USDC to you` : ""}
          </p>
        </div>
        <span className={position.delivered ? pill.done : pill.attention}>
          {position.delivered ? "Delivered" : "To deliver"}
        </span>
      </div>

      {position.qr ? (
        <p className="text-tiny text-text-muted">
          Its QR code is at <span className="break-all text-text">{position.qr.url}</span> — scanned {position.qr.scans}{" "}
          {position.qr.scans === 1 ? "time" : "times"} so far.
        </p>
      ) : null}

      {position.delivered ? (
        <p className="break-all text-small text-text-muted">
          Delivered {calendarDate(position.delivered.at)}: <span className="text-text">{position.delivered.url}</span>
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Text type="url" value={url} onChange={setUrl} placeholder="https://x.com/you/status/…" />
          </div>
          <button
            type="button"
            className={btnSmall}
            disabled={busy || !url.trim()}
            onClick={() => {
              setBusy(true);
              setNotice(null);
              void markPositionDelivered(position.id, url.trim())
                .then(() => {
                  setUrl("");
                  onChanged();
                })
                .catch((e) => setNotice(describeRunError(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "It is up"}
          </button>
        </div>
      )}

      {notice ? <Line>{notice}</Line> : null}
    </div>
  );
}

/* ── One of the listing's own promises ────────────────────────────── */

function Promise({ deliverable, onChanged }: { deliverable: DeliverableView; onChanged: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className={`${card} flex flex-col gap-3 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body text-text">
            {deliverable.count} × {deliverable.kind.replace(/_/g, " ")}
            {deliverable.platform ? ` on ${deliverable.platform}` : ""}
          </p>
          <p className="mt-1 text-tiny text-text-muted">
            By {calendarDate(deliverable.dueDate)}
            {deliverable.note ? ` · ${deliverable.note}` : ""}
          </p>
        </div>
        <span className={deliverable.state === "delivered" ? pill.done : pill.attention}>
          {DELIVERABLE_STATE[deliverable.state]}
        </span>
      </div>

      {deliverable.deliveredUrl ? (
        <p className="break-all text-small text-text-muted">
          <span className="text-text">{deliverable.deliveredUrl}</span>
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Text type="url" value={url} onChange={setUrl} placeholder="https://x.com/you/status/…" />
          </div>
          <button
            type="button"
            className={btnSmall}
            disabled={busy || !url.trim()}
            onClick={() => {
              setBusy(true);
              setNotice(null);
              void markDeliverableDelivered(deliverable.id, url.trim())
                .then(() => {
                  setUrl("");
                  onChanged();
                })
                .catch((e) => setNotice(describeRunError(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "It is up"}
          </button>
        </div>
      )}

      {notice ? <Line>{notice}</Line> : null}
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
      {children}
    </p>
  );
}

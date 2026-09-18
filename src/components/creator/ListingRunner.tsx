/**
 * Running a listing that is already live.
 *
 * WHAT THIS PAGE IS FOR
 *
 * Publishing is the easy half. The half that decides whether a creator is paid
 * twice is what happens afterwards: answering a brand that named a number,
 * saying yes to the artwork they sent, and putting the link up that proves the
 * thing was delivered. All of it is an API call, none of it needs a wallet,
 * and until now all of it needed the app.
 *
 * WHY THE MONEY IS SAID TWICE
 *
 * Because there are two numbers and they are not the same. When the sponsor
 * carries our five percent they pay more than the price and the creator
 * receives the price; when the creator carries it they pay the price and the
 * creator receives less. So every figure on this page says whose it is, and
 * what the creator RECEIVES is the one in the larger type.
 *
 * WHY EVERYTHING RELOADS THE WHOLE LISTING AFTER AN ANSWER
 *
 * Accepting an offer reserves a spot, which changes that spot's status, which
 * changes what the other offers on it may become. Patching one card in place
 * would leave a screen where half the state is from before the change. The
 * listing is one read, so it is re-read.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { btnSmall, btnSmallSecondary, card, eyebrow, pill } from "@/components/ad-space/ui";
import { closesText } from "@/lib/ad-space/format";
import { describeCreatorError } from "@/lib/creator/api";
import {
  centsFromDollars,
  centsFromUsdc,
  dollarsFromCents,
  usd,
  type OfferView,
  type SpaceView,
} from "@/lib/creator/listing";
import {
  addUpdate,
  getListing,
  listingOffers,
  removeUpdate,
  setListingFloor,
  setPositionFloor,
  shareListing,
} from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Money, Text } from "./listing/parts";
import { Loading, Notice, Section } from "./parts";
import { Offers } from "./run/Offers";
import { Work } from "./run/Work";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  live: "Live",
  closed: "Closed",
  delisted: "Taken down",
};

export function ListingRunner({ spaceId }: { spaceId: string }) {
  const [space, setSpace] = useState<SpaceView | null>(null);
  const [offers, setOffers] = useState<OfferView[]>([]);
  const [share, setShare] = useState<{ url: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { space: next } = await getListing(spaceId);
      setSpace(next);
      setError(null);
      // Offers only exist on a listing that takes them, and a draft has no
      // page to share; neither is worth a call that can only answer no.
      const wants = next.pricingMode !== "fixed" || next.acceptsOffers || next.positions.some((p) => p.saleMode);
      const [o, s] = await Promise.all([
        wants ? listingOffers(spaceId).catch(() => ({ offers: [] as OfferView[] })) : Promise.resolve({ offers: [] as OfferView[] }),
        next.status === "draft" ? Promise.resolve(null) : shareListing(spaceId).catch(() => null),
      ]);
      setOffers(o.offers);
      setShare(s);
    } catch (e) {
      setError(describeCreatorError(e));
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Page>
        <Loading what="this listing" />
      </Page>
    );
  }
  if (error || !space) {
    return (
      <Page>
        <Notice>{error ?? "We cannot find this listing."}</Notice>
      </Page>
    );
  }

  const openOffers = offers.filter((o) => o.status === "pending").length;
  const waiting = space.positions.filter((p) => p.content?.status === "pending").length;

  return (
    <Page>
      <header className="flex flex-col gap-4">
        <p className={`${eyebrow} text-text-faint`}>Your listing</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-h3 font-light text-text">{space.serviceName || space.title}</h1>
          <span className={space.status === "live" ? pill.open : pill.neutral}>
            {STATUS_LABEL[space.status] ?? space.status}
          </span>
        </div>
        <p className="text-small text-text-muted">
          {space.status === "draft" ? "Only you can see this" : closesText(space.closesAt, space.status === "closed")}
          {space.event ? ` · ${space.event.name}` : ""} · {space.totals.sold} of {space.totals.positions} sold
        </p>
        {space.status === "draft" ? (
          <div>
            <Link href={`/creator/listings/${space.id}/edit`} className={btnSmall}>
              Finish it
            </Link>
          </div>
        ) : null}
      </header>

      {openOffers > 0 || waiting > 0 ? (
        <p role="status" className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
          {openOffers > 0
            ? `${openOffers} ${openOffers === 1 ? "brand is" : "brands are"} waiting for an answer.`
            : ""}{" "}
          {waiting > 0
            ? `${waiting} ${waiting === 1 ? "sponsor has" : "sponsors have"} sent artwork nobody can see until you approve it.`
            : ""}
        </p>
      ) : null}

      {share ? (
        <Section label="Send people to it" title="Your link">
          <div className="flex flex-col gap-4">
            <p className="break-all font-mono text-small text-text">{share.url}</p>
            <p className="rounded-input border border-[color:var(--color-hairline)] px-4 py-3 text-small text-text-muted">
              {share.text}
            </p>
            <p className="text-tiny text-text-muted">
              A brand does not need a HOLD account to buy from this: they open the page, connect their own wallet and
              pay you directly. That is the whole reason the link is worth posting.
            </p>
          </div>
        </Section>
      ) : null}

      <Section label="What brands have said" title="Offers and bids">
        <Offers space={space} offers={offers} onChanged={() => void load()} />
      </Section>

      <Floors space={space} onChanged={() => void load()} />

      <Section label="After the money" title="What you owe">
        <Work space={space} onChanged={() => void load()} />
      </Section>

      <Updates space={space} onChanged={() => void load()} />
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-6 py-18">
      {children}
      <p className="text-tiny text-text-muted">
        <Link href="/creator" className="underline decoration-dotted underline-offset-4">
          Back to your account
        </Link>
      </p>
    </div>
  );
}

/* ── The floors nobody else can see ───────────────────────────────── */

function Floors({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const perSpot = space.positions.filter((p) => p.offers?.minOfferUsdc !== undefined);
  const spaceLevel = space.spaceOffers?.minOfferUsdc !== undefined;
  if (perSpot.length === 0 && !spaceLevel) return null;

  return (
    <Section label="Only you see this" title="The least you would take">
      <div className="flex flex-col gap-5">
        <p className="text-body text-text-muted">
          A floor is private. No brand is ever shown the number — on a spot that is bid for they only see whether it has
          been met — and anything under it is turned away before it reaches you. Changing it now never re-opens an offer
          that has already been made.
        </p>
        {spaceLevel ? (
          <Floor
            label="Every slot on this listing"
            current={space.spaceOffers?.minOfferUsdc ?? null}
            onSave={(cents) => setListingFloor(space.id, cents)}
            onChanged={onChanged}
          />
        ) : null}
        {perSpot.map((p) => (
          <Floor
            key={p.id}
            label={p.title ?? p.label}
            current={p.offers?.minOfferUsdc ?? null}
            onSave={(cents) => setPositionFloor(p.id, cents)}
            onChanged={onChanged}
          />
        ))}
      </div>
    </Section>
  );
}

function Floor({
  label,
  current,
  onSave,
  onChanged,
}: {
  label: string;
  current: string | null;
  onSave: (cents: number | null) => Promise<unknown>;
  onChanged: () => void;
}) {
  const [value, setValue] = useState(dollarsFromCents(centsFromUsdc(current)));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function save(cents: number | null) {
    setBusy(true);
    setNotice(null);
    void onSave(cents)
      .then(onChanged)
      .catch((e) => setNotice(describeRunError(e)))
      .finally(() => setBusy(false));
  }

  return (
    <div className={`${card} flex flex-col gap-3 p-5`}>
      <p className="text-small text-text">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Money value={value} onChange={setValue} placeholder="No floor" />
        </div>
        <button
          type="button"
          className={btnSmall}
          disabled={busy || (value.trim() !== "" && centsFromDollars(value) === null)}
          onClick={() => save(value.trim() ? centsFromDollars(value) : null)}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {current ? (
          <button type="button" className={btnSmallSecondary} disabled={busy} onClick={() => save(null)}>
            Take it off
          </button>
        ) : null}
      </div>
      <p className="text-tiny text-text-muted">
        {current ? `Currently ${current} USDC.` : "No floor, so every offer reaches you and you answer each one."}
        {" The least anybody can offer on HiSpace at all is "}
        {usd(2_500)}.
      </p>
      {notice ? (
        <p role="status" className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

/* ── Telling people how it is going ───────────────────────────────── */

function Updates({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (space.status === "draft") return null;

  return (
    <Section label="While it runs" title="What you tell people">
      <div className="flex flex-col gap-5">
        <p className="text-body text-text-muted">
          A line on your page as things happen — the strip is printed, the first interview is shot, everything is
          posted. Sponsors read it, and so does the next brand deciding whether to buy.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Text value={body} onChange={setBody} maxLength={280} placeholder="The mini strip is printed and on the case" />
          </div>
          <button
            type="button"
            className={btnSmall}
            disabled={busy || !body.trim()}
            onClick={() => {
              setBusy(true);
              setNotice(null);
              void addUpdate(space.id, body.trim())
                .then(() => {
                  setBody("");
                  onChanged();
                })
                .catch((e) => setNotice(describeRunError(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Posting…" : "Post it"}
          </button>
        </div>

        {space.updates.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {space.updates.map((u) => (
              <li key={u.id} className={`${card} flex flex-wrap items-start justify-between gap-3 p-4`}>
                <span className="min-w-0 text-small text-text">{u.body}</span>
                <button
                  type="button"
                  className={btnSmallSecondary}
                  onClick={() => {
                    void removeUpdate(space.id, u.id)
                      .then(onChanged)
                      .catch((e) => setNotice(describeRunError(e)));
                  }}
                >
                  Take it down
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {notice ? (
          <p role="status" className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
            {notice}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

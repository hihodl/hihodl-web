/**
 * The top of a listing, as the app's space page draws it for its creator:
 * the BannerView (the creator's picture or the listing's gradient, radius 16,
 * the event's small dark card on its foot) with the look chips under it, then
 * the ProgressCard (what it has raised, the bar, sold and when it closes).
 *
 * The picture is the creator's to choose ("Change image"), sent to the
 * backend as the image itself. With none, the listing's gradient is drawn:
 * never the event's photo, which would make every listing at one event look
 * the same. Only the owner can change it; the server refuses anyone else.
 */

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useHref } from "@/components/app/base";
import { Ion } from "@/components/app/ion";
import { Card, centsText, Chip, ChipRow, dateTimeText, eventDatesText, ProgressBar } from "@/components/app/spaces/kit";
import { gradientCss } from "@/lib/ad-space/look";
import type { SpaceView } from "@/lib/creator/listing";
import { BANNER_MAX_BYTES, BANNER_TYPES, clearListingBanner, setListingBanner } from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Notice } from "../parts";

/** The app's Chip as a link. */
const chipLink =
  "inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[17px] border border-white/[0.14] bg-white/[0.06] px-[13px] text-[13.5px] font-strong text-white/[0.62] transition-colors hover:bg-white/10";

export function ListingBanner({
  space,
  owner,
  publicUrl,
  onChanged,
}: {
  space: SpaceView;
  owner: boolean;
  publicUrl: string | null;
  onChanged: () => void;
}) {
  const href = useHref();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The picture just chosen is shown at once, and let go once the server's is back.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);
  useEffect(() => setPreview(null), [space.bannerUrl]);

  const image = preview ?? space.bannerUrl ?? null;
  const canDress = owner && space.status !== "delisted";

  function choose(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    if (!(BANNER_TYPES as readonly string[]).includes(file.type)) {
      setNotice("Use a JPG, PNG or WebP.");
      return;
    }
    if (file.size > BANNER_MAX_BYTES) {
      setNotice("Up to 3 MB.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    void setListingBanner(space.id, file)
      .then(onChanged)
      .catch((e) => {
        setPreview(null);
        setNotice(describeRunError(e));
      })
      .finally(() => setBusy(false));
  }

  function remove() {
    setBusy(true);
    setNotice(null);
    void clearListingBanner(space.id)
      .then(onChanged)
      .catch((e) => setNotice(describeRunError(e)))
      .finally(() => setBusy(false));
  }

  const { totals } = space;
  const takeover = space.pricingMode === "takeover";
  const noTotal = totals.totalCents == null;
  const meta = "text-[12.5px] leading-[17px] text-white/55";

  return (
    <div className="flex flex-col gap-2.5">
      <section
        className="relative isolate flex h-[168px] min-w-0 flex-col justify-end overflow-hidden rounded-[16px] sm:h-[200px] xl:h-[220px]"
        style={image ? undefined : { background: gradientCss(space.bannerGradient) }}
      >
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-[linear-gradient(180deg,rgba(4,12,20,0)_0%,rgba(4,12,20,0.88)_100%)]" />
          </>
        ) : null}
        {space.event ? (
          <div className="m-2.5 flex max-w-[82%] flex-col gap-px self-start rounded-[12px] bg-[rgba(6,11,16,0.55)] px-2.5 py-[7px]">
            <p className="truncate text-[14px] font-strong tracking-[-0.2px] text-white">{space.event.name}</p>
            <p className="truncate text-[12px] font-strong text-white/[0.78]">
              {[space.event.city, eventDatesText(space.event.startsOn, space.event.endsOn)].filter(Boolean).join(" · ")}
            </p>
          </div>
        ) : null}
      </section>

      {canDress || (space.status === "draft" && owner) || publicUrl ? (
        <ChipRow>
          {canDress ? (
            <>
              <Chip
                label={busy ? "Uploading…" : image ? "Change image" : "Add image"}
                icon="image-outline"
                disabled={busy}
                onClick={() => input.current?.click()}
              />
              {space.bannerUrl && !busy ? <Chip label="Remove" icon="trash-outline" onClick={remove} /> : null}
              <input
                ref={input}
                type="file"
                accept={BANNER_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  choose(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </>
          ) : null}
          {space.status === "draft" && owner ? (
            <Link href={href(`/listings/${space.id}/edit`)} className={chipLink}>
              <Ion name="create-outline" size={14} />
              Continue editing
            </Link>
          ) : publicUrl ? (
            <a href={publicUrl} target="_blank" rel="noreferrer" className={chipLink}>
              <Ion name="open-outline" size={14} />
              Public page
            </a>
          ) : null}
        </ChipRow>
      ) : null}
      {notice ? <Notice>{notice}</Notice> : null}

      {/* The app's ProgressCard. */}
      <Card>
        <div className="flex items-center justify-between gap-2.5">
          {noTotal && totals.committedCents <= 0 ? (
            <p className={meta}>No sales yet</p>
          ) : (
            <>
              <p className="text-[26px] font-strong tracking-[-0.6px] tabular-nums text-white">{centsText(totals.committedCents)}</p>
              <p className={meta}>{takeover || noTotal ? "so far" : `of ${centsText(totals.totalCents)}`}</p>
            </>
          )}
        </div>
        <ProgressBar value={totals.positions > 0 ? totals.sold / totals.positions : 0} />
        <div className="flex items-center justify-between gap-2.5">
          <p className={meta}>{takeover ? `${totals.sold} of ${totals.positions} taken` : `${totals.sold} of ${totals.positions} sold`}</p>
          <p className={meta}>
            {space.status === "draft" ? "Draft" : space.status === "live" ? `Closes ${dateTimeText(space.closesAt)}` : `Closed ${dateTimeText(space.closesAt)}`}
          </p>
        </div>
      </Card>
    </div>
  );
}

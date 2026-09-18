/**
 * The top of a listing: the creator's own picture, big, because this is the
 * thing being sold — and on it the name, the event, where it stands and the
 * one number that matters.
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
import { IconArrowLeft, IconImage } from "@/components/app/icons";
import { StatusPill } from "@/components/app/spaces/common";
import { dollars } from "@/components/app/ui";
import { closesText } from "@/lib/ad-space/format";
import { gradientCss } from "@/lib/ad-space/look";
import type { SpaceView } from "@/lib/creator/listing";
import { BANNER_MAX_BYTES, BANNER_TYPES, clearListingBanner, setListingBanner } from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Notice } from "../parts";

const onPhoto = "border-white/20 bg-[#04101A]/55 text-text backdrop-blur-md hover:bg-[#04101A]/75";
const chip = `inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 text-tiny font-medium transition-colors ${onPhoto}`;

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
  const name = space.serviceName || space.title;
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

  return (
    <div className="flex flex-col gap-2">
      <section
        className="relative isolate flex h-[240px] min-w-0 flex-col justify-between overflow-hidden rounded-[18px] border border-white/10 p-3 sm:h-[280px] sm:p-4 xl:h-[300px]"
        style={image ? undefined : { background: gradientCss(space.bannerGradient) }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        ) : null}
        {/* Dark at the foot and along the top, so the words read on any picture. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(4,12,20,0.55)_0%,rgba(4,12,20,0)_30%,rgba(4,12,20,0)_45%,rgba(4,12,20,0.88)_100%)]"
        />

        <div className="flex items-start justify-between gap-2">
          <Link href={href("/listings")} className={chip}>
            <IconArrowLeft className="h-3.5 w-3.5" />
            Listings
          </Link>
          <div className="flex flex-wrap justify-end gap-1.5">
            {canDress ? (
              <>
                <button type="button" className={chip} disabled={busy} onClick={() => input.current?.click()}>
                  <IconImage className="h-3.5 w-3.5" />
                  {busy ? "Uploading…" : image ? "Change image" : "Add image"}
                </button>
                {space.bannerUrl && !busy ? (
                  <button type="button" className={`${chip} hidden sm:inline-flex`} onClick={remove}>
                    Remove
                  </button>
                ) : null}
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
              <Link
                href={href(`/listings/${space.id}/edit`)}
                className="inline-flex h-9 items-center whitespace-nowrap rounded-[10px] bg-amber px-3 text-tiny font-medium text-text-on-amber transition-colors hover:bg-amber-glow"
              >
                Finish draft
              </Link>
            ) : publicUrl ? (
              <a href={publicUrl} target="_blank" rel="noreferrer" className={`${chip} hidden sm:inline-flex`}>
                Public page
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-full">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={space.status} onPhoto />
              {space.event ? (
                <span className="inline-flex h-6 max-w-full items-center truncate rounded-[12px] border border-white/20 bg-[#04101A]/45 px-2.5 text-tiny text-text backdrop-blur-md">
                  {space.event.name}
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 line-clamp-2 break-words text-[24px] font-medium leading-tight text-text [text-shadow:0_1px_12px_rgba(0,0,0,0.45)] sm:text-[32px]">
              {name}
            </h2>
            <p className="mt-1 text-tiny text-[#CFE3EC]">
              {space.status === "draft" ? "Draft" : closesText(space.closesAt, space.status === "closed")}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[28px] font-medium leading-none tabular-nums text-text sm:text-[34px]">
              {dollars(space.totals.committedCents)}
            </p>
            <p className="mt-1 text-tiny text-[#CFE3EC]">
              {space.totals.sold}/{space.totals.positions} sold
            </p>
          </div>
        </div>
      </section>
      {notice ? <Notice>{notice}</Notice> : null}
    </div>
  );
}

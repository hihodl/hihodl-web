"use client";

/** Applied, not approved yet: what happens next, and the link already kept for them. */

import type { Partner } from "@/lib/app/partners";

import { CopyButton } from "../front/kit";
import { HoldCard } from "../hold";
import { Ion } from "../ion";

export function PendingScreen({ partner, link }: { partner: Partner; link: string | null }) {
  const url = link ?? `https://hihodl.xyz/invite/${partner.slug}`;
  return (
    <div className="flex flex-col gap-4">
      <HoldCard className="p-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber/[0.14] text-amber">
          <Ion name="hourglass-outline" size={26} />
        </span>
        <h2 className="mt-4 text-[22px] font-extrabold tracking-[-0.4px] text-white">We&rsquo;re reviewing your application</h2>
        <p className="mx-auto mt-2 max-w-[400px] text-[14px] leading-[21px] text-white/[0.72]">
          Thanks, {partner.name}. We look at every application by hand. Once you are approved we email you and send a
          push to your HOLD app, and your dashboard, trips and payouts open right here.
        </p>
      </HoldCard>

      <HoldCard className="p-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.6px] text-white/55">Your link, kept for you</p>
        <p className="mt-2 truncate text-[15px] font-bold text-white">{url.replace(/^https?:\/\//, "")}</p>
        <p className="mt-1 text-[12.5px] leading-[18px] text-white/55">
          It starts counting signups the moment you are approved. Old links keep working if you rename it later.
        </p>
        <div className="mt-3">
          <CopyButton
            value={url}
            className="inline-flex h-10 items-center justify-center rounded-[20px] border border-white/[0.14] bg-white/[0.08] px-5 text-[14px] font-bold text-white transition-colors hover:bg-white/[0.14]"
          />
        </div>
      </HoldCard>
    </div>
  );
}

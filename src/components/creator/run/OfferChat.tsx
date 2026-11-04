"use client";

/**
 * A brand and a creator, talking.
 *
 * WHY THIS IS NOT A NEW CHAT
 *
 * The product already has one that two HOLD accounts can hold: sixteen routes
 * under `/payment-notes`, with a request gate, GIFs, read receipts, mute and a
 * privacy setting. `lib/app/chat.ts` says it out loud — "two fronts, one
 * engine" — and this is the second front. Nothing here is new machinery; it is
 * the same rows with a different frame.
 *
 * WHICH MEANS THE RULES COME WITH IT, AND THAT IS THE POINT
 *
 * A first message to somebody who has never spoken to you arrives as a
 * REQUEST. So a sponsor who bid $250 on a listing cannot put anything in a
 * creator's inbox until the creator lets them; and a creator writing first is
 * in exactly the same position. Neither side had to invent a policy for
 * unsolicited brand mail, because the chat has always had one.
 *
 * A NEGOTIATION IS NOT A CONVERSATION
 *
 * The offer's own history — every counter, every round, who moved and when —
 * lives on the card above this and is answered with Accept, Counter and
 * Decline. That is the record, and it must stay the record: nothing said here
 * changes a number, and this panel never shows a price or a button that
 * settles anything. It is for the half a price cannot carry — what the shot
 * should look like, when the product ships, whether the date still works.
 *
 * WHEN THERE IS NOBODY ON THE OTHER SIDE
 *
 * A sponsor who came through a public page with an email and a link has no
 * HOLD account. The server answers `peerId: null` and says why, and then the
 * honest thing is the contact they actually left — which the card already
 * shows — rather than a composer whose messages would go nowhere.
 */

import { useEffect, useState } from "react";

import { SafetyMenu, WordsOnly } from "@/components/app/payments/Chat";
import { Ion } from "@/components/app/ion";
import { useT } from "@/lib/app/i18n/react";
import { offerChat } from "@/lib/creator/listings";

type Peer =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; peerId: string; peerName: string }
  | { state: "no-account"; peerName: string }
  | { state: "failed" };

export function OfferChat({ offerId, sponsorName }: { offerId: string; sponsorName: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [peer, setPeer] = useState<Peer>({ state: "idle" });

  /*
   * Asked only when it is opened. The Offers screen draws a dozen of these at
   * once and none of them is what somebody came to the page for; a lookup per
   * card on mount would be twelve calls to learn eleven things nobody reads.
   */
  useEffect(() => {
    if (!open || peer.state !== "idle") return;
    let alive = true;
    setPeer({ state: "loading" });
    offerChat(offerId).then(
      (r) => {
        if (!alive) return;
        setPeer(
          r.peerId
            ? { state: "ready", peerId: r.peerId, peerName: r.peerName || sponsorName }
            : { state: "no-account", peerName: r.peerName || sponsorName },
        );
      },
      () => alive && setPeer({ state: "failed" }),
    );
    return () => {
      alive = false;
    };
  }, [open, peer.state, offerId, sponsorName]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex h-8 w-fit items-center gap-1.5 rounded-[10px] bg-white/[0.08] px-3 text-[12.5px] font-strong text-white/85 transition-colors hover:bg-white/[0.14]"
      >
        <Ion name="chatbubble-ellipses-outline" size={14} />
        {t("runner.chat.message")}
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[13.5px] font-strong text-white">
          {peer.state === "ready" || peer.state === "no-account" ? peer.peerName : sponsorName}
        </p>
        {peer.state === "ready" ? (
          <SafetyMenu peerId={peer.peerId} peerName={peer.peerName} onBlocked={() => setOpen(false)} />
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-strong text-white/70 transition-colors hover:text-white"
        >
          {t("common.close")}
        </button>
      </div>

      {peer.state === "loading" || peer.state === "idle" ? (
        <p className="py-4 text-center text-[13px] text-white/60">{t("runner.chat.opening")}</p>
      ) : null}

      {peer.state === "failed" ? (
        <p className="py-4 text-center text-[13px] text-white/70">{t("runner.chat.failed")}</p>
      ) : null}

      {peer.state === "no-account" ? (
        <p className="py-3 text-[13px] leading-[19px] text-white/70">
          {t("runner.chat.noAccount", { name: peer.peerName })}
        </p>
      ) : null}

      {peer.state === "ready" ? (
        <WordsOnly
          peerId={peer.peerId}
          peerName={peer.peerName}
          intro={t("runner.chat.intro", { name: peer.peerName })}
        />
      ) : null}
    </div>
  );
}

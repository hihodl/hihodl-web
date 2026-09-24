"use client";

/**
 * "Get the HOLD app": what somebody without a wallet made in the app sees.
 *
 * The web does not make wallets and does not pay by itself any more (Alex,
 * 2026-09-24). The wallet is made in the HOLD app, on an iPhone or an Android
 * phone, and the web opens that wallet; the phone approves every payment. So
 * wherever the web used to say "make your wallet here", it says this instead,
 * with both stores.
 *
 *   GetTheAppScreen   the whole page, in the shell's gate (Shell.tsx): the
 *                     look of InTheAppScreen, "I've made it, check again",
 *                     Sign out, and Spaces while it stays open without the app
 *   GetTheAppCard     the same words in a card, for a sheet or a screen that
 *                     needed a wallet (a spot's checkout, a stay's, Payout)
 */

import Link from "next/link";

import { signOut } from "@/lib/creator/session";

import { glass } from "../ui";
import { StoreButtons } from "./products";

export const GET_THE_APP = {
  title: "Get the HOLD app",
  body: "Your wallet is made in the HOLD app, on your iPhone or Android phone. Sign in there with this account, and the web opens the same wallet. Your phone approves every payment.",
};

export function GetTheAppCard({ title = GET_THE_APP.title, body = GET_THE_APP.body }: { title?: string; body?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-white/10 bg-white/[0.05] p-3.5">
      <div>
        <p className="text-[15px] font-strong text-white">{title}</p>
        <p className="mt-1 text-[13px] leading-[19px] text-white/70">{body}</p>
      </div>
      <StoreButtons />
    </div>
  );
}

export function GetTheAppScreen({
  checking = false,
  failed = false,
  onCheck,
  spacesHref,
}: {
  /** "Check again" is reading the status. */
  checking?: boolean;
  /** The status could not be read: the screen asks to retry, and lets nobody in. */
  failed?: boolean;
  onCheck: () => void;
  /** Spaces, while it stays open without the app (SPACES_OPEN_WITHOUT_APP). */
  spacesHref?: string | null;
}) {
  const small = "rounded-[8px] px-2 py-1 text-small text-[#9FB7C2] hover:bg-white/10 hover:text-text";
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-10">
      <section className={`${glass} flex w-full max-w-[560px] flex-col gap-5 p-6 sm:p-8`}>
        {failed ? (
          <>
            <div>
              <h1 className="text-[22px] font-medium leading-tight text-text">We couldn&apos;t open your account</h1>
              <p className="mt-2 text-body leading-relaxed text-[#CFE3EC]">Check your connection and try again.</p>
            </div>
            <button
              type="button"
              onClick={onCheck}
              disabled={checking}
              className="inline-flex h-11 items-center justify-center rounded-[12px] bg-amber px-5 text-small font-bold text-text-on-amber transition-colors hover:bg-amber-glow disabled:opacity-60"
            >
              {checking ? "Checking…" : "Retry"}
            </button>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-[22px] font-medium leading-tight text-text">{GET_THE_APP.title}</h1>
              <p className="mt-2 text-body leading-relaxed text-[#CFE3EC]">{GET_THE_APP.body}</p>
            </div>
            <div className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-small font-medium text-text">No wallet is made on the web</p>
              <p className="mt-0.5 text-tiny text-[#9FB7C2]">Make it once in the app. Then come back here and check again.</p>
            </div>
            <StoreButtons />
            <button
              type="button"
              onClick={onCheck}
              disabled={checking}
              className="inline-flex h-11 items-center justify-center rounded-[12px] bg-amber px-5 text-small font-bold text-text-on-amber transition-colors hover:bg-amber-glow disabled:opacity-60"
            >
              {checking ? "Checking…" : "I've made it, check again"}
            </button>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {spacesHref ? (
            <Link href={spacesHref} className={small}>
              Go to Spaces
            </Link>
          ) : (
            <span />
          )}
          <button type="button" onClick={() => void signOut()} className={small}>
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}

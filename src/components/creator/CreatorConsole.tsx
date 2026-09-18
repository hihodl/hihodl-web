/**
 * The creator console: your listings, where you get paid, your X account, and
 * an honest list of what is still missing.
 *
 * WHY THIS PAGE EXISTS AT ALL
 *
 * The app is on Play and not on the App Store, and most creators are on
 * iPhone. Every conversation with one of them ends at "download the app". It
 * does not have to: HiSpace is non-custodial by construction — the sponsor's
 * wallet pays the creator's address in one transaction the SPONSOR signs — so
 * a creator signs nothing on chain, ever. Publishing, approving the sponsor's
 * artwork, answering offers and marking work delivered are all API calls. A
 * creator needs an address, not a wallet we made.
 *
 * WHAT THIS PAGE IS NOT
 *
 * It is not a wallet, and no part of it will ever become one. Nothing here
 * generates a key, holds a key, stores key material or asks for a phrase.
 *
 * THE READER IS THE CREATOR
 *
 * Unlike the public space page, nobody is being sold to here. The copy says
 * what is true, including the parts that are inconvenient, and it never makes
 * a step sound smaller than it is.
 */

"use client";

import { useState } from "react";

import { btnSmallSecondary } from "@/components/ad-space/ui";
import { signOut, useCreatorSession } from "@/lib/creator/session";
import type { PayoutAddressView, XAccountStatus } from "@/lib/creator/types";

import { Listings } from "./Listings";
import { PayoutAddress } from "./PayoutAddress";
import { ReadyToPublish } from "./ReadyToPublish";
import { Sales } from "./Sales";
import { SignIn } from "./SignIn";
import { TeamEntry, WaitingSeat } from "./team/Entry";
import { XAccount } from "./XAccount";

export function CreatorConsole() {
  const { session, configured } = useCreatorSession();
  const [x, setX] = useState<XAccountStatus | null>(null);
  const [payout, setPayout] = useState<PayoutAddressView | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-6 py-18">
      <header className="flex flex-col gap-3">
        <h1 className="text-h3 font-light text-text">Sell what you are already doing</h1>
        <p className="text-lead font-light text-text-muted">
          Brands pay you in USDC, straight to your own wallet. Set your account up here, build a listing, and run it —
          all of it from this page, with no app.
        </p>
      </header>

      {/* `undefined` means we have not finished reading the stored session.
          Rendering the sign-in form here would flash "sign in" at somebody who
          already is. */}
      {session === undefined ? (
        <p className="text-small text-text-muted">Checking whether you are signed in…</p>
      ) : session === null ? (
        <SignIn configured={configured} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-small text-text-muted">
            <span>
              Signed in as <span className="text-text">{session.user.email}</span>
            </span>
            <button type="button" className={btnSmallSecondary} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>

          <WaitingSeat />
          <Listings />
          <Sales />
          <TeamEntry />
          <PayoutAddress onChange={setPayout} />
          <XAccount onChange={setX} />
          <ReadyToPublish x={x} payout={payout} />
        </>
      )}
    </div>
  );
}

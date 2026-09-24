"use client";

/**
 * Link your phone, any time: app.hihodl.xyz/wallet/link.
 *
 * The same LinkPhone as onboarding's step, in the product's frame with a
 * Back, and nothing in the way: no trip through /welcome (which bounces
 * anybody with nothing left to onboard), no gate (a wallet made in the app
 * links its phone here too). documentation/one-wallet-every-device.md, rule 5.
 *
 * It lives under /wallet, with that page's strict CSP, so the way in and the
 * way out are full page loads.
 *
 *   ?next=   where Back and Continue go (same-origin only); else Account →
 *            Your phone, where the linked phones are listed
 */

import { useCallback } from "react";

import { useT } from "@/lib/app/i18n/react";
import { safeNext } from "@/lib/app/paths";

import { useProductHref } from "../base";
import { BackHeader, Column } from "../hold";
import { LinkPhone } from "./LinkPhone";

export function LinkScreen() {
  const t = useT();
  const productHref = useProductHref();
  const leave = useCallback(() => {
    const raw = new URLSearchParams(window.location.search).get("next");
    window.location.assign(safeNext(raw, window.location.origin) ?? productHref("/account?view=phone"));
  }, [productHref]);

  return (
    <Column>
      <BackHeader title={t("link.linkYourPhone")} onBack={leave} />
      <div className="px-1">
        <LinkPhone onDone={leave} />
      </div>
    </Column>
  );
}

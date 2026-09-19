"use client";

/**
 * The two parts Savings and Invest share.
 *
 * Both screens are view only, and both of them draw rows the app makes
 * tappable — supplying to a venue, buying a coin, getting a card. Rather than
 * delete the row (which would be a different screen) or dress it as a button
 * that cannot finish, the row is drawn as the app draws it and says where the
 * action happens. Same tone as `main/InTheAppScreen`: what it is, that it
 * lives in the app, and nothing pretended.
 */

import type { ReactNode } from "react";

import { Ion } from "../ion";

/** The quiet plate under a row whose action is a signature. */
export function InAppNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <Ion name="phone-portrait-outline" size={16} className="mt-px shrink-0 text-white/[0.55]" />
      <p className="flex-1 text-[12.5px] leading-[18px] text-white/[0.8]">{children}</p>
    </div>
  );
}

/**
 * The app's `RemoteTokenIcon` fallback: a disc in the wallet's placeholder ink
 * with the asset's first letter. The app fetches a logo from its catalogue
 * before falling back to this; the web has no catalogue and will not call a
 * third-party CDN from the page, so every asset but the ones we ship a mark for
 * wears the letter.
 */
export function AssetMark({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const local = symbol.toUpperCase() === "SOL" ? "/pay/solana.svg" : null;
  if (local) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={local} alt="" width={size} height={size} className="shrink-0 rounded-full" style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-[#1B2A33] font-extrabold text-[#9DB4BF]"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {(symbol || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

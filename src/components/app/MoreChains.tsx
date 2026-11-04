"use client";

/**
 * On the web a creator is paid on Solana. Base and Polygon come with the HOLD
 * app's wallet, so wherever the web would have offered them it says so in one
 * line instead of asking for MetaMask.
 *
 * The link is the store of the device the page is open on: an iPhone to the
 * App Store, an Android phone to Google Play, and a computer both, since the
 * app goes on the phone and we cannot know which one that is.
 */

import { useEffect, useState, type ReactNode } from "react";

import { Rich } from "@/lib/app/i18n/react";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";
import { thisDevice, type Phone } from "@/lib/link/ua";

const linkCls = "text-[#CFE3EC] underline decoration-white/30 underline-offset-2 hover:text-text";

function StoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkCls}>
      {children}
    </a>
  );
}

export function MoreChainsLine({ className = "" }: { className?: string }) {
  // Read after mount: the server has no user agent to go on, and a first
  // render that disagreed with the browser's would be a hydration mismatch.
  const [phone, setPhone] = useState<Phone | null>(null);
  useEffect(() => setPhone(thisDevice().phone), []);

  return (
    <p className={`text-tiny text-[#9FB7C2] ${className}`}>
      {phone === "ios" || phone === "android" ? (
        <Rich
          k="shell.moreChains.oneStore"
          tags={{ link: (c) => <StoreLink href={phone === "ios" ? APP_STORE_URL : PLAY_STORE_URL}>{c}</StoreLink> }}
        />
      ) : (
        <Rich
          k="shell.moreChains.bothStores"
          tags={{
            appStore: (c) => <StoreLink href={APP_STORE_URL}>{c}</StoreLink>,
            play: (c) => <StoreLink href={PLAY_STORE_URL}>{c}</StoreLink>,
          }}
        />
      )}
    </p>
  );
}

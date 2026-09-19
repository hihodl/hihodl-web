"use client";

/**
 * Account: the person, not a checklist.
 *
 * Home is three cards, each opening its own screen with a Back (the screen is
 * in the URL, `?view=`, so the browser's Back works too):
 *
 *   Profile   photo, name, @username, email, plan          → ?view=profile
 *   X         the account listings publish under           → ?view=x
 *   Payout    where sponsors pay you: your HOLD wallet     → ?view=payout
 *             another wallet, only behind its own screen   → ?view=other-wallet
 *   Phone     the phones that approve withdrawals          → ?view=phone
 *
 * Whether a listing can be published, and the Creative Director switch, are
 * Spaces' business and live in Spaces' settings.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { useProductHref } from "../base";
import { OtherWallet, PayoutCard, PayoutScreen } from "./Payout";
import { PhoneCard, PhoneScreen } from "./PhoneScreen";
import { ProfileCard, ProfileEdit } from "./Profile";
import { XCard, XScreen } from "./XScreen";

export type AccountView = "home" | "profile" | "x" | "payout" | "other-wallet" | "phone";

const VIEWS: readonly AccountView[] = ["profile", "x", "payout", "other-wallet", "phone"];

export function useAccountView(): [AccountView, (v: AccountView) => void, () => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("view") as AccountView | null;
  const view: AccountView = raw && VIEWS.includes(raw) ? raw : "home";
  const open = useCallback((v: AccountView) => router.push(v === "home" ? pathname : `${pathname}?view=${v}`, { scroll: false }), [router, pathname]);
  const back = useCallback(() => {
    // One level up: another wallet's screen belongs to Payout's.
    open(view === "other-wallet" ? "payout" : "home");
  }, [open, view]);
  return [view, open, back];
}

export function AccountScreen() {
  const [view, open, back] = useAccountView();
  const productHref = useProductHref();

  if (view === "profile") return <Centred><ProfileEdit onBack={back} /></Centred>;
  if (view === "x") return <Centred><XScreen onBack={back} /></Centred>;
  if (view === "payout") return <Centred><PayoutScreen onBack={back} onOther={() => open("other-wallet")} walletHref={productHref("/wallet")} /></Centred>;
  if (view === "other-wallet") return <Centred><OtherWallet onBack={back} /></Centred>;
  if (view === "phone") {
    const linkHref = `${productHref("/welcome")}?next=${encodeURIComponent(`${productHref("/account")}?view=phone`)}`;
    return <Centred><PhoneScreen onBack={back} linkHref={linkHref} /></Centred>;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
      <div className="lg:col-span-2">
        <ProfileCard onOpen={() => open("profile")} />
      </div>
      <XCard onOpen={() => open("x")} />
      <PayoutCard onOpen={() => open("payout")} walletHref={productHref("/wallet")} />
      <PhoneCard onOpen={() => open("phone")} />
    </div>
  );
}

/** A screen opened from a card: one column, in the middle. */
function Centred({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center py-2">{children}</div>;
}

"use client";

/**
 * Account: the app's Profile hub (app/(drawer)/(internal)/profile/index.tsx)
 * on the web. The same order, the same parts:
 *
 *   hero      the avatar, big and centred, and the @handle   → ?view=profile
 *   General   Username                                       → ?view=username
 *             Display name (web only: public pages print it)  → ?view=profile
 *   Account   Account (the sign-in email)                    → ?view=account
 *             X account                                      → ?view=x
 *             Where you get paid (web: the creator's payout)  → ?view=payout
 *                another wallet, behind its own screen       → ?view=other-wallet
 *
 * Each row opens its own screen with a Back (the screen is in the URL, so the
 * browser's Back works too). The phones that approve withdrawals live where
 * the app keeps them, in Settings › Security; their screen is still here
 * (?view=phone), where links already point.
 *
 * Left out, and why: the app's "Not verified" chip and "Verify identity"
 * button (identity checks are not on the web, and the app itself always shows
 * "not verified" today), and Profile visibility (an app preference the web
 * has nothing behind).
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { chosenUsername } from "@/lib/app/me";
import { useMe, useX } from "@/lib/app/spaces-data";

import { useProductHref } from "../base";
import { Column, HoldCard, MenuRow, SectionTitle } from "../hold";
import { useShell } from "../Shell";
import { AccountDetails } from "./AccountDetails";
import { OtherWallet, PayoutScreen, usePayoutSummary } from "./Payout";
import { PhoneScreen } from "./PhoneScreen";
import { ProfileEdit, ProfileHero, UsernameScreen } from "./Profile";
import { XScreen } from "./XScreen";

export type AccountView = "home" | "profile" | "username" | "account" | "x" | "payout" | "other-wallet" | "phone";

const VIEWS: readonly AccountView[] = ["profile", "username", "account", "x", "payout", "other-wallet", "phone"];

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
  const router = useRouter();

  if (view === "profile") return <ProfileEdit onBack={back} />;
  if (view === "username") return <UsernameScreen onBack={back} />;
  if (view === "account") return <AccountDetails onBack={back} />;
  if (view === "x") return <XScreen onBack={back} />;
  if (view === "payout") return <PayoutScreen onBack={back} onOther={() => open("other-wallet")} walletHref={productHref("/wallet")} />;
  if (view === "other-wallet") return <OtherWallet onBack={back} />;
  if (view === "phone") {
    const linkHref = `${productHref("/welcome")}?next=${encodeURIComponent(`${productHref("/account")}?view=phone`)}`;
    // Its row is in Settings › Security, as in the app, so Back goes there.
    return <PhoneScreen onBack={() => router.push(productHref("/settings?screen=security"), { scroll: false })} linkHref={linkHref} />;
  }
  return <AccountHome open={open} />;
}

function AccountHome({ open }: { open: (v: AccountView) => void }) {
  const { session } = useShell();
  const me = useMe();
  const x = useX();
  const payout = usePayoutSummary();
  const username = chosenUsername(me.data);
  const handle = username ? `@${username}` : "@—";
  const linked = x.data?.linked ? x.data : null;
  const email = me.data?.email ?? session.user.email ?? null;

  return (
    <Column>
      <ProfileHero onAvatar={() => open("profile")} />

      <SectionTitle first>General</SectionTitle>
      <HoldCard>
        <MenuRow icon="at-outline" label="Username" value={me.data ? handle : undefined} onClick={() => open("username")} />
        {/* Web only: the name a creator's public pages print. */}
        <MenuRow icon="id-card-outline" label="Display name" value={me.data ? me.data.profile.displayName || "Add your name" : undefined} onClick={() => open("profile")} />
      </HoldCard>

      <SectionTitle>Account</SectionTitle>
      <HoldCard>
        <MenuRow icon="person-outline" label="Account" sub={email ?? "Not set"} chevron onClick={() => open("account")} />
        <MenuRow
          icon="logo-x"
          label="X account"
          value={x.data === undefined ? undefined : linked ? `@${linked.handle}${linked.verifiedType ? " ✓" : ""}` : "Connect X"}
          attention={!!x.data && linked !== null && !x.data.canPublish}
          chevron={x.data === undefined}
          onClick={() => open("x")}
        />
        <MenuRow
          icon="wallet-outline"
          label="Where you get paid"
          value={payout.value ?? undefined}
          attention={payout.attention}
          chevron={payout.value === null}
          onClick={() => open("payout")}
        />
      </HoldCard>
    </Column>
  );
}

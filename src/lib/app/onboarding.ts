/**
 * Onboarding on the web: the essentials of the app's, nothing native.
 *
 * The app's setup (hihodl-wallet/app/onboarding/setup.tsx) asks for a
 * username, a passkey, the recovery codes by email, a PIN, notifications and
 * the smart account. The web keeps four:
 *
 *   username   the same claim (PATCH /me aliasHandle) and rules; then name and
 *              photo, optional
 *   passkey    registered through /passkeys/register/* with the session
 *   recovery   /recovery-codes/generate-and-email, only when /status says the
 *              account has no active codes (never re-emails somebody's codes)
 *   wallet     where the wallet is made depends on the phone
 *              (documentation/one-wallet-every-device.md, rule 2): an iPhone
 *              or a computer makes the Solana web wallet here with a passkey,
 *              when /wallet-backup/status says enabled and state none; an
 *              Android phone is offered the Google Play app first (it makes
 *              the wallet with every chain), with "Make it here instead".
 *              `app_wallet` shows a note; a closed gate skips it, except on
 *              Android, where the app is still the way to a wallet
 *   link       link your phone (documentation/link-your-phone-and-approved-
 *              withdrawals.md): offered with "Later", never a toll, and only
 *              while onboarding runs for something else
 *
 * Every "is it done" is read from the server, so a person who finished these
 * in the app goes straight in, and somebody who closed the tab half-way
 * comes back to the first step still missing. Only two choices live in this
 * browser: "not now" on the optional name and photo, and on the wallet.
 */

"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { activeLinkedDevices } from "@/lib/link/api";
import { thisDevice, type Phone } from "@/lib/link/ua";
import { getWalletStatus, listPasskeys, type WalletStatus } from "@/lib/wallet/api";
import { passkeysHere } from "@/lib/wallet/passkey";

import { chosenUsername, getMe, recoveryCodesStatus, type Me } from "./me";

export type StepKey = "username" | "profile" | "passkey" | "recovery" | "wallet" | "app-wallet" | "link";

export interface Facts {
  me: Me;
  username: string | null;
  hasPasskey: boolean;
  passkeyIds: string[];
  hasCodes: boolean;
  /** null when it could not be read: treated as a closed gate. */
  wallet: WalletStatus | null;
  /** Can this page run a passkey ceremony at all (an origin under hihodl.xyz, a browser that does WebAuthn)? */
  canPasskey: boolean;
  /**
   * How many phones are linked and not revoked. null when it could not be
   * read (an older backend): then the link step is not asked, rather than
   * asked of a server that cannot finish it.
   */
  linkedPhones: number | null;
  /** The phone this page is on (lib/link/ua); null on a computer. */
  phone: Phone | null;
}

export interface Choices {
  /** Name and photo: "Skip". */
  profile?: boolean;
  /** The wallet: "Not now". */
  wallet?: boolean;
  /** The "your wallet is in the HOLD app" note, once read. */
  appWallet?: boolean;
}

// v2: linking a phone became a step, so everybody onboarded before it is asked once more.
const doneKey = (uid: string) => `hold-onboarded:v2:${uid}`;
const choicesKey = (uid: string) => `hold-onboarding:${uid}`;

export function readChoices(uid: string): Choices {
  try {
    return JSON.parse(window.localStorage.getItem(choicesKey(uid)) ?? "{}") as Choices;
  } catch {
    return {};
  }
}

export function saveChoice(uid: string, choice: keyof Choices): void {
  try {
    window.localStorage.setItem(choicesKey(uid), JSON.stringify({ ...readChoices(uid), [choice]: true }));
  } catch {
    /* asked again next time */
  }
}

export function markOnboarded(uid: string): void {
  try {
    window.localStorage.setItem(doneKey(uid), "1");
  } catch {
    /* checked again next time: four quick reads */
  }
}

function isOnboarded(uid: string): boolean {
  try {
    return window.localStorage.getItem(doneKey(uid)) === "1";
  } catch {
    return false;
  }
}

export async function readFacts(): Promise<Facts> {
  const canPasskey = passkeysHere();
  const [me, passkeys, codes, wallet, phones] = await Promise.all([
    getMe(),
    listPasskeys(),
    recoveryCodesStatus(),
    getWalletStatus().catch(() => null),
    activeLinkedDevices().then(
      (d) => d.length,
      () => null,
    ),
  ]);
  return {
    me,
    username: chosenUsername(me),
    hasPasskey: passkeys.length > 0,
    passkeyIds: passkeys.map((p) => p.id),
    hasCodes: codes.hasActiveCodes,
    wallet,
    canPasskey,
    linkedPhones: phones,
    phone: thisDevice().phone,
  };
}

/**
 * Linking a phone is an UPGRADE, never a toll.
 *
 * This was going to become mandatory with the Play release — the server
 * answered LINK_YOUR_PHONE_FIRST, so onboarding made sure everybody had one.
 * That reasoning died with the server's: a withdrawal is now approved by a
 * passkey bound to it, and a linked Android phone only buys the stronger
 * version of an approval everybody can already give (chooseChannel, and the
 * note above it).
 *
 * Turning it on now would re-lock the exact people the server just let in:
 * somebody who made their wallet in the browser, on a laptop, with no HOLD
 * app anywhere — who cannot link, because linking needs the app on the phone
 * they do not have. They would be stopped at the last step of onboarding with
 * nothing to do about it.
 *
 * So it is not required. It still rides along when onboarding is running for
 * another reason — on Android that step is how the phone receives the wallet
 * made moments before — and it is offered for good from Account → Your phone.
 */

/** Whether the web wallet is one this person should be offered now. */
export function walletToMake(f: Facts): boolean {
  const w = f.wallet;
  return f.canPasskey && !!w && w.enabled !== false && w.state === "none" && w.email_verified;
}

/**
 * Whether the wallet step leads with "Get HOLD on Google Play": an Android
 * phone with no wallet anywhere. Asked even when the web cannot make one
 * (a closed gate, no passkey here), because the app can.
 */
export function playFirst(f: Facts): boolean {
  return f.phone === "android" && !!f.wallet && f.wallet.state === "none";
}

/**
 * The steps still to do, in order. Empty means straight in.
 *
 * Name and photo ride along only when there is something else to do anyway,
 * and the app-wallet note only when onboarding runs for another reason: a
 * person who finished in the app is never stopped for either.
 */
export function stepsFor(f: Facts, c: Choices): StepKey[] {
  const required: StepKey[] = [];
  if (!f.username) required.push("username");
  if (f.canPasskey && !f.hasPasskey) required.push("passkey");
  if (!f.hasCodes) required.push("recovery");
  if ((walletToMake(f) || playFirst(f)) && !c.wallet) required.push("wallet");
  if (required.length === 0) return [];

  const out: StepKey[] = [];
  if (required.includes("username")) out.push("username");
  if (!f.me.profile.displayName && !f.me.profile.avatarUrl && !c.profile) out.push("profile");
  if (required.includes("passkey")) out.push("passkey");
  if (required.includes("recovery")) out.push("recovery");
  if (required.includes("wallet")) out.push("wallet");
  else if (f.wallet?.state === "app_wallet" && f.wallet.enabled !== false && !c.appWallet) out.push("app-wallet");
  // Last, and only while we are here anyway: on Android this step is how the
  // phone receives the wallet made moments before. Nobody is held up by it —
  // if it were the only thing left, `required` would have been empty and this
  // function would already have returned.
  if (f.linkedPhones === 0) out.push("link");
  return out;
}

export type Door = "checking" | "in" | "onboarding";

/**
 * The shell asks this once per person per browser: in, or to onboarding.
 *
 * A read that fails lets the person in (and asks again next time): the
 * essentials are how an account is protected, not a lock on Spaces, and a
 * slow backend must not keep a creator out of their listings.
 */
export function useDoor(session: Session, skip: boolean): Door {
  const uid = session.user.id;
  const [door, setDoor] = useState<{ uid: string; value: Door } | null>(null);

  useEffect(() => {
    if (skip) return;
    if (isOnboarded(uid)) {
      setDoor({ uid, value: "in" });
      return;
    }
    let alive = true;
    readFacts().then(
      (f) => {
        if (!alive) return;
        const steps = stepsFor(f, readChoices(uid));
        if (steps.length === 0) markOnboarded(uid);
        setDoor({ uid, value: steps.length === 0 ? "in" : "onboarding" });
      },
      () => alive && setDoor({ uid, value: "in" }),
    );
    return () => {
      alive = false;
    };
  }, [uid, skip]);

  if (skip) return "in";
  return door && door.uid === uid ? door.value : "checking";
}

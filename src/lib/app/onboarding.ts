/**
 * Onboarding on the web: the essentials of the app's, nothing native, and
 * never a wallet.
 *
 * The app's setup (hihodl-wallet/app/onboarding/setup.tsx) asks for a
 * username, a passkey, the recovery codes by email, a PIN, notifications and
 * the smart account, and it makes the wallet. The web makes no wallet (Alex,
 * 2026-09-24): the wallet is made in the HOLD app, and the signed-in product
 * asks for it first (lib/app/app-wallet-gate, the shell's gate). What the web
 * still asks, for an account that lacks it:
 *
 *   username   the same claim (PATCH /me aliasHandle) and rules; then name and
 *              photo, optional
 *   passkey    registered through /passkeys/register/* with the session: a
 *              sign-in key, and what removes a linked phone from the web. It
 *              makes no wallet
 *   recovery   /recovery-codes/generate-and-email, only when /status says the
 *              account has no active codes (never re-emails somebody's codes)
 *   link       link your phone (documentation/link-your-phone-and-approved-
 *              withdrawals.md): offered with "Later", and only while
 *              onboarding runs for something else
 *
 * Every "is it done" is read from the server, so a person who finished these
 * in the app goes straight in, and somebody who closed the tab half-way
 * comes back to the first step still missing. Only one choice lives in this
 * browser: "not now" on the optional name and photo.
 */

"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { activeLinkedDevices } from "@/lib/link/api";
import { thisDevice, type Phone } from "@/lib/link/ua";
import { getWalletStatus, listPasskeys } from "@/lib/wallet/api";
import { passkeysHere } from "@/lib/wallet/passkey";

import { hasAppWallet } from "./app-wallet-gate";
import { chosenUsername, getMe, recoveryCodesStatus, type Me } from "./me";

export type StepKey = "username" | "profile" | "passkey" | "recovery" | "link";

export interface Facts {
  me: Me;
  username: string | null;
  hasPasskey: boolean;
  passkeyIds: string[];
  hasCodes: boolean;
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
}

// v2: linking a phone became a step, so everybody onboarded before it is asked once more.
// The wallet from the app is never read from this mark: the shell asks the server every load.
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
  const [me, passkeys, codes, phones] = await Promise.all([
    getMe(),
    listPasskeys(),
    recoveryCodesStatus(),
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
    canPasskey,
    linkedPhones: phones,
    phone: thisDevice().phone,
  };
}

/**
 * Linking a phone is offered, never a toll, inside onboarding: somebody with
 * the app and nothing linked yet still gets into the product, where every
 * payment asks for the phone in one sheet (link/LinkGate) and Home asks once
 * (LinkPhoneNudge). It rides along only while onboarding runs for another
 * reason, and Menu → Security links one any time.
 */

/**
 * The steps still to do, in order. Empty means straight in.
 *
 * Name and photo ride along only when there is something else to do anyway:
 * a person who finished in the app is never stopped for them.
 */
export function stepsFor(f: Facts, c: Choices): StepKey[] {
  const required: StepKey[] = [];
  if (!f.username) required.push("username");
  if (f.canPasskey && !f.hasPasskey) required.push("passkey");
  if (!f.hasCodes) required.push("recovery");
  if (required.length === 0) return [];

  const out: StepKey[] = [];
  if (required.includes("username")) out.push("username");
  if (!f.me.profile.displayName && !f.me.profile.avatarUrl && !c.profile) out.push("profile");
  if (required.includes("passkey")) out.push("passkey");
  if (required.includes("recovery")) out.push("recovery");
  // Last, and only while we are here anyway. Nobody is held up by it: if it
  // were the only thing left, `required` would have been empty and this
  // function would already have returned.
  if (f.linkedPhones === 0) out.push("link");
  return out;
}

export type Door = "checking" | "in" | "onboarding" | "get-app" | "failed";

/** People seen with a wallet from the app in this page's life: the check is not asked again on every navigation. */
const appWalletSeen = new Set<string>();

export interface DoorState {
  door: Door;
  /** A check is running (the first, or "check again"). */
  checking: boolean;
  /** Read the wallet again: "I've made it, check again", and Retry. */
  recheck: () => void;
}

/**
 * The shell asks this on the way in: in, to onboarding, or "Get the HOLD app".
 *
 * `needsApp`: this page is part of the product that needs a wallet made in
 * the app (lib/app/app-wallet-gate). Then GET /wallet-backup/status is read
 * EVERY time the page loads, before anything else and never skipped by the
 * "onboarded" mark this browser keeps: anything but `app_wallet` is
 * "get-app", and a read that fails is "failed" (a Retry, never access).
 *
 * Onboarding is decided once per person per browser. A read that fails there
 * lets the person in (and asks again next time): the essentials are how an
 * account is protected, and a slow backend must not keep them out.
 */
export function useDoor(session: Session, skip: boolean, needsApp: boolean): DoorState {
  const uid = session.user.id;
  const key = `${uid}|${needsApp ? "app" : "open"}`;
  const [door, setDoor] = useState<{ key: string; uid: string; value: Door } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (skip) return;
    let alive = true;
    setChecking(true);
    const settle = (value: Door) => {
      if (!alive) return;
      setDoor({ key, uid, value });
      setChecking(false);
    };
    void (async () => {
      if (needsApp && !appWalletSeen.has(uid)) {
        let ok: boolean;
        try {
          ok = hasAppWallet(await getWalletStatus());
        } catch {
          return settle("failed");
        }
        if (!ok) return settle("get-app");
        appWalletSeen.add(uid);
      }
      if (isOnboarded(uid)) return settle("in");
      try {
        const f = await readFacts();
        const steps = stepsFor(f, readChoices(uid));
        if (steps.length === 0) markOnboarded(uid);
        settle(steps.length === 0 ? "in" : "onboarding");
      } catch {
        settle("in");
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid, key, skip, needsApp, attempt]);

  const recheck = useCallback(() => setAttempt((n) => n + 1), []);

  if (skip) return { door: "in", checking: false, recheck };
  let value: Door = "checking";
  if (door && door.key === key) value = door.value;
  // Moving from an open page (Spaces) into the product, for somebody already
  // seen with a wallet from the app: stay in while the effect agrees, rather
  // than blank the whole shell for a frame.
  else if (door && door.uid === uid && door.value === "in" && (!needsApp || appWalletSeen.has(uid))) value = "in";
  return { door: value, checking, recheck };
}

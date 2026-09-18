/**
 * The creator's session, which is the only credential in this console.
 *
 * WHY SUPABASE AND NOT THE WAITLIST TOKEN
 *
 * The backend is a Supabase-JWT API (`server/middleware/auth.ts`): every call
 * the console makes is authorised by the access token of a Supabase session.
 * The waitlist token in `lib/clientAuth.ts` opens our own /api routes and
 * nothing on the backend, so it is no use here.
 *
 * WHY A SINGLETON AND NOT `createSupabaseClient()`
 *
 * `lib/supabase.ts` builds a fresh client per call, which is right for a
 * server route that makes one query. Auth is the opposite: the client owns the
 * stored session, refreshes it on a timer and emits the change events this
 * console listens to. Two clients over one storage key is two refresh loops
 * racing each other, and supabase-js says so out loud. So there is exactly one.
 *
 * WHY IT RETURNS NULL RATHER THAN THROWING
 *
 * A deploy without the Supabase variables should say "sign-in is not set up
 * here" on the page, not fall over in a render. The console shows that
 * sentence and stops.
 */

"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { clientSpacesBase } from "@/lib/app/paths";

/** `undefined` = not built yet, `null` = not configured on this deploy. */
let client: SupabaseClient | null | undefined;

export function creatorAuth(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client =
    url && key
      ? createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            // A creator who clicked the link in the email instead of typing
            // the code lands back here with the session in the URL fragment.
            // Both ways in have to work: we do not control which of the two
            // the project's email template offers.
            detectSessionInUrl: true,
            // Our own key, so a session here is never confused with one a
            // future page on this origin stores under the library default.
            storageKey: "hold-creator-auth",
          },
        })
      : null;
  return client;
}

export interface CreatorSession {
  /** Null once we know there is none; undefined while we are still looking. */
  session: Session | null | undefined;
  /** False when this deploy has no Supabase configured at all. */
  configured: boolean;
}

/**
 * The session as the page should render it.
 *
 * `undefined` until the stored session has been read, because the first paint
 * of a signed-in creator must not be the sign-in form: the console would flash
 * "sign in" at somebody who already has.
 */
export function useCreatorSession(): CreatorSession {
  const auth = creatorAuth();
  const [session, setSession] = useState<Session | null | undefined>(auth ? undefined : null);

  useEffect(() => {
    if (!auth) return;
    let alive = true;
    void auth.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const { data } = auth.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [auth]);

  return { session, configured: auth !== null };
}

/**
 * Email a one-time code.
 *
 * `shouldCreateUser` is left on: a creator whose only HOLD account is this one
 * is exactly who this console is for — the whole point is that they never had
 * to install the app. `emailRedirectTo` is where a link-style email lands, and
 * it has to be on the project's redirect allow-list for that half to work:
 * https://app.hihodl.xyz/spaces in production (see lib/app/paths).
 */
export async function sendSignInCode(email: string): Promise<void> {
  const auth = creatorAuth();
  if (!auth) throw new Error("not_configured");
  const { error } = await auth.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: typeof window === "undefined" ? undefined : `${window.location.origin}${clientSpacesBase()}`,
    },
  });
  if (error) throw error;
}

/** The six digits from the email. `type: "email"` covers a new account and a returning one alike. */
export async function verifySignInCode(email: string, token: string): Promise<void> {
  const auth = creatorAuth();
  if (!auth) throw new Error("not_configured");
  const { error } = await auth.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email" });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await creatorAuth()?.auth.signOut();
}

/**
 * A fresh access token for one call.
 *
 * Read from the client rather than held in a variable: it expires in an hour
 * and the library refreshes it underneath us, so anything we cached would be
 * the stale copy at exactly the wrong moment.
 */
export async function accessToken(): Promise<string | null> {
  const auth = creatorAuth();
  if (!auth) return null;
  const { data } = await auth.auth.getSession();
  return data.session?.access_token ?? null;
}

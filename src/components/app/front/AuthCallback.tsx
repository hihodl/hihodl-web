"use client";

/**
 * Where Apple and Google send the browser back: app.hihodl.xyz/auth/callback.
 *
 * The Supabase client exchanges the one-time `?code=` for a session as it
 * starts (PKCE, `detectSessionInUrl`), because this browser holds the
 * verifier. This page only waits for that, then goes where the person was
 * going (lib/auth/providers `takeNext`, same-origin paths only) or to the
 * Dashboard. A provider that refused (`?error=`) or a code that
 * could not be exchanged says so in one line, with a way back.
 */

import { useEffect, useState } from "react";

import { clientProductBase } from "@/lib/app/paths";
import { takeNext } from "@/lib/auth/providers";
import { creatorDemoEnabled, demoSignIn } from "@/lib/creator/demo";
import { creatorAuth } from "@/lib/creator/session";

import { btnPrimary, DoorCard, HoldMark, Note, Warn } from "./kit";

export function AuthCallback() {
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const providerError = params.get("error_description") || params.get("error");
    const auth = creatorAuth();

    // Demo mode: whoever came back is signed in.
    if (creatorDemoEnabled()) {
      demoSignIn();
      window.location.replace(takeNext(clientProductBase() || "/"));
      return;
    }

    void (async () => {
      if (!auth) {
        if (alive) setFailed("Sign-in is not set up on this deployment.");
        return;
      }
      // getSession waits for the client's start-up, which is where the code is exchanged.
      const { data } = await auth.auth.getSession();
      if (!alive) return;
      if (data.session) {
        window.location.replace(takeNext(clientProductBase() || "/"));
        return;
      }
      setFailed(
        providerError && /cancel|denied|access_denied/i.test(providerError)
          ? "You closed the sign-in before it finished. Nothing changed."
          : "That sign-in did not go through. It can happen when the page was opened in another browser. Try again from here.",
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-10">
      <DoorCard>
        <HoldMark />
        <div className="mt-8 flex flex-col gap-4">
          {failed ? (
            <>
              <h1 className="text-h4 font-light text-text">Sign in</h1>
              <Warn>{failed}</Warn>
              <div>
                <a href={clientProductBase() || "/"} className={btnPrimary}>
                  Back to sign in
                </a>
              </div>
            </>
          ) : (
            <Note>Signing you in…</Note>
          )}
        </div>
      </DoorCard>
    </div>
  );
}

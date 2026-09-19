"use client";

/**
 * Where Apple and Google send the browser back: app.hihodl.xyz/auth/callback.
 *
 * The Supabase client exchanges the one-time `?code=` for a session as it
 * starts (PKCE, `detectSessionInUrl`), because this browser holds the
 * verifier. This page only waits for that, then goes where the person was
 * going (lib/auth/providers `takeNext`, same-origin paths only) or to the
 * Dashboard. A provider that refused (`?error=`) or a code that
 * could not be exchanged says so in one line, with a way back. Drawn as the
 * app's own callback (hihodl-wallet/app/auth/callback.tsx).
 */

import { useEffect, useState } from "react";

import { clientProductBase } from "@/lib/app/paths";
import { takeNext } from "@/lib/auth/providers";
import { creatorDemoEnabled, demoSignIn } from "@/lib/creator/demo";
import { creatorAuth } from "@/lib/creator/session";

import { ErrorBanner, Spinner } from "./step";

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

  // app/auth/callback.tsx: the amber spinner and one line on the welcome's ground.
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-5 px-6 py-10">
      {failed ? (
        <div className="flex w-full max-w-[400px] flex-col gap-4">
          <ErrorBanner>{failed}</ErrorBanner>
          <a
            href={clientProductBase() || "/"}
            className="flex h-[58px] w-full items-center justify-center rounded-[29px] bg-amber text-[17px] font-extrabold tracking-[-0.2px] text-[#0A1117] shadow-[0_6px_20px_rgba(255,183,3,0.2)] transition-colors hover:bg-amber-glow"
          >
            Back to sign in
          </a>
        </div>
      ) : (
        <>
          <Spinner color="#FFB703" size={36} />
          <p className="text-center text-[17px] font-semibold text-white">Completing sign in...</p>
        </>
      )}
    </div>
  );
}

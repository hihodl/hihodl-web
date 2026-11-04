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

import type { MessageKey } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
import { clientProductBase } from "@/lib/app/paths";
import { takeNext } from "@/lib/auth/providers";
import { creatorAuth } from "@/lib/creator/session";

import { ErrorBanner, Spinner } from "./step";

export function AuthCallback() {
  const t = useT();
  const [failed, setFailed] = useState<MessageKey | null>(null);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const providerError = params.get("error_description") || params.get("error");
    const auth = creatorAuth();

    void (async () => {
      if (!auth) {
        if (alive) setFailed("front.callback.notSetUp");
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
          ? "front.callback.cancelled"
          : "front.callback.failed",
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
          <ErrorBanner>{t(failed)}</ErrorBanner>
          <a
            href={clientProductBase() || "/"}
            className="flex h-[58px] w-full items-center justify-center rounded-[29px] bg-amber text-[17px] font-extrabold tracking-[-0.2px] text-[#0A1117] shadow-[0_6px_20px_rgba(255,183,3,0.2)] transition-colors hover:bg-amber-glow"
          >
            {t("front.callback.backToSignIn")}
          </a>
        </div>
      ) : (
        <>
          <Spinner color="#FFB703" size={36} />
          <p className="text-center text-[17px] font-semibold text-white">{t("front.callback.completing")}</p>
        </>
      )}
    </div>
  );
}

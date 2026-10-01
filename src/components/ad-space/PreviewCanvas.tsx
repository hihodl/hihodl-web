"use client";

import { useEffect, useRef, useState } from "react";

import {
  applyPreviewPatch,
  authFailedMessage,
  injectedToken,
  notOwnerMessage,
  parsePreviewUpdate,
  readyMessage,
  updatedMessage,
} from "@/lib/ad-space/preview-bridge";
import type { Space } from "@/lib/ad-space/types";
import { accessToken } from "@/lib/creator/session";

import { PreviewBridge, postToApp } from "./edit-mode";
import { PreviewBody } from "./PreviewBody";

/**
 * The preview inside the HOLD app's WebView (`?embed=app`, and `&edit=1` for
 * the editor). Protocol and validation: lib/ad-space/preview-bridge.ts.
 *
 * 1. The creator's own read, drafts included, through ./owner with a bearer:
 *    the web session's token when this browser has one, else the token the
 *    app injected as `window.__HOLD_ACCESS_TOKEN__`. The token lives in this
 *    function's scope for one request: never stored, never logged.
 * 2. Only that read makes the page editable and lets the app's live updates
 *    in. Without it: no token or a refused one posts `auth-failed`, somebody
 *    else's posts `not-owner`, and either way the page is the public one,
 *    read only (or "unavailable" for a draft).
 * 3. `hold-preview-update` messages patch the space in memory and redraw it;
 *    `hold-preview-updated` follows the redraw. Nothing is saved here: saving
 *    is the app's, through the API, as ever.
 *
 * `initial` is the public read the server already made (null for a draft), so
 * a live page is on screen while the owner's read is on its way.
 */
export function PreviewCanvas({
  initial,
  overrides,
  edit,
}: {
  initial: Space | null;
  /** The URL's pending picks, laid over whichever read is drawn. */
  overrides: Partial<Pick<Space, "pageGround" | "titleStyle" | "effect">>;
  edit: boolean;
}) {
  const withPicks = (s: Space): Space => ({ ...s, ...overrides });
  const [space, setSpace] = useState<Space | null>(initial ? withPicks(initial) : null);
  const [owner, setOwner] = useState<"pending" | "yes" | "no">("pending");
  const [version, setVersion] = useState(0);
  const ownerRef = useRef(false);

  /* 1. The owner's read. */
  useEffect(() => {
    let live = true;
    (async () => {
      let token: string | null = null;
      try {
        token = await accessToken();
      } catch {
        token = null;
      }
      token = token || injectedToken(window.__HOLD_ACCESS_TOKEN__);
      if (!live) return;
      if (!token) {
        setOwner("no");
        postToApp(authFailedMessage());
        return;
      }
      let res: Response | null = null;
      try {
        res = await fetch(`${window.location.pathname.replace(/\/+$/, "")}/owner`, {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
          credentials: "omit",
        });
      } catch {
        res = null;
      }
      token = null;
      if (!live) return;
      if (res?.ok) {
        const body = (await res.json().catch(() => null)) as { space?: Space } | null;
        if (body?.space && live) {
          ownerRef.current = true;
          setSpace(withPicks(body.space));
          setOwner("yes");
          return;
        }
      }
      setOwner("no");
      if (res?.status === 401) postToApp(authFailedMessage());
      else if (res?.status === 403) postToApp(notOwnerMessage());
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  /* Ready once the read is settled and drawn, so the app's loader covers the wait. */
  useEffect(() => {
    if (owner !== "pending") postToApp(readyMessage());
  }, [owner]);

  /* 3. The app's live updates, the owner's page only. */
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // The app dispatches on this window; another window's postMessage is not the app.
      if (e.source !== null && e.source !== window) return;
      if (!ownerRef.current) return;
      const patch = parsePreviewUpdate(e.data);
      if (!patch) return;
      setSpace((s) => (s ? applyPreviewPatch(s, patch) : s));
      setVersion((v) => v + 1);
    }
    window.addEventListener("message", onMessage);
    // react-native-webview delivers to `document` on Android.
    document.addEventListener("message", onMessage as EventListener);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("message", onMessage as EventListener);
    };
  }, []);

  useEffect(() => {
    if (version > 0) postToApp(updatedMessage());
  }, [version]);

  return (
    <PreviewBridge editing={edit && owner === "yes"}>
      <PreviewBody
        space={space}
        ground={space ? space.pageGround ?? null : overrides.pageGround ?? null}
        embed
        pending={owner === "pending"}
      />
    </PreviewBridge>
  );
}

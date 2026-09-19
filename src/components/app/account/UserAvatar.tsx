"use client";

/**
 * The person's face, wherever the person is shown: the sidebar's card, the
 * phone's top bar, Account, the Dashboard, Settings.
 *
 * The photo is the profile's (`GET /me` → `profile.avatarUrl`, the one the app
 * shows); a creator who never set one but linked X is shown X's. Only with no
 * photo at all is it the initial, never a role's icon.
 *
 * /me signs the photo for an hour, so a tab left open outlives it: when the
 * image fails, /me is read once more for a fresh signature.
 */

import { useCallback, useRef } from "react";

import { chosenUsername } from "@/lib/app/me";
import { useMe, useRefresh, useX } from "@/lib/app/spaces-data";

import { Avatar } from "../front/kit";

export function useUserPhoto(): { photo: string | null; name: string | null } {
  const me = useMe();
  const x = useX();
  const linked = x.data?.linked ? x.data : null;
  const username = chosenUsername(me.data);
  const name = me.data?.profile.displayName?.trim() || (username ? `@${username}` : linked ? `@${linked.handle}` : null);
  return { photo: me.data?.profile.avatarUrl ?? linked?.avatarUrl ?? null, name };
}

export function UserAvatar({ size = 36, fallbackName }: { size?: number; fallbackName?: string | null }) {
  const { photo, name } = useUserPhoto();
  const refresh = useRefresh();
  const retried = useRef(false);
  const onError = useCallback(() => {
    if (retried.current) return;
    retried.current = true;
    void refresh("me");
  }, [refresh]);
  return <Avatar src={photo} name={name ?? fallbackName ?? "?"} size={size} onError={onError} />;
}

"use client";

/**
 * The person's face, wherever the person is shown: the sidebar's card, the
 * phone's top bar, Account, the Dashboard, Settings.
 *
 * The photo is the profile's (`GET /me` → `profile.avatarUrl`, the one the app
 * shows); a creator who never set one but linked X is shown X's. With no
 * photo at all it is what the app shows (src/ui/UserAvatar): the emoji the
 * person chose (`profile.avatarEmoji`), else the app's default, 🚀. Never an
 * initial, never a role's icon.
 *
 * /me signs the photo for an hour, so a tab left open outlives it: when the
 * image fails, /me is read once more for a fresh signature.
 */

import { useCallback, useRef, useState } from "react";

import { chosenUsername } from "@/lib/app/me";
import { useMe, useRefresh, useX } from "@/lib/app/spaces-data";

import { Avatar, DEFAULT_AVATAR_EMOJI, EmojiAvatar } from "../front/kit";

export function useUserPhoto(): { photo: string | null; name: string | null } {
  const me = useMe();
  const x = useX();
  const linked = x.data?.linked ? x.data : null;
  const username = chosenUsername(me.data);
  const name = me.data?.profile.displayName?.trim() || (username ? `@${username}` : linked ? `@${linked.handle}` : null);
  return { photo: me.data?.profile.avatarUrl ?? linked?.avatarUrl ?? null, name };
}

export function UserAvatar({ size = 36, fallbackName, round = false }: { size?: number; fallbackName?: string | null; round?: boolean }) {
  const { photo, name } = useUserPhoto();
  const refresh = useRefresh();
  const retried = useRef(false);
  const onError = useCallback(() => {
    if (retried.current) return;
    retried.current = true;
    void refresh("me");
  }, [refresh]);
  const me = useMe();
  const [broken, setBroken] = useState<string | null>(null);
  if (photo && broken !== photo) {
    return (
      <Avatar
        src={photo}
        name={name ?? fallbackName ?? "?"}
        size={size}
        round={round}
        onError={() => {
          setBroken(photo);
          onError();
        }}
      />
    );
  }
  // Still reading /me: the disk, empty, rather than a face that then changes.
  const emoji = me.data ? me.data.profile.avatarEmoji?.trim() || DEFAULT_AVATAR_EMOJI : me.error ? DEFAULT_AVATAR_EMOJI : null;
  return <EmojiAvatar emoji={emoji} size={size} round={round} />;
}

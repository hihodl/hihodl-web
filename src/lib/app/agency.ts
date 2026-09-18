/**
 * Creator or Creative Director: whether this person runs a team.
 *
 * A creator sells their own listings and sees nothing about teams. A Creative
 * Director has people working for them: the Team page, the "Who works it" card
 * on a listing, and the title under their name.
 *
 * The choice is kept by the server (`/ad-space/settings`), so it follows the
 * creator to every device. It can never hide a team that exists: anybody with
 * a member or an open invitation is a Creative Director whatever the switch
 * says.
 *
 * Before the server kept it, this browser did (`hold-agency:<user>`). That old
 * choice is read once: if the server says the creator never chose and this
 * browser says they turned it on, it is sent up and the local copy removed.
 * While the server cannot be read, the local copy is what is shown.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useCreatorSettings } from "@/lib/app/spaces-data";
import { setAgencyMode } from "@/lib/creator/listings";
import type { TeamMember } from "@/lib/creator/team";

const keyFor = (userId: string) => `hold-agency:${userId}`;

function readLocal(userId: string): boolean {
  try {
    return window.localStorage.getItem(keyFor(userId)) === "1";
  } catch {
    return false;
  }
}

function forgetLocal(userId: string) {
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    /* nothing kept to forget */
  }
}

export interface Agency {
  /** Team things are shown. */
  on: boolean;
  /** On because a team exists; the switch cannot turn it off. */
  forced: boolean;
  set: (on: boolean) => void;
}

/** Only ever used after sign-in, in the browser. */
export function useAgency(userId: string, team: readonly TeamMember[] | undefined): Agency {
  const settings = useCreatorSettings();
  // What the creator just switched to, shown before the server answers.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const migrated = useRef<string | null>(null);

  useEffect(() => setOptimistic(null), [userId]);

  // The one-time carry-over of a choice this browser made before the server kept it.
  const { data, mutate } = settings;
  useEffect(() => {
    const s = data;
    if (!s || migrated.current === userId) return;
    migrated.current = userId;
    if (s.chosen || !readLocal(userId)) {
      if (s.chosen) forgetLocal(userId);
      return;
    }
    setAgencyMode(true)
      .then(() => {
        forgetLocal(userId);
        return mutate();
      })
      .catch(() => undefined);
    setOptimistic(true);
  }, [data, mutate, userId]);

  const forced = Boolean(data?.hasTeam) || (team ?? []).some((m) => m.status === "active" || m.status === "invited");
  const stored = data ? data.agencyMode : settings.error ? readLocal(userId) : false;
  const chosen = optimistic ?? stored;

  const set = useCallback(
    (on: boolean) => {
      setOptimistic(on);
      setAgencyMode(on)
        .then((r) => mutate(r.settings, { revalidate: false }))
        .then(() => setOptimistic(null))
        .catch(() => setOptimistic(null));
    },
    [mutate],
  );

  return { on: chosen || forced, forced, set };
}

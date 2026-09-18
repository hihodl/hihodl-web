/**
 * Creator or Creative Director: whether this person runs a team.
 *
 * A creator sells their own listings and sees nothing about teams. A Creative
 * Director has people working for them: the Team page, the "Who works it" card
 * on a listing, and the title under their name.
 *
 * There is no backend flag for it yet, so the choice is kept in this browser,
 * per user. It can never hide a team that exists: anybody with a member or an
 * open invitation is a Creative Director whatever the switch says.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import type { TeamMember } from "@/lib/creator/team";

const keyFor = (userId: string) => `hold-agency:${userId}`;

function readChoice(userId: string): boolean {
  try {
    return window.localStorage.getItem(keyFor(userId)) === "1";
  } catch {
    return false;
  }
}

export interface Agency {
  /** Team things are shown. */
  on: boolean;
  /** On because a team exists; the switch cannot turn it off. */
  forced: boolean;
  set: (on: boolean) => void;
}

/** Only ever used after sign-in, in the browser: the stored choice is read on the first render. */
export function useAgency(userId: string, team: readonly TeamMember[] | undefined): Agency {
  const [chosen, setChosen] = useState<boolean>(() => (typeof window === "undefined" ? false : readChoice(userId)));

  useEffect(() => setChosen(readChoice(userId)), [userId]);

  const forced = (team ?? []).some((m) => m.status === "active" || m.status === "invited");

  const set = useCallback(
    (on: boolean) => {
      setChosen(on);
      try {
        window.localStorage.setItem(keyFor(userId), on ? "1" : "0");
      } catch {
        /* kept for this page only */
      }
    },
    [userId],
  );

  return { on: chosen || forced, forced, set };
}

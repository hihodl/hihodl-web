"use client";

/**
 * Spaces › Settings: what is Spaces' own.
 *
 *   Ready to publish  the publish gate's checks, in its order (`publishRefusal`
 *                     on the backend), each a link to the Account screen that
 *                     fixes it
 *   Creative Director run a team: the Team page, "Who works it" on every
 *                     listing, the title under your name (lib/app/agency)
 *
 * Who you are and where you get paid are the person's, on Account.
 */

import Link from "next/link";

import { useHref } from "../base";
import { IconDirector } from "../icons";
import { useShell } from "../Shell";
import { glass } from "../ui";
import { ReadyToPublish } from "./ReadyToPublish";

export function SpacesSettingsScreen() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
      <ReadyToPublish />
      <CreativeDirector />
    </div>
  );
}

/**
 * Creator or Creative Director. Switching it on is an upgrade, not a setting:
 * the Team page appears, the title under the name changes, and every listing
 * gains "Who works it". While a team exists it stays on.
 */
function CreativeDirector() {
  const { agency } = useShell();
  const href = useHref();
  const on = agency.on;
  return (
    <section id="team" aria-label="Creative Director" className={`${glass} flex flex-col gap-3 p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${on ? "bg-amber text-text-on-amber" : "bg-amber/15 text-amber"}`}>
            <IconDirector className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-small font-medium text-text">Creative Director</p>
            <p className="truncate text-tiny text-[#9FB7C2]">Invite by email, assign listings, split per sale</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Creative Director"
          title={agency.forced ? "On while you have a team" : undefined}
          disabled={agency.forced}
          onClick={() => agency.set(!on)}
          className={`relative h-6 w-10 shrink-0 rounded-[12px] transition-colors disabled:opacity-60 ${on ? "bg-amber" : "bg-white/25 hover:bg-white/35"}`}
        >
          <span className={`absolute top-1 h-4 w-4 rounded-[8px] bg-white shadow transition-[left] ${on ? "left-5" : "left-1"}`} aria-hidden />
        </button>
      </div>
      {on ? (
        <Link href={href("/team")} className="self-start text-tiny text-amber hover:text-[#FFE2A1]">
          Open Team
        </Link>
      ) : null}
    </section>
  );
}

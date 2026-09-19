"use client";

/**
 * Spaces › Settings: what is Spaces' own.
 *
 *   Ready to publish  the publish gate's checks, in its order (`publishRefusal`
 *                     on the backend), each a link to the Account screen that
 *                     fixes it
 *   Creative Director run a team: the Team page, "Who works it" on every
 *                     listing, the title under your name (lib/app/agency)
 *   Page background   the ground of your profile and every listing without
 *                     its own; a card that opens its own screen, with Back
 *
 * Who you are and where you get paid are the person's, on Account.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GroundPicker, GroundSwatch, labelOf } from "@/components/creator/run/GroundPicker";
import { getCreatorSettings, setPageGround } from "@/lib/creator/listings";

import { useHref } from "../base";
import { IconDirector } from "../icons";
import { useShell } from "../Shell";
import { IconArrowLeft } from "../icons";
import { glass } from "../ui";
import { ReadyToPublish } from "./ReadyToPublish";

export function SpacesSettingsScreen({ screen }: { screen?: string }) {
  const [ground, setGround] = useState<string | null | undefined>(undefined);
  const load = useCallback(() => {
    void getCreatorSettings()
      .then(({ settings }) => setGround(settings.pageGround ?? null))
      .catch(() => setGround(null));
  }, []);
  useEffect(load, [load]);

  if (screen === "background") return <BackgroundScreen ground={ground} onSaved={load} />;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
      <ReadyToPublish />
      <div className="flex flex-col gap-4">
        <CreativeDirector />
        <BackgroundCard ground={ground} />
      </div>
    </div>
  );
}

/** The ground of the creator's pages, as a card that opens its own screen. */
function BackgroundCard({ ground }: { ground: string | null | undefined }) {
  const href = useHref();
  return (
    <Link href={href("/settings?screen=background")} aria-label="Page background" className={`${glass} flex items-center gap-4 p-5 transition-colors hover:bg-white/[0.07]`}>
      <div className="w-24 shrink-0">
        <GroundSwatch value={ground ?? null} height={64} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-small font-medium text-text">Page background</p>
        <p className="truncate text-tiny text-[#CFE3EC]">
          {ground === undefined ? "…" : `${labelOf(ground)} · your profile and every listing`}
        </p>
      </div>
      <span aria-hidden className="text-[#CFE3EC]">
        &rarr;
      </span>
    </Link>
  );
}

function BackgroundScreen({ ground, onSaved }: { ground: string | null | undefined; onSaved: () => void }) {
  const href = useHref();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={href("/settings")}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-[#CFE3EC]">Settings</p>
          <h2 className="truncate text-body font-medium text-text">Page background</h2>
        </div>
      </div>
      <p className="max-w-2xl text-small text-[#CFE3EC]">
        What your profile and every listing stand on. A listing can wear its own from its page, under Page background.
      </p>
      {ground === undefined ? null : (
        <GroundPicker key={ground ?? "none"} value={ground} onSave={(next) => setPageGround(next).then(onSaved)} />
      )}
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

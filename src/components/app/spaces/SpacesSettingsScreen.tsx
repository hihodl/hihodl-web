"use client";

/**
 * Spaces › Settings: what is Spaces' own.
 *
 *   Ready to publish  the publish gate's checks, in its order (`publishRefusal`
 *                     on the backend), each a link to the Account screen that
 *                     fixes it
 *   Creative Director run a team: the Team page, "Who works it" on every
 *                     listing, the title under your name (lib/app/agency)
 *   Page background   the grounds of your profile and your listings: the same
 *                     screen as Settings › Your pages (./YourPages)
 *
 * Who you are and where you get paid are the person's, on Account.
 */

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useHref } from "../base";
import { useShell } from "../Shell";
import { glass } from "../ui";
import { ReadyToPublish } from "./ReadyToPublish";
import { YourPagesCard, YourPagesScreen } from "./YourPages";

export function SpacesSettingsScreen({ screen, item }: { screen?: string; item?: string }) {
  const href = useHref();
  if (screen === "background") {
    return (
      <YourPagesScreen base={href("/settings?screen=background")} back={href("/settings")} backLabel="Settings" item={item} />
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
      <ReadyToPublish />
      <div className="flex flex-col gap-4">
        <CreativeDirector />
        <YourPagesCard href={href("/settings?screen=background")} title="Page background" />
      </div>
    </div>
  );
}

/**
 * Creator or Creative Director: one switch, and a small (i) for what it does.
 * On, the Team page appears, the title under the name changes and every
 * listing gains "Who works it". While a team exists it stays on (the server's
 * `/ad-space/settings` keeps the choice; lib/app/agency).
 */
function CreativeDirector() {
  const { agency } = useShell();
  const href = useHref();
  const on = agency.on;
  return (
    <section id="team" aria-label="Creative Director" className={`${glass} relative z-10 flex flex-col gap-2 px-5 py-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="text-small font-medium text-text">Creative Director</p>
          <InfoBubble label="What is Creative Director?">
            Run a team on your listings. You invite people by email, choose who works each listing, and set what each of
            them earns from a sale. You pay them; HOLD only keeps the count.
          </InfoBubble>
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
        <p className="text-tiny text-[#9FB7C2]">
          {agency.forced ? "On while you have a team. " : ""}
          <Link href={href("/team")} className="text-amber hover:text-[#FFE2A1]">
            Open Team
          </Link>
        </p>
      ) : null}
    </section>
  );
}

/** A small (i) that opens two or three lines about the thing beside it. Escape or a click away closes it. */
function InfoBubble({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <span ref={box} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-5 w-5 items-center justify-center rounded-[10px] border text-[11px] font-semibold transition-colors ${
          open ? "border-white/30 bg-white/15 text-text" : "border-white/20 text-[#9FB7C2] hover:text-text"
        }`}
      >
        i
      </button>
      {open ? (
        <span
          role="note"
          className="absolute left-1/2 top-7 z-30 w-[min(280px,80vw)] -translate-x-1/2 rounded-[12px] border border-white/15 bg-[#0B1C29] p-3 text-tiny leading-relaxed text-[#CFE3EC] shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

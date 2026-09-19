/**
 * The ground a creator's public pages stand on: the four presets and any
 * colour (src/lib/ad-space/theme.ts), each shown as a small page drawn in its
 * own ground and ink, so the choice is made by looking, not by reading.
 *
 * Used twice: on Spaces › Settings for the default (the profile and every
 * listing), and on a listing for its own, where "Same as my default" is the
 * first option. Selecting changes the edge's COLOUR (amber), never its width.
 */

"use client";

import { useState } from "react";

import { btnSmall } from "@/components/ad-space/ui";
import { glass } from "@/components/app/ui";
import { contrast, inkOn, normalHex } from "@/lib/ad-space/product-look";
import { PAGE_GROUND_LABEL, PAGE_GROUND_PRESETS, groundOf, type PageGroundPreset } from "@/lib/ad-space/theme";

const NOTE: Record<PageGroundPreset, string> = {
  hold: "The HOLD app's Benefits blue",
  app: "The app's own dark, #0F0F1A",
  night: "Black, for photos that pop",
  white: "A light page, every colour re-inked",
};

/** A tiny page in a ground: its background, a title, a line of text, a card and the amber button. */
export function GroundSwatch({ value, height = 88 }: { value: string | null; height?: number }) {
  const g = groundOf(value);
  const ink = g.light ? "#0A141E" : "#FFFFFF";
  const background =
    g.kind === "hold" ? "linear-gradient(180deg, #1a5276 0%, #0f3555 37.5%, #0a1929 75%)" : g.base;
  return (
    <div
      className="flex w-full flex-col justify-between overflow-hidden rounded-[12px] border border-white/10 p-2.5"
      style={{ background, height }}
      aria-hidden
    >
      <div className="flex flex-col gap-1">
        <span className="block h-2 w-3/5 rounded-[2px]" style={{ background: ink }} />
        <span className="block h-1.5 w-4/5 rounded-[2px]" style={{ background: ink, opacity: 0.8 }} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="block h-4 w-1/2 rounded-[4px]" style={{ background: ink, opacity: 0.08, outline: `1px solid ${ink}22` }} />
        <span className="block h-4 w-8 rounded-[8px] bg-amber" />
      </div>
    </div>
  );
}

export function GroundPicker({
  value,
  onSave,
  allowDefault = false,
  defaultValue = null,
  defaultLabel = "Same as my default",
}: {
  /** What is saved now: a preset, a #RRGGBB, or null (HOLD blue; on a listing, "same as my default"). */
  value: string | null;
  onSave: (next: string | null) => Promise<unknown>;
  /** On a listing: null means "same as my default", offered first. */
  allowDefault?: boolean;
  /** The creator's default, shown on the "Same as my default" card. */
  defaultValue?: string | null;
  /** What that card is called. */
  defaultLabel?: string;
}) {
  // With no default to fall back to, a stored "hold" and null are the same card.
  const start = !allowDefault && value === "hold" ? null : value;
  const [picked, setPicked] = useState<string | null>(start);
  const [typed, setTyped] = useState(value?.startsWith("#") ? value : "#F4EFE6");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const customHex = normalHex(typed);
  const dirty = picked !== start;

  const option = (key: string | null, title: string, note: string, swatch: string | null) => {
    const on = picked === key;
    return (
      <li key={key ?? "default"}>
        <button
          type="button"
          role="radio"
          aria-checked={on}
          onClick={() => setPicked(key)}
          className={`flex h-full w-full flex-col gap-2.5 rounded-[16px] border-2 p-2.5 text-left transition-colors duration-180 ${
            on ? "border-amber bg-amber/[0.06]" : "border-white/10 hover:border-white/25"
          }`}
        >
          <GroundSwatch value={swatch} />
          <span className="px-0.5">
            <span className="block text-small font-medium text-text">{title}</span>
            <span className="block text-tiny text-[#CFE3EC]">{note}</span>
          </span>
        </button>
      </li>
    );
  };

  function save() {
    setBusy(true);
    setNotice(null);
    void onSave(picked)
      .catch(() => setNotice("That did not save. Try again in a moment."))
      .finally(() => setBusy(false));
  }

  const customOn = picked !== null && picked.startsWith("#");
  const ink = customHex ? inkOn(customHex) : null;

  return (
    <div className="flex flex-col gap-4">
      <ul role="radiogroup" aria-label="Page background" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {allowDefault
          ? option(null, defaultLabel, defaultValue ? labelOf(defaultValue) : PAGE_GROUND_LABEL.hold, defaultValue)
          : null}
        {PAGE_GROUND_PRESETS.map((k) =>
          // With no default to fall back to, HOLD blue is what null means: one card for both.
          option(!allowDefault && k === "hold" ? null : k, PAGE_GROUND_LABEL[k], NOTE[k], k),
        )}
      </ul>

      <section className={`${glass} flex flex-col gap-3 p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            role="radio"
            aria-checked={customOn}
            onClick={() => customHex && setPicked(customHex)}
            className={`inline-flex h-10 items-center gap-2 rounded-[12px] border-2 px-3 text-small text-text transition-colors ${
              customOn ? "border-amber bg-amber/[0.06]" : "border-white/10 hover:border-white/25"
            }`}
          >
            <span className="h-5 w-5 rounded-[6px] border border-white/20" style={{ background: customHex ?? "transparent" }} aria-hidden />
            Your own colour
          </button>
          <input
            type="color"
            aria-label="Pick any colour"
            value={customHex ?? "#000000"}
            onChange={(e) => {
              const hex = normalHex(e.target.value);
              if (hex) {
                setTyped(hex);
                setPicked(hex);
              }
            }}
            className="h-10 w-10 cursor-pointer rounded-[12px] border-2 border-white/15 bg-transparent p-0.5"
          />
          <input
            aria-label="Colour as hex"
            value={typed}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              setTyped(e.target.value);
              const hex = normalHex(e.target.value);
              if (hex) setPicked(hex);
            }}
            className="h-10 w-28 rounded-[12px] border border-white/15 bg-black/20 px-3 font-mono text-small uppercase text-text outline-none focus:border-amber/60"
          />
        </div>
        {customHex && ink ? (
          <p className="text-tiny text-[#CFE3EC]">
            Text goes {ink === "#0A141E" ? "dark" : "white"} on this colour ({contrast(customHex, ink).toFixed(1)}:1), chosen for you.
          </p>
        ) : (
          <p className="text-tiny text-amber">Write a colour as #RRGGBB.</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnSmall} disabled={busy || !dirty} onClick={save}>
          {busy ? "Saving…" : dirty ? "Save background" : "Saved"}
        </button>
        <p className="text-tiny text-[#CFE3EC]">The payment sheet keeps the app&rsquo;s dark on every background.</p>
      </div>
      {notice ? <p className="text-tiny text-amber">{notice}</p> : null}
    </div>
  );
}

export function labelOf(value: string | null | undefined): string {
  if (!value) return PAGE_GROUND_LABEL.hold;
  return (PAGE_GROUND_PRESETS as readonly string[]).includes(value) ? PAGE_GROUND_LABEL[value as PageGroundPreset] : value;
}

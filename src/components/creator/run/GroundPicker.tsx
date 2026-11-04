/**
 * The ground a creator's public pages stand on: the four presets and any
 * colour (src/lib/ad-space/theme.ts), each shown as a small page drawn in its
 * own ground and ink, so the choice is made by looking, not by reading.
 *
 * Used twice: on Spaces › Settings for the default (the profile and every
 * listing), and on a listing for its own, where "Same as my default" is the
 * first option. Selecting changes the edge's COLOUR (the select white), never its width.
 */

"use client";

import { useEffect, useState } from "react";

import { btnWhite as btnSmall } from "@/components/app/spaces/kit";
import { cardBox as glass } from "@/components/app/spaces/kit";
import { contrast, inkOn, normalHex } from "@/lib/ad-space/product-look";
import { PAGE_GROUND_PRESETS, groundOf, type PageGroundPreset } from "@/lib/ad-space/theme";
import { t as tl } from "@/lib/app/i18n";
import { fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

const NOTE = {
  hold: "runner.ground.note.hold",
  app: "runner.ground.note.app",
  night: "runner.ground.note.night",
  white: "runner.ground.note.white",
} as const satisfies Record<PageGroundPreset, string>;

/** A preset's name (lib/ad-space/theme's PAGE_GROUND_LABEL, in the person's language). */
const LABEL = {
  hold: "runner.ground.label.hold",
  app: "runner.ground.label.app",
  night: "runner.ground.label.night",
  white: "runner.ground.label.white",
} as const satisfies Record<PageGroundPreset, string>;

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
  defaultLabel,
  onPicked,
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
  /**
   * Every change of mind, saved or not, so a preview beside this can show the
   * pick before it is committed. You choose a background by looking at it.
   */
  onPicked?: (value: string | null) => void;
}) {
  const t = useT();
  // With no default to fall back to, a stored "hold" and null are the same card.
  const start = !allowDefault && value === "hold" ? null : value;
  const [picked, setPicked] = useState<string | null>(start);
  const [typed, setTyped] = useState(value?.startsWith("#") ? value : "#F4EFE6");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const customHex = normalHex(typed);
  const dirty = picked !== start;

  useEffect(() => {
    onPicked?.(picked);
    // The callback is the caller's business; this fires on the pick alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

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
            on ? "border-[#F1F5F9] bg-[rgba(241,245,249,0.08)]" : "border-white/10 hover:border-white/25"
          }`}
        >
          <GroundSwatch value={swatch} />
          <span className="px-0.5">
            <span className="block text-[14.5px] font-bold text-white">{title}</span>
            <span className="block text-[12.5px] text-white/[0.62]">{note}</span>
          </span>
        </button>
      </li>
    );
  };

  function save() {
    setBusy(true);
    setNotice(null);
    void onSave(picked)
      .catch(() => setNotice(t("runner.ground.saveFailed")))
      .finally(() => setBusy(false));
  }

  const customOn = picked !== null && picked.startsWith("#");
  const ink = customHex ? inkOn(customHex) : null;

  return (
    <div className="flex flex-col gap-4">
      <ul role="radiogroup" aria-label={t("runner.screen.ground")} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {allowDefault
          ? option(null, defaultLabel ?? t("runner.ground.sameAsDefault"), defaultValue ? labelOf(defaultValue) : t(LABEL.hold), defaultValue)
          : null}
        {PAGE_GROUND_PRESETS.map((k) =>
          // With no default to fall back to, HOLD blue is what null means: one card for both.
          option(!allowDefault && k === "hold" ? null : k, t(LABEL[k]), t(NOTE[k]), k),
        )}
      </ul>

      <section className={`${glass} flex flex-col gap-3 p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            role="radio"
            aria-checked={customOn}
            onClick={() => customHex && setPicked(customHex)}
            className={`inline-flex h-10 items-center gap-2 rounded-[12px] border-2 px-3 text-[14.5px] text-white transition-colors ${
              customOn ? "border-[#F1F5F9] bg-[rgba(241,245,249,0.08)]" : "border-white/10 hover:border-white/25"
            }`}
          >
            <span className="h-5 w-5 rounded-[6px] border border-white/20" style={{ background: customHex ?? "transparent" }} aria-hidden />
            {t("runner.ground.ownColour")}
          </button>
          <input
            type="color"
            aria-label={t("runner.ground.pickAny")}
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
            aria-label={t("runner.ground.hex")}
            value={typed}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              setTyped(e.target.value);
              const hex = normalHex(e.target.value);
              if (hex) setPicked(hex);
            }}
            className="h-10 w-28 rounded-[12px] border border-white/15 bg-black/20 px-3 font-mono text-[14.5px] uppercase text-white outline-none focus:border-white/30"
          />
        </div>
        {customHex && ink ? (
          <p className="text-[12.5px] text-white/[0.62]">
            {t("runner.ground.textGoes", {
              ink: ink === "#0A141E" ? "dark" : "white",
              ratio: fmtNumber(contrast(customHex, ink), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
            })}
          </p>
        ) : (
          <p className="text-[12.5px] text-amber">{t("runner.ground.writeHex")}</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnSmall} disabled={busy || !dirty} onClick={save}>
          {busy ? t("common.saving") : dirty ? t("runner.ground.save") : t("common.saved")}
        </button>
        <p className="text-[12.5px] text-white/[0.62]">{t("runner.ground.paymentNote")}</p>
      </div>
      {notice ? <p className="text-[12.5px] text-amber">{notice}</p> : null}
    </div>
  );
}

export function labelOf(value: string | null | undefined): string {
  if (!value) return tl(LABEL.hold);
  return (PAGE_GROUND_PRESETS as readonly string[]).includes(value) ? tl(LABEL[value as PageGroundPreset]) : value;
}

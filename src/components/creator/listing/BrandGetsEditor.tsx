/**
 * "What you get", written by the creator.
 *
 * The list a brand reads before paying, in the creator's own words and order.
 * Two lines we can word from live figures (the reach, and the spot on the
 * product) start the list as SUGGESTIONS: tagged as such, kept or removed like
 * any other line, and offered again under the list once removed. Everything
 * else is the creator's: add a line, edit it in place, move it up or down,
 * remove it. The dated promises (a video by 4 Oct) follow on the page, from
 * "What you will post".
 *
 * Nothing moves when a line is selected or edited: buttons change colour on
 * hover, never their border.
 */

"use client";

import { useT } from "@/lib/app/i18n/react";
import {
  BRAND_GETS_LIMITS,
  BRAND_GETS_SUGGESTED,
  type BrandGetsLine,
  type ListingDraft,
  type Template,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { Ion } from "@/components/app/ion";
import { Chip, ChipRow, Tag } from "@/components/app/spaces/kit";

import { Problems } from "./parts";

const iconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] text-white/[0.62] transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

/** How a suggestion reads in the editor: what the page will say, with today's figure filled in there. */
function suggestionText(kind: "reach" | "spot", template: Template, t: ReturnType<typeof useT>): string {
  if (kind === "reach") return t("listings.brandGets.reach");
  if (template.kind === "service") return t("listings.brandGets.oneSlot", { name: template.name });
  return t("listings.brandGets.spot", { product: template.name.toLowerCase() });
}

/** The suggestions a listing can carry: a ladder's rungs each say what they are, so no "spot" line there. */
export function suggestionsFor(draft: ListingDraft): readonly BrandGetsLine[] {
  return draft.sells === "ladder" ? BRAND_GETS_SUGGESTED.filter((l) => l.kind === "reach") : BRAND_GETS_SUGGESTED;
}

export function BrandGetsEditor({
  draft,
  template,
  onChange,
  problems,
}: {
  draft: ListingDraft;
  template: Template;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
}) {
  const t = useT();
  const suggested = suggestionsFor(draft);
  // Never edited: the page shows the suggestions, so the editor starts from them.
  const lines: BrandGetsLine[] = draft.brandGets ?? suggested.map((l) => ({ ...l }));
  const set = (next: BrandGetsLine[]) => onChange({ ...draft, brandGets: next });
  const full = lines.length >= BRAND_GETS_LIMITS.MAX_LINES;
  const missing = suggested.filter((s) => !lines.some((l) => l.kind === s.kind));

  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= lines.length) return;
    const next = [...lines];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <Problems list={problemsAt(problems, "brandGets")} />
      {lines.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-white/[0.14] px-3.5 py-3.5 text-[14px] leading-5 text-white/[0.62]">
          {t("listings.brandGets.empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {lines.map((l, i) => {
            const own = l.kind === "text";
            const lineProblems = problemsAt(problems, `brandGets:${i}`);
            return (
              <li
                key={own ? `text-${i}` : l.kind}
                className="flex items-center gap-1 rounded-[14px] border border-white/10 bg-white/[0.06] py-1.5 pl-3 pr-1.5"
              >
                <span className="w-5 shrink-0 text-center text-[12px] font-bold tabular-nums text-white/55" aria-hidden>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 px-1">
                  {own ? (
                    <>
                      <label htmlFor={`brand-gets-${i}`} className="sr-only">
                        {t("listings.brandGets.line", { n: i + 1 })}
                      </label>
                      <textarea
                        id={`brand-gets-${i}`}
                        value={l.text}
                        rows={l.text.length > 44 ? 3 : 2}
                        maxLength={BRAND_GETS_LIMITS.TEXT_MAX}
                        placeholder={t("listings.brandGets.placeholder")}
                        onChange={(e) => set(lines.map((x, j) => (j === i ? { kind: "text", text: e.target.value.replace(/\n/g, " ") } : x)))}
                        className="block w-full resize-none bg-transparent py-2 text-[15.5px] text-white outline-none placeholder:text-white/[0.28] sm:[field-sizing:content]"
                      />
                      {lineProblems.length ? <Problems list={lineProblems} /> : null}
                    </>
                  ) : (
                    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-2">
                      <Tag label={t("listings.brandGets.suggested")} />
                      <span className="min-w-0 text-[14.5px] leading-5 text-white">{suggestionText(l.kind, template, t)}</span>
                    </p>
                  )}
                </div>
                {/* Up and down stacked on a phone, side by side from `sm`: the line keeps the room. */}
                <div className="flex shrink-0 flex-col sm:flex-row">
                  <button type="button" className={iconBtn} aria-label={t("listings.brandGets.moveUp", { n: i + 1 })} disabled={i === 0} onClick={() => move(i, -1)}>
                    <Ion name="chevron-up" size={16} />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label={t("listings.brandGets.moveDown", { n: i + 1 })}
                    disabled={i === lines.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <Ion name="chevron-down" size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={t("listings.brandGets.remove", { n: i + 1 })}
                  onClick={() => set(lines.filter((_, j) => j !== i))}
                >
                  <Ion name="close" size={18} />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <ChipRow label={t("listings.brandGets.addTo")}>
        <Chip icon="add" label={t("listings.brandGets.addLine")} disabled={full} onClick={() => set([...lines, { kind: "text", text: "" }])} />
        {missing.map((s) => (
          <Chip key={s.kind} icon="add" label={s.kind === "reach" ? t("listings.brandGets.addReach") : t("listings.brandGets.addSpot")} disabled={full} onClick={() => set([...lines, { ...s }])} />
        ))}
      </ChipRow>
      <p className="text-[12px] leading-4 text-white/55">
        {t("listings.brandGets.counter", { count: lines.length, max: BRAND_GETS_LIMITS.MAX_LINES, chars: BRAND_GETS_LIMITS.TEXT_MAX })}
      </p>
    </div>
  );
}

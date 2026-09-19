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

import {
  BRAND_GETS_LIMITS,
  BRAND_GETS_SUGGESTED,
  type BrandGetsLine,
  type ListingDraft,
  type Template,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { Problems } from "./parts";

const iconBtn =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[20px] text-text-muted transition-colors duration-180 hover:bg-white/[0.08] hover:text-text disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

const addBtn =
  "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[20px] border border-[color:var(--color-hairline-strong)] px-4 text-small text-text transition-colors duration-180 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";

/** How a suggestion reads in the editor: what the page will say, with today's figure filled in there. */
function suggestionText(kind: "reach" | "spot", template: Template): string {
  if (kind === "reach") return "Your reach: your followers on X see it in every post (the page shows today's count)";
  if (template.kind === "service") return `One slot: ${template.name}`;
  return `Their logo, QR code or text on the ${template.name.toLowerCase()}, on the spot they pick`;
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
    <div className="flex flex-col gap-4">
      <Problems list={problemsAt(problems, "brandGets")} />
      {lines.length === 0 ? (
        <p className="rounded-input border border-dashed border-[color:var(--color-hairline-strong)] px-4 py-4 text-small text-text-muted">
          No lines of your own. Your page lists only what you will post, below. Add a line to say more.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {lines.map((l, i) => {
            const own = l.kind === "text";
            const lineProblems = problemsAt(problems, `brandGets:${i}`);
            return (
              <li
                key={own ? `text-${i}` : l.kind}
                className="flex items-center gap-1 rounded-input border border-[color:var(--color-hairline-strong)] bg-white/[0.03] py-1.5 pl-3 pr-1.5"
              >
                <span className="w-5 shrink-0 text-center text-tiny tabular-nums text-text-muted" aria-hidden>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 px-1">
                  {own ? (
                    <>
                      <label htmlFor={`brand-gets-${i}`} className="sr-only">
                        Line {i + 1}
                      </label>
                      <textarea
                        id={`brand-gets-${i}`}
                        value={l.text}
                        rows={l.text.length > 44 ? 3 : 2}
                        maxLength={BRAND_GETS_LIMITS.TEXT_MAX}
                        placeholder="A shout-out from the stage, your product in the vlog…"
                        onChange={(e) => set(lines.map((x, j) => (j === i ? { kind: "text", text: e.target.value.replace(/\n/g, " ") } : x)))}
                        className="block w-full resize-none bg-transparent py-2 text-body text-text outline-none placeholder:text-text-muted/70 sm:[field-sizing:content]"
                      />
                      {lineProblems.length ? <Problems list={lineProblems} /> : null}
                    </>
                  ) : (
                    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-2">
                      <span className="inline-flex h-6 shrink-0 items-center rounded-[12px] border border-moonlight/40 bg-moonlight/10 px-2.5 text-tiny text-text">
                        Suggested
                      </span>
                      <span className="min-w-0 text-small text-text">{suggestionText(l.kind, template)}</span>
                    </p>
                  )}
                </div>
                {/* Up and down stacked on a phone, side by side from `sm`: the line keeps the room. */}
                <div className="flex shrink-0 flex-col sm:flex-row">
                  <button type="button" className={iconBtn} aria-label={`Move line ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <Chevron up />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label={`Move line ${i + 1} down`}
                    disabled={i === lines.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <Chevron />
                  </button>
                </div>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => set(lines.filter((_, j) => j !== i))}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={addBtn}
          disabled={full}
          onClick={() => set([...lines, { kind: "text", text: "" }])}
        >
          <span aria-hidden>+</span> Add a line
        </button>
        {missing.map((s) => (
          <button key={s.kind} type="button" className={addBtn} disabled={full} onClick={() => set([...lines, { ...s }])}>
            <span aria-hidden>+</span> {s.kind === "reach" ? "Your reach" : "The spot"} (suggested)
          </button>
        ))}
        <span className="text-tiny text-text-muted">
          {lines.length} of {BRAND_GETS_LIMITS.MAX_LINES} lines · up to {BRAND_GETS_LIMITS.TEXT_MAX} characters each
        </span>
      </div>
    </div>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={up ? { transform: "rotate(180deg)" } : undefined}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

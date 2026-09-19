/**
 * Content production: what a spot includes (spaces-content-production-v0.md).
 *
 * A brand buying a production spot is buying a package, so the package is its
 * own step: what gets filmed and edited, how soon after the shoot it arrives,
 * and what the brand may do with it. Everything here is printed on the public
 * page before anybody pays, which is why every line is a count and a plain
 * sentence rather than a free-text box.
 */

"use client";

import {
  PRODUCTION_DELIVERABLE_LABEL,
  PRODUCTION_DELIVERABLE_MAX,
  PRODUCTION_DELIVERABLES,
  USAGE_SCOPE_LABEL,
  USAGE_TERM_LABEL,
  type ListingDraft,
  type ProductionDeliverable,
  type ProductionPackage,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { Block, Problems } from "./parts";

const LINE_HINT: Record<ProductionDeliverable, string> = {
  interviews: "Someone from the brand, or people they name, on camera.",
  shortForm: "Edited vertical cuts, ready to post.",
  brollPack: "Raw clips of the floor, the booth, the city.",
  photoSet: "Edited stills from the day.",
  socialAssets: "Cut-downs, captions and thumbnails.",
};

export function IncludesStep({
  draft,
  onChange,
  problems,
}: {
  draft: ListingDraft;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
}) {
  const pkg = draft.production;
  const set = (change: Partial<ProductionPackage>) => onChange({ ...draft, production: { ...pkg, ...change } });
  const setCount = (key: ProductionDeliverable, n: number) =>
    set({ deliverables: { ...pkg.deliverables, [key]: Math.max(0, Math.min(PRODUCTION_DELIVERABLE_MAX, n)) } });

  return (
    <div className="flex flex-col gap-10">
      <Block
        title="What a spot includes"
        why="Each brand that buys a spot gets this package, made for their own channels. Set a line to 0 to leave it out."
      >
        <ul className="grid gap-2 lg:grid-cols-2">
          {PRODUCTION_DELIVERABLES.map((key) => {
            const n = pkg.deliverables[key];
            return (
              <li
                key={key}
                className={`flex items-center justify-between gap-3 rounded-input border px-4 py-3 transition-colors duration-180 ${
                  n > 0 ? "border-amber/60 bg-amber/10" : "border-[color:var(--color-hairline-strong)]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-small text-text">{PRODUCTION_DELIVERABLE_LABEL[key]}</span>
                  <span className="mt-1 block text-tiny text-text-muted">{LINE_HINT[key]}</span>
                </span>
                <Stepper label={PRODUCTION_DELIVERABLE_LABEL[key]} value={n} onChange={(v) => setCount(key, v)} />
              </li>
            );
          })}
        </ul>
        <Problems list={problemsAt(problems, "production:deliverables")} />
      </Block>

      <Block
        title="Turnaround"
        why="How soon after each shoot day the brand has everything. The countdown on your Deliveries runs from the end of the shoot day."
      >
        <Cards
          name="turnaround"
          value={String(pkg.turnaroundHours)}
          onChange={(v) => set({ turnaroundHours: Number(v) as ProductionPackage["turnaroundHours"] })}
          options={[
            { value: "24", label: "24 hours", body: "Same-night edits." },
            { value: "48", label: "48 hours", body: "A proper edit, still news." },
            { value: "72", label: "72 hours", body: "Room for a longer cut." },
          ]}
        />
        <Problems list={problemsAt(problems, "production:turnaround")} />
      </Block>

      <Block
        title="Usage rights the brand gets"
        why="What the brand may do with what you deliver, printed on your page before they pay."
      >
        <Cards
          name="usage-scope"
          value={pkg.usage.scope}
          onChange={(scope) => set({ usage: { ...pkg.usage, scope } })}
          options={[
            { value: "organic", label: USAGE_SCOPE_LABEL.organic, body: "Their own posts, no ad spend." },
            { value: "organic_and_paid", label: USAGE_SCOPE_LABEL.organic_and_paid, body: "They may also run it as ads." },
          ]}
        />
        <Cards
          name="usage-term"
          value={pkg.usage.term}
          onChange={(term) => set({ usage: { ...pkg.usage, term } })}
          options={[
            { value: "6m", label: USAGE_TERM_LABEL["6m"] },
            { value: "12m", label: USAGE_TERM_LABEL["12m"] },
            { value: "perpetual", label: USAGE_TERM_LABEL.perpetual },
          ]}
        />
      </Block>

      <p className="text-tiny text-text-muted">
        The brand fills in a brief before paying. You send a private link with a checklist; they accept it or ask for one
        round of changes, and 72 hours of silence counts as accepted. The money reaches your wallet when they pay.
      </p>
    </div>
  );
}

/**
 * One of a few short options, side by side. Selection changes a COLOUR, never
 * a border width, so nothing moves.
 */
function Cards<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; body?: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={name} className={`grid gap-2 ${options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`flex flex-col gap-1 rounded-input border px-4 py-3 text-left transition-colors duration-180 ${
              on ? "border-amber bg-amber/10" : "border-[color:var(--color-hairline-strong)] hover:bg-white/5"
            }`}
          >
            <span className="text-small text-text">{o.label}</span>
            {o.body ? <span className="text-tiny text-text-muted">{o.body}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Minus, the count, plus. Fixed size, so nothing moves as the number changes. */
function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const btn =
    "inline-flex h-10 w-10 items-center justify-center rounded-[20px] border border-[color:var(--color-hairline-strong)] text-body text-text transition-colors duration-180 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} aria-label={`Fewer: ${label}`} disabled={value <= 0} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="w-8 text-center text-body tabular-nums text-text" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={`More: ${label}`}
        disabled={value >= PRODUCTION_DELIVERABLE_MAX}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

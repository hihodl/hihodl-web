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

import { Notice } from "@/components/app/hold";
import { Card, Chip, ChipRow, Divider, Stepper } from "@/components/app/spaces/kit";

import { Block, Choice, Problems } from "./parts";

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
    <div className="flex flex-col gap-3.5">
      <Block
        title="What a spot includes"
        why="Each brand that buys a spot gets this package, made for their own channels. Set a line to 0 to leave it out."
      >
        <Card className="!gap-0 !py-1">
          {PRODUCTION_DELIVERABLES.map((key, i) => {
            const n = pkg.deliverables[key];
            return (
              <div key={key}>
                {i > 0 ? <Divider /> : null}
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className={`block text-[14.5px] font-bold ${n > 0 ? "text-white" : "text-white/[0.62]"}`}>{PRODUCTION_DELIVERABLE_LABEL[key]}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-[17px] text-white/55">{LINE_HINT[key]}</span>
                  </span>
                  <Stepper
                    value={n}
                    min={0}
                    max={PRODUCTION_DELIVERABLE_MAX}
                    onChange={(v) => setCount(key, v)}
                    labelLess={`Fewer: ${PRODUCTION_DELIVERABLE_LABEL[key]}`}
                    labelMore={`More: ${PRODUCTION_DELIVERABLE_LABEL[key]}`}
                  />
                </div>
              </div>
            );
          })}
        </Card>
        <Problems list={problemsAt(problems, "production:deliverables")} />
      </Block>

      <Block
        title="Turnaround"
        why="How soon after each shoot day the brand has everything. The countdown on your Deliveries runs from the end of the shoot day."
      >
        <Choice
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

      <Block title="Usage rights the brand gets" why="What the brand may do with what you deliver, printed on your page before they pay.">
        <Choice
          name="usage-scope"
          value={pkg.usage.scope}
          onChange={(scope) => set({ usage: { ...pkg.usage, scope } })}
          options={[
            { value: "organic", label: USAGE_SCOPE_LABEL.organic, body: "Their own posts, no ad spend." },
            { value: "organic_and_paid", label: USAGE_SCOPE_LABEL.organic_and_paid, body: "They may also run it as ads." },
          ]}
        />
        <ChipRow label="How long">
          {(["6m", "12m", "perpetual"] as const).map((term) => (
            <Chip key={term} label={USAGE_TERM_LABEL[term]} selected={pkg.usage.term === term} onClick={() => set({ usage: { ...pkg.usage, term } })} />
          ))}
        </ChipRow>
      </Block>

      <Notice tone="calm">
        The brand fills in a brief before paying. You send a private link with a checklist; they accept it or ask for one round
        of changes, and 72 hours of silence counts as accepted. The money reaches your wallet when they pay.
      </Notice>
    </div>
  );
}

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

import type { MessageKey } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
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
import { StepCard } from "./StepPager";

const LINE_HINT: Record<ProductionDeliverable, MessageKey> = {
  interviews: "listings.includes.hint.interviews",
  shortForm: "listings.includes.hint.shortForm",
  brollPack: "listings.includes.hint.brollPack",
  photoSet: "listings.includes.hint.photoSet",
  socialAssets: "listings.includes.hint.socialAssets",
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
  const t = useT();
  const pkg = draft.production;
  const set = (change: Partial<ProductionPackage>) => onChange({ ...draft, production: { ...pkg, ...change } });
  const setCount = (key: ProductionDeliverable, n: number) =>
    set({ deliverables: { ...pkg.deliverables, [key]: Math.max(0, Math.min(PRODUCTION_DELIVERABLE_MAX, n)) } });

  return (
    <StepCard title={t("listings.wizard.stage.includes")} help={t("listings.includes.help")}>
      <Block title={t("listings.includes.package")}>
        <Card className="!gap-0 !py-1">
          {PRODUCTION_DELIVERABLES.map((key, i) => {
            const n = pkg.deliverables[key];
            return (
              <div key={key}>
                {i > 0 ? <Divider /> : null}
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className={`block text-[14.5px] font-bold ${n > 0 ? "text-white" : "text-white/[0.62]"}`}>{PRODUCTION_DELIVERABLE_LABEL[key]}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-[17px] text-white/55">{t(LINE_HINT[key])}</span>
                  </span>
                  <Stepper
                    value={n}
                    min={0}
                    max={PRODUCTION_DELIVERABLE_MAX}
                    onChange={(v) => setCount(key, v)}
                    labelLess={t("listings.includes.fewer", { label: PRODUCTION_DELIVERABLE_LABEL[key] })}
                    labelMore={t("listings.includes.more", { label: PRODUCTION_DELIVERABLE_LABEL[key] })}
                  />
                </div>
              </div>
            );
          })}
        </Card>
        <Problems list={problemsAt(problems, "production:deliverables")} />
      </Block>

      <Block title={t("listings.includes.turnaround")} why={t("listings.includes.turnaroundWhy")}>
        <Choice
          name="turnaround"
          value={String(pkg.turnaroundHours)}
          onChange={(v) => set({ turnaroundHours: Number(v) as ProductionPackage["turnaroundHours"] })}
          options={[
            { value: "24", label: t("listings.includes.hours", { count: 24 }), body: t("listings.includes.body24") },
            { value: "48", label: t("listings.includes.hours", { count: 48 }), body: t("listings.includes.body48") },
            { value: "72", label: t("listings.includes.hours", { count: 72 }), body: t("listings.includes.body72") },
          ]}
        />
        <Problems list={problemsAt(problems, "production:turnaround")} />
      </Block>

      <Block title={t("listings.includes.usage")} why={t("listings.includes.usageWhy")}>
        <Choice
          name="usage-scope"
          value={pkg.usage.scope}
          onChange={(scope) => set({ usage: { ...pkg.usage, scope } })}
          options={[
            { value: "organic", label: USAGE_SCOPE_LABEL.organic, body: t("listings.includes.organicBody") },
            { value: "organic_and_paid", label: USAGE_SCOPE_LABEL.organic_and_paid, body: t("listings.includes.paidBody") },
          ]}
        />
        <ChipRow label={t("listings.includes.howLong")}>
          {(["6m", "12m", "perpetual"] as const).map((term) => (
            <Chip key={term} label={USAGE_TERM_LABEL[term]} selected={pkg.usage.term === term} onClick={() => set({ usage: { ...pkg.usage, term } })} />
          ))}
        </ChipRow>
      </Block>

      <Notice tone="calm">{t("listings.includes.notice")}</Notice>
    </StepCard>
  );
}

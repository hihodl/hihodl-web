/**
 * Publishing a listing, from a browser, with no app installed.
 *
 * WHY A WIZARD AND NOT ONE LONG FORM
 *
 * A listing is four decisions that each change the next: the product decides
 * what can be sold, the dates decide what the countdown may be, the way it
 * sells decides whether there are price boxes at all, and only then is there
 * anything to declare. On one page those dependencies read as fields
 * appearing and disappearing under the cursor; in four steps they read as
 * questions in the order somebody would ask them.
 *
 * WHEN THE DRAFT REACHES THE SERVER
 *
 * At the end of "pick your hook", because that is the first moment there is
 * something the API will accept — a create needs positions or a service offer,
 * and nothing before that step has either. From then on every change is a
 * PATCH of only what changed, which is what keeps an omitted field's value:
 * `updateBody` on the backend carries no zod defaults on purpose, and sending
 * the whole form back would be the thing that undoes that.
 *
 * WHY "CONTINUE" IS THE GATE AND NOT "PUBLISH"
 *
 * Every rule the API enforces is mirrored in ./rules, checked as the creator
 * types, and shown beside the field it belongs to. A step with something wrong
 * on it does not move on. The alternative — letting them build a ladder for an
 * evening and answering `bid_tier_sells_one` at the end — is worse than having
 * no form at all.
 */

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { btnPrimary, btnSecondary, btnSmallSecondary, pill } from "@/components/ad-space/ui";
import { useHref } from "@/components/app/base";
import { glass } from "@/components/app/ui";
import { useRefresh } from "@/lib/app/spaces-data";
import type { Chain } from "@/lib/ad-space/types";
import { describeCreatorError } from "@/lib/creator/api";
import {
  bodyOf,
  draftFor,
  draftFromSpace,
  isProductionTemplate,
  patchOf,
  type EventSummary,
  type ListingDraft,
  type Template,
} from "@/lib/creator/listing";
import { createListing, getListing, getTemplates, patchListing, publishListing } from "@/lib/creator/listings";
import { refusalOf } from "@/lib/creator/problems";
import { demoParam } from "@/lib/creator/demo";
import { firstStepWithProblem, listingProblems, type Problem, type Step } from "@/lib/creator/rules";

import { BasicsStep } from "./listing/BasicsStep";
import { IncludesStep } from "./listing/IncludesStep";
import { PublishStep } from "./listing/PublishStep";
import { SellStep } from "./listing/SellStep";
import { Loading, Notice } from "./parts";

type Stage = "template" | Step;

const STAGES: readonly { key: Stage; label: string }[] = [
  { key: "template", label: "Pick your hook" },
  { key: "basics", label: "Name and dates" },
  { key: "sell", label: "The ladder" },
  { key: "publish", label: "Go live" },
];

/**
 * Content production gets one more step, "What a spot includes": a brand buys
 * the package, so the package is decided before the price.
 */
const PRODUCTION_STAGES: readonly { key: Stage; label: string }[] = [
  { key: "template", label: "Pick your hook" },
  { key: "basics", label: "Name and dates" },
  { key: "includes", label: "What a spot includes" },
  { key: "sell", label: "The spots" },
  { key: "publish", label: "Go live" },
];

function stagesFor(template: Template | null) {
  return isProductionTemplate(template) ? PRODUCTION_STAGES : STAGES;
}

export function ListingWizard({ spaceId: initialSpaceId, templateId }: { spaceId?: string; templateId?: string }) {
  const router = useRouter();
  const href = useHref();
  const refresh = useRefresh();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [chains, setChains] = useState<Chain[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [pickedEvent, setPickedEvent] = useState<EventSummary | null>(null);
  const [stage, setStage] = useState<Stage>(initialSpaceId ? "basics" : "template");
  const [spaceId, setSpaceId] = useState<string | null>(initialSpaceId ?? null);
  /** The body as the server last saw it, so a PATCH can be only the difference. */
  const [savedBody, setSavedBody] = useState<Record<string, unknown> | null>(null);
  const [serverProblems, setServerProblems] = useState<Problem[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [fix, setFix] = useState<{ href: string; label: string } | null>(null);
  const [busy, setBusy] = useState<"saving" | "publishing" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [{ templates: list, availableChains }, existing] = await Promise.all([
          getTemplates(),
          initialSpaceId ? getListing(initialSpaceId) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setTemplates(list);
        setChains(availableChains);
        // Opened from Inspire on one template: start on it, not on the picker.
        const picked = !existing && templateId ? list.find((t) => t.id === templateId) : undefined;
        if (picked) {
          setTemplate(picked);
          setDraft({ ...draftFor(picked), chains: availableChains });
          setStage("basics");
        }
        if (existing) {
          const own = list.find((t) => t.id === existing.space.template?.id) ?? existing.space.template;
          if (own) {
            setTemplate(own);
            const next = draftFromSpace(existing.space, own);
            // A draft reopened with no chains picked yet gets the ones this
            // server can actually take a payment on, not a remembered list.
            setDraft({ ...next, chains: next.chains.length ? next.chains : availableChains });
            setSavedBody(bodyOf(next, own));
            setPickedEvent(existing.space.event);
            // DEMO BRANCH: ?step= opens the draft on that step.
            const want = demoParam("step");
            const known = stagesFor(own).find((st) => st.key === want);
            if (known) setStage(known.key);
          }
        }
      } catch (e) {
        if (alive) setLoadError(describeCreatorError(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialSpaceId, templateId]);

  const problems = useMemo<Problem[]>(() => {
    if (!draft || !template) return [];
    return [...listingProblems(draft, template), ...serverProblems];
  }, [draft, template, serverProblems]);

  const problemsOn = useCallback((step: Step) => problems.filter((p) => p.step === step), [problems]);

  /** Create the draft, or send only what changed. Returns the id, or null. */
  const save = useCallback(async (): Promise<string | null> => {
    if (!draft || !template) return null;
    const body = bodyOf(draft, template);
    setBusy("saving");
    setBanner(null);
    setFix(null);
    setServerProblems([]);
    try {
      if (!spaceId) {
        const { space } = await createListing({ templateId: template.id, ...body });
        setSpaceId(space.id);
        setSavedBody(body);
        void refresh("listings");
        return space.id;
      }
      const patch = patchOf(savedBody ?? {}, body);
      if (Object.keys(patch).length > 0) await patchListing(spaceId, patch);
      setSavedBody(body);
      return spaceId;
    } catch (e) {
      const refusal = refusalOf(e, template, draft);
      setServerProblems(refusal.problems);
      setBanner(refusal.message);
      setFix(refusal.fix);
      const step = firstStepWithProblem(refusal.problems);
      if (step) setStage(step);
      return null;
    } finally {
      setBusy(null);
    }
  }, [draft, template, spaceId, savedBody, refresh]);

  async function publish() {
    const id = await save();
    if (!id || !draft || !template) return;
    setBusy("publishing");
    setBanner(null);
    setFix(null);
    try {
      await publishListing(id);
      void refresh("listings", "views");
      router.push(href(`/listings/${id}?tab=share`));
    } catch (e) {
      const refusal = refusalOf(e, template, draft);
      setServerProblems(refusal.problems);
      setBanner(refusal.message);
      setFix(refusal.fix);
      const step = firstStepWithProblem(refusal.problems);
      if (step) setStage(step);
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <Shell stage={stage}>
        <Notice>{loadError}</Notice>
      </Shell>
    );
  }
  if (!templates) {
    return (
      <Shell stage={stage}>
        <Loading what="what you can sell" />
      </Shell>
    );
  }

  if (stage === "template" || !template || !draft) {
    return (
      <Shell stage="template">
        <TemplateStep
          templates={templates}
          chosen={template}
          onChoose={(t) => {
            setTemplate(t);
            setDraft({ ...draftFor(t), chains });
            setStage("basics");
          }}
        />
      </Shell>
    );
  }

  const stepProblems = problemsOn(stage as Step);
  const blocked = stepProblems.length > 0;
  const stages = stagesFor(template);
  const at = stages.findIndex((s) => s.key === stage);
  const previous = stages[Math.max(0, at - 1)].key;
  const next = stages[Math.min(stages.length - 1, at + 1)].key;

  return (
    <Shell stage={stage} spaceId={spaceId} stages={stages}>
      {stage === "basics" ? (
        <BasicsStep
          draft={draft}
          template={template}
          picked={pickedEvent}
          onPickEvent={setPickedEvent}
          onChange={setDraft}
          problems={problems}
        />
      ) : stage === "includes" ? (
        <IncludesStep draft={draft} onChange={setDraft} problems={problems} />
      ) : stage === "sell" ? (
        <SellStep draft={draft} template={template} availableChains={chains} onChange={setDraft} problems={problems} />
      ) : (
        <PublishStep
          draft={draft}
          template={template}
          onChange={setDraft}
          problems={problems}
          onPublish={() => void publish()}
          publishing={busy === "publishing"}
          banner={banner}
          fix={fix}
          canPublish={problems.length === 0 && busy === null}
        />
      )}

      {stage !== "publish" && banner ? <Notice>{banner}</Notice> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-hairline)] pt-6">
        <button
          type="button"
          className={btnSecondary}
          onClick={() => setStage(previous)}
        >
          Back
        </button>

        <div className="flex flex-wrap items-center gap-3">
          {spaceId ? (
            <button type="button" className={btnSmallSecondary} disabled={busy !== null} onClick={() => void save()}>
              {busy === "saving" ? "Saving…" : "Save and finish later"}
            </button>
          ) : null}
          {stage !== "publish" ? (
            <button
              type="button"
              className={btnPrimary}
              disabled={blocked || busy !== null}
              onClick={() => {
                // The draft reaches the server once there is something to sell;
                // every step before "the spots" only moves on.
                if (next !== "publish") {
                  setStage(next);
                  return;
                }
                void (async () => {
                  const id = await save();
                  if (id) setStage("publish");
                })();
              }}
            >
              {busy === "saving" ? "Saving…" : "Continue"}
            </button>
          ) : null}
        </div>
      </div>

      {blocked && stage !== "publish" ? (
        <p className="text-tiny text-text-muted">Fill in what’s marked above to continue.</p>
      ) : null}
    </Shell>
  );
}

/* ── The page around it ───────────────────────────────────────────── */

function Shell({
  stage,
  spaceId,
  stages = STAGES,
  children,
}: {
  stage: Stage;
  spaceId?: string | null;
  stages?: readonly { key: Stage; label: string }[];
  children: React.ReactNode;
}) {
  const index = stages.findIndex((s) => s.key === stage);
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      <ol className="flex flex-wrap gap-2" aria-label="Steps">
        {stages.map((s, i) => (
          <li key={s.key}>
            <span className={i === index ? pill.sold : i < index ? pill.done : pill.neutral}>
              {i + 1}. {s.label}
            </span>
          </li>
        ))}
      </ol>

      <div className={`${glass} flex min-w-0 flex-col gap-8 p-5 sm:p-7`}>{children}</div>

      {spaceId ? <p className="text-tiny text-text-muted">Draft saved. Only you can see it.</p> : null}
    </div>
  );
}

/* ── Pick your hook ───────────────────────────────────────────────── */

/*
 * What creators learned selling at TOKEN2049: the product is the hook. A
 * suitcase, a dress, a photo with squares is why people look; what a brand
 * pays for is the creator's reach and the content they make. So the products
 * come first, and the content after them, as what brands come back for.
 */

function TemplateStep({
  templates,
  chosen,
  onChoose,
}: {
  templates: readonly Template[];
  chosen: Template | null;
  onChoose: (t: Template) => void;
}) {
  const services = templates.filter((t) => t.kind === "service");
  const placements = templates.filter((t) => t.kind === "placement");

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-body text-text">Pick your hook</h2>
        <p className="text-small text-text-muted">
          The product is why people look. What a brand pays for is your reach and the content you make. Go up early, and
          pick something people don&rsquo;t expect to see.
        </p>
      </div>
      <Group
        title="Products"
        why="Spots on something you carry or wear: a suitcase, a jacket, a helmet."
        list={placements}
        chosen={chosen}
        onChoose={onChoose}
        describe={(t) => `${t.zones.length} ${t.zones.length === 1 ? "spot" : "spots"} on it`}
      />
      <Group
        title="Content"
        why="What brands come back for: videos, coverage, content for their own channels, time in person."
        list={services}
        chosen={chosen}
        onChoose={onChoose}
        describe={(t) => t.service?.summary ?? ""}
      />
    </div>
  );
}

function Group({
  title,
  why,
  list,
  chosen,
  onChoose,
  describe,
}: {
  title: string;
  why: string;
  list: readonly Template[];
  chosen: Template | null;
  onChoose: (t: Template) => void;
  describe: (t: Template) => string;
}) {
  if (list.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-body text-text">{title}</h2>
        <p className="text-small text-text-muted">{why}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onChoose(t)}
              className={`flex h-full w-full flex-col gap-2 rounded-card border p-4 text-left transition-colors duration-180 ${
                chosen?.id === t.id
                  ? "border-amber bg-amber/10"
                  : "border-[color:var(--color-hairline-strong)] hover:bg-white/5"
              }`}
            >
              <span className="text-small text-text">{t.name}</span>
              <span className="text-tiny text-text-muted">{describe(t)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

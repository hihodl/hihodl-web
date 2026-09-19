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
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { useHref } from "@/components/app/base";
import { BackHeader, ctaCommit, ctaPrimary, Notice as HoldNotice } from "@/components/app/hold";
import { Ion, type IonName } from "@/components/app/ion";
import { Body, Empty, SectionLabel } from "@/components/app/spaces/kit";
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
import type { InspiredByInput } from "@/lib/creator/inspired-by";
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

/**
 * The networks a listing made on the web starts with: Solana, the one the web
 * can set up end to end. Base and Polygon need an address from the HOLD app's
 * wallet, so a web draft never starts on them (a draft made in the app keeps
 * the ones it chose).
 */
function webChains(available: readonly Chain[]): Chain[] {
  return available.filter((c) => c === "solana");
}

export function ListingWizard({
  spaceId: initialSpaceId,
  templateId,
  inspiredBy,
}: {
  spaceId?: string;
  templateId?: string;
  /** From Inspire's "Use this idea": the creator whose campaign this started from. */
  inspiredBy?: InspiredByInput | null;
}) {
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
          // "Use this idea": the credit starts filled in; the Basics step's
          // "Inspired by" field is where the creator keeps or clears it.
          setDraft({ ...draftFor(picked), chains: webChains(availableChains), inspiredBy: inspiredBy ?? null });
          setStage("basics");
        }
        if (existing) {
          const own = list.find((t) => t.id === existing.space.template?.id) ?? existing.space.template;
          if (own) {
            setTemplate(own);
            const next = draftFromSpace(existing.space, own);
            // A draft reopened with no chains picked yet gets the ones this
            // server can actually take a payment on, not a remembered list.
            setDraft({ ...next, chains: next.chains.length ? next.chains : webChains(availableChains) });
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
  }, [initialSpaceId, templateId, inspiredBy]);

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

  const title = spaceId ? "Draft" : "New space";
  const back = () => router.push(href("/listings"));

  if (loadError) {
    return (
      <Frame title={title} onBack={back}>
        <Empty icon="cloud-offline-outline" title="This draft isn't loading" body={loadError} />
      </Frame>
    );
  }
  if (!templates) {
    return (
      <Frame title={title} onBack={back}>
        <Loading what="what you can sell" />
      </Frame>
    );
  }

  if (stage === "template" || !template || !draft) {
    const stages = stagesFor(template);
    return (
      <Frame
        title={title}
        subtitle={`Step 1 of ${stages.length} · ${stages[0].label}`}
        onBack={back}
        footer={
          <button type="button" className={ctaPrimary} disabled={!template || !draft} onClick={() => setStage("basics")}>
            Next
          </button>
        }
      >
        <TemplateStep
          templates={templates}
          chosen={template}
          locked={!!spaceId}
          onChoose={(t) => {
            if (spaceId || t.id === template?.id) return;
            setTemplate(t);
            setDraft({ ...draftFor(t), chains, inspiredBy: inspiredBy ?? null });
          }}
        />
      </Frame>
    );
  }

  const stepProblems = problemsOn(stage as Step);
  const blocked = stepProblems.length > 0;
  const stages = stagesFor(template);
  const at = stages.findIndex((s) => s.key === stage);
  // A saved draft keeps its product: its first step is the one after the picker.
  const first = spaceId ? 1 : 0;
  const previous = at > first ? stages[at - 1].key : null;
  const next = stages[Math.min(stages.length - 1, at + 1)].key;
  // The draft reaches the server once there is something to sell: the step before "Go live" saves.
  const saves = next === "publish";

  return (
    <Frame
      title={title}
      subtitle={`Step ${at + 1} of ${stages.length} · ${stages[at].label}`}
      onBack={previous ? () => setStage(previous) : back}
      right={
        spaceId ? (
          <button type="button" className={btnSave} disabled={busy !== null} onClick={() => void save()}>
            {busy === "saving" ? "Saving…" : "Save"}
          </button>
        ) : null
      }
      footer={
        <>
          {stage === "publish" ? (
            <button type="button" className={ctaCommit} disabled={problems.length > 0 || busy !== null} onClick={() => void publish()}>
              {busy === "publishing" ? "Publishing…" : "Publish"}
            </button>
          ) : (
            <button
              type="button"
              className={ctaPrimary}
              disabled={blocked || busy !== null}
              onClick={() => {
                if (!saves) {
                  setStage(next);
                  return;
                }
                void (async () => {
                  const id = await save();
                  if (id) setStage("publish");
                })();
              }}
            >
              {busy === "saving" ? "Saving…" : saves ? "Save and continue" : "Next"}
            </button>
          )}
          {blocked && stage !== "publish" ? (
            <p className="mt-2 text-center text-[12px] leading-4 text-white/55">Fill in what&rsquo;s marked above to continue.</p>
          ) : null}
        </>
      }
    >
      {stage !== "publish" && banner ? <Notice>{banner}</Notice> : null}
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
          banner={banner}
          fix={fix}
          canPublish={problems.length === 0 && busy === null}
        />
      )}
    </Frame>
  );
}

/* ── The screen around it: the app's create.tsx ──────────────────── */

/** The header's Save: a small glass pill, 36 high. */
const btnSave =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[18px] border border-white/[0.22] bg-white/10 px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.14] disabled:opacity-45";

/**
 * TravelScreen with TravelHeader ("New space" or "Draft", and "Step n of N ·
 * name" under it), the step in one column, and the footer holding the one
 * button that moves on, on the footer ground with a hairline over it.
 */
function Frame({
  title,
  subtitle,
  onBack,
  right,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col">
      <BackHeader title={title} subtitle={subtitle} onBack={onBack} right={right} />
      <div className="flex min-w-0 flex-col gap-3.5 pb-6 pt-1">{children}</div>
      {footer ? (
        <div className="sticky bottom-0 z-20 rounded-t-[18px] border-t border-white/[0.08] bg-[#0a1929] px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-2.5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/* ── Pick your hook: the app's TemplateStep ───────────────────────── */

/*
 * What creators learned selling at TOKEN2049: the product is the hook. A
 * suitcase, a dress, a photo with squares is why people look; what a brand
 * pays for is the creator's reach and the content they make. So the products
 * come first, and the content after them, as what brands come back for.
 */

/** The outline the app draws on a product card, when the catalogue sends one. */
type Outlined = Template & { views?: { viewBox: [number, number]; outline: string[] }[] };

function TemplateStep({
  templates,
  chosen,
  locked,
  onChoose,
}: {
  templates: readonly Template[];
  chosen: Template | null;
  locked: boolean;
  onChoose: (t: Template) => void;
}) {
  const products = templates.filter((t) => t.kind !== "service");
  const services = templates.filter((t) => t.kind === "service" && t.service?.format !== "session");
  const sessions = templates.filter((t) => t.kind === "service" && t.service?.format === "session");

  return (
    <div className="flex flex-col gap-3.5">
      <Body dim>
        Pick your hook. The product is why people look; what a brand pays for is your reach and the content you make. The spots
        and their sizes come with the product; you choose which to sell and for how much.
      </Body>
      {locked ? (
        <HoldNotice tone="calm">This draft is saved with its product. Delete the draft to start over with another.</HoldNotice>
      ) : null}

      {products.length ? (
        <>
          <Shelf title="Ad Space" hint="Spots on something you carry or wear. The less people expect it, the more they look." />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {products.map((t) => {
              const on = t.id === chosen?.id;
              const view = (t as Outlined).views?.[0];
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  disabled={locked && !on}
                  onClick={() => onChoose(t)}
                  className={`flex flex-col gap-1.5 rounded-[18px] border p-3.5 text-left transition-colors ${
                    on ? "border-[#F1F5F9] bg-[rgba(241,245,249,0.10)]" : "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"
                  } ${locked && !on ? "opacity-40" : ""}`}
                >
                  <span className="flex h-[110px] items-center justify-center">
                    {view ? (
                      <svg viewBox={`0 0 ${view.viewBox[0]} ${view.viewBox[1]}`} className="h-full max-h-[110px] w-full" aria-hidden>
                        {view.outline.map((d, i) => (
                          <path
                            key={i}
                            d={d}
                            fill="none"
                            stroke={on ? "#FFFFFF" : "rgba(255,255,255,0.55)"}
                            strokeWidth={Math.max(0.6, view.viewBox[0] / 120)}
                          />
                        ))}
                      </svg>
                    ) : (
                      <Ion name="cube-outline" size={34} className="text-white/55" />
                    )}
                  </span>
                  <span className="line-clamp-2 text-[14.5px] font-extrabold tracking-[-0.2px] text-white">{t.name}</span>
                  <span className="text-[12px] font-strong text-white/55">{t.zones.length} spots</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {services.length ? (
        <>
          <Shelf title="Services" hint="What brands come back for: an interview, a video, a post, content for their own channels." />
          {services.map((t) => (
            <OfferCard key={t.id} t={t} on={t.id === chosen?.id} locked={locked} icon="videocam-outline" onChoose={onChoose} unit="slots" />
          ))}
        </>
      ) : null}

      {sessions.length ? (
        <>
          <Shelf title="In the room" hint="Your time at an event: host, moderate, review pitches." />
          {sessions.map((t) => (
            <OfferCard key={t.id} t={t} on={t.id === chosen?.id} locked={locked} icon="people-outline" onChoose={onChoose} unit="sessions" />
          ))}
        </>
      ) : null}
    </div>
  );
}

function Shelf({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{title}</SectionLabel>
      <Body dim>{hint}</Body>
    </div>
  );
}

function OfferCard({
  t,
  on,
  locked,
  icon,
  onChoose,
  unit,
}: {
  t: Template;
  on: boolean;
  locked: boolean;
  icon: IonName;
  onChoose: (t: Template) => void;
  unit: "slots" | "sessions";
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={locked && !on}
      onClick={() => onChoose(t)}
      className={`flex w-full min-w-0 flex-col gap-2.5 rounded-[18px] border p-3.5 text-left transition-colors ${
        on ? "border-[#F1F5F9] bg-[rgba(241,245,249,0.10)]" : "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"
      } ${locked && !on ? "opacity-40" : ""}`}
    >
      <span className="flex items-center gap-2">
        <Ion name={icon} size={18} className={on ? "text-white" : "text-white/[0.62]"} />
        <span className="text-[14.5px] font-extrabold tracking-[-0.2px] text-white">{t.name}</span>
      </span>
      {t.service?.summary ? <span className="text-[13.5px] leading-[19px] text-white/[0.62]">{t.service.summary}</span> : null}
      {t.service?.maxSlots ? (
        <span className="text-[12px] font-strong text-white/55">
          Up to {t.service.maxSlots} {unit}
        </span>
      ) : null}
    </button>
  );
}

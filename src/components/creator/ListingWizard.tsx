/**
 * Publishing a listing, from a browser, with no app installed.
 *
 * WHY IT IS A PAGER AND NOT ONE LONG FORM
 *
 * It was four long steps and it read as one wall: the creator could not tell
 * where one question ended and the next began, and the answer to that is not
 * more headings. It is the shape the app already uses — one step, one card,
 * moved left and right, with the next card showing at the edge so there is
 * never any doubt that there is one. See ./listing/StepPager.tsx, which is the
 * app's `WizardPager` ported across, header comment and all.
 *
 * A card is meant to fit without scrolling. Where one does not — the ladder,
 * which a creator builds rung by rung — it scrolls inside itself rather than
 * clip, which is the same degradation the app's `WizardPage` makes.
 *
 * FORWARD IS EARNED, BACKWARDS IS FREE
 *
 * `unlocked` is computed live from the draft: cards 0…`unlocked` are the ones
 * the pager mounts, so there is physically nothing to the right of a step that
 * has not passed its checks. Nothing ever looks reachable and then refuses.
 * Going back is always free.
 *
 * WHEN THE DRAFT REACHES THE SERVER
 *
 * At the end of the step before "Go live", because that is the first moment
 * there is something the API will accept — a create needs positions or a
 * service offer. From then on every change is a PATCH of only what changed,
 * which is what keeps an omitted field's value: `updateBody` on the backend
 * carries no zod defaults on purpose, and sending the whole form back would be
 * the thing that undoes that.
 *
 * WHY THE FOOTER IS THE GATE AND NOT "PUBLISH"
 *
 * Every rule the API enforces is mirrored in ../lib/creator/rules, checked as
 * the creator types, and shown beside the field it belongs to. A step with
 * something wrong on it does not move on. The alternative — letting them build
 * a ladder for an evening and answering `bid_tier_sells_one` at the end — is
 * worse than having no form at all.
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
  deliveryWhenOf,
  eventKindOf,
  isProductionTemplate,
  isSessionTemplate,
  patchOf,
  type DeliveryWhen,
  type EventAnswer,
  type EventKind,
  type EventSummary,
  type ListingDraft,
  type Template,
} from "@/lib/creator/listing";
import { createListing, getListing, getTemplates, patchListing, publishListing } from "@/lib/creator/listings";
import type { InspiredByInput } from "@/lib/creator/inspired-by";
import { refusalOf } from "@/lib/creator/problems";
import { firstStepWithProblem, listingProblems, type Problem, type Step } from "@/lib/creator/rules";

import { DatesStep } from "./listing/DatesStep";
import { EventStep } from "./listing/EventStep";
import { IncludesStep } from "./listing/IncludesStep";
import { NameStep } from "./listing/NameStep";
import { PromiseStep } from "./listing/PromiseStep";
import { PublishStep } from "./listing/PublishStep";
import { SellStep } from "./listing/SellStep";
import { StepCard, StepPager } from "./listing/StepPager";
import { Loading, Notice } from "./parts";

/** The product picker is a card like the rest, but it has no rules of its own. */
type Stage = "template" | Step;

interface StageDef {
  key: Stage;
  label: string;
}

const STAGES: readonly StageDef[] = [
  { key: "template", label: "Your hook" },
  { key: "name", label: "What to call it" },
  { key: "event", label: "The event" },
  { key: "dates", label: "Dates" },
  { key: "sell", label: "What you sell" },
  { key: "promise", label: "What the brand gets" },
  { key: "publish", label: "Go live" },
];

/**
 * Content production gets one more card, "What a spot includes": a brand buys
 * the package, so the package is decided before the price.
 */
const PRODUCTION_STAGES: readonly StageDef[] = [
  { key: "template", label: "Your hook" },
  { key: "name", label: "What to call it" },
  { key: "event", label: "The event" },
  { key: "dates", label: "Dates" },
  { key: "includes", label: "What a spot includes" },
  { key: "sell", label: "The spots" },
  { key: "promise", label: "What the brand gets" },
  { key: "publish", label: "Go live" },
];

function stagesFor(template: Template | null): readonly StageDef[] {
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
  /** The event card's three answers. None of them is sent: they decide what is. */
  const [eventAnswer, setEventAnswer] = useState<EventAnswer | null>(null);
  const [eventKind, setEventKind] = useState<EventKind | null>(null);
  const [deliveryWhen, setDeliveryWhen] = useState<DeliveryWhen | null>(null);
  const [at, setAt] = useState(0);
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
          // "Use this idea": the credit starts filled in; the name card's
          // "Inspired by" field is where the creator keeps or clears it.
          setDraft({ ...draftFor(picked), chains: webChains(availableChains), inspiredBy: inspiredBy ?? null });
          setEventAnswer(isSessionTemplate(picked) || isProductionTemplate(picked) ? "yes" : null);
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
            // A saved draft has already been past the event question: answer it
            // from what it holds rather than asking a second time. The venue it
            // was saved with is left exactly as it is.
            const had = !!next.eventId || !!next.eventName.trim();
            setEventAnswer(had ? "yes" : isSessionTemplate(own) || isProductionTemplate(own) ? "yes" : "no");
            setEventKind(eventKindOf(existing.space.event));
            setDeliveryWhen(deliveryWhenOf(next, existing.space.event));
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

  const stages = stagesFor(template);
  // A saved draft keeps its product, so the picker is not one of its cards.
  const cards = spaceId ? stages.slice(1) : stages;
  // The card list shortens the moment the draft is first saved — the picker
  // goes — so where we are is always read back against the list we have now.
  const index = Math.min(Math.max(at, 0), cards.length - 1);
  const stage = cards[index]?.key ?? "name";

  const problemsOn = useCallback((step: Stage) => problems.filter((p) => p.step === step), [problems]);

  /**
   * The last card that may be reached. Every card before it has to pass, and
   * the product picker passes once a product is chosen.
   */
  const unlocked = useMemo(() => {
    let n = 0;
    for (let i = 0; i < cards.length - 1; i += 1) {
      const key = cards[i].key;
      const ok = key === "template" ? !!template && !!draft : problems.every((p) => p.step !== key);
      if (!ok) break;
      n = i + 1;
    }
    return n;
  }, [cards, problems, template, draft]);

  /** Jump to the card a refusal belongs to. */
  const showStep = useCallback(
    (step: Step) => {
      const i = cards.findIndex((s) => s.key === step);
      if (i >= 0) setAt(i);
    },
    [cards],
  );

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
      if (step) showStep(step);
      return null;
    } finally {
      setBusy(null);
    }
  }, [draft, template, spaceId, savedBody, refresh, showStep]);

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
      if (step) showStep(step);
    } finally {
      setBusy(null);
    }
  }

  const title = spaceId ? "Draft" : "New space";
  const back = () => router.push(href("/listings"));

  if (loadError) {
    return (
      <Frame title={title} onBack={back}>
        <Empty icon="cloud-offline-outline" title="This draft isn’t loading" body={loadError} />
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

  const stepProblems = stage === "template" ? [] : problemsOn(stage);
  const blocked = stage === "template" ? !template || !draft : stepProblems.length > 0;
  // The draft reaches the server once there is something to sell: the card
  // before "Go live" is the one that saves.
  const saves = cards[index + 1]?.key === "publish";
  const onLast = stage === "publish";

  return (
    <Frame
      title={title}
      onBack={back}
      right={
        spaceId ? (
          <button type="button" className={btnSave} disabled={busy !== null} onClick={() => void save()}>
            {busy === "saving" ? "Saving…" : "Save"}
          </button>
        ) : null
      }
      footer={
        <>
          {onLast ? (
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
                  setAt(index + 1);
                  return;
                }
                void (async () => {
                  const id = await save();
                  if (!id) return;
                  // On the FIRST save the product picker leaves the list, so
                  // every card shifts one to the left and "one card on" is
                  // this same number. `spaceId` read here is the one from
                  // before the save, which is exactly the question being
                  // asked: was the picker still in the list when we counted?
                  setAt(spaceId ? index + 1 : index);
                })();
              }}
            >
              {busy === "saving" ? "Saving…" : saves ? "Save and continue" : "Next"}
            </button>
          )}
          {blocked && !onLast ? (
            <p className="mt-2 text-center text-[12px] leading-4 text-white/55">Fill in what&rsquo;s marked above to continue.</p>
          ) : null}
        </>
      }
    >
      {!onLast && banner ? <Notice>{banner}</Notice> : null}
      <StepPager
        index={index}
        unlocked={unlocked}
        onIndexChange={setAt}
        label={`Step ${index + 1} of ${cards.length} · ${cards[index]?.label ?? ""}`}
      >
        {cards.map((card) => {
          if (card.key === "template") {
            return (
              <TemplateStep
                key="template"
                templates={templates}
                chosen={template}
                locked={!!spaceId}
                onChoose={(t) => {
                  if (spaceId || t.id === template?.id) return;
                  setTemplate(t);
                  setDraft({ ...draftFor(t), chains, inspiredBy: inspiredBy ?? null });
                  setEventAnswer(isSessionTemplate(t) || isProductionTemplate(t) ? "yes" : null);
                }}
              />
            );
          }
          if (!template || !draft) return <StepCard key={card.key} title={card.label} />;
          switch (card.key) {
            case "name":
              return <NameStep key="name" draft={draft} onChange={setDraft} problems={problems} />;
            case "event":
              return (
                <EventStep
                  key="event"
                  draft={draft}
                  template={template}
                  picked={pickedEvent}
                  answer={eventAnswer}
                  kind={eventKind}
                  when={deliveryWhen}
                  onPickEvent={(event) => {
                    setPickedEvent(event);
                    setEventKind(eventKindOf(event));
                  }}
                  onAnswer={setEventAnswer}
                  onKind={setEventKind}
                  onWhen={setDeliveryWhen}
                  onChange={setDraft}
                  problems={problems}
                />
              );
            case "dates":
              return <DatesStep key="dates" draft={draft} onChange={setDraft} problems={problems} />;
            case "includes":
              return <IncludesStep key="includes" draft={draft} onChange={setDraft} problems={problems} />;
            case "sell":
              return (
                <SellStep key="sell" draft={draft} template={template} availableChains={chains} onChange={setDraft} problems={problems} />
              );
            case "promise":
              return <PromiseStep key="promise" draft={draft} template={template} event={pickedEvent} onChange={setDraft} problems={problems} />;
            default:
              return (
                <PublishStep
                  key="publish"
                  draft={draft}
                  template={template}
                  onChange={setDraft}
                  problems={problems}
                  banner={banner}
                  fix={fix}
                  canPublish={problems.length === 0 && busy === null}
                />
              );
          }
        })}
      </StepPager>
    </Frame>
  );
}

/* ── The screen around it: the app's create.tsx ──────────────────── */

/** The header's Save: a small glass pill, 36 high. */
const btnSave =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[18px] border border-white/[0.22] bg-white/10 px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.14] disabled:opacity-45";

/**
 * TravelScreen with TravelHeader ("New space" or "Draft"), the pager under it
 * — which says which step this is, between its two arrows — and the footer
 * holding the one button that moves on, on the footer ground with a hairline
 * over it.
 */
function Frame({
  title,
  onBack,
  right,
  footer,
  children,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col">
      <BackHeader title={title} onBack={onBack} right={right} />
      <div className="flex min-w-0 flex-col gap-2.5 pb-4 pt-1">{children}</div>
      {footer ? (
        <div className="sticky bottom-0 z-20 rounded-t-[18px] border-t border-white/[0.08] bg-[#0a1929] px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-2.5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/* ── Your hook: the app's TemplateStep ────────────────────────────── */

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
    <StepCard title="Your hook" help="The product is why people look; what a brand pays for is your reach and your content.">
      {locked ? (
        <HoldNotice tone="calm">This draft is saved with its product. Delete the draft to start over with another.</HoldNotice>
      ) : null}

      {products.length ? (
        <>
          <Shelf title="Ad Space" hint="Spots on something you carry or wear." />
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
          <Shelf title="Services" hint="What brands come back for: an interview, a video, a post." />
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
    </StepCard>
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

/**
 * What you promise, and then it goes live.
 *
 * THE RULE THE WHOLE STEP EXISTS FOR
 *
 * Every listing must promise at least one thing a venue cannot take away. A
 * sponsor who bought a spot on a suitcase at a conference and nothing else has
 * bought something the organiser can cancel on the door; one who bought the
 * photos, the vlog and the thank-you post still gets those. So a placement
 * lists what it will post, and a service names the day every sponsor has their
 * work by.
 *
 * WHY THE DECLARATIONS ARE TICK BOXES AND NOT SMALL PRINT
 *
 * Each is a sentence the creator is telling sponsors is true, and which of
 * them are asked for depends on where this happens: a conference asks about
 * the venue's rules on branded items, a race asks about logos on athletes'
 * gear, somebody else's wedding asks whether the host agreed. They are the
 * publish gate, not a disclaimer, so they are shown as what they are.
 */

"use client";

import { btnPrimary, btnSecondary, card } from "@/components/ad-space/ui";
import {
  ATTESTATIONS,
  DELIVERABLE_KINDS,
  FALLBACKS,
  LIMITS,
  PLATFORMS,
  isCustomServiceTemplate,
  isProductionTemplate,
  isSessionTemplate,
  requiredAttestations,
  type Attestation,
  type DeliverableDraft,
  type DeliverableKind,
  type Fallback,
  type ListingDraft,
  type Platform,
  type Template,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { BrandGetsEditor } from "./BrandGetsEditor";
import { Block, Choice, Count, Dropdown, Field, Paragraph, Problems, Text, Tick } from "./parts";

const DELIVERABLE_LABEL: Record<DeliverableKind, string> = {
  in_person: "Being there with it",
  photo_post: "A photo post",
  video: "A video",
  story: "A story",
  thank_you_post: "A thank-you post",
  mention: "A mention",
  custom: "Something else",
};

const PLATFORM_LABEL: Record<Platform, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  other: "Somewhere else",
};

const FALLBACK_LABEL: Record<Fallback, string> = {
  content_anyway: "I deliver everything I promised anyway",
  creator_refund: "I refund the sponsor myself",
  next_event: "I carry the sponsor to my next event",
};

const FALLBACK_BODY: Record<Fallback, string> = {
  content_anyway:
    "The posts, photos and videos above still happen, wherever you end up. The least you can promise, and the one most listings pick.",
  creator_refund: "Out of your own wallet. HOLD never holds the money, so HOLD can never send it back — only you can.",
  next_event: "The same spot at another event within 90 days. Name it below, or it promises nothing.",
};

/** Each declaration in the first person, because that is who is saying it. */
const ATTESTATION_TEXT: Record<Attestation, { label: string; body?: string }> = {
  owns_item: { label: "I own the item and will use it as shown." },
  venue_rules_checked: {
    label: "I have checked this event's rules on branded items.",
    body: "Organisers do turn people away for this, and the sponsor is the one who paid.",
  },
  sports_rules_allow_logos: { label: "This race or match allows sponsor logos on what competitors wear." },
  host_consent: { label: "The host of this private event has agreed." },
  temporary_skin_safe_adult: {
    label: "Temporary, skin-safe and removable. I am 18 or over, and nothing goes on my face or anywhere intimate.",
  },
  discloses_sponsorship: {
    label: "Every sponsored post I make is labelled as an ad.",
    body: "#ad, or X's paid partnership label. It is the law in most places and it is what keeps the account you are selling.",
  },
  public_place: { label: "Sessions happen at the venue or somewhere public, never at a private address." },
  no_investment_advice: { label: "I give no investment advice." },
  no_investor_intros: { label: "I make no introductions to investors." },
};

export function PublishStep({
  draft,
  template,
  onChange,
  problems,
  onPublish,
  publishing,
  banner,
  fix,
  canPublish,
}: {
  draft: ListingDraft;
  template: Template;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
  onPublish: () => void;
  publishing: boolean;
  banner: string | null;
  fix: { href: string; label: string } | null;
  canPublish: boolean;
}) {
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });
  const service = template.kind === "service";
  const session = isSessionTemplate(template);
  const required = requiredAttestations(
    template.requiredAttestations,
    draft.venueType,
    template.kind,
    session,
    isProductionTemplate(template),
  );

  return (
    <div className="flex flex-col gap-10">
      {isCustomServiceTemplate(template) ? (
        <Block
          title="What you are selling"
          why="This one is not in our catalogue, so your words are the only description there is. A sponsor reads them and decides."
        >
          <Field
            label="Name it"
            problems={problemsAt(problems, "serviceName")}
            htmlFor="service-name"
            hint={`${LIMITS.SERVICE_NAME_MIN} to ${LIMITS.SERVICE_NAME_MAX} characters.`}
          >
            <Text
              id="service-name"
              value={draft.serviceName}
              onChange={(serviceName) => set({ serviceName })}
              maxLength={LIMITS.SERVICE_NAME_MAX}
            />
          </Field>
          <Field
            label="Say what a brand gets"
            problems={problemsAt(problems, "serviceSummary")}
            htmlFor="service-summary"
            hint={`${LIMITS.SERVICE_SUMMARY_MIN} to ${LIMITS.SERVICE_SUMMARY_MAX} characters.`}
          >
            <Paragraph
              id="service-summary"
              value={draft.serviceSummary}
              onChange={(serviceSummary) => set({ serviceSummary })}
              maxLength={LIMITS.SERVICE_SUMMARY_MAX}
            />
          </Field>
        </Block>
      ) : null}

      {session || isProductionTemplate(template) ? null : (
        <Block
          title="What you get"
          why="The list a brand reads before paying, in your words and your order. The first line is the first thing they read. Our two suggestions are yours to keep, move or remove."
        >
          <BrandGetsEditor draft={draft} template={template} onChange={onChange} problems={problems} />
        </Block>
      )}

      {service ? (
        session ? (
          <Block
            title="When it is delivered"
            why="Nothing to set: time in person is delivered by the day after the event ends, and that date comes from the event you picked."
          >
            <p className="text-small text-text-muted">
              The buyer is the one who confirms it happened, because a conversation leaves no link anybody can check.
            </p>
          </Block>
        ) : (
          <Block
            title="The day every sponsor has it by"
            why="One date for the whole listing, on the page before anybody pays. It is the promise the listing rests on, and a link against each sale is how it is kept."
          >
            <Field label="Delivered by" problems={problemsAt(problems, "deliverBy")} htmlFor="deliver-by">
              <Text id="deliver-by" type="date" value={draft.deliverBy} onChange={(deliverBy) => set({ deliverBy })} />
            </Field>
          </Block>
        )
      ) : (
        <Block
          title="What you will post"
          why="At least one thing a venue cannot take away. A sponsor who bought a spot on your suitcase and nothing else has bought something the organiser can cancel at the door."
        >
          <Deliverables draft={draft} onChange={onChange} problems={problems} />
        </Block>
      )}

      <Block
        title="If it does not happen"
        why="Say it now, on the page, before anybody pays. Sponsors read this and it is the difference between a listing that sells and one that gets a question and no money."
      >
        <Field label="If the event is cancelled, or the venue says no" problems={problemsAt(problems, "fallback")}>
          <Choice
            name="fallback"
            value={draft.fallback}
            onChange={(fallback) => set({ fallback: fallback as Fallback })}
            options={FALLBACKS.filter((f) => !session || f !== "content_anyway").map((f) => ({
              value: f,
              label: FALLBACK_LABEL[f],
              body: FALLBACK_BODY[f],
            }))}
          />
        </Field>
        {draft.fallback === "next_event" ? (
          <Field
            label="Which event, and when"
            problems={problemsAt(problems, "fallbackNote")}
            htmlFor="fallback-note"
            hint="Within 90 days. Without a name and a date this promises nothing."
          >
            <Text
              id="fallback-note"
              value={draft.fallbackNote}
              onChange={(fallbackNote) => set({ fallbackNote })}
              maxLength={LIMITS.REASON_MAX}
            />
          </Field>
        ) : null}
      </Block>

      <Block
        title="What you are declaring"
        why="Each of these is something you are telling sponsors is true. They are shown on your page, and we will not publish without all of them."
      >
        <div className="flex flex-col gap-4">
          {required.map((a) => (
            <Tick
              key={a}
              checked={draft.attestations.includes(a)}
              onChange={(on) =>
                set({
                  attestations: on
                    ? [...draft.attestations.filter((x) => x !== a), a]
                    : draft.attestations.filter((x) => x !== a),
                })
              }
              label={ATTESTATION_TEXT[a].label}
              body={ATTESTATION_TEXT[a].body}
            />
          ))}
          <Problems list={problemsAt(problems, "attestations")} />
        </div>
      </Block>

      <div className={`${card} flex flex-col gap-4 p-6`}>
        <h3 className="text-body text-text">Publish it</h3>
        <p className="text-small text-text-muted">
          Going live needs a verified X account at least 90 days old and an address to be paid at. Your listing is
          published under that handle and the page keeps naming it, so sponsors can see who they paid. Nothing here asks
          you to sign anything on chain: a sponsor&apos;s wallet pays yours in one transaction they sign.
        </p>
        <Problems list={problemsAt(problems, "form")} />
        {banner ? (
          <p role="status" className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
            {banner}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btnPrimary} disabled={publishing || !canPublish} onClick={onPublish}>
            {publishing ? "Publishing…" : "Publish"}
          </button>
          {fix ? (
            <a href={fix.href} className={btnSecondary}>
              {fix.label}
            </a>
          ) : null}
        </div>
        {!canPublish ? (
          <p className="text-tiny text-text-muted">
            There is still something to fix above. Your draft is saved either way — nothing you have written is lost.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ── What a placement posts ───────────────────────────────────────── */

function Deliverables({
  draft,
  onChange,
  problems,
}: {
  draft: ListingDraft;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
}) {
  const list = draft.deliverables;
  const set = (next: DeliverableDraft[]) => onChange({ ...draft, deliverables: next });
  const patch = (i: number, change: Partial<DeliverableDraft>) =>
    set(list.map((d, j) => (j === i ? { ...d, ...change } : d)));

  return (
    <div className="flex flex-col gap-5">
      <Problems list={problemsAt(problems, "deliverables")} />
      {list.map((d, i) => (
        <div key={i} className={`${card} flex flex-col gap-4 p-5`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What" problems={problemsAt(problems, `deliverable:${i}:kind`)} htmlFor={`d-${i}-kind`}>
              <Dropdown
                id={`d-${i}-kind`}
                value={d.kind}
                onChange={(kind) => patch(i, { kind: kind as DeliverableKind })}
                options={DELIVERABLE_KINDS.map((k) => ({ value: k, label: DELIVERABLE_LABEL[k] }))}
              />
            </Field>
            <Field label="How many" problems={problemsAt(problems, `deliverable:${i}:count`)} htmlFor={`d-${i}-count`}>
              <Count
                id={`d-${i}-count`}
                value={d.count}
                min={1}
                max={LIMITS.DELIVERABLE_COUNT_MAX}
                onChange={(count) => patch(i, { count })}
              />
            </Field>
            <Field label="Where" problems={problemsAt(problems, `deliverable:${i}:platform`)} htmlFor={`d-${i}-platform`}>
              <Dropdown
                id={`d-${i}-platform`}
                value={d.platform ?? "x"}
                onChange={(platform) => patch(i, { platform: platform as Platform })}
                options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))}
              />
            </Field>
            <Field label="By when" problems={problemsAt(problems, `deliverable:${i}:dueDate`)} htmlFor={`d-${i}-due`}>
              <Text id={`d-${i}-due`} type="date" value={d.dueDate} onChange={(dueDate) => patch(i, { dueDate })} />
            </Field>
          </div>
          <Field
            label={d.kind === "custom" ? "Say exactly what it is" : "Anything to add"}
            hint={d.kind === "custom" ? "Required, and a sponsor reads it. “Something custom” is not a promise anybody can check." : "Optional."}
            problems={problemsAt(problems, `deliverable:${i}:note`)}
            htmlFor={`d-${i}-note`}
          >
            <Text
              id={`d-${i}-note`}
              value={d.note}
              onChange={(note) => patch(i, { note })}
              maxLength={LIMITS.NOTE_MAX}
            />
          </Field>
          <div>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-[20px] border border-[color:var(--color-hairline-strong)] px-5 text-small text-text transition-colors duration-180 hover:bg-white/5"
              onClick={() => set(list.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      {list.length < LIMITS.DELIVERABLES_MAX ? (
        <div>
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-[20px] border border-[color:var(--color-hairline-strong)] px-5 text-small text-text transition-colors duration-180 hover:bg-white/5"
            onClick={() =>
              set([...list, { kind: "photo_post", platform: "x", count: 1, dueDate: "", note: "" }])
            }
          >
            Add something you will post
          </button>
        </div>
      ) : null}
    </div>
  );
}

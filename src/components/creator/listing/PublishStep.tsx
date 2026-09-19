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

import { btnGlass, Notice } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { Body, Card, Chip, ChipRow, SectionLabel } from "@/components/app/spaces/kit";
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
import { Block, btnSmallGlass, Choice, Count, Dropdown, Field, Paragraph, Problems, Text, Tick } from "./parts";

const DELIVERABLE_LABEL: Record<DeliverableKind, string> = {
  in_person: "In person",
  photo_post: "Photo post",
  video: "Video",
  story: "Story",
  thank_you_post: "Thank-you post",
  mention: "Brand mention",
  custom: "Something else",
};

const PLATFORM_LABEL: Record<Platform, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  other: "Other",
};

const FALLBACK_LABEL: Record<Fallback, string> = {
  content_anyway: "Content anyway",
  creator_refund: "I refund the price",
  next_event: "Moves to the next event",
};

const FALLBACK_BODY: Record<Fallback, string> = {
  content_anyway: "If the venue says no, every post and video is still delivered as promised.",
  creator_refund: "If the venue says no, you send the price back from your own wallet.",
  next_event: "If the venue says no, the spot moves to another event within 90 days.",
};

/** A session's fallback, said about a session rather than a venue. */
const SESSION_FALLBACK_BODY: Record<Fallback, string> = {
  ...FALLBACK_BODY,
  creator_refund: "If a session can't happen, you send the price back from your own wallet. It's your promise: HOLD never holds the money.",
  next_event: "If a session can't happen, it moves to another event within 90 days.",
};

/** Each declaration in the first person, because that is who is saying it. */
const ATTESTATION_TEXT: Record<Attestation, { label: string }> = {
  owns_item: { label: "I own this item and will use it as shown." },
  venue_rules_checked: { label: "I checked the event's rules on branded items." },
  sports_rules_allow_logos: { label: "The race allows brand logos on athletes' gear." },
  host_consent: { label: "The host of this event has agreed." },
  temporary_skin_safe_adult: {
    label: "It's temporary, skin-safe and removable, I'm 18 or over, and nothing goes on the face or intimate areas.",
  },
  discloses_sponsorship: { label: "I'll label every sponsored post as sponsored (#ad or the platform's paid-partnership tag)." },
  public_place: { label: "Every session happens at the event venue or another public place, never at a private address." },
  no_investment_advice: { label: "I won't give investment advice in a session, or tell anyone what to buy or sell." },
  no_investor_intros: { label: "I won't sell or promise introductions to investors, in a session or because of one." },
};

export function PublishStep({
  draft,
  template,
  onChange,
  problems,
  banner,
  fix,
  canPublish,
}: {
  draft: ListingDraft;
  template: Template;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
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
    <div className="flex flex-col gap-3.5">
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
            <Body dim>
              The client confirms each session after it happens. If they say nothing within 7 days, it counts as delivered. If
              they say it didn&rsquo;t happen, your public record shows it as disputed.
            </Body>
          </Block>
        ) : (
          <Block
            title="The day every sponsor has it by"
            why="One date for the whole listing, on the page before anybody pays. It is the promise the listing rests on, and a link against each sale is how it is kept."
          >
            <Field label="Every slot delivered by" problems={problemsAt(problems, "deliverBy")} htmlFor="deliver-by">
              <Text id="deliver-by" type="date" value={draft.deliverBy} onChange={(deliverBy) => set({ deliverBy })} />
            </Field>
          </Block>
        )
      ) : (
        <Block
          title="What the brand gets"
          why="At least one thing a venue cannot take away. A sponsor who bought a spot on your suitcase and nothing else has bought something the organiser can cancel at the door."
        >
          <Deliverables draft={draft} onChange={onChange} problems={problems} />
        </Block>
      )}

      <Block title={session ? "If a session can't happen" : "If the venue says no"}>
        <Field label="Your promise, on the page before anybody pays" problems={problemsAt(problems, "fallback")}>
          <Choice
            name="fallback"
            value={draft.fallback}
            onChange={(fallback) => set({ fallback: fallback as Fallback })}
            options={FALLBACKS.filter((f) => !session || f !== "content_anyway").map((f) => ({
              value: f,
              label: FALLBACK_LABEL[f],
              body: session ? SESSION_FALLBACK_BODY[f] : FALLBACK_BODY[f],
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
              placeholder="Devcon, 12 November"
            />
          </Field>
        ) : null}
      </Block>

      <Block
        title="Declarations"
        why="Before a stranger pays you, confirm each of these. They're part of what you publish, and a space that breaks them is taken down."
      >
        <div className="flex flex-col gap-1.5">
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
            />
          ))}
          <Problems list={problemsAt(problems, "attestations")} />
        </div>
      </Block>

      <Block title="Published as">
        <Card>
          <Body dim>
            Going live needs a verified X account at least 90 days old and an address to be paid at. Your listing is published
            under that handle and the page keeps naming it, so brands can see who they paid. A brand&rsquo;s wallet pays yours in one
            transaction they sign.
          </Body>
          {fix ? (
            <a href={fix.href} className={btnGlass}>
              {fix.label}
            </a>
          ) : null}
        </Card>
        <Problems list={problemsAt(problems, "form")} />
        {banner ? <Notice icon="alert-circle-outline">{banner}</Notice> : null}
        {!canPublish ? (
          <p className="text-[12px] leading-4 text-white/55">
            There is still something to fix above. Your draft is saved either way: nothing you have written is lost.
          </p>
        ) : null}
      </Block>
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
    <div className="flex flex-col gap-2.5">
      <Problems list={problemsAt(problems, "deliverables")} />
      {list.map((d, i) => (
        <Card key={i} className="!gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>{`${d.count}× ${DELIVERABLE_LABEL[d.kind]}`}</SectionLabel>
            <button type="button" aria-label="Remove" className={`${btnSmallGlass} !w-9 !px-0`} onClick={() => set(list.filter((_, j) => j !== i))}>
              <Ion name="trash-outline" size={17} />
            </button>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
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
        </Card>
      ))}
      {list.length < LIMITS.DELIVERABLES_MAX ? (
        <ChipRow label="What the brand gets">
          <Chip icon="add" label="Add a deliverable" onClick={() => set([...list, { kind: "photo_post", platform: "x", count: 1, dueDate: "", note: "" }])} />
        </ChipRow>
      ) : null}
    </div>
  );
}

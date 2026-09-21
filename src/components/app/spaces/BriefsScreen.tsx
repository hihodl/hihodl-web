"use client";

/**
 * Spaces › Briefs: the tab where the brand asks first.
 *
 * Every other tab in this console is a creator selling something. This one is
 * the other direction, and it is one tab rather than two because it is one
 * person: anybody may write a brief, and anybody may apply to somebody else's.
 * There is no brand account to switch into.
 *
 *   ?tab=open      open briefs, newest first — what anybody can apply to
 *   ?tab=mine      the briefs you wrote, with their queues
 *   ?tab=applied   what you applied to, and what became of it
 *   ?brief=<id>    one brief: your queue if it is yours, the entry form if not
 *   ?write=1       write one
 *
 * ── What this screen is careful about ──
 * A brief's page is public (hihodl.xyz/brief/<slug>) and the queue is not.
 * Everything under "Who applied" is read by the brand alone: the message, the
 * entry, the account. The public page gets the winner and nothing else, and
 * that is a rule of the API, not of this file — but the screen says so, because
 * a brand about to read forty entries should know which half of this page the
 * world can see.
 *
 * ── A budget may be a flight ──
 * A brief that pays in kind has no positions, no order and no space: the pick
 * IS the deal, and the money never comes near us. The screen never draws a
 * "$0" — it draws what the brand said it covers.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  applyToBrief,
  briefUrl,
  createBrief,
  FALLBACK_LABEL,
  paysText,
  pickApplicant,
  withdrawApplication,
  withdrawBrief,
  type ApplicantView,
  type BriefDraft,
  type BriefView,
} from "@/lib/creator/briefs";
import { CreatorApiError } from "@/lib/creator/api";
import {
  useBrandRecord,
  useBrief,
  useBriefApplications,
  useMyApplications,
  useMyBriefs,
  useOpenBriefs,
  useRefresh,
} from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { DrillBar } from "./cards";
import { ReadError, countdownText } from "./common";
import {
  btnAmberPill,
  btnGlassPill,
  btnWhite,
  Card,
  centsText,
  Chip,
  ChipRow,
  dateTimeText,
  Divider,
  Empty,
  Field,
  fieldLabel,
  Group,
  inputCls,
  ListRow,
  SectionLabel,
  Tag,
} from "./kit";

type Tab = "open" | "mine" | "applied";

const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "Open briefs" },
  { key: "mine", label: "Yours" },
  { key: "applied", label: "You applied to" },
];

/** The refusal codes this screen can say something better about than its code. */
const SAID: Record<string, string> = {
  already_applied: "You have already applied to this one.",
  application_declined: "This brand declined your application.",
  applications_closed: "Entries have closed.",
  brief_not_open: "This brief is no longer taking applications.",
  brief_is_full: "This brief already has everybody it asked for.",
  your_own_brief: "This is your own brief.",
  nothing_on_offer: "Say what you pay, or what you cover. One of the two.",
  budget_out_of_range: "A budget has to buy a position: $5 to $25,000 (twice that split in two).",
  brand_name_out_of_range: "The brand's name is what the public page says. Two characters or more.",
  link_not_https: "The link has to be an https address.",
  link_not_a_url: "That is not a link.",
  link_too_long: "That link is too long.",
  decide_by_in_the_past: "Pick a day that has not gone by.",
  decide_by_before_applications_close: "You cannot decide before entries close.",
  applications_close_in_the_past: "Entries cannot close in the past.",
  fallback_needs_details: "Say which event it moves to.",
  description_out_of_range: "Say what you want in 20 to 280 characters.",
  perks_too_long: "That is longer than 280 characters.",
};

/** A refusal in words, from its code or the first policy problem in it. */
function refusalText(e: unknown): string {
  if (!(e instanceof CreatorApiError)) return "Something went wrong. Try again.";
  const problems = (e.details?.problems as { code: string }[] | undefined) ?? [];
  const code = problems[0]?.code ?? e.code;
  return SAID[code] ?? e.serverMessage ?? "That did not go through.";
}

/* ── The screen ───────────────────────────────────────────────────── */

export function BriefsScreen({ tab, brief, write }: { tab: string | null; brief: string | null; write: boolean }) {
  const href = useHref();
  const active: Tab = TABS.some((t) => t.key === tab) ? (tab as Tab) : "open";

  if (brief) return <BriefDetail id={brief} back={`${href("/briefs")}?tab=${active}`} />;
  if (write) return <WriteBrief back={`${href("/briefs")}?tab=mine`} />;

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <ChipRow label="Briefs">
          {TABS.map((t) => (
            <Chip key={t.key} label={t.label} selected={active === t.key} href={`${href("/briefs")}?tab=${t.key}`} />
          ))}
        </ChipRow>
        <Link href={`${href("/briefs")}?write=1`} className={btnWhite}>
          <Ion name="add" size={16} />
          Write a brief
        </Link>
      </div>

      {active === "open" ? <OpenBriefs /> : null}
      {active === "mine" ? <MyBriefs /> : null}
      {active === "applied" ? <Applied /> : null}
    </div>
  );
}

/* ── Lists ────────────────────────────────────────────────────────── */

/** When entries close, or that they have. */
function closesText(brief: BriefView): string {
  if (!brief.applicationsCloseAt) return "Open until it is filled";
  const ends = new Date(brief.applicationsCloseAt).getTime();
  return ends > Date.now() ? `Entries close in ${countdownText(brief.applicationsCloseAt)}` : "Entries closed";
}

function BriefRow({ brief, href }: { brief: BriefView; href: string }) {
  const where = brief.event?.name ?? brief.city ?? "Anywhere";
  return (
    <ListRow
      href={href}
      title={brief.title}
      meta={`${brief.brandName ?? "A brand"} · ${where} · ${closesText(brief)}`}
      right={
        <span className="flex items-center gap-2">
          {brief.inKindOnly ? <Tag label="Covered" tone="calm" /> : null}
          <span className="text-[14.5px] font-strong tabular-nums text-white">{paysText(brief)}</span>
        </span>
      }
    />
  );
}

function OpenBriefs() {
  const href = useHref();
  const briefs = useOpenBriefs();
  if (briefs.error) return <ReadError error={briefs.error} />;
  if (!briefs.data) return <Skeleton className="h-40" />;
  if (briefs.data.length === 0) {
    return (
      <Card>
        <Empty
          icon="megaphone-outline"
          title="No brand is asking right now"
          body="When one does, it shows here and on a page anybody can open. You can write one yourself."
          action={
            <Link href={`${href("/briefs")}?write=1`} className={btnGlassPill}>
              Write a brief
            </Link>
          }
        />
      </Card>
    );
  }
  return (
    <Group title="Open briefs" meta={`${briefs.data.length}`}>
      <ul className="flex flex-col divide-y divide-white/[0.08]">
        {briefs.data.map((b) => (
          <li key={b.id}>
            <BriefRow brief={b} href={`${href("/briefs")}?brief=${b.id}`} />
          </li>
        ))}
      </ul>
    </Group>
  );
}

function MyBriefs() {
  const href = useHref();
  const briefs = useMyBriefs();
  const record = useBrandRecord();
  if (briefs.error) return <ReadError error={briefs.error} />;
  if (!briefs.data) return <Skeleton className="h-40" />;
  return (
    <div className="flex flex-col gap-4">
      {record.data && record.data.briefsPosted > 0 ? (
        <Group title="Your record" meta="what a creator reads before saying yes">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
            <Figure label="Briefs" value={record.data.briefsPosted} />
            <Figure label="Creators picked" value={record.data.creatorsPicked} />
            <Figure label="Ended with nobody" value={record.data.endedWithNobody} />
            <Figure label="Paid through HOLD" value={centsText(record.data.paidCents)} />
          </div>
          {record.data.awaitingPayment > 0 ? (
            <p className="text-[12.5px] leading-[17px] text-amber">
              {record.data.awaitingPayment} pick{record.data.awaitingPayment === 1 ? "" : "s"} still waiting to be paid. A creator
              reads that number too.
            </p>
          ) : null}
        </Group>
      ) : null}

      {briefs.data.length === 0 ? (
        <Card>
          <Empty
            icon="create-outline"
            title="You have not asked for anything yet"
            body="A brief is a listing you write: what you want, what you pay, and what happens if the venue says no. Creators apply and you pick."
            action={
              <Link href={`${href("/briefs")}?write=1`} className={btnGlassPill}>
                Write a brief
              </Link>
            }
          />
        </Card>
      ) : (
        <Group title="Briefs you wrote" meta={`${briefs.data.length}`}>
          <ul className="flex flex-col divide-y divide-white/[0.08]">
            {briefs.data.map((b) => (
              <li key={b.id}>
                <ListRow
                  href={`${href("/briefs")}?brief=${b.id}`}
                  title={b.title}
                  meta={`${paysText(b)} · ${closesText(b)}`}
                  right={
                    <span className="flex items-center gap-2">
                      {b.applicantCount > 0 ? <Tag label={`${b.applicantCount} applied`} tone="good" /> : null}
                      <Tag label={b.status === "open" ? "Open" : b.status} tone={b.status === "open" ? "calm" : "dim"} />
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        </Group>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] font-bold uppercase tracking-[0.4px] text-white/55">{label}</span>
      <span className="text-[20px] font-extrabold tabular-nums tracking-[-0.3px] text-white">{value}</span>
    </div>
  );
}

function Applied() {
  const href = useHref();
  const rows = useMyApplications();
  if (rows.error) return <ReadError error={rows.error} />;
  if (!rows.data) return <Skeleton className="h-40" />;
  if (rows.data.length === 0) {
    return (
      <Card>
        <Empty icon="paper-plane-outline" title="You have not applied to anything" body="Open briefs are on the first tab." />
      </Card>
    );
  }
  return (
    <Group title="What you applied to" meta={`${rows.data.length}`}>
      <ul className="flex flex-col divide-y divide-white/[0.08]">
        {rows.data.map(({ application, brief }) => (
          <li key={application.id}>
            <ListRow
              href={`${href("/briefs")}?brief=${brief.id}`}
              title={brief.title}
              meta={`${brief.brandName ?? "A brand"} · ${paysText(brief)}`}
              right={
                application.status === "picked" ? (
                  <Tag label="You were picked" tone="good" />
                ) : application.status === "applied" ? (
                  <Tag label="Waiting" tone="calm" />
                ) : (
                  <Tag label={application.status} tone="dim" />
                )
              }
            />
          </li>
        ))}
      </ul>
    </Group>
  );
}

/* ── One brief ────────────────────────────────────────────────────── */

function BriefDetail({ id, back }: { id: string; back: string }) {
  const brief = useBrief(id);
  if (brief.error) return <ReadError error={brief.error} />;
  if (!brief.data) {
    return (
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
        <DrillBar back={back} crumb="Briefs" title="Brief" />
        <Skeleton className="h-52" />
      </div>
    );
  }
  const b = brief.data;
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      <DrillBar back={back} crumb="Briefs" title={b.title} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Terms brief={b} />
          {b.mine ? <Queue brief={b} /> : <Apply brief={b} />}
        </div>
        <PublicLink brief={b} />
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[14px] text-white/[0.82]">{k}</span>
      <span className="shrink text-right text-[14px] font-strong text-white">{v}</span>
    </div>
  );
}

function Terms({ brief }: { brief: BriefView }) {
  return (
    <Group title="The ask">
      <p className="text-[15px] leading-[21px] text-white">{brief.description}</p>
      <Divider />
      <div className="flex flex-col gap-1.5">
        <Line k="Brand" v={brief.brandHandle ? `${brief.brandName ?? "—"} · @${brief.brandHandle}` : brief.brandName ?? "—"} />
        <Line k="Where" v={brief.event?.name ?? brief.city ?? "Anywhere"} />
        <Line k="Pays" v={paysText(brief)} />
        {brief.inKindOnly ? null : (
          <Line
            k="How"
            v={brief.payMode === "upfront" ? "All of it up front" : "Half on acceptance, half on delivery"}
          />
        )}
        <Line k="People wanted" v={`${brief.pickedCount} of ${brief.peopleWanted} picked`} />
        <Line k="Entries" v={closesText(brief)} />
        {brief.decideBy ? <Line k="Decides by" v={dateTimeText(brief.decideBy)} /> : null}
        {brief.decidedAt ? <Line k="Decided" v={dateTimeText(brief.decidedAt)} /> : null}
        <Line
          k="If the venue says no"
          v={`${FALLBACK_LABEL[brief.fallback] ?? brief.fallback}${brief.fallbackNote ? ` · ${brief.fallbackNote}` : ""}`}
        />
      </div>
      {brief.inKindOnly ? (
        <p className="text-[12.5px] leading-[17px] text-white/55">
          Nothing is paid through HOLD on this one. The brand covers what it says above, directly, and we never hold it — so there is
          no order, no fee and no space. What we keep is the record of who was picked.
        </p>
      ) : null}
    </Group>
  );
}

function PublicLink({ brief }: { brief: BriefView }) {
  const [copied, setCopied] = useState(false);
  const url = briefUrl(brief.slug, typeof window === "undefined" ? undefined : window.location.origin.replace(/^https:\/\/app\./, "https://"));
  return (
    <Card className="gap-2.5">
      <SectionLabel>Its public page</SectionLabel>
      <p className="break-all text-[13px] leading-[18px] text-white/[0.82]">{url}</p>
      <p className="text-[12.5px] leading-[17px] text-white/55">
        Anybody can open this, signed in or not. It shows the ask, what you pay, when you decide and — once you pick — who won. It
        never shows who applied and did not.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnGlassPill}
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          <Ion name={copied ? "checkmark" : "link-outline"} size={15} />
          {copied ? "Copied" : "Copy link"}
        </button>
        <a href={url} target="_blank" rel="noreferrer" className={btnGlassPill}>
          Open
        </a>
      </div>
    </Card>
  );
}

/* ── The brand's side: the queue ──────────────────────────────────── */

function Queue({ brief }: { brief: BriefView }) {
  const apps = useBriefApplications(brief.id);
  const refresh = useRefresh();
  const router = useRouter();
  const href = useHref();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const waiting = useMemo(() => (apps.data ?? []).filter((a) => a.status === "applied"), [apps.data]);
  const picked = useMemo(() => (apps.data ?? []).filter((a) => a.status === "picked"), [apps.data]);

  async function pick(a: ApplicantView) {
    setBusy(a.id);
    setError(null);
    try {
      await pickApplicant(a.id);
      await refresh("brief", "brief-applications", "my-briefs", "brand-record", "listings");
    } catch (e) {
      setError(refusalText(e));
    } finally {
      setBusy(null);
    }
  }

  async function takeDown() {
    setBusy("brief");
    setError(null);
    try {
      await withdrawBrief(brief.id);
      await refresh("brief", "my-briefs", "open-briefs", "brand-record");
      router.push(`${href("/briefs")}?tab=mine`);
    } catch (e) {
      setError(refusalText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {picked.length > 0 ? (
        <Group title="Picked" meta={`${picked.length}`}>
          <ul className="flex flex-col divide-y divide-white/[0.08]">
            {picked.map((a) => (
              <li key={a.id}>
                <Applicant a={a} />
              </li>
            ))}
          </ul>
          {brief.inKindOnly ? null : (
            <p className="text-[12.5px] leading-[17px] text-white/55">
              Each pick has a draft listing with your budget already laid out on it. The creator publishes it — only they can, it is
              sold under their X account — and you pay the first position then.
            </p>
          )}
        </Group>
      ) : null}

      <Group
        title="Who applied"
        meta={apps.data ? `${waiting.length} waiting on you` : ""}
        action={
          brief.status === "open" ? (
            <button type="button" onClick={takeDown} disabled={busy === "brief"} className="text-[12.5px] font-strong text-white/[0.82] hover:text-white">
              Take the brief down
            </button>
          ) : null
        }
      >
        {error ? <p className="text-[12.5px] font-strong text-amber">{error}</p> : null}
        {apps.error ? (
          <ReadError error={apps.error} />
        ) : !apps.data ? (
          <Skeleton className="h-24" />
        ) : waiting.length === 0 ? (
          <Empty icon="people-outline" title="Nobody is waiting on you" body="Entries show here the moment somebody applies." />
        ) : (
          <ul className="flex flex-col divide-y divide-white/[0.08]">
            {waiting.map((a) => (
              <li key={a.id}>
                <Applicant
                  a={a}
                  action={
                    <button type="button" className={btnAmberPill} disabled={!!busy} onClick={() => void pick(a)}>
                      {busy === a.id ? "Picking…" : "Pick"}
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <p className="text-[12.5px] leading-[17px] text-white/55">
          Only you read this. Nothing here reaches the public page except the person you pick.
        </p>
      </Group>
    </div>
  );
}

function Applicant({ a, action }: { a: ApplicantView; action?: React.ReactNode }) {
  const c = a.creator;
  const record = c.trackRecord;
  const facts = [
    c.xFollowers != null ? `${c.xFollowers.toLocaleString("en-US")} followers` : null,
    record.delivered > 0 ? `${record.delivered} delivered` : null,
    record.missed > 0 ? `${record.missed} missed` : null,
    record.disputed > 0 ? `${record.disputed} disputed` : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {c.xAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.xAvatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/55">
            <Ion name="person-outline" size={16} />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14.5px] font-bold text-white">{c.xName ?? c.xHandle ?? "A creator"}</span>
          <span className="truncate text-[12.5px] text-white/55">
            {c.xHandle ? `@${c.xHandle}` : "No X account linked"}
            {facts.length ? ` · ${facts.join(" · ")}` : ""}
          </span>
        </span>
        {action}
      </div>
      {a.link ? (
        <a
          href={a.link}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[13px] font-strong text-white/[0.82] hover:text-white"
        >
          <Ion name="play-outline" size={14} />
          Their entry
        </a>
      ) : null}
      {a.message ? <p className="text-[13.5px] leading-[19px] text-white/[0.82]">{a.message}</p> : null}
    </div>
  );
}

/* ── The creator's side: applying ─────────────────────────────────── */

function Apply({ brief }: { brief: BriefView }) {
  const refresh = useRefresh();
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = brief.myApplication;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await applyToBrief(brief.id, message.trim() || null, link.trim() || null);
      await refresh("brief", "my-applications", "open-briefs");
    } catch (e) {
      setError(refusalText(e));
    } finally {
      setBusy(false);
    }
  }

  async function takeBack() {
    if (!mine) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawApplication(mine.id);
      await refresh("brief", "my-applications");
    } catch (e) {
      setError(refusalText(e));
    } finally {
      setBusy(false);
    }
  }

  if (mine && mine.status !== "withdrawn") {
    return (
      <Group title="Your application">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14.5px] text-white">
            {mine.status === "picked"
              ? "You were picked."
              : mine.status === "declined"
                ? "This brand went with somebody else."
                : "Sent. The brand picks; you will see it here."}
          </p>
          {mine.status === "applied" ? (
            <button type="button" className={btnGlassPill} disabled={busy} onClick={() => void takeBack()}>
              Take it back
            </button>
          ) : null}
        </div>
        {mine.status === "picked" && mine.spaceId ? (
          <p className="text-[12.5px] leading-[17px] text-white/55">
            There is a draft listing waiting for you in Listings, with the budget already on it. Publish it and the brand pays the
            first position.
          </p>
        ) : null}
        {mine.status === "picked" && !mine.spaceId ? (
          <p className="text-[12.5px] leading-[17px] text-white/55">
            This one is covered rather than paid, so there is no listing and nothing to charge. The brand arranges what it said it
            covers with you directly.
          </p>
        ) : null}
        {error ? <p className="text-[12.5px] font-strong text-amber">{error}</p> : null}
      </Group>
    );
  }

  if (!brief.applicationsOpen) {
    return (
      <Group title="Applying">
        <Empty icon="time-outline" title="Entries have closed" body="Nothing more can be sent to this brief." />
      </Group>
    );
  }

  return (
    <Group title="Apply">
      <Field label="Your entry" hint="A video, a quote post, a reel. https only — it is what the brand watches first.">
        <input
          className={inputCls}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://x.com/you/status/…"
          inputMode="url"
        />
      </Field>
      <Field label="Why you" hint="Read by this brand and nobody else.">
        <textarea
          className={`${inputCls} min-h-[104px] resize-y`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          placeholder="I am going anyway, I have the flight booked, and this is the third year I have covered it."
        />
      </Field>
      {error ? <p className="text-[12.5px] font-strong text-amber">{error}</p> : null}
      <div className="flex items-center gap-2">
        <button type="button" className={btnAmberPill} disabled={busy} onClick={() => void send()}>
          {busy ? "Sending…" : "Apply"}
        </button>
        <span className="text-[12.5px] text-white/55">One application each. You can take it back while it is waiting.</span>
      </div>
    </Group>
  );
}

/* ── Writing one ──────────────────────────────────────────────────── */

/** `datetime-local` gives a local time with no zone; the API wants an instant. */
function asInstant(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function WriteBrief({ back }: { back: string }) {
  const router = useRouter();
  const refresh = useRefresh();
  const [form, setForm] = useState({
    brandName: "",
    brandHandle: "",
    title: "",
    description: "",
    city: "",
    pays: "money" as "money" | "covered",
    budget: "",
    perks: "",
    peopleWanted: 1,
    payMode: "split" as "split" | "upfront",
    closes: "",
    decideBy: "",
    fallback: "content_anyway",
    fallbackNote: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setBusy(true);
    setError(null);
    const dollars = Number(form.budget.replace(/[^0-9.]/g, ""));
    const draft: BriefDraft = {
      title: form.title.trim(),
      description: form.description.trim(),
      brandName: form.brandName.trim(),
      brandHandle: form.brandHandle.trim().replace(/^@/, "") || null,
      city: form.city.trim() || null,
      // Covered: no money at all, and `perks` is what makes it an offer.
      budgetCents: form.pays === "covered" ? 0 : Math.round((Number.isFinite(dollars) ? dollars : 0) * 100),
      perks: form.perks.trim() || null,
      peopleWanted: form.peopleWanted,
      payMode: form.payMode,
      fallback: form.fallback,
      fallbackNote: form.fallbackNote.trim() || null,
      applicationsCloseAt: asInstant(form.closes),
      decideBy: asInstant(form.decideBy),
    };
    try {
      const { brief } = await createBrief(draft);
      await refresh("my-briefs", "open-briefs", "brand-record");
      router.push(back.replace(/\?.*$/, "") + `?brief=${brief.id}`);
    } catch (e) {
      setError(refusalText(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <DrillBar back={back} crumb="Briefs" title="Write a brief" />

      <Group title="Who is asking">
        <Field label="Brand" hint="What the public page says, not your HOLD name. Ask as the brand you are asking for.">
          <input className={inputCls} value={form.brandName} onChange={(e) => set("brandName", e.target.value)} maxLength={60} placeholder="Bing Bong" />
        </Field>
        <Field label="Its X handle" hint="So anybody reading the page can check you. Optional.">
          <input className={inputCls} value={form.brandHandle} onChange={(e) => set("brandHandle", e.target.value)} maxLength={16} placeholder="@bingbong" />
        </Field>
      </Group>

      <Group title="What you want">
        <Field label="Title">
          <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="One creator at TOKEN2049 in Singapore" />
        </Field>
        <Field label="The ask" hint="20 to 280 characters. Your words become the listing, so say it the way you would post it.">
          <textarea
            className={`${inputCls} min-h-[104px] resize-y`}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={280}
            placeholder="Come to the event with us, be on camera at the booth, and post one video from the floor."
          />
        </Field>
        <Field label="Where" hint="A city. Leave it empty if it does not matter.">
          <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} placeholder="Singapore" />
        </Field>
        <Field label="How many creators">
          <input
            className={inputCls}
            type="number"
            min={1}
            max={20}
            value={form.peopleWanted}
            onChange={(e) => set("peopleWanted", Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          />
        </Field>
      </Group>

      <Group title="What they get">
        <ChipRow label="What you pay">
          <Chip label="Money" selected={form.pays === "money"} onClick={() => set("pays", "money")} />
          <Chip label="You cover the costs" selected={form.pays === "covered"} onClick={() => set("pays", "covered")} />
        </ChipRow>
        {form.pays === "money" ? (
          <>
            <Field label="Budget per creator" hint="$5 to $25,000 for each half. We take 5% on top, which you pay.">
              <input className={inputCls} value={form.budget} onChange={(e) => set("budget", e.target.value)} inputMode="decimal" placeholder="1,000" />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className={fieldLabel}>How it is paid</span>
              <ChipRow label="How it is paid">
                <Chip label="Half now, half on delivery" selected={form.payMode === "split"} onClick={() => set("payMode", "split")} />
                <Chip label="All up front" selected={form.payMode === "upfront"} onClick={() => set("payMode", "upfront")} />
              </ChipRow>
              <p className="text-[12px] leading-4 text-white/55">
                Half covers the flight, half keeps the outcome attached to the money. We never hold either: it goes from your wallet
                to theirs.
              </p>
            </div>
          </>
        ) : (
          <p className="text-[12.5px] leading-[17px] text-white/55">
            No money moves through HOLD. Say below exactly what you cover — the flight, the hotel, the ticket — and arrange it
            yourself with whoever you pick. We keep the record of the deal, nothing else.
          </p>
        )}
        <Field
          label={form.pays === "covered" ? "What you cover" : "What you cover as well (optional)"}
          hint="In your words: “Return flight and four nights.”"
        >
          <input className={inputCls} value={form.perks} onChange={(e) => set("perks", e.target.value)} maxLength={280} placeholder="Return flight and four nights at the hotel" />
        </Field>
      </Group>

      <Group title="When">
        <Field label="Entries close" hint="Optional. Leave it empty to keep it open until it is filled.">
          <input className={inputCls} type="datetime-local" value={form.closes} onChange={(e) => set("closes", e.target.value)} />
        </Field>
        <Field label="You decide by" hint="The promise on the page: “Winner announced on the 21st.”">
          <input className={inputCls} type="datetime-local" value={form.decideBy} onChange={(e) => set("decideBy", e.target.value)} />
        </Field>
      </Group>

      <Group title="If the venue says no">
        <p className="text-[12.5px] leading-[17px] text-white/55">
          You are asking somebody to go somewhere, so you answer this one. A brief that does not say it ends in an argument about who
          keeps the deposit.
        </p>
        <ChipRow label="If the venue says no">
          {Object.entries(FALLBACK_LABEL).map(([key, label]) => (
            <Chip key={key} label={label} selected={form.fallback === key} onClick={() => set("fallback", key)} />
          ))}
        </ChipRow>
        <Field label={form.fallback === "next_event" ? "Which event" : "Anything to add"} >
          <input className={inputCls} value={form.fallbackNote} onChange={(e) => set("fallbackNote", e.target.value)} maxLength={280} />
        </Field>
      </Group>

      {error ? <p className="text-[13px] font-strong text-amber">{error}</p> : null}
      <div className="flex items-center gap-2 pb-6">
        <button type="button" className={btnAmberPill} disabled={busy} onClick={() => void submit()}>
          {busy ? "Posting…" : "Post the brief"}
        </button>
        <Link href={back} className={btnGlassPill}>
          Cancel
        </Link>
      </div>
    </div>
  );
}

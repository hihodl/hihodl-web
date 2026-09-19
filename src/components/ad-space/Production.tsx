"use client";

/**
 * Content production, the brand's side (spaces-content-production-v0.md).
 *
 *   BriefForm        — in the checkout, before paying: "you bring the brief".
 *   PaidProduction   — in the checkout, once paid: the brand's link.
 *   BrandProductionPanel — hihodl.xyz/p/<token>: the delivery, Accept, or one
 *                      revision; silence accepts it after 72 hours.
 *
 * The brand is buying a package made for its own channels, so the page talks
 * about what they get and when, never about our fee mechanics.
 */

import { useEffect, useState } from "react";

import { CheckoutError, acceptProduction, askForRevision, rememberBrandToken } from "@/lib/ad-space/checkout-client";
import { CHAIN_LABEL, usageText } from "@/lib/ad-space/format";
import type { BrandProduction, BriefBody, Order, PackageView, ProductionView, Space } from "@/lib/ad-space/types";

import { btnPrimary, btnSecondary, btnSmallSecondary, card, eyebrow, input, pill } from "./ui";

/* ── Shared words ──────────────────────────────────────────────────── */

export const GOALS: readonly { value: BriefBody["goal"]; label: string; body: string }[] = [
  { value: "awareness", label: "Awareness", body: "More people know the brand after the event." },
  { value: "product_launch", label: "Product launch", body: "Something new, shown and explained on camera." },
  { value: "hiring", label: "Hiring", body: "The team and what it is like to work there." },
  { value: "community", label: "Community", body: "The people around the brand, and the room." },
];

const GOAL_LABEL: Record<string, string> = Object.fromEntries(GOALS.map((g) => [g.value, g.label]));

/** What a spot includes, as a brand reads it before paying. Sells, so it is plain and specific. */
export function PackageLines({ pkg }: { pkg: PackageView }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {pkg.lines.map((l) => (
          <li key={l.key} className="flex items-baseline justify-between gap-4 text-small">
            <span className="text-text">{l.label}</span>
            <span className="tabular-nums text-text-muted">× {l.count}</span>
          </li>
        ))}
      </ul>
      <p className="text-tiny text-text-muted">
        Delivered to you within {pkg.turnaroundHours} hours of the shoot day. {usageText(pkg)} One round of changes
        included.
      </p>
    </div>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/* ── The brief, in the checkout ────────────────────────────────────── */

export interface BriefDraft {
  goal: BriefBody["goal"] | null;
  keyMessages: string[];
  interviewees: string;
  assetsUrl: string;
  dos: string;
  donts: string;
  contactKind: "x" | "telegram";
  contactValue: string;
}

export const EMPTY_BRIEF: BriefDraft = {
  goal: null,
  keyMessages: [""],
  interviewees: "",
  assetsUrl: "",
  dos: "",
  donts: "",
  contactKind: "telegram",
  contactValue: "",
};

/** The brief as the API takes it, or the first thing still missing, in words. */
export function briefBodyOf(d: BriefDraft): { body: BriefBody } | { problem: string } {
  if (!d.goal) return { problem: "Pick what this is for." };
  const messages = d.keyMessages.map((m) => m.trim()).filter(Boolean);
  if (messages.length === 0) return { problem: "Write at least one key message." };
  if (messages.some((m) => m.length > 140)) return { problem: "Keep each key message under 140 characters." };
  const url = d.assetsUrl.trim();
  if (url && !/^https:\/\/\S+$/i.test(url)) return { problem: "The brand assets link should start with https://." };
  const handle = d.contactValue.trim().replace(/^@/, "");
  const ok = d.contactKind === "x" ? /^[A-Za-z0-9_]{1,15}$/.test(handle) : /^[A-Za-z0-9_]{5,32}$/.test(handle);
  if (!ok) return { problem: `Add the shoot-day contact's ${d.contactKind === "x" ? "X" : "Telegram"} handle.` };
  return {
    body: {
      goal: d.goal,
      keyMessages: messages,
      interviewees: d.interviewees.trim() || null,
      assetsUrl: url || null,
      dos: d.dos.trim() || null,
      donts: d.donts.trim() || null,
      shootContact: { kind: d.contactKind, value: `@${handle}` },
    },
  };
}

/**
 * The brand brings the brief, before paying. Everything on it goes to the
 * creator and their team only; the page says so beside the form.
 */
export function BriefForm({
  draft,
  onChange,
  onContinue,
  busy,
  creatorHandle,
}: {
  draft: BriefDraft;
  onChange: (d: BriefDraft) => void;
  onContinue: (body: BriefBody) => void;
  busy: boolean;
  creatorHandle: string | null;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const set = (change: Partial<BriefDraft>) => onChange({ ...draft, ...change });
  const who = creatorHandle ? `@${creatorHandle}` : "the creator";

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const r = briefBodyOf(draft);
        if ("problem" in r) {
          setProblem(r.problem);
          return;
        }
        setProblem(null);
        onContinue(r.body);
      }}
    >
      <div>
        <p className="text-body text-text">You bring the brief</p>
        <p className="mt-1 text-small text-text-muted">
          What {who} films is built on this. Only {who}, their team and you see it.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small text-text">What is it for?</legend>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => {
            const on = draft.goal === g.value;
            return (
              <button
                key={g.value}
                type="button"
                aria-pressed={on}
                onClick={() => set({ goal: g.value })}
                className={`flex flex-col gap-1 rounded-input border px-3 py-2.5 text-left transition-colors duration-180 ${
                  on ? "border-amber bg-amber/10" : "border-[color:var(--color-hairline-strong)] hover:bg-white/5"
                }`}
              >
                <span className="text-small text-text">{g.label}</span>
                <span className="text-tiny text-text-muted">{g.body}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className="text-small text-text">Key messages, up to 3</p>
        {draft.keyMessages.map((m, i) => (
          <input
            key={i}
            className={input}
            value={m}
            maxLength={140}
            placeholder={i === 0 ? "e.g. Pay anyone in USDC, no gas" : "Another message"}
            aria-label={`Key message ${i + 1}`}
            onChange={(e) => set({ keyMessages: draft.keyMessages.map((x, j) => (j === i ? e.target.value : x)) })}
          />
        ))}
        {draft.keyMessages.length < 3 ? (
          <button
            type="button"
            className="w-fit text-tiny text-[#9FB7C2] hover:text-text"
            onClick={() => set({ keyMessages: [...draft.keyMessages, ""] })}
          >
            + Add a message
          </button>
        ) : null}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-small text-text">Who to interview, and when they are there</span>
        <textarea
          className={`${input} resize-y`}
          rows={2}
          maxLength={280}
          value={draft.interviewees}
          placeholder="Optional. e.g. Our CEO, day two after 3pm at booth B12"
          onChange={(e) => set({ interviewees: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-small text-text">Brand assets link</span>
        <input
          className={input}
          type="url"
          value={draft.assetsUrl}
          maxLength={300}
          placeholder="https://… logo, fonts, guidelines"
          onChange={(e) => set({ assetsUrl: e.target.value })}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-small text-text">Do</span>
          <textarea
            className={`${input} resize-y`}
            rows={2}
            maxLength={500}
            value={draft.dos}
            placeholder="Optional"
            onChange={(e) => set({ dos: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-small text-text">Don&rsquo;t</span>
          <textarea
            className={`${input} resize-y`}
            rows={2}
            maxLength={500}
            value={draft.donts}
            placeholder="Optional"
            onChange={(e) => set({ donts: e.target.value })}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-small text-text">Contact on the shoot day</p>
        <div className="flex gap-2">
          <select
            className={`${input} w-auto`}
            value={draft.contactKind}
            aria-label="Contact on"
            onChange={(e) => set({ contactKind: e.target.value as "x" | "telegram" })}
          >
            <option value="telegram" className="bg-night">
              Telegram
            </option>
            <option value="x" className="bg-night">
              X
            </option>
          </select>
          <input
            className={input}
            value={draft.contactValue}
            placeholder="@handle"
            aria-label="Handle"
            maxLength={33}
            onChange={(e) => set({ contactValue: e.target.value })}
          />
        </div>
      </div>

      {problem ? (
        <p className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text" role="status">
          {problem}
        </p>
      ) : null}

      <div>
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? "Saving…" : "Continue to payment"}
        </button>
      </div>
    </form>
  );
}

/** The brief in one line, in the payment step, with the way back to it. */
export function BriefReady({ brief, onEdit }: { brief: BriefBody; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-input border border-success/30 bg-success/[0.06] px-4 py-3">
      <span className="min-w-0">
        <span className="block text-small text-text">Brief ready</span>
        <span className="block truncate text-tiny text-text-muted">
          {GOAL_LABEL[brief.goal]} · {brief.keyMessages.length} key {brief.keyMessages.length === 1 ? "message" : "messages"}
        </span>
      </span>
      <button type="button" className={btnSmallSecondary} onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

/* ── Paid, in the checkout ─────────────────────────────────────────── */

function brandLinkFor(token: string): string {
  const origin = typeof window === "undefined" ? "https://hihodl.xyz" : window.location.origin;
  return `${origin}/p/${token}`;
}

export function PaidProduction({ order, space }: { order: Order; space: Space }) {
  const handle = space.creator.xHandle;
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setToken(rememberBrandToken(order)), [order]);
  const link = token ? brandLinkFor(token) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className={`${eyebrow} text-success`}>Paid</p>
        <h3 className="mt-2 font-display text-h3 font-light text-text">Your production spot is booked.</h3>
        <p className="mt-3 text-small text-text-muted">
          {order.sponsorPaysUsdc} USDC on {CHAIN_LABEL[order.chain]}. @{handle} has your brief and will reach your
          shoot-day contact.
        </p>
      </div>
      {link ? (
        <div className="flex flex-col gap-3 rounded-card border border-amber/40 bg-amber/[0.06] p-4">
          <p className="text-body text-text">Save this link: your delivery arrives here.</p>
          <p className="text-small text-text-muted">
            It is where you open the files, accept them or ask for one round of changes. Anyone with it can do that, so
            keep it to yourself.
          </p>
          <p className="break-all rounded-input border border-[color:var(--color-hairline-strong)] bg-white/[0.04] px-3 py-2 font-mono text-tiny text-text">
            {link}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSmallSecondary}
              onClick={() =>
                void navigator.clipboard
                  .writeText(link)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => setCopied(false))
              }
            >
              {copied ? "Copied" : "Copy the link"}
            </button>
            <a href={`/p/${token}`} target="_blank" rel="noreferrer" className={btnSmallSecondary}>
              Open it
            </a>
          </div>
        </div>
      ) : (
        <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-text-muted" role="status">
          Your delivery link hasn&rsquo;t reached this page yet. Reload the page in this browser to get it.
        </p>
      )}
    </div>
  );
}

/* ── The delivery page ─────────────────────────────────────────────── */

type BrandScreen = "delivery" | "revision";

const STATE: Record<ProductionView["state"], { label: string; cls: string }> = {
  awaiting_delivery: { label: "Being made", cls: pill.open },
  overdue: { label: "Running late", cls: pill.attention },
  delivered: { label: "Ready for you", cls: pill.attention },
  revision_requested: { label: "Revision asked", cls: pill.open },
  accepted: { label: "Accepted", cls: pill.done },
};

export function BrandProductionPanel({ token, initial }: { token: string; initial: BrandProduction }) {
  const [data, setData] = useState(initial);
  const [screen, setScreen] = useState<BrandScreen>("delivery");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"accept" | "revision" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const p = data.production;
  const who = data.creatorHandle ? `@${data.creatorHandle}` : "The creator";
  const state = STATE[p.state];

  const explain = (e: unknown) =>
    e instanceof CheckoutError
      ? e.code === "already_accepted"
        ? "This delivery is already accepted."
        : e.code === "revision_already_used"
          ? "The one round of changes has been used."
          : e.code === "revision_note_invalid"
            ? "Say what to change, in up to 500 characters."
            : "That didn't go through. Try again in a moment."
      : "That didn't go through. Try again in a moment.";

  if (screen === "revision") {
    return (
      <div className="flex flex-col gap-6">
        <button type="button" onClick={() => setScreen("delivery")} className="w-fit text-tiny text-[#9FB7C2] hover:text-text">
          ← Back
        </button>
        <div>
          <p className={`${eyebrow} text-amber`}>{data.space.title}</p>
          <h1 className="mt-3 font-display text-h3 font-light text-text">Ask for a revision</h1>
          <p className="mt-3 max-w-xl text-small text-text-muted">
            One round, so say everything you want changed in one go. {who} delivers the new cut to this page.
          </p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-small text-text">What should change</span>
          <textarea
            className={`${input} resize-y`}
            rows={6}
            maxLength={500}
            value={note}
            placeholder="e.g. Shorter cuts, under 30 seconds. Use the second interview take."
            onChange={(e) => setNote(e.target.value)}
          />
          <span className="text-right text-tiny tabular-nums text-text-faint">{note.trim().length} / 500</span>
        </label>
        {notice ? (
          <p className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text" role="status">
            {notice}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={btnPrimary}
            disabled={busy !== null || note.trim().length === 0}
            onClick={() => {
              setBusy("revision");
              setNotice(null);
              void askForRevision(token, note.trim())
                .then((next) => {
                  setData(next);
                  setScreen("delivery");
                })
                .catch((e) => setNotice(explain(e)))
                .finally(() => setBusy(null));
            }}
          >
            {busy === "revision" ? "Sending…" : "Send the revision"}
          </button>
          <button type="button" className={btnSecondary} onClick={() => setScreen("delivery")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className={`${eyebrow} text-amber`}>
          {data.space.eventName ? `${data.space.eventName} · ` : ""}Content production
        </p>
        <h1 className="mt-3 font-display text-h3 font-light text-text md:text-h2">{data.space.title}</h1>
        <p className="mt-3 text-small text-text-muted">
          By {who}. {data.positionLabel ? `${data.positionLabel}. ` : ""}Paid on {CHAIN_LABEL[data.chain]}.
        </p>
      </div>

      <section className={`${card} flex flex-col gap-5 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body text-text">
              {p.state === "accepted"
                ? "Delivered and accepted"
                : p.delivery
                  ? p.state === "revision_requested"
                    ? "Your revision is with the creator"
                    : "Your content is ready"
                  : "Your content is being made"}
            </p>
            <p className="mt-1 text-tiny text-text-muted">
              {p.delivery
                ? `Delivered ${when(p.delivery.deliveredAt)}.`
                : `Filmed ${new Date(`${p.shootOn}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}. Due ${when(p.dueAt)}.`}
            </p>
          </div>
          <span className={state.cls}>{state.label}</span>
        </div>

        {p.delivery ? (
          <>
            <a href={p.delivery.url} target="_blank" rel="noreferrer" className={btnPrimary}>
              Open the files
            </a>
            {p.package ? (
              <ul className="flex flex-col gap-1.5">
                {p.package.lines.map((l) => {
                  const got = p.delivery!.checklist.find((c) => c.key === l.key)?.count ?? 0;
                  return (
                    <li key={l.key} className="flex items-baseline justify-between gap-4 text-small">
                      <span className="text-text-muted">{l.label}</span>
                      <span className={`tabular-nums ${got >= l.count ? "text-success" : "text-amber"}`}>
                        {got} of {l.count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        ) : p.package ? (
          <PackageLines pkg={p.package} />
        ) : null}

        {p.revision ? (
          <div className="rounded-input border border-[color:var(--color-hairline-strong)] px-4 py-3">
            <p className="text-tiny text-text-muted">Your revision, {when(p.revision.requestedAt)}</p>
            <p className="mt-1 whitespace-pre-line text-small text-text">{p.revision.note}</p>
          </div>
        ) : null}

        {p.state === "delivered" ? (
          <div className="flex flex-col gap-3 border-t border-[color:var(--color-hairline)] pt-5">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={btnPrimary}
                disabled={busy !== null}
                onClick={() => {
                  setBusy("accept");
                  setNotice(null);
                  void acceptProduction(token)
                    .then(setData)
                    .catch((e) => setNotice(explain(e)))
                    .finally(() => setBusy(null));
                }}
              >
                {busy === "accept" ? "Accepting…" : "Accept"}
              </button>
              {p.revisionAvailable ? (
                <button type="button" className={btnSecondary} disabled={busy !== null} onClick={() => setScreen("revision")}>
                  Ask for a revision
                </button>
              ) : null}
            </div>
            {p.autoAcceptAt ? (
              <p className="text-tiny text-text-muted">
                If you say nothing, it is accepted on {when(p.autoAcceptAt)}.
                {p.revisionAvailable ? " You have one round of changes." : " Your round of changes has been used."}
              </p>
            ) : null}
          </div>
        ) : null}

        {p.state === "accepted" && p.accepted ? (
          <p className="text-tiny text-text-muted">
            {p.accepted.auto ? `Accepted automatically ${when(p.accepted.at)}, 72 hours after delivery.` : `You accepted it ${when(p.accepted.at)}.`}
          </p>
        ) : null}

        {notice ? (
          <p className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text" role="status">
            {notice}
          </p>
        ) : null}
      </section>

      {p.package ? <p className="text-tiny text-text-muted">{usageText(p.package)}</p> : null}
    </div>
  );
}

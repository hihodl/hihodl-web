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
import { t as tNow, type MessageKey } from "@/lib/app/i18n";
import { fmtDate, fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { btnPrimary, btnSecondary, btnSmallSecondary, card, eyebrow, input, pill } from "./ui";

/* ── Shared words ──────────────────────────────────────────────────── */

/** Each goal's words are keys, read at render in the language on screen. */
export const GOALS: readonly { value: BriefBody["goal"]; labelKey: MessageKey; bodyKey: MessageKey }[] = [
  { value: "awareness", labelKey: "offers.production.goal.awareness", bodyKey: "offers.production.goal.awarenessBody" },
  {
    value: "product_launch",
    labelKey: "offers.production.goal.productLaunch",
    bodyKey: "offers.production.goal.productLaunchBody",
  },
  { value: "hiring", labelKey: "offers.production.goal.hiring", bodyKey: "offers.production.goal.hiringBody" },
  { value: "community", labelKey: "offers.production.goal.community", bodyKey: "offers.production.goal.communityBody" },
];

function goalLabel(goal: string): string {
  const g = GOALS.find((x) => x.value === goal);
  return g ? tNow(g.labelKey) : goal;
}

/** What a spot includes, as a brand reads it before paying. Sells, so it is plain and specific. */
export function PackageLines({ pkg }: { pkg: PackageView }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {pkg.lines.map((l) => (
          <li key={l.key} className="flex items-baseline justify-between gap-4 text-small">
            <span className="text-sp-ink">{l.label}</span>
            <span className="tabular-nums text-sp-ink/85">× {fmtNumber(l.count)}</span>
          </li>
        ))}
      </ul>
      <p className="text-tiny text-sp-ink/85">
        {t("offers.production.packageNote", { hours: pkg.turnaroundHours, usage: usageText(pkg) })}
      </p>
    </div>
  );
}

function when(iso: string): string {
  return fmtDate(iso, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
  if (!d.goal) return { problem: tNow("offers.production.problem.goal") };
  const messages = d.keyMessages.map((m) => m.trim()).filter(Boolean);
  if (messages.length === 0) return { problem: tNow("offers.production.problem.noMessage") };
  if (messages.some((m) => m.length > 140)) return { problem: tNow("offers.production.problem.messageMax", { max: 140 }) };
  const url = d.assetsUrl.trim();
  if (url && !/^https:\/\/\S+$/i.test(url)) return { problem: tNow("offers.production.problem.assetsUrl") };
  const handle = d.contactValue.trim().replace(/^@/, "");
  const ok = d.contactKind === "x" ? /^[A-Za-z0-9_]{1,15}$/.test(handle) : /^[A-Za-z0-9_]{5,32}$/.test(handle);
  if (!ok) return { problem: tNow("offers.production.problem.contact", { kind: d.contactKind === "x" ? "X" : "Telegram" }) };
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
  const t = useT();
  const [problem, setProblem] = useState<string | null>(null);
  const set = (change: Partial<BriefDraft>) => onChange({ ...draft, ...change });
  const who = creatorHandle ? `@${creatorHandle}` : t("offers.booking.theCreator");

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
        <p className="text-body text-sp-ink">{t("offers.production.briefTitle")}</p>
        <p className="mt-1 text-small text-sp-ink/85">{t("offers.production.briefBody", { who })}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small text-sp-ink">{t("offers.production.whatFor")}</legend>
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
                  on ? "border-amber bg-amber/10" : "border-[color:var(--color-hairline-strong)] hover:bg-sp-ink/5"
                }`}
              >
                <span className="text-small text-sp-ink">{t(g.labelKey)}</span>
                <span className="text-tiny text-sp-ink/85">{t(g.bodyKey)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className="text-small text-sp-ink">{t("offers.production.keyMessages", { max: 3 })}</p>
        {draft.keyMessages.map((m, i) => (
          <input
            key={i}
            className={input}
            value={m}
            maxLength={140}
            placeholder={i === 0 ? t("offers.production.keyMessagePlaceholder") : t("offers.production.anotherMessage")}
            aria-label={t("offers.production.keyMessageAria", { n: i + 1 })}
            onChange={(e) => set({ keyMessages: draft.keyMessages.map((x, j) => (j === i ? e.target.value : x)) })}
          />
        ))}
        {draft.keyMessages.length < 3 ? (
          <button
            type="button"
            className="w-fit text-tiny text-white/80 hover:text-sp-ink"
            onClick={() => set({ keyMessages: [...draft.keyMessages, ""] })}
          >
            {t("offers.sheet.addMessage")}
          </button>
        ) : null}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-small text-sp-ink">{t("offers.production.interviewees")}</span>
        <textarea
          className={`${input} resize-y`}
          rows={2}
          maxLength={280}
          value={draft.interviewees}
          placeholder={t("offers.production.intervieweesPlaceholder")}
          onChange={(e) => set({ interviewees: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-small text-sp-ink">{t("offers.production.assets")}</span>
        <input
          className={input}
          type="url"
          value={draft.assetsUrl}
          maxLength={300}
          placeholder={t("offers.production.assetsPlaceholder")}
          onChange={(e) => set({ assetsUrl: e.target.value })}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-small text-sp-ink">{t("offers.production.dos")}</span>
          <textarea
            className={`${input} resize-y`}
            rows={2}
            maxLength={500}
            value={draft.dos}
            placeholder={t("common.optional")}
            onChange={(e) => set({ dos: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-small text-sp-ink">{t("offers.production.donts")}</span>
          <textarea
            className={`${input} resize-y`}
            rows={2}
            maxLength={500}
            value={draft.donts}
            placeholder={t("common.optional")}
            onChange={(e) => set({ donts: e.target.value })}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-small text-sp-ink">{t("offers.production.shootContact")}</p>
        <div className="flex gap-2">
          <select
            className={`${input} w-auto`}
            value={draft.contactKind}
            aria-label={t("offers.production.contactOn")}
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
            placeholder={t("offers.production.handlePlaceholder")}
            aria-label={t("offers.production.handle")}
            maxLength={33}
            onChange={(e) => set({ contactValue: e.target.value })}
          />
        </div>
      </div>

      {problem ? (
        <p className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-sp-ink" role="status">
          {problem}
        </p>
      ) : null}

      <div>
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? t("common.saving") : t("offers.production.continueToPayment")}
        </button>
      </div>
    </form>
  );
}

/** The brief in one line, in the payment step, with the way back to it. */
export function BriefReady({ brief, onEdit }: { brief: BriefBody; onEdit: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3 rounded-input border border-success/30 bg-success/[0.06] px-4 py-3">
      <span className="min-w-0">
        <span className="block text-small text-sp-ink">{t("offers.production.briefReady")}</span>
        <span className="block truncate text-tiny text-sp-ink/85">
          {goalLabel(brief.goal)} · {t("offers.production.keyMessageCount", { count: brief.keyMessages.length })}
        </span>
      </span>
      <button type="button" className={btnSmallSecondary} onClick={onEdit}>
        {t("common.edit")}
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
  const t = useT();
  const handle = space.creator.xHandle;
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setToken(rememberBrandToken(order)), [order]);
  const link = token ? brandLinkFor(token) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className={`${eyebrow} text-sp-ok`}>{t("offers.production.paid")}</p>
        <h3 className="mt-2 font-display text-h3 font-light text-sp-ink">{t("offers.production.booked")}</h3>
        <p className="mt-3 text-small text-sp-ink/85">
          {t("offers.production.paidBody", { amount: order.sponsorPaysUsdc, chain: CHAIN_LABEL[order.chain], handle })}
        </p>
      </div>
      {link ? (
        <div className="flex flex-col gap-3 rounded-card border border-amber/40 bg-amber/[0.06] p-4">
          <p className="text-body text-sp-ink">{t("offers.production.link.save")}</p>
          <p className="text-small text-sp-ink/85">{t("offers.production.link.body")}</p>
          <p className="break-all rounded-input border border-[color:var(--color-hairline-strong)] bg-sp-ink/[0.04] px-3 py-2 font-mono text-tiny text-sp-ink">
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
              {copied ? t("common.copied") : t("offers.link.copy")}
            </button>
            <a href={`/p/${token}`} target="_blank" rel="noreferrer" className={btnSmallSecondary}>
              {t("offers.link.open")}
            </a>
          </div>
        </div>
      ) : (
        <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-sp-ink/85" role="status">
          {t("offers.production.link.missing")}
        </p>
      )}
    </div>
  );
}

/* ── The delivery page ─────────────────────────────────────────────── */

type BrandScreen = "delivery" | "revision";

const STATE: Record<ProductionView["state"], { labelKey: MessageKey; cls: string }> = {
  awaiting_delivery: { labelKey: "offers.production.state.awaitingDelivery", cls: pill.open },
  overdue: { labelKey: "offers.production.state.overdue", cls: pill.attention },
  delivered: { labelKey: "offers.production.state.delivered", cls: pill.attention },
  revision_requested: { labelKey: "offers.production.state.revisionRequested", cls: pill.open },
  accepted: { labelKey: "offers.production.state.accepted", cls: pill.done },
};

export function BrandProductionPanel({ token, initial }: { token: string; initial: BrandProduction }) {
  const t = useT();
  const [data, setData] = useState(initial);
  const [screen, setScreen] = useState<BrandScreen>("delivery");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"accept" | "revision" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const p = data.production;
  const who = data.creatorHandle ? `@${data.creatorHandle}` : t("offers.booking.theCreatorStart");
  const state = STATE[p.state];

  const explain = (e: unknown) =>
    e instanceof CheckoutError
      ? e.code === "already_accepted"
        ? t("offers.production.error.alreadyAccepted")
        : e.code === "revision_already_used"
          ? t("offers.production.error.revisionUsed")
          : e.code === "revision_note_invalid"
            ? t("offers.production.error.noteInvalid", { max: 500 })
            : t("offers.production.error.generic")
      : t("offers.production.error.generic");

  if (screen === "revision") {
    return (
      <div className="flex flex-col gap-6">
        <button type="button" onClick={() => setScreen("delivery")} className="w-fit text-tiny text-white/80 hover:text-sp-ink">
          ← {t("common.back")}
        </button>
        <div>
          <p className={`${eyebrow} text-sp-amber`}>{data.space.title}</p>
          <h1 className="mt-3 font-display text-h3 font-light text-sp-ink">{t("offers.production.askRevision")}</h1>
          <p className="mt-3 max-w-xl text-small text-sp-ink/85">{t("offers.production.revisionBody", { who })}</p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-small text-sp-ink">{t("offers.production.whatChange")}</span>
          <textarea
            className={`${input} resize-y`}
            rows={6}
            maxLength={500}
            value={note}
            placeholder={t("offers.production.revisionPlaceholder")}
            onChange={(e) => setNote(e.target.value)}
          />
          <span className="text-right text-tiny tabular-nums text-sp-ink/80">{fmtNumber(note.trim().length)} / {fmtNumber(500)}</span>
        </label>
        {notice ? (
          <p className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-sp-ink" role="status">
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
            {busy === "revision" ? t("offers.sheet.sending") : t("offers.production.sendRevision")}
          </button>
          <button type="button" className={btnSecondary} onClick={() => setScreen("delivery")}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className={`${eyebrow} text-sp-amber`}>
          {data.space.eventName ? `${data.space.eventName} · ` : ""}
          {t("offers.production.eyebrow")}
        </p>
        <h1 className="mt-3 font-display text-h3 font-light text-sp-ink md:text-h2">{data.space.title}</h1>
        <p className="mt-3 text-small text-sp-ink/85">
          {data.positionLabel
            ? t("offers.production.byWithPosition", { who, position: data.positionLabel, chain: CHAIN_LABEL[data.chain] })
            : t("offers.production.by", { who, chain: CHAIN_LABEL[data.chain] })}
        </p>
      </div>

      <section className={`${card} flex flex-col gap-5 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body text-sp-ink">
              {p.state === "accepted"
                ? t("offers.production.status.accepted")
                : p.delivery
                  ? p.state === "revision_requested"
                    ? t("offers.production.status.revision")
                    : t("offers.production.status.ready")
                  : t("offers.production.status.making")}
            </p>
            <p className="mt-1 text-tiny text-sp-ink/85">
              {p.delivery
                ? t("offers.production.deliveredAt", { when: when(p.delivery.deliveredAt) })
                : t("offers.production.filmedDue", {
                    filmed: fmtDate(`${p.shootOn}T12:00:00Z`, { weekday: "long", day: "numeric", month: "long" }),
                    due: when(p.dueAt),
                  })}
            </p>
          </div>
          <span className={state.cls}>{t(state.labelKey)}</span>
        </div>

        {p.delivery ? (
          <>
            <a href={p.delivery.url} target="_blank" rel="noreferrer" className={btnPrimary}>
              {t("offers.production.openFiles")}
            </a>
            {p.package ? (
              <ul className="flex flex-col gap-1.5">
                {p.package.lines.map((l) => {
                  const got = p.delivery!.checklist.find((c) => c.key === l.key)?.count ?? 0;
                  return (
                    <li key={l.key} className="flex items-baseline justify-between gap-4 text-small">
                      <span className="text-sp-ink/85">{l.label}</span>
                      <span className={`tabular-nums ${got >= l.count ? "text-sp-ok" : "text-sp-amber"}`}>
                        {t("offers.production.gotOf", { got, total: l.count })}
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
            <p className="text-tiny text-sp-ink/85">{t("offers.production.yourRevision", { when: when(p.revision.requestedAt) })}</p>
            <p className="mt-1 whitespace-pre-line text-small text-sp-ink">{p.revision.note}</p>
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
                {busy === "accept" ? t("offers.production.accepting") : t("offers.production.accept")}
              </button>
              {p.revisionAvailable ? (
                <button type="button" className={btnSecondary} disabled={busy !== null} onClick={() => setScreen("revision")}>
                  {t("offers.production.askRevision")}
                </button>
              ) : null}
            </div>
            {p.autoAcceptAt ? (
              <p className="text-tiny text-sp-ink/85">
                {t("offers.production.autoAccept", { when: when(p.autoAcceptAt) })}
                {p.revisionAvailable ? ` ${t("offers.production.roundLeft")}` : ` ${t("offers.production.roundUsed")}`}
              </p>
            ) : null}
          </div>
        ) : null}

        {p.state === "accepted" && p.accepted ? (
          <p className="text-tiny text-sp-ink/85">
            {p.accepted.auto
              ? t("offers.production.acceptedAuto", { when: when(p.accepted.at) })
              : t("offers.production.acceptedByYou", { when: when(p.accepted.at) })}
          </p>
        ) : null}

        {notice ? (
          <p className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-sp-ink" role="status">
            {notice}
          </p>
        ) : null}
      </section>

      {p.package ? <p className="text-tiny text-sp-ink/85">{usageText(p.package)}</p> : null}
    </div>
  );
}

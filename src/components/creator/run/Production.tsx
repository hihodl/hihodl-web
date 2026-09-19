/**
 * One sold content production spot, for the creator or a seat that delivers it
 * (spaces-content-production-v0.md).
 *
 * Three screens, one at a time, each with its way back: the spot (countdown,
 * where it stands, what the brand said), the brand's brief, and the delivery
 * form (a private link and a checklist against the package). Nothing here is
 * ever on a public page: the link is for the brand.
 *
 * The app sells a production on the web and has no screen for it, so this is
 * drawn with the app's Spaces parts: a card with its tag, KV lines, an amber
 * Notice for a revision, a row into the brief, the white plate to deliver.
 */

"use client";

import { useState } from "react";

import { ctaPrimary, ctaSecondary, Notice } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { countdownText } from "@/components/app/spaces/common";
import { Card, Divider, Field, inputCls, KV, P, SectionLabel, SheetRow, Tag } from "@/components/app/spaces/kit";
import {
  PRODUCTION_DELIVERABLE_LABEL,
  USAGE_SCOPE_LABEL,
  USAGE_TERM_LABEL,
  type ChecklistItem,
  type ProductionView,
} from "@/lib/creator/listing";
import { deliverProduction, setShootDay } from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

type Screen = "spot" | "brief" | "deliver";

const GOAL: Record<string, string> = {
  awareness: "Awareness",
  product_launch: "Product launch",
  hiring: "Hiring",
  community: "Community",
};

/** "Fri 10 Oct, 02:00" in the reader's own clock. */
function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function day(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function stateOf(p: ProductionView): { label: string; tone: "calm" | "good" | "caution" } {
  switch (p.state) {
    case "accepted":
      return { label: "Accepted", tone: "good" };
    case "delivered":
      return { label: "With the brand", tone: "calm" };
    case "revision_requested":
      return { label: "Revision asked", tone: "caution" };
    case "overdue":
      return { label: "Late", tone: "caution" };
    default:
      return { label: "To deliver", tone: "caution" };
  }
}

const meta = `text-[12.5px] leading-[17px] ${P.dim}`;

export function ProductionSpot({
  positionId,
  production,
  canDeliver,
  onChanged,
}: {
  positionId: string;
  production: ProductionView;
  canDeliver: boolean;
  onChanged: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("spot");
  const [p, setP] = useState(production);
  const updated = (next: ProductionView) => {
    setP(next);
    onChanged();
  };

  if (screen === "brief") return <BriefScreen production={p} onBack={() => setScreen("spot")} />;
  if (screen === "deliver") {
    return (
      <DeliverScreen
        positionId={positionId}
        production={p}
        onBack={() => setScreen("spot")}
        onDelivered={(next) => {
          updated(next);
          setScreen("spot");
        }}
      />
    );
  }
  return <SpotScreen positionId={positionId} production={p} canDeliver={canDeliver} onOpen={setScreen} onChanged={updated} />;
}

/* ── The spot ─────────────────────────────────────────────────────── */

function SpotScreen({
  positionId,
  production: p,
  canDeliver,
  onOpen,
  onChanged,
}: {
  positionId: string;
  production: ProductionView;
  canDeliver: boolean;
  onOpen: (s: Screen) => void;
  onChanged: (p: ProductionView) => void;
}) {
  const state = stateOf(p);
  const owed = p.state === "awaiting_delivery" || p.state === "overdue" || p.state === "revision_requested";
  const canMoveShoot = canDeliver && !p.delivery;
  const [editingDay, setEditingDay] = useState(false);
  const [shootOn, setShootOn] = useState(p.shootOn);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2.5">
      <Card>
        <div className="flex items-center justify-between gap-2.5">
          <p className="text-[12px] font-strong uppercase tracking-[0.4px] text-white/55">Production spot</p>
          <Tag label={state.label} tone={state.tone} />
        </div>
        <p className={`text-[28px] font-strong tracking-[-0.6px] tabular-nums ${p.state === "overdue" ? "text-amber" : "text-white"}`}>
          {p.state === "accepted" ? "Accepted" : p.state === "delivered" ? "With the brand" : countdownText(p.dueAt)}
        </p>
        <p className={meta}>
          Due {when(p.dueAt)} · {p.package?.turnaroundHours ?? ""} h after the shoot day
        </p>
        <Divider />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-[14px] font-strong text-white">Shoot day · {day(p.shootOn)}</p>
            <p className={meta}>
              {p.shootOnSet ? "Set by you." : "The event's last day, until you pick one."} The event runs {day(p.event.startsOn)} to {day(p.event.endsOn)}.
            </p>
          </div>
          {canMoveShoot && !editingDay ? (
            <button
              type="button"
              onClick={() => setEditingDay(true)}
              className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[17px] border border-white/[0.14] bg-white/[0.06] px-[13px] text-[13.5px] font-strong text-white/[0.62] hover:bg-white/10"
            >
              <Ion name="calendar-outline" size={14} />
              Change
            </button>
          ) : null}
        </div>
        {editingDay ? (
          <div className="flex flex-col gap-2.5">
            <Field label="Day" htmlFor={`shoot-${positionId}`}>
              <input id={`shoot-${positionId}`} type="date" className={inputCls} value={shootOn} onChange={(e) => setShootOn(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={() => setEditingDay(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={`${ctaPrimary} flex-1`}
                disabled={busy || !shootOn}
                onClick={() => {
                  setBusy(true);
                  setNotice(null);
                  void setShootDay(positionId, shootOn)
                    .then(({ production }) => {
                      setEditingDay(false);
                      onChanged(production);
                    })
                    .catch((e) => setNotice(describeRunError(e)))
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Saving…" : "Save day"}
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      {p.state === "revision_requested" && p.revision ? (
        <Notice icon="alert-circle-outline">
          <span className="block">The brand asked for one revision</span>
          <span className="mt-1 block whitespace-pre-line font-normal text-white">{p.revision.note}</span>
          <span className="mt-1 block font-normal text-white/[0.62]">Deliver the new cut with a fresh link. This is their only round.</span>
        </Notice>
      ) : null}

      <SheetRow
        icon="document-text-outline"
        title="The brief"
        meta={
          p.brief
            ? `${GOAL[p.brief.goal] ?? p.brief.goal} · ${p.brief.keyMessages.length} key ${p.brief.keyMessages.length === 1 ? "message" : "messages"} · ${p.brief.shootContact.value}`
            : "No brief on this spot."
        }
        onClick={() => onOpen("brief")}
      />

      {p.delivery ? (
        <Card>
          <div className="flex items-center justify-between gap-2.5">
            <p className="text-[15px] font-strong text-white">Delivered {when(p.delivery.deliveredAt)}</p>
            {p.onTime === null ? null : <Tag label={p.onTime ? "On time" : "Late"} tone={p.onTime ? "good" : "caution"} />}
          </div>
          <a href={p.delivery.url} target="_blank" rel="noreferrer" className="break-all text-[13px] font-strong text-white/[0.62] hover:text-white">
            {p.delivery.url}
          </a>
          <Divider />
          <ChecklistSummary checklist={p.delivery.checklist} production={p} />
          <p className={meta}>
            {p.accepted
              ? p.accepted.auto
                ? "Accepted after 72 hours without an answer."
                : `Accepted by the brand ${when(p.accepted.at)}.`
              : p.autoAcceptAt
                ? `If the brand says nothing, it is accepted ${when(p.autoAcceptAt)}.`
                : ""}
            {p.onTime === null ? "" : p.onTime ? " Delivered on time." : " Delivered after the due time."}
          </p>
        </Card>
      ) : null}

      {canDeliver && owed ? (
        <button type="button" className={ctaPrimary} onClick={() => onOpen("deliver")}>
          {p.delivery ? "Deliver the revision" : "Deliver"}
        </button>
      ) : null}

      {notice ? <Notice>{notice}</Notice> : null}
    </div>
  );
}

function ChecklistSummary({ checklist, production }: { checklist: readonly ChecklistItem[]; production: ProductionView }) {
  const lines = production.package?.lines ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((l) => {
        const got = checklist.find((c) => c.key === l.key)?.count ?? 0;
        return (
          <KV
            key={l.key}
            k={PRODUCTION_DELIVERABLE_LABEL[l.key]}
            v={<span className={`tabular-nums ${got >= l.count ? P.good : P.caution}`}>{`${got} of ${l.count}`}</span>}
          />
        );
      })}
    </div>
  );
}

/* ── The brief ────────────────────────────────────────────────────── */

function BriefScreen({ production: p, onBack }: { production: ProductionView; onBack: () => void }) {
  const b = p.brief;
  return (
    <div className="flex flex-col gap-2.5">
      <Back onBack={onBack} title="The brief" />
      <p className={meta}>Private to you, your team and the brand.</p>
      {b ? (
        <Card>
          <Row label="Goal">{GOAL[b.goal] ?? b.goal}</Row>
          <Row label="Key messages">
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              {b.keyMessages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ol>
          </Row>
          {b.interviewees ? <Row label="Who to interview">{b.interviewees}</Row> : null}
          {b.assetsUrl ? (
            <Row label="Brand assets">
              <a href={b.assetsUrl} target="_blank" rel="noreferrer" className="break-all text-white/[0.62] hover:text-white">
                {b.assetsUrl}
              </a>
            </Row>
          ) : null}
          {b.dos ? <Row label="Do">{b.dos}</Row> : null}
          {b.donts ? <Row label="Don't">{b.donts}</Row> : null}
          <Row label="Shoot-day contact">
            {b.shootContact.value} on {b.shootContact.kind === "x" ? "X" : "Telegram"}
          </Row>
          {p.package ? (
            <Row label="Usage rights">
              {USAGE_SCOPE_LABEL[p.package.usage.scope]}, {USAGE_TERM_LABEL[p.package.usage.term].toLowerCase()}
            </Row>
          ) : null}
        </Card>
      ) : (
        <Card>
          <p className={meta}>No brief on this spot.</p>
        </Card>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-white/[0.08] pt-2.5 first:border-0 first:pt-0">
      <p className="text-[12.5px] font-strong text-white/[0.62]">{label}</p>
      <div className="whitespace-pre-line text-[14.5px] leading-5 text-white">{children}</div>
    </div>
  );
}

/* ── Deliver ──────────────────────────────────────────────────────── */

function DeliverScreen({
  positionId,
  production: p,
  onBack,
  onDelivered,
}: {
  positionId: string;
  production: ProductionView;
  onBack: () => void;
  onDelivered: (p: ProductionView) => void;
}) {
  const lines = p.package?.lines ?? [];
  const [url, setUrl] = useState(p.delivery?.url ?? "");
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.key, p.delivery?.checklist.find((c) => c.key === l.key)?.count ?? l.count])),
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2.5">
      <Back onBack={onBack} title={p.delivery ? "Deliver the revision" : "Deliver"} />
      <Card>
        <p className="text-[13.5px] leading-[19px] text-white/[0.62]">
          A private link the brand opens: a Drive, Frame.io or Dropbox folder. Only the brand, you and HOLD support see it.
        </p>
        <Field label="Link to the files" htmlFor={`deliver-${positionId}`}>
          <input
            id={`deliver-${positionId}`}
            type="url"
            className={inputCls}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
          />
        </Field>
      </Card>

      <SectionLabel>What is in it</SectionLabel>
      <Card>
        {lines.map((l, i) => {
          const n = counts[l.key] ?? 0;
          return (
            <div key={l.key} className="flex flex-col gap-2.5">
              {i > 0 ? <Divider /> : null}
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[14.5px] font-strong text-white">
                  {n >= l.count ? <Ion name="checkmark-circle" size={16} className="shrink-0 text-[#2FBE8A]" /> : null}
                  {PRODUCTION_DELIVERABLE_LABEL[l.key]}
                </span>
                <span className="flex items-center gap-2">
                  <StepButton label={`Fewer: ${l.label}`} disabled={n <= 0} onClick={() => setCounts({ ...counts, [l.key]: n - 1 })} icon="remove" />
                  <span className="w-14 text-center text-[14px] font-strong tabular-nums text-white">
                    {n} of {l.count}
                  </span>
                  <StepButton label={`More: ${l.label}`} disabled={n >= l.count} onClick={() => setCounts({ ...counts, [l.key]: n + 1 })} icon="add" />
                </span>
              </div>
            </div>
          );
        })}
      </Card>

      <p className={meta}>The brand then accepts it or asks for one revision. If they say nothing for 72 hours, it counts as accepted.</p>

      {notice ? <Notice>{notice}</Notice> : null}
      <button
        type="button"
        className={ctaPrimary}
        disabled={busy || !url.trim().startsWith("https://")}
        onClick={() => {
          setBusy(true);
          setNotice(null);
          const checklist = lines.map((l) => ({ key: l.key, count: counts[l.key] ?? 0 }));
          void deliverProduction(positionId, { url: url.trim(), checklist })
            .then(({ production }) => onDelivered(production))
            .catch((e) => setNotice(describeRunError(e)))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Sending…" : "Send to the brand"}
      </button>
    </div>
  );
}

function StepButton({ label, disabled, onClick, icon }: { label: string; disabled: boolean; onClick: () => void; icon: "add" | "remove" }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-[18px] bg-white/[0.08] text-white transition-colors hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Ion name={icon} size={18} />
    </button>
  );
}

/** A screen inside the spot: the app's header, a chevron back and the title. */
function Back({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onBack} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-[18px] text-white transition-colors hover:bg-white/10">
        <Ion name="chevron-back" size={22} />
      </button>
      <p className="truncate text-[18px] font-strong tracking-[-0.3px] text-white">{title}</p>
    </div>
  );
}

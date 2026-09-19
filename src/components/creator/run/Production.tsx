/**
 * One sold content production spot, for the creator or a seat that delivers it
 * (spaces-content-production-v0.md).
 *
 * Three screens, one at a time, each with its way back: the spot (countdown,
 * where it stands, what the brand said), the brand's brief, and the delivery
 * form (a private link and a checklist against the package). Nothing here is
 * ever on a public page: the link is for the brand.
 */

"use client";

import { useState } from "react";

import { demoParam } from "@/lib/creator/demo";

import { btnPrimary, btnSmallSecondary, card, pill } from "@/components/ad-space/ui";
import { IconArrowLeft } from "@/components/app/icons";
import { countdownText } from "@/components/app/spaces/common";
import {
  PRODUCTION_DELIVERABLE_LABEL,
  USAGE_SCOPE_LABEL,
  USAGE_TERM_LABEL,
  type ChecklistItem,
  type ProductionView,
} from "@/lib/creator/listing";
import { deliverProduction, setShootDay } from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Text } from "../listing/parts";

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

export function stateOf(p: ProductionView): { label: string; cls: string } {
  switch (p.state) {
    case "accepted":
      return { label: "Accepted", cls: pill.done };
    case "delivered":
      return { label: "With the brand", cls: pill.open };
    case "revision_requested":
      return { label: "Revision asked", cls: pill.attention };
    case "overdue":
      return { label: "Late", cls: pill.attention };
    default:
      return { label: "To deliver", cls: pill.attention };
  }
}

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
  // DEMO BRANCH: ?pane=brief|deliver opens the spot on that screen.
  const [screen, setScreen] = useState<Screen>(() => {
    const want = demoParam("pane");
    return want === "brief" || want === "deliver" ? want : "spot";
  });
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
    <div className={`${card} flex flex-col gap-5 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-tiny uppercase tracking-wider text-text-muted">Production spot</p>
          {p.state === "accepted" ? (
            <p className="mt-2 font-display text-h3 font-light text-text">Accepted</p>
          ) : p.state === "delivered" ? (
            <p className="mt-2 font-display text-h3 font-light text-text">With the brand</p>
          ) : (
            <p className={`mt-2 font-display text-h3 font-light tabular-nums ${p.state === "overdue" ? "text-amber" : "text-text"}`}>
              {countdownText(p.dueAt)}
            </p>
          )}
          <p className="mt-1 text-tiny text-text-muted">
            Due {when(p.dueAt)} · {p.package?.turnaroundHours ?? ""} h after the shoot day
          </p>
        </div>
        <span className={state.cls}>{state.label}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-[color:var(--color-hairline)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-small text-text">Shoot day · {day(p.shootOn)}</p>
          <p className="text-tiny text-text-muted">
            {p.shootOnSet ? "Set by you." : "The event's last day, until you pick one."} The event runs {day(p.event.startsOn)} to{" "}
            {day(p.event.endsOn)}.
          </p>
        </div>
        {canMoveShoot && !editingDay ? (
          <button type="button" className={btnSmallSecondary} onClick={() => setEditingDay(true)}>
            Change
          </button>
        ) : null}
      </div>
      {editingDay ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Text type="date" value={shootOn} onChange={setShootOn} />
          </div>
          <button
            type="button"
            className={btnSmallSecondary}
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
      ) : null}

      {p.state === "revision_requested" && p.revision ? (
        <div className="rounded-input border border-amber/40 bg-amber/10 px-4 py-3">
          <p className="text-tiny uppercase tracking-wider text-amber">The brand asked for one revision</p>
          <p className="mt-2 whitespace-pre-line text-small text-text">{p.revision.note}</p>
          <p className="mt-2 text-tiny text-text-muted">Deliver the new cut with a fresh link. This is their only round.</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onOpen("brief")}
        className="flex items-center justify-between gap-3 rounded-input border border-[color:var(--color-hairline-strong)] px-4 py-3 text-left transition-colors duration-180 hover:bg-white/5"
      >
        <span className="min-w-0">
          <span className="block text-small text-text">The brief</span>
          <span className="block truncate text-tiny text-text-muted">
            {p.brief
              ? `${GOAL[p.brief.goal] ?? p.brief.goal} · ${p.brief.keyMessages.length} key ${p.brief.keyMessages.length === 1 ? "message" : "messages"} · ${p.brief.shootContact.value}`
              : "No brief on this spot."}
          </span>
        </span>
        <span className="text-tiny text-[#9FB7C2]">Open</span>
      </button>

      {p.delivery ? (
        <div className="flex flex-col gap-2 rounded-input border border-[color:var(--color-hairline)] px-4 py-3">
          <p className="text-small text-text">Delivered {when(p.delivery.deliveredAt)}</p>
          <a href={p.delivery.url} target="_blank" rel="noreferrer" className="break-all text-tiny text-[#9FB7C2] hover:text-text">
            {p.delivery.url}
          </a>
          <ChecklistSummary checklist={p.delivery.checklist} production={p} />
          <p className="text-tiny text-text-muted">
            {p.accepted
              ? p.accepted.auto
                ? "Accepted after 72 hours without an answer."
                : `Accepted by the brand ${when(p.accepted.at)}.`
              : p.autoAcceptAt
                ? `If the brand says nothing, it is accepted ${when(p.autoAcceptAt)}.`
                : ""}
            {p.onTime === null ? "" : p.onTime ? " Delivered on time." : " Delivered after the due time."}
          </p>
        </div>
      ) : null}

      {canDeliver && owed ? (
        <button type="button" className={btnPrimary} onClick={() => onOpen("deliver")}>
          {p.delivery ? "Deliver the revision" : "Deliver"}
        </button>
      ) : null}

      {notice ? <Line>{notice}</Line> : null}
    </div>
  );
}

function ChecklistSummary({ checklist, production }: { checklist: readonly ChecklistItem[]; production: ProductionView }) {
  const lines = production.package?.lines ?? [];
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((l) => {
        const got = checklist.find((c) => c.key === l.key)?.count ?? 0;
        return (
          <li key={l.key} className="flex items-center justify-between gap-3 text-tiny">
            <span className="text-text-muted">{PRODUCTION_DELIVERABLE_LABEL[l.key]}</span>
            <span className={`tabular-nums ${got >= l.count ? "text-success" : "text-amber"}`}>
              {got} of {l.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── The brief ────────────────────────────────────────────────────── */

function BriefScreen({ production: p, onBack }: { production: ProductionView; onBack: () => void }) {
  const b = p.brief;
  return (
    <div className={`${card} flex flex-col gap-5 p-5`}>
      <Back onBack={onBack} />
      <div>
        <p className="text-tiny uppercase tracking-wider text-text-muted">The brief</p>
        <p className="mt-2 text-tiny text-text-muted">Private to you, your team and the brand.</p>
      </div>
      {b ? (
        <dl className="flex flex-col gap-4">
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
              <a href={b.assetsUrl} target="_blank" rel="noreferrer" className="break-all text-[#9FB7C2] hover:text-text">
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
        </dl>
      ) : (
        <p className="text-small text-text-muted">No brief on this spot.</p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-[color:var(--color-hairline)] pt-3 first:border-0 first:pt-0">
      <dt className="text-tiny text-text-muted">{label}</dt>
      <dd className="whitespace-pre-line text-small text-text">{children}</dd>
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
    <div className={`${card} flex flex-col gap-5 p-5`}>
      <Back onBack={onBack} />
      <div>
        <p className="text-tiny uppercase tracking-wider text-text-muted">{p.delivery ? "Deliver the revision" : "Deliver"}</p>
        <p className="mt-2 text-small text-text-muted">
          A private link the brand opens: a Drive, Frame.io or Dropbox folder. Only the brand, you and HOLD support see it.
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-small text-text">Link to the files</span>
        <Text type="url" value={url} onChange={setUrl} placeholder="https://drive.google.com/…" />
      </label>

      <div className="flex flex-col gap-2">
        <p className="text-small text-text">What is in it</p>
        <ul className="flex flex-col gap-2">
          {lines.map((l) => {
            const n = counts[l.key] ?? 0;
            return (
              <li
                key={l.key}
                className={`flex items-center justify-between gap-3 rounded-input border px-4 py-2 transition-colors duration-180 ${
                  n >= l.count ? "border-success/40 bg-success/10" : "border-[color:var(--color-hairline-strong)]"
                }`}
              >
                <span className="min-w-0 text-small text-text">{PRODUCTION_DELIVERABLE_LABEL[l.key]}</span>
                <span className="flex items-center gap-2">
                  <StepButton label={`Fewer: ${l.label}`} disabled={n <= 0} onClick={() => setCounts({ ...counts, [l.key]: n - 1 })}>
                    −
                  </StepButton>
                  <span className="w-14 text-center text-small tabular-nums text-text">
                    {n} of {l.count}
                  </span>
                  <StepButton label={`More: ${l.label}`} disabled={n >= l.count} onClick={() => setCounts({ ...counts, [l.key]: n + 1 })}>
                    +
                  </StepButton>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-tiny text-text-muted">
        The brand then accepts it or asks for one revision. If they say nothing for 72 hours, it counts as accepted.
      </p>

      <button
        type="button"
        className={btnPrimary}
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
      {notice ? <Line>{notice}</Line> : null}
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-[16px] border border-[color:var(--color-hairline-strong)] text-small text-text transition-colors duration-180 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Back({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-1.5 text-tiny text-[#9FB7C2] hover:text-text">
      <IconArrowLeft className="h-3.5 w-3.5" />
      Back
    </button>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
      {children}
    </p>
  );
}

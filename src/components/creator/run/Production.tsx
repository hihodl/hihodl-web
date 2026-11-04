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
import { tMaybe, t as tl } from "@/lib/app/i18n";
import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
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

/** The brand's goal, in words; a goal this screen does not know reads as the server sent it. */
function goalText(goal: string): string {
  return tMaybe(`runner.production.goal.${goal}`, goal);
}

/** A package line's name (lib/creator/listing's label, in the person's language). */
function deliverableText(key: keyof typeof PRODUCTION_DELIVERABLE_LABEL): string {
  return tMaybe(`runner.production.deliverable.${key}`, PRODUCTION_DELIVERABLE_LABEL[key]);
}

/** "Fri, 10 Oct, 02:00" in the reader's own clock and language. */
function when(iso: string): string {
  return fmtDate(iso, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function day(date: string): string {
  return fmtDate(new Date(`${date}T12:00:00Z`), { weekday: "short", day: "numeric", month: "short" });
}

export function stateOf(p: ProductionView): { label: string; tone: "calm" | "good" | "caution" } {
  switch (p.state) {
    case "accepted":
      return { label: tl("runner.production.state.accepted"), tone: "good" };
    case "delivered":
      return { label: tl("runner.production.state.delivered"), tone: "calm" };
    case "revision_requested":
      return { label: tl("runner.production.state.revision"), tone: "caution" };
    case "overdue":
      return { label: tl("runner.production.state.late"), tone: "caution" };
    default:
      return { label: tl("runner.production.state.toDeliver"), tone: "caution" };
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
  const t = useT();
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
          <p className="text-[12px] font-strong uppercase tracking-[0.4px] text-white/55">{t("runner.production.spot")}</p>
          <Tag label={state.label} tone={state.tone} />
        </div>
        <p className={`text-[28px] font-extrabold tracking-[-0.6px] tabular-nums ${p.state === "overdue" ? "text-amber" : "text-white"}`}>
          {p.state === "accepted"
            ? t("runner.production.state.accepted")
            : p.state === "delivered"
              ? t("runner.production.state.delivered")
              : countdownText(p.dueAt)}
        </p>
        <p className={meta}>
          {t("runner.production.due", { when: when(p.dueAt), hours: p.package?.turnaroundHours ?? "" })}
        </p>
        <Divider />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-[14px] font-strong text-white">{t("runner.production.shootDay", { day: day(p.shootOn) })}</p>
            <p className={meta}>
              {t(p.shootOnSet ? "runner.production.shootNoteSet" : "runner.production.shootNoteDefault", {
                start: day(p.event.startsOn),
                end: day(p.event.endsOn),
              })}
            </p>
          </div>
          {canMoveShoot && !editingDay ? (
            <button
              type="button"
              onClick={() => setEditingDay(true)}
              className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[17px] border border-white/[0.14] bg-white/[0.06] px-[13px] text-[13.5px] font-bold text-white/[0.62] hover:bg-white/10"
            >
              <Ion name="calendar-outline" size={14} />
              {t("runner.production.change")}
            </button>
          ) : null}
        </div>
        {editingDay ? (
          <div className="flex flex-col gap-2.5">
            <Field label={t("runner.production.day")} htmlFor={`shoot-${positionId}`}>
              <input id={`shoot-${positionId}`} type="date" className={inputCls} value={shootOn} onChange={(e) => setShootOn(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={() => setEditingDay(false)}>
                {t("common.cancel")}
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
                {busy ? t("common.saving") : t("runner.production.saveDay")}
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      {p.state === "revision_requested" && p.revision ? (
        <Notice icon="alert-circle-outline">
          <span className="block">{t("runner.production.revisionAsked")}</span>
          <span className="mt-1 block whitespace-pre-line font-normal text-white">{p.revision.note}</span>
          <span className="mt-1 block font-normal text-white/[0.62]">{t("runner.production.revisionHint")}</span>
        </Notice>
      ) : null}

      <SheetRow
        icon="document-text-outline"
        title={t("runner.production.brief")}
        meta={
          p.brief
            ? t("runner.production.briefMeta", {
                goal: goalText(p.brief.goal),
                count: p.brief.keyMessages.length,
                contact: p.brief.shootContact.value,
              })
            : t("runner.production.noBrief")
        }
        onClick={() => onOpen("brief")}
      />

      {p.delivery ? (
        <Card>
          <div className="flex items-center justify-between gap-2.5">
            <p className="text-[15px] font-strong text-white">{t("runner.production.delivered", { when: when(p.delivery.deliveredAt) })}</p>
            {p.onTime === null ? null : <Tag label={p.onTime ? t("runner.production.onTime") : t("runner.production.state.late")} tone={p.onTime ? "good" : "caution"} />}
          </div>
          <a href={p.delivery.url} target="_blank" rel="noreferrer" className="break-all text-[13px] font-strong text-white/[0.62] hover:text-white">
            {p.delivery.url}
          </a>
          <Divider />
          <ChecklistSummary checklist={p.delivery.checklist} production={p} />
          <p className={meta}>
            {[
              p.accepted
                ? p.accepted.auto
                  ? t("runner.production.autoAccepted")
                  : t("runner.production.acceptedBy", { when: when(p.accepted.at) })
                : p.autoAcceptAt
                  ? t("runner.production.autoAcceptAt", { when: when(p.autoAcceptAt) })
                  : "",
              p.onTime === null ? "" : p.onTime ? t("runner.production.deliveredOnTime") : t("runner.production.deliveredLate"),
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
        </Card>
      ) : null}

      {canDeliver && owed ? (
        <button type="button" className={ctaPrimary} onClick={() => onOpen("deliver")}>
          {p.delivery ? t("runner.production.deliverRevision") : t("runner.production.deliver")}
        </button>
      ) : null}

      {notice ? <Notice>{notice}</Notice> : null}
    </div>
  );
}

function ChecklistSummary({ checklist, production }: { checklist: readonly ChecklistItem[]; production: ProductionView }) {
  const t = useT();
  const lines = production.package?.lines ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((l) => {
        const got = checklist.find((c) => c.key === l.key)?.count ?? 0;
        return (
          <KV
            key={l.key}
            k={deliverableText(l.key)}
            v={<span className={`tabular-nums ${got >= l.count ? P.good : P.caution}`}>{t("runner.xOfY", { n: got, total: l.count })}</span>}
          />
        );
      })}
    </div>
  );
}

/* ── The brief ────────────────────────────────────────────────────── */

function BriefScreen({ production: p, onBack }: { production: ProductionView; onBack: () => void }) {
  const t = useT();
  const b = p.brief;
  return (
    <div className="flex flex-col gap-2.5">
      <Back onBack={onBack} title={t("runner.production.brief")} />
      <p className={meta}>{t("runner.production.private")}</p>
      {b ? (
        <Card>
          <Row label={t("runner.production.row.goal")}>{goalText(b.goal)}</Row>
          <Row label={t("runner.production.row.keyMessages")}>
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              {b.keyMessages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ol>
          </Row>
          {b.interviewees ? <Row label={t("runner.production.row.interviewees")}>{b.interviewees}</Row> : null}
          {b.assetsUrl ? (
            <Row label={t("runner.production.row.assets")}>
              <a href={b.assetsUrl} target="_blank" rel="noreferrer" className="break-all text-white/[0.62] hover:text-white">
                {b.assetsUrl}
              </a>
            </Row>
          ) : null}
          {b.dos ? <Row label={t("runner.production.row.dos")}>{b.dos}</Row> : null}
          {b.donts ? <Row label={t("runner.production.row.donts")}>{b.donts}</Row> : null}
          <Row label={t("runner.production.row.contact")}>
            {t("runner.production.contactOn", { value: b.shootContact.value, network: b.shootContact.kind === "x" ? "X" : "Telegram" })}
          </Row>
          {p.package ? (
            <Row label={t("runner.production.row.usage")}>
              {t("runner.production.usage", {
                scope: tMaybe(`runner.production.scope.${p.package.usage.scope}`, USAGE_SCOPE_LABEL[p.package.usage.scope]),
                term: tMaybe(`runner.production.term.${p.package.usage.term}`, USAGE_TERM_LABEL[p.package.usage.term].toLowerCase()),
              })}
            </Row>
          ) : null}
        </Card>
      ) : (
        <Card>
          <p className={meta}>{t("runner.production.noBrief")}</p>
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
  const t = useT();
  const lines = p.package?.lines ?? [];
  const [url, setUrl] = useState(p.delivery?.url ?? "");
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.key, p.delivery?.checklist.find((c) => c.key === l.key)?.count ?? l.count])),
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2.5">
      <Back onBack={onBack} title={p.delivery ? t("runner.production.deliverRevision") : t("runner.production.deliver")} />
      <Card>
        <p className="text-[13.5px] leading-[19px] text-white/[0.62]">
          {t("runner.production.deliverIntro")}
        </p>
        <Field label={t("runner.production.linkLabel")} htmlFor={`deliver-${positionId}`}>
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

      <SectionLabel>{t("runner.production.whatsIn")}</SectionLabel>
      <Card>
        {lines.map((l, i) => {
          const n = counts[l.key] ?? 0;
          return (
            <div key={l.key} className="flex flex-col gap-2.5">
              {i > 0 ? <Divider /> : null}
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[14.5px] font-bold text-white">
                  {n >= l.count ? <Ion name="checkmark-circle" size={16} className="shrink-0 text-[#2FBE8A]" /> : null}
                  {deliverableText(l.key)}
                </span>
                <span className="flex items-center gap-2">
                  <StepButton label={t("runner.production.fewer", { label: l.label })} disabled={n <= 0} onClick={() => setCounts({ ...counts, [l.key]: n - 1 })} icon="remove" />
                  <span className="w-14 text-center text-[14px] font-strong tabular-nums text-white">
                    {t("runner.xOfY", { n, total: l.count })}
                  </span>
                  <StepButton label={t("runner.production.more", { label: l.label })} disabled={n >= l.count} onClick={() => setCounts({ ...counts, [l.key]: n + 1 })} icon="add" />
                </span>
              </div>
            </div>
          );
        })}
      </Card>

      <p className={meta}>{t("runner.production.deliverNote")}</p>

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
        {busy ? t("runner.sending") : t("runner.production.send")}
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
  const t = useT();
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onBack} aria-label={t("common.back")} className="flex h-9 w-9 items-center justify-center rounded-[18px] text-white transition-colors hover:bg-white/10">
        <Ion name="chevron-back" size={22} />
      </button>
      <p className="truncate text-[18px] font-extrabold tracking-[-0.3px] text-white">{title}</p>
    </div>
  );
}

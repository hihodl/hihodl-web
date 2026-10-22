"use client";

/**
 * Every link that brings travellers in: the partner's own, each member's,
 * and campaign links (one for Instagram, one for a flyer, one for an event),
 * with what each brought. Archiving hides a link from the list; it keeps
 * counting, because a printed QR never dies.
 *
 * A link can have limits: how many people it may bring (a use is one signup)
 * and the days it can be entered. The owner can also set what it gives back:
 * part of the partner's share taken off its travellers' price at checkout.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";

import { QrCode } from "@/components/ad-space/qr";
import {
  bpsOfPct,
  createLink,
  dayLabel,
  linkFromDay,
  linkUntilDay,
  MAX_LINK_USES,
  normaliseSlug,
  partnerErrorText,
  pct,
  pctInput,
  updateLink,
  usd,
  useLinks,
  useTeam,
  type LinkLimits,
  type LinkState,
  type PartnerLink,
  type Scope,
} from "@/lib/app/partners";

import { CopyButton } from "../front/kit";
import { Ion } from "../ion";
import { ReadFailed } from "../money/kit";
import { Alert, Skeleton } from "../ui";
import { amberBtn, DataTable, DeskPanel, filterCls, Muted, smallBtn, type Column } from "./desk";
import { CheckBox, Field, inputCls, Pill, QrDownloads, SlugLine, slugReady, useSlugCheck, type PillTone } from "./kit";

const STATE: Record<LinkState, { label: string; tone: PillTone }> = {
  open: { label: "Open", tone: "blue" },
  not_started: { label: "Not started", tone: "quiet" },
  ended: { label: "Ended", tone: "quiet" },
  full: { label: "Full", tone: "quiet" },
};

function hasLimits(l: PartnerLink): boolean {
  return l.maxUses != null || !!l.validFrom || !!l.validUntil;
}

/** "1 Nov 2026 to 30 Nov 2026", "From 1 Nov 2026", "Until 30 Nov 2026", or null when it is always open. */
function openDays(l: Pick<PartnerLink, "validFrom" | "validUntil">): string | null {
  const from = linkFromDay(l.validFrom);
  const until = linkUntilDay(l.validUntil);
  if (from && until) return `${dayLabel(from)} to ${dayLabel(until)}`;
  if (from) return `From ${dayLabel(from)}`;
  if (until) return `Until ${dayLabel(until)}`;
  return null;
}

export function LinksSection({
  scope,
  canManageAny,
  active,
  owner,
  partnerGiveBackBps,
}: {
  scope: Scope;
  canManageAny: boolean;
  active: boolean;
  /** Only the owner sets what a link gives back: it changes what the partner is paid. */
  owner: boolean;
  /** The partner's own give back, which a link follows unless it has its own. */
  partnerGiveBackBps: number;
}) {
  const links = useLinks(true, scope);
  const [making, setMaking] = useState(false);
  const [editing, setEditing] = useState<PartnerLink | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [qrFor, setQrFor] = useState<PartnerLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = (links.data ?? []).filter((l) => showArchived || !l.archived);
  const archived = (links.data ?? []).filter((l) => l.archived).length;
  // The Given back column shows once the partner gives back or any link has.
  const givesBack = partnerGiveBackBps > 0 || (links.data ?? []).some((l) => (l.givenBackUsdc ?? 0) > 0 || (l.giveBackBps ?? 0) > 0);

  async function archive(l: PartnerLink, on: boolean) {
    if (!l.id) return;
    setError(null);
    try {
      await updateLink(l.id, { archived: on });
      void links.mutate();
    } catch (e) {
      setError(partnerErrorText(e));
    }
  }

  const columns: Column<PartnerLink>[] = [
    {
      key: "code",
      title: "Link",
      render: (l) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate font-mono text-[13px] font-bold text-white">{l.url.replace(/^https?:\/\//, "")}</span>
            {l.main ? <Pill tone="amber">Main</Pill> : null}
            {l.archived ? <Pill tone="quiet">Archived</Pill> : null}
            {l.state && !l.archived && (l.state !== "open" || hasLimits(l)) ? <Pill tone={STATE[l.state].tone}>{STATE[l.state].label}</Pill> : null}
          </span>
          {l.label ? <span className="truncate text-[12px] text-white/45">{l.label}</span> : null}
        </span>
      ),
    },
    { key: "member", title: "Belongs to", hideBelow: "lg", render: (l) => (l.mine ? "You" : l.memberName ?? <Muted>Partner</Muted>) },
    { key: "visits", title: "Visits", align: "right", hideBelow: "md", render: (l) => l.visits.toLocaleString("en-US") },
    {
      key: "signups",
      title: "Signups",
      align: "right",
      render: (l) =>
        l.maxUses != null ? (
          <span className="whitespace-nowrap">
            {l.signups.toLocaleString("en-US")} <span className="text-white/50">of {l.maxUses.toLocaleString("en-US")}</span>
          </span>
        ) : (
          l.signups.toLocaleString("en-US")
        ),
    },
    { key: "open", title: "Open", hideBelow: "xl", render: (l) => <span className="whitespace-nowrap">{openDays(l) ?? <Muted>Always</Muted>}</span> },
    { key: "bookings", title: "Bookings", align: "right", hideBelow: "sm", render: (l) => l.bookings.toLocaleString("en-US") },
    { key: "commission", title: "Commission", align: "right", render: (l) => <span className="font-extrabold text-white">{usd(l.commissionUsdc)}</span> },
    ...(givesBack
      ? [
          {
            key: "givenBack",
            title: "Given back",
            align: "right",
            hideBelow: "md",
            render: (l) => (
              <span className="inline-flex flex-col items-end">
                <span className="whitespace-nowrap font-bold text-white">{usd(l.givenBackUsdc ?? 0)}</span>
                <span className="whitespace-nowrap text-[11.5px] text-white/45">{pct(l.giveBackBps ?? 0)} of the share</span>
              </span>
            ),
          } satisfies Column<PartnerLink>,
        ]
      : []),
    {
      key: "actions",
      title: "",
      align: "right",
      render: (l) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          <CopyButton value={l.url} className={smallBtn} />
          <button type="button" className={smallBtn} onClick={() => setQrFor(l)} aria-label={`QR code for ${l.code}`}>
            <Ion name="qr-code-outline" size={15} />
          </button>
          {l.id && (l.mine || canManageAny) ? (
            <button type="button" className={smallBtn} onClick={() => setEditing(l)} aria-label={`Edit ${l.code}`} title="Edit">
              <Ion name="create-outline" size={15} />
            </button>
          ) : null}
          {l.id && (l.mine || canManageAny) ? (
            <button type="button" className={smallBtn} onClick={() => void archive(l, !l.archived)} aria-label={l.archived ? "Bring back" : "Archive"} title={l.archived ? "Bring back" : "Archive"}>
              <Ion name={l.archived ? "arrow-undo-outline" : "archive-outline"} size={15} />
            </button>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {making ? (
        <NewLink
          canPickMember={canManageAny && scope === "team"}
          owner={owner}
          partnerGiveBackBps={partnerGiveBackBps}
          onDone={(made) => {
            setMaking(false);
            if (made) void links.mutate();
          }}
        />
      ) : null}
      {editing ? (
        <EditLink
          key={editing.id ?? editing.code}
          link={editing}
          owner={owner}
          partnerGiveBackBps={partnerGiveBackBps}
          onDone={(saved) => {
            setEditing(null);
            if (saved) void links.mutate();
          }}
        />
      ) : null}
      {qrFor ? (
        <DeskPanel title={qrFor.url.replace(/^https?:\/\//, "")} actions={<button type="button" className={smallBtn} onClick={() => setQrFor(null)}>Close</button>}>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="w-[168px] overflow-hidden rounded-[16px] bg-white p-1.5">
              <QrCode text={qrFor.url} title={`QR code for ${qrFor.url}`} className="block h-auto w-full" />
            </div>
            <QrDownloads text={qrFor.url} name={`hold-${qrFor.code}-qr`} />
          </div>
        </DeskPanel>
      ) : null}
      <DeskPanel
        flush
        title="Links"
        meta="Visits count opens of the invite page. Someone who already has HOLD opens the app straight away, so visits read low."
        actions={
          <>
            {archived ? (
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-white/70">
                <CheckBox small checked={showArchived} onChange={setShowArchived} />
                Show archived ({archived})
              </label>
            ) : null}
            {active && !making ? (
              <button type="button" className={smallBtn} onClick={() => setMaking(true)}>
                <Ion name="add" size={16} />
                New link
              </button>
            ) : null}
          </>
        }
      >
        {error ? (
          <div className="px-4 pb-3 sm:px-5">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        {links.error && !links.data ? (
          <ReadFailed compact title="Could not load your links" onRetry={() => void links.mutate()} />
        ) : !links.data ? (
          <div className="flex flex-col gap-2 px-4 pb-4 sm:px-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(l) => l.id ?? `main-${l.code}`} empty="No links yet." />
        )}
      </DeskPanel>
    </div>
  );
}

function NewLink({
  canPickMember,
  owner,
  partnerGiveBackBps,
  onDone,
}: {
  canPickMember: boolean;
  owner: boolean;
  partnerGiveBackBps: number;
  onDone: (made: boolean) => void;
}) {
  const [raw, setRaw] = useState("");
  const [label, setLabel] = useState("");
  const [memberId, setMemberId] = useState("");
  const [limits, setLimits] = useState<LimitsDraft>(EMPTY_LIMITS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useSlugCheck(raw);
  const team = useTeam(canPickMember);
  const ready = slugReady(check, raw) && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const out = limitsOf(limits, owner, false);
    if ("error" in out) {
      setError(out.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createLink({ code: normaliseSlug(raw), ...(label.trim() ? { label: label.trim() } : {}), ...(memberId ? { memberId } : {}), ...out.body });
      onDone(true);
    } catch (err) {
      setError(partnerErrorText(err));
      setBusy(false);
    }
  }

  return (
    <DeskPanel title="New link">
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2" noValidate>
        <Field label="Link name">
          <input className={inputCls} value={raw} onChange={(e) => setRaw(e.target.value)} maxLength={40} placeholder="Link name" autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          <SlugLine raw={raw} check={check} />
        </Field>
        <Field label="What it is for (optional)" hint="Only your team sees this.">
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Instagram bio" />
        </Field>
        {canPickMember && team.data?.length ? (
          <Field label="Belongs to" hint="Travellers who come through it count for this person.">
            <select className={`${filterCls} h-12 w-full rounded-[14px]`} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Me</option>
              {team.data
                .filter((m) => m.status === "active" && !m.isMe)
                .map((m) => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
        ) : null}
        <LimitsFields draft={limits} onChange={setLimits} owner={owner} partnerGiveBackBps={partnerGiveBackBps} />
        {error ? (
          <div className="md:col-span-2">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <div className="flex gap-2 md:col-span-2">
          <button type="submit" className={amberBtn} disabled={!ready}>
            {busy ? "Making the link" : "Make the link"}
          </button>
          <button type="button" className={smallBtn} onClick={() => onDone(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </DeskPanel>
  );
}

/* ── Edit a link: its label, limits and give back ─────────────────── */

function EditLink({ link, owner, partnerGiveBackBps, onDone }: { link: PartnerLink; owner: boolean; partnerGiveBackBps: number; onDone: (saved: boolean) => void }) {
  const [label, setLabel] = useState(link.label ?? "");
  const [limits, setLimits] = useState<LimitsDraft>(() => draftOf(link));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  // The panel opens above the table: bring it into view from a row far down.
  useEffect(() => {
    top.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!link.id || busy) return;
    const out = limitsOf(limits, owner, true);
    if ("error" in out) {
      setError(out.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateLink(link.id, { label: label.trim() || null, ...out.body });
      onDone(true);
    } catch (err) {
      setError(partnerErrorText(err));
      setBusy(false);
    }
  }

  return (
    <div ref={top} className="scroll-mt-4">
      <DeskPanel title={`Edit ${link.url.replace(/^https?:\/\//, "")}`}>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2" noValidate>
          <Field label="What it is for (optional)" hint="Only your team sees this.">
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Instagram bio" autoFocus />
          </Field>
          <div className="hidden md:block" />
          <LimitsFields draft={limits} onChange={setLimits} owner={owner} partnerGiveBackBps={partnerGiveBackBps} />
          <p className="text-[12.5px] leading-[18px] text-white/55 md:col-span-2">
            People already linked stay linked and keep what the link gave them. A lower limit or an earlier end only stops new people.
          </p>
          {error ? (
            <div className="md:col-span-2">
              <Alert>{error}</Alert>
            </div>
          ) : null}
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className={amberBtn} disabled={busy}>
              {busy ? "Saving" : "Save"}
            </button>
            <button type="button" className={smallBtn} onClick={() => onDone(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      </DeskPanel>
    </div>
  );
}

/* ── Limits and give back, shared by New link and Edit ────────────── */

interface LimitsDraft {
  maxUses: string;
  from: string;
  until: string;
  /** true = the link gives back what the partner does. */
  follow: boolean;
  pct: string;
}

const EMPTY_LIMITS: LimitsDraft = { maxUses: "", from: "", until: "", follow: true, pct: "" };

function draftOf(l: PartnerLink): LimitsDraft {
  return {
    maxUses: l.maxUses != null ? String(l.maxUses) : "",
    from: linkFromDay(l.validFrom),
    until: linkUntilDay(l.validUntil),
    follow: !l.ownGiveBack,
    pct: l.ownGiveBack ? pctInput(l.giveBackBps) : "",
  };
}

/**
 * What the form sends, checked the way the server checks it. A create sends
 * only what was filled; an edit sends every limit, so emptying one clears it.
 * Give back goes only from the owner (anyone else is refused).
 */
function limitsOf(d: LimitsDraft, owner: boolean, edit: boolean): { body: LinkLimits } | { error: string } {
  const body: LinkLimits = {};
  const max = d.maxUses.trim();
  if (max) {
    const n = Number(max);
    if (!/^\d+$/.test(max) || n < 1 || n > MAX_LINK_USES) return { error: partnerErrorText({ code: "max_uses_invalid" }) };
    body.maxUses = n;
  } else if (edit) body.maxUses = null;
  if (d.from) body.validFrom = d.from;
  else if (edit) body.validFrom = null;
  if (d.until) body.validUntil = d.until;
  else if (edit) body.validUntil = null;
  if (d.from && d.until && d.from > d.until) return { error: partnerErrorText({ code: "dates_out_of_order" }) };
  if (owner) {
    if (d.follow) {
      if (edit) body.giveBackBps = null;
    } else {
      const bps = bpsOfPct(d.pct);
      if (bps == null) return { error: partnerErrorText({ code: "give_back_invalid" }) };
      body.giveBackBps = bps;
    }
  }
  return { body };
}

function LimitsFields({
  draft,
  onChange,
  owner,
  partnerGiveBackBps,
}: {
  draft: LimitsDraft;
  onChange: (d: LimitsDraft) => void;
  owner: boolean;
  partnerGiveBackBps: number;
}) {
  const set = <K extends keyof LimitsDraft>(k: K, v: LimitsDraft[K]) => onChange({ ...draft, [k]: v });
  return (
    <>
      <Field label="Max people (optional)" hint="How many people can sign up through it. Empty means no limit.">
        <input
          className={inputCls}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_LINK_USES}
          step={1}
          value={draft.maxUses}
          onChange={(e) => set("maxUses", e.target.value)}
          placeholder="No limit"
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Open from (optional)">
          <input className={`${inputCls} [color-scheme:dark]`} type="date" value={draft.from} max={draft.until || undefined} onChange={(e) => set("from", e.target.value)} />
        </Field>
        <Field label="Open until (optional)" hint="The last day it works.">
          <input className={`${inputCls} [color-scheme:dark]`} type="date" value={draft.until} min={draft.from || undefined} onChange={(e) => set("until", e.target.value)} />
        </Field>
      </div>
      {owner ? (
        <GiveBackField
          follow={draft.follow}
          pct={draft.pct}
          partnerGiveBackBps={partnerGiveBackBps}
          onChange={(follow, value) => onChange({ ...draft, follow, pct: value })}
        />
      ) : null}
    </>
  );
}

function GiveBackField({
  follow,
  pct: value,
  partnerGiveBackBps,
  onChange,
}: {
  follow: boolean;
  pct: string;
  partnerGiveBackBps: number;
  onChange: (follow: boolean, pct: string) => void;
}) {
  return (
    <Field label="Give back to travellers" hint="A part of your share taken off the price these travellers pay at checkout. It is not paid to you.">
      <span className="flex flex-col gap-2 sm:flex-row">
        <select
          className={`${filterCls} h-12 w-full rounded-[14px] sm:flex-1`}
          value={follow ? "follow" : "own"}
          onChange={(e) => onChange(e.target.value === "follow", e.target.value === "follow" ? "" : value || pctInput(partnerGiveBackBps))}
        >
          <option value="follow">Same as the partner ({pct(partnerGiveBackBps)})</option>
          <option value="own">Its own</option>
        </select>
        {follow ? null : (
          <span className="relative block sm:w-[140px]">
            <input
              className={`${inputCls} pr-9`}
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => onChange(false, e.target.value)}
              placeholder="0"
              aria-label="Percentage of your share given back"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-white/55">%</span>
          </span>
        )}
      </span>
    </Field>
  );
}

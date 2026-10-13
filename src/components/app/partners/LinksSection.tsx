"use client";

/**
 * Every link that brings travellers in: the partner's own, each member's,
 * and campaign links (one for Instagram, one for a flyer, one for an event),
 * with what each brought. Archiving hides a link from the list; it keeps
 * counting, because a printed QR never dies.
 */

import { useState, type FormEvent } from "react";

import { QrCode } from "@/components/ad-space/qr";
import { createLink, normaliseSlug, partnerErrorText, updateLink, usd, useLinks, useTeam, type PartnerLink, type Scope } from "@/lib/app/partners";

import { CopyButton } from "../front/kit";
import { Ion } from "../ion";
import { ReadFailed } from "../money/kit";
import { Alert, Skeleton } from "../ui";
import { amberBtn, DataTable, DeskPanel, filterCls, Muted, smallBtn, type Column } from "./desk";
import { Field, inputCls, Pill, QrDownloads, SlugLine, slugReady, useSlugCheck } from "./kit";

export function LinksSection({ scope, canManageAny, active }: { scope: Scope; canManageAny: boolean; active: boolean }) {
  const links = useLinks(true, scope);
  const [making, setMaking] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [qrFor, setQrFor] = useState<PartnerLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = (links.data ?? []).filter((l) => showArchived || !l.archived);
  const archived = (links.data ?? []).filter((l) => l.archived).length;

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
          </span>
          {l.label ? <span className="truncate text-[12px] text-white/45">{l.label}</span> : null}
        </span>
      ),
    },
    { key: "member", title: "Belongs to", hideBelow: "lg", render: (l) => (l.mine ? "You" : l.memberName ?? <Muted>Partner</Muted>) },
    { key: "visits", title: "Visits", align: "right", hideBelow: "md", render: (l) => l.visits.toLocaleString("en-US") },
    { key: "signups", title: "Signups", align: "right", render: (l) => l.signups.toLocaleString("en-US") },
    { key: "bookings", title: "Bookings", align: "right", hideBelow: "sm", render: (l) => l.bookings.toLocaleString("en-US") },
    { key: "commission", title: "Commission", align: "right", render: (l) => <span className="font-extrabold text-white">{usd(l.commissionUsdc)}</span> },
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
          onDone={(made) => {
            setMaking(false);
            if (made) void links.mutate();
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
              <label className="inline-flex items-center gap-2 text-[13px] text-white/70">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-amber" />
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

function NewLink({ canPickMember, onDone }: { canPickMember: boolean; onDone: (made: boolean) => void }) {
  const [raw, setRaw] = useState("");
  const [label, setLabel] = useState("");
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useSlugCheck(raw);
  const team = useTeam(canPickMember);
  const ready = slugReady(check, raw) && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await createLink({ code: normaliseSlug(raw), ...(label.trim() ? { label: label.trim() } : {}), ...(memberId ? { memberId } : {}) });
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
          <input className={inputCls} value={raw} onChange={(e) => setRaw(e.target.value)} maxLength={40} placeholder="dreamlifeinsta" autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} />
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

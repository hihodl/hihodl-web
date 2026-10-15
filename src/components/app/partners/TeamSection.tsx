"use client";

/**
 * The team behind a partner. Every person signs in with their own HOLD
 * account and wallet; nobody shares a login. The owner runs everything and
 * decides how the team is paid:
 *
 *   owner   every commission goes to the owner, who settles with the team
 *   split   the member who brought a traveller is paid their split of each
 *           commission straight into their own HOLD Savings
 *
 * Admins invite and remove members and see the whole team. Members see what
 * they brought. Invites are a link: the person opens it, signs in with Apple,
 * Google or email, and joins with their own link ready.
 */

import { useState, type FormEvent } from "react";

import {
  createInvite,
  partnerErrorText,
  pct,
  removeMember,
  revokeInvite,
  setPayoutMode,
  transferOwner,
  updateMember,
  usd,
  useInvites,
  useTeam,
  type Invite,
  type Me,
  type Partner,
  type TeamMember,
} from "@/lib/app/partners";

import { CopyButton } from "../front/kit";
import { Notice } from "../hold";

import { Ion } from "../ion";
import { ReadFailed } from "../money/kit";
import { Alert, Skeleton } from "../ui";
import { amberBtn, DataTable, DeskPanel, filterCls, Muted, smallBtn, type Column } from "./desk";
import { ChoicePills, Field, inputCls, Pill, type PillTone } from "./kit";

const ROLE: Record<TeamMember["role"], { label: string; tone: PillTone }> = {
  owner: { label: "Owner", tone: "amber" },
  admin: { label: "Admin", tone: "blue" },
  member: { label: "Member", tone: "quiet" },
};

const BILLING: Record<TeamMember["billing"], { label: string; tone: PillTone }> = {
  verified: { label: "Ready to be paid", tone: "green" },
  submitted: { label: "Details in review", tone: "blue" },
  missing: { label: "No billing details", tone: "quiet" },
};

export function TeamSection({ partner, me, onChanged }: { partner: Partner; me: Me; onChanged: () => void }) {
  const owner = me.role === "owner";
  const team = useTeam(true);
  const invites = useInvites(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const split = partner.payoutMode === "split";

  async function act(fn: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    setNote(null);
    try {
      await fn();
      void team.mutate();
      void invites.mutate();
      onChanged();
    } catch (e) {
      setError(partnerErrorText(e));
    }
  }

  const columns: Column<TeamMember>[] = [
    {
      key: "name",
      title: "Person",
      render: (m) => (
        <span className="flex min-w-0 items-center gap-2.5">
          {m.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.1] text-[12px] font-bold text-white">{m.name.slice(0, 1).toUpperCase()}</span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-bold text-white">
              {m.name}
              {m.isMe ? <span className="font-normal text-white/50"> (you)</span> : null}
            </span>
            {m.handle ? <span className="truncate text-[12px] text-white/45">@{m.handle.replace(/^@/, "")}</span> : null}
          </span>
        </span>
      ),
    },
    {
      key: "role",
      title: "Role",
      render: (m) =>
        m.status === "removed" ? (
          <Pill tone="quiet">Left</Pill>
        ) : owner && m.role !== "owner" ? (
          <select
            className={filterCls}
            value={m.role}
            onChange={(e) => void act(() => updateMember(m.memberId, { role: e.target.value as "admin" | "member" }))}
            aria-label={`Role for ${m.name}`}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
        ) : (
          <Pill tone={ROLE[m.role].tone}>{ROLE[m.role].label}</Pill>
        ),
    },
    {
      key: "split",
      title: "Their split",
      align: "right",
      render: (m) =>
        !split ? (
          <Muted>Paid to owner</Muted>
        ) : m.role === "owner" ? (
          <Muted>The rest</Muted>
        ) : owner && m.status === "active" ? (
          <SplitInput value={m.splitBps} onSave={(bps) => void act(() => updateMember(m.memberId, { splitBps: bps }))} />
        ) : (
          pct(m.splitBps)
        ),
    },
    { key: "signups", title: "Signups", align: "right", hideBelow: "2xl", render: (m) => m.signups.toLocaleString("en-US") },
    { key: "brought", title: "Brought", align: "right", hideBelow: "md", render: (m) => usd(m.broughtUsdc) },
    { key: "earned", title: "Earned", align: "right", hideBelow: "sm", render: (m) => <span className="font-extrabold text-white">{usd(m.earnedUsdc)}</span> },
    { key: "received", title: "Received", align: "right", hideBelow: "2xl", render: (m) => usd(m.receivedUsdc) },
    { key: "billing", title: "Payouts", hideBelow: "xl", render: (m) => <Pill tone={BILLING[m.billing].tone}>{BILLING[m.billing].label}</Pill> },
    {
      key: "actions",
      title: "",
      align: "right",
      render: (m) =>
        m.status === "active" && !m.isMe && m.role !== "owner" ? (
          <span className="inline-flex justify-end gap-1.5">
            {owner ? (
              <button
                type="button"
                className={smallBtn}
                onClick={() => void act(() => transferOwner(m.memberId), `Make ${m.name} the owner of ${partner.name}? You stay on as an admin.`)}
              >
                Make owner
              </button>
            ) : null}
            {owner || m.role === "member" ? (
              <button
                type="button"
                className={smallBtn}
                aria-label={`Remove ${m.name}`}
                title="Remove from the team"
                onClick={() =>
                  void act(async () => {
                    const out = await removeMember(m.memberId);
                    const t = out.trips;
                    if (t?.moved) {
                      setNote(
                        t.needsAttention.length
                          ? `${t.moved} ${t.moved === 1 ? "trip moved" : "trips moved"} to the owner. ${t.needsAttention.length} trip ${t.needsAttention.length === 1 ? "chat" : "chats"} could not be handed over yet: open ${t.needsAttention.length === 1 ? "it" : "them"} in the HOLD app (a balance still open keeps them in).`
                          : `${t.moved} ${t.moved === 1 ? "trip moved" : "trips moved"} to the owner, with ${t.moved === 1 ? "its" : "their"} group ${t.moved === 1 ? "chat" : "chats"}. Add a new deposit link where one was theirs.`,
                      );
                    }
                  }, `Remove ${m.name} from the team? What they earned stays theirs. Travellers they brought keep counting, for the owner, and their trips move to the owner.`)
                }
              >
                <Ion name="trash-outline" size={15} />
              </button>
            ) : null}
          </span>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DeskPanel title="How the team is paid" meta="Applies to bookings from now on. What was already earned does not move.">
        <ChoicePills
          label="Payout mode"
          value={partner.payoutMode}
          onChange={(mode) => owner && void act(() => setPayoutMode(mode))}
          options={[
            { value: "owner", label: "Everything to the owner" },
            { value: "split", label: "Pay members their split" },
          ]}
        />
        <p className="mt-3 text-[12.5px] leading-[18px] text-white/55">
          {split
            ? "Each member is paid their split of the commission on the travellers they brought, into their own HOLD Savings. The owner is paid the rest. Everyone paid needs billing details checked by HOLD."
            : "All commission is paid to the owner's HOLD Savings, and the team settles among itself."}
        </p>
        {!owner ? <p className="mt-2 text-[12.5px] text-white/45">Only the owner can change this.</p> : null}
      </DeskPanel>

      {error ? <Alert>{error}</Alert> : null}
      {note ? <Notice tone="calm">{note}</Notice> : null}

      <DeskPanel
        flush
        title="Team"
        meta={team.data ? `${team.data.filter((m) => m.status === "active").length} people` : undefined}
        actions={
          partner.status === "active" && !inviting ? (
            <button type="button" className={smallBtn} onClick={() => setInviting(true)}>
              <Ion name="person-add-outline" size={15} />
              Invite
            </button>
          ) : null
        }
      >
        {team.error && !team.data ? (
          <ReadFailed compact title="Could not load the team" onRetry={() => void team.mutate()} />
        ) : !team.data ? (
          <div className="flex flex-col gap-2 px-4 pb-4 sm:px-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <DataTable columns={columns} rows={team.data} rowKey={(m) => m.memberId} />
        )}
      </DeskPanel>

      {inviting ? (
        <NewInvite
          owner={owner}
          split={split}
          onDone={(made) => {
            setInviting(false);
            if (made) void invites.mutate();
          }}
        />
      ) : null}

      {invites.error && invites.data === undefined ? (
        <DeskPanel title="Invites">
          <ReadFailed compact title="Could not load the invites" onRetry={() => void invites.mutate()} />
        </DeskPanel>
      ) : (
        <InvitesPanel invites={invites.data} owner={owner} onRevoke={(i) => void act(() => revokeInvite(i.id), "Cancel this invite? The link stops working.")} />
      )}
    </div>
  );
}

function SplitInput({ value, onSave }: { value: number; onSave: (bps: number) => void }) {
  const [raw, setRaw] = useState(String(value / 100));
  const bps = Math.round(Number(raw.replace(",", ".")) * 100);
  const valid = Number.isFinite(bps) && bps >= 0 && bps <= 10_000;
  const changed = valid && bps !== value;
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <input
        className={`${filterCls} w-[72px] text-right`}
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && changed && onSave(bps)}
        aria-label="Split percent"
      />
      <span className="text-white/50">%</span>
      {changed ? (
        <button type="button" className={amberBtn} onClick={() => onSave(bps)}>
          Save
        </button>
      ) : null}
    </span>
  );
}

function NewInvite({ owner, split, onDone }: { owner: boolean; split: boolean; onDone: (made: boolean) => void }) {
  const [role, setRole] = useState<"member" | "admin">("member");
  const [splitPct, setSplitPct] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<Invite | null>(null);
  const bps = splitPct.trim() ? Math.round(Number(splitPct.replace(",", ".")) * 100) : 0;
  const splitOk = Number.isFinite(bps) && bps >= 0 && bps <= 10_000;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !splitOk) return;
    setBusy(true);
    setError(null);
    try {
      const { invite } = await createInvite({ role, ...(owner && split && bps ? { splitBps: bps } : {}), ...(email.trim() ? { email: email.trim() } : {}) });
      setMade(invite);
    } catch (err) {
      setError(partnerErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (made) {
    return (
      <DeskPanel title="Invite ready" actions={<button type="button" className={smallBtn} onClick={() => onDone(true)}>Done</button>}>
        <p className="break-all font-mono text-[13.5px] text-white">{made.url}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <CopyButton value={made.url ?? ""} className={smallBtn} />
        </div>
        <p className="mt-3 text-[12.5px] leading-[18px] text-white/55">
          Send it to them. They open it, sign in with Apple, Google or email using their own HOLD account, and join with their own link. It works once and
          expires in 14 days.
        </p>
      </DeskPanel>
    );
  }

  return (
    <DeskPanel title="Invite someone">
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-3" noValidate>
        <Field label="Role">
          <ChoicePills
            label="Role"
            value={role}
            onChange={setRole}
            options={owner ? [{ value: "member", label: "Member" }, { value: "admin", label: "Admin" }] : [{ value: "member", label: "Member" }]}
          />
        </Field>
        {owner && split ? (
          <Field label="Their split" hint="Of the commission on travellers they bring.">
            <div className="relative">
              <input className={`${inputCls} pr-9`} inputMode="decimal" value={splitPct} onChange={(e) => setSplitPct(e.target.value)} placeholder="50" />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/55">%</span>
            </div>
          </Field>
        ) : null}
        <Field label="Their email (optional)" hint="With an email, only the HOLD account signed in with it can join. Leave it empty for a link anyone you send it to can use.">
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} placeholder="maria@agency.com" />
        </Field>
        {!splitOk ? (
          <div className="md:col-span-3">
            <Alert>A split is between 0% and 100%.</Alert>
          </div>
        ) : null}
        {error ? (
          <div className="md:col-span-3">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <div className="flex gap-2 md:col-span-3">
          <button type="submit" className={amberBtn} disabled={busy || !splitOk}>
            {busy ? "Making the invite" : "Make the invite link"}
          </button>
          <button type="button" className={smallBtn} onClick={() => onDone(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </DeskPanel>
  );
}

const INVITE: Record<Invite["status"], { label: string; tone: PillTone }> = {
  open: { label: "Waiting", tone: "blue" },
  accepted: { label: "Joined", tone: "green" },
  revoked: { label: "Cancelled", tone: "quiet" },
  expired: { label: "Expired", tone: "quiet" },
};

function InvitesPanel({ invites, owner, onRevoke }: { invites: Invite[] | undefined; owner: boolean; onRevoke: (i: Invite) => void }) {
  if (!invites?.length) return null;
  const columns: Column<Invite>[] = [
    { key: "who", title: "Invite", render: (i) => <span className="text-white">{i.email ?? <Muted>Link only</Muted>}</span> },
    { key: "role", title: "Role", render: (i) => (i.role === "admin" ? "Admin" : "Member") },
    { key: "split", title: "Split", align: "right", hideBelow: "md", render: (i) => (i.splitBps ? pct(i.splitBps) : <Muted>None</Muted>) },
    { key: "status", title: "Status", render: (i) => <Pill tone={INVITE[i.status].tone}>{INVITE[i.status].label}</Pill> },
    {
      key: "actions",
      title: "",
      align: "right",
      render: (i) =>
        i.status === "open" ? (
          <span className="inline-flex justify-end gap-1.5">
            {/* An admin invite is the owner's to share and cancel. */}
            {i.url ? <CopyButton value={i.url} className={smallBtn} /> : null}
            {owner || i.role !== "admin" ? (
              <button type="button" className={smallBtn} onClick={() => onRevoke(i)}>
                Cancel
              </button>
            ) : (
              <Muted>Owner&rsquo;s invite</Muted>
            )}
          </span>
        ) : null,
    },
  ];
  return (
    <DeskPanel flush title="Invites">
      <DataTable columns={columns} rows={invites} rowKey={(i) => i.id} />
    </DeskPanel>
  );
}


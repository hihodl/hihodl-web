"use client";

/**
 * Payments › Groups: every group this person is in, and making one.
 *
 * A group is a conversation (lib/app/groups.ts), so a row reads like an inbox
 * row: the emoji, the name, the last thing said or spent, when, and how much
 * is new. A crew's expenses group is listed here like any other, with a
 * "Crew" tag, and opens the same thread Spaces › Crew opens.
 *
 * The list is the server's order, most recent first. The unread count is a
 * neutral glass badge, not amber and never red: a group that has news is not
 * a group that needs the person.
 *
 * NEW GROUP
 *
 * Two steps, the app's: a name and an emoji, then people by their HOLD
 * username. The group exists after the first step, so somebody who stops
 * there has a group with only themselves in it and can add people from the
 * thread's People sheet later. Nothing is lost by leaving half way.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  addMemberByHandle,
  createGroup,
  describeGroupError,
  lastLine,
  namer,
  useGroupMembers,
  useGroups,
  type GroupRow,
} from "@/lib/app/groups";
import { threadTime } from "@/lib/app/payments";
import { useMe } from "@/lib/app/spaces-data";

import { useProductHref } from "../base";
import { btnGlass, Notice } from "../hold";
import { Ion } from "../ion";
import { inputCls, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { cardClass } from "../wallet/app-kit";

export function GroupsList() {
  const groups = useGroups();
  const [making, setMaking] = useState(false);

  return (
    <div className="flex flex-col">
      {making ? (
        <NewGroup onCancel={() => setMaking(false)} onMade={() => void groups.mutate()} />
      ) : (
        <button type="button" onClick={() => setMaking(true)} className={`${btnGlass} mb-3 w-full`}>
          <Ion name="add" size={18} />
          New group
        </button>
      )}

      {groups.data === undefined && !groups.error ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[62px] rounded-[18px]" />
          ))}
        </div>
      ) : null}

      {groups.error ? (
        <div className="flex flex-col items-center px-4 pt-10 text-center">
          <Ion name="alert-circle-outline" size={48} className="text-white/40" />
          <p className="mt-3 text-[14px] text-white/[0.62]">Could not load your groups</p>
          <button type="button" onClick={() => void groups.mutate()} className={`${btnGlass} mt-4`}>
            Retry
          </button>
        </div>
      ) : null}

      {groups.data && groups.data.length === 0 && !making ? (
        <div className="flex flex-col items-center px-4 pt-10 text-center">
          <Ion name="people-outline" size={48} className="text-white/40" />
          <p className="mt-3 text-[14px] text-white/[0.62]">No groups yet</p>
          <p className="mt-1 max-w-[340px] text-[13px] text-white/55">
            A group is a chat where the money is part of it: split the dinner, the taxi, the flat, and settle up.
          </p>
        </div>
      ) : null}

      {groups.data?.map((g) => <GroupRowView key={g.id} group={g} />)}
    </div>
  );
}

/**
 * One group. Its members are read for the last line's names ("@bea: …"); the
 * same read is what the thread uses, so opening it after this costs nothing.
 */
function GroupRowView({ group }: { group: GroupRow }) {
  const href = useProductHref();
  const me = useMe();
  const members = useGroupMembers(group.last ? group.id : null);
  const names = namer(members.data, me.data?.id ?? null);
  const ts = group.lastAt ? Date.parse(group.lastAt) : 0;

  return (
    <Link
      href={href(`/payments/groups/${encodeURIComponent(group.id)}`)}
      className={`${cardClass} mb-3 flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#1A3B49]`}
    >
      <GroupFace name={group.name} emoji={group.emoji} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-extrabold tracking-[-0.2px] text-white">{group.name}</span>
          {group.crew ? <Tag label="Crew" /> : null}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-white/75">{lastLine(group.last, names)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[12px] text-white/70">{Number.isFinite(ts) ? threadTime(ts) : ""}</span>
        {group.unread > 0 ? (
          <span
            className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border border-white/[0.18] bg-white/10 px-1.5 text-[11px] font-extrabold tabular-nums text-white"
            aria-label={`${group.unread} new`}
          >
            {group.unread > 99 ? "99+" : group.unread}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/** The group's emoji in a disc, or its initials when it has none. */
export function GroupFace({ name, emoji, size = 34 }: { name: string; emoji: string | null | undefined; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "G";
  return (
    <span
      className="flex shrink-0 items-center justify-center border border-white/10 bg-white/[0.08] font-extrabold text-white/[0.82]"
      style={{ width: size, height: size, borderRadius: size / 2, fontSize: emoji ? size * 0.5 : size * 0.36 }}
      aria-hidden
    >
      {emoji?.trim() || initials}
    </span>
  );
}

/* ── New group ────────────────────────────────────────────────────── */

function NewGroup({ onCancel, onMade }: { onCancel: () => void; onMade: () => void }) {
  const router = useRouter();
  const href = useProductHref();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [made, setMade] = useState<{ id: string; name: string } | null>(null);

  if (made) {
    return (
      <AddPeople
        groupId={made.id}
        title={`Who's in ${made.name}?`}
        doneLabel="Open the group"
        onDone={() => router.push(href(`/payments/groups/${encodeURIComponent(made.id)}`))}
      />
    );
  }

  const create = () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setNotice(null);
    createGroup({ name: n, emoji: emoji.trim() || null })
      .then(({ group }) => {
        setMade({ id: group.id, name: group.name });
        onMade();
      })
      .catch((e) => setNotice(describeGroupError(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mb-3 flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5">
      <p className="text-[18px] font-extrabold tracking-[-0.3px] text-white">New group</p>
      <div className="flex gap-2">
        <div className="w-[64px] shrink-0">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 16))}
            placeholder="🙂"
            aria-label="Emoji"
            className={`${inputCls} text-center`}
          />
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Group name, like Lisbon trip"
          aria-label="Group name"
          autoFocus
          className={inputCls}
        />
      </div>
      {notice ? <Notice>{notice}</Notice> : null}
      <div className="flex gap-2">
        <button type="button" className={`${btnGlass} flex-1`} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="inline-flex h-11 flex-1 items-center justify-center rounded-[12px] bg-[#F1F5F9] px-4 text-[14px] font-extrabold text-[#0A1420] transition-opacity hover:opacity-90 disabled:bg-white/[0.07] disabled:text-white/60"
          onClick={create}
          disabled={busy || !name.trim()}
        >
          {busy ? "Making it…" : "Next"}
        </button>
      </div>
    </div>
  );
}

/**
 * Add people by their HOLD username, one at a time. Exact match on the
 * server: a guess never adds a stranger to a group about money, so a miss is
 * said as a miss and never "did you mean".
 */
export function AddPeople({
  groupId,
  title,
  doneLabel,
  onDone,
  onAdded,
}: {
  groupId: string;
  title?: string;
  doneLabel?: string;
  onDone?: () => void;
  onAdded?: () => void;
}) {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<{ text: string; good: boolean }[]>([]);

  const add = () => {
    const h = handle.trim().replace(/^@+/, "");
    if (h.length < 2 || busy) return;
    setBusy(true);
    addMemberByHandle(groupId, h)
      .then((r) => {
        setLines((l) => [{ text: r.added ? `@${h} is in the group.` : `@${h} was already in the group.`, good: true }, ...l]);
        setHandle("");
        onAdded?.();
      })
      .catch((e) => setLines((l) => [{ text: describeGroupError(e), good: false }, ...l]))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mb-3 flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5">
      {title ? <p className="text-[18px] font-extrabold tracking-[-0.3px] text-white">{title}</p> : null}
      <div className="flex gap-2">
        <div className="flex min-h-12 w-full min-w-0 items-center gap-1 rounded-[16px] border border-white/[0.12] bg-white/[0.06] px-3.5 text-[15.5px] text-white transition-colors focus-within:border-white/30">
          <span className="text-white/55">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace(/\s/g, "").slice(0, 41))}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="username"
            aria-label="HOLD username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-white/[0.45]"
          />
        </div>
        <button type="button" className={btnGlass} onClick={add} disabled={busy || handle.trim().replace(/^@+/, "").length < 2}>
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {lines.map((l, i) =>
        l.good ? (
          <Notice key={i} tone="good" icon="checkmark-circle-outline">
            {l.text}
          </Notice>
        ) : (
          <Notice key={i}>{l.text}</Notice>
        ),
      )}
      {onDone ? (
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-[12px] bg-[#F1F5F9] px-4 text-[14px] font-extrabold text-[#0A1420] transition-opacity hover:opacity-90"
          onClick={onDone}
        >
          {doneLabel ?? "Done"}
        </button>
      ) : null}
    </div>
  );
}

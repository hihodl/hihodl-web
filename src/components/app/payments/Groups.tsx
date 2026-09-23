"use client";

/**
 * Payments › Groups: every group this person is in, and making one.
 *
 * A group is a conversation (lib/app/groups.ts), so a row reads like an inbox
 * row: the group's face (its photo, else its emoji), the name, the last thing
 * said or spent, when, and how much is new. A crew's expenses group is listed
 * here like any other, with a "Crew" tag, and opens the same thread Spaces ›
 * Crew opens.
 *
 * The list is the server's order, most recent first. The unread count is a
 * neutral glass badge, not amber and never red: a group that has news is not
 * a group that needs the person.
 *
 * NEW GROUP
 *
 * One sheet, the app's create-group: the face (an emoji from the picker, and
 * an optional photo), the name, the currency the book is kept in, and the
 * people, chosen from the HOLD directory. The group and everyone in it are
 * written in one call (POST /groups with memberUserIds); the photo is uploaded
 * after, because it needs the group's id. A photo that fails to upload does
 * not undo the group: it says so, offers Retry, and the group opens anyway.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createGroup, describeGroupError, lastLine, namer, uploadGroupPhoto, useGroupMembers, useGroups, type GroupRow, type Person } from "@/lib/app/groups";
import { threadTime } from "@/lib/app/payments";
import { useMe } from "@/lib/app/spaces-data";

import { useProductHref } from "../base";
import { btnGlass, Notice } from "../hold";
import { Ion } from "../ion";
import { inputCls, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { cardClass } from "../wallet/app-kit";
import { DirectoryPicker } from "./DirectoryPicker";
import { CurrencyInput, FacePicker, GroupFace, LoadFailed, plateWhite, sectionLabel, Sheet } from "./group-kit";

export { GroupFace };

export function GroupsList() {
  const groups = useGroups();
  const [making, setMaking] = useState(false);

  return (
    <div className="flex flex-col">
      <button type="button" onClick={() => setMaking(true)} className={`${btnGlass} mb-3 w-full`}>
        <Ion name="add" size={18} />
        New group
      </button>
      {making ? <NewGroup onClose={() => setMaking(false)} onMade={() => void groups.mutate()} /> : null}

      {groups.data === undefined && !groups.error ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[62px] rounded-[18px]" />
          ))}
        </div>
      ) : null}

      {groups.error && groups.data === undefined ? <LoadFailed words="Could not load your groups." onRetry={() => void groups.mutate()} /> : null}

      {groups.data && groups.data.length === 0 ? (
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
  const unread = group.unread ?? 0;

  return (
    <Link
      href={href(`/payments/groups/${encodeURIComponent(group.id)}`)}
      className={`${cardClass} mb-3 flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#1A3B49]`}
    >
      <GroupFace name={group.name} emoji={group.emoji} photoUrl={group.photoUrl} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-extrabold tracking-[-0.2px] text-white">{group.name}</span>
          {group.crew ? <Tag label="Crew" /> : null}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-white/75">{lastLine(group.last, names)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[12px] text-white/70">{ts && Number.isFinite(ts) ? threadTime(ts) : ""}</span>
        {unread > 0 ? (
          <span
            className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border border-white/[0.18] bg-white/10 px-1.5 text-[11px] font-extrabold tabular-nums text-white"
            aria-label={`${unread} new`}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/* ── New group ────────────────────────────────────────────────────── */

const MAX_INITIAL_MEMBERS = 20;

function NewGroup({ onClose, onMade }: { onClose: () => void; onMade: () => void }) {
  const router = useRouter();
  const href = useProductHref();
  const me = useMe();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("👥");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Made, but the photo did not go up: the group is real, the photo can be tried again. */
  const [made, setMade] = useState<{ id: string; photoProblem: string } | null>(null);

  const open = (id: string) => router.push(href(`/payments/groups/${encodeURIComponent(id)}`));
  const curOk = /^[A-Z]{3}$/.test(currency);
  const ready = !!name.trim() && curOk && !busy;

  const putPhoto = async (id: string, blob: Blob) => {
    try {
      await uploadGroupPhoto(id, blob);
      open(id);
    } catch (e) {
      setMade({ id, photoProblem: describeGroupError(e) });
    }
  };

  const create = async () => {
    if (!ready) return;
    setBusy(true);
    setNotice(null);
    try {
      const { group } = await createGroup({
        name: name.trim(),
        emoji,
        currency,
        memberUserIds: people.map((p) => p.id),
      });
      onMade();
      if (photo) await putPhoto(group.id, photo);
      else open(group.id);
    } catch (e) {
      setNotice(describeGroupError(e));
    } finally {
      setBusy(false);
    }
  };

  if (made) {
    return (
      <Sheet title="Group made" onClose={() => open(made.id)} busy={busy}>
        <Notice>The group is made, but its photo didn&apos;t upload. {made.photoProblem}</Notice>
        <div className="flex gap-2">
          <button type="button" className={`${btnGlass} flex-1`} disabled={busy} onClick={() => open(made.id)}>
            Open without it
          </button>
          <button
            type="button"
            className={`${plateWhite} flex-1`}
            disabled={busy || !photo}
            onClick={() => {
              if (!photo) return;
              setBusy(true);
              void putPhoto(made.id, photo).finally(() => setBusy(false));
            }}
          >
            {busy ? "Uploading…" : "Retry photo"}
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="New group" onClose={onClose} busy={busy} wide>
      <FacePicker name={name} emoji={emoji} onEmoji={setEmoji} photo={photo} onPhoto={setPhoto} disabled={busy} />

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          placeholder="Group name, like Lisbon trip"
          aria-label="Group name"
          autoFocus
          disabled={busy}
          className={inputCls}
        />
        <div className="w-[84px] shrink-0">
          <CurrencyInput value={currency} onChange={setCurrency} disabled={busy} label="The group's currency" />
        </div>
      </div>
      <p className="-mt-1.5 px-1 text-[12px] text-white/55">
        {curOk ? `Balances are kept in ${currency}. Expenses can be added in any currency.` : "A currency is a three-letter code, like USD or EUR."}
      </p>

      <p className={sectionLabel}>People</p>
      <DirectoryPicker selected={people} onChange={setPeople} exclude={me.data?.id ? [me.data.id] : []} max={MAX_INITIAL_MEMBERS} disabled={busy} />

      {notice ? <Notice>{notice}</Notice> : null}
      <div className="flex gap-2 pt-1">
        <button type="button" className={`${btnGlass} flex-1`} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={`${plateWhite} flex-1`} onClick={() => void create()} disabled={!ready}>
          {busy ? "Making it…" : people.length ? `Create with ${people.length}` : "Create group"}
        </button>
      </div>
    </Sheet>
  );
}

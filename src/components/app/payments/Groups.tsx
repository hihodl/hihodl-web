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
 * Over the list, "Across your groups" (GET /groups/stats, contract §10.5):
 * per currency what you owe, what you're owed, your share and what you paid,
 * with your share month by month. Currencies are never added together. It is
 * left out when the answer is empty or the server has no such route yet.
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

import {
  createGroup,
  describeGroupError,
  fractions,
  lastLine,
  monthLabel,
  monthsOf,
  namer,
  toBig,
  uploadGroupPhoto,
  useAllGroupsStats,
  useGroupMembers,
  useGroups,
  type AllGroupsStats,
  type GroupRow,
  type Person,
} from "@/lib/app/groups";
import { Rich, useT } from "@/lib/app/i18n/react";
import { threadTime } from "@/lib/app/payments";
import { useMe } from "@/lib/app/spaces-data";

import { useProductHref } from "../base";
import { btnGlass, Notice } from "../hold";
import { Ion } from "../ion";
import { inputCls, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { cardClass } from "../wallet/app-kit";
import { money } from "./AddExpense";
import { DirectoryPicker } from "./DirectoryPicker";
import { CurrencyInput, FacePicker, GroupFace, LoadFailed, plateWhite, sectionLabel, Sheet } from "./group-kit";

export { GroupFace };

export function GroupsList() {
  const t = useT();
  const groups = useGroups();
  const [making, setMaking] = useState(false);

  return (
    <div className="flex flex-col">
      <button type="button" onClick={() => setMaking(true)} className={`${btnGlass} mb-3 w-full`}>
        <Ion name="add" size={18} />
        {t("groups.list.newGroup")}
      </button>
      {making ? <NewGroup onClose={() => setMaking(false)} onMade={() => void groups.mutate()} /> : null}

      {groups.data && groups.data.length ? <AcrossGroups /> : null}

      {groups.data === undefined && !groups.error ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[62px] rounded-[18px]" />
          ))}
        </div>
      ) : null}

      {groups.error && groups.data === undefined ? <LoadFailed words={t("groups.list.loadFailed")} onRetry={() => void groups.mutate()} /> : null}

      {groups.data && groups.data.length === 0 ? (
        <div className="flex flex-col items-center px-4 pt-10 text-center">
          <Ion name="people-outline" size={48} className="text-white/40" />
          <p className="mt-3 text-[14px] text-white/[0.62]">{t("groups.list.empty")}</p>
          <p className="mt-1 max-w-[340px] text-[13px] text-white/55">
            {t("groups.list.emptyBody")}
          </p>
        </div>
      ) : null}

      {groups.data?.map((g) => <GroupRowView key={g.id} group={g} />)}
    </div>
  );
}

/** You across every group, one card per currency. Quiet when there is nothing to say or the read fails. */
function AcrossGroups() {
  const t = useT();
  const stats = useAllGroupsStats();
  const totals = (stats.data?.totals ?? []).filter((x) => [x.youOweMinor, x.owedToYouMinor, x.yourShareMinor, x.paidMinor].some((v) => toBig(v) !== 0n));
  if (!totals.length) return null;
  return (
    <section className="mb-3 flex flex-col gap-2" aria-label={t("groups.across.title")}>
      <p className="px-1 text-[12px] font-bold uppercase tracking-[1.4px] text-white/55">{t("groups.across.title")}</p>
      <div className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {totals.map((x) => (
          <CurrencyCard key={x.currency} t={x} months={monthsOf(stats.data!.byMonth, x.currency)} single={totals.length === 1} />
        ))}
      </div>
    </section>
  );
}

function CurrencyCard({ t: tot, months, single }: { t: AllGroupsStats["totals"][number]; months: { month: string; yourShareMinor: string }[]; single: boolean }) {
  const t = useT();
  const f = fractions(months.map((m) => m.yourShareMinor));
  const owe = toBig(tot.youOweMinor) > 0n;
  const owed = toBig(tot.owedToYouMinor) > 0n;
  return (
    <div className={`${cardClass} flex shrink-0 snap-start flex-col gap-2.5 p-3.5 ${single ? "w-full" : "w-[min(300px,82vw)]"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-bold text-white/60">{tot.currency}</span>
        <span className="text-[12px] text-white/55">
          <Rich
            k="groups.across.shareAndPaid"
            vars={{ share: money(tot.yourShareMinor, tot.currency), paid: money(tot.paidMinor, tot.currency) }}
            tags={{ b: (c) => <b className="tabular-nums text-white">{c}</b> }}
          />
        </span>
      </div>
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold text-white/55">{t("groups.across.youOwe")}</p>
          <p className="truncate text-[18px] font-bold tabular-nums text-white">{owe ? money(tot.youOweMinor, tot.currency) : t("groups.across.nothing")}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold text-white/55">{t("groups.across.youreOwed")}</p>
          <p className="truncate text-[18px] font-bold tabular-nums" style={{ color: owed ? "#4ADE80" : "#fff" }}>
            {owed ? money(tot.owedToYouMinor, tot.currency) : t("groups.across.nothing")}
          </p>
        </div>
      </div>
      {months.length > 1 ? (
        <div>
          <div className="flex h-9 items-end gap-[2px]" role="img" aria-label={t("groups.across.chartA11y", { currency: tot.currency })}>
            {months.map((m, i) => (
              <span
                key={m.month}
                title={t("groups.across.monthTip", { month: monthLabel(m.month, true), amount: money(m.yourShareMinor, tot.currency) })}
                className="min-w-0 flex-1 rounded-t-[3px] bg-[#4ADE80]/80"
                style={{ height: `${Math.max(f[i] * 100, toBig(m.yourShareMinor) > 0n ? 4 : 0)}%` }}
              />
            ))}
          </div>
          <p className="mt-1 flex justify-between text-[10.5px] font-semibold text-white/45">
            <span>{monthLabel(months[0].month)}</span>
            <span>{t("groups.across.byMonth")}</span>
            <span>{monthLabel(months[months.length - 1].month)}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One group. Its members are read for the last line's names ("@bea: …"); the
 * same read is what the thread uses, so opening it after this costs nothing.
 */
function GroupRowView({ group }: { group: GroupRow }) {
  const t = useT();
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
          {group.crew ? <Tag label={t("groups.list.crew")} /> : null}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-white/75">{lastLine(group.last, names)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[12px] text-white/70">{ts && Number.isFinite(ts) ? threadTime(ts) : ""}</span>
        {unread > 0 ? (
          <span
            className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border border-white/[0.18] bg-white/10 px-1.5 text-[11px] font-extrabold tabular-nums text-white"
            aria-label={t("groups.list.unread", { count: unread })}
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
  const t = useT();
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
      <Sheet title={t("groups.new.made")} onClose={() => open(made.id)} busy={busy}>
        <Notice>{t("groups.new.photoFailed", { problem: made.photoProblem })}</Notice>
        <div className="flex gap-2">
          <button type="button" className={`${btnGlass} flex-1`} disabled={busy} onClick={() => open(made.id)}>
            {t("groups.new.openWithout")}
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
            {busy ? t("groups.new.uploading") : t("groups.new.retryPhoto")}
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={t("groups.list.newGroup")} onClose={onClose} busy={busy} wide>
      <FacePicker name={name} emoji={emoji} onEmoji={setEmoji} photo={photo} onPhoto={setPhoto} disabled={busy} />

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          placeholder={t("groups.new.namePlaceholder")}
          aria-label={t("groups.new.nameA11y")}
          autoFocus
          disabled={busy}
          className={inputCls}
        />
        <div className="w-[84px] shrink-0">
          <CurrencyInput value={currency} onChange={setCurrency} disabled={busy} label={t("groups.new.currencyA11y")} />
        </div>
      </div>
      <p className="-mt-1.5 px-1 text-[12px] text-white/55">
        {curOk ? t("groups.new.currencyKept", { currency }) : t("groups.new.currencyHint")}
      </p>

      <p className={sectionLabel}>{t("groups.new.people")}</p>
      <DirectoryPicker selected={people} onChange={setPeople} exclude={me.data?.id ? [me.data.id] : []} max={MAX_INITIAL_MEMBERS} disabled={busy} />

      {notice ? <Notice>{notice}</Notice> : null}
      <div className="flex gap-2 pt-1">
        <button type="button" className={`${btnGlass} flex-1`} onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </button>
        <button type="button" className={`${plateWhite} flex-1`} onClick={() => void create()} disabled={!ready}>
          {busy ? t("groups.new.making") : people.length ? t("groups.new.createWith", { count: people.length }) : t("groups.new.create")}
        </button>
      </div>
    </Sheet>
  );
}

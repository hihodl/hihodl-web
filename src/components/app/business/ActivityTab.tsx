"use client";

/**
 * Business › Activity: who did what on the business, newest first, from the
 * append-only log (GET /business/activity-log). Filters by space, by person
 * and by action; paged by the server's cursor.
 *
 * The owner reads their own; a manager reads the business they act for with
 * `?asBusiness=<owner>`. A rep has no `activity.view` and never sees the tab.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { listActivity, type ActivityEvent } from "@/lib/app/business";
import { actionKey, BUSINESS_ACTIONS, summaryLines } from "@/lib/app/business-rules";
import { tMaybe } from "@/lib/app/i18n";
import { fmtDateTime } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { btnGlassPill, Card, Empty, Field, inputCls, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { ErrorNote } from "./parts";

export function ActivityTab({ asBusiness, spaces }: { asBusiness: string | null; spaces: { id: string; title: string }[] }) {
  const t = useT();
  const [spaceId, setSpaceId] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // People seen in the log so far, so the person filter keeps its options while it filters.
  const [people, setPeople] = useState<Map<string, string>>(new Map());

  const load = useCallback(
    async (from: string | null) => {
      setBusy(true);
      setError(null);
      try {
        const page = await listActivity({ asBusiness, cursor: from, spaceId: spaceId || null, actor: actor || null, action: action || null });
        setEvents((prev) => (from && prev ? [...prev, ...page.events] : page.events));
        setCursor(page.nextCursor);
        setPeople((prev) => {
          const m = new Map(prev);
          for (const e of page.events) if (e.actor?.userId) m.set(e.actor.userId, e.actor.name || e.actor.userId.slice(0, 8));
          return m;
        });
      } catch (e) {
        setError(e);
        if (!from) setEvents([]);
      } finally {
        setBusy(false);
      }
    },
    [asBusiness, spaceId, actor, action],
  );

  useEffect(() => {
    setEvents(null);
    setCursor(null);
    void load(null);
  }, [load]);

  const titles = useMemo(() => new Map(spaces.map((s) => [s.id, s.title])), [spaces]);

  return (
    <div className="flex flex-col gap-2.5">
      <Card className="gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("business.activity.space")} htmlFor="b-act-space">
            <select id="b-act-space" className={inputCls} value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              <option value="" className="bg-[#0A1420]">{t("business.activity.everySpace")}</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0A1420]">
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("business.activity.person")} htmlFor="b-act-actor">
            <select id="b-act-actor" className={inputCls} value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="" className="bg-[#0A1420]">{t("business.activity.everyone")}</option>
              {[...people.entries()].map(([id, name]) => (
                <option key={id} value={id} className="bg-[#0A1420]">
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("business.activity.action")} htmlFor="b-act-action">
            <select id="b-act-action" className={inputCls} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="" className="bg-[#0A1420]">{t("business.activity.everyAction")}</option>
              {BUSINESS_ACTIONS.map((a) => (
                <option key={a} value={a} className="bg-[#0A1420]">
                  {tMaybe(actionKey(a), a)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <ErrorNote error={error} />
      {events === null ? (
        <Skeleton className="h-40" />
      ) : events.length === 0 ? (
        error ? null : (
          <Card>
            <Empty icon="list-outline" title={t("business.activity.emptyTitle")} body={t("business.activity.emptyBody")} />
          </Card>
        )
      ) : (
        <Card className="gap-0 py-1.5">
          {events.map((e) => (
            <EventRow key={e.id} event={e} spaceTitle={e.spaceId ? titles.get(e.spaceId) ?? null : null} />
          ))}
        </Card>
      )}
      {cursor ? (
        <button type="button" className={`${btnGlassPill} self-center`} disabled={busy} onClick={() => void load(cursor)}>
          {busy ? t("business.loading") : t("business.loadMore")}
        </button>
      ) : null}
    </div>
  );
}

function EventRow({ event: e, spaceTitle }: { event: ActivityEvent; spaceTitle: string | null }) {
  const t = useT();
  const lines = summaryLines(e.summary);
  const role = e.actor?.role;
  return (
    <div className="flex flex-col gap-1 border-b border-white/[0.06] px-1 py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold text-white">{tMaybe(actionKey(e.action), e.action)}</span>
        <span className="shrink-0 text-[12px] text-white/55">{fmtDateTime(e.at)}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[12.5px] text-white/[0.82]">{e.actor?.name || t("business.activity.someone")}</span>
        {role === "owner" || role === "manager" || role === "rep" ? <Tag label={t(`business.role.${role}` as const)} tone="dim" /> : null}
        {spaceTitle ? <span className="truncate text-[12.5px] text-white/55">· {spaceTitle}</span> : null}
      </div>
      {lines.length ? (
        <ul className="flex flex-col gap-0.5 pt-0.5">
          {lines.map((l) => (
            <li key={l} className="truncate font-mono text-[11.5px] text-white/55">
              {l}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

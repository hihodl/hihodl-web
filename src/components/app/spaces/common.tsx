"use client";

/** Pieces the Spaces screens share. */

import { describeCreatorError } from "@/lib/creator/api";
import type { SpaceStatus } from "@/lib/creator/listing";
import { t, type MessageKey } from "@/lib/app/i18n";
import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { Notice } from "../hold";
import { Tag } from "./kit";

const STATUS_KEY: Record<SpaceStatus | string, MessageKey> = {
  draft: "creator.status.draft",
  live: "creator.status.live",
  closed: "creator.status.closed",
  delisted: "creator.status.delisted",
};

/** A listing's status in words, at render. */
export function statusLabel(status: string): string {
  const k = STATUS_KEY[status];
  return k ? t(k) : status;
}

/** The app's `statusTag` (MySpacesList): Live is green, Draft calm, Closed dim, Taken down amber. */
const STATUS_TONE: Record<string, "good" | "calm" | "dim" | "caution"> = {
  live: "good",
  draft: "calm",
  closed: "dim",
  delisted: "caution",
};

export function StatusPill({ status, onPhoto = false }: { status: string; onPhoto?: boolean }) {
  useT();
  const tag = <Tag label={statusLabel(status)} tone={STATUS_TONE[status] ?? "calm"} />;
  // A tag is a tint; on a picture it sits on a dark backing of the same shape so it reads.
  return onPhoto ? <span className="inline-flex rounded-[11px] bg-[#04101A]/75 backdrop-blur-md">{tag}</span> : tag;
}

/** The app's Notice for a read that failed: an amber tint, never red. */
export function ReadError({ error }: { error: unknown }) {
  useT();
  return error ? <Notice icon="cloud-offline-outline">{describeCreatorError(error)}</Notice> : null;
}

/** "12 Sep" for a day or an instant. */
export function shortDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return fmtDate(d, { day: "numeric", month: "short" });
}

/** "in 3d", "2d late", "today". */
export function dueText(iso: string | null | undefined): string {
  if (!iso) return "";
  const day = iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const diff = Math.round((new Date(`${day}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
  if (diff === 0) return t("creator.due.today");
  return diff > 0 ? t("creator.due.inDays", { days: diff }) : t("creator.due.daysLate", { days: -diff });
}

/** "Due in 1d 4h", "Due in 5h", "6h late": a production spot is due to the hour. */
export function countdownText(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms)) return "";
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.max(1, Math.floor((abs % 3_600_000) / 60_000));
  const span =
    days > 0 ? t("creator.due.spanDaysHours", { days, hours }) : hours > 0 ? t("creator.due.spanHours", { hours }) : t("creator.due.spanMinutes", { minutes });
  return ms >= 0 ? t("creator.due.dueIn", { span }) : t("creator.due.late", { span });
}

/** The list pane scrolls inside itself on a wide screen, so the page does not. */
export const LIST_PANEL = "lg:max-h-[calc(var(--app-vh,100dvh)-196px)]";

/** A two-pane screen: a list on the left, the chosen item on the right. One pane at a time on a phone. */
export function MasterDetail({
  list,
  detail,
  showDetail,
}: {
  list: React.ReactNode;
  detail: React.ReactNode;
  /** On a phone, which pane is on screen. */
  showDetail: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <div className={showDetail ? "hidden lg:block" : ""}>{list}</div>
      <div className={showDetail ? "" : "hidden lg:block"}>{detail}</div>
    </div>
  );
}

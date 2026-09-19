"use client";

/** Pieces the Spaces screens share. */

import { pill } from "@/components/ad-space/ui";
import { describeCreatorError } from "@/lib/creator/api";
import type { SpaceStatus } from "@/lib/creator/listing";

import { Alert } from "../ui";

export const STATUS_LABEL: Record<SpaceStatus | string, string> = {
  draft: "Draft",
  live: "Live",
  closed: "Closed",
  delisted: "Taken down",
};

export function StatusPill({ status, onPhoto = false }: { status: string; onPhoto?: boolean }) {
  const cls = status === "live" ? pill.open : status === "draft" ? pill.attention : pill.neutral;
  const text = <span className={cls}>{STATUS_LABEL[status] ?? status}</span>;
  // The pills are tints; on a picture they sit on a dark backing of the same shape so they read.
  return onPhoto ? <span className="inline-flex rounded-[12px] bg-[#04101A]/75 backdrop-blur-md">{text}</span> : text;
}

export function ReadError({ error }: { error: unknown }) {
  return error ? <Alert>{describeCreatorError(error)}</Alert> : null;
}

/** "12 Sep" for a day or an instant. */
export function shortDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "in 3d", "2d late", "today". */
export function dueText(iso: string | null | undefined): string {
  if (!iso) return "";
  const day = iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const diff = Math.round((new Date(`${day}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
  if (diff === 0) return "today";
  return diff > 0 ? `in ${diff}d` : `${-diff}d late`;
}

/** "Due in 1d 4h", "Due in 5h", "6h late": a production spot is due to the hour. */
export function countdownText(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms)) return "";
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.max(1, Math.floor((abs % 3_600_000) / 60_000));
  const span = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h` : `${minutes}m`;
  return ms >= 0 ? `Due in ${span}` : `${span} late`;
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

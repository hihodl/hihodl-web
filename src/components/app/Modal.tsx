"use client";

/**
 * The one modal, drawn the app's way (hihodl-wallet BottomKeyboardModal and
 * theme/colors `sheetSurface`).
 *
 *   phone    a sheet from the foot: the grab handle (40 x 4, white at 28%),
 *            the teal head fading to the app's navy, the lit top edge, a
 *            dimmed backdrop. It springs in, and it closes by a tap on the
 *            backdrop, Escape, or dragging it down by its head
 *   desktop  the same surface as a centred dialog, faded and lifted in
 *
 * Focus moves into it and stays there (Tab and Shift-Tab wrap), and goes back
 * to what opened it when it closes. Only the top modal answers Escape, so a
 * sheet opened from a sheet closes on its own. While `busy`, nothing closes
 * it: a request in the air is not something to close over.
 *
 * `size="full"` is a whole screen on a phone (the add-expense flow, as the app
 * pushes a screen) and a tall dialog on a desktop. `bare` drops the surface
 * for a viewer that brings its own (the receipt).
 *
 * Colours are the app's; nothing here is red.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useT } from "@/lib/app/i18n/react";

import { Ion } from "./ion";

const EASE = "cubic-bezier(0.32,0.72,0,1)";
const OPEN_MS = 420;
const CLOSE_MS = 240;
const DRAG_CLOSE_PX = 110;
const DRAG_CLOSE_VELOCITY = 0.55;

/** The open modals, newest last: Escape belongs to the last one only. */
const stack: string[] = [];

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export type ModalSize = "sm" | "md" | "lg" | "full";

const WIDTH: Record<ModalSize, string> = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[440px]",
  lg: "sm:max-w-[520px]",
  full: "sm:max-w-[560px]",
};

export function Modal({
  onClose,
  title,
  hideTitle = false,
  children,
  footer,
  busy = false,
  size = "md",
  bare = false,
  showClose = true,
  label,
}: {
  onClose: () => void;
  /** The heading, centred under the handle as in the app. */
  title?: ReactNode;
  /** Keep the title for screen readers only (a screen that draws its own big one). */
  hideTitle?: boolean;
  children: ReactNode;
  /** Pinned under the scrolling body: the sheet's buttons. */
  footer?: ReactNode;
  busy?: boolean;
  size?: ModalSize;
  bare?: boolean;
  showClose?: boolean;
  /** The accessible name when there is no title. */
  label?: string;
}) {
  const t = useT();
  const id = useId();
  const titleId = `${id}-title`;
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"in" | "open" | "out">("in");
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => setMounted(true), []);

  const closing = useRef(false);
  const close = useCallback(() => {
    if (busyRef.current || closing.current) return;
    closing.current = true;
    setPhase("out");
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  // Enter on the next frame, so the transition has a start to run from.
  useLayoutEffect(() => {
    if (!mounted) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("open")));
    return () => cancelAnimationFrame(r);
  }, [mounted]);

  // The stack, the page behind held still, focus in and back out.
  useEffect(() => {
    if (!mounted) return;
    stack.push(id);
    const before = document.activeElement as HTMLElement | null;
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const el = panel.current;
      if (!el || el.contains(document.activeElement)) return;
      const auto = el.querySelector<HTMLElement>("[autofocus],[data-autofocus]");
      (auto ?? el).focus({ preventScroll: true });
    }, 30);
    return () => {
      window.clearTimeout(t);
      const i = stack.lastIndexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (!stack.length) body.style.overflow = overflow;
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [mounted, id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) {
        e.preventDefault();
        panel.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [id, close]);

  /* Dragging down by the head, on a touch screen or with a pen. */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || busy) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) return;
    dragStart.current = { y: e.clientY, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragStart.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    // Upwards it gives a little and no more, as a native sheet does.
    setDrag(dy > 0 ? dy : -Math.sqrt(-dy) * 2);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = dragStart.current;
    dragStart.current = null;
    if (!s) return;
    const dy = e.clientY - s.y;
    const v = dy / Math.max(1, performance.now() - s.t);
    if (dy > DRAG_CLOSE_PX || (dy > 24 && v > DRAG_CLOSE_VELOCITY)) {
      setDrag(0);
      close();
    } else setDrag(0);
  };

  if (!mounted) return null;

  const shown = phase === "open";
  const dragging = dragStart.current !== null;
  const full = size === "full";
  const surface = bare
    ? ""
    : "bg-[linear-gradient(180deg,#122C36_0%,#0A1921_55%,#08151C_100%)] shadow-[0_-12px_48px_rgba(0,0,0,0.45)] sm:shadow-[0_24px_70px_rgba(0,0,0,0.55)]";

  const head = (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative shrink-0 touch-none select-none ${bare ? "" : "px-4"}`}
    >
      {!bare ? <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/[0.16] sm:rounded-t-[24px]" /> : null}
      {!full && !bare ? (
        <div className="flex justify-center pb-0.5 pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-[2px] bg-white/[0.28]" />
        </div>
      ) : null}
      {title !== undefined && !hideTitle ? (
        <div className={`flex min-h-[52px] items-center justify-center ${showClose ? "px-10" : ""} pb-1.5 pt-2 sm:pt-3.5`}>
          <h2 id={titleId} className="min-w-0 truncate text-center text-[18px] font-extrabold tracking-[-0.3px] text-white">
            {title}
          </h2>
        </div>
      ) : title !== undefined ? (
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
      ) : null}
      {showClose && !bare ? (
        <button
          type="button"
          onClick={close}
          disabled={busy}
          aria-label={t("common.close")}
          className={`absolute right-3 ${full ? "top-3" : "top-4 sm:top-3.5"} flex h-9 w-9 items-center justify-center rounded-[18px] bg-white/[0.06] text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-40 ${full ? "" : "max-sm:hidden"}`}
        >
          <Ion name="close" size={19} />
        </button>
      ) : null}
    </div>
  );

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex ${full ? "items-stretch sm:items-center" : "items-end sm:items-center"} justify-center sm:p-4`}
      role="presentation"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("common.close")}
        onClick={close}
        className={`absolute inset-0 cursor-default bg-[#02070c]/60 backdrop-blur-[3px] transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
        aria-label={title === undefined ? label : undefined}
        tabIndex={-1}
        style={{
          transform: shown ? `translate3d(0, ${Math.max(drag, -12)}px, 0)` : undefined,
          transition: dragging ? "none" : `transform ${phase === "out" ? CLOSE_MS : OPEN_MS}ms ${EASE}, opacity ${phase === "out" ? CLOSE_MS : 260}ms ease`,
        }}
        className={`relative flex w-full flex-col overflow-hidden outline-none ${WIDTH[size]} ${surface} ${
          full ? "h-[100dvh] sm:h-[min(820px,90dvh)] sm:rounded-[24px]" : "max-h-[92dvh] rounded-t-[28px] pb-[env(safe-area-inset-bottom)] sm:max-h-[88dvh] sm:rounded-[24px] sm:pb-0"
        } ${bare ? "bg-transparent" : "sm:border sm:border-white/[0.1]"} ${
          shown ? "opacity-100" : `${full ? "translate-y-[6%]" : "translate-y-full"} opacity-100 sm:translate-y-3 sm:scale-[0.98] sm:opacity-0`
        } motion-reduce:!transition-none`}
      >
        {head}
        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain ${bare ? "" : "gap-3 px-4 pb-4"}`}>{children}</div>
        {footer ? <div className="shrink-0 border-t border-white/[0.06] px-4 pb-4 pt-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** A row in a modal list: a face or icon, words, and a check when chosen (the app's "Paid by" sheet). */
export function ModalChoice({
  selected,
  onClick,
  leading,
  label,
  sub,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  leading: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[64px] w-full items-center gap-3.5 rounded-[20px] px-3.5 py-2.5 text-left transition-colors disabled:opacity-50 ${
        selected ? "bg-white/[0.1]" : "bg-white/[0.04] hover:bg-white/[0.08]"
      }`}
    >
      <span className="relative shrink-0">
        {leading}
        {selected ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-[9px] bg-[#F1F5F9] text-[#0A1420] ring-2 ring-[#0E2129]">
            <Ion name="checkmark" size={12} />
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15.5px] font-bold text-white">{label}</span>
        {sub ? <span className="truncate text-[12.5px] text-white/55">{sub}</span> : null}
      </span>
    </button>
  );
}

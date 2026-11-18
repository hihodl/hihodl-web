"use client";

/**
 * The one modal, drawn the app's way (hihodl-wallet BottomKeyboardModal and
 * theme/colors `sheetSurface`).
 *
 *   phone    a sheet from the foot: the grab handle (40 x 4, white at 28%),
 *            the teal head fading to the app's navy, the lit top edge, a
 *            dimmed backdrop. It springs in, and it closes by a tap on the
 *            backdrop, Escape, or dragging it down from anywhere on it
 *   desktop  the same surface as a centred dialog, faded and lifted in
 *
 * Focus moves into it and stays there (Tab and Shift-Tab wrap), and goes back
 * to what opened it when it closes. Only the top modal answers Escape, so a
 * sheet opened from a sheet closes on its own. While `busy`, nothing closes
 * it: a request in the air is not something to close over.
 *
 * `size="full"` is a whole screen on a phone (the add-expense flow, as the app
 * pushes a screen) and a tall dialog on a desktop. `bare` drops the surface
 * for a viewer that brings its own (the receipt). `tall` opens a phone sheet
 * at one height whatever it holds, for a sheet whose content changes with
 * where it is opened (the pay sheet: one button inside a wallet, the list of
 * wallets anywhere else).
 *
 * A phone sheet keeps at least 16px under its last button: a wallet's in-app
 * browser (Phantom, 1-Oct-2026) reports no bottom safe area, and the button
 * sat on the screen's edge.
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

/**
 * The page behind a modal holds still. `overflow: hidden` alone does not do
 * it in iOS Safari, which scrolls the document under a finger anyway: the
 * body is pinned (`position: fixed` at minus the scroll) and the scroll put
 * back where it was when the last modal closes.
 */
let locked: { y: number; style: Partial<CSSStyleDeclaration>; htmlOverscroll: string } | null = null;

function lockPage() {
  if (locked) return;
  const body = document.body;
  const y = window.scrollY;
  locked = {
    y,
    style: { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow },
    htmlOverscroll: document.documentElement.style.overscrollBehavior,
  };
  body.style.position = "fixed";
  body.style.top = `-${y}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  document.documentElement.style.overscrollBehavior = "none";
}

function unlockPage() {
  if (!locked) return;
  const { y, style, htmlOverscroll } = locked;
  locked = null;
  Object.assign(document.body.style, style);
  document.documentElement.style.overscrollBehavior = htmlOverscroll;
  window.scrollTo(0, y);
}

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
  tall = false,
  float = false,
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
  /** A phone sheet that opens at one height, whatever it holds. */
  tall?: boolean;
  /**
   * The app's floating sheet (12-Nov-2026): 8px off the screen's edges, 44px
   * corners, dark glass over a lighter, barely blurred backdrop, and a lit
   * hairline round its edge. The pay page's sheets.
   */
  float?: boolean;
}) {
  const t = useT();
  const id = useId();
  const titleId = `${id}-title`;
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"in" | "open" | "out">("in");
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
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
    if (!stack.length) lockPage();
    stack.push(id);
    const before = document.activeElement as HTMLElement | null;
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
      if (!stack.length) unlockPage();
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

  /*
   * Dragging it down, from anywhere on the sheet, as a native sheet does.
   * It was the head only, and on the floating sheet the head is just the
   * grab handle: a finger on the sheet's face moved nothing (18-Nov-2026).
   * A drag starts only downwards, only when what is under the finger is
   * scrolled to its top, and a sideways move or a tap is left alone. Touch
   * listeners, not pointer ones: the body scrolls (`touch-pan-y`), so the
   * browser cancels pointer events the moment a finger moves, and only a
   * non-passive touchmove can take the gesture back.
   */
  useEffect(() => {
    const el = panel.current;
    if (!mounted || !el || size === "full" || bare) return;
    if (window.matchMedia("(min-width: 640px)").matches) return;

    let start: { x: number; y: number; t: number; scroller: HTMLElement | null } | null = null;
    let active = false;

    const scrollerOf = (node: EventTarget | null): HTMLElement | null => {
      let n = node instanceof HTMLElement ? node : null;
      while (n && n !== el) {
        if (n.scrollHeight > n.clientHeight + 1) {
          const oy = getComputedStyle(n).overflowY;
          if (oy === "auto" || oy === "scroll") return n;
        }
        n = n.parentElement;
      }
      return null;
    };

    const onStart = (e: TouchEvent) => {
      if (busyRef.current || closing.current || e.touches.length !== 1) {
        start = null;
        return;
      }
      const tch = e.touches[0];
      start = { x: tch.clientX, y: tch.clientY, t: performance.now(), scroller: scrollerOf(e.target) };
      active = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const tch = e.touches[0];
      const dy = tch.clientY - start.y;
      const dx = tch.clientX - start.x;
      if (!active) {
        if (Math.abs(dy) < 3 && Math.abs(dx) < 3) return; // a tap's jitter
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || (start.scroller && start.scroller.scrollTop > 0)) {
          start = null; // a scroll or a swipe sideways: not ours
          return;
        }
        active = true;
        setDragging(true);
      }
      if (e.cancelable) e.preventDefault();
      setDrag(dy > 0 ? dy : -Math.sqrt(-dy) * 2);
    };
    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s || !active) return;
      active = false;
      setDragging(false);
      const tch = e.changedTouches[0];
      const dy = tch ? tch.clientY - s.y : 0;
      const v = dy / Math.max(1, performance.now() - s.t);
      setDrag(0);
      if (dy > DRAG_CLOSE_PX || (dy > 24 && v > DRAG_CLOSE_VELOCITY)) close();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [mounted, size, bare, close]);

  if (!mounted) return null;

  const shown = phase === "open";
  const full = size === "full";
  const floating = float && !full && !bare;
  const surface = bare
    ? ""
    : floating
      ? "bg-[rgba(13,24,32,0.66)] backdrop-blur-[40px] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_30px_80px_rgba(0,0,0,0.5)]"
      : "bg-[linear-gradient(180deg,#122C36_0%,#0A1921_55%,#08151C_100%)] shadow-[0_-12px_48px_rgba(0,0,0,0.45)] sm:shadow-[0_24px_70px_rgba(0,0,0,0.55)]";

  const head = (
    <div
      className={`relative shrink-0 touch-none select-none ${bare ? "" : "px-4"}`}
    >
      {!bare && !floating ? <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/[0.16] sm:rounded-t-[24px]" /> : null}
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
          className={`absolute right-3 ${full ? "top-3" : "top-4 sm:top-3.5"} flex h-9 w-9 items-center justify-center rounded-[18px] bg-white/[0.06] text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-40 ${full ? "" : floating ? "hidden sm:flex" : "max-sm:hidden"}`}
        >
          <Ion name="close" size={19} />
        </button>
      ) : null}
    </div>
  );

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex ${full ? "items-stretch sm:items-center" : "items-end sm:items-center"} justify-center sm:p-4 ${floating ? "p-2 pb-[max(8px,env(safe-area-inset-bottom))]" : ""}`}
      role="presentation"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("common.close")}
        onClick={close}
        className={`absolute inset-0 cursor-default transition-opacity duration-300 ${floating ? "bg-[rgba(4,10,18,0.22)] backdrop-blur-[5px] backdrop-saturate-[1.15]" : "bg-[#02070c]/60 backdrop-blur-[3px]"} ${shown ? "opacity-100" : "opacity-0"}`}
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
          full
            ? "h-[100dvh] sm:h-[min(820px,90dvh)] sm:rounded-[24px]"
            : floating
              ? `max-h-[calc(100dvh-16px)] rounded-[44px] pb-2 sm:max-h-[88dvh] sm:rounded-[36px] ${tall ? "max-sm:h-[min(620px,calc(100dvh-24px))]" : ""}`
              : `max-h-[92dvh] rounded-t-[28px] pb-[max(env(safe-area-inset-bottom),16px)] sm:max-h-[88dvh] sm:rounded-[24px] sm:pb-0 ${tall ? "max-sm:h-[min(600px,82dvh)]" : ""}`
        } ${bare ? "bg-transparent" : floating ? "" : "sm:border sm:border-white/[0.1]"} ${
          shown ? "opacity-100" : `${full ? "translate-y-[6%]" : "translate-y-full"} opacity-100 sm:translate-y-3 sm:scale-[0.98] sm:opacity-0`
        } motion-reduce:!transition-none`}
      >
        {floating ? (
          // The lit hairline: brighter at the top, faint down the sides, a glint at the foot.
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] p-px [background:linear-gradient(180deg,rgba(255,255,255,0.30)_0%,rgba(255,255,255,0.08)_35%,rgba(255,255,255,0.05)_70%,rgba(255,255,255,0.14)_100%)] [mask-composite:exclude] [-webkit-mask-composite:xor] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]"
          />
        ) : null}
        {head}
        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y [&>*]:shrink-0 ${bare ? "" : floating ? "gap-3 px-[18px] pb-3" : "gap-3 px-4 pb-4"}`}>{children}</div>
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

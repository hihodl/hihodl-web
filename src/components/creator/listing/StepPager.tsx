/**
 * One step, one card, moved left and right — with the next one showing at the
 * edge. The app's `WizardPager`
 * (hihodl-wallet/src/features/ad-space/components/wizard/WizardPager.tsx), on
 * the web.
 *
 * WHY THE NEIGHBOUR HAS TO PEEK
 *
 * The app learned this the hard way with `react-native-pager-view`: a pager
 * lays each page out at the full width of its viewport and clips the rest, and
 * a page with no visible neighbour has no affordance at all — the first step
 * reads as a screen and the creator waits for a button. So the card is
 * narrower than the track by `PEEK` on each side, and the card next door shows
 * `PEEK - GAP` of itself. That strip is the whole point. It is the card behind
 * the card in a wallet.
 *
 * WHY THE SNAP IS CSS AND NOT ARITHMETIC
 *
 * The app snaps with `snapToInterval` because a ScrollView has nothing else.
 * A browser has `scroll-snap-type`, which does the same job with none of the
 * measuring, and keeps the trackpad, the touch swipe and the scrollbar all
 * landing in the same places. The arithmetic here is only ever used to say
 * WHICH card landed, and to move to one the screen asked for.
 *
 * FORWARD IS EARNED, BACKWARDS IS FREE
 *
 * A step may only be passed once its own checks pass, and that is enforced by
 * what is MOUNTED: the track holds cards 0…`unlocked`, so there is physically
 * nothing to the right of a step that has not passed — the content ends, and
 * so does the scroll. `unlocked` is computed live from the draft, so filling
 * in the last missing field makes the next card appear at the edge under the
 * hand. A card the creator is already standing on is never unmounted from
 * under them: a field cleared after arriving pulls `unlocked` back, not the
 * floor.
 *
 * The footer action is still the way forward — it is what saves the draft.
 * The arrows, the arrow keys and the swipe are the shortcut for somebody who
 * has already filled the step in.
 */

"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import { Ion } from "@/components/app/ion";
import { useT } from "@/lib/app/i18n/react";

/**
 * How much of the neighbouring card shows at each edge, and the air between
 * two cards. What is actually SEEN of the neighbour is the difference: the gap
 * is behind the sliver, not next to it.
 */
const PEEK = 16;
const GAP = 6;

/**
 * A scrollbar inside a card is a line down the card, and on a phone it lands
 * on top of the content. The track hides its own; so does everything that
 * scrolls in here, for the same reason.
 */
const NO_SCROLLBAR = "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** How long after the last scroll event a landing counts as settled. */
const SETTLE_MS = 110;

export function StepPager({
  index,
  unlocked,
  onIndexChange,
  label,
  children,
}: {
  /** The card on screen. */
  index: number;
  /** The last card that may be reached: every check before it passes. */
  unlocked: number;
  onIndexChange: (next: number) => void;
  /** What the head says between the two arrows. */
  label: ReactNode;
  /** One node per step, in step order. */
  children: ReactNode[];
}) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  // Where the TRACK is, which is not the same thing as where the screen thinks
  // it is: between a swipe landing and the screen's state catching up, and for
  // the whole of a move the screen asked for, the two differ.
  const at = useRef(index);
  const settling = useRef<number | null>(null);

  // Never fewer cards than we are standing on: a field cleared after arriving
  // lowers `unlocked`, and unmounting the card under the creator is not the
  // feedback that deserves.
  const count = Math.min(children.length, Math.max(unlocked, index) + 1);
  const cards = children.slice(0, count);

  useEffect(() => {
    const el = track.current;
    // Already there — which is every swipe, since the swipe is what set
    // `index`. Only a jump the screen asked for (a refusal, Next, Back) moves
    // the track.
    if (!el || index >= count || at.current === index) return;
    at.current = index;
    el.scrollTo({ left: index * Math.max(1, el.clientWidth - PEEK * 2 + GAP), behavior: "smooth" });
  }, [index, count]);

  useEffect(() => () => {
    if (settling.current !== null) window.clearTimeout(settling.current);
  }, []);

  const onScroll = useCallback(() => {
    if (settling.current !== null) window.clearTimeout(settling.current);
    settling.current = window.setTimeout(() => {
      const el = track.current;
      if (!el) return;
      const interval = Math.max(1, el.clientWidth - PEEK * 2 + GAP);
      const landed = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / interval)));
      if (landed === at.current) return;
      at.current = landed;
      onIndexChange(landed);
    }, SETTLE_MS);
  }, [count, onIndexChange]);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      if (clamped !== at.current) onIndexChange(clamped);
    },
    [count, onIndexChange],
  );

  /** Arrow keys move between cards, except inside something being typed into. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
    e.preventDefault();
    go(at.current + (e.key === "ArrowRight" ? 1 : -1));
  };

  const canBack = index > 0;
  const canNext = index < count - 1;

  return (
    <div className="flex min-w-0 flex-col gap-2" onKeyDown={onKeyDown}>
      {/* The app's calendar head, doing the same job: an arrow, where you are, an arrow. */}
      <div className="flex items-center gap-2">
        <Arrow name="chevron-back" label={t("listings.pager.previousStep")} on={canBack} onClick={() => go(index - 1)} />
        <p className="min-w-0 flex-1 truncate text-center text-[12.5px] font-bold text-white/[0.62]">{label}</p>
        <Arrow name="chevron-forward" label={t("listings.pager.nextStep")} on={canNext} onClick={() => go(index + 1)} />
      </div>

      <div
        ref={track}
        onScroll={onScroll}
        role="group"
        aria-label={t("listings.pager.steps")}
        className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain ${NO_SCROLLBAR}`}
        // The track carries the peek as padding, so the first and last cards
        // sit the same distance in as every other one, and the snap lands on
        // that same inset rather than on the track's own edge.
        style={{ paddingLeft: PEEK, paddingRight: PEEK, gap: GAP, scrollPaddingLeft: PEEK, height: TRACK_HEIGHT }}
      >
        {cards.map((card, i) => (
          <div
            key={i}
            className="h-full shrink-0 snap-start"
            // 100% of the track's CONTENT box, which the padding above has
            // already made `clientWidth - PEEK * 2` wide — so the card is
            // exactly one PEEK in from each edge and the neighbour shows
            // `PEEK - GAP` of itself, as designed.
            //
            // This said `calc(100% - PEEK * 2)`, which takes the peek off
            // TWICE: a percentage on a flex item resolves against the content
            // box, not the border box. The card came out 2 × PEEK too narrow,
            // the strip of the next card was four times what it should be, and
            // worse, `interval` below is computed for the correct width — so
            // every card compounded the error and the pager started landing on
            // the wrong step further right.
            style={{ width: "100%", scrollMarginLeft: PEEK }}
          >
            {card}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The track's height, and so every card's.
 *
 * `--app-vh` is the shell's own corrected viewport height (it divides out the
 * CSS zoom the dashboard scales itself with); the clamp keeps the card from
 * collapsing on a short window or stretching on a tall one. A step is meant to
 * fit inside this — when one does not, the card scrolls rather than clip, the
 * same degradation the app's `WizardPage` makes.
 */
const TRACK_HEIGHT = "clamp(400px, calc(var(--app-vh, 100dvh) - 248px), 720px)";

function Arrow({
  name,
  label,
  on,
  onClick,
}: {
  name: "chevron-back" | "chevron-forward";
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!on}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] border border-white/[0.14] bg-white/[0.06] text-white transition-colors hover:bg-white/[0.12] disabled:opacity-40 disabled:hover:bg-white/[0.06]"
    >
      <Ion name={name} size={18} />
    </button>
  );
}

/**
 * The inside of one card: a heading, at most one line of help, and the step.
 *
 * One line, because the wall of prose is what this rebuild is for. If a step
 * needs a paragraph to be understood, the step is asking the wrong question.
 */
export function StepCard({
  title,
  help,
  children,
}: {
  title: string;
  /** One sentence. There is deliberately no room for a second. */
  help?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={`flex h-full min-w-0 flex-col gap-3.5 overflow-y-auto overscroll-contain rounded-[20px] border border-white/10 bg-white/[0.045] p-4 ${NO_SCROLLBAR}`}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-extrabold tracking-[-0.3px] text-white">{title}</h2>
        {help ? <p className="text-[13px] leading-[18px] text-white/[0.62]">{help}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-3.5">{children}</div>
    </section>
  );
}

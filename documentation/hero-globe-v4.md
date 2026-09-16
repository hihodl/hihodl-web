# Hero globe v4

A candidate replacement for the homepage hero globe. Branch: `feat/hero-globe-v4`.

Preview it at `/lab/hero-globe` (`npm run dev`). Nothing on the live site changed.

## What landed

| File | What it is |
| --- | --- |
| `prototypes/hold-hero-globe.html` | The original prototype bundle, unmodified, as the design reference. |
| `src/components/site/HeroGlobe.tsx` | The prototype ported to a Next.js client component. |
| `src/app/lab/hero-globe/page.tsx` | Preview harness. Not linked, `noindex`. |

## v4 against the live globe

`PaymentGlobe` still owns the homepage hero. v4 differs in four ways:

- **Glass land, not flat fill.** Landmasses carry a specular sheen, a drop shadow
  and a dark "water moat" stroke that keeps neighbouring coastlines from merging
  into one blob.
- **Coastlines clipped against the limb.** A landmass crossing the edge of the
  disc is split into visible runs and closed along the sphere's edge, so nothing
  smears across the horizon.
- **Non-uniform spin.** The globe races across the empty Pacific and slows over
  land, so the interesting half is on screen longer.
- **Currency bubbles.** A glass card pops where each payment lands, carrying the
  amount and the corridor.

Both are pure SVG and maths. v4 adds **no dependencies**.

## Porting notes

The prototype ran inside an animation rig, so four things had to change. The
first is a straight substitution; the rest are web-specific requirements the rig
never had.

1. **Clock.** The rig's `useComposition()` supplied authored seconds. Replaced
   with a `requestAnimationFrame` clock, delta-clamped so a backgrounded tab
   does not jump the animation forward on return.
2. **Reduced motion.** `prefers-reduced-motion: reduce` freezes the globe at a
   composed still (`STILL_T`) rather than spinning indefinitely.
3. **Off-screen pause.** An `IntersectionObserver` stops the rAF loop when the
   hero is scrolled away.
4. **Responsive scaling.** The bubbles are positioned in stage pixels, so the
   whole 1920x1080 stage is scaled as one unit by a `ResizeObserver` instead of
   letting the SVG scale on its own. Scaling only the SVG would leave the
   bubbles behind.

The caption is opt-in (`showCaption`, default off) — the page hero owns its copy,
and the prototype's built-in headline would duplicate it.

### Performance

The prototype rebuilt all its geometry every frame. Two changes, neither of which
alters a single pixel:

- Densifying a coastline and walking a great-circle arc both happen in lat/lon
  space, so neither depends on the rotation. Both are now precomputed once at
  module load.
- `project()` takes sin/cos of `(lon + rot)`. Expanding that with the
  angle-addition identity separates the point from the rotation, so each land
  point reduces to three constants and the frame needs one `cos` and one `sin`
  in total instead of four trig calls per point.

Measured on the land geometry (3,840 points per frame), warm, interleaved,
median of five runs:

| | per frame |
| --- | --- |
| Prototype | 18.00 ms |
| Ported | 5.24 ms |

The 60fps budget is 16.7ms per frame, so the prototype as written could not hold
60fps on geometry alone, before React reconciliation or paint. The port leaves
roughly 11ms of headroom.

Both changes are algebraically exact rather than approximations, and that was
verified rather than assumed: across a full revolution, all 7,700 emitted land
path strings are byte-identical to the prototype's, and the 1,696 arc sample
points match to within 1e-9.

## Adopted in the homepage hero

The hero now mounts v4. Two things it needed that a straight import did not give:

**A square window.** The hero's globe slot is `aspect-square max-w-md`. Dropping
a 16:9 stage into it letterboxes, leaving the globe at 48% of the slot width.
`fit="globe"` crops to a 1020x1020 window centred on the disc, which puts the
globe at 90% — roughly double the diameter. `fit="stage"` keeps the prototype's
full 16:9 frame for any future full-bleed slot.

**Bubbles off, cards on.** The globe's bubbles are sized for a 1920px stage; in
a 448px slot they scale to roughly half the size the hero's own glass cards read
at. So the hero keeps its two cards and the bubbles stay at `/lab/hero-globe`,
where the stage is full width.

## Payment cards

The hero's two glass cards used to be static — "Salary received" and a gasless
swap, revealed once by the GSAP intro and then frozen for the rest of the visit.
They are now slots that turn over as payments land on the globe.

**One clock.** `useGlobeClock` is exported and the hero owns it, passing the
same `T` to `HeroGlobe` and to both cards. Two clocks would each accumulate
their own rounding and slide apart, and a card that turns over half a second
after its arc lands looks like a bug.

**Two animations, two elements.** The GSAP intro animates the wrapper; the card
inside animates its own opacity and lift. Sharing one element would put the
intro and the cycle in a fight over one `opacity`.

**No state.** A card derives everything from the clock: which payment its slot
is showing, how long ago that payment landed, and how long until the slot turns
over. So it is correct on any frame it happens to mount on, including the
reduced-motion still.

**Slot allocation.** Landings are dealt to the two slots in strict alternation,
which is what keeps one slot holding while the other swaps. A slot holds its
payment until the next one dealt to it lands, so both cards are always
populated — a hero that goes card-less between payments reads as a loading
state. Verified over the cycle: no blank frame, and no slot ever asked to show
two payments at once.

Two of the eight flows carry `card: false`. They land in the crowded tail of the
cycle, where a card would get about a second on screen; skipping them lifts the
shortest hold from 1.9s to 3.4s. They still fly, and still pop a bubble at
`/lab/hero-globe`.

| Lands at | Slot | Card |
| --- | --- | --- |
| 0.40s | top | Interest earned · +9.20 USD · on your Savings balance |
| 3.67s | bottom | Salary received · +3,200 USD · San Francisco → Madrid |
| 5.66s | top | Payment received · +4.2M COP · Bogotá → Dubai |
| 7.46s | bottom | Interest earned · +25.40 USD · on your Savings balance |
| 9.07s | top | Invoice paid · +1,450 EUR · Berlin → Lagos |
| 11.06s | bottom | Payment received · +8,400 BRL · São Paulo → Singapore |

### Contrast

Two of the design tokens the cards started with do not survive this hero's
background. The section paints `#2C4566 → #4F7090 → #2C4566` and the cards are
glass, so the type is effectively sitting on brand blue:

| Line | Was | On `#4F7090` | Now |
| --- | --- | --- | --- |
| Kicker, top slot | `moonlight` `#5B7CFF` | 1.43:1 | `amber`, 2.97:1 |
| Corridor / note | `text-faint` `#5A6068` | 1.22:1 | `text` `#F4F6FA`, 4.73:1 |

Both were effectively invisible. Worth knowing that these are palette tokens,
not one-offs — anything else that puts `text-faint` on a brand-blue ground has
the same problem.

Both kickers are amber now, so the accent no longer distinguishes the slots. It
does not need to: they are in opposite corners. And the note goes full white
rather than a lighter grey, because hierarchy here already comes from size — the
amount above it is an `h4` and the note is `text-tiny`.

### The count-up

One card counts its amount up on arrival: Salary received, once per 14s cycle.

The restraint is the point. A count-up on every card fires every three or four
seconds forever, a few hundred pixels from the headline and the download button,
and stops reading as a flourish and starts reading as a tic. Once a cycle it
stays an event.

Three details:

- **Cubic easing, not exponential.** An expo count-up is inside 5% of its target
  by the time the card has finished fading in, so the remaining half second
  reads as a number that has stalled rather than one still arriving.
- **The width is reserved up front**, in `ch` against the already-monospaced
  digits, so the currency beside it does not slide as the number grows past each
  thousands separator.
- **Only plain figures roll.** `+4.2M` and `+25.40` render as authored — a
  count-up that has to invent a format is one that will eventually print
  something the copy never said.

Verified over the cycle: exactly one card rolls, the count-up is monotonic,
never overshoots the authored figure, never exceeds its reserved width, and the
reduced-motion still does not land mid-roll.

### On the figures

These are illustrative, and nothing here is read from an account or a rate. Two
rules keep them from reading as quotes, and both are worth holding to if the
copy is rewritten:

- **One currency per card.** A pair (`$3,200 → €2,940`, as the prototype had)
  implies an FX rate, which we would then have to keep true.
- **No APY on the interest cards.** A rate on the homepage is a promise.

Both were checked across the whole set before this landed, along with the
absence of any swap card.

## Open questions

- `backdrop-filter` on the bubbles is the one expensive paint. Worth checking on
  a low-end Android before the bubbles go anywhere near production.
- `/lab/hero-globe` is a public route. `noindex`, unlinked, but not auth-gated —
  worth removing before it matters.

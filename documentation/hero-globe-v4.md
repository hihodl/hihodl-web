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
  corridor and the two amounts (`$3,200 → €2,940`).

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

**Bubbles off.** The hero already renders two glass cards ("Salary received",
"Gasless swap"), animated in by its GSAP intro. The globe's bubbles use the same
visual language, so running both puts two card systems in the same 448px. The
hero keeps its own cards; the bubbles show at `/lab/hero-globe`.

If we later want the bubbles instead, that means deleting those two cards and
their timeline steps from `Hero.tsx` — a design call, not a mechanical one.

### Bubble copy

The prototype's amounts (`+$142.60`, `9 nights → $412`, `$3,200 → €2,940`) were
invented to dress the animation. On a financial product's homepage an invented
number reads as a real transaction, so the bubbles now carry the corridor and
nothing that resembles a quote, a rate or a balance:

| Kicker | Shows |
| --- | --- |
| Freelance invoice · Madrid | USD → EUR |
| Sent · Bogotá → Dubai | COP → AED |
| Interest earned · Savings | USD |
| eSIM · Brazil | Paid |
| Stay booked · Thailand | Paid |
| USD account payout | EUR → USD |
| Salary · paid in dollars | USD |
| Rent sent · São Paulo | BRL → USD |

This is a holding state, not final copy. Replace it with real copy — not with
plausible copy.

## Open questions

- `backdrop-filter` on the bubbles is the one expensive paint. Worth checking on
  a low-end Android before the bubbles go anywhere near production.
- `/lab/hero-globe` is a public route. `noindex`, unlinked, but not auth-gated —
  worth removing before it matters.

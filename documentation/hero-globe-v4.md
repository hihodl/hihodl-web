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

## To adopt it

In `src/components/site/Hero.tsx`, swap the `PaymentGlobe` import and usage for
`HeroGlobe`. Keep `showCaption` off — the hero already renders its own headline.
Decide separately whether the bubble copy is the messaging we want, since it
names specific corridors and amounts.

## Open questions

- Bubble copy is prototype placeholder (`Stay booked · Thailand`, `+$142.60`).
  It needs a marketing pass before it goes near production.
- `backdrop-filter` on the bubbles is the one expensive paint. Worth checking on
  a low-end Android before shipping.
- v4 is 1920x1080 and letterboxes on narrow viewports. If it becomes the hero,
  the mobile crop needs a look — the current hero handles that differently.

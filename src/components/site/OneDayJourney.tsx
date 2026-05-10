"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useReducedMotion, MotionValue } from "framer-motion";

/**
 * OneDayJourney — scroll-pinned scene with real device frame + real app screens.
 *
 * The device frame (PNG with transparent bezel) is sticky-pinned in the viewport.
 * Inside the screen hole, real app screenshots crossfade as the user scrolls.
 *
 * Screen hole geometry was measured from /public/screens/device.png:
 *   left:   22.09%
 *   top:     7.05%
 *   width:  55.71%
 *   height: 80.25%
 */

// Screen layer geometry. Two constraints:
//   1) Aspect must match screenshot (0.4614) so objectFit:fill doesn't stretch.
//      → HOLE_WIDTH_PCT / HOLE_HEIGHT_PCT must equal 0.4614 / (919/1362) = 0.6839
//   2) Inset ~5-8px inside the true bezel hole on every side so corner curves
//      always sit under the bezel, never poke out at high zoom.
// Device PNG real hole: x=[203,716] y=[94,1190] (513×1096). We render 500×1083.
const HOLE_LEFT = 22.82;
const HOLE_TOP = 7.3;
const HOLE_WIDTH = 54.37;
const HOLE_HEIGHT = 79.5;

type Scene = {
  time: string;
  timeLabel: string;
  eyebrow: string;
  title: string;
  body: string;
  src: string;
};

// 3 scenes for now — 4th (overview) lands later and slots into the night frame.
const SCENES: Scene[] = [
  {
    time: "07:14",
    timeLabel: "morning",
    eyebrow: "07:14",
    title: "Wake up. Open the wallet.",
    body: "Your @username, your balance, your accounts. No long addresses, no chains to pick. Just money.",
    src: "/screens/screen-home.png",
  },
  {
    time: "09:32",
    timeLabel: "midday",
    eyebrow: "09:32",
    title: "Swap with zero gas.",
    body: "USDG into SOL in two taps. Network fee: free. The first $500 of swap volume each month is on us.",
    src: "/screens/screen-exchange.png",
  },
  {
    time: "13:07",
    timeLabel: "afternoon",
    eyebrow: "13:07",
    title: "Income lands. Privately.",
    body: "Stablecoins arrive at fresh, unlinkable addresses across Solana, Base and Polygon. You see clean activity. Nobody else does.",
    src: "/screens/screen-activity.png",
  },
];

export function OneDayJourney() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Background tint shifts cool -> warm as scroll progresses
  const bgWarm = useTransform(scrollYProgress, [0, 0.5, 1], [0.05, 0.18, 0.32]);
  const bgCool = useTransform(scrollYProgress, [0, 0.5, 1], [0.32, 0.18, 0.05]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-abyss"
      style={{ height: reduced ? "auto" : `${SCENES.length * 100}vh` }}
      aria-label="A day in the life with HIHODL"
    >
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        {/* Animated background */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(50% 60% at 18% 30%, rgba(91,124,255,0.20), transparent 70%), radial-gradient(50% 60% at 82% 80%, rgba(255,183,3,0.18), transparent 70%)",
          }}
        />
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            background:
              "radial-gradient(60% 80% at 80% 100%, rgba(255,183,3,0.35), transparent 70%)",
            opacity: bgWarm,
          }}
        />
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            background:
              "radial-gradient(60% 80% at 20% 0%, rgba(91,124,255,0.35), transparent 70%)",
            opacity: bgCool,
          }}
        />

        <div className="container-page relative w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* LEFT — title + scrubbing copy */}
            <div className="lg:col-span-5 xl:col-span-4">
              <p className="text-tiny uppercase tracking-wider text-moonlight">
                A day · Earn globally · Live locally
              </p>
              <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text leading-tight">
                One scroll.
                <br />
                Sunrise to sleep.
              </h2>

              <div className="mt-12 relative h-[200px]">
                {SCENES.map((scene, i) => {
                  const start = i / SCENES.length;
                  const end = (i + 1) / SCENES.length;
                  const fadeIn = i === 0 ? start : start - 0.05;
                  const fadeOut = i === SCENES.length - 1 ? end : end + 0.05;
                  return (
                    <CopyBlock
                      key={scene.time}
                      scene={scene}
                      progress={scrollYProgress}
                      fadeIn={fadeIn}
                      start={start}
                      end={end}
                      fadeOut={fadeOut}
                    />
                  );
                })}
              </div>

              <ProgressBar progress={scrollYProgress} />
            </div>

            {/* RIGHT — device frame with crossfading screens */}
            <div className="lg:col-span-7 xl:col-span-8 flex justify-center lg:justify-end">
              <DeviceStage progress={scrollYProgress} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Device stage — fixed device.png, real screens crossfading inside
 * ───────────────────────────────────────────────────────────── */

function DeviceStage({ progress }: { progress: MotionValue<number> }) {
  return (
    <div
      className="relative"
      style={{
        // height is the only fixed dimension; width derives from aspect-ratio
        // so container == device.png aspect exactly. This keeps the % hole
        // coords aligned with the real bezel pixels (no objectFit pillar-box).
        height: "min(88vh, 900px)",
        aspectRatio: "919 / 1362",
        maxWidth: "100%",
      }}
    >
      {/* Soft glow under device */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 60%, rgba(91,124,255,0.20), transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Screens layer — sits BEHIND the device frame, aligned to the screen hole */}
      <div
        className="absolute overflow-hidden rounded-[12.5%/5.8%]"
        style={{
          left: `${HOLE_LEFT}%`,
          top: `${HOLE_TOP}%`,
          width: `${HOLE_WIDTH}%`,
          height: `${HOLE_HEIGHT}%`,
        }}
      >
        {SCENES.map((scene, i) => (
          <ScreenLayer
            key={scene.src}
            src={scene.src}
            index={i}
            total={SCENES.length}
            progress={progress}
          />
        ))}
      </div>

      {/* Device frame on top — the transparent screen reveals the layers below */}
      <Image
        src="/screens/device.png"
        alt=""
        fill
        priority
        sizes="(min-width: 1280px) 640px, (min-width: 1024px) 50vw, 80vw"
        className="relative pointer-events-none select-none"
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}

function ScreenLayer({
  src,
  index,
  total,
  progress,
}: {
  src: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  // Each scene owns a window of scroll progress. Crossfade with neighbors.
  const start = index / total;
  const end = (index + 1) / total;
  const opacity = useTransform(
    progress,
    [
      Math.max(0, start - 0.08),
      start,
      end,
      Math.min(1, end + 0.08),
    ],
    [0, 1, 1, 0],
  );

  return (
    <motion.div className="absolute inset-0" style={{ opacity }}>
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1280px) 360px, (min-width: 1024px) 28vw, 45vw"
        className="select-none"
        style={{ objectFit: "fill" }}
      />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Scrubbing copy — crossfade as scroll progresses
 * ───────────────────────────────────────────────────────────── */

function CopyBlock({
  scene,
  progress,
  fadeIn,
  start,
  end,
  fadeOut,
}: {
  scene: Scene;
  progress: MotionValue<number>;
  fadeIn: number;
  start: number;
  end: number;
  fadeOut: number;
}) {
  const opacity = useTransform(progress, [fadeIn, start, end, fadeOut], [0, 1, 1, 0]);
  const y = useTransform(progress, [fadeIn, start, end, fadeOut], [16, 0, 0, -16]);
  return (
    <motion.div className="absolute inset-0" style={{ opacity, y }}>
      <p className="text-tiny font-mono text-amber uppercase tracking-wider">
        {scene.eyebrow} · {scene.timeLabel}
      </p>
      <h3 className="mt-3 font-display text-h3 font-light text-text leading-tight">
        {scene.title}
      </h3>
      <p className="mt-3 text-body text-text-muted">{scene.body}</p>
    </motion.div>
  );
}

function ProgressBar({ progress }: { progress: MotionValue<number> }) {
  const width = useTransform(progress, [0, 1], ["0%", "100%"]);
  return (
    <div className="mt-8 hidden lg:block">
      <div className="h-px bg-white/[0.08] relative overflow-hidden rounded-full max-w-[200px]">
        <motion.div
          className="absolute left-0 top-0 h-full bg-text-muted"
          style={{ width }}
        />
      </div>
      <p className="mt-3 text-tiny font-mono text-text-faint">Scroll to advance the day</p>
    </div>
  );
}

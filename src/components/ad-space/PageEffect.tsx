"use client";

import { useEffect, useRef } from "react";

import type { PageEffect as Effect } from "@/lib/ad-space/studio";

/**
 * The one subtle layer a creator may put over their page: sparkles, confetti,
 * petals or snow. Off by default, and built to never be the thing you notice:
 *
 * - it drifts over the page, never under it: under the content the banner
 *   and the cards covered it, and on a phone the creator saw no effect at
 *   all (Alex, 4-Oct-2026). Over it, it stays click-through and soft enough
 *   to read through;
 * - few particles (22 to 34), half opacity, slow, and capped at 30 frames a
 *   second on a canvas no denser than 2x;
 * - nothing at all under `prefers-reduced-motion`, and the loop stops while
 *   the tab is hidden;
 * - pointer-events none, aria-hidden, no dependency.
 */

type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; t: number; c: string };

const COUNT: Record<Exclude<Effect, "none">, number> = { sparkles: 22, confetti: 28, petals: 22, snow: 34 };

export function PageEffect({ effect, light = false }: { effect: Effect; light?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (effect === "none" || !canvas) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ink = light ? "15,53,85" : "244,246,250";
    const palette =
      effect === "confetti"
        ? ["255,183,3", "142,202,230", ink]
        : effect === "petals"
          ? ["255,183,197", "255,214,224"]
          : [ink];
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const spawn = (anywhere: boolean): P => ({
      x: rnd(0, w),
      y: anywhere || effect === "sparkles" ? rnd(0, h) : rnd(-40, -8),
      vx: effect === "petals" ? rnd(0.15, 0.45) : rnd(-0.12, 0.12),
      vy: effect === "sparkles" ? 0 : effect === "snow" ? rnd(0.25, 0.6) : rnd(0.45, 0.9),
      r: effect === "snow" ? rnd(1.6, 3.4) : effect === "sparkles" ? rnd(2.2, 4.2) : rnd(4, 7),
      a: rnd(0, Math.PI * 2),
      t: rnd(0, Math.PI * 2),
      c: palette[Math.floor(Math.random() * palette.length)],
    });
    const ps: P[] = Array.from({ length: COUNT[effect] }, () => spawn(true));

    const draw = (p: P) => {
      if (effect === "sparkles") {
        const o = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(p.t));
        ctx.fillStyle = `rgba(${p.c},${o})`;
        ctx.beginPath();
        // A four-point star: two thin diamonds crossed.
        ctx.moveTo(p.x, p.y - p.r * 2);
        ctx.lineTo(p.x + p.r * 0.4, p.y);
        ctx.lineTo(p.x, p.y + p.r * 2);
        ctx.lineTo(p.x - p.r * 0.4, p.y);
        ctx.moveTo(p.x - p.r * 2, p.y);
        ctx.lineTo(p.x, p.y + p.r * 0.4);
        ctx.lineTo(p.x + p.r * 2, p.y);
        ctx.lineTo(p.x, p.y - p.r * 0.4);
        ctx.fill();
        return;
      }
      ctx.fillStyle = `rgba(${p.c},${effect === "snow" ? 0.6 : 0.5})`;
      if (effect === "snow") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      if (effect === "confetti") {
        ctx.scale(1, Math.cos(p.t));
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return;
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.t += effect === "sparkles" ? 0.05 : 0.04;
        p.a += 0.01;
        p.x += p.vx + (effect === "sparkles" ? 0 : Math.sin(p.t) * 0.25);
        p.y += p.vy;
        if (effect === "sparkles" ? p.t > Math.PI * 6 : p.y > h + 20 || p.x > w + 20) ps[i] = spawn(false);
        draw(ps[i]);
      }
    };
    const start = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotion = () => {
      if (motion.matches) {
        stop();
        ctx.clearRect(0, 0, w, h);
      } else start();
    };

    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener?.("change", onMotion);
    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener?.("change", onMotion);
    };
  }, [effect, light]);

  if (effect === "none") return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-30 h-full w-full" />;
}

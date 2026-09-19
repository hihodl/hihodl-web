"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A scene arriving as you scroll: the image settles from a slight zoom and the
 * line rises in. It runs once per scene, and not at all with reduced motion,
 * where the scene simply renders in place.
 *
 * The scene is visible before hydration and without JS: the hidden state is
 * only applied once this component knows it can reveal it again.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"static" | "waiting" | "shown">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    setState("waiting");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal={state} className={`group/reveal ${className}`}>
      {children}
    </div>
  );
}

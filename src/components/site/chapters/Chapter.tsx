import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

/**
 * A chapter of the homepage: a photo pinned to the screen and a sheet that
 * scrolls up over it, the way the Accounts sheet rises over the card in the
 * app. When the sheet ends the photo shows again, then the next chapter's
 * photo pushes it away.
 *
 * Nothing here takes over touch or scroll. The "drag" is the page scrolling,
 * because a hijacked scroll is the first thing that breaks on iOS Safari.
 *
 * Desktop keeps the same structure: the photo stays full bleed and the sheet
 * becomes a floating card on one side, so there is one component and one
 * breakpoint, not two layouts.
 */

/** Where the photo is anchored, as CSS object-position, per breakpoint. */
export type Focus = { mobile: string; desktop: string };

type Props = {
  id: string;
  photo: string;
  alt: string;
  focus: Focus;
  /** Which side the sheet floats on at desktop width. */
  side?: "left" | "right";
  /** Shown on the photo itself: a headline or a glass card. Pinned with it. */
  overPhoto?: ReactNode;
  /** How much photo is seen before the sheet arrives. `peek` leaves a sliver of sheet on the first screen. */
  lead?: "peek" | "half";
  priority?: boolean;
  /**
   * Mobile only: the photo takes the lower part of the screen and the top is
   * painted in this colour, so a headline has somewhere to sit. Only for a
   * photo whose top edge is a flat wall or sky of that colour.
   */
  groundTop?: string;
  children: ReactNode;
};

export function Chapter({
  id,
  photo,
  alt,
  focus,
  side = "right",
  overPhoto,
  lead = "half",
  priority,
  groundTop,
  children,
}: Props) {
  const position = {
    "--pos-m": focus.mobile,
    "--pos-d": focus.desktop,
  } as CSSProperties;

  return (
    <section id={id} className="relative scroll-mt-0">
      <div
        className="sticky top-0 h-[100svh] overflow-hidden"
        style={groundTop ? { background: groundTop } : undefined}
      >
        <div
          className={
            groundTop
              ? "absolute inset-x-0 bottom-0 h-[74svh] md:h-full [mask-image:linear-gradient(to_bottom,transparent,black_18%)] md:[mask-image:none]"
              : "absolute inset-0"
          }
        >
          <Image
            src={photo}
            alt={alt}
            fill
            priority={priority}
            sizes="100vw"
            className="object-cover [object-position:var(--pos-m)] md:[object-position:var(--pos-d)]"
            style={position}
          />
        </div>
        {/* Enough shade under the nav for the wordmark, nothing more. */}
        <div
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/35 to-transparent pointer-events-none"
          aria-hidden
        />
        {overPhoto && <div className="absolute inset-0">{overPhoto}</div>}
      </div>

      <div className="relative -mt-[100svh] pointer-events-none">
        <div className={lead === "peek" ? "h-[84svh] md:h-[100svh]" : "h-[64svh] md:h-[72svh]"} />
        <div className="container-page">
          <div
            className={`pointer-events-auto mx-auto max-w-[480px] ${
              side === "right" ? "md:mr-0 md:ml-auto" : "md:ml-0 md:mr-auto"
            }`}
          >
            <Sheet>{children}</Sheet>
          </div>
        </div>
        <div className="h-[38svh]" />
      </div>
    </section>
  );
}

function Sheet({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-[28px] border border-white/10 bg-[#0D1520]/[0.92] backdrop-blur-xl shadow-[0_-24px_60px_rgba(0,0,0,0.35)] px-6 pt-3 pb-8 md:px-9 md:pt-9 md:pb-10">
      <div className="mx-auto mb-7 h-1 w-10 rounded-full bg-white/25 md:hidden" aria-hidden />
      {children}
    </div>
  );
}

/* Type inside a sheet. One italic serif word per title is the page's signature. */

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-tiny uppercase tracking-wider text-amber">{children}</p>;
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-4 font-display font-light text-[38px] md:text-[44px] leading-[1.05] tracking-[-0.03em] text-text [&_em]:font-editorial [&_em]:text-[1.06em]">
      {children}
    </h2>
  );
}

export function Body({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-body md:text-[17px] text-text-muted">{children}</p>;
}

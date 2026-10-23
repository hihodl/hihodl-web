import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CtaLink } from "@/components/site/DownloadLink";

/**
 * A close photo (usually hands) with a dark glass panel over it: one message,
 * one line, one white button. The blur is the point, so the photos chosen for
 * it are the busy, textured ones.
 *
 * Where backdrop-filter is missing the panel falls back to a solid dark
 * ground, so the text never sits on bare photo. The secondary text is white
 * at 0.78, which holds 4:1 over the panel even on the lightest photo.
 */
type Props = {
  photo: string;
  alt: string;
  focus?: string;
  eyebrow?: string;
  title: ReactNode;
  body: ReactNode;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  id?: string;
};

export function GlassBanner({ photo, alt, focus = "50% 50%", eyebrow, title, body, cta, secondary, id }: Props) {
  return (
    <section id={id} className="relative bg-abyss px-4 py-4 md:px-6 md:py-6">
      <div className="relative mx-auto flex min-h-[78svh] max-w-[1400px] items-end overflow-hidden rounded-[28px] md:min-h-[640px] md:items-center md:justify-center">
        <Image
          src={photo}
          alt={alt}
          fill
          sizes="(min-width: 1400px) 1400px, 100vw"
          className="object-cover"
          style={{ objectPosition: focus }}
        />
        <div className="relative m-3 w-full rounded-[22px] border border-white/10 bg-[#11161D]/90 px-6 py-8 text-center supports-[backdrop-filter]:bg-[#11161D]/45 supports-[backdrop-filter]:backdrop-blur-[24px] supports-[backdrop-filter]:backdrop-saturate-[1.4] md:m-0 md:max-w-[620px] md:px-12 md:py-12">
          {eyebrow && <p className="text-tiny uppercase tracking-wider text-white/80">{eyebrow}</p>}
          <h2 className="mt-3 font-display font-light text-[34px] md:text-[46px] leading-[1.08] tracking-[-0.03em] text-white [&_em]:font-editorial [&_em]:text-[1.06em]">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-[460px] text-body md:text-[17px] text-white/[0.78]">{body}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <CtaLink
              href={cta.href}
              className="inline-flex items-center justify-center rounded-pill bg-white px-6 py-3 text-body font-medium text-[#0A0500] transition-transform duration-180 ease-out-soft hover:scale-[1.02]"
            >
              {cta.label}
            </CtaLink>
            {secondary && (
              <Link
                href={secondary.href}
                className="inline-flex items-center justify-center rounded-pill border border-white/25 px-6 py-3 text-body font-medium text-white transition-colors duration-180 hover:bg-white/10"
              >
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

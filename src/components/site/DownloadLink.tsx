"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { DOWNLOAD_ANCHOR, SMART_LINK_URL } from "@/lib/appLinks";

type Props = {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
};

/**
 * Resolves to the smart link only for user agents we can positively identify as
 * a phone. Everything else — desktop, tablets, crawlers, JS disabled — keeps the
 * anchor and picks a store from the badges, because go.hihodl.xyz/app 302s
 * Windows and Linux desktop to Google Play regardless of platform.
 *
 * The anchor is what renders on the server, so the fallback is also what any
 * client that never hydrates ends up with.
 */
function useDownloadHref(): string {
  const [href, setHref] = useState(DOWNLOAD_ANCHOR);

  useEffect(() => {
    if (/iPhone|iPod|Android/i.test(navigator.userAgent)) setHref(SMART_LINK_URL);
  }, []);

  return href;
}

/** Primary download CTA — straight to the visitor's store on a phone, to the badges elsewhere. */
export function DownloadLink({ className, children, onClick }: Props) {
  const href = useDownloadHref();

  if (href === DOWNLOAD_ANCHOR) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

/** Download CTA when `href` targets the download section, an ordinary link otherwise. */
export function CtaLink({ href, className, children, onClick }: Props & { href: string }) {
  if (href === DOWNLOAD_ANCHOR) {
    return (
      <DownloadLink className={className} onClick={onClick}>
        {children}
      </DownloadLink>
    );
  }

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

/**
 * `noindex` for the whole verification route.
 *
 * The URL a scanned QR opens carries the document's own figures in its query
 * string. An indexed one would put somebody's balance in a search result, so
 * this is a privacy control and not an SEO preference.
 *
 * robots.txt disallows the prefix as well. Both, because robots.txt only asks a
 * crawler not to fetch the page — a URL it learns about elsewhere can still be
 * listed — while `noindex` tells it not to keep what it found.
 *
 * A layout rather than the page itself: the page is a client component and
 * cannot export `metadata`.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Statement verification · HIHODL",
  description: "Confirm that an account statement was issued by HIHODL and has not been altered.",
  robots: { index: false, follow: false, nocache: true },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

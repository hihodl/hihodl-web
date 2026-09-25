import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Connect with HOLD",
  description: "Open this on the phone that has HOLD.",
  robots: { index: false, follow: false },
  // The pairing URI rides in the query: no page this one links to learns it.
  referrer: "no-referrer",
};

export default function WcLayout({ children }: { children: ReactNode }) {
  return children;
}

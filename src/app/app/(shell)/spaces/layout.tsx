/**
 * Spaces, the first product under Benefits: the creator's side of HiSpace.
 * Drawn in the product shell (../layout.tsx), whose sidebar switches to the
 * Spaces menu on every page under here.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Spaces", template: "%s · Spaces · HOLD" },
  robots: { index: false, follow: false },
};

export default function SpacesLayout({ children }: { children: ReactNode }) {
  return children;
}

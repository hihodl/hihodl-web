import type { Metadata } from "next";

import { HomeScreen } from "@/components/app/main/HomeScreen";

export const metadata: Metadata = { title: "Savings" };

/**
 * Savings is a SCOPE of Home, not a screen.
 *
 * The column used to list it beside Home, which showed the same money twice —
 * Home's scope strip already has a Savings pill that switches the whole page
 * to that container. So this route opens Home on that pill: every link and
 * bookmark that pointed here still lands where it meant to.
 */
export default function SavingsPage() {
  return <HomeScreen initialScope="savings" />;
}

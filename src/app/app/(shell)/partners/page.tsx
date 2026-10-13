import type { Metadata } from "next";

import { PartnersScreen } from "@/components/app/partners/PartnersScreen";

export const metadata: Metadata = { title: "Partners" };

export default function PartnersPage() {
  return <PartnersScreen />;
}

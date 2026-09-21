import type { Metadata } from "next";

import { BoughtScreen } from "@/components/app/sponsor/BoughtScreen";

export const metadata: Metadata = { title: "Your spots" };

export default function BoughtPage() {
  return <BoughtScreen />;
}

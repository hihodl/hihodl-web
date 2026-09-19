import type { Metadata } from "next";

import { BenefitsScreen } from "@/components/app/main/BenefitsScreen";

export const metadata: Metadata = { title: "Benefits" };

export default function BenefitsPage() {
  return <BenefitsScreen />;
}

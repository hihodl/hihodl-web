import type { Metadata } from "next";

import { InvestScreen } from "@/components/app/money/InvestScreen";

export const metadata: Metadata = { title: "Invest" };

export default function InvestPage() {
  return <InvestScreen />;
}

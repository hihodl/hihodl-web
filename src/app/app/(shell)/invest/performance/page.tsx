import type { Metadata } from "next";

import { PerformanceScreen } from "@/components/app/money/PerformanceScreen";

export const metadata: Metadata = { title: "Portfolio" };

export default function PerformancePage() {
  return <PerformanceScreen />;
}

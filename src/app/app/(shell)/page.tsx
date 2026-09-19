import type { Metadata } from "next";

import { DashboardScreen } from "@/components/app/main/DashboardScreen";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardScreen />;
}

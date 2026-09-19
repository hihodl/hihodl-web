import type { Metadata } from "next";

import { ActivityScreen } from "@/components/app/main/ActivityScreen";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return <ActivityScreen />;
}

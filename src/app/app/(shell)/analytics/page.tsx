import type { Metadata } from "next";

import { AnalyticsScreen } from "@/components/app/analytics/AnalyticsScreen";

export const metadata: Metadata = { title: "Analytics" };

/** `?tab=subscriptions` opens straight onto Recurring, as the app's dashboard card does. */
export default function AnalyticsPage({ searchParams }: { searchParams: { tab?: string } }) {
  return <AnalyticsScreen initialTab={searchParams.tab} />;
}

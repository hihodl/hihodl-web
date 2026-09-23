import type { Metadata } from "next";

import { MetricScreen } from "@/components/app/analytics/MetricScreen";

export const metadata: Metadata = { title: "Analytics" };

/** Spent, Income or Net cashflow; the range rides in the query, as the app passes it in params. */
export default function AnalyticsMetricPage({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return <MetricScreen metric={params.key} query={searchParams} />;
}

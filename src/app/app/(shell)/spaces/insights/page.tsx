/**
 * Spaces › Insights: market data from HOLD Spaces' own paid orders, as a hub
 * of cards that each open their own screen (components/app/spaces/InsightsScreen).
 */

import type { Metadata } from "next";

import { InsightsScreen } from "@/components/app/spaces/InsightsScreen";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage({ searchParams }: { searchParams: { event?: string; view?: string; brand?: string } }) {
  return <InsightsScreen event={searchParams.event ?? null} view={searchParams.view ?? null} brand={searchParams.brand ?? null} />;
}

import type { Metadata } from "next";

import { CategoryScreen } from "@/components/app/analytics/CategoryScreen";

export const metadata: Metadata = { title: "Analytics" };

/** One category's payments for the range in the query. */
export default function AnalyticsCategoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return <CategoryScreen id={decodeURIComponent(params.id)} query={searchParams} />;
}

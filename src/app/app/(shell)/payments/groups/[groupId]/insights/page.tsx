/**
 * One group's Insights (components/app/payments/GroupInsights): what the
 * group spent, by month, category and person, and where you stand.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GroupInsights } from "@/components/app/payments/GroupInsights";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Group insights" };

export default function GroupInsightsPage({ params }: { params: { groupId: string } }) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(params.groupId)) notFound();
  return <GroupInsights groupId={params.groupId} />;
}

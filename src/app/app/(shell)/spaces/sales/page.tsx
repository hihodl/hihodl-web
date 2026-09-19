import type { Metadata } from "next";

import { SalesScreen } from "@/components/app/spaces/SalesScreen";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage({ searchParams }: { searchParams: { event?: string; listing?: string; offer?: string } }) {
  return <SalesScreen event={searchParams.event ?? null} listing={searchParams.listing ?? null} offer={searchParams.offer ?? null} />;
}

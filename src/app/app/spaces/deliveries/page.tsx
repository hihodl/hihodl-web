import type { Metadata } from "next";

import { DeliveriesScreen } from "@/components/app/spaces/DeliveriesScreen";

export const metadata: Metadata = { title: "Deliveries" };

export default function DeliveriesPage({ searchParams }: { searchParams: { item?: string; view?: string } }) {
  return <DeliveriesScreen selected={searchParams.item ?? null} view={searchParams.view ?? null} />;
}

import type { Metadata } from "next";

import { OffersScreen } from "@/components/app/spaces/OffersScreen";

export const metadata: Metadata = { title: "Offers & bids" };

export default function OffersPage({ searchParams }: { searchParams: { id?: string; view?: string } }) {
  return <OffersScreen selected={searchParams.id ?? null} view={searchParams.view ?? null} />;
}

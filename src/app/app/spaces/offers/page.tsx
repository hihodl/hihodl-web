import type { Metadata } from "next";

import { OffersScreen } from "@/components/app/spaces/OffersScreen";

export const metadata: Metadata = { title: "Offers & bids" };

export default function OffersPage({
  searchParams,
}: {
  searchParams: { event?: string; listing?: string; id?: string; view?: string; from?: string };
}) {
  return (
    <OffersScreen
      event={searchParams.event ?? null}
      listing={searchParams.listing ?? null}
      selected={searchParams.id ?? null}
      view={searchParams.view ?? null}
      from={searchParams.from ?? null}
    />
  );
}

import type { Metadata } from "next";

import { DeliveriesScreen } from "@/components/app/spaces/DeliveriesScreen";

export const metadata: Metadata = { title: "Deliveries" };

export default function DeliveriesPage({
  searchParams,
}: {
  searchParams: { event?: string; listing?: string; item?: string; view?: string };
}) {
  return (
    <DeliveriesScreen
      event={searchParams.event ?? null}
      listing={searchParams.listing ?? null}
      selected={searchParams.item ?? null}
      view={searchParams.view ?? null}
    />
  );
}

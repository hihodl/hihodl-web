/**
 * A new listing. `?template=<id>` (from Inspire) opens the wizard on that
 * template instead of the picker.
 */

import type { Metadata } from "next";

import { ListingWizard } from "@/components/creator/ListingWizard";

export const metadata: Metadata = { title: "New listing" };

export default function NewListingPage({ searchParams }: { searchParams: { template?: string } }) {
  return <ListingWizard templateId={searchParams.template} />;
}

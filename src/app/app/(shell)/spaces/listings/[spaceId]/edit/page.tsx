/**
 * A draft, back in the wizard. Only a draft can be edited: the API answers
 * `not_a_draft` on a listing that has gone live.
 */

import type { Metadata } from "next";

import { ListingWizard } from "@/components/creator/ListingWizard";

export const metadata: Metadata = { title: "Edit draft" };

export default function EditListingPage({ params }: { params: { spaceId: string } }) {
  return <ListingWizard spaceId={params.spaceId} />;
}

/**
 * /creator/listings/<id>/edit — picking a draft back up.
 *
 * A draft lives on the server from the moment the ladder is first saved, so
 * closing the tab costs nothing. This is the same wizard, opened on what is
 * already there: only a draft can be edited, and the API answers `not_a_draft`
 * on a listing that has gone live.
 */

import { ListingWizard } from "@/components/creator/ListingWizard";

export default function EditListingPage({ params }: { params: { spaceId: string } }) {
  return <ListingWizard spaceId={params.spaceId} />;
}

/**
 * /creator/listings/new — building a listing.
 *
 * A client page from the first paint: everything on it is the creator's own
 * (the catalogue is behind their token, the draft is theirs and nobody else's)
 * so there is nothing here a server render could have known first. The layout
 * above already tells search engines to stay out.
 */

import { ListingWizard } from "@/components/creator/ListingWizard";

export default function NewListingPage() {
  return <ListingWizard />;
}

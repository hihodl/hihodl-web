/**
 * A new listing. `?template=<id>` (from Inspire) opens the wizard on that
 * template instead of the picker, and `?inspiredBy=x:<handle>` or
 * `hold:<handle>` (Inspire's "Use this idea") credits whose campaign it
 * started from. `?claim=<claimId>` (Business › Your events, "Add a package")
 * sells a verified host's own event packages instead.
 */

import type { Metadata } from "next";

import { ListingWizard } from "@/components/creator/ListingWizard";
import { parseInspiredByParam } from "@/lib/creator/inspired-by";

export const metadata: Metadata = { title: "New listing" };

export default function NewListingPage({ searchParams }: { searchParams: { template?: string; inspiredBy?: string; claim?: string } }) {
  const claim = searchParams.claim && /^[A-Za-z0-9-]{1,64}$/.test(searchParams.claim) ? searchParams.claim : null;
  return (
    <ListingWizard
      // A fresh wizard per claim: the claim decides the catalogue it loads.
      key={claim ?? "listing"}
      templateId={searchParams.template}
      inspiredBy={parseInspiredByParam(searchParams.inspiredBy)}
      claimId={claim}
    />
  );
}

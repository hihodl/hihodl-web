/**
 * A new listing. `?template=<id>` (from Inspire) opens the wizard on that
 * template instead of the picker, and `?inspiredBy=x:<handle>` or
 * `hold:<handle>` (Inspire's "Use this idea") credits whose campaign it
 * started from.
 */

import type { Metadata } from "next";

import { ListingWizard } from "@/components/creator/ListingWizard";
import { parseInspiredByParam } from "@/lib/creator/inspired-by";

export const metadata: Metadata = { title: "New listing" };

export default function NewListingPage({ searchParams }: { searchParams: { template?: string; inspiredBy?: string } }) {
  return <ListingWizard templateId={searchParams.template} inspiredBy={parseInspiredByParam(searchParams.inspiredBy)} />;
}

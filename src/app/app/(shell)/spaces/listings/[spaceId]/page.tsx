/**
 * One listing, with its sections as tabs (`?tab=`), so each is its own screen.
 */

import type { Metadata } from "next";

import { ListingRunner } from "@/components/creator/ListingRunner";

export const metadata: Metadata = { title: "Listing" };

export default function ListingPage({
  params,
  searchParams,
}: {
  params: { spaceId: string };
  searchParams: { tab?: string; item?: string };
}) {
  return <ListingRunner spaceId={params.spaceId} tab={searchParams.tab} item={searchParams.item} />;
}

/**
 * /creator/listings/<id> — running a listing.
 *
 * Answering offers, approving a sponsor's artwork and putting up the link that
 * delivers a spot are the half of HiSpace that happens after the money moves,
 * and every one of them is an API call rather than anything on a chain. This
 * page is the reason a creator on an iPhone never has to be told to install
 * anything.
 */

import { ListingRunner } from "@/components/creator/ListingRunner";

export default function ListingPage({ params }: { params: { spaceId: string } }) {
  return <ListingRunner spaceId={params.spaceId} />;
}

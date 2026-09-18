/**
 * Spaces › Inspire: what a creator can sell (the template catalogue) and where
 * other creators are selling right now (the public events). The events are
 * read here, on the server, from the same public list the sitemap uses.
 */

import type { Metadata } from "next";

import { InspireScreen } from "@/components/app/spaces/InspireScreen";
import { listPublicEvents } from "@/lib/ad-space/server";

export const metadata: Metadata = { title: "Inspire" };

export default async function InspirePage({ searchParams }: { searchParams: { tab?: string } }) {
  const events = await listPublicEvents(24);
  return <InspireScreen events={events} tab={searchParams.tab ?? null} />;
}

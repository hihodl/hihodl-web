/**
 * Spaces › Inspire: what other creators have sold ad space on, by event
 * (components/app/spaces/InspireScreen). `?event=<slug>` opens an event's
 * campaigns (`&surface=` opens it filtered), `&c=<id>` one campaign; each is its own screen with Back.
 */

import type { Metadata } from "next";

import { InspireScreen } from "@/components/app/spaces/InspireScreen";

export const metadata: Metadata = { title: "Inspire" };

export default function InspirePage({ searchParams }: { searchParams: { event?: string; c?: string; surface?: string } }) {
  return <InspireScreen event={searchParams.event ?? null} campaign={searchParams.c ?? null} surface={searchParams.surface ?? null} />;
}

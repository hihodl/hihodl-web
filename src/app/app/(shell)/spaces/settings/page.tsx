import type { Metadata } from "next";

import { SpacesSettingsScreen } from "@/components/app/spaces/SpacesSettingsScreen";

export const metadata: Metadata = { title: "Settings" };

export default function SpacesSettingsPage({ searchParams }: { searchParams: { screen?: string; item?: string } }) {
  return <SpacesSettingsScreen screen={searchParams.screen} item={searchParams.item} />;
}

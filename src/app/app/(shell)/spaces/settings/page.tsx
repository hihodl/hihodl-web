import type { Metadata } from "next";

import { SpacesSettingsScreen } from "@/components/app/spaces/SpacesSettingsScreen";

export const metadata: Metadata = { title: "Settings" };

export default function SpacesSettingsPage() {
  return <SpacesSettingsScreen />;
}

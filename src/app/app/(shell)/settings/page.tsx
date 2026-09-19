import type { Metadata } from "next";

import { SettingsScreen } from "@/components/app/main/SettingsScreen";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage({ searchParams }: { searchParams: { screen?: string; item?: string } }) {
  return <SettingsScreen screen={searchParams.screen} item={searchParams.item} />;
}

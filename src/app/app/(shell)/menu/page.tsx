import type { Metadata } from "next";

import { MenuScreen } from "@/components/app/main/MenuScreen";

export const metadata: Metadata = { title: "Menu" };

export default function MenuPage({ searchParams }: { searchParams: { screen?: string; item?: string } }) {
  return <MenuScreen screen={searchParams.screen} item={searchParams.item} />;
}

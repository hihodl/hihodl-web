import type { Metadata } from "next";

import { ListingsScreen } from "@/components/app/spaces/ListingsScreen";

export const metadata: Metadata = { title: "Listings" };

export default function ListingsPage() {
  return <ListingsScreen />;
}

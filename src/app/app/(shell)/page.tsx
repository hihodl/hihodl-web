import type { Metadata } from "next";

import { HomeScreen } from "@/components/app/main/HomeScreen";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return <HomeScreen />;
}

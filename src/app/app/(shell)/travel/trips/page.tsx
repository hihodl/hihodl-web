import type { Metadata } from "next";

import { TripsScreen } from "@/components/app/stays/TripsScreen";

export const metadata: Metadata = { title: "Your trips" };

export default function TripsPage() {
  return <TripsScreen />;
}

import type { Metadata } from "next";

import { InTheAppScreen } from "@/components/app/main/InTheAppScreen";

export const metadata: Metadata = { title: "Stays" };

export default function TravelPage() {
  return <InTheAppScreen product="stays" />;
}

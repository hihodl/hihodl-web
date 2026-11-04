import type { Metadata } from "next";

import { RealisedGainsScreen } from "@/components/app/money/RealisedGainsScreen";

export const metadata: Metadata = { title: "Realised gains" };

export default function RealisedGainsPage() {
  return <RealisedGainsScreen />;
}

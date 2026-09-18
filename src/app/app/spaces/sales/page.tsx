import type { Metadata } from "next";

import { SalesScreen } from "@/components/app/spaces/SalesScreen";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage() {
  return <SalesScreen />;
}

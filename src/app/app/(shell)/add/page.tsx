import type { Metadata } from "next";

import { AddMoneyScreen } from "@/components/app/main/AddMoneyScreen";

export const metadata: Metadata = { title: "Add money" };

export default function AddMoneyPage() {
  return <AddMoneyScreen />;
}

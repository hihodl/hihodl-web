import type { Metadata } from "next";

import { SavingsScreen } from "@/components/app/money/SavingsScreen";

export const metadata: Metadata = { title: "Savings" };

export default function SavingsPage() {
  return <SavingsScreen />;
}

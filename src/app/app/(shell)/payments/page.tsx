import type { Metadata } from "next";

import { PaymentsScreen } from "@/components/app/payments/PaymentsScreen";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return <PaymentsScreen />;
}

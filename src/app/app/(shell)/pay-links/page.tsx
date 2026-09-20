import type { Metadata } from "next";

import { PayLinksScreen } from "@/components/app/main/PayLinksScreen";

export const metadata: Metadata = { title: "Pay links" };

export default function PayLinksPage() {
  return <PayLinksScreen />;
}

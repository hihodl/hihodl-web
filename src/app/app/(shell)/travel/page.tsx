import type { Metadata } from "next";

import { StaysScreen } from "@/components/app/stays/StaysScreen";

export const metadata: Metadata = { title: "Stays" };

export default function StaysPage() {
  return <StaysScreen />;
}

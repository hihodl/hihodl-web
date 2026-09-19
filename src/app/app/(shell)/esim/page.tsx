import type { Metadata } from "next";

import { InTheAppScreen } from "@/components/app/main/InTheAppScreen";

export const metadata: Metadata = { title: "eSIM" };

export default function EsimPage() {
  return <InTheAppScreen product="esim" />;
}

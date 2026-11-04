import type { Metadata } from "next";

import { CostBasisScreen } from "@/components/app/money/CostBasisScreen";

export const metadata: Metadata = { title: "What you paid" };

export default function CostBasisPage({ params }: { params: { symbol: string } }) {
  return <CostBasisScreen symbol={params.symbol} />;
}

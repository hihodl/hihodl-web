import type { Metadata } from "next";

import { WalletScreen } from "@/components/app/wallet/WalletScreen";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return <WalletScreen />;
}

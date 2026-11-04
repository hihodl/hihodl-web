import type { Metadata } from "next";

import { WalletScreen } from "@/components/app/wallet/WalletScreen";

export const metadata: Metadata = { title: "Send" };

/**
 * Send, for everybody: a web wallet opens on its Send, a wallet made in the
 * app sends through the linked phone (or is asked to link it), and somebody
 * with no wallet is told how to get one. Never a blank page, whatever the
 * rollout gate says (nav.openToAll).
 */
export default function SendPage() {
  return <WalletScreen send />;
}

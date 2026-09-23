import type { Metadata } from "next";

import { LinkScreen } from "@/components/app/link/LinkScreen";

export const metadata: Metadata = { title: "Link your phone" };

export default function LinkYourPhonePage() {
  return <LinkScreen />;
}

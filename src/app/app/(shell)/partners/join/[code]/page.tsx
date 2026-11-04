import type { Metadata } from "next";

import { JoinScreen } from "@/components/app/partners/JoinScreen";

export const metadata: Metadata = { title: "Join a partner team" };

export default function PartnerJoinPage({ params }: { params: { code: string } }) {
  return <JoinScreen code={params.code} />;
}

import type { Metadata } from "next";

import { BusinessScreen } from "@/components/app/business/BusinessScreen";
import { lumaKeyOf } from "@/lib/app/organiser-rules";

export const metadata: Metadata = { title: "Business" };

/**
 * The address is the state: `?tab=`, `?e=<enquiry>`, `?change=<treasury change>`, `?as=<seat>`,
 * and `?claim=<Luma link>` (the sponsor page's "Claim it", read on the Events tab).
 */
export default function BusinessPage({
  searchParams,
}: {
  searchParams: { tab?: string; e?: string; change?: string; as?: string; claim?: string };
}) {
  const id = (v: string | undefined) => (v && /^[A-Za-z0-9-]{1,64}$/.test(v) ? v : null);
  // Only a Luma link is ever pre-filled; anything else is dropped.
  const claim = searchParams.claim && lumaKeyOf(searchParams.claim) ? searchParams.claim.slice(0, 300) : null;
  return (
    <BusinessScreen
      tab={searchParams.tab ?? null}
      enquiry={id(searchParams.e)}
      change={id(searchParams.change)}
      as={id(searchParams.as)}
      claim={claim}
    />
  );
}

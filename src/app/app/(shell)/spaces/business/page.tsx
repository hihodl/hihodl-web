import type { Metadata } from "next";

import { BusinessScreen } from "@/components/app/business/BusinessScreen";

export const metadata: Metadata = { title: "Business" };

/** The address is the state: `?tab=`, `?e=<enquiry>`, `?change=<treasury change>`, `?as=<seat>`. */
export default function BusinessPage({ searchParams }: { searchParams: { tab?: string; e?: string; change?: string; as?: string } }) {
  const id = (v: string | undefined) => (v && /^[A-Za-z0-9-]{1,64}$/.test(v) ? v : null);
  return <BusinessScreen tab={searchParams.tab ?? null} enquiry={id(searchParams.e)} change={id(searchParams.change)} as={id(searchParams.as)} />;
}

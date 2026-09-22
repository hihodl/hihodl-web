/**
 * Spaces › Crew — creators who sell one package together, each paid their
 * part by the brand's own payment. `?crew=<id>` opens one; `?join=<code>` is a
 * link invitation, reached through the lead's invite link
 * (`/invite/<ref>?crew=<code>`, see app/invite/[code]).
 */

import type { Metadata } from "next";

import { CrewScreen } from "@/components/app/spaces/CrewScreen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crew" };

export default function CrewPage({ searchParams }: { searchParams: { crew?: string; join?: string } }) {
  const crewId = typeof searchParams.crew === "string" && /^[0-9a-f-]{36}$/i.test(searchParams.crew) ? searchParams.crew : null;
  // Link codes are 24 random bytes, base64url: anything else is not one.
  const join = typeof searchParams.join === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(searchParams.join) ? searchParams.join : null;
  return <CrewScreen crewId={crewId} join={join} />;
}

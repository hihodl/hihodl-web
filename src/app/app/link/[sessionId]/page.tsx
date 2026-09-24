import type { Metadata } from "next";

import { PhoneLink } from "@/components/app/link/PhoneLink";
import { linkUniversalUrl } from "@/lib/link/intent";
import { IOS_APP_ID } from "@/lib/appLinks";

export const dynamic = "force-dynamic";

/**
 * Safari's smart app banner opens THIS session in the HOLD app
 * (`app-argument`): the one way in on an iPhone that needs no tap on a link
 * Safari would keep for itself.
 */
export function generateMetadata({ params, searchParams }: { params: { sessionId: string }; searchParams: { k?: string | string[] } }): Metadata {
  const k = typeof searchParams.k === "string" ? searchParams.k : null;
  const here = `https://app.hihodl.xyz/link/${encodeURIComponent(params.sessionId)}${k ? `?k=${encodeURIComponent(k)}` : ""}`;
  return { itunes: { appId: IOS_APP_ID, appArgument: linkUniversalUrl(here) } };
}

export default function LinkPage({ params }: { params: { sessionId: string } }) {
  return <PhoneLink sessionId={params.sessionId} />;
}

/**
 * One group's thread: the chat and its money on one screen
 * (components/app/payments/GroupThread). The same screen opens from Payments ›
 * Groups and, for a crew, from Spaces › Crew; `?crew=<id>` says it was the
 * crew, so Back returns there.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GroupThread } from "@/components/app/payments/GroupThread";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Group" };

export default function GroupPage({ params, searchParams }: { params: { groupId: string }; searchParams: { crew?: string } }) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(params.groupId)) notFound();
  const groupId = params.groupId;
  const crew = typeof searchParams.crew === "string" && /^[0-9a-f-]{36}$/i.test(searchParams.crew) ? searchParams.crew : null;
  // Product-relative: the screen puts the host's prefix on it (useProductHref).
  const back = crew ? `/spaces/crew?crew=${crew}` : "/payments/groups";
  return <GroupThread groupId={groupId} backPath={back} backLabel={crew ? "the crew" : "Groups"} />;
}

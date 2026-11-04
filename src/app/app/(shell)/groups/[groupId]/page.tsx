/**
 * `/groups/<id>` is the path the backend names as the web's own for a group
 * (groups-splitwise-grade.md §6, `groupWebPath`). The thread lives under
 * Payments, so this only forwards there, keeping the host's prefix.
 */

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { appPrefixFor } from "@/lib/app/paths";

export default function GroupShortPath({ params }: { params: { groupId: string } }) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(params.groupId)) notFound();
  redirect(`${appPrefixFor(headers().get("host"))}/payments/groups/${params.groupId}`);
}

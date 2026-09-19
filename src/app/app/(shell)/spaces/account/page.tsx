/**
 * Account used to live under Spaces. It is the person's now, at /account;
 * old links (and bookmarks) land there, keeping which card they opened.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { appPrefixFor } from "@/lib/app/paths";

export default function OldAccountPage({ searchParams }: { searchParams: { view?: string } }) {
  const view = searchParams.view && /^[a-z-]{1,20}$/.test(searchParams.view) ? `?view=${searchParams.view}` : "";
  redirect(`${appPrefixFor(headers().get("host"))}/account${view}`);
}

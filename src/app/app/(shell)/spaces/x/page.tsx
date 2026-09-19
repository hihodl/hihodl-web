/**
 * Where X sends the browser back.
 *
 * The backend builds `<AD_SPACE_PUBLIC_BASE_URL>/creator/x` itself
 * (`returnBase("web")` in x-account.router.ts); the website's middleware sends
 * that address here with its query string, so the contract did not have to
 * move. `searchParams` is read on the server so the result is on the first
 * paint.
 */

import type { Metadata } from "next";

import { XReturn } from "@/components/creator/XReturn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "X account" };

export default function XReturnPage({ searchParams }: { searchParams: { result?: string; ticket?: string } }) {
  return <XReturn result={searchParams.result} ticket={searchParams.ticket} />;
}

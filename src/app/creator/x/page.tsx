/**
 * /creator/x — where X sends the browser back.
 *
 * The backend builds this URL itself (`returnBase("web")` in
 * x-account.router.ts, from `AD_SPACE_PUBLIC_BASE_URL`), so the path is part
 * of the contract and cannot move without moving it there too.
 *
 * `searchParams` is read here rather than with `useSearchParams` in the client
 * component: the values arrive with the first render, so the page never paints
 * a spinner it does not need, and the ticket is handed over as a prop instead
 * of being fished out of the URL twice.
 */

import { XReturn } from "@/components/creator/XReturn";

export const dynamic = "force-dynamic";

export default function CreatorXReturnPage({
  searchParams,
}: {
  searchParams: { result?: string; ticket?: string };
}) {
  return <XReturn result={searchParams.result} ticket={searchParams.ticket} />;
}

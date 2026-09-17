/**
 * The server's clock, for countdowns that must not trust the visitor's.
 *
 * A bid's end, an offer's deadline and a payment window are instants the
 * backend decides. A phone whose clock is five minutes off would otherwise show
 * bidding open after it closed. The browser reads this once per page and keeps
 * the difference (see `useServerNow`). Our servers and the API's both keep NTP
 * time, so this is the backend's clock to within milliseconds.
 */

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ now: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

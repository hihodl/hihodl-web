import { permanentRedirect } from "next/navigation";

/**
 * /founders sold the Founder Pass. The pass is closed (24 Sep 2026), so the
 * page is gone and its URL goes home. Orders that already exist keep their
 * status page at /founders/checkout?order=<reference>.
 */
export default function FoundersPage() {
  permanentRedirect("/");
}

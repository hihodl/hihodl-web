/**
 * /creator
 *
 * The whole console on one page: what you are selling, where you get paid, the
 * X account you publish under, and an honest list of what is still missing.
 * Building and running a listing are their own pages under /creator/listings,
 * because each is a sitting rather than a glance.
 */

import { CreatorConsole } from "@/components/creator/CreatorConsole";

export default function CreatorPage() {
  return <CreatorConsole />;
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { ResultsScreen } from "@/components/app/stays/ResultsScreen";

export const metadata: Metadata = { title: "Stays" };

export default function StaysSearchPage() {
  // `useSearchParams` needs a boundary: the search lives in the URL, which is
  // the one thing the server cannot know before the request.
  return (
    <Suspense>
      <ResultsScreen />
    </Suspense>
  );
}

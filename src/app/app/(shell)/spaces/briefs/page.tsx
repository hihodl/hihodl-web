import type { Metadata } from "next";

import { BriefsScreen } from "@/components/app/spaces/BriefsScreen";

export const metadata: Metadata = { title: "Briefs" };

export default function BriefsPage({
  searchParams,
}: {
  searchParams: { tab?: string; brief?: string; write?: string };
}) {
  return (
    <BriefsScreen
      tab={searchParams.tab ?? null}
      brief={searchParams.brief ?? null}
      write={searchParams.write === "1"}
    />
  );
}

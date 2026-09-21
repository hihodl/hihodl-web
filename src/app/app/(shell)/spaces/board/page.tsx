import type { Metadata } from "next";

import { BoardScreen } from "@/components/app/sponsor/BoardScreen";

export const metadata: Metadata = { title: "Find a spot" };

export default function BoardPage() {
  return <BoardScreen />;
}

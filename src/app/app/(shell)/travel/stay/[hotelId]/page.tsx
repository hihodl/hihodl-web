import type { Metadata } from "next";
import { Suspense } from "react";

import { StayScreen } from "@/components/app/stays/StayScreen";

export const metadata: Metadata = { title: "Stay" };

export default function OneStayPage({ params }: { params: { hotelId: string } }) {
  return (
    <Suspense>
      <StayScreen hotelId={params.hotelId} />
    </Suspense>
  );
}

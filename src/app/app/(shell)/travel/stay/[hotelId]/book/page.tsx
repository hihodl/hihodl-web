import type { Metadata } from "next";
import { Suspense } from "react";

import { CheckoutScreen } from "@/components/app/stays/CheckoutScreen";

export const metadata: Metadata = { title: "Confirm and pay" };

export default function BookStayPage({ params }: { params: { hotelId: string } }) {
  return (
    <Suspense>
      <CheckoutScreen hotelId={params.hotelId} />
    </Suspense>
  );
}

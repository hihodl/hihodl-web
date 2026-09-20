import type { Metadata } from "next";

import { BookingScreen } from "@/components/app/stays/BookingScreen";

export const metadata: Metadata = { title: "Booking" };

export default function OneBookingPage({ params }: { params: { id: string } }) {
  return <BookingScreen bookingId={params.id} />;
}

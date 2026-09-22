/**
 * Payments › Groups: the Payments screen with its Groups chip already chosen,
 * so a group's Back and a link from elsewhere land on the list of groups and
 * not on the list of people.
 */

import type { Metadata } from "next";

import { PaymentsScreen } from "@/components/app/payments/PaymentsScreen";

export const metadata: Metadata = { title: "Groups" };

export default function GroupsPage() {
  return <PaymentsScreen initialFilter="groups" />;
}

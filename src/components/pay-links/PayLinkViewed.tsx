"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics/mixpanel";

/**
 * pay_link_viewed (tracking-plan.md, "Web"). A personal link (`/pay/@handle`)
 * reports as "personal": the handle is a person, not a link.
 */
export function PayLinkViewed({ code, state }: { code: string; state: string }) {
  useEffect(() => {
    track("pay_link_viewed", { link_id: code.startsWith("@") ? "personal" : code, state });
  }, [code, state]);

  return null;
}

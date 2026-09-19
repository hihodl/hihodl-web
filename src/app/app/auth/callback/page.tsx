/**
 * app.hihodl.xyz/auth/callback: where "Continue with Apple / Google" returns
 * (the exact address on the Supabase redirect allow-list).
 */

import type { Metadata } from "next";

import { SpacesGround } from "@/components/ad-space/ground";
import { AuthCallback } from "@/components/app/front/AuthCallback";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Signing in", referrer: "no-referrer" };

export default function AuthCallbackPage() {
  return (
    <SpacesGround>
      <AuthCallback />
    </SpacesGround>
  );
}

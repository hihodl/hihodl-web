/**
 * The demo's screen index (preview/web-together-demo only): every screen of
 * the web and every state of it, one link each. See components/demo.
 */

import type { Metadata } from "next";

import { SpacesGround } from "@/components/ad-space/ground";
import { ScreenIndex } from "@/components/demo/ScreenIndex";

export const metadata: Metadata = { title: "Every screen (demo)", robots: { index: false, follow: false } };

export default function ScreensPage() {
  return (
    <SpacesGround>
      <ScreenIndex />
    </SpacesGround>
  );
}

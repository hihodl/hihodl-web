"use client";

/**
 * The web demo on every page (preview/web-together-demo only): the network
 * shim that answers every backend call in this browser (lib/demo/fetch,
 * installed as this module loads, before any screen asks anything), the DEMO
 * badge, and the page helpers the screen index links rely on.
 */

import "@/lib/demo/fetch";

import { DemoBadge } from "@/components/creator/DemoBadge";

import { DemoAutoOpen } from "./DemoAutoOpen";

export function DemoRuntime() {
  return (
    <>
      <DemoAutoOpen />
      <DemoBadge />
    </>
  );
}

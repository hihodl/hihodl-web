import type { Metadata } from "next";

import { HeroGlobe } from "@/components/site/HeroGlobe";

/**
 * Preview harness for HeroGlobe (v4 of the payment globe).
 *
 * Not linked from anywhere and not indexable — it exists so the globe can be
 * reviewed at full bleed before deciding whether it replaces PaymentGlobe in
 * the homepage hero.
 */
export const metadata: Metadata = {
  title: "Hero globe — preview",
  robots: { index: false, follow: false },
};

export default function HeroGlobeLabPage() {
  return (
    <main style={{ background: "#05101B", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px 64px" }}>
        <HeroGlobe showCaption />
      </div>
    </main>
  );
}

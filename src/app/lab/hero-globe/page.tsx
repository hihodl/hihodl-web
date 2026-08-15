import type { Metadata } from "next";
import type { CSSProperties } from "react";

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

const label: CSSProperties = {
  color: "rgba(255,255,255,0.5)",
  font: "600 12px/1.4 system-ui, sans-serif",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  margin: "40px 0 12px",
};

export default function HeroGlobeLabPage() {
  return (
    <main style={{ background: "#05101B", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px 64px" }}>
        <p style={label}>fit=&quot;stage&quot; · full-bleed 16:9, bubbles on</p>
        <HeroGlobe showCaption />

        <p style={label}>fit=&quot;globe&quot; · square window, as mounted in the hero</p>
        <div style={{ maxWidth: 448 }}>
          <HeroGlobe fit="globe" showBubbles={false} />
        </div>
      </div>
    </main>
  );
}

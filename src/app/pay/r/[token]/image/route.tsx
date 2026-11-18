import { ImageResponse } from "next/og";

import { CHAIN_LABEL, instantUtc } from "@/lib/ad-space/format";
import { ownerName } from "@/lib/pay-links/client";
import { getReceipt } from "@/lib/pay-links/server";

/**
 * /pay/r/<token>/image — the receipt as a PNG, for "Save receipt".
 *
 * The button used to open the print dialog, and a wallet's in-app browser
 * (Phantom, 18-Nov-2026) has none: the tap did nothing. A picture saves
 * everywhere: the share sheet's "Save Image" on a phone, a download on a
 * computer.
 *
 * Private as the page is: never cached, never indexed (robots disallows
 * /pay/r/). Satori draws it, so flex layout and inline styles only.
 */

export const dynamic = "force-dynamic";

const W = 1080;
const H = 1350;

function short(id: string): string {
  return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const found = await getReceipt(params.token, req.headers);
  if (found.kind === "missing") return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (found.kind !== "found") return new Response("Try again in a moment", { status: 503, headers: { "Cache-Control": "no-store" } });

  const r = found.value;
  const name = r.link.owner?.displayName?.trim() || ownerName(r.link.owner);
  const handle = r.link.owner?.handle ? `@${r.link.owner.handle}` : null;
  const [whole, frac] = (r.amountCents / 100).toFixed(2).split(".");

  const rows: Array<[string, string]> = [["From", short(r.payerAddress)], ["Network", `USDC on ${CHAIN_LABEL[r.chain]}`]];
  if (r.paidAt) rows.push(["When", instantUtc(r.paidAt)]);
  if (r.txHash) rows.push(["Transaction", short(r.txHash)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "72px 72px 64px",
          color: "#FFFFFF",
          backgroundImage:
            "linear-gradient(236deg,rgba(255,183,3,0) 8%,rgba(255,183,3,0.13) 22%,rgba(255,183,3,0.04) 40%,rgba(255,183,3,0) 60%),linear-gradient(180deg,#1a5276 0%,#0f3555 37.5%,#0a1929 75%,#0a1929 100%)",
        }}
      >
        <div style={{ display: "flex", width: "100%", fontSize: 44, fontWeight: 800, letterSpacing: 2 }}>HOLD</div>

        <div
          style={{
            marginTop: 90,
            width: 150,
            height: 150,
            borderRadius: 75,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid rgba(125,211,168,0.45)",
            backgroundColor: "rgba(125,211,168,0.16)",
            color: "#7DD3A8",
            fontSize: 80,
          }}
        >
          ✓
        </div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 36, fontWeight: 700, color: "#7DD3A8" }}>Paid</div>
        <div style={{ display: "flex", alignItems: "flex-start", marginTop: 18 }}>
          <span style={{ fontSize: 76, fontWeight: 700, color: "#DCE7EE", marginTop: 22 }}>$</span>
          <span style={{ fontSize: 170, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>{Number(whole).toLocaleString("en-US")}</span>
          <span style={{ fontSize: 76, fontWeight: 700, color: "#AFBBC6", marginTop: 88 }}>.{frac}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 26, fontSize: 38 }}>
          <span style={{ fontWeight: 700 }}>to {name.length > 28 ? `${name.slice(0, 27)}…` : name}</span>
          {handle && handle !== name ? <span style={{ marginLeft: 16, color: "#C8D0D9" }}>{handle}</span> : null}
        </div>
        {r.link.title ? <div style={{ display: "flex", marginTop: 10, fontSize: 30, color: "#C8D0D9" }}>{r.link.title.slice(0, 60)}</div> : null}

        <div
          style={{
            marginTop: 64,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            borderRadius: 44,
            border: "2px solid rgba(255,255,255,0.12)",
            backgroundColor: "rgba(13,24,32,0.66)",
            padding: "8px 40px",
          }}
        >
          {rows.map(([label, value], i) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                height: 100,
                fontSize: 34,
                borderTop: i === 0 ? "none" : "2px solid rgba(255,255,255,0.07)",
              }}
            >
              <span style={{ color: "#AFBBC6" }}>{label}</span>
              <span style={{ fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 26, color: "#9FB7C2", textAlign: "center" }}>
          It went straight to {name}&rsquo;s wallet. HOLD never held it and can&rsquo;t reverse it.
        </div>
      </div>
    ),
    { width: W, height: H, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } },
  );
}

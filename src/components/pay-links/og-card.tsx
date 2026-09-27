import { clipText } from "../../lib/pay-links/og-copy";

/**
 * A pay link's card image, drawn by Satori (/api/og/pay/<code>): the pay
 * page's dark HOLD ground with its cyan glow, the person, and for a priced
 * link what it is for and its price, big. No sentence, so one image serves
 * every language.
 *
 * `photo` and `logo` are data URIs or null. `photo` is only ever the public
 * profile's photo; without one the face is the app's initials on the amber
 * circle, never an emoji.
 *
 * Satori: flex layout only, inline styles, no classes, the default font.
 * Relative imports only, so a scratch script can draw it outside Next.
 */

const W = 1200;
const H = 630;
const INK = "#0D1820";
const TEXT = "#FFFFFF";
const MUTED = "#9FB7C2";
const FACE_INK = "#241A02";

export interface PayOgCardProps {
  name: string;
  handle: string | null;
  photo: string | null;
  logo: string | null;
  initials: string;
  /** A priced link's title; null draws the personal card. */
  title: string | null;
  /** "$40" for a fixed price, null for an open amount. */
  price: string | null;
}

function Face({ size, photo, initials }: { size: number; photo: string | null; initials: string }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>
    <img src={photo} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: size / 2, objectFit: "cover" }} />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "linear-gradient(135deg, #FFD25A 0%, #FFB703 100%)",
        color: FACE_INK,
        fontSize: Math.round(size * 0.36),
        letterSpacing: -1,
      }}
    >
      {initials}
    </div>
  );
}

export function PayOgCard({ name, handle, photo, logo, initials, title, price }: PayOgCardProps) {
  const handleLine = handle && handle !== name ? handle : null;
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", backgroundColor: INK, color: TEXT }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: 400,
          display: "flex",
          backgroundImage: "linear-gradient(180deg, rgba(0,194,255,0.45) 0%, rgba(54,224,255,0) 100%)",
        }}
      />

      {title !== null ? (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", flexGrow: 1 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Face size={104} photo={photo} initials={initials} />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 28 }}>
              <div style={{ display: "flex", fontSize: 44 }}>{clipText(name, 30)}</div>
              {handleLine ? <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 2 }}>{clipText(handleLine, 30)}</div> : null}
            </div>
          </div>
          {/* With a price, the title is the small line above it; without one, it is the headline. */}
          <div style={price ? { display: "flex", marginTop: 48, fontSize: 50, lineHeight: 1.15, color: MUTED } : { display: "flex", marginTop: 48, fontSize: 80, lineHeight: 1.1, letterSpacing: -2 }}>
            {clipText(title, price ? 44 : 50)}
          </div>
          {price ? <div style={{ display: "flex", marginTop: 6, fontSize: 136, letterSpacing: -4, lineHeight: 1.05 }}>{price}</div> : null}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, paddingTop: 20 }}>
          <Face size={230} photo={photo} initials={initials} />
          <div style={{ display: "flex", marginTop: 30, fontSize: 80, letterSpacing: -2 }}>{clipText(name, 24)}</div>
          {handleLine ? <div style={{ display: "flex", marginTop: 4, fontSize: 36, color: MUTED }}>{clipText(handleLine, 30)}</div> : null}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 80px 48px" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>
          <img src={logo} alt="" width={140} height={34} style={{ width: 140, height: 34 }} />
        ) : (
          <div style={{ display: "flex", fontSize: 36, letterSpacing: 1 }}>HOLD</div>
        )}
        <div style={{ display: "flex", fontSize: 26, color: MUTED, letterSpacing: 1 }}>hihodl.xyz</div>
      </div>
    </div>
  );
}

import QRCode from "qrcode";

/**
 * A QR code as SVG path data, built synchronously from the module matrix so it
 * can sit inside another SVG (a sold zone on the board) or stand alone (the
 * Solana Pay code). Same output on the server and in the browser.
 */
export function qrModules(text: string, level: "L" | "M" | "Q" | "H" = "M"): { size: number; d: string } | null {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: level });
    const { size, data } = qr.modules;
    let d = "";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r * size + c]) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { size, d };
  } catch {
    return null;
  }
}

export function QrCode({
  text,
  className = "",
  title,
  level = "M",
  logo,
}: {
  text: string;
  className?: string;
  title: string;
  /** Error correction. A code with a logo over its middle needs "H". */
  level?: "L" | "M" | "Q" | "H";
  /** An image drawn in the middle on a white plate (keep it under a fifth of the side). */
  logo?: string;
}) {
  const qr = qrModules(text, logo ? "H" : level);
  if (!qr) return null;
  const quiet = 3;
  const full = qr.size + quiet * 2;
  return (
    <svg
      viewBox={`${-quiet} ${-quiet} ${full} ${full}`}
      className={className}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
    >
      <rect x={-quiet} y={-quiet} width={full} height={full} fill="#FFFFFF" />
      <path d={qr.d} fill="#0A0500" />
      {logo ? (() => {
        const plate = Math.round(qr.size * 0.24);
        const at = (qr.size - plate) / 2;
        const pad = plate * 0.12;
        return (
          <g>
            <rect x={at} y={at} width={plate} height={plate} rx={plate * 0.22} fill="#FFFFFF" />
            <clipPath id={`qr-logo-${qr.size}`}>
              <rect x={at + pad} y={at + pad} width={plate - pad * 2} height={plate - pad * 2} rx={(plate - pad * 2) * 0.22} />
            </clipPath>
            <image
              href={logo}
              x={at + pad}
              y={at + pad}
              width={plate - pad * 2}
              height={plate - pad * 2}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#qr-logo-${qr.size})`}
            />
          </g>
        );
      })() : null}
    </svg>
  );
}

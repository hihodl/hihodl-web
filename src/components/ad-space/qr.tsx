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

/**
 * HOLD's own code, drawn as the app draws it (hihodl-wallet src/ui/HQR.tsx):
 * rounded modules in #0A1A24, each finder eye dark with an amber square
 * behind it so only its light ring shows amber, and the HOLD mark on a white
 * chip in the middle (a quarter of the side, cleared, "H" correction). The
 * pay page's codes: Solana Pay and the WalletConnect pairing.
 */
export function HoldQrCode({ text, title, logo, className = "" }: { text: string; title: string; logo: string; className?: string }) {
  let qr: ReturnType<typeof QRCode.create>;
  try {
    qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  } catch {
    return null;
  }
  const n = qr.modules.size;
  const data = qr.modules.data;
  const inEye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const chip = Math.round(n * 0.25);
  const lo = Math.floor((n - chip) / 2);
  const hi = lo + chip;
  const k = 0.32;
  const side = (1 - 2 * k).toFixed(2);
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!data[r * n + c] || inEye(r, c)) continue;
      if (r >= lo - 1 && r < hi + 1 && c >= lo - 1 && c < hi + 1) continue;
      d += `M${c + k} ${r}h${side}a${k} ${k} 0 0 1 ${k} ${k}v${side}a${k} ${k} 0 0 1 -${k} ${k}h-${side}a${k} ${k} 0 0 1 -${k} -${k}v-${side}a${k} ${k} 0 0 1 ${k} -${k}z`;
    }
  }
  const eyes: [number, number][] = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  const pad = chip * 0.1;
  const clip = `hold-qr-${n}`;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className={className} role="img" aria-label={title}>
      {eyes.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.3} fill="#FFB703" />
          <path
            d={`M${x + 1.8} ${y}h3.4a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1 -1.8 1.8h-3.4a1.8 1.8 0 0 1 -1.8 -1.8v-3.4a1.8 1.8 0 0 1 1.8 -1.8zM${x + 2.2} ${y + 1}a1.2 1.2 0 0 0 -1.2 1.2v2.6a1.2 1.2 0 0 0 1.2 1.2h2.6a1.2 1.2 0 0 0 1.2 -1.2v-2.6a1.2 1.2 0 0 0 -1.2 -1.2z`}
            fill="#0A1A24"
            fillRule="evenodd"
          />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={1.2} fill="#0A1A24" />
        </g>
      ))}
      <path d={d} fill="#0A1A24" />
      <rect x={lo} y={lo} width={chip} height={chip} rx={chip * 0.28} fill="#FFFFFF" />
      <clipPath id={clip}>
        <rect x={lo + pad} y={lo + pad} width={chip - pad * 2} height={chip - pad * 2} rx={(chip - pad * 2) * 0.26} />
      </clipPath>
      <image href={logo} x={lo + pad} y={lo + pad} width={chip - pad * 2} height={chip - pad * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
    </svg>
  );
}

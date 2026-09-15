import QRCode from "qrcode";

/**
 * A QR code as SVG path data, built synchronously from the module matrix so it
 * can sit inside another SVG (a sold zone on the board) or stand alone (the
 * Solana Pay code). Same output on the server and in the browser.
 */
export function qrModules(text: string): { size: number; d: string } | null {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
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
}: {
  text: string;
  className?: string;
  title: string;
}) {
  const qr = qrModules(text);
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
    </svg>
  );
}
